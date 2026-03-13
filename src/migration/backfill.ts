#!/usr/bin/env node

import { access } from "node:fs/promises";
import { connectMongo, disconnectMongo, isoNow, parseArgs, resolveSnapshotFile, type Domain } from "./common.js";
import { getCursor, markCursorFailed, markCursorRunning, saveCursor, upsertDomainRecord } from "./domainSync.js";
import { readSnapshotRecords } from "./snapshotReader.js";

type DomainResult = {
  domain: Domain;
  processed: number;
  upserted: number;
  skipped: number;
  resumedFrom: number;
  total: number;
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

async function runDomainBackfill(domain: Domain, options: Record<string, string | boolean>): Promise<DomainResult> {
  const filePath = resolveSnapshotFile(domain, options);
  if (!filePath || !(await fileExists(filePath))) {
    return {
      domain,
      processed: 0,
      upserted: 0,
      skipped: 0,
      resumedFrom: 0,
      total: 0,
    };
  }

  const cursorDomain = `backfill:${domain}`;
  const reset = options["reset-cursors"] === true;
  const batchSize = Number(options["batch-size"] || 200);
  const limit = Number(options.limit || 0);

  const records = await readSnapshotRecords(filePath);
  const lastCursor = reset ? "0" : await getCursor(cursorDomain);
  const startIndex = Math.max(0, Number(lastCursor) || 0);

  await markCursorRunning(cursorDomain);

  let processed = 0;
  let upserted = 0;
  let skipped = 0;

  try {
    const stopAt = limit > 0 ? Math.min(records.length, startIndex + limit) : records.length;
    for (let index = startIndex; index < stopAt; index += 1) {
      const result = await upsertDomainRecord(domain, records[index]);
      processed += 1;
      if (result.skipped) skipped += 1;
      else upserted += 1;

      if (processed % Math.max(1, batchSize) === 0 || index + 1 === stopAt) {
        await saveCursor(cursorDomain, String(index + 1));
      }
    }
  } catch (error) {
    await markCursorFailed(cursorDomain, error);
    throw error;
  }

  return {
    domain,
    processed,
    upserted,
    skipped,
    resumedFrom: startIndex,
    total: records.length,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(`[${isoNow()}] Starting Convex snapshot -> Mongo backfill`);

  await connectMongo();
  try {
    const results: DomainResult[] = [];
    for (const domain of domains) {
      const result = await runDomainBackfill(domain, options);
      results.push(result);
      console.log(
        `[backfill:${domain}] resumedFrom=${result.resumedFrom} processed=${result.processed} upserted=${result.upserted} skipped=${result.skipped} total=${result.total}`
      );
    }

    const totalProcessed = results.reduce((sum, entry) => sum + entry.processed, 0);
    const totalUpserted = results.reduce((sum, entry) => sum + entry.upserted, 0);
    const totalSkipped = results.reduce((sum, entry) => sum + entry.skipped, 0);
    console.log(`[backfill] done processed=${totalProcessed} upserted=${totalUpserted} skipped=${totalSkipped}`);
  } finally {
    await disconnectMongo();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
