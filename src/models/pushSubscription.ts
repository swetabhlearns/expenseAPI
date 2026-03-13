import { Schema, model, type InferSchemaType } from "mongoose";

const PushSubscriptionSchema = new Schema(
  {
    convexId: { type: String, index: true },
    userId: { type: String, required: true, index: true },
    endpoint: { type: String, required: true, unique: true, index: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    userAgent: { type: String },
    platform: { type: String },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdAtNumber: { type: Number },
    updatedAtNumber: { type: Number },
    lastNotifiedAt: { type: Number },
  },
  { timestamps: true, versionKey: false }
);

PushSubscriptionSchema.index({ userId: 1, status: 1 });

export type PushSubscriptionDocument = InferSchemaType<typeof PushSubscriptionSchema>;
export const PushSubscriptionModel = model("PushSubscription", PushSubscriptionSchema, "pushSubscriptions");
