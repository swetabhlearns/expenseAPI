import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { resolveAllowedOrigins } from "./config/env.js";
import mongodbPlugin from "./plugins/mongodb.js";
import firebasePlugin from "./plugins/firebase.js";
import authGuardPlugin from "./plugins/authGuard.js";
import healthRoutes from "./routes/health.js";
import userRoutes from "./routes/users.js";
import claimsRoutes from "./routes/claims.js";
import claimsMirrorRoutes from "./routes/claimsMirror.js";
import claimsCommandsRoutes from "./routes/claimsCommands.js";
import analyticsRoutes from "./routes/analytics.js";
import adminUsersRoutes from "./routes/adminUsers.js";
import pushRoutes from "./routes/push.js";
import releaseRoutes from "./routes/release.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });
  const allowedOrigins = resolveAllowedOrigins();

  void app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      try {
        const parsed = new URL(origin);
        const isLocalDev = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
        callback(null, isLocalDev);
      } catch {
        callback(null, false);
      }
    },
    credentials: true,
  });

  void app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });

  void app.register(firebasePlugin);
  void app.register(authGuardPlugin);
  void app.register(mongodbPlugin);

  void app.register(healthRoutes);
  void app.register(userRoutes);
  void app.register(claimsRoutes);
  void app.register(claimsMirrorRoutes);
  void app.register(claimsCommandsRoutes);
  void app.register(analyticsRoutes);
  void app.register(adminUsersRoutes);
  void app.register(pushRoutes);
  void app.register(releaseRoutes);

  return app;
}
