import { execFileSync, spawn } from "node:child_process";
import { Buffer } from 'node:buffer';
// Operator-authenticated Doppler is used only locally. Never inject its full environment into Metro.
const publicNames = {
  SUPABASE_URL: "EXPO_PUBLIC_SUPABASE_URL",
  SUPABASE_PUBLISHABLE_KEY: "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  STRIPE_PUBLISHABLE_KEY: "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY",
};
const env = Object.fromEntries(
  ["PATH", "HOME", "USER", "SHELL", "LANG", "TERM", "TMPDIR"].flatMap((k) =>
    process.env[k] ? [[k, process.env[k]]] : [],
  ),
);
try {
  for (const [source, target] of Object.entries(publicNames))
    env[target] = execFileSync(
      "doppler",
      [
        "secrets",
        "get",
        source,
        "--plain",
        "--project",
        "kivo",
        "--config",
        "stg",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  if (!env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith("pk_test_"))
    throw new Error("Test key required");
  const publicKey = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const safeKey =
    publicKey.startsWith("sb_publishable_") ||
    (publicKey.split(".").length === 3 &&
      JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString())
        .role === "anon");
  if (!safeKey) throw new Error("Supabase client key must be publishable/anon");
  if (process.env.EXPO_PUBLIC_API_URL)
    env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL;
  env.EXPO_UNSTABLE_HEADLESS = "1";
  const child = spawn(
    "npx",
    ["--no-install", "expo", "start", "--go", "--tunnel"],
    { env, stdio: "inherit" },
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} catch {
  console.error(
    "Public preview configuration unavailable. Authenticate Doppler for the current operator; no secret values were printed.",
  );
  process.exitCode = 1;
}
