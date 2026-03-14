import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  FRONTEND_ORIGIN: z.string(),
  BACKEND_PUBLIC_ORIGIN: z.string().optional(),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string(),
  GROQ_API_KEY: z.string().min(1),
  PYTHON_ANALYZER_URL: z.string().url(),
  UPLOADS_DIR: z.string(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid backend environment config", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
