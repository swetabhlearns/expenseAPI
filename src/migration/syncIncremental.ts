#!/usr/bin/env node

import { access } from "node:fs/promises";
import { asString, connectMongo, disconnectMongo, isoNow, parseArgs, type Domain } from "./common.js";
import {
  deleteDomainRecord,
  getCursor,
  markCursorFailed,
  markCursorRunning,
  saveCursor,
  upsertDomainRecord,
} from "./domainSync.js";
import { readSnapshotRecords } from "./snapshotReader.js";

type IncrementalEvent = {
  domain: Domain;
  op: "upsert" | "delete";
  id?: string;
  doc?: Record<string, unknown>;
  cursor?: string | number;
};

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeEvent(raw: Record<string, unknown>): IncrementalEvent | null {
  const domain = asString(raw.domain) as Domain | undefined;
  const op = asString(raw.op);
  if (
    !domain ||
    ![
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
    ].includes(domain)
  ) {
    return null;
  }
  if (op !== "upsert" && op !== "delete") return null;

  return {
    domain,
    op,
    id: asString(raw.id),
    doc: (raw.doc && typeof raw.doc === "object") ? (raw.doc as Record<string, unknown>) : undefined,
    cursor: typeof raw.cursor === "number" || typeof raw.cursor === "string" ? raw.cursor : undefined,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const incrementalFile =
    (typeof options.file === "string" && options.file) ||
    process.env.CONVEX_INCREMENTAL_FILE ||
    "";

  if (!incrementalFile) {
    throw new Error("Missing incremental source file. Set --file or CONVEX_INCREMENTAL_FILE");
  }

  if (!(await fileExists(incrementalFile))) {
    throw new Error(`Incremental source file not found: ${incrementalFile}`);
  }

  const limit = Number(options.limit || 0);
  const eventsRaw = await readSnapshotRecords(incrementalFile);
  const events = eventsRaw
    .map((entry) => normalizeEvent(entry))
    .filter((entry): entry is IncrementalEvent => Boolean(entry));

  console.log(`[${isoNow()}] Starting incremental sync from ${incrementalFile}`);
  console.log(`[sync] loaded_events=${events.length}`);

  await connectMongo();
  try {
    const cursors: Record<Domain, number> = {
      users: Number(await getCursor("sync:users")) || 0,
      claims: Number(await getCursor("sync:claims")) || 0,
      claimCycles: Number(await getCursor("sync:claimCycles")) || 0,
      roleAuditLog: Number(await getCursor("sync:roleAuditLog")) || 0,
      pushSubscriptions: Number(await getCursor("sync:pushSubscriptions")) || 0,
      adminDashboardCounters: Number(await getCursor("sync:adminDashboardCounters")) || 0,
      employeeDashboardCounters: Number(await getCursor("sync:employeeDashboardCounters")) || 0,
      paymentDashboardCounters: Number(await getCursor("sync:paymentDashboardCounters")) || 0,
      analyticsDailySummaries: Number(await getCursor("sync:analyticsDailySummaries")) || 0,
      analyticsUserDailySummaries: Number(await getCursor("sync:analyticsUserDailySummaries")) || 0,
      analyticsAdminDailySummaries: Number(await getCursor("sync:analyticsAdminDailySummaries")) || 0,
    };

    let processed = 0;
    let upserts = 0;
    let deletes = 0;
    let skipped = 0;

    for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
      const event = events[eventIndex];
      const cursorValue = Number(event.cursor ?? eventIndex + 1);
      if (!Number.isFinite(cursorValue)) {
        skipped += 1;
        continue;
      }
      if (cursorValue <= cursors[event.domain]) {
        continue;
      }

      const cursorDomain = `sync:${event.domain}`;
      await markCursorRunning(cursorDomain);

      try {
        if (event.op === "upsert") {
          if (!event.doc) {
            skipped += 1;
          } else {
            const result = await upsertDomainRecord(event.domain, event.doc);
            if (result.skipped) skipped += 1;
            else upserts += 1;
          }
        } else {
          const id = event.id || (event.doc ? asString(event.doc._id) || asString(event.doc.id) || asString(event.doc.convexId) : undefined);
          if (!id) {
            skipped += 1;
          } else {
            await deleteDomainRecord(event.domain, id);
            deletes += 1;
          }
        }

        cursors[event.domain] = cursorValue;
        await saveCursor(cursorDomain, String(cursorValue));
      } catch (error) {
        await markCursorFailed(cursorDomain, error);
        throw error;
      }

      processed += 1;
      if (limit > 0 && processed >= limit) break;
    }

    console.log(`[sync] processed=${processed} upserts=${upserts} deletes=${deletes} skipped=${skipped}`);
  } finally {
    await disconnectMongo();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
