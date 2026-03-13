import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const candidateEnvPaths = [
  process.env.BACKEND_ENV_FILE,
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "backend/.env"),
].filter(Boolean) as string[];

for (const envPath of candidateEnvPaths) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
    break;
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  BACKEND_RELEASE_VERSION: z.string().default("dev"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().min(1).default("expenseclaim"),
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_WEB_API_KEY: z.string().min(1, "FIREBASE_WEB_API_KEY is required"),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, "FIREBASE_CLIENT_EMAIL is required"),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is required"),
  R2_PUBLIC_URL: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export const env: AppEnv = EnvSchema.parse(process.env);

export function resolveAllowedOrigins(raw = env.CORS_ORIGINS): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
