import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { getCurrentUserByEmail } from "../services/userService.js";
import {
  getAdminPerformancePage,
  getAllClaimsDetailedPage,
  getClaimsOverview,
  getClaimsTimeSeries,
  getEmployeeStatistics,
  getEmployeeStatisticsPage,
  getPaymentBifurcationSummary,
  getUserDetailedActivityPage,
  getUserDetailedClaimsPage,
  getUserDetailedStats,
} from "../services/analyticsService.js";

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  async function requireAnalyticsUser(request: FastifyRequest, reply: FastifyReply) {
    const email = request.authToken?.email?.toLowerCase();
    const user = await getCurrentUserByEmail(email || "");
    if (!user) {
      reply.code(404).send({ error: "USER_NOT_FOUND" });
      return null;
    }
    if (!["L3_ADMIN", "ROLE_MANAGER"].includes(user.role)) {
      reply.code(403).send({ error: "FORBIDDEN", message: "Analytics role required" });
      return null;
    }
    return user;
  }

  fastify.get("/api/v1/analytics/overview", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireAnalyticsUser(request, reply);
    if (!user) return;
    const query = request.query as { startDate?: string; endDate?: string };
    return reply.send(await getClaimsOverview(query));
  });

  fastify.get("/api/v1/analytics/time-series", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireAnalyticsUser(request, reply);
    if (!user) return;
    const query = request.query as { startDate?: string; endDate?: string };
    return reply.send(await getClaimsTimeSeries(query));
  });

  fastify.get("/api/v1/analytics/employee-stats", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireAnalyticsUser(request, reply);
    if (!user) return;
    const query = request.query as { startDate?: string; endDate?: string };
    return reply.send(await getEmployeeStatistics(query));
  });

  fastify.get("/api/v1/analytics/employee-stats/page", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireAnalyticsUser(request, reply);
    if (!user) return;
    const query = request.query as { startDate?: string; endDate?: string; page?: string; pageSize?: string };
    return reply.send(
      await getEmployeeStatisticsPage({
        startDate: query.startDate,
        endDate: query.endDate,
        page: Math.max(1, Number(query.page || "1") || 1),
        pageSize: Math.min(100, Math.max(1, Number(query.pageSize || "10") || 10)),
      })
    );
  });

  fastify.get("/api/v1/analytics/admin-performance/page", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireAnalyticsUser(request, reply);
    if (!user) return;
    const query = request.query as { startDate?: string; endDate?: string; page?: string; pageSize?: string };
    return reply.send(
      await getAdminPerformancePage({
        startDate: query.startDate,
        endDate: query.endDate,
        page: Math.max(1, Number(query.page || "1") || 1),
        pageSize: Math.min(100, Math.max(1, Number(query.pageSize || "10") || 10)),
      })
    );
  });

  fastify.get("/api/v1/analytics/payment-bifurcation", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireAnalyticsUser(request, reply);
    if (!user) return;
    const query = request.query as {
      startDate?: string;
      endDate?: string;
      companyVertical?: string;
      paymentType?: "CAPEX" | "OPEX";
    };
    return reply.send(await getPaymentBifurcationSummary(query));
  });

  fastify.get("/api/v1/analytics/all-claims/page", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireAnalyticsUser(request, reply);
    if (!user) return;

    const query = request.query as {
      startDate?: string;
      endDate?: string;
      statusFilter?: string;
      searchQuery?: string;
      sortField?: "userName" | "title" | "amount" | "date";
      sortOrder?: "asc" | "desc";
      cycleNumber?: string;
      page?: string;
      pageSize?: string;
    };

    return reply.send(
      await getAllClaimsDetailedPage({
        startDate: query.startDate,
        endDate: query.endDate,
        statusFilter: query.statusFilter,
        searchQuery: query.searchQuery,
        sortField: query.sortField,
        sortOrder: query.sortOrder,
        cycleNumber: query.cycleNumber ? Number(query.cycleNumber) : undefined,
        page: Math.max(1, Number(query.page || "1") || 1),
        pageSize: Math.min(100, Math.max(1, Number(query.pageSize || "10") || 10)),
      })
    );
  });

  fastify.get("/api/v1/analytics/users/:userId/stats", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireAnalyticsUser(request, reply);
    if (!user) return;
    const { userId } = request.params as { userId: string };
    const query = request.query as { startDate?: string; endDate?: string };
    const stats = await getUserDetailedStats({ userId, startDate: query.startDate, endDate: query.endDate });
    if (!stats) return reply.code(404).send({ error: "USER_NOT_FOUND" });
    return reply.send(stats);
  });

  fastify.get("/api/v1/analytics/users/:userId/claims", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireAnalyticsUser(request, reply);
    if (!user) return;
    const { userId } = request.params as { userId: string };
    const query = request.query as { startDate?: string; endDate?: string; page?: string; pageSize?: string };
    return reply.send(
      await getUserDetailedClaimsPage({
        userId,
        startDate: query.startDate,
        endDate: query.endDate,
        page: Math.max(1, Number(query.page || "1") || 1),
        pageSize: Math.min(100, Math.max(1, Number(query.pageSize || "10") || 10)),
      })
    );
  });

  fastify.get("/api/v1/analytics/users/:userId/activity", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireAnalyticsUser(request, reply);
    if (!user) return;
    const { userId } = request.params as { userId: string };
    const query = request.query as { startDate?: string; endDate?: string; page?: string; pageSize?: string };
    return reply.send(
      await getUserDetailedActivityPage({
        userId,
        startDate: query.startDate,
        endDate: query.endDate,
        page: Math.max(1, Number(query.page || "1") || 1),
        pageSize: Math.min(100, Math.max(1, Number(query.pageSize || "10") || 10)),
      })
    );
  });
};

export default analyticsRoutes;
