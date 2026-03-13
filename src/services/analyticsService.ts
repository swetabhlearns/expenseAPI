import { ClaimModel } from "../models/claim.js";
import { UserModel } from "../models/user.js";

const APPROVED_STATUSES = new Set([
  "APPROVED_L1",
  "APPROVED_L2",
  "APPROVED_L3",
  "PARTIALLY_DISBURSED",
  "DISBURSED",
  "COMPLETED",
]);
const REJECTED_STATUSES = new Set(["REJECTED"]);

function toDateRangeFilter(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return {};
  return {
    date: {
      ...(startDate ? { $gte: startDate } : {}),
      ...(endDate ? { $lte: endDate } : {}),
    },
  };
}

function toPaymentBifurcationFilter(args: {
  startDate?: string;
  endDate?: string;
  companyVertical?: string;
  paymentType?: "CAPEX" | "OPEX";
}) {
  return {
    ...toDateRangeFilter(args.startDate, args.endDate),
    ...(args.companyVertical ? { companyVertical: args.companyVertical } : {}),
    ...(args.paymentType ? { costType: args.paymentType } : {}),
  };
}

function summarizeStatus(status: string) {
  if (REJECTED_STATUSES.has(status)) return "rejected";
  if (APPROVED_STATUSES.has(status)) return "approved";
  return "pending";
}

export async function getClaimsOverview(args: { startDate?: string; endDate?: string }) {
  const claims = await ClaimModel.find(toDateRangeFilter(args.startDate, args.endDate)).lean();
  const totalClaims = claims.length;
  const totalAmount = claims.reduce((sum, claim) => sum + (claim.amount || 0), 0);

  const byStatus: Record<string, { count: number; amount: number }> = {};
  for (const claim of claims) {
    const key = claim.status || "UNKNOWN";
    if (!byStatus[key]) byStatus[key] = { count: 0, amount: 0 };
    byStatus[key].count += 1;
    byStatus[key].amount += claim.amount || 0;
  }

  return {
    totalClaims,
    totalAmount,
    averageAmount: totalClaims > 0 ? totalAmount / totalClaims : 0,
    byStatus,
  };
}

export async function getClaimsTimeSeries(args: { startDate?: string; endDate?: string }) {
  const rows = await ClaimModel.aggregate([
    { $match: toDateRangeFilter(args.startDate, args.endDate) },
    {
      $group: {
        _id: "$date",
        count: { $sum: 1 },
        amount: { $sum: "$amount" },
      },
    },
    { $project: { _id: 0, date: "$_id", count: 1, amount: 1 } },
    { $sort: { date: 1 } },
  ]);

  return rows;
}

export async function getEmployeeStatistics(args: { startDate?: string; endDate?: string }) {
  const rows = await ClaimModel.aggregate([
    { $match: toDateRangeFilter(args.startDate, args.endDate) },
    {
      $group: {
        _id: "$userId",
        userName: { $last: "$userName" },
        totalClaims: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        statuses: { $push: "$status" },
      },
    },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        userName: 1,
        totalClaims: 1,
        totalAmount: 1,
        approvedClaims: {
          $size: {
            $filter: {
              input: "$statuses",
              cond: { $in: ["$$this", Array.from(APPROVED_STATUSES)] },
            },
          },
        },
        rejectedClaims: {
          $size: {
            $filter: {
              input: "$statuses",
              cond: { $eq: ["$$this", "REJECTED"] },
            },
          },
        },
        pendingClaims: {
          $size: {
            $filter: {
              input: "$statuses",
              cond: {
                $and: [
                  { $not: { $in: ["$$this", Array.from(APPROVED_STATUSES)] } },
                  { $ne: ["$$this", "REJECTED"] },
                ],
              },
            },
          },
        },
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  return rows;
}

export async function getEmployeeStatisticsPage(args: { startDate?: string; endDate?: string; page: number; pageSize: number }) {
  const rows = await getEmployeeStatistics(args);
  const page = Math.max(1, args.page);
  const pageSize = Math.min(100, Math.max(1, args.pageSize));
  const start = (page - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}

export async function getAdminPerformancePage(args: { startDate?: string; endDate?: string; page: number; pageSize: number }) {
  const users = await UserModel.find({ role: { $in: ["L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN"] } }).lean();
  const claims = await ClaimModel.find(toDateRangeFilter(args.startDate, args.endDate)).lean();

  const pendingByRole = {
    L1_ADMIN: new Set(["SUBMITTED", "RETURNED_TO_L1"]),
    L2_ADMIN: new Set(["APPROVED_L1", "RETURNED_TO_L2"]),
    L3_ADMIN: new Set(["APPROVED_L2", "RETURNED_TO_L3"]),
    L4_ADMIN: new Set(["APPROVED_L3", "PARTIALLY_DISBURSED", "DISBURSED"]),
  };

  const items = users.map((user) => {
    const approved = claims.filter((c) => {
      if (user.role === "L1_ADMIN") return c.l1ReviewOutcome === "APPROVE" && c.l1ApproverId === (user.convexId || String(user._id));
      if (user.role === "L2_ADMIN") return c.l2ReviewOutcome === "APPROVE" && c.l2ApproverId === (user.convexId || String(user._id));
      return (c.logs || []).some((log: any) => log?.actor === user.name && log?.action === "APPROVE");
    }).length;

    const rejected = claims.filter((c) => {
      if (user.role === "L1_ADMIN") return c.l1ReviewOutcome === "REJECT" && c.l1ApproverId === (user.convexId || String(user._id));
      if (user.role === "L2_ADMIN") return c.l2ReviewOutcome === "REJECT" && c.l2ApproverId === (user.convexId || String(user._id));
      return (c.logs || []).some((log: any) => log?.actor === user.name && log?.action === "REJECT");
    }).length;

    const pending = claims.filter((c) => pendingByRole[user.role as keyof typeof pendingByRole]?.has(c.status || "")).length;
    const totalProcessed = approved + rejected;

    return {
      userId: (user.convexId || String(user._id)),
      name: user.name,
      levelName: user.role.replace("_", " "),
      approved,
      rejected,
      pending,
      totalProcessed,
      approvalRate: totalProcessed > 0 ? (approved / totalProcessed) * 100 : 0,
    };
  });

  const page = Math.max(1, args.page);
  const pageSize = Math.min(100, Math.max(1, args.pageSize));
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

export async function getPaymentBifurcationSummary(args: {
  startDate?: string;
  endDate?: string;
  companyVertical?: string;
  paymentType?: "CAPEX" | "OPEX";
}) {
  const claims = await ClaimModel.find(toPaymentBifurcationFilter(args)).lean();

  const totals = {
    totalRequests: { count: claims.length, amount: 0 },
    underReview: { count: 0, amount: 0 },
    approved: {
      amount: 0,
      awaitingPayment: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
    },
    advanceAndRemaining: {
      totalTrackedAmount: 0,
      advancePaidAmount: 0,
      remainingBalancePendingAmount: 0,
    },
    advancePaid: { count: 0, amount: 0 },
    remainingBalancePending: { count: 0, amount: 0 },
    byPaymentMode: {
      cash: {
        totalRequests: { count: 0, amount: 0 },
        advancePaid: { count: 0, amount: 0 },
        remainingBalancePending: { count: 0, amount: 0 },
      },
      accountTransfer: {
        totalRequests: { count: 0, amount: 0 },
        advancePaid: { count: 0, amount: 0 },
        remainingBalancePending: { count: 0, amount: 0 },
      },
    },
  };

  for (const claim of claims) {
    const amount = claim.totalRequestedAmount ?? claim.amount ?? 0;
    const paidAmount = claim.totalDisbursedAmount ?? 0;
    const remaining = claim.pendingAmount ?? Math.max(0, amount - paidAmount);
    const modeKey = claim.paymentMode === "CASH" ? "cash" : "accountTransfer";

    totals.totalRequests.amount += amount;
    totals.byPaymentMode[modeKey].totalRequests.count += 1;
    totals.byPaymentMode[modeKey].totalRequests.amount += amount;

    if (summarizeStatus(claim.status || "") === "pending") {
      totals.underReview.count += 1;
      totals.underReview.amount += amount;
    }

    if (APPROVED_STATUSES.has(claim.status || "")) {
      totals.approved.amount += amount;
      if (paidAmount > 0) {
        totals.approved.paid.count += 1;
        totals.approved.paid.amount += paidAmount;
      }
      if (remaining > 0) {
        totals.approved.awaitingPayment.count += 1;
        totals.approved.awaitingPayment.amount += remaining;
      }
    }

    if (paidAmount > 0) {
      totals.advancePaid.count += 1;
      totals.advancePaid.amount += paidAmount;
      totals.byPaymentMode[modeKey].advancePaid.count += 1;
      totals.byPaymentMode[modeKey].advancePaid.amount += paidAmount;
    }

    if (remaining > 0) {
      totals.remainingBalancePending.count += 1;
      totals.remainingBalancePending.amount += remaining;
      totals.byPaymentMode[modeKey].remainingBalancePending.count += 1;
      totals.byPaymentMode[modeKey].remainingBalancePending.amount += remaining;
    }

    totals.advanceAndRemaining.advancePaidAmount += paidAmount;
    totals.advanceAndRemaining.remainingBalancePendingAmount += remaining;
  }

  totals.advanceAndRemaining.totalTrackedAmount =
    totals.advanceAndRemaining.advancePaidAmount + totals.advanceAndRemaining.remainingBalancePendingAmount;

  return totals;
}

export async function getAllClaimsDetailedPage(args: {
  startDate?: string;
  endDate?: string;
  statusFilter?: string;
  searchQuery?: string;
  sortField?: "userName" | "title" | "amount" | "date";
  sortOrder?: "asc" | "desc";
  cycleNumber?: number;
  page: number;
  pageSize: number;
}) {
  let claims = await ClaimModel.find(toDateRangeFilter(args.startDate, args.endDate)).lean();

  if (args.searchQuery) {
    const query = args.searchQuery.toLowerCase();
    claims = claims.filter((c) =>
      (c.userName || "").toLowerCase().includes(query) ||
      (c.projectTitle || c.title || "").toLowerCase().includes(query)
    );
  }

  if (args.cycleNumber) {
    claims = claims.filter((c) => (c.currentCycleNumber || 1) === args.cycleNumber);
  }

  const counts = claims.reduce(
    (acc, claim) => {
      const status = summarizeStatus(claim.status || "");
      acc[status] += 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 }
  );

  if (args.statusFilter && args.statusFilter !== "all") {
    claims = claims.filter((c) => summarizeStatus(c.status || "") === args.statusFilter);
  }

  const sortField = args.sortField || "date";
  const sortOrder = args.sortOrder || "desc";
  claims.sort((a, b) => {
    const left = (a as any)[sortField] ?? (sortField === "title" ? a.projectTitle || a.title || "" : "");
    const right = (b as any)[sortField] ?? (sortField === "title" ? b.projectTitle || b.title || "" : "");
    if (left < right) return sortOrder === "asc" ? -1 : 1;
    if (left > right) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const page = Math.max(1, args.page);
  const pageSize = Math.min(100, Math.max(1, args.pageSize));
  const start = (page - 1) * pageSize;

  return {
    items: claims.slice(start, start + pageSize).map((claim) => ({
      id: claim.convexId || String(claim._id),
      userName: claim.userName,
      title: claim.projectTitle || claim.title || "",
      description: claim.description,
      amount: claim.amount,
      date: claim.date,
      status: claim.status,
      logs: claim.logs || [],
      currentCycleNumber: claim.currentCycleNumber,
      totalRequestedAmount: claim.totalRequestedAmount,
      totalDisbursedAmount: claim.totalDisbursedAmount,
      pendingAmount: claim.pendingAmount,
    })),
    total: claims.length,
    page,
    pageSize,
    counts,
  };
}

export async function getUserDetailedStats(args: { userId: string; startDate?: string; endDate?: string }) {
  const user = await UserModel.findOne({ $or: [{ convexId: args.userId }, { _id: args.userId }] }).lean();
  if (!user) return null;

  const claims = await ClaimModel.find({
    ...toDateRangeFilter(args.startDate, args.endDate),
    $or: [{ userId: args.userId }, { userId: user.convexId }, { userId: String(user._id) }].filter((entry) => entry.userId),
  }).lean();

  if (user.role === "USER") {
    const totalClaims = claims.length;
    const totalAmount = claims.reduce((sum, c) => sum + (c.amount || 0), 0);
    const approvedClaims = claims.filter((c) => APPROVED_STATUSES.has(c.status || "")).length;
    const rejectedClaims = claims.filter((c) => (c.status || "") === "REJECTED").length;
    const pendingClaims = claims.filter((c) => !APPROVED_STATUSES.has(c.status || "") && (c.status || "") !== "REJECTED").length;

    const monthlyMap = new Map<string, { month: string; count: number; amount: number }>();
    for (const claim of claims) {
      const month = (claim.date || "").slice(0, 7);
      const bucket = monthlyMap.get(month) || { month, count: 0, amount: 0 };
      bucket.count += 1;
      bucket.amount += claim.amount || 0;
      monthlyMap.set(month, bucket);
    }

    return {
      user: {
        _id: user.convexId || String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
      totalClaims,
      totalAmount,
      approvedClaims,
      rejectedClaims,
      pendingClaims,
      monthlyBreakdown: Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  const activity = claims.flatMap((claim) =>
    (claim.logs || [])
      .filter((log: any) => log?.actor === user.name && ["APPROVE", "REJECT", "RETURN"].includes(log?.action))
      .map((log: any) => ({
        id: `${claim.convexId || String(claim._id)}:${log.timestamp}:${log.action}`,
        action: log.action,
        amount: claim.amount,
        date: log.timestamp || claim.date,
      }))
  );

  const approved = activity.filter((a) => a.action === "APPROVE").length;
  const rejected = activity.filter((a) => a.action === "REJECT").length;
  const totalProcessed = approved + rejected;

  return {
    user: {
      _id: user.convexId || String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    approved,
    rejected,
    pending: 0,
    totalProcessed,
    approvalRate: totalProcessed > 0 ? (approved / totalProcessed) * 100 : 0,
    monthlyBreakdown: [],
  };
}

export async function getUserDetailedClaimsPage(args: { userId: string; startDate?: string; endDate?: string; page: number; pageSize: number }) {
  const user = await UserModel.findOne({ $or: [{ convexId: args.userId }, { _id: args.userId }] }).lean();
  if (!user) return { items: [], total: 0, page: args.page, pageSize: args.pageSize };

  const claims = await ClaimModel.find({
    ...toDateRangeFilter(args.startDate, args.endDate),
    $or: [{ userId: args.userId }, { userId: user.convexId }, { userId: String(user._id) }].filter((entry) => entry.userId),
  })
    .sort({ date: -1 })
    .lean();

  const page = Math.max(1, args.page);
  const pageSize = Math.min(100, Math.max(1, args.pageSize));
  const start = (page - 1) * pageSize;

  return {
    items: claims.slice(start, start + pageSize).map((claim) => ({
      id: claim.convexId || String(claim._id),
      title: claim.projectTitle || claim.title || "",
      date: claim.date,
      amount: claim.amount,
      status: claim.status,
    })),
    total: claims.length,
    page,
    pageSize,
  };
}

export async function getUserDetailedActivityPage(args: { userId: string; startDate?: string; endDate?: string; page: number; pageSize: number }) {
  const user = await UserModel.findOne({ $or: [{ convexId: args.userId }, { _id: args.userId }] }).lean();
  if (!user) return { items: [], total: 0, page: args.page, pageSize: args.pageSize };

  const claims = await ClaimModel.find(toDateRangeFilter(args.startDate, args.endDate)).lean();
  const activities = claims
    .flatMap((claim) =>
      (claim.logs || [])
        .filter((log: any) => log?.actor === user.name && ["APPROVE", "REJECT", "RETURN"].includes(log?.action))
        .map((log: any) => ({
          id: `${claim.convexId || String(claim._id)}:${log.timestamp}:${log.action}`,
          title: claim.projectTitle || claim.title || "",
          userName: claim.userName,
          amount: claim.amount,
          action: log.action,
          date: log.timestamp || claim.date,
        }))
    )
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const page = Math.max(1, args.page);
  const pageSize = Math.min(100, Math.max(1, args.pageSize));
  const start = (page - 1) * pageSize;

  return {
    items: activities.slice(start, start + pageSize),
    total: activities.length,
    page,
    pageSize,
  };
}
