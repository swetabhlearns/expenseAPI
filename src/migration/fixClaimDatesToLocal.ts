import { ClaimModel } from "../models/claim.js";
import { connectMongo, disconnectMongo, parseArgs } from "./common.js";

type ClaimLike = {
  _id: unknown;
  date?: string;
  createdAtText?: string;
  createdAt?: Date;
  logs?: Array<{
    action?: string;
    timestamp?: string;
  }>;
};

function toLocalDateYmd(isoTimestamp: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoTimestamp));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Unable to format local date");
  }
  return `${year}-${month}-${day}`;
}

function dayDiff(fromYmd: string, toYmd: string): number {
  const from = new Date(`${fromYmd}T00:00:00Z`).getTime();
  const to = new Date(`${toYmd}T00:00:00Z`).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

function getAnchorTimestamp(claim: ClaimLike): string | null {
  const firstSubmit = (claim.logs || []).find((log) => log.action === "SUBMIT")?.timestamp;
  return firstSubmit || claim.createdAtText || claim.createdAt?.toISOString() || null;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const apply = Boolean(options.apply);
  const timeZone = typeof options.tz === "string" && options.tz.trim() ? options.tz : "Asia/Kolkata";
  const limit = typeof options.limit === "string" ? Math.max(1, Number(options.limit) || 0) : undefined;

  await connectMongo();
  try {
    const query = { date: { $regex: /^\d{4}-\d{2}-\d{2}$/ } };
    const cursor = ClaimModel.find(query, { _id: 1, date: 1, logs: 1, createdAt: 1, createdAtText: 1 })
      .lean()
      .cursor();

    const candidates: Array<{
      _id: unknown;
      from: string;
      to: string;
      anchor: string;
    }> = [];

    for await (const claim of cursor as AsyncIterable<ClaimLike>) {
      if (limit && candidates.length >= limit) break;
      if (!claim.date) continue;
      const anchor = getAnchorTimestamp(claim);
      if (!anchor) continue;
      const utcDate = new Date(anchor).toISOString().slice(0, 10);
      const localDate = toLocalDateYmd(anchor, timeZone);
      if (claim.date !== utcDate) continue;
      if (localDate === utcDate) continue;
      if (dayDiff(utcDate, localDate) !== 1) continue;
      candidates.push({
        _id: claim._id,
        from: claim.date,
        to: localDate,
        anchor,
      });
    }

    if (!apply) {
      console.log(
        `[fix-claim-dates] dry-run timezone=${timeZone} matched=${candidates.length} ` +
          `sample=${JSON.stringify(candidates.slice(0, 10), null, 2)}`
      );
      return;
    }

    if (candidates.length === 0) {
      console.log(`[fix-claim-dates] apply timezone=${timeZone} updated=0`);
      return;
    }

    const ops = candidates.map((candidate) => ({
      updateOne: {
        filter: { _id: candidate._id },
        update: { $set: { date: candidate.to } },
      },
    }));
    const result = await ClaimModel.bulkWrite(ops, { ordered: false });

    console.log(
      `[fix-claim-dates] apply timezone=${timeZone} matched=${candidates.length} ` +
        `updated=${result.modifiedCount} sample=${JSON.stringify(candidates.slice(0, 10), null, 2)}`
    );
  } finally {
    await disconnectMongo();
  }
}

void run().catch((error) => {
  console.error("[fix-claim-dates] failed", error);
  process.exitCode = 1;
});

