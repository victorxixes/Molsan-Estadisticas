import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(10000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.issues.map(i => i.path.join(".")).join(", ")}`);
}

export const env = parsed.data;