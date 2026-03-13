import type { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => {
    return {
      ok: true,
      service: "expenseclaim-node-backend",
      timestamp: new Date().toISOString(),
    };
  });
};

export default healthRoutes;
