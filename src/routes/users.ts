import type { FastifyPluginAsync } from "fastify";
import { getCurrentUserByEmail } from "../services/userService.js";
import type { AuthUserResponse } from "../../../shared/contracts/domain.js";
import { UserModel } from "../models/user.js";

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/v1/users", async (request) => {
    const onlyActive =
      String((request.query as { onlyActive?: string }).onlyActive ?? "true").toLowerCase() !== "false";

    const activeUsers = await UserModel.find({ status: "active" }).lean();
    const users = onlyActive
      ? activeUsers.length > 0
        ? activeUsers
        : await UserModel.find({}).lean()
      : await UserModel.find({}).lean();

    return users.map((user) => ({
      _id: user.convexId || String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status || "active",
      verticals: user.verticals || [],
    }));
  });

  fastify.get("/api/v1/users/email-registration", async (request) => {
    const email = String((request.query as { email?: string }).email ?? "")
      .trim()
      .toLowerCase();
    if (!email) {
      return { exists: false, status: null };
    }

    const user = await UserModel.findOne({ email }).lean();
    return {
      exists: Boolean(user),
      status: user ? user.status || "active" : null,
    };
  });

  fastify.get(
    "/api/v1/users/me",
    {
      preHandler: fastify.requireAuth,
    },
    async (request, reply) => {
      const tokenEmail = request.authToken?.email?.toLowerCase();
      const user = await getCurrentUserByEmail(tokenEmail || "");

      const payload: AuthUserResponse = {
        user,
        source: "node",
        fetchedAt: new Date().toISOString(),
      };

      if (!user) {
        return reply.code(404).send(payload);
      }

      return reply.send(payload);
    }
  );
};

export default userRoutes;
