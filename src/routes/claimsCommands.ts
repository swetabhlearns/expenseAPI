import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { Types } from "mongoose";
import { z } from "zod";
import {
  mirrorCloseClaimByL4,
  mirrorCreateClaim,
  mirrorDisburseClaim,
  mirrorMarkClaimReceived,
  mirrorReplyClaim,
  mirrorRequestNextCyclePayment,
  mirrorResubmitClaim,
  mirrorReviewClaim,
  mirrorSendBackClaim,
  mirrorSetDelayActionPlan,
  mirrorSubmitProofDocuments,
} from "../services/mirrorWriteService.js";
import { getCurrentUserByEmail } from "../services/userService.js";

const ClaimCreateSchema = z.object({
  projectTitle: z.string().min(1),
  category: z.enum(["WITHDRAWAL", "EMERGENCY"]),
  companyVertical: z.string().min(1),
  purpose: z.string().min(1),
  vendorName: z.string().min(1),
  vendorPhone: z.string().min(1),
  vendorPan: z.string().min(1),
  vendorAddress: z.string().min(1),
  billingAddress: z.string().min(1),
  shippingAddress: z.string().min(1),
  vendorGstin: z.string().min(1),
  costType: z.enum(["CAPEX", "OPEX"]),
  paymentMode: z.enum(["CASH", "ACCOUNT_TRANSFER"]),
  bankAccountHolderName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankName: z.string().optional(),
  bankBranch: z.string().optional(),
  bankIfscCode: z.string().optional(),
  amount: z.number().positive(),
  paymentRequestType: z.enum(["FULL", "ADVANCE"]).optional(),
  requestedCycleAmount: z.number().positive().optional(),
  description: z.string().min(1),
  date: z.string().min(1),
  attachmentStorageId: z.string().optional(),
  attachmentR2Key: z.string().optional(),
  attachmentFileName: z.string().optional(),
});

const ClaimResubmitSchema = ClaimCreateSchema.extend({
  claimId: z.string().min(1),
});

const ApproveRejectSchema = z.object({
  claimId: z.string().min(1),
  remarks: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

const SendBackSchema = z.object({
  claimId: z.string().min(1),
  remarks: z.string().min(1),
  targetRole: z.enum(["EMPLOYEE", "L1_ADMIN", "L2_ADMIN", "L3_ADMIN"]),
});

const DisburseSchema = z.object({
  claimId: z.string().min(1),
  remarks: z.string().min(1),
  disbursementAmount: z.number().positive(),
});

const CloseSchema = z.object({
  claimId: z.string().min(1),
  paymentReference: z.string().min(1),
  closureRemarks: z.string().min(1),
  proofVerified: z.boolean(),
  utilizationVerified: z.boolean(),
});

const MarkReceivedSchema = z.object({
  claimId: z.string().min(1),
});

const AttachmentSchema = z.object({
  storageId: z.string().optional(),
  r2Key: z.string().optional(),
  url: z.string().optional(),
  fileName: z.string().min(1),
});

const SubmitProofSchema = z.object({
  claimId: z.string().min(1),
  remarks: z.string().optional(),
  documents: z.array(AttachmentSchema).min(1),
});

const NextCycleSchema = z.object({
  claimId: z.string().min(1),
  requestedAmount: z.number().positive(),
  remarks: z.string().optional(),
});

const ReplySchema = z.object({
  claimId: z.string().min(1),
  message: z.string().min(1),
  attachments: z.array(AttachmentSchema).optional(),
});

const DelayPlanSchema = z.object({
  claimId: z.string().min(1),
  delayReason: z.string().min(1),
});

const claimsCommandsRoutes: FastifyPluginAsync = async (fastify) => {
  function isAmountValidationError(message: string) {
    return message.includes("Requested cycle amount");
  }

  async function requireUser(request: FastifyRequest, reply: FastifyReply) {
    const email = request.authToken?.email?.toLowerCase();
    const user = await getCurrentUserByEmail(email || "");
    if (!user) {
      reply.code(404).send({ error: "USER_NOT_FOUND" });
      return null;
    }
    return user;
  }

  fastify.post("/api/v1/claims/commands/create", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (user.role !== "USER") {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Employee role required" });
    }
    const payload = ClaimCreateSchema.parse(request.body);
    const claimId = new Types.ObjectId().toString();
    try {
      await mirrorCreateClaim({
        ...payload,
        claimId,
        userId: user.id,
        userName: user.name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isAmountValidationError(message)) {
        return reply.code(400).send({ error: "INVALID_AMOUNT", message });
      }
      throw error;
    }
    return reply.send({ ok: true, claimId });
  });

  fastify.post("/api/v1/claims/commands/resubmit", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (user.role !== "USER") {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Employee role required" });
    }
    const payload = ClaimResubmitSchema.parse(request.body);
    try {
      await mirrorResubmitClaim({
        ...payload,
        actorName: user.name,
        attachmentStorageId: payload.attachmentStorageId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isAmountValidationError(message)) {
        return reply.code(400).send({ error: "INVALID_AMOUNT", message });
      }
      if (message.includes("can only be resubmitted")) {
        return reply.code(409).send({ error: "INVALID_STATE", message });
      }
      throw error;
    }
    return reply.send({ ok: true });
  });

  fastify.post("/api/v1/claims/commands/review", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (!["L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN"].includes(user.role)) {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Admin role required" });
    }
    const payload = ApproveRejectSchema.parse(request.body);
    await mirrorReviewClaim({
      claimId: payload.claimId,
      action: payload.action,
      actorName: user.name,
      actorRole: user.role as "L1_ADMIN" | "L2_ADMIN" | "L3_ADMIN" | "L4_ADMIN",
      remarks: payload.remarks,
    });
    return reply.send({ ok: true });
  });

  fastify.post("/api/v1/claims/commands/send-back", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (!["L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN"].includes(user.role)) {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Admin role required" });
    }
    const payload = SendBackSchema.parse(request.body);
    await mirrorSendBackClaim({
      ...payload,
      actorName: user.name,
      actorRole: user.role as "L1_ADMIN" | "L2_ADMIN" | "L3_ADMIN" | "L4_ADMIN",
    });
    return reply.send({ ok: true });
  });

  fastify.post("/api/v1/claims/commands/disburse", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (user.role !== "L4_ADMIN") {
      return reply.code(403).send({ error: "FORBIDDEN", message: "L4 admin role required" });
    }
    const payload = DisburseSchema.parse(request.body);
    await mirrorDisburseClaim({
      ...payload,
      actorName: user.name,
      actorRole: "L4_ADMIN",
    });
    return reply.send({ ok: true });
  });

  fastify.post("/api/v1/claims/commands/close-by-l4", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (user.role !== "L4_ADMIN") {
      return reply.code(403).send({ error: "FORBIDDEN", message: "L4 admin role required" });
    }
    const payload = CloseSchema.parse(request.body);
    await mirrorCloseClaimByL4({
      ...payload,
      actorName: user.name,
      actorRole: "L4_ADMIN",
    });
    return reply.send({ ok: true });
  });

  fastify.post("/api/v1/claims/commands/mark-received", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (user.role !== "USER") {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Employee role required" });
    }
    const payload = MarkReceivedSchema.parse(request.body);
    await mirrorMarkClaimReceived({
      ...payload,
      actorName: user.name,
    });
    return reply.send({ ok: true });
  });

  fastify.post("/api/v1/claims/commands/submit-proof", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (user.role !== "USER") {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Employee role required" });
    }
    const payload = SubmitProofSchema.parse(request.body);
    await mirrorSubmitProofDocuments({
      ...payload,
      actorName: user.name,
    });
    return reply.send({ ok: true });
  });

  fastify.post("/api/v1/claims/commands/request-next-cycle", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (user.role !== "USER") {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Employee role required" });
    }
    const payload = NextCycleSchema.parse(request.body);
    await mirrorRequestNextCyclePayment({
      ...payload,
      actorName: user.name,
    });
    return reply.send({ ok: true });
  });

  fastify.post("/api/v1/claims/commands/reply", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (user.role !== "USER") {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Employee role required" });
    }
    const payload = ReplySchema.parse(request.body);
    await mirrorReplyClaim({
      ...payload,
      actorName: user.name,
    });
    return reply.send({ ok: true });
  });

  fastify.post("/api/v1/claims/commands/delay-action-plan", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (!["L1_ADMIN", "L2_ADMIN"].includes(user.role)) {
      return reply.code(403).send({ error: "FORBIDDEN", message: "L1/L2 admin role required" });
    }
    const payload = DelayPlanSchema.parse(request.body);
    await mirrorSetDelayActionPlan({
      ...payload,
      actorName: user.name,
      actorRole: user.role as "L1_ADMIN" | "L2_ADMIN",
    });
    return reply.send({ ok: true });
  });
};

export default claimsCommandsRoutes;
