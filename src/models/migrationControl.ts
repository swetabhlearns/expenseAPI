import { Schema, model } from "mongoose";

const SyncCursorSchema = new Schema(
  {
    domain: { type: String, required: true, unique: true, index: true },
    lastCursor: { type: String, default: "" },
    lastRunAt: { type: Date },
    status: { type: String, enum: ["idle", "running", "failed"], default: "idle" },
    error: { type: String },
  },
  { timestamps: true, versionKey: false }
);

const ReconcileReportSchema = new Schema(
  {
    domain: { type: String, required: true, index: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    convexCount: { type: Number, required: true },
    mongoCount: { type: Number, required: true },
    mismatchCount: { type: Number, required: true },
    mismatchPercent: { type: Number, required: true },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false }
);

const DualWriteAuditSchema = new Schema(
  {
    correlationId: { type: String, required: true, index: true },
    aggregate: { type: String, required: true, index: true },
    operation: { type: String, required: true },
    primarySystem: { type: String, required: true, enum: ["convex", "node"] },
    primaryStatus: { type: String, required: true, enum: ["success", "failed"] },
    secondaryStatus: { type: String, required: true, enum: ["success", "failed", "skipped"] },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false }
);

const DualWriteRetrySchema = new Schema(
  {
    correlationId: { type: String, required: true, index: true },
    aggregate: { type: String, required: true, index: true },
    operation: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    attempts: { type: Number, default: 0 },
    status: { type: String, enum: ["queued", "processing", "failed", "completed"], default: "queued", index: true },
    lastError: { type: String },
    nextRetryAt: { type: Date, index: true },
  },
  { timestamps: true, versionKey: false }
);

export const SyncCursorModel = model("SyncCursor", SyncCursorSchema, "sync_cursor");
export const ReconcileReportModel = model("ReconcileReport", ReconcileReportSchema, "reconcile_report");
export const DualWriteAuditModel = model("DualWriteAudit", DualWriteAuditSchema, "dual_write_audit");
export const DualWriteRetryModel = model("DualWriteRetry", DualWriteRetrySchema, "dual_write_retry");
