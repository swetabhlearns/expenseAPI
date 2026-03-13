import fp from "fastify-plugin";
import admin from "firebase-admin";
import type { FastifyPluginAsync } from "fastify";
import { env } from "../config/env.js";

let initialized = false;

const firebasePlugin: FastifyPluginAsync = async () => {
  if (initialized) return;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });

  initialized = true;
};

export function getFirebaseAuth() {
  return admin.auth();
}

export default fp(firebasePlugin, { name: "firebase" });
