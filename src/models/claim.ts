import { Schema, model, type InferSchemaType } from "mongoose";

const ClaimSchema = new Schema(
  {
    convexId: { type: String, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    category: { type: String, enum: ["WITHDRAWAL", "EMERGENCY", "ULTRA_EMERGENCY"] },
    purpose: { type: String },
    companyVertical: { type: String },
    vendorName: { type: String },
    vendorPhone: { type: String },
    vendorPan: { type: String },
    vendorAddress: { type: String },
    billingAddress: { type: String },
    shippingAddress: { type: String },
    vendorGstin: { type: String },
    costType: { type: String, enum: ["CAPEX", "OPEX"] },
    projectTitle: { type: String },
    title: { type: String },
    amount: { type: Number, required: true },
    totalRequestedAmount: { type: Number },
    totalDisbursedAmount: { type: Number },
    pendingAmount: { type: Number },
    currentCycleNumber: { type: Number },
    status: {
      type: String,
      required: true,
      enum: [
        "SUBMITTED",
        "APPROVED_L1",
        "APPROVED_L2",
        "APPROVED_L3",
        "PARTIALLY_DISBURSED",
        "RETURNED_TO_EMPLOYEE",
        "RETURNED_TO_L1",
        "RETURNED_TO_L2",
        "RETURNED_TO_L3",
        "DISBURSED",
        "COMPLETED",
        "REJECTED",
      ],
      index: true,
    },
    date: { type: String, required: true },
    l1ApproverId: { type: String, index: true },
    l2ApproverId: { type: String, index: true },
    l4ApproverId: { type: String, index: true },
    l1ReviewOutcome: { type: String, enum: ["APPROVE", "REJECT"] },
    l2ReviewOutcome: { type: String, enum: ["APPROVE", "REJECT"] },
    createdAtText: { type: String },
    description: { type: String },
    paymentMode: { type: String, enum: ["CASH", "ACCOUNT_TRANSFER"] },
    bankAccountHolderName: { type: String },
    bankAccountNumber: { type: String },
    bankName: { type: String },
    bankBranch: { type: String },
    bankIfscCode: { type: String },
    attachmentStorageId: { type: String },
    attachmentR2Key: { type: String },
    attachmentFileName: { type: String },
    employeeBucket: { type: String },
    employeeReceivedAt: { type: String },
    disbursedAt: { type: String },
    proofSubmittedAt: { type: String },
    isClosedByL4: { type: Boolean },
    closedAt: { type: String },
    paidAmountForSummary: { type: Number },
    isPaymentSummaryEligible: { type: Boolean },
    proofDocuments: { type: [Schema.Types.Mixed], default: [] },
    logs: { type: [Schema.Types.Mixed], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ClaimSchema.index({ userId: 1, status: 1, date: -1 });
ClaimSchema.index({ status: 1, date: -1 });
ClaimSchema.index({ paymentMode: 1, status: 1 });

export type ClaimDocument = InferSchemaType<typeof ClaimSchema>;
export const ClaimModel = model("Claim", ClaimSchema, "claims");
