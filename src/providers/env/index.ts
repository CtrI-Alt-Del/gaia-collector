import { envSchema } from "@/schemas/env-schema";
import "dotenv/config"; 

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsedEnv.error.format() 
  );
  process.exit(1);
}

export const env = parsedEnv.data;
