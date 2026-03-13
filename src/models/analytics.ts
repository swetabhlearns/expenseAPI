import { Schema, model, type InferSchemaType } from "mongoose";

const AnalyticsDailySummarySchema = new Schema(
  {
    convexId: { type: String, index: true },
    key: { type: String, index: true },
    date: { type: String, index: true },
    companyVertical: { type: String },
    paymentMode: { type: String },
    costType: { type: String },
    totalClaims: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    totalRequestedAmount: { type: Number, default: 0 },
    pendingCount: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    approvedCount: { type: Number, default: 0 },
    approvedAmount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    rejectedAmount: { type: Number, default: 0 },
    awaitingPaymentCount: { type: Number, default: 0 },
    awaitingPaymentAmount: { type: Number, default: 0 },
    paidCount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    advancePaidAmount: { type: Number, default: 0 },
    remainingBalancePendingAmount: { type: Number, default: 0 },
    statusCounts: { type: Schema.Types.Mixed },
    statusAmounts: { type: Schema.Types.Mixed },
    updatedAtText: { type: String },
  },
  { timestamps: true, versionKey: false }
);

AnalyticsDailySummarySchema.index({ date: 1, companyVertical: 1, paymentMode: 1, costType: 1 });

const AnalyticsUserDailySummarySchema = new Schema(
  {
    convexId: { type: String, index: true },
    key: { type: String, index: true },
    date: { type: String, index: true },
    userId: { type: String, index: true },
    userName: { type: String },
    totalClaims: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    totalRequestedAmount: { type: Number, default: 0 },
    totalDisbursedAmount: { type: Number, default: 0 },
    approvedClaims: { type: Number, default: 0 },
    rejectedClaims: { type: Number, default: 0 },
    pendingClaims: { type: Number, default: 0 },
    processedCount: { type: Number, default: 0 },
    updatedAtText: { type: String },
  },
  { timestamps: true, versionKey: false }
);

AnalyticsUserDailySummarySchema.index({ userId: 1, date: 1 });

const AnalyticsAdminDailySummarySchema = new Schema(
  {
    convexId: { type: String, index: true },
    key: { type: String, index: true },
    date: { type: String, index: true },
    adminUserId: { type: String, index: true },
    adminName: { type: String },
    role: { type: String, index: true },
    approvedCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    processedCount: { type: Number, default: 0 },
    updatedAtText: { type: String },
  },
  { timestamps: true, versionKey: false }
);

AnalyticsAdminDailySummarySchema.index({ adminUserId: 1, date: 1 });

export type AnalyticsDailySummaryDocument = InferSchemaType<typeof AnalyticsDailySummarySchema>;
export type AnalyticsUserDailySummaryDocument = InferSchemaType<typeof AnalyticsUserDailySummarySchema>;
export type AnalyticsAdminDailySummaryDocument = InferSchemaType<typeof AnalyticsAdminDailySummarySchema>;

export const AnalyticsDailySummaryModel = model("AnalyticsDailySummary", AnalyticsDailySummarySchema, "analyticsDailySummaries");
export const AnalyticsUserDailySummaryModel = model("AnalyticsUserDailySummary", AnalyticsUserDailySummarySchema, "analyticsUserDailySummaries");
export const AnalyticsAdminDailySummaryModel = model("AnalyticsAdminDailySummary", AnalyticsAdminDailySummarySchema, "analyticsAdminDailySummaries");
