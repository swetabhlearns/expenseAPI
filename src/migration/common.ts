import path from "node:path";
import { accessSync } from "node:fs";
import mongoose from "mongoose";
import { config as loadEnv } from "dotenv";

export type Domain =
  | "users"
  | "claims"
  | "claimCycles"
  | "roleAuditLog"
  | "pushSubscriptions"
  | "adminDashboardCounters"
  | "employeeDashboardCounters"
  | "paymentDashboardCounters"
  | "analyticsDailySummaries"
  | "analyticsUserDailySummaries"
  | "analyticsAdminDailySummaries";

export function parseArgs(argv: string[]) {
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return options;
}

export function resolveSnapshotFile(domain: Domain, options: Record<string, string | boolean>) {
  const explicit = options[`${domain}-file`];
  if (typeof explicit === "string" && explicit.trim()) {
    return path.resolve(explicit);
  }

  const envKeyByDomain: Record<Domain, string> = {
    users: "CONVEX_EXPORT_USERS_FILE",
    claims: "CONVEX_EXPORT_CLAIMS_FILE",
    claimCycles: "CONVEX_EXPORT_CLAIM_CYCLES_FILE",
    roleAuditLog: "CONVEX_EXPORT_ROLE_AUDIT_LOG_FILE",
    pushSubscriptions: "CONVEX_EXPORT_PUSH_SUBSCRIPTIONS_FILE",
    adminDashboardCounters: "CONVEX_EXPORT_ADMIN_DASHBOARD_COUNTERS_FILE",
    employeeDashboardCounters: "CONVEX_EXPORT_EMPLOYEE_DASHBOARD_COUNTERS_FILE",
    paymentDashboardCounters: "CONVEX_EXPORT_PAYMENT_DASHBOARD_COUNTERS_FILE",
    analyticsDailySummaries: "CONVEX_EXPORT_ANALYTICS_DAILY_FILE",
    analyticsUserDailySummaries: "CONVEX_EXPORT_ANALYTICS_USER_DAILY_FILE",
    analyticsAdminDailySummaries: "CONVEX_EXPORT_ANALYTICS_ADMIN_DAILY_FILE",
  };

  const direct = process.env[envKeyByDomain[domain]];
  if (direct) return path.resolve(direct);

  const exportDir = process.env.CONVEX_EXPORT_DIR;
  if (!exportDir) return null;

  const directFile = path.resolve(exportDir, `${domain}.jsonl`);
  try {
    accessSync(directFile);
    return directFile;
  } catch {
    // no-op
  }

  const convexSnapshotLayoutFile = path.resolve(exportDir, domain, "documents.jsonl");
  try {
    accessSync(convexSnapshotLayoutFile);
    return convexSnapshotLayoutFile;
  } catch {
    // no-op
  }

  return directFile;
}

export async function connectMongo() {
  loadEnv({ path: process.env.BACKEND_ENV_FILE || "backend/.env" });

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI in environment");
  }

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME || "expenseclaim",
  });
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}

export function isoNow() {
  return new Date().toISOString();
}

export function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}
