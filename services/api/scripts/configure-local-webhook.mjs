import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
// HUMAN-RUN ONLY. This milestone does not execute this script or activate webhooks.
export function configureLocalWebhook(run = execFileSync) {
  const options = {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 30000,
  };
  const names = JSON.parse(
    run(
      "doppler",
      [
        "secrets",
        "--only-names",
        "--json",
        "--project",
        "kivo",
        "--config",
        "stg",
      ],
      options,
    ),
  );
  if (Object.hasOwn(names, "STRIPE_WEBHOOK_SECRET"))
    throw new Error(
      "A signing secret already exists; refusing to overwrite it",
    );
  const key = run(
    "doppler",
    [
      "secrets",
      "get",
      "STRIPE_SECRET_KEY",
      "--plain",
      "--project",
      "kivo",
      "--config",
      "stg",
    ],
    options,
  ).trim();
  if (!key.startsWith("sk_test_")) throw new Error("Test key required");
  const secret = run(
    "stripe",
    [
      "listen",
      "--print-secret",
      "--skip-update",
      "--device-name",
      "kivo-tools-stg",
    ],
    {
      ...options,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        STRIPE_API_KEY: key,
      },
    },
  ).trim();
  if (!/^whsec_[A-Za-z0-9]+$/.test(secret))
    throw new Error("Stripe did not return a valid signing secret");
  // Secret goes only through stdin. Neither subprocess output nor stderr is echoed.
  run(
    "doppler",
    [
      "secrets",
      "set",
      "STRIPE_WEBHOOK_SECRET",
      "--project",
      "kivo",
      "--config",
      "stg",
      "--no-interactive",
      "--silent",
    ],
    { ...options, input: secret },
  );
  const after = JSON.parse(
    run(
      "doppler",
      [
        "secrets",
        "--only-names",
        "--json",
        "--project",
        "kivo",
        "--config",
        "stg",
      ],
      options,
    ),
  );
  if (!Object.hasOwn(after, "STRIPE_WEBHOOK_SECRET"))
    throw new Error("Secret name not confirmed");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    configureLocalWebhook();
    console.log(
      "Real Stripe CLI signing secret stored in Doppler kivo/stg. No value printed. Listener/API activation is a separate step.",
    );
  } catch {
    console.error(
      "Webhook setup stopped. Check Doppler/Stripe permissions, CLI installation, or whether the secret already exists. No credentials were printed.",
    );
    process.exitCode = 1;
  }
}
