import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  assignRoleForRoleManagement,
  createUserForRoleManagement,
  deleteUserForRoleManagement,
  listAllUsersForRoleManagement,
} from "../services/roleManagementService.js";
import { getCurrentUserByEmail } from "../services/userService.js";

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["USER", "L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN", "ROLE_MANAGER"]),
  verticals: z.array(z.string()).optional(),
});

const AssignRoleSchema = z.object({
  userEmail: z.string().email(),
  newRole: z.enum(["USER", "L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN", "ROLE_MANAGER"]),
  verticals: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

const adminUsersRoutes: FastifyPluginAsync = async (fastify) => {
  async function requireRoleManager(request: FastifyRequest, reply: FastifyReply) {
    const email = request.authToken?.email?.toLowerCase();
    const user = await getCurrentUserByEmail(email || "");
    if (!user) {
      reply.code(404).send({ error: "USER_NOT_FOUND" });
      return null;
    }
    if (!["ROLE_MANAGER", "L3_ADMIN"].includes(user.role)) {
      reply.code(403).send({ error: "FORBIDDEN" });
      return null;
    }
    return user;
  }

  fastify.get("/api/v1/admin/users", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const actor = await requireRoleManager(request, reply);
    if (!actor) return;

    const query = request.query as {
      searchQuery?: string;
      roleFilter?: string;
      statusFilter?: string;
      verticalFilter?: string;
      page?: string;
      pageSize?: string;
    };

    return reply.send(
      await listAllUsersForRoleManagement({
        actor,
        searchQuery: query.searchQuery,
        roleFilter: query.roleFilter,
        statusFilter: query.statusFilter,
        verticalFilter: query.verticalFilter,
        page: Math.max(1, Number(query.page || "1") || 1),
        pageSize: Math.min(100, Math.max(1, Number(query.pageSize || "10") || 10)),
      })
    );
  });

  fastify.post("/api/v1/admin/users", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const actor = await requireRoleManager(request, reply);
    if (!actor) return;

    const payload = CreateUserSchema.parse(request.body);
    return reply.send(await createUserForRoleManagement({ actor, ...payload }));
  });

  fastify.patch("/api/v1/admin/users/role", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const actor = await requireRoleManager(request, reply);
    if (!actor) return;

    const payload = AssignRoleSchema.parse(request.body);
    return reply.send(await assignRoleForRoleManagement({ actor, ...payload }));
  });

  fastify.delete("/api/v1/admin/users/:userEmail", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const actor = await requireRoleManager(request, reply);
    if (!actor) return;

    const { userEmail } = request.params as { userEmail: string };
    return reply.send(await deleteUserForRoleManagement({ actor, userEmail }));
  });
};

export default adminUsersRoutes;
