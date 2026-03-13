import type { FilterQuery } from "mongoose";
import { Types } from "mongoose";
import { ClaimModel } from "../models/claim.js";
import { ClaimCycleModel } from "../models/claimCycle.js";
import { env } from "../config/env.js";
import type { UserSnapshot } from "../contracts/domain.js";

type EmployeeBucket = "pending" | "action_required" | "accepted" | "rejected";
type AdminBucket = "pending" | "accepted" | "rejected" | "payments";
type AdminRole = "L1_ADMIN" | "L2_ADMIN" | "L3_ADMIN" | "L4_ADMIN";

type ClaimLike = {
  _id: unknown;
  convexId?: string;
  userId: string;
  userName: string;
  projectTitle?: string;
  title?: string;
  category?: string;
  purpose?: string;
  companyVertical?: string;
  vendorName?: string;
  vendorPhone?: string;
  vendorPan?: string;
  vendorAddress?: string;
  billingAddress?: string;
  shippingAddress?: string;
  vendorGstin?: string;
  costType?: string;
  paymentMode?: string;
  bankAccountHolderName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankBranch?: string;
  bankIfscCode?: string;
  attachmentStorageId?: string;
  attachmentR2Key?: string;
  attachmentFileName?: string;
  proofDocuments?: Array<{
    fileName: string;
    uploadedAt?: string;
    storageId?: string;
    r2Key?: string;
    url?: string;
  }>;
  amount: number;
  totalRequestedAmount?: number;
  totalDisbursedAmount?: number;
  pendingAmount?: number;
  currentCycleNumber?: number;
  currentCycleRequestedAmount?: number;
  description?: string;
  date: string;
  status: string;
  employeeBucket?: string;
  employeeReceivedAt?: string;
  disbursedAt?: string;
  proofSubmittedAt?: string;
  isClosedByL4?: boolean;
  closedAt?: string;
  createdAtText?: string;
  createdAt?: Date;
  updatedAt?: Date;
  l1ApproverId?: string;
  l2ApproverId?: string;
  l4ApproverId?: string;
  l1ReviewOutcome?: string;
  l2ReviewOutcome?: string;
  logs?: Array<{
    stage?: string;
    action?: string;
    timestamp?: string;
    actor?: string;
    remarks?: string;
  }>;
};

type ClaimCycleLike = {
  _id: unknown;
  convexId?: string;
  claimId: string;
  cycleNumber: number;
  openingPendingAmount: number;
  requestedAmount: number;
  approvedAmount?: number;
  disbursedAmount?: number;
  closingPendingAmount?: number;
  status: string;
  createdAtText?: string;
  updatedAtText?: string;
  disbursedAt?: string;
  closedAt?: string;
};

function toId(claim: ClaimLike): string {
  return claim.convexId || String(claim._id);
}

function deriveFinancials(claim: ClaimLike) {
  const requested = claim.totalRequestedAmount ?? claim.amount ?? 0;
  const disbursed = claim.totalDisbursedAmount ?? 0;
  const pending = Math.max(0, claim.pendingAmount ?? requested - disbursed);
  return { requested, disbursed, pending };
}

function getR2PublicUrl(fileKey: string): string | null {
  if (env.R2_PUBLIC_URL) {
    return `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${fileKey}`;
  }
  if (!env.R2_ACCOUNT_ID || !env.R2_BUCKET_NAME) return null;
  return `https://${env.R2_BUCKET_NAME}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${fileKey}`;
}

function toCycleId(cycle: ClaimCycleLike): string {
  return cycle.convexId || String(cycle._id);
}

function parseTimestampMs(timestamp?: string): number | null {
  if (!timestamp) return null;
  const ms = new Date(timestamp).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function diffHours(start?: string, end?: string): number | null {
  const startMs = parseTimestampMs(start);
  const endMs = parseTimestampMs(end);
  if (startMs === null || endMs === null || endMs < startMs) return null;
  return Math.round(((endMs - startMs) / (1000 * 60 * 60)) * 100) / 100;
}

function maskPan(value?: string): string | null {
  if (!value) return null;
  const compact = value.trim();
  if (compact.length < 10) return compact;
  return `${compact.slice(0, 2)}******${compact.slice(-2)}`;
}

function maskGstin(value?: string): string | null {
  if (!value) return null;
  const compact = value.trim();
  if (compact.length < 15) return compact;
  return `${compact.slice(0, 2)}***********${compact.slice(-2)}`;
}

function deriveClaimAuditMeta(claim: ClaimLike) {
  const logs = claim.logs || [];
  const submittedAt = logs.find((log) => log.action === "SUBMIT")?.timestamp || claim.createdAtText;
  const l1ApprovedAt = logs.find((log) => log.action === "APPROVE" && log.stage === "L1 - Admin")?.timestamp;
  const l2ApprovedAt = logs.find((log) => log.action === "APPROVE" && log.stage === "L2 - General Manager")?.timestamp;
  const l3ApprovedAt = logs.find((log) => log.action === "APPROVE" && log.stage === "L3 - CEO")?.timestamp;
  const l4ActionLog = logs.find((log) => log.action === "APPROVE" && (log.stage || "").startsWith("L4 -"));
  const l4ActionAt = l4ActionLog?.timestamp;
  const closureLog = logs.find((log) => log.stage === "L4 - Finance Closure" && log.action === "APPROVE");
  const paymentRefMatch = closureLog?.remarks?.match(/Payment Ref:\s*([^.]+)/i);

  const l2Start = l1ApprovedAt || submittedAt;
  const l3Start = l2ApprovedAt || l2Start;
  const l4Start = l3ApprovedAt || l3Start;

  return {
    paymentReference: paymentRefMatch?.[1]?.trim() || null,
    closedBy: closureLog?.actor || null,
    returnCount: logs.filter((log) => log.action === "RETURN").length,
    approvalTimestamps: {
      l1ApprovedAt: l1ApprovedAt || null,
      l2ApprovedAt: l2ApprovedAt || null,
      l3ApprovedAt: l3ApprovedAt || null,
      l4ActionAt: l4ActionAt || null,
    },
    delayHoursByLevel: {
      l1: diffHours(submittedAt, l1ApprovedAt),
      l2: diffHours(l2Start, l2ApprovedAt),
      l3: diffHours(l3Start, l3ApprovedAt),
      l4: diffHours(l4Start, l4ActionAt),
    },
    agingHours: diffHours(submittedAt, claim.disbursedAt),
    maskedVendorPan: maskPan(claim.vendorPan),
    maskedVendorGstin: maskGstin(claim.vendorGstin),
  };
}

function isEmployeeActionRequired(claim: ClaimLike): boolean {
  const { pending } = deriveFinancials(claim);
  if (claim.status === "DISBURSED" && !claim.employeeReceivedAt) return true;
  if (claim.status === "DISBURSED" && claim.employeeReceivedAt && !claim.proofSubmittedAt) return true;
  if (claim.status === "PARTIALLY_DISBURSED" && pending > 0) return true;
  return false;
}

function isEmployeeAccepted(claim: ClaimLike): boolean {
  if (claim.status === "COMPLETED") return true;
  if (claim.status === "DISBURSED" && claim.employeeReceivedAt && claim.proofSubmittedAt) return true;
  return false;
}

export function deriveEmployeeBucket(claim: ClaimLike): EmployeeBucket {
  if (claim.employeeBucket === "pending" || claim.employeeBucket === "action_required" || claim.employeeBucket === "accepted" || claim.employeeBucket === "rejected") {
    return claim.employeeBucket;
  }

  if (claim.status === "REJECTED") return "rejected";
  if (isEmployeeActionRequired(claim)) return "action_required";
  if (isEmployeeAccepted(claim)) return "accepted";
  return "pending";
}

function shouldIncludeForRole(claim: ClaimLike, role: AdminRole, user: UserSnapshot, bucket: AdminBucket): boolean {
  const userIds = new Set<string>([String(user.id)]);
  if (user.legacyId) userIds.add(String(user.legacyId));
  const matchesApprover = (approverId?: string) =>
    !approverId || userIds.has(String(approverId));

  if (bucket === "payments") {
    return role === "L4_ADMIN" && ["PARTIALLY_DISBURSED", "DISBURSED", "COMPLETED"].includes(claim.status);
  }

  if (bucket === "rejected") {
    if (role === "L1_ADMIN") return claim.status === "REJECTED" && matchesApprover(claim.l1ApproverId);
    if (role === "L2_ADMIN") return claim.status === "REJECTED" && matchesApprover(claim.l2ApproverId);
    return claim.status === "REJECTED";
  }

  if (role === "L1_ADMIN") {
    if (bucket === "pending") {
      return ["SUBMITTED", "RETURNED_TO_L1"].includes(claim.status)
        && matchesApprover(claim.l1ApproverId);
    }
    if (bucket === "accepted") {
      return (
        matchesApprover(claim.l1ApproverId) &&
        claim.l1ReviewOutcome === "APPROVE" &&
        !["SUBMITTED", "RETURNED_TO_L1"].includes(claim.status)
      );
    }
    return false;
  }

  if (role === "L2_ADMIN") {
    if (bucket === "pending") {
      const standard = ["APPROVED_L1", "RETURNED_TO_L2"].includes(claim.status)
        && matchesApprover(claim.l2ApproverId);
      const emergency = claim.status === "SUBMITTED"
        && (claim.category === "EMERGENCY" || claim.category === "ULTRA_EMERGENCY");
      return standard || emergency;
    }
    if (bucket === "accepted") {
      return (
        matchesApprover(claim.l2ApproverId) &&
        claim.l2ReviewOutcome === "APPROVE" &&
        !["APPROVED_L1", "RETURNED_TO_L2"].includes(claim.status)
      );
    }
    return false;
  }

  if (role === "L3_ADMIN") {
    if (bucket === "pending") {
      return ["APPROVED_L2", "RETURNED_TO_L3"].includes(claim.status);
    }
    if (bucket === "accepted") {
      return ["APPROVED_L3", "PARTIALLY_DISBURSED", "DISBURSED", "COMPLETED"].includes(claim.status);
    }
    return false;
  }

  // L4
  if (bucket === "pending") {
    const awaitingPayment = claim.status === "APPROVED_L3";
    const pendingClosure = claim.status === "DISBURSED" && Boolean(claim.proofSubmittedAt) && !claim.isClosedByL4;
    return awaitingPayment || pendingClosure;
  }
  if (bucket === "accepted") {
    return ["PARTIALLY_DISBURSED", "DISBURSED", "COMPLETED"].includes(claim.status);
  }
  return false;
}

function matchesSearch(claim: ClaimLike, rawSearchQuery?: string): boolean {
  const search = rawSearchQuery?.trim().toLowerCase();
  if (!search) return true;
  const haystacks = [claim.userName, claim.projectTitle, claim.vendorName, claim.companyVertical];
  return haystacks.some((v) => typeof v === "string" && v.toLowerCase().includes(search));
}

function toEmployeeListItem(claim: ClaimLike) {
  const { requested, disbursed, pending } = deriveFinancials(claim);
  return {
    _id: toId(claim),
    _creationTime: claim.createdAt ? claim.createdAt.getTime() : Date.now(),
    userId: claim.userId,
    userName: claim.userName,
    projectTitle: claim.projectTitle,
    title: claim.title,
    category: claim.category,
    purpose: claim.purpose,
    companyVertical: claim.companyVertical,
    vendorName: claim.vendorName,
    vendorPhone: claim.vendorPhone,
    vendorPan: claim.vendorPan,
    vendorAddress: claim.vendorAddress,
    billingAddress: claim.billingAddress,
    shippingAddress: claim.shippingAddress,
    vendorGstin: claim.vendorGstin,
    costType: claim.costType,
    paymentMode: claim.paymentMode,
    bankAccountHolderName: claim.bankAccountHolderName,
    bankAccountNumber: claim.bankAccountNumber,
    bankName: claim.bankName,
    bankBranch: claim.bankBranch,
    bankIfscCode: claim.bankIfscCode,
    attachmentStorageId: claim.attachmentStorageId,
    attachmentR2Key: claim.attachmentR2Key,
    attachmentFileName: claim.attachmentFileName,
    amount: claim.amount,
    totalRequestedAmount: requested,
    totalDisbursedAmount: disbursed,
    pendingAmount: pending,
    currentCycleNumber: claim.currentCycleNumber,
    currentCycleRequestedAmount: claim.currentCycleRequestedAmount,
    description: claim.description,
    date: claim.date,
    status: claim.status,
    employeeReceivedAt: claim.employeeReceivedAt,
    disbursedAt: claim.disbursedAt,
    proofSubmittedAt: claim.proofSubmittedAt,
    createdAt: claim.createdAtText || claim.createdAt?.toISOString(),
  };
}

function toAdminListItem(claim: ClaimLike, bucket: AdminBucket) {
  const { requested, disbursed, pending } = deriveFinancials(claim);
  return {
    ...toEmployeeListItem(claim),
    isDelayed: false,
    delayedByHours: 0,
    delayedAtRole: null,
    workflowBucket: bucket,
    totalRequestedAmount: requested,
    totalDisbursedAmount: disbursed,
    pendingAmount: pending,
  };
}

export async function getEmployeeDashboardSummary(user: UserSnapshot) {
  const claims = (await ClaimModel.find({ userId: user.id }).sort({ createdAt: -1 }).lean()) as ClaimLike[];
  const summary = {
    pending: 0,
    actionRequired: 0,
    accepted: 0,
    rejected: 0,
  };

  for (const claim of claims) {
    const bucket = deriveEmployeeBucket(claim);
    if (bucket === "pending") summary.pending += 1;
    if (bucket === "action_required") summary.actionRequired += 1;
    if (bucket === "accepted") summary.accepted += 1;
    if (bucket === "rejected") summary.rejected += 1;
  }

  return summary;
}

export async function getEmployeeClaimsPage(user: UserSnapshot, params: { bucket: EmployeeBucket; page: number; pageSize: number }) {
  const claims = (await ClaimModel.find({ userId: user.id }).sort({ createdAt: -1 }).lean()) as ClaimLike[];
  const filtered = claims.filter((claim) => deriveEmployeeBucket(claim) === params.bucket);
  const start = (params.page - 1) * params.pageSize;
  const pageClaims = filtered.slice(start, start + params.pageSize);

  const cycleLookups = pageClaims.map((claim) => ({
    claimRefs: [toId(claim), String(claim._id)],
    cycleNumber: claim.currentCycleNumber ?? 1,
  }));
  const cycleFilters = cycleLookups.flatMap((lookup) =>
    lookup.claimRefs.map((claimRef) => ({
      claimId: claimRef,
      cycleNumber: lookup.cycleNumber,
    }))
  );
  const cycles = cycleFilters.length
    ? ((await ClaimCycleModel.find({ $or: cycleFilters }).lean()) as ClaimCycleLike[])
    : [];
  const requestedByClaimRef = new Map<string, number>();
  for (const cycle of cycles) {
    if (requestedByClaimRef.has(cycle.claimId)) continue;
    requestedByClaimRef.set(cycle.claimId, cycle.requestedAmount);
  }

  return {
    items: pageClaims.map((claim) => {
      const requestedAmount =
        requestedByClaimRef.get(toId(claim)) ??
        requestedByClaimRef.get(String(claim._id)) ??
        undefined;
      return toEmployeeListItem({
        ...claim,
        currentCycleRequestedAmount: requestedAmount,
      });
    }),
    total: filtered.length,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export async function getAdminDashboardSummary(user: UserSnapshot) {
  const role = user.role as AdminRole;
  const claims = (await ClaimModel.find({}).sort({ createdAt: -1 }).lean()) as ClaimLike[];

  let pending = 0;
  let accepted = 0;
  let rejected = 0;

  for (const claim of claims) {
    if (shouldIncludeForRole(claim, role, user, "pending")) pending += 1;
    if (shouldIncludeForRole(claim, role, user, "accepted")) accepted += 1;
    if (shouldIncludeForRole(claim, role, user, "rejected")) rejected += 1;
  }

  return { pending, accepted, rejected };
}

export async function getAdminClaimsPage(
  user: UserSnapshot,
  params: {
    bucket: AdminBucket;
    searchQuery?: string;
    page: number;
    pageSize: number;
    paymentStartDate?: string;
    paymentEndDate?: string;
    paymentModeFilter?: "CASH" | "ACCOUNT_TRANSFER";
  }
) {
  const role = user.role as AdminRole;
  const filter: FilterQuery<ClaimLike> = {};

  if (params.bucket === "payments") {
    filter.status = { $in: ["PARTIALLY_DISBURSED", "DISBURSED", "COMPLETED"] };
    if (params.paymentModeFilter) {
      filter.paymentMode = params.paymentModeFilter;
    }
    if (params.paymentStartDate || params.paymentEndDate) {
      filter.date = {
        ...(params.paymentStartDate ? { $gte: params.paymentStartDate } : {}),
        ...(params.paymentEndDate ? { $lte: params.paymentEndDate } : {}),
      };
    }
  }

  const claims = (await ClaimModel.find(filter).sort({ createdAt: -1 }).lean()) as ClaimLike[];
  const filtered = claims.filter(
    (claim) => shouldIncludeForRole(claim, role, user, params.bucket) && matchesSearch(claim, params.searchQuery)
  );

  const start = (params.page - 1) * params.pageSize;
  const items = filtered.slice(start, start + params.pageSize).map((claim) => toAdminListItem(claim, params.bucket));

  const totalPaid = filtered.reduce((sum, claim) => sum + deriveFinancials(claim).disbursed, 0);
  const paymentModeTotals = filtered.reduce(
    (acc, claim) => {
      const disbursed = deriveFinancials(claim).disbursed;
      if (claim.paymentMode === "CASH") {
        acc.cashCount += 1;
        acc.cashAmount += disbursed;
      }
      if (claim.paymentMode === "ACCOUNT_TRANSFER") {
        acc.accountTransferCount += 1;
        acc.accountTransferAmount += disbursed;
      }
      return acc;
    },
    {
      cashAmount: 0,
      cashCount: 0,
      accountTransferAmount: 0,
      accountTransferCount: 0,
    }
  );

  return {
    items,
    total: filtered.length,
    page: params.page,
    pageSize: params.pageSize,
    totalPaid,
    paymentModeTotals,
  };
}

export async function getAdminPaymentsSummary(
  user: UserSnapshot,
  params: {
    paymentStartDate?: string;
    paymentEndDate?: string;
    paymentModeFilter?: "CASH" | "ACCOUNT_TRANSFER";
  }
) {
  const page = await getAdminClaimsPage(user, {
    bucket: "payments",
    page: 1,
    pageSize: 5000,
    paymentStartDate: params.paymentStartDate,
    paymentEndDate: params.paymentEndDate,
    paymentModeFilter: params.paymentModeFilter,
  });

  return {
    total: page.total,
    totalPaid: page.totalPaid,
    paymentModeTotals: page.paymentModeTotals,
  };
}

export async function getClaimCyclesForUser(user: UserSnapshot, claimId: string) {
  const lookupConditions: Array<Record<string, unknown>> = [{ convexId: claimId }];
  if (Types.ObjectId.isValid(claimId)) {
    lookupConditions.push({ _id: claimId });
  }
  const claim = (await ClaimModel.findOne({ $or: lookupConditions }).lean()) as ClaimLike | null;
  if (!claim) return [];
  if (user.role === "USER" && claim.userId !== user.id) {
    return [];
  }

  const cycleLookupIds = new Set<string>([claimId, toId(claim), String(claim._id)]);

  const cycles = (await ClaimCycleModel.find({ claimId: { $in: Array.from(cycleLookupIds) } })
    .sort({ cycleNumber: 1 })
    .lean()) as ClaimCycleLike[];

  if (cycles.length === 0) {
    const financial = deriveFinancials(claim);
    const requestedInCycle = (financial.pending || financial.requested);
    return [
      {
        _id: `synthetic:${toId(claim)}:1`,
        claimId: toId(claim),
        cycleNumber: claim.currentCycleNumber ?? 1,
        openingPendingAmount: financial.requested,
        requestedAmount: requestedInCycle,
        approvedAmount: requestedInCycle,
        disbursedAmount: financial.disbursed,
        closingPendingAmount: financial.pending,
        status: claim.status === "COMPLETED" ? "COMPLETED" : financial.pending > 0 ? "DISBURSED" : "COMPLETED",
        createdAt: claim.createdAtText || claim.createdAt?.toISOString(),
        updatedAt: claim.updatedAt?.toISOString(),
        disbursedAt: claim.disbursedAt,
        closedAt: claim.closedAt,
      },
    ];
  }

  return cycles.map((cycle) => ({
    _id: toCycleId(cycle),
    claimId: cycle.claimId,
    cycleNumber: cycle.cycleNumber,
    openingPendingAmount: cycle.openingPendingAmount,
    requestedAmount: cycle.requestedAmount,
    approvedAmount: cycle.approvedAmount,
    disbursedAmount: cycle.disbursedAmount,
    closingPendingAmount: cycle.closingPendingAmount,
    status: cycle.status,
    createdAt: cycle.createdAtText,
    updatedAt: cycle.updatedAtText,
    disbursedAt: cycle.disbursedAt,
    closedAt: cycle.closedAt,
  }));
}

export async function getClaimAssetUrlsForUser(user: UserSnapshot, claimId: string) {
  const claim = await getClaimByIdForUser(user, claimId);
  if (!claim) return null;

  const lookupConditions: Array<Record<string, unknown>> = [{ convexId: claimId }];
  if (Types.ObjectId.isValid(claimId)) {
    lookupConditions.push({ _id: claimId });
  }
  const dbClaim = (await ClaimModel.findOne({ $or: lookupConditions }).lean()) as ClaimLike | null;
  if (!dbClaim) return null;

  const quotationUrl = dbClaim.attachmentR2Key ? getR2PublicUrl(dbClaim.attachmentR2Key) : null;
  const proofWithUrls = (dbClaim.proofDocuments || []).map((doc) => ({
    fileName: doc.fileName,
    uploadedAt: doc.uploadedAt,
    url: doc.url || (doc.r2Key ? getR2PublicUrl(doc.r2Key) : null),
  }));

  return {
    quotation: quotationUrl
      ? { fileName: dbClaim.attachmentFileName || "Quotation", url: quotationUrl }
      : null,
    proofs: proofWithUrls,
  };
}

export async function getFinanceExportDataForUser(
  user: UserSnapshot,
  params: {
    paymentStartDate?: string;
    paymentEndDate?: string;
    paymentModeFilter?: "CASH" | "ACCOUNT_TRANSFER";
  }
) {
  if (!["L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN"].includes(user.role)) {
    return { items: [] };
  }

  const claimsPage = await getAdminClaimsPage(user, {
    bucket: "payments",
    page: 1,
    pageSize: 5000,
    paymentStartDate: params.paymentStartDate,
    paymentEndDate: params.paymentEndDate,
    paymentModeFilter: params.paymentModeFilter,
  });

  const claimIds = claimsPage.items.map((item) => String(item._id));
  const claims = (await ClaimModel.find({
    $or: [
      { convexId: { $in: claimIds } },
      { _id: { $in: claimIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id)) } },
    ],
  }).lean()) as ClaimLike[];
  const claimById = new Map(claims.map((claim) => [toId(claim), claim]));

  const cycles = (await ClaimCycleModel.find({ claimId: { $in: claimIds } }).sort({ cycleNumber: 1 }).lean()) as ClaimCycleLike[];
  const cyclesByClaimId = new Map<string, ClaimCycleLike[]>();
  for (const cycle of cycles) {
    const list = cyclesByClaimId.get(cycle.claimId) || [];
    list.push(cycle);
    cyclesByClaimId.set(cycle.claimId, list);
  }

  const items = claimIds
    .map((claimId) => {
      const claim = claimById.get(claimId);
      if (!claim) return null;
      const claimCycles = cyclesByClaimId.get(claimId) || [];
      const financial = deriveFinancials(claim);
      const auditMeta = deriveClaimAuditMeta(claim);
      const paymentHistory = claimCycles
        .filter((cycle) => (cycle.disbursedAmount || 0) > 0)
        .map((cycle) => ({
          cycleNumber: cycle.cycleNumber,
          disbursedAmount: cycle.disbursedAmount || 0,
          disbursedAt: cycle.disbursedAt,
          closingPendingAmount: cycle.closingPendingAmount,
          status: cycle.status,
        }));
      const quotationUrl = claim.attachmentR2Key ? getR2PublicUrl(claim.attachmentR2Key) : null;
      const proofs = (claim.proofDocuments || []).map((doc) => ({
        fileName: doc.fileName,
        uploadedAt: doc.uploadedAt,
        url: doc.url || (doc.r2Key ? getR2PublicUrl(doc.r2Key) : null),
      }));

      return {
        _id: toId(claim),
        userName: claim.userName,
        projectTitle: claim.projectTitle,
        category: claim.category,
        companyVertical: claim.companyVertical,
        costType: claim.costType,
        paymentMode: claim.paymentMode,
        amount: claim.amount,
        totalRequestedAmount: financial.requested,
        totalDisbursedAmount: financial.disbursed,
        pendingAmount: financial.pending,
        date: claim.date,
        status: claim.status,
        employeeReceivedAt: claim.employeeReceivedAt,
        disbursedAt: claim.disbursedAt,
        proofSubmittedAt: claim.proofSubmittedAt,
        closedAt: claim.closedAt,
        paymentHistory,
        paymentReference: auditMeta.paymentReference,
        approvalTimestamps: auditMeta.approvalTimestamps,
        delayHoursByLevel: auditMeta.delayHoursByLevel,
        agingHours: auditMeta.agingHours,
        budgetHead: claim.costType || null,
        costCenter: claim.companyVertical || null,
        vendorPan: auditMeta.maskedVendorPan,
        vendorGstin: auditMeta.maskedVendorGstin,
        closedBy: auditMeta.closedBy,
        returnCount: auditMeta.returnCount,
        assets: {
          quotation: quotationUrl ? { fileName: claim.attachmentFileName || "Quotation", url: quotationUrl } : null,
          proofs,
        },
      };
    })
    .filter(Boolean);

  return { items };
}

export async function getClaimByIdForUser(user: UserSnapshot, claimId: string) {
  const lookupConditions: Array<Record<string, unknown>> = [{ convexId: claimId }];
  if (Types.ObjectId.isValid(claimId)) {
    lookupConditions.push({ _id: claimId });
  }

  const claim = (await ClaimModel.findOne({
    $or: lookupConditions,
  }).lean()) as ClaimLike | null;

  if (!claim) return null;

  if (user.role === "USER" && claim.userId !== user.id) {
    return null;
  }

  const claimRef = toId(claim);
  const activeCycle = (await ClaimCycleModel.findOne({
    claimId: { $in: [claimRef, String(claim._id)] },
    cycleNumber: claim.currentCycleNumber ?? 1,
  }).lean()) as ClaimCycleLike | null;

  return {
    ...toEmployeeListItem(claim),
    logs: claim.logs || [],
    proofDocuments: claim.proofDocuments || [],
    isClosedByL4: claim.isClosedByL4,
    closedAt: claim.closedAt,
    currentCycleRequestedAmount: activeCycle?.requestedAmount ?? (deriveFinancials(claim).pending || deriveFinancials(claim).requested),
  };
}
