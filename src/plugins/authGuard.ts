import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getFirebaseAuth } from "./firebase.js";
import { env } from "../config/env.js";

function decodeTokenProjectId(token: string): string | null {
  try {
    const [, payloadPart] = token.split(".");
    if (!payloadPart) return null;
    const payloadJson = Buffer.from(payloadPart, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as { aud?: string; iss?: string };
    return payload.aud || payload.iss?.split("/").pop() || null;
  } catch {
    return null;
  }
}

const authGuardPlugin: FastifyPluginAsync = async (fastify) => {
  const requireAuth: FastifyInstance["requireAuth"] = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const demoEmailHeader = request.headers["x-demo-email"];
      const demoEmail = typeof demoEmailHeader === "string" ? demoEmailHeader.trim().toLowerCase() : "";
      if (env.NODE_ENV === "development" && demoEmail) {
        request.authToken = { email: demoEmail } as any;
        return;
      }
      reply.code(401).send({
        error: "UNAUTHENTICATED",
        message: "Missing bearer token",
      });
      return;
    }

    const token = authHeader.slice("Bearer ".length).trim();
    try {
      request.authToken = await getFirebaseAuth().verifyIdToken(token, true);
    } catch (error) {
      request.log.warn({ err: error }, "Token verification failed");
      const tokenProjectId = decodeTokenProjectId(token);
      const expectedProjectId = env.FIREBASE_PROJECT_ID;
      if (tokenProjectId && tokenProjectId !== expectedProjectId) {
        reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "Token project mismatch",
          details: {
            tokenProjectId,
            expectedProjectId,
          },
        });
        return;
      }
      reply.code(401).send({
        error: "UNAUTHENTICATED",
        message: "Invalid token",
      });
    }
  };

  fastify.decorate("requireAuth", requireAuth);
};

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(authGuardPlugin, { name: "auth-guard", dependencies: ["firebase"] });
