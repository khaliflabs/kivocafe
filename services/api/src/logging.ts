const sensitive =
  /^(authorization|cookie|password|access[_-]?token|refresh[_-]?token|jwt|client[_-]?secret|stripe[_-]?signature|stripe[_-]?secret[_-]?key|supabase[_-]?service[_-]?role[_-]?key|.*db[_-]?password|card[_-]?number|pan|cvc|cvv|pin|track[_-]?data)$/i;
export function redact(value: unknown): unknown {
  if (typeof value === "string")
    return value.replace(
      /(?:sk_(?:test|live)_|whsec_|dp\.st\.|Bearer\s+)[A-Za-z0-9._-]+|pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+/g,
      "[REDACTED]",
    );
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitive.test(key) ? "[REDACTED]" : redact(item),
      ]),
    );
  return value;
}
// Allowlisted logs: no request bodies, headers, URLs, sessions or Stripe object serialization.
export const loggerOptions = {
  level: "info",
  serializers: {
    req: (req: { method?: string }) => ({ method: req.method }),
    res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
    err: () => ({
      type: "Error",
      message: "Internal operation failed",
      stack: "",
    }),
  },
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.body",
    "res.body",
    "client_secret",
    "password",
  ],
};
