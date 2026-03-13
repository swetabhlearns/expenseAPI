import { Schema, model, type InferSchemaType } from "mongoose";

const RoleAuditLogSchema = new Schema(
  {
    convexId: { type: String, index: true },
    userEmail: { type: String, index: true },
    userName: { type: String },
    previousRole: { type: String },
    newRole: { type: String },
    changedBy: { type: String },
    changedByEmail: { type: String },
    reason: { type: String },
    timestamp: { type: Number, index: true },
  },
  { timestamps: true, versionKey: false }
);

RoleAuditLogSchema.index({ userEmail: 1, timestamp: -1 });

export type RoleAuditLogDocument = InferSchemaType<typeof RoleAuditLogSchema>;
export const RoleAuditLogModel = model("RoleAuditLog", RoleAuditLogSchema, "roleAuditLog");
