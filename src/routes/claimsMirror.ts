import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { executeDualWrite } from "../services/dualWrite.js";
import {
  mirrorCloseClaimByL4,
  mirrorCreateClaim,
  mirrorDisburseClaim,
  mirrorMarkClaimReceived,
  mirrorReplyClaim,
  mirrorRequestNextCyclePayment,
  mirrorReviewClaim,
  mirrorResubmitClaim,
  mirrorSetDelayActionPlan,
  mirrorSendBackClaim,
  mirrorSubmitProofDocuments,
} from "../services/mirrorWriteService.js";
import { getCurrentUserByEmail } from "../services/userService.js";

const CreateMirrorSchema = z.object({
  claimId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
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
  description: z.string().min(1),
  date: z.string().min(1),
  attachmentStorageId: z.string().optional(),
  attachmentR2Key: z.string().optional(),
  attachmentFileName: z.string().optional(),
});

const ReviewMirrorSchema = z.object({
  claimId: z.string().min(1),
  actorRole: z.enum(["L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN"]),
  actorName: z.string().min(1),
  remarks: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

const SendBackMirrorSchema = z.object({
  claimId: z.string().min(1),
  actorRole: z.enum(["L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN"]),
  actorName: z.string().min(1),
  remarks: z.string().min(1),
  targetRole: z.enum(["EMPLOYEE", "L1_ADMIN", "L2_ADMIN", "L3_ADMIN"]),
});

const DisburseMirrorSchema = z.object({
  claimId: z.string().min(1),
  actorRole: z.literal("L4_ADMIN"),
  actorName: z.string().min(1),
  remarks: z.string().min(1),
  disbursementAmount: z.number().positive(),
});

const CloseMirrorSchema = z.object({
  claimId: z.string().min(1),
  actorRole: z.literal("L4_ADMIN"),
  actorName: z.string().min(1),
  paymentReference: z.string().min(1),
  closureRemarks: z.string().min(1),
  proofVerified: z.boolean(),
  utilizationVerified: z.boolean(),
});

const MarkReceivedMirrorSchema = z.object({
  claimId: z.string().min(1),
  actorName: z.string().min(1),
});

const AttachmentSchema = z.object({
  storageId: z.string().optional(),
  r2Key: z.string().optional(),
  url: z.string().optional(),
  fileName: z.string().min(1),
});

const SubmitProofMirrorSchema = z.object({
  claimId: z.string().min(1),
  actorName: z.string().min(1),
  remarks: z.string().optional(),
  documents: z.array(AttachmentSchema).min(1),
});

const NextCycleMirrorSchema = z.object({
  claimId: z.string().min(1),
  actorName: z.string().min(1),
  requestedAmount: z.number().positive(),
  remarks: z.string().optional(),
});

const ReplyMirrorSchema = z.object({
  claimId: z.string().min(1),
  actorName: z.string().min(1),
  message: z.string().min(1),
  attachments: z.array(AttachmentSchema).optional(),
});

const ResubmitMirrorSchema = z.object({
  claimId: z.string().min(1),
  actorName: z.string().min(1),
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
  description: z.string().min(1),
  date: z.string().min(1),
  attachmentStorageId: z.string().optional(),
  attachmentR2Key: z.string().optional(),
  attachmentFileName: z.string().optional(),
});

const DelayPlanMirrorSchema = z.object({
  claimId: z.string().min(1),
  actorName: z.string().min(1),
  actorRole: z.enum(["L1_ADMIN", "L2_ADMIN"]),
  delayReason: z.string().min(1),
});

const claimsMirrorRoutes: FastifyPluginAsync = async (fastify) => {
  async function requireUser(request: FastifyRequest, reply: FastifyReply) {
    const email = request.authToken?.email?.toLowerCase();
    const user = await getCurrentUserByEmail(email || "");
    if (!user) {
      reply.code(404).send({ error: "USER_NOT_FOUND" });
      return null;
    }
    return user;
  }

  fastify.post(
    "/api/v1/claims/mirror/create",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;
      if (user.role !== "USER") {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Only employee mirror create is allowed" });
      }

      const payload = CreateMirrorSchema.parse(request.body);
      const result = await executeDualWrite({
        aggregate: "claims",
        operation: "createClaim",
        payload,
        primarySystem: "convex",
        primaryWrite: async () => {
          // Convex is primary and has already succeeded before mirror call.
        },
        secondaryWrite: async () => {
          await mirrorCreateClaim(payload);
        },
      });

      return reply.send(result);
    }
  );

  fastify.post(
    "/api/v1/claims/mirror/approve",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;
      if (!["L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN"].includes(user.role)) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Admin role required" });
      }

      const payload = ReviewMirrorSchema.parse(request.body);
      if (payload.action !== "approve") {
        return reply.code(400).send({ error: "BAD_REQUEST", message: "Expected approve action" });
      }

      const result = await executeDualWrite({
        aggregate: "claims",
        operation: "approveClaim",
        payload,
        primarySystem: "convex",
        primaryWrite: async () => {
          // Convex primary write already completed before mirror call.
        },
        secondaryWrite: async () => {
          await mirrorReviewClaim(payload);
        },
      });

      return reply.send(result);
    }
  );

  fastify.post(
    "/api/v1/claims/mirror/reject",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;
      if (!["L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN"].includes(user.role)) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Admin role required" });
      }

      const payload = ReviewMirrorSchema.parse(request.body);
      if (payload.action !== "reject") {
        return reply.code(400).send({ error: "BAD_REQUEST", message: "Expected reject action" });
      }

      const result = await executeDualWrite({
        aggregate: "claims",
        operation: "rejectClaim",
        payload,
        primarySystem: "convex",
        primaryWrite: async () => {
          // Convex primary write already completed before mirror call.
        },
        secondaryWrite: async () => {
          await mirrorReviewClaim(payload);
        },
      });

      return reply.send(result);
    }
  );

  fastify.post(
    "/api/v1/claims/mirror/send-back",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;
      if (!["L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN"].includes(user.role)) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Admin role required" });
      }
      const payload = SendBackMirrorSchema.parse(request.body);
      const result = await executeDualWrite({
        aggregate: "claims",
        operation: "sendBackClaim",
        payload,
        primarySystem: "convex",
        primaryWrite: async () => {},
        secondaryWrite: async () => {
          await mirrorSendBackClaim(payload);
        },
      });
      return reply.send(result);
    }
  );

  fastify.post(
    "/api/v1/claims/mirror/disburse",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;
      if (user.role !== "L4_ADMIN") {
        return reply.code(403).send({ error: "FORBIDDEN", message: "L4 admin role required" });
      }
      const payload = DisburseMirrorSchema.parse(request.body);
      const result = await executeDualWrite({
        aggregate: "claims",
        operation: "disburseClaimAmount",
        payload,
        primarySystem: "convex",
        primaryWrite: async () => {},
        secondaryWrite: async () => {
          await mirrorDisburseClaim(payload);
        },
      });
      return reply.send(result);
    }
  );

  fastify.post(
    "/api/v1/claims/mirror/close-by-l4",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;
      if (user.role !== "L4_ADMIN") {
        return reply.code(403).send({ error: "FORBIDDEN", message: "L4 admin role required" });
      }
      const payload = CloseMirrorSchema.parse(request.body);
      const result = await executeDualWrite({
        aggregate: "claims",
        operation: "closeClaimByL4",
        payload,
        primarySystem: "convex",
        primaryWrite: async () => {},
        secondaryWrite: async () => {
          await mirrorCloseClaimByL4(payload);
        },
      });
      return reply.send(result);
    }
  );

  fastify.post(
    "/api/v1/claims/mirror/mark-received",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;
      if (user.role !== "USER") {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Only employee mirror mark-received is allowed" });
      }
      const payload = MarkReceivedMirrorSchema.parse(request.body);
      const result = await executeDualWrite({
        aggregate: "claims",
        operation: "markClaimReceived",
        payload,
        primarySystem: "convex",
        primaryWrite: async () => {},
        secondaryWrite: async () => {
          await mirrorMarkClaimReceived(payload);
        },
      });
      return reply.send(result);
    }
  );

  fastify.post(
    "/api/v1/claims/mirror/submit-proof",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;
      if (user.role !== "USER") {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Only employee mirror submit-proof is allowed" });
      }
      const payload = SubmitProofMirrorSchema.parse(request.body);
      const result = await executeDualWrite({
        aggregate: "claims",
        operation: "submitProofDocuments",
        payload,
        primarySystem: "convex",
        primaryWrite: async () => {},
        secondaryWrite: async () => {
          await mirrorSubmitProofDocuments(payload);
        },
      });
      return reply.send(result);
    }
  );

  fastify.post(
    "/api/v1/claims/mirror/request-next-cycle",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;
      if (user.role !== "USER") {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Only employee mirror next-cycle request is allowed" });
      }
      const payload = NextCycleMirrorSchema.parse(request.body);
      const result = await executeDualWrite({
        aggregate: "claims",
        operation: "requestNextCyclePayment",
        payload,
        primarySystem: "convex",
        primaryWrite: async () => {},
        secondaryWrite: async () => {
          await mirrorRequestNextCyclePayment(payload);
        },
      });
      return reply.send(result);
    }
  );

  fastify.post(
    "/api/v1/claims/mirror/reply",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;
      if (user.role !== "USER") {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Only employee mirror reply is allowed" });
      }
      const payload = ReplyMirrorSchema.parse(request.body);
      const result = await executeDualWrite({
        aggregate: "claims",
        operation: "replyClaim",
        payload,
        primarySystem: "convex",
        primaryWrite: async () => {},
        secondaryWrite: async () => {
          await mirrorReplyClaim(payload);
        },
      });
      return reply.send(result);
    }
  );

  fastify.post(
    "/api/v1/claims/mirror/resubmit",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;
      if (user.role !== "USER") {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Only employee mirror resubmit is allowed" });
      }
      const payload = ResubmitMirrorSchema.parse(request.body);
      const result = await executeDualWrite({
        aggregate: "claims",
        operation: "resubmitClaim",
        payload,
        primarySystem: "convex",
        primaryWrite: async () => {},
        secondaryWrite: async () => {
          await mirrorResubmitClaim(payload);
        },
      });
      return reply.send(result);
    }
  );

  fastify.post(
    "/api/v1/claims/mirror/delay-action-plan",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;
      if (!["L1_ADMIN", "L2_ADMIN"].includes(user.role)) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "L1/L2 admin role required" });
      }
      const payload = DelayPlanMirrorSchema.parse(request.body);
      const result = await executeDualWrite({
        aggregate: "claims",
        operation: "setDelayActionPlan",
        payload,
        primarySystem: "convex",
        primaryWrite: async () => {},
        secondaryWrite: async () => {
          await mirrorSetDelayActionPlan(payload);
        },
      });
      return reply.send(result);
    }
  );
};

export default claimsMirrorRoutes;
