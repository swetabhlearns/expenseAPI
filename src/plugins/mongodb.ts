import fp from "fastify-plugin";
import mongoose from "mongoose";
import type { FastifyPluginAsync } from "fastify";
import { env } from "../config/env.js";

const mongodbPlugin: FastifyPluginAsync = async (fastify) => {
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
  });

  fastify.log.info({ dbName: env.MONGODB_DB_NAME }, "MongoDB connected");

  fastify.addHook("onClose", async () => {
    await mongoose.disconnect();
  });
};

export default fp(mongodbPlugin, { name: "mongodb" });
