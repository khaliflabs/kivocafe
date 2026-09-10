import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Never forward a raw CLI line, even when it does not match a known secret pattern.
export function safeListenerLine(line, expectedSecret) {
  const secret = line.match(/whsec_[A-Za-z0-9]+/)?.[0];
  if (secret) {
    if (secret !== expectedSecret)
      throw new Error("Listener signing secret does not match Doppler");
    return "Listener signing secret match: PASS";
  }
  const event = line.match(/\b(evt_[A-Za-z0-9]+)\b/)?.[0];
  const status = line.match(/\[(\d{3})\]/)?.[1];
  const type = line.match(
    /\bpayment_intent\.(succeeded|payment_failed|canceled)\b/,
  )?.[0];
  if (event && status) return `Stripe delivery: event=${event} HTTP=${status}`;
  if (event && type) return `Stripe event: ${type} ${event}`;
  return undefined;
}

export function startLocalRuntime(mode) {
  if (!["api", "listener"].includes(mode))
    throw new Error("Choose api or listener");
  if (
    process.env.DOPPLER_PROJECT !== "kivo" ||
    process.env.DOPPLER_CONFIG !== "stg"
  )
    throw new Error("Doppler kivo/stg required");
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"))
    throw new Error("Stripe test key required");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret?.startsWith("whsec_"))
    throw new Error("Existing webhook secret required");
  const owner = statSync(new URL("../package.json", import.meta.url));
  const env = {
    PATH: process.env.PATH,
    HOME: process.getuid?.() === 0 ? "/home/kivo" : process.env.HOME,
    NODE_ENV: "development",
  };
  if (mode === "api")
    for (const name of [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ]) {
      if (!process.env[name])
        throw new Error("Required API configuration absent");
      env[name] = process.env[name];
    }
  else env.STRIPE_API_KEY = process.env.STRIPE_SECRET_KEY;
  const command = mode === "api" ? "npm" : "stripe";
  const args =
    mode === "api"
      ? ["run", "dev"]
      : [
          "listen",
          "--device-name",
          "kivo-tools-stg",
          "--skip-update",
          "--events",
          "payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled",
          "--forward-to",
          "http://127.0.0.1:3001/webhooks/stripe",
        ];
  const child = spawn(command, args, {
    cwd: new URL("../", import.meta.url),
    env,
    ...(process.getuid?.() === 0 ? { uid: owner.uid, gid: owner.gid } : {}),
    stdio: mode === "api" ? "inherit" : ["ignore", "pipe", "pipe"],
  });
  let mismatch = false;
  if (mode === "listener")
    for (const stream of [child.stdout, child.stderr]) {
      const reader = createInterface({ input: stream });
      reader.on("line", (line) => {
        try {
          const safe = safeListenerLine(line, secret);
          if (safe) console.log(safe);
        } catch {
          mismatch = true;
          console.error(
            "Listener secret mismatch: STOPPED. Existing Doppler secret was not changed.",
          );
          child.kill("SIGTERM");
        }
      });
    }
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => child.kill(signal));
  child.on("error", () => {
    console.error("Local process could not start; check installed tooling.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    console.log(`KIVO ${mode} stopped (exit ${code ?? "signal"}).`);
    process.exitCode = mismatch ? 1 : (code ?? 1);
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    startLocalRuntime(process.argv[2]);
  } catch {
    console.error(
      "Local runtime configuration rejected. No secret values printed.",
    );
    process.exitCode = 1;
  }
}
