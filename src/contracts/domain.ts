export const USER_ROLES = [
  "USER",
  "L1_ADMIN",
  "L2_ADMIN",
  "L3_ADMIN",
  "L4_ADMIN",
  "ROLE_MANAGER",
] as const;

export const CLAIM_STATUSES = [
  "SUBMITTED",
  "APPROVED_L1",
  "APPROVED_L2",
  "APPROVED_L3",
  "PARTIALLY_DISBURSED",
  "RETURNED_TO_EMPLOYEE",
  "RETURNED_TO_L1",
  "RETURNED_TO_L2",
  "RETURNED_TO_L3",
  "DISBURSED",
  "COMPLETED",
  "REJECTED",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export interface UserSnapshot {
  id: string;
  legacyId?: string;
  name: string;
  email: string;
  role: UserRole;
  status?: "active" | "inactive";
  verticals?: string[];
}

export interface AuthUserResponse {
  user: UserSnapshot | null;
  source: "convex" | "node";
  fetchedAt: string;
}

export interface ClaimListItem {
  id: string;
  userId: string;
  userName: string;
  status: ClaimStatus;
  amount: number;
  pendingAmount?: number;
  currentCycleNumber?: number;
  paymentMode?: "CASH" | "ACCOUNT_TRANSFER";
  createdAt: string;
  date: string;
}

export interface DualWriteAuditRecord {
  correlationId: string;
  aggregate: "claims" | "users" | "analytics" | "notifications";
  operation: string;
  primarySystem: "convex" | "node";
  primaryStatus: "success" | "failed";
  secondaryStatus: "success" | "failed" | "skipped";
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ReconcileReport {
  domain: "users" | "claims" | "claimCycles" | "analytics" | "pushSubscriptions";
  startedAt: string;
  finishedAt: string;
  convexCount: number;
  mongoCount: number;
  mismatchCount: number;
  mismatchPercent: number;
}
