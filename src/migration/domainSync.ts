import mongoose from "mongoose";
import {
  AnalyticsAdminDailySummaryModel,
  AnalyticsDailySummaryModel,
  AnalyticsUserDailySummaryModel,
} from "../models/analytics.js";
import { ClaimCycleModel } from "../models/claimCycle.js";
import { ClaimModel } from "../models/claim.js";
import { SyncCursorModel } from "../models/migrationControl.js";
import { PushSubscriptionModel } from "../models/pushSubscription.js";
import { RoleAuditLogModel } from "../models/roleAuditLog.js";
import { UserModel } from "../models/user.js";
import { asNumber, asString, asStringArray, type Domain } from "./common.js";

function pickId(record: Record<string, unknown>) {
  return asString(record.convexId) || asString(record._id) || asString(record.id);
}

function asObjectArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
}

export async function upsertDomainRecord(domain: Domain, record: Record<string, unknown>) {
  const convexId = pickId(record);
  if (!convexId) return { skipped: true, reason: "missing_id" as const };

  if (domain === "users") {
    await UserModel.updateOne(
      { convexId },
      {
        $set: {
          convexId,
          name: asString(record.name) || "Unknown",
          email: asString(record.email) || `${convexId}@unknown.local`,
          role: asString(record.role) || "USER",
          status: asString(record.status) || "active",
          verticals: asStringArray(record.verticals),
          assignedBy: asString(record.assignedBy),
          assignedAt: asNumber(record.assignedAt),
        },
      },
      { upsert: true }
    );
    return { skipped: false };
  }

  if (domain === "claims") {
    const userId = asString(record.userId);
    const userName = asString(record.userName);
    const amount = asNumber(record.amount);
    const date = asString(record.date);
    const status = asString(record.status);
    if (!userId || !userName || amount === undefined || !date || !status) {
      return { skipped: true, reason: "missing_required_fields" as const };
    }

    await ClaimModel.updateOne(
      { convexId },
      {
        $set: {
          convexId,
          userId,
          userName,
          category: asString(record.category),
          purpose: asString(record.purpose),
          companyVertical: asString(record.companyVertical),
          vendorName: asString(record.vendorName),
          vendorPhone: asString(record.vendorPhone),
          vendorPan: asString(record.vendorPan),
          vendorAddress: asString(record.vendorAddress),
          billingAddress: asString(record.billingAddress),
          shippingAddress: asString(record.shippingAddress),
          vendorGstin: asString(record.vendorGstin),
          costType: asString(record.costType),
          projectTitle: asString(record.projectTitle),
          title: asString(record.title),
          amount,
          totalRequestedAmount: asNumber(record.totalRequestedAmount),
          totalDisbursedAmount: asNumber(record.totalDisbursedAmount),
          pendingAmount: asNumber(record.pendingAmount),
          currentCycleNumber: asNumber(record.currentCycleNumber),
          status,
          date,
          l1ApproverId: asString(record.l1ApproverId),
          l2ApproverId: asString(record.l2ApproverId),
          l4ApproverId: asString(record.l4ApproverId),
          l1ReviewOutcome: asString(record.l1ReviewOutcome),
          l2ReviewOutcome: asString(record.l2ReviewOutcome),
          createdAtText: asString(record.createdAtText),
          description: asString(record.description),
          paymentMode: asString(record.paymentMode),
          attachmentStorageId: asString(record.attachmentStorageId),
          attachmentR2Key: asString(record.attachmentR2Key),
          attachmentFileName: asString(record.attachmentFileName),
          employeeBucket: asString(record.employeeBucket),
          employeeReceivedAt: asString(record.employeeReceivedAt),
          disbursedAt: asString(record.disbursedAt),
          proofSubmittedAt: asString(record.proofSubmittedAt),
          isClosedByL4: Boolean(record.isClosedByL4),
          closedAt: asString(record.closedAt),
          paidAmountForSummary: asNumber(record.paidAmountForSummary),
          isPaymentSummaryEligible: Boolean(record.isPaymentSummaryEligible),
          proofDocuments: asObjectArray(record.proofDocuments),
          logs: asObjectArray(record.logs),
        },
      },
      { upsert: true }
    );
    return { skipped: false };
  }

  if (domain === "roleAuditLog") {
    await RoleAuditLogModel.updateOne(
      { convexId },
      {
        $set: {
          convexId,
          userEmail: asString(record.userEmail),
          userName: asString(record.userName),
          previousRole: asString(record.previousRole),
          newRole: asString(record.newRole),
          changedBy: asString(record.changedBy),
          changedByEmail: asString(record.changedByEmail),
          reason: asString(record.reason),
          timestamp: asNumber(record.timestamp),
        },
      },
      { upsert: true }
    );
    return { skipped: false };
  }

  if (domain === "pushSubscriptions") {
    const endpoint = asString(record.endpoint);
    const userId = asString(record.userId);
    const p256dh = asString(record.p256dh);
    const auth = asString(record.auth);
    if (!endpoint || !userId || !p256dh || !auth) {
      return { skipped: true, reason: "missing_required_fields" as const };
    }

    await PushSubscriptionModel.updateOne(
      { endpoint },
      {
        $set: {
          convexId,
          userId,
          endpoint,
          p256dh,
          auth,
          userAgent: asString(record.userAgent),
          platform: asString(record.platform),
          status: asString(record.status) || "active",
          createdAtNumber: asNumber(record.createdAt),
          updatedAtNumber: asNumber(record.updatedAt),
          lastNotifiedAt: asNumber(record.lastNotifiedAt),
        },
      },
      { upsert: true }
    );
    return { skipped: false };
  }

  if (domain === "analyticsDailySummaries") {
    await AnalyticsDailySummaryModel.updateOne(
      { convexId },
      {
        $set: {
          convexId,
          key: asString(record.key),
          date: asString(record.date),
          companyVertical: asString(record.companyVertical),
          paymentMode: asString(record.paymentMode),
          costType: asString(record.costType),
          totalClaims: asNumber(record.totalClaims),
          totalAmount: asNumber(record.totalAmount),
          totalRequestedAmount: asNumber(record.totalRequestedAmount),
          pendingCount: asNumber(record.pendingCount),
          pendingAmount: asNumber(record.pendingAmount),
          approvedCount: asNumber(record.approvedCount),
          approvedAmount: asNumber(record.approvedAmount),
          rejectedCount: asNumber(record.rejectedCount),
          rejectedAmount: asNumber(record.rejectedAmount),
          awaitingPaymentCount: asNumber(record.awaitingPaymentCount),
          awaitingPaymentAmount: asNumber(record.awaitingPaymentAmount),
          paidCount: asNumber(record.paidCount),
          paidAmount: asNumber(record.paidAmount),
          advancePaidAmount: asNumber(record.advancePaidAmount),
          remainingBalancePendingAmount: asNumber(record.remainingBalancePendingAmount),
          statusCounts: record.statusCounts,
          statusAmounts: record.statusAmounts,
          updatedAtText: asString(record.updatedAt),
        },
      },
      { upsert: true }
    );
    return { skipped: false };
  }

  if (domain === "analyticsUserDailySummaries") {
    await AnalyticsUserDailySummaryModel.updateOne(
      { convexId },
      {
        $set: {
          convexId,
          key: asString(record.key),
          date: asString(record.date),
          userId: asString(record.userId),
          userName: asString(record.userName),
          totalClaims: asNumber(record.totalClaims),
          totalAmount: asNumber(record.totalAmount),
          totalRequestedAmount: asNumber(record.totalRequestedAmount),
          totalDisbursedAmount: asNumber(record.totalDisbursedAmount),
          approvedClaims: asNumber(record.approvedClaims),
          rejectedClaims: asNumber(record.rejectedClaims),
          pendingClaims: asNumber(record.pendingClaims),
          processedCount: asNumber(record.processedCount),
          updatedAtText: asString(record.updatedAt),
        },
      },
      { upsert: true }
    );
    return { skipped: false };
  }

  if (domain === "analyticsAdminDailySummaries") {
    await AnalyticsAdminDailySummaryModel.updateOne(
      { convexId },
      {
        $set: {
          convexId,
          key: asString(record.key),
          date: asString(record.date),
          adminUserId: asString(record.adminUserId),
          adminName: asString(record.adminName),
          role: asString(record.role),
          approvedCount: asNumber(record.approvedCount),
          rejectedCount: asNumber(record.rejectedCount),
          processedCount: asNumber(record.processedCount),
          updatedAtText: asString(record.updatedAt),
        },
      },
      { upsert: true }
    );
    return { skipped: false };
  }

  if (
    domain === "adminDashboardCounters" ||
    domain === "employeeDashboardCounters" ||
    domain === "paymentDashboardCounters"
  ) {
    const db = mongoose.connection.db;
    if (!db) return { skipped: true, reason: "db_not_connected" as const };
    await db.collection(domain).updateOne({ _id: convexId as any }, { $set: { _id: convexId, ...record } }, { upsert: true });
    return { skipped: false };
  }

  const claimId = asString(record.claimId);
  const cycleNumber = asNumber(record.cycleNumber);
  const openingPendingAmount = asNumber(record.openingPendingAmount);
  const requestedAmount = asNumber(record.requestedAmount);
  const status = asString(record.status);
  if (!claimId || cycleNumber === undefined || openingPendingAmount === undefined || requestedAmount === undefined || !status) {
    return { skipped: true, reason: "missing_required_fields" as const };
  }

  await ClaimCycleModel.updateOne(
    { claimId, cycleNumber },
    {
      $set: {
        convexId,
        claimId,
        cycleNumber,
        openingPendingAmount,
        requestedAmount,
        approvedAmount: asNumber(record.approvedAmount),
        disbursedAmount: asNumber(record.disbursedAmount),
        closingPendingAmount: asNumber(record.closingPendingAmount),
        status,
        createdAtText: asString(record.createdAtText),
        updatedAtText: asString(record.updatedAtText),
        disbursedAt: asString(record.disbursedAt),
        closedAt: asString(record.closedAt),
      },
    },
    { upsert: true }
  );
  return { skipped: false };
}

export async function deleteDomainRecord(domain: Domain, id: string) {
  if (domain === "users") {
    await UserModel.deleteOne({ convexId: id });
    return;
  }
  if (domain === "claims") {
    await ClaimModel.deleteOne({ convexId: id });
    return;
  }
  if (domain === "roleAuditLog") {
    await RoleAuditLogModel.deleteOne({ convexId: id });
    return;
  }
  if (domain === "pushSubscriptions") {
    await PushSubscriptionModel.deleteOne({ convexId: id });
    return;
  }
  if (domain === "analyticsDailySummaries") {
    await AnalyticsDailySummaryModel.deleteOne({ convexId: id });
    return;
  }
  if (domain === "analyticsUserDailySummaries") {
    await AnalyticsUserDailySummaryModel.deleteOne({ convexId: id });
    return;
  }
  if (domain === "analyticsAdminDailySummaries") {
    await AnalyticsAdminDailySummaryModel.deleteOne({ convexId: id });
    return;
  }
  if (
    domain === "adminDashboardCounters" ||
    domain === "employeeDashboardCounters" ||
    domain === "paymentDashboardCounters"
  ) {
    const db = mongoose.connection.db;
    if (!db) return;
    await db.collection(domain).deleteOne({ _id: id as any });
    return;
  }
  await ClaimCycleModel.deleteOne({ convexId: id });
}

export async function getCursor(domainCursor: string) {
  const cursor = await SyncCursorModel.findOne({ domain: domainCursor }).lean();
  return cursor?.lastCursor || "0";
}

export async function saveCursor(domainCursor: string, value: string) {
  await SyncCursorModel.updateOne(
    { domain: domainCursor },
    {
      $set: {
        domain: domainCursor,
        lastCursor: value,
        lastRunAt: new Date(),
        status: "idle",
        error: undefined,
      },
    },
    { upsert: true }
  );
}

export async function markCursorRunning(domainCursor: string) {
  await SyncCursorModel.updateOne(
    { domain: domainCursor },
    {
      $set: {
        domain: domainCursor,
        status: "running",
        lastRunAt: new Date(),
      },
    },
    { upsert: true }
  );
}

export async function markCursorFailed(domainCursor: string, error: unknown) {
  await SyncCursorModel.updateOne(
    { domain: domainCursor },
    {
      $set: {
        domain: domainCursor,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        lastRunAt: new Date(),
      },
    },
    { upsert: true }
  );
}
