#!/usr/bin/env node

import { access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ClaimCycleModel } from "../models/claimCycle.js";
import { ClaimModel } from "../models/claim.js";
import { ReconcileReportModel } from "../models/migrationControl.js";
import { PushSubscriptionModel } from "../models/pushSubscription.js";
import { RoleAuditLogModel } from "../models/roleAuditLog.js";
import { UserModel } from "../models/user.js";
import { connectMongo, disconnectMongo, isoNow, parseArgs, resolveSnapshotFile, type Domain } from "./common.js";
import { readSnapshotRecords } from "./snapshotReader.js";

type DomainStats = {
  domain: Domain;
  convexCount: number;
  mongoCount: number;
  mismatchCount: number;
  mismatchPercent: number;
  convexChecksum: string;
  mongoChecksum: string;
};

const domains: Domain[] = [
  "users",
  "claims",
  "claimCycles",
  "roleAuditLog",
  "pushSubscriptions",
  "adminDashboardCounters",
  "employeeDashboardCounters",
  "paymentDashboardCounters",
  "analyticsDailySummaries",
  "analyticsUserDailySummaries",
  "analyticsAdminDailySummaries",
];

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function hashValues(values: string[]) {
  const hash = createHash("sha256");
  for (const value of values.sort()) {
    hash.update(value);
    hash.update("\n");
  }
  return hash.digest("hex");
}

function pickSnapshotIds(records: Record<string, unknown>[]) {
  return records
    .map((record) => record.convexId || record._id || record.id)
    .map((value) => (value === null || value === undefined ? "" : String(value)))
    .filter(Boolean);
}

async function getMongoIds(domain: Domain) {
  if (domain === "users") {
    const rows = await UserModel.find({}, { convexId: 1 }).lean();
    return rows.map((row) => row.convexId || String(row._id)).filter(Boolean) as string[];
  }
  if (domain === "claims") {
    const rows = await ClaimModel.find({}, { convexId: 1 }).lean();
    return rows.map((row) => row.convexId || String(row._id)).filter(Boolean) as string[];
  }
  if (domain === "roleAuditLog") {
    const rows = await RoleAuditLogModel.find({}, { convexId: 1 }).lean();
    return rows.map((row) => row.convexId || String(row._id)).filter(Boolean) as string[];
  }
  if (domain === "pushSubscriptions") {
    const rows = await PushSubscriptionModel.find({}, { convexId: 1, endpoint: 1 }).lean();
    return rows.map((row) => row.convexId || row.endpoint || String(row._id)).filter(Boolean) as string[];
  }
  if (domain === "adminDashboardCounters" || domain === "employeeDashboardCounters" || domain === "paymentDashboardCounters") {
    const rows = await UserModel.db.collection(domain).find({}, { projection: { _id: 1 } }).toArray();
    return rows.map((row: any) => String(row._id));
  }
  if (domain === "analyticsDailySummaries" || domain === "analyticsUserDailySummaries" || domain === "analyticsAdminDailySummaries") {
    const rows = await UserModel.db.collection(domain).find({}, { projection: { convexId: 1, _id: 1 } }).toArray();
    return rows.map((row: any) => String(row.convexId || row._id));
  }
  const rows = await ClaimCycleModel.find({}, { convexId: 1, claimId: 1, cycleNumber: 1 }).lean();
  return rows
    .map((row) => row.convexId || `${row.claimId}:${row.cycleNumber}`)
    .filter(Boolean) as string[];
}

async function getMongoCount(domain: Domain) {
  if (domain === "users") return UserModel.countDocuments({});
  if (domain === "claims") return ClaimModel.countDocuments({});
  if (domain === "roleAuditLog") return RoleAuditLogModel.countDocuments({});
  if (domain === "pushSubscriptions") return PushSubscriptionModel.countDocuments({});
  if (domain === "adminDashboardCounters" || domain === "employeeDashboardCounters" || domain === "paymentDashboardCounters") {
    return UserModel.db.collection(domain).countDocuments({});
  }
  if (domain === "analyticsDailySummaries" || domain === "analyticsUserDailySummaries" || domain === "analyticsAdminDailySummaries") {
    return UserModel.db.collection(domain).countDocuments({});
  }
  return ClaimCycleModel.countDocuments({});
}

async function reconcileDomain(domain: Domain, options: Record<string, string | boolean>): Promise<DomainStats | null> {
  const filePath = resolveSnapshotFile(domain, options);
  if (!filePath || !(await fileExists(filePath))) {
    return null;
  }

  const records = await readSnapshotRecords(filePath);
  const convexCount = records.length;
  const mongoCount = await getMongoCount(domain);
  const mismatchCount = Math.abs(convexCount - mongoCount);
  const mismatchPercent = convexCount === 0 ? (mongoCount === 0 ? 0 : 100) : (mismatchCount / convexCount) * 100;

  const convexChecksum = hashValues(pickSnapshotIds(records));
  const mongoChecksum = hashValues(await getMongoIds(domain));

  return {
    domain,
    convexCount,
    mongoCount,
    mismatchCount,
    mismatchPercent,
    convexChecksum,
    mongoChecksum,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const maxDriftPercent = Number(options["max-drift-percent"] || process.env.MIGRATION_MAX_DRIFT_PERCENT || 0.1);
  const startedAt = new Date();

  console.log(`[${isoNow()}] Starting reconciliation`);

  await connectMongo();
  try {
    const failures: DomainStats[] = [];

    for (const domain of domains) {
      const stats = await reconcileDomain(domain, options);
      if (!stats) {
        console.log(`[reconcile:${domain}] skipped (snapshot not configured)`);
        continue;
      }

      await ReconcileReportModel.create({
        domain,
        startedAt,
        finishedAt: new Date(),
        convexCount: stats.convexCount,
        mongoCount: stats.mongoCount,
        mismatchCount: stats.mismatchCount,
        mismatchPercent: stats.mismatchPercent,
        details: {
          convexChecksum: stats.convexChecksum,
          mongoChecksum: stats.mongoChecksum,
          checksumsMatch: stats.convexChecksum === stats.mongoChecksum,
        },
      });

      console.log(
        `[reconcile:${domain}] convex=${stats.convexCount} mongo=${stats.mongoCount} mismatch=${stats.mismatchCount} drift=${stats.mismatchPercent.toFixed(4)}% checksumMatch=${stats.convexChecksum === stats.mongoChecksum}`
      );

      if (stats.mismatchPercent > maxDriftPercent || stats.convexChecksum !== stats.mongoChecksum) {
        failures.push(stats);
      }
    }

    if (failures.length > 0) {
      console.error(`[reconcile] failed domains=${failures.map((item) => item.domain).join(",")}`);
      process.exitCode = 2;
      return;
    }

    console.log("[reconcile] all configured domains within drift threshold");
  } finally {
    await disconnectMongo();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
