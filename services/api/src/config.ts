import { z } from "zod";
export function requireTestKey(key: string) {
  if (!key.startsWith("sk_test_"))
    throw new Error("Stripe test-mode secret key required");
  return key;
}
export function configFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const schema = z.object({
    SUPABASE_URL: z
      .url()
      .refine((value) => new URL(value).protocol === "https:"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    STRIPE_SECRET_KEY: z.string().min(10),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  });
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw new Error("Required backend configuration is missing or invalid");
  requireTestKey(parsed.data.STRIPE_SECRET_KEY);
  return parsed.data;
}
