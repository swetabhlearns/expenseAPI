import { Schema, model, type InferSchemaType } from "mongoose";

const ClaimCycleSchema = new Schema(
  {
    convexId: { type: String, index: true },
    claimId: { type: String, required: true, index: true },
    cycleNumber: { type: Number, required: true },
    openingPendingAmount: { type: Number, required: true },
    requestedAmount: { type: Number, required: true },
    approvedAmount: { type: Number },
    disbursedAmount: { type: Number },
    closingPendingAmount: { type: Number },
    status: {
      type: String,
      required: true,
      enum: ["UNDER_REVIEW", "APPROVED", "DISBURSED", "COMPLETED", "RETURNED", "REJECTED"],
      index: true,
    },
    createdAtText: { type: String },
    updatedAtText: { type: String },
    disbursedAt: { type: String },
    closedAt: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ClaimCycleSchema.index({ claimId: 1, cycleNumber: 1 }, { unique: true });

export type ClaimCycleDocument = InferSchemaType<typeof ClaimCycleSchema>;
export const ClaimCycleModel = model("ClaimCycle", ClaimCycleSchema, "claimCycles");
