import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { deactivatePushSubscription, getMyPushStatus, upsertPushSubscription } from "../services/pushService.js";
import { getCurrentUserByEmail } from "../services/userService.js";

const UpsertSchema = z.object({
  endpoint: z.string().min(1),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional(),
  platform: z.string().optional(),
});

const DeactivateSchema = z.object({
  endpoint: z.string().min(1),
});

const pushRoutes: FastifyPluginAsync = async (fastify) => {
  async function requireUser(request: FastifyRequest, reply: FastifyReply) {
    const email = request.authToken?.email?.toLowerCase();
    const user = await getCurrentUserByEmail(email || "");
    if (!user) {
      reply.code(404).send({ error: "USER_NOT_FOUND" });
      return null;
    }
    return user;
  }

  fastify.get("/api/v1/push/status", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    return reply.send(await getMyPushStatus(user.id));
  });

  fastify.post("/api/v1/push/subscription", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const payload = UpsertSchema.parse(request.body);
    return reply.send(await upsertPushSubscription({ userId: user.id, ...payload }));
  });

  fastify.post("/api/v1/push/deactivate", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const payload = DeactivateSchema.parse(request.body);
    return reply.send(await deactivatePushSubscription({ userId: user.id, ...payload }));
  });
};

export default pushRoutes;
