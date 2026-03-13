import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { getCurrentUserByEmail } from "../services/userService.js";
import {
  getAdminClaimsPage,
  getAdminDashboardSummary,
  getClaimAssetUrlsForUser,
  getClaimCyclesForUser,
  getFinanceExportDataForUser,
  getAdminPaymentsSummary,
  getClaimByIdForUser,
  getEmployeeClaimsPage,
  getEmployeeDashboardSummary,
} from "../services/claimsService.js";

const claimsRoutes: FastifyPluginAsync = async (fastify) => {
  async function requireAppUser(request: FastifyRequest, reply: FastifyReply) {
    const email = request.authToken?.email?.toLowerCase();
    const user = await getCurrentUserByEmail(email || "");
    if (!user) {
      reply.code(404).send({ error: "USER_NOT_FOUND", message: "Authenticated user not found in Mongo" });
      return null;
    }
    return user;
  }

  fastify.get(
    "/api/v1/claims/employee/summary",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireAppUser(request, reply);
      if (!user) return;

      const summary = await getEmployeeDashboardSummary(user);
      return reply.send(summary);
    }
  );

  fastify.get(
    "/api/v1/claims/employee/page",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireAppUser(request, reply);
      if (!user) return;

      const query = request.query as {
        bucket?: "pending" | "action_required" | "accepted" | "rejected";
        page?: string;
        pageSize?: string;
      };

      const bucket = query.bucket ?? "pending";
      const page = Math.max(1, Number(query.page || "1") || 1);
      const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || "10") || 10));

      const pageData = await getEmployeeClaimsPage(user, {
        bucket,
        page,
        pageSize,
      });

      return reply.send(pageData);
    }
  );

  fastify.get(
    "/api/v1/claims/admin/summary",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireAppUser(request, reply);
      if (!user) return;

      if (!["L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN"].includes(user.role)) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Admin role required" });
      }

      const summary = await getAdminDashboardSummary(user);
      return reply.send(summary);
    }
  );

  fastify.get(
    "/api/v1/claims/admin/page",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireAppUser(request, reply);
      if (!user) return;

      if (!["L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN"].includes(user.role)) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Admin role required" });
      }

      const query = request.query as {
        bucket?: "pending" | "accepted" | "rejected" | "payments";
        searchQuery?: string;
        page?: string;
        pageSize?: string;
        paymentStartDate?: string;
        paymentEndDate?: string;
        paymentModeFilter?: "CASH" | "ACCOUNT_TRANSFER";
      };

      const bucket = query.bucket ?? "pending";
      const page = Math.max(1, Number(query.page || "1") || 1);
      const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || "10") || 10));

      const pageData = await getAdminClaimsPage(user, {
        bucket,
        searchQuery: query.searchQuery,
        page,
        pageSize,
        paymentStartDate: query.paymentStartDate,
        paymentEndDate: query.paymentEndDate,
        paymentModeFilter: query.paymentModeFilter,
      });

      return reply.send(pageData);
    }
  );

  fastify.get(
    "/api/v1/claims/admin/payments-summary",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireAppUser(request, reply);
      if (!user) return;

      if (user.role !== "L4_ADMIN") {
        return reply.code(403).send({ error: "FORBIDDEN", message: "L4 admin role required" });
      }

      const query = request.query as {
        paymentStartDate?: string;
        paymentEndDate?: string;
        paymentModeFilter?: "CASH" | "ACCOUNT_TRANSFER";
      };

      const summary = await getAdminPaymentsSummary(user, {
        paymentStartDate: query.paymentStartDate,
        paymentEndDate: query.paymentEndDate,
        paymentModeFilter: query.paymentModeFilter,
      });
      return reply.send(summary);
    }
  );

  fastify.get(
    "/api/v1/claims/admin/finance-export",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireAppUser(request, reply);
      if (!user) return;
      if (!["L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN"].includes(user.role)) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Admin role required" });
      }

      const query = request.query as {
        paymentStartDate?: string;
        paymentEndDate?: string;
        paymentModeFilter?: "CASH" | "ACCOUNT_TRANSFER";
      };

      return reply.send(
        await getFinanceExportDataForUser(user, {
          paymentStartDate: query.paymentStartDate,
          paymentEndDate: query.paymentEndDate,
          paymentModeFilter: query.paymentModeFilter,
        })
      );
    }
  );

  fastify.get(
    "/api/v1/claims/:claimId",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireAppUser(request, reply);
      if (!user) return;

      const { claimId } = request.params as { claimId: string };
      const claim = await getClaimByIdForUser(user, claimId);

      if (!claim) {
        return reply.code(404).send({ error: "CLAIM_NOT_FOUND", message: "Claim not found" });
      }

      return reply.send(claim);
    }
  );

  fastify.get(
    "/api/v1/claims/:claimId/cycles",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireAppUser(request, reply);
      if (!user) return;
      const { claimId } = request.params as { claimId: string };
      return reply.send(await getClaimCyclesForUser(user, claimId));
    }
  );

  fastify.get(
    "/api/v1/claims/:claimId/assets",
    { preHandler: fastify.requireAuth },
    async (request, reply) => {
      const user = await requireAppUser(request, reply);
      if (!user) return;
      const { claimId } = request.params as { claimId: string };
      const assets = await getClaimAssetUrlsForUser(user, claimId);
      if (!assets) {
        return reply.code(404).send({ error: "CLAIM_NOT_FOUND", message: "Claim not found" });
      }
      return reply.send(assets);
    }
  );
};

export default claimsRoutes;
