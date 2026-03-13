import type { FastifyPluginAsync } from "fastify";
import { env } from "../config/env.js";

const releaseRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/v1/release/info", async (_request, reply) => {
    return reply.send({
      backendVersion: env.BACKEND_RELEASE_VERSION || "dev",
    });
  });
};

export default releaseRoutes;
