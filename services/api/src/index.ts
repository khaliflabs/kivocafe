import Stripe from "stripe";
import { configFromEnv } from "./config.ts";
import { buildApp } from "./app.ts";
import { createRepository } from "./repository.ts";
try {
  const config = configFromEnv();
  const app = buildApp({
    repository: createRepository(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
    ),
    stripe: new Stripe(config.STRIPE_SECRET_KEY),
    webhookSecret: config.STRIPE_WEBHOOK_SECRET,
    logging: true,
  });
  await app.listen({ port: config.PORT, host: "127.0.0.1" });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      void app.close();
    });
} catch {
  console.error(
    "KIVO API startup failed: check required server configuration and port.",
  );
  process.exitCode = 1;
}
