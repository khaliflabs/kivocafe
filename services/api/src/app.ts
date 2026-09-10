import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import Stripe from "stripe";
import { z } from "zod";
import { ApiError, orderId, orderInput, type Order } from "./domain.ts";
import { loggerOptions } from "./logging.ts";
import type { Repository } from "./repository.ts";
export interface Dependencies {
  repository: Repository;
  stripe: Stripe;
  webhookSecret?: string;
  logging?: boolean;
}
export function buildApp({
  repository: repo,
  stripe,
  webhookSecret,
  logging = false,
}: Dependencies) {
  const app = Fastify({
    logger: logging ? loggerOptions : false,
    disableRequestLogging: true,
    bodyLimit: 64 * 1024,
    trustProxy: false,
  });
  void app.register(rateLimit, { max: 90, timeWindow: "1 minute" });
  app.setNotFoundHandler((_req, reply) =>
    reply
      .code(404)
      .send({ error: { code: "NOT_FOUND", message: "Not found." } }),
  );
  app.setErrorHandler((err, req, reply) => {
    const error = err as { code?: string; statusCode?: number };
    const invalid =
      err instanceof z.ZodError || error.code?.startsWith("FST_ERR_CTP");
    const status =
      err instanceof ApiError
        ? err.status
        : invalid
          ? 400
          : error.statusCode === 429
            ? 429
            : 500;
    const code =
      err instanceof ApiError
        ? err.code
        : invalid
          ? "INVALID_REQUEST"
          : status === 429
            ? "RATE_LIMITED"
            : "INTERNAL_ERROR";
    req.log.warn({ code }, "Request rejected");
    reply
      .code(status)
      .send({
        error: {
          code,
          message:
            status >= 500
              ? "Service temporarily unavailable."
              : "Unable to complete this request.",
        },
      });
  });
  app.get("/health", async () => ({ status: "ok", service: "kivo-api" }));
  void app.register(async (webhook) => {
    webhook.removeContentTypeParser("application/json");
    webhook.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_req, body, done) => done(null, body),
    );
    webhook.post("/webhooks/stripe", async (req, reply) => {
      if (!webhookSecret) throw new ApiError(503, "WEBHOOK_NOT_CONFIGURED");
      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string")
        throw new ApiError(400, "INVALID_SIGNATURE");
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          signature,
          webhookSecret,
        );
      } catch {
        throw new ApiError(400, "INVALID_SIGNATURE");
      }
      if (event.livemode) throw new ApiError(400, "LIVE_EVENT_REJECTED");
      if (
        ![
          "payment_intent.succeeded",
          "payment_intent.payment_failed",
          "payment_intent.canceled",
        ].includes(event.type)
      )
        return { received: true };
      const intent = event.data.object as Stripe.PaymentIntent;
      if (
        intent.livemode ||
        !orderId.safeParse(intent.metadata.kivo_order_id).success ||
        !orderId.safeParse(intent.metadata.user_id).success
      )
        throw new ApiError(400, "PAYMENT_MISMATCH");
      if (
        event.type === "payment_intent.succeeded" &&
        (intent.status !== "succeeded" ||
          intent.amount_received !== intent.amount)
      )
        throw new ApiError(400, "PAYMENT_MISMATCH");
      await repo.event({
        id: event.id,
        type: event.type,
        intent: intent.id,
        order: intent.metadata.kivo_order_id,
        user: intent.metadata.user_id,
        amount: intent.amount,
        currency: intent.currency,
      });
      return reply.send({ received: true });
    });
  });
  void app.register(async (orders) => {
    orders.decorateRequest("customerId", "");
    orders.addHook("preHandler", async (req) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer ") || auth.length > 8192)
        throw new ApiError(401, "AUTH_REQUIRED");
      const user = await repo.authenticate(auth.slice(7));
      if (!user) throw new ApiError(401, "AUTH_REQUIRED");
      req.customerId = user;
    });
    const owned = async (user: string, id: string) => {
      const order = await repo.get(user, orderId.parse(id));
      if (!order || order.user_id !== user)
        throw new ApiError(404, "ORDER_NOT_FOUND");
      return order;
    };
    orders.post("/orders", async (req, reply) => {
      const basket = orderInput.parse(req.body);
      const id = await repo.create(req.customerId, basket);
      return reply.code(201).send({ order: await owned(req.customerId, id) });
    });
    orders.get("/orders", async (req) => ({
      orders: await repo.list(req.customerId),
    }));
    orders.get<{ Params: { id: string } }>("/orders/:id", async (req) => ({
      order: await owned(req.customerId, req.params.id),
    }));
    orders.post<{ Params: { id: string } }>(
      "/orders/:id/cancel",
      async (req) => {
        z.object({})
          .strict()
          .parse(req.body ?? {});
        const order = await owned(req.customerId, req.params.id);
        if (order.status === "draft" || order.status === "cancelled")
          await repo.cancel(req.customerId, order.id);
        else if (["payment_pending", "payment_failed"].includes(order.status)) {
          const id = await repo.payment(order.id);
          if (!id || !webhookSecret)
            throw new ApiError(409, "ORDER_NOT_CANCELLABLE");
          try {
            await stripe.paymentIntents.cancel(
              id,
              {},
              { idempotencyKey: `kivo-cancel-${order.id}-v1` },
            );
          } catch {
            throw new ApiError(409, "ORDER_NOT_CANCELLABLE");
          }
        } else throw new ApiError(409, "ORDER_NOT_CANCELLABLE");
        return { order: await owned(req.customerId, order.id) };
      },
    );
    orders.post<{ Params: { id: string } }>(
      "/orders/:id/payment-intent",
      async (req, reply) => {
        z.object({})
          .strict()
          .parse(req.body ?? {});
        await owned(req.customerId, req.params.id);
        if (!webhookSecret) throw new ApiError(503, "PAYMENTS_NOT_READY");
        const order = await repo.prepare(req.customerId, req.params.id);
        const existing = await repo.payment(order.id);
        let intent: Stripe.PaymentIntent;
        try {
          if (existing) intent = await stripe.paymentIntents.retrieve(existing);
          else
            intent = await stripe.paymentIntents.create(
              {
                amount: order.total_pence,
                currency: "gbp",
                payment_method_types: ["card"],
                metadata: { kivo_order_id: order.id, user_id: req.customerId },
              },
              { idempotencyKey: `kivo-order-${order.id}-payment-v1` },
            );
        } catch {
          throw new ApiError(502, "PAYMENT_INITIALIZATION_FAILED");
        }
        validateIntent(intent, order);
        await repo.record(
          req.customerId,
          order.id,
          intent.id,
          order.total_pence,
        );
        reply.header("Cache-Control", "no-store");
        return {
          paymentIntentClientSecret: intent.client_secret,
          orderId: order.id,
          amountPence: order.total_pence,
          currency: "gbp",
        };
      },
    );
  });
  return app;
}
export function validateIntent(intent: Stripe.PaymentIntent, order: Order) {
  if (
    intent.livemode ||
    intent.amount !== order.total_pence ||
    intent.currency !== "gbp" ||
    intent.metadata.kivo_order_id !== order.id ||
    intent.metadata.user_id !== order.user_id ||
    !intent.client_secret ||
    ![
      "requires_payment_method",
      "requires_confirmation",
      "requires_action",
      "processing",
    ].includes(intent.status)
  )
    throw new ApiError(409, "PAYMENT_MISMATCH");
}
declare module "fastify" {
  interface FastifyRequest {
    customerId: string;
  }
}
