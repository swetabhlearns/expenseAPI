import { randomUUID } from "node:crypto";
import { DualWriteAuditModel, DualWriteRetryModel } from "../models/migrationControl.js";

interface DualWriteContext<TPayload> {
  aggregate: "claims" | "users" | "analytics" | "notifications";
  operation: string;
  payload: TPayload;
  primarySystem?: "convex" | "node";
  primaryWrite: () => Promise<unknown>;
  secondaryWrite: () => Promise<unknown>;
}

interface DualWriteResult {
  correlationId: string;
  primaryStatus: "success" | "failed";
  secondaryStatus: "success" | "failed" | "skipped";
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function executeDualWrite<TPayload>(context: DualWriteContext<TPayload>): Promise<DualWriteResult> {
  const correlationId = randomUUID();
  const primarySystem = context.primarySystem ?? "convex";

  let primaryStatus: DualWriteResult["primaryStatus"] = "failed";
  let secondaryStatus: DualWriteResult["secondaryStatus"] = "skipped";

  try {
    await context.primaryWrite();
    primaryStatus = "success";
  } catch (primaryError) {
    await DualWriteAuditModel.create({
      correlationId,
      aggregate: context.aggregate,
      operation: context.operation,
      primarySystem,
      primaryStatus: "failed",
      secondaryStatus: "skipped",
      metadata: {
        primaryError: stringifyError(primaryError),
      },
    });
    throw primaryError;
  }

  try {
    await context.secondaryWrite();
    secondaryStatus = "success";
  } catch (secondaryError) {
    secondaryStatus = "failed";
    await DualWriteRetryModel.create({
      correlationId,
      aggregate: context.aggregate,
      operation: context.operation,
      payload: context.payload,
      status: "queued",
      attempts: 0,
      lastError: stringifyError(secondaryError),
      nextRetryAt: new Date(Date.now() + 60_000),
    });
  }

  await DualWriteAuditModel.create({
    correlationId,
    aggregate: context.aggregate,
    operation: context.operation,
    primarySystem,
    primaryStatus,
    secondaryStatus,
  });

  return {
    correlationId,
    primaryStatus,
    secondaryStatus,
  };
}

export async function processDualWriteRetries(options: {
  batchSize?: number;
  handler: (job: { aggregate: string; operation: string; payload: unknown }) => Promise<void>;
}) {
  const batchSize = options.batchSize ?? 50;
  const jobs = await DualWriteRetryModel.find({
    status: "queued",
    nextRetryAt: { $lte: new Date() },
  })
    .sort({ nextRetryAt: 1 })
    .limit(batchSize)
    .lean();

  for (const job of jobs) {
    try {
      await DualWriteRetryModel.updateOne({ _id: job._id }, { $set: { status: "processing" } });
      await options.handler({
        aggregate: job.aggregate,
        operation: job.operation,
        payload: job.payload,
      });
      await DualWriteRetryModel.updateOne(
        { _id: job._id },
        { $set: { status: "completed", lastError: undefined } }
      );
    } catch (error) {
      const attempts = (job.attempts || 0) + 1;
      const exhausted = attempts >= 8;
      await DualWriteRetryModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: exhausted ? "failed" : "queued",
            attempts,
            lastError: stringifyError(error),
            nextRetryAt: new Date(Date.now() + Math.min(60_000 * attempts, 15 * 60_000)),
          },
        }
      );
    }
  }

  return { processed: jobs.length };
}
