import { ClaimModel } from "../models/claim.js";
import { ClaimCycleModel } from "../models/claimCycle.js";
import { UserModel } from "../models/user.js";
import { Types } from "mongoose";

export type MirrorCreateClaimPayload = {
  claimId: string;
  userId: string;
  userName: string;
  projectTitle: string;
  category: "WITHDRAWAL" | "EMERGENCY";
  companyVertical: string;
  purpose: string;
  vendorName: string;
  vendorPhone: string;
  vendorPan: string;
  vendorAddress: string;
  billingAddress: string;
  shippingAddress: string;
  vendorGstin: string;
  costType: "CAPEX" | "OPEX";
  paymentMode: "CASH" | "ACCOUNT_TRANSFER";
  bankAccountHolderName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankBranch?: string;
  bankIfscCode?: string;
  amount: number;
  paymentRequestType?: "FULL" | "ADVANCE";
  requestedCycleAmount?: number;
  description: string;
  date: string;
  attachmentStorageId?: string;
  attachmentR2Key?: string;
  attachmentFileName?: string;
};

export type MirrorReviewClaimPayload = {
  claimId: string;
  actorRole: "L1_ADMIN" | "L2_ADMIN" | "L3_ADMIN" | "L4_ADMIN";
  actorName: string;
  remarks: string;
  action: "approve" | "reject";
};

export type MirrorSendBackClaimPayload = {
  claimId: string;
  actorRole: "L1_ADMIN" | "L2_ADMIN" | "L3_ADMIN" | "L4_ADMIN";
  actorName: string;
  remarks: string;
  targetRole: "EMPLOYEE" | "L1_ADMIN" | "L2_ADMIN" | "L3_ADMIN";
};

export type MirrorDisburseClaimPayload = {
  claimId: string;
  actorRole: "L4_ADMIN";
  actorName: string;
  remarks: string;
  disbursementAmount: number;
};

export type MirrorCloseClaimPayload = {
  claimId: string;
  actorRole: "L4_ADMIN";
  actorName: string;
  paymentReference: string;
  closureRemarks: string;
  proofVerified: boolean;
  utilizationVerified: boolean;
};

export type MirrorMarkReceivedPayload = {
  claimId: string;
  actorName: string;
};

export type MirrorSubmitProofPayload = {
  claimId: string;
  actorName: string;
  remarks?: string;
  documents: Array<{
    storageId?: string;
    r2Key?: string;
    url?: string;
    fileName: string;
  }>;
};

export type MirrorNextCyclePayload = {
  claimId: string;
  actorName: string;
  requestedAmount: number;
  remarks?: string;
};

export type MirrorReplyPayload = {
  claimId: string;
  actorName: string;
  message: string;
  attachments?: Array<{
    storageId?: string;
    r2Key?: string;
    url?: string;
    fileName: string;
  }>;
};

export type MirrorResubmitPayload = {
  claimId: string;
  actorName: string;
  projectTitle: string;
  category: "WITHDRAWAL" | "EMERGENCY";
  companyVertical: string;
  purpose: string;
  vendorName: string;
  vendorPhone: string;
  vendorPan: string;
  vendorAddress: string;
  billingAddress: string;
  shippingAddress: string;
  vendorGstin: string;
  costType: "CAPEX" | "OPEX";
  paymentMode: "CASH" | "ACCOUNT_TRANSFER";
  bankAccountHolderName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankBranch?: string;
  bankIfscCode?: string;
  amount: number;
  paymentRequestType?: "FULL" | "ADVANCE";
  requestedCycleAmount?: number;
  description: string;
  date: string;
  attachmentStorageId?: string;
  attachmentR2Key?: string;
  attachmentFileName?: string;
};

export type MirrorSetDelayActionPlanPayload = {
  claimId: string;
  actorName: string;
  actorRole: "L1_ADMIN" | "L2_ADMIN";
  delayReason: string;
};

type ClaimStatus =
  | "SUBMITTED"
  | "APPROVED_L1"
  | "APPROVED_L2"
  | "APPROVED_L3"
  | "PARTIALLY_DISBURSED"
  | "RETURNED_TO_EMPLOYEE"
  | "RETURNED_TO_L1"
  | "RETURNED_TO_L2"
  | "RETURNED_TO_L3"
  | "DISBURSED"
  | "COMPLETED"
  | "REJECTED";

type ClaimCycleStatus = "UNDER_REVIEW" | "APPROVED" | "DISBURSED" | "COMPLETED" | "RETURNED" | "REJECTED";

const RESUBMIT_DIFF_FIELDS: Array<{ key: keyof MirrorResubmitPayload; label: string }> = [
  { key: "projectTitle", label: "Project Title" },
  { key: "category", label: "Category" },
  { key: "companyVertical", label: "Company Vertical" },
  { key: "purpose", label: "Purpose" },
  { key: "vendorName", label: "Vendor Name" },
  { key: "vendorPhone", label: "Vendor Phone" },
  { key: "vendorPan", label: "Vendor PAN" },
  { key: "vendorAddress", label: "Vendor Address" },
  { key: "billingAddress", label: "Billing Address" },
  { key: "shippingAddress", label: "Shipping Address" },
  { key: "vendorGstin", label: "Vendor GSTIN" },
  { key: "costType", label: "Payment Type" },
  { key: "paymentMode", label: "Payment Mode" },
  { key: "bankAccountHolderName", label: "Bank Account Holder" },
  { key: "bankAccountNumber", label: "Bank Account Number" },
  { key: "bankName", label: "Bank Name" },
  { key: "bankBranch", label: "Bank Branch" },
  { key: "bankIfscCode", label: "Bank IFSC" },
  { key: "amount", label: "Amount" },
  { key: "description", label: "Description" },
  { key: "date", label: "Date" },
];

function computeResubmitEditDiff(claim: any, payload: MirrorResubmitPayload) {
  const diffs: Array<{ field: string; oldValue: string; newValue: string }> = [];
  for (const { key, label } of RESUBMIT_DIFF_FIELDS) {
    const oldValue = String(claim[key] ?? "");
    const newValue = String(payload[key] ?? "");
    if (oldValue !== newValue) {
      diffs.push({ field: label, oldValue, newValue });
    }
  }
  return diffs;
}

function nowIso() {
  return new Date().toISOString();
}

async function findClaimByAnyId(claimId: string) {
  const or: Array<Record<string, unknown>> = [{ convexId: claimId }];
  if (Types.ObjectId.isValid(claimId)) {
    or.push({ _id: claimId });
  }
  return ClaimModel.findOne({ $or: or });
}

function getReturnStatusForTarget(targetRole: "EMPLOYEE" | "L1_ADMIN" | "L2_ADMIN" | "L3_ADMIN"): ClaimStatus {
  if (targetRole === "EMPLOYEE") return "RETURNED_TO_EMPLOYEE";
  if (targetRole === "L1_ADMIN") return "RETURNED_TO_L1";
  if (targetRole === "L2_ADMIN") return "RETURNED_TO_L2";
  return "RETURNED_TO_L3";
}

function getFinancials(claim: {
  amount: number;
  totalRequestedAmount?: number | null;
  totalDisbursedAmount?: number | null;
  pendingAmount?: number | null;
  currentCycleNumber?: number | null;
}) {
  const totalRequestedAmount = claim.totalRequestedAmount ?? claim.amount;
  const totalDisbursedAmount = claim.totalDisbursedAmount ?? 0;
  const pendingAmount = claim.pendingAmount ?? Math.max(0, totalRequestedAmount - totalDisbursedAmount);
  const currentCycleNumber = claim.currentCycleNumber ?? 1;
  return {
    totalRequestedAmount,
    totalDisbursedAmount,
    pendingAmount,
    currentCycleNumber,
  };
}

async function getOrCreateCurrentCycle(claim: {
  convexId?: string | null;
  _id: { toString(): string };
  amount: number;
  pendingAmount?: number | null;
  totalRequestedAmount?: number | null;
  currentCycleNumber?: number | null;
}) {
  const now = nowIso();
  const claimRef = claim.convexId || String(claim._id);
  const cycleNumber = claim.currentCycleNumber ?? 1;
  let cycle = await ClaimCycleModel.findOne({ claimId: claimRef, cycleNumber });
  if (cycle) return cycle;

  const financial = getFinancials(claim);
  await ClaimCycleModel.create({
    claimId: claimRef,
    cycleNumber,
    openingPendingAmount: financial.pendingAmount || financial.totalRequestedAmount || claim.amount,
    requestedAmount: financial.pendingAmount || financial.totalRequestedAmount || claim.amount,
    approvedAmount: 0,
    disbursedAmount: 0,
    closingPendingAmount: financial.pendingAmount,
    status: "UNDER_REVIEW",
    createdAtText: now,
    updatedAtText: now,
  });
  cycle = await ClaimCycleModel.findOne({ claimId: claimRef, cycleNumber });
  if (!cycle) {
    throw new Error("Unable to create or fetch current cycle");
  }
  return cycle;
}

function getNextStatus(
  currentStatus: ClaimStatus,
  category?: "WITHDRAWAL" | "EMERGENCY" | "ULTRA_EMERGENCY" | null
): ClaimStatus | null {
  if (currentStatus === "RETURNED_TO_L3") return "APPROVED_L3";
  if (currentStatus === "RETURNED_TO_L2") return "APPROVED_L2";
  if (currentStatus === "RETURNED_TO_L1") return "APPROVED_L1";

  if (currentStatus === "SUBMITTED" && (category === "EMERGENCY" || category === "ULTRA_EMERGENCY")) {
    return "APPROVED_L2";
  }

  const transitions: Partial<Record<ClaimStatus, ClaimStatus>> = {
    SUBMITTED: "APPROVED_L1",
    APPROVED_L1: "APPROVED_L2",
    APPROVED_L2: "APPROVED_L3",
    APPROVED_L3: "DISBURSED",
  };

  return transitions[currentStatus] || null;
}

export async function mirrorCreateClaim(payload: MirrorCreateClaimPayload) {
  const now = nowIso();
  const requestType = payload.paymentRequestType ?? "FULL";
  const requestedCycleAmount = requestType === "ADVANCE" ? (payload.requestedCycleAmount ?? 0) : payload.amount;
  if (!Number.isFinite(requestedCycleAmount) || requestedCycleAmount <= 0) {
    throw new Error("Requested cycle amount must be greater than zero");
  }
  if (requestedCycleAmount > payload.amount) {
    throw new Error("Requested cycle amount cannot exceed total requested amount");
  }
  const l1Admin = await UserModel.findOne({
    role: "L1_ADMIN",
    status: "active",
    verticals: payload.companyVertical,
  }).lean();
  const l2Admin = await UserModel.findOne({
    role: "L2_ADMIN",
    status: "active",
    verticals: payload.companyVertical,
  }).lean();

  await ClaimModel.updateOne(
    { convexId: payload.claimId },
    {
      $setOnInsert: {
        convexId: payload.claimId,
        userId: payload.userId,
        userName: payload.userName,
        projectTitle: payload.projectTitle,
        category: payload.category,
        companyVertical: payload.companyVertical,
        purpose: payload.purpose,
        vendorName: payload.vendorName,
        vendorPhone: payload.vendorPhone,
        vendorPan: payload.vendorPan,
        vendorAddress: payload.vendorAddress,
        billingAddress: payload.billingAddress,
        shippingAddress: payload.shippingAddress,
        vendorGstin: payload.vendorGstin,
        costType: payload.costType,
        paymentMode: payload.paymentMode,
        bankAccountHolderName: payload.bankAccountHolderName,
        bankAccountNumber: payload.bankAccountNumber,
        bankName: payload.bankName,
        bankBranch: payload.bankBranch,
        bankIfscCode: payload.bankIfscCode,
        amount: payload.amount,
        totalRequestedAmount: payload.amount,
        totalDisbursedAmount: 0,
        pendingAmount: payload.amount,
        currentCycleNumber: 1,
        l1ApproverId: l1Admin ? String(l1Admin._id) : undefined,
        l2ApproverId: l2Admin ? String(l2Admin._id) : undefined,
        status: "SUBMITTED",
        description: payload.description,
        date: payload.date,
        attachmentStorageId: payload.attachmentStorageId,
        attachmentR2Key: payload.attachmentR2Key,
        attachmentFileName: payload.attachmentFileName,
        createdAtText: now,
        logs: [
          {
            stage: "Submission",
            action: "SUBMIT",
            remarks: "Cash requisition submitted for review",
            timestamp: now,
            actor: payload.userName,
          },
        ],
      },
    },
    { upsert: true }
  );

  const claimRef = payload.claimId;
  await ClaimCycleModel.updateOne(
    { claimId: claimRef, cycleNumber: 1 },
    {
      $setOnInsert: {
        claimId: claimRef,
        cycleNumber: 1,
        createdAtText: now,
      },
      $set: {
        openingPendingAmount: payload.amount,
        requestedAmount: requestedCycleAmount,
        approvedAmount: 0,
        disbursedAmount: 0,
        closingPendingAmount: payload.amount,
        status: "UNDER_REVIEW",
        updatedAtText: now,
      },
    },
    { upsert: true }
  );
}

export async function mirrorReviewClaim(payload: MirrorReviewClaimPayload) {
  const claim = await findClaimByAnyId(payload.claimId);
  if (!claim) {
    throw new Error("Claim not found in Mongo for mirror review");
  }

  const now = nowIso();
  if (payload.action === "reject") {
    claim.status = "REJECTED";
    if (payload.actorRole === "L1_ADMIN") claim.l1ReviewOutcome = "REJECT";
    if (payload.actorRole === "L2_ADMIN") claim.l2ReviewOutcome = "REJECT";
    claim.logs = [
      ...(claim.logs || []),
      {
        stage: payload.actorRole,
        action: "REJECT",
        remarks: payload.remarks,
        timestamp: now,
        actor: payload.actorName,
      },
    ];
    await claim.save();
    return;
  }

  const nextStatus = getNextStatus(claim.status, claim.category);
  if (!nextStatus) {
    throw new Error(`Invalid approve transition from ${claim.status}`);
  }

  claim.status = nextStatus;
  if (payload.actorRole === "L1_ADMIN") claim.l1ReviewOutcome = "APPROVE";
  if (payload.actorRole === "L2_ADMIN") claim.l2ReviewOutcome = "APPROVE";
  if (nextStatus === "DISBURSED") {
    claim.disbursedAt = now;
    claim.totalDisbursedAmount = claim.totalRequestedAmount ?? claim.amount;
    claim.pendingAmount = 0;
  }
  claim.logs = [
    ...(claim.logs || []),
    {
      stage: payload.actorRole,
      action: "APPROVE",
      remarks: payload.remarks,
      timestamp: now,
      actor: payload.actorName,
    },
  ];

  await claim.save();
}

export async function mirrorSendBackClaim(payload: MirrorSendBackClaimPayload) {
  const claim = await findClaimByAnyId(payload.claimId);
  if (!claim) throw new Error("Claim not found in Mongo for mirror send-back");

  const now = nowIso();
  claim.status = getReturnStatusForTarget(payload.targetRole);
  claim.logs = [
    ...(claim.logs || []),
    {
      stage: payload.actorRole,
      action: "RETURN",
      remarks: payload.remarks,
      timestamp: now,
      actor: payload.actorName,
      target: payload.targetRole,
    },
  ];
  await claim.save();

  const cycle = await getOrCreateCurrentCycle(claim);
  cycle.status = "RETURNED" satisfies ClaimCycleStatus;
  cycle.closingPendingAmount = getFinancials(claim).pendingAmount;
  cycle.updatedAtText = now;
  await cycle.save();
}

export async function mirrorDisburseClaim(payload: MirrorDisburseClaimPayload) {
  const claim = await findClaimByAnyId(payload.claimId);
  if (!claim) throw new Error("Claim not found in Mongo for mirror disburse");

  const now = nowIso();
  const financial = getFinancials(claim);
  const nextTotalDisbursedAmount = financial.totalDisbursedAmount + payload.disbursementAmount;
  const nextPendingAmount = Math.max(0, financial.totalRequestedAmount - nextTotalDisbursedAmount);
  const isFullyDisbursed = nextPendingAmount === 0;

  claim.status = isFullyDisbursed ? "DISBURSED" : "PARTIALLY_DISBURSED";
  claim.disbursedAt = isFullyDisbursed ? now : claim.disbursedAt;
  claim.totalRequestedAmount = financial.totalRequestedAmount;
  claim.totalDisbursedAmount = nextTotalDisbursedAmount;
  claim.pendingAmount = nextPendingAmount;
  claim.isClosedByL4 = false;
  claim.closedAt = undefined;
  claim.logs = [
    ...(claim.logs || []),
    {
      stage: payload.actorRole,
      action: "APPROVE",
      remarks: payload.remarks,
      timestamp: now,
      actor: payload.actorName,
    },
  ];
  await claim.save();

  const cycle = await getOrCreateCurrentCycle(claim);
  cycle.disbursedAmount = (cycle.disbursedAmount || 0) + payload.disbursementAmount;
  cycle.closingPendingAmount = nextPendingAmount;
  cycle.status = (isFullyDisbursed ? "DISBURSED" : "COMPLETED") satisfies ClaimCycleStatus;
  cycle.disbursedAt = isFullyDisbursed ? now : cycle.disbursedAt;
  cycle.closedAt = isFullyDisbursed ? cycle.closedAt : now;
  cycle.updatedAtText = now;
  await cycle.save();
}

export async function mirrorCloseClaimByL4(payload: MirrorCloseClaimPayload) {
  const claim = await findClaimByAnyId(payload.claimId);
  if (!claim) throw new Error("Claim not found in Mongo for mirror close");

  const now = nowIso();
  claim.status = "COMPLETED";
  claim.isClosedByL4 = true;
  claim.closedAt = now;
  claim.logs = [
    ...(claim.logs || []),
    {
      stage: "L4 - Finance Closure",
      action: "APPROVE",
      remarks: `Claim closed by finance. Payment Ref: ${payload.paymentReference}. ${payload.closureRemarks}`,
      timestamp: now,
      actor: payload.actorName,
    },
  ];
  await claim.save();

  const cycle = await getOrCreateCurrentCycle(claim);
  cycle.status = "COMPLETED";
  cycle.closedAt = now;
  cycle.updatedAtText = now;
  await cycle.save();
}

export async function mirrorMarkClaimReceived(payload: MirrorMarkReceivedPayload) {
  const claim = await findClaimByAnyId(payload.claimId);
  if (!claim) throw new Error("Claim not found in Mongo for mirror mark received");

  const now = nowIso();
  claim.employeeReceivedAt = now;
  claim.logs = [
    ...(claim.logs || []),
    {
      stage: "Employee Confirmation",
      action: "MARK_RECEIVED",
      remarks: "Employee confirmed receipt of funds",
      timestamp: now,
      actor: payload.actorName,
    },
  ];
  await claim.save();
}

export async function mirrorSubmitProofDocuments(payload: MirrorSubmitProofPayload) {
  const claim = await findClaimByAnyId(payload.claimId);
  if (!claim) throw new Error("Claim not found in Mongo for mirror proof submission");

  const now = nowIso();
  const financial = getFinancials(claim);
  claim.proofDocuments = payload.documents.map((doc) => ({
    storageId: doc.storageId,
    r2Key: doc.r2Key,
    url: doc.url,
    fileName: doc.fileName,
    uploadedAt: now,
  }));
  claim.proofSubmittedAt = now;
  claim.status = "DISBURSED";
  claim.totalRequestedAmount = financial.totalRequestedAmount;
  claim.totalDisbursedAmount = financial.totalDisbursedAmount;
  claim.pendingAmount = Math.max(0, financial.pendingAmount);
  claim.isClosedByL4 = false;
  claim.closedAt = undefined;
  claim.logs = [
    ...(claim.logs || []),
    {
      stage: "Purchase Proof Submission",
      action: "SUBMIT_PROOF",
      remarks: payload.remarks || `Submitted ${payload.documents.length} proof document(s)`,
      timestamp: now,
      actor: payload.actorName,
    },
  ];
  await claim.save();

  const cycle = await getOrCreateCurrentCycle(claim);
  cycle.status = "DISBURSED";
  cycle.closingPendingAmount = Math.max(0, financial.pendingAmount);
  cycle.updatedAtText = now;
  await cycle.save();
}

export async function mirrorRequestNextCyclePayment(payload: MirrorNextCyclePayload) {
  const claim = await findClaimByAnyId(payload.claimId);
  if (!claim) throw new Error("Claim not found in Mongo for mirror next-cycle request");

  const now = nowIso();
  const financial = getFinancials(claim);
  const nextCycleNumber = financial.currentCycleNumber + 1;
  const claimRef = claim.convexId || String(claim._id);

  await ClaimCycleModel.updateOne(
    { claimId: claimRef, cycleNumber: nextCycleNumber },
    {
      $setOnInsert: {
        claimId: claimRef,
        cycleNumber: nextCycleNumber,
        openingPendingAmount: financial.pendingAmount,
        requestedAmount: payload.requestedAmount,
        approvedAmount: 0,
        disbursedAmount: 0,
        closingPendingAmount: financial.pendingAmount,
        status: "UNDER_REVIEW",
        createdAtText: now,
      },
      $set: {
        updatedAtText: now,
      },
    },
    { upsert: true }
  );

  claim.status = "SUBMITTED";
  claim.currentCycleNumber = nextCycleNumber;
  claim.l1ReviewOutcome = undefined;
  claim.l2ReviewOutcome = undefined;
  claim.logs = [
    ...(claim.logs || []),
    {
      stage: "Employee Next Cycle Request",
      action: "SUBMIT",
      remarks: payload.remarks || `Requested next cycle payment of ${payload.requestedAmount}`,
      timestamp: now,
      actor: payload.actorName,
    },
  ];
  await claim.save();
}

export async function mirrorReplyClaim(payload: MirrorReplyPayload) {
  const claim = await findClaimByAnyId(payload.claimId);
  if (!claim) throw new Error("Claim not found in Mongo for mirror reply");

  const now = nowIso();
  claim.status = "SUBMITTED";
  claim.l1ReviewOutcome = undefined;
  claim.l2ReviewOutcome = undefined;
  claim.logs = [
    ...(claim.logs || []),
    {
      stage: "Employee Reply",
      action: "REPLY",
      remarks: payload.message,
      timestamp: now,
      actor: payload.actorName,
      attachments: payload.attachments,
    },
  ];
  await claim.save();
}

export async function mirrorResubmitClaim(payload: MirrorResubmitPayload) {
  const claim = await findClaimByAnyId(payload.claimId);
  if (!claim) throw new Error("Claim not found in Mongo for mirror resubmit");

  const logs = claim.logs || [];
  const lastLog = logs[logs.length - 1];
  const isAlreadyResubmitted =
    claim.status === "SUBMITTED" &&
    lastLog?.stage === "Resubmission" &&
    lastLog?.action === "SUBMIT";

  // Idempotency guard: if the first resubmit already succeeded and client retried, keep it a no-op.
  if (isAlreadyResubmitted) {
    return;
  }

  if (claim.status !== "RETURNED_TO_EMPLOYEE") {
    throw new Error("Claim can only be resubmitted after it is returned to employee");
  }
  const editDiff = computeResubmitEditDiff(claim, payload);

  const now = nowIso();
  const requestType = payload.paymentRequestType ?? "FULL";
  const requestedCycleAmount = requestType === "ADVANCE" ? (payload.requestedCycleAmount ?? 0) : payload.amount;
  if (!Number.isFinite(requestedCycleAmount) || requestedCycleAmount <= 0) {
    throw new Error("Requested cycle amount must be greater than zero");
  }
  if (requestedCycleAmount > payload.amount) {
    throw new Error("Requested cycle amount cannot exceed total requested amount");
  }
  const l1Admin = await UserModel.findOne({
    role: "L1_ADMIN",
    status: "active",
    verticals: payload.companyVertical,
  }).lean();
  const l2Admin = await UserModel.findOne({
    role: "L2_ADMIN",
    status: "active",
    verticals: payload.companyVertical,
  }).lean();
  const nextTotalDisbursedAmount = Math.min(claim.totalDisbursedAmount ?? 0, payload.amount);
  const totalRequestedAmount = payload.amount;
  const nextPendingAmount = Math.max(0, totalRequestedAmount - nextTotalDisbursedAmount);
  const nextCycleNumber = claim.currentCycleNumber ?? 1;
  claim.projectTitle = payload.projectTitle;
  claim.category = payload.category;
  claim.companyVertical = payload.companyVertical;
  claim.purpose = payload.purpose;
  claim.vendorName = payload.vendorName;
  claim.vendorPhone = payload.vendorPhone;
  claim.vendorPan = payload.vendorPan;
  claim.vendorAddress = payload.vendorAddress;
  claim.billingAddress = payload.billingAddress;
  claim.shippingAddress = payload.shippingAddress;
  claim.vendorGstin = payload.vendorGstin;
  claim.costType = payload.costType;
  claim.paymentMode = payload.paymentMode;
  claim.bankAccountHolderName = payload.bankAccountHolderName;
  claim.bankAccountNumber = payload.bankAccountNumber;
  claim.bankName = payload.bankName;
  claim.bankBranch = payload.bankBranch;
  claim.bankIfscCode = payload.bankIfscCode;
  claim.amount = payload.amount;
  claim.totalRequestedAmount = totalRequestedAmount;
  claim.totalDisbursedAmount = nextTotalDisbursedAmount;
  claim.pendingAmount = nextPendingAmount;
  claim.currentCycleNumber = nextCycleNumber;
  claim.status = "SUBMITTED";
  claim.description = payload.description;
  claim.date = payload.date;
  claim.attachmentStorageId = payload.attachmentStorageId;
  claim.attachmentR2Key = payload.attachmentR2Key;
  claim.attachmentFileName = payload.attachmentFileName;
  claim.disbursedAt = undefined;
  claim.employeeReceivedAt = undefined;
  claim.proofSubmittedAt = undefined;
  claim.isClosedByL4 = false;
  claim.closedAt = undefined;
  claim.l1ReviewOutcome = undefined;
  claim.l2ReviewOutcome = undefined;
  claim.l1ApproverId = l1Admin ? String(l1Admin._id) : undefined;
  claim.l2ApproverId = l2Admin ? String(l2Admin._id) : undefined;
  claim.logs = [
    ...logs,
    {
      stage: "Resubmission",
      action: "SUBMIT",
      remarks:
        editDiff.length > 0
          ? `Employee edited and re-submitted requisition (${editDiff.length} field(s) changed)`
          : "Employee re-submitted requisition without changes",
      timestamp: now,
      actor: payload.actorName,
      editDiff: editDiff.length > 0 ? editDiff : undefined,
    },
  ];
  await claim.save();

  const claimRef = claim.convexId || String(claim._id);
  await ClaimCycleModel.updateOne(
    { claimId: claimRef, cycleNumber: nextCycleNumber },
    {
      $setOnInsert: {
        createdAtText: now,
      },
      $set: {
        openingPendingAmount: totalRequestedAmount,
        requestedAmount: requestedCycleAmount,
        approvedAmount: nextTotalDisbursedAmount,
        disbursedAmount: nextTotalDisbursedAmount,
        closingPendingAmount: nextPendingAmount,
        status: "UNDER_REVIEW",
        updatedAtText: now,
      },
    },
    { upsert: true }
  );
}

export async function mirrorSetDelayActionPlan(payload: MirrorSetDelayActionPlanPayload) {
  const claim = await findClaimByAnyId(payload.claimId);
  if (!claim) throw new Error("Claim not found in Mongo for mirror delay action plan");

  const now = nowIso();
  claim.logs = [
    ...(claim.logs || []),
    {
      stage: payload.actorRole,
      action: "DELAY_UPDATE",
      remarks: payload.delayReason,
      timestamp: now,
      actor: payload.actorName,
    },
  ];
  await claim.save();
}
