import { PushSubscriptionModel } from "../models/pushSubscription.js";

export async function getMyPushStatus(userId: string) {
  const active = await PushSubscriptionModel.findOne({ userId, status: "active" }).lean();
  return {
    hasActiveSubscription: Boolean(active),
    endpoint: active?.endpoint || null,
  };
}

export async function upsertPushSubscription(args: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  platform?: string;
}) {
  const now = Date.now();
  await PushSubscriptionModel.updateOne(
    { endpoint: args.endpoint },
    {
      $set: {
        userId: args.userId,
        endpoint: args.endpoint,
        p256dh: args.p256dh,
        auth: args.auth,
        userAgent: args.userAgent,
        platform: args.platform,
        status: "active",
        updatedAtNumber: now,
      },
      $setOnInsert: {
        createdAtNumber: now,
      },
    },
    { upsert: true }
  );

  return { success: true };
}

export async function deactivatePushSubscription(args: { userId: string; endpoint: string }) {
  await PushSubscriptionModel.updateOne(
    { endpoint: args.endpoint, userId: args.userId },
    {
      $set: {
        status: "inactive",
        updatedAtNumber: Date.now(),
      },
    }
  );
  return { success: true };
}
