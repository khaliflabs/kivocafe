import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import { Text, View } from "react-native";
import { BrandDivider } from "@/components/brand/BrandDivider";
import { KivoButton } from "@/components/ui/KivoButton";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { useMenuCart } from "@/src/menu/MenuCart";
import { formatGBP, getProduct } from "@/src/menu/menuLogic";
import { useAuth } from "@/src/backend/AuthProvider";
import { api } from "@/src/backend/client";
import {
  cartPence,
  paidStatuses,
  parseOrder,
  serializeCheckout,
  type OrderDTO,
} from "@/src/backend/contracts";
import {
  nativePaymentAvailable,
  stripeSDK,
} from "@/src/backend/PaymentProvider";
import { typography } from "@/src/theme/typography";
export default function CheckoutScreen() {
  const cart = useMenuCart();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [requestId] = useState(() => Crypto.randomUUID());
  const active = useRef(true);
  const operation = useRef(false);
  const polls = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (params.orderId && session)
      void api<{ order: unknown }>(`/orders/${params.orderId}`)
        .then((r) => setOrder(parseOrder(r.order)))
        .catch(() => setMessage("Unable to load this order."));
  }, [params.orderId, session]);
  useEffect(() => {
    if (!processing || !order) return;
    let stopped = false;
    const timer = setInterval(() => {
      if (++polls.current > 20) {
        clearInterval(timer);
        setProcessing(false);
        setMessage(
          "Confirmation is still pending. Check Orders before trying another payment.",
        );
        return;
      }
      void api<{ order: unknown }>(`/orders/${order.id}`)
        .then((r) => {
          if (stopped) return;
          const next = parseOrder(r.order);
          setOrder(next);
          if (paidStatuses.includes(next.status)) {
            setProcessing(false);
            setMessage("Payment confirmed by KIVO. Find your order in Orders.");
            if (!params.orderId) cart.clear();
          } else if (["payment_failed", "cancelled"].includes(next.status)) {
            setProcessing(false);
            setMessage("Payment was not completed.");
          }
        })
        .catch(() => {});
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [processing, order, params.orderId, cart]);
  async function quote() {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setMessage("");
    try {
      const body = serializeCheckout(cart.lines, requestId);
      const result = await api<{ order: unknown }>("/orders", body);
      setOrder(parseOrder(result.order));
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to prepare your order.",
      );
    } finally {
      setBusy(false);
      operation.current = false;
    }
  }
  async function pay() {
    if (!order || !stripeSDK || operation.current) return;
    operation.current = true;
    setBusy(true);
    setMessage("");
    try {
      const intent = await api<{
        paymentIntentClientSecret: string;
        amountPence: number;
      }>(`/orders/${order.id}/payment-intent`, {});
      if (intent.amountPence !== order.total_pence)
        throw new Error(
          "Your total changed. Refresh this order before paying.",
        );
      const initialized = await stripeSDK.initPaymentSheet({
        merchantDisplayName: "KIVO Café",
        paymentIntentClientSecret: intent.paymentIntentClientSecret,
        returnURL: Linking.createURL("checkout",{queryParams:{orderId:order.id}}),
        allowsDelayedPaymentMethods: false,
      });
      if (initialized.error)
        throw new Error("Secure payment could not be opened.");
      const result = await stripeSDK.presentPaymentSheet();
      if (result.error) {
        setMessage(
          result.error.code === "Canceled"
            ? "Payment cancelled. Your order has not been marked paid."
            : "Payment could not be completed. Check Orders before retrying.",
        );
      } else {
        polls.current = 0;
        setMessage("Payment processing — awaiting secure server confirmation.");
        setProcessing(true);
      }
    } catch (e) {
      if (active.current)
        setMessage(e instanceof Error ? e.message : "Unable to start payment.");
    } finally {
      if (active.current) setBusy(false);
      operation.current = false;
    }
  }
  const paid = order && paidStatuses.includes(order.status);
  return (
    <ScreenContainer scroll>
      <View style={{ gap: 20, paddingBottom: 64 }}>
        <KivoButton
          label="BACK TO CART"
          variant="secondary"
          onPress={() => router.replace("/cart")}
        />
        <Text style={typography.pageTitle}>Checkout</Text>
        <Text style={typography.caption}>TEST PAYMENTS ONLY</Text>
        <BrandDivider botanical />
        <Text style={typography.sectionTitle}>Order summary</Text>
        {order
          ? order.order_items?.map((i) => (
              <Text key={i.id} style={typography.body}>
                {i.quantity} × {i.name} {i.variant_name} —{" "}
                {formatGBP(i.line_total_pence / 100)}
              </Text>
            ))
          : cart.lines.map((l) => (
              <Text
                key={`${l.productId}:${l.variantId}`}
                style={typography.body}
              >
                {l.quantity} × {getProduct(l.productId)?.name}{" "}
                {
                  getProduct(l.productId)?.variants?.find(
                    (v) => v.id === l.variantId,
                  )?.name
                }
              </Text>
            ))}
        <Text style={typography.body}>Pickup at KIVO</Text>
        <Text style={typography.sectionTitle}>
          {order ? "Total" : "Estimated total"}{" "}
          {formatGBP((order?.total_pence ?? cartPence(cart.lines)) / 100)}
        </Text>
        <Text style={typography.body}>
          {order
            ? "Prices confirmed by KIVO."
            : "The server will confirm your prices before payment."}
        </Text>
        {!session ? (
          <KivoButton
            label="SIGN IN TO CONTINUE"
            onPress={() => router.push("/auth")}
          />
        ) : !order ? (
          <KivoButton
            label={busy ? "CHECKING PRICES…" : "CONFIRM ORDER TOTAL"}
            disabled={busy || !cart.lines.length}
            onPress={() => void quote()}
          />
        ) : (
          <KivoButton
            label={
              paid
                ? "PAYMENT CONFIRMED"
                : processing
                  ? "AWAITING CONFIRMATION"
                  : busy
                    ? "PLEASE WAIT…"
                    : `PAY ${formatGBP(order.total_pence / 100)}`
            }
            disabled={
              busy ||
              processing ||
              !!paid ||
              !nativePaymentAvailable ||
              order.status === "cancelled"
            }
            onPress={() => void pay()}
          />
        )}
        {!nativePaymentAvailable && (
          <Text style={typography.caption}>
            Secure PaymentSheet is unavailable in this preview or its public
            test key is not configured. Menu and cart still work. A compatible
            native build can be used for payment testing; Apple signing is
            deferred.
          </Text>
        )}
        {!!message && (
          <Text accessibilityRole="alert" style={typography.body}>
            {message}
          </Text>
        )}
        <KivoButton
          label="VIEW ORDERS"
          variant="secondary"
          onPress={() => router.replace("/(tabs)/orders")}
        />
        <Text style={typography.caption}>
          Stripe handles card entry securely. KIVO never receives your card
          number or CVC. Only verified server confirmation marks an order paid.
        </Text>
      </View>
    </ScreenContainer>
  );
}
