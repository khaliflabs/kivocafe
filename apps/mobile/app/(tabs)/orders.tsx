import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { BrandDivider } from "@/components/brand/BrandDivider";
import { KivoEmblem } from "@/components/brand/KivoEmblem";
import { KivoButton } from "@/components/ui/KivoButton";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { useAuth } from "@/src/backend/AuthProvider";
import { api } from "@/src/backend/client";
import { parseOrder, type OrderDTO } from "@/src/backend/contracts";
import { useMenuCart } from "@/src/menu/MenuCart";
import { formatGBP } from "@/src/menu/menuLogic";
import { typography } from "@/src/theme/typography";
import { colors } from "@/src/theme/colors";
export default function OrdersScreen() {
  const { session } = useAuth();
  const cart = useMenuCart();
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setOrders([]);
      setMessage("");
      if (session) {
        setLoading(true);
        void api<{ orders: unknown[] }>("/orders")
          .then((r) => {
            if (active) setOrders(r.orders.map(parseOrder));
          })
          .catch(() => {
            if (active)
              setMessage(
                "Order history is unavailable. Please refresh when the staging API is connected.",
              );
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      }
      return () => {
        active = false;
      };
    }, [session]),
  );
  async function refresh() {
    setLoading(true);
    try {
      const r = await api<{ orders: unknown[] }>("/orders");
      setOrders(r.orders.map(parseOrder));
      setMessage("");
    } catch {
      setMessage("Unable to refresh orders.");
    } finally {
      setLoading(false);
    }
  }
  async function cancel(id: string) {
    try {
      await api(`/orders/${id}/cancel`, {});
      await refresh();
    } catch {
      setMessage("This order cannot be cancelled right now.");
    }
  }
  return (
    <ScreenContainer>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshing={loading}
        onRefresh={session ? () => void refresh() : undefined}
        ListHeaderComponent={
          <View style={{ gap: 20, paddingBottom: 24 }}>
            <KivoEmblem size={52} />
            <Text style={typography.pageTitle}>Your orders</Text>
            <Text style={typography.body}>Café moments, made with care.</Text>
            <KivoButton
              label={`VIEW CART · ${cart.lines.reduce((n, l) => n + l.quantity, 0)}`}
              onPress={() => router.push("/cart")}
            />
            <BrandDivider botanical />
            {!session && (
              <KivoButton
                label="SIGN IN FOR ORDER HISTORY"
                onPress={() => router.push("/auth")}
              />
            )}{" "}
            {!!message && (
              <Text accessibilityRole="alert" style={typography.body}>
                {message}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={typography.body}>
            {loading
              ? "Loading your orders…"
              : session
                ? "Your orders will appear here."
                : "Your cart is available without signing in."}
          </Text>
        }
        renderItem={({ item: o }) => (
          <View
            style={{
              paddingVertical: 20,
              gap: 12,
              borderBottomWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={typography.caption}>
              {["collected", "cancelled", "refunded"].includes(o.status)
                ? "PREVIOUS ORDER"
                : "ACTIVE ORDER"}
            </Text>
            <Text style={typography.sectionTitle}>
              KIVO · {o.id.slice(0, 8).toUpperCase()}
            </Text>
            <Text style={typography.body}>
              {new Date(o.created_at).toLocaleDateString("en-GB")} ·{" "}
              {formatGBP(o.total_pence / 100)}
            </Text>
            <Text style={typography.body}>
              {o.status
                .replaceAll("_", " ")
                .replace(/^./, (s) => s.toUpperCase())}
            </Text>
            {["draft", "payment_pending", "payment_failed"].includes(
              o.status,
            ) && (
              <>
                <KivoButton
                  label="VIEW / RESUME PAYMENT"
                  onPress={() =>
                    router.push({
                      pathname: "/checkout",
                      params: { orderId: o.id },
                    })
                  }
                />
                <KivoButton
                  label="CANCEL ORDER"
                  variant="secondary"
                  onPress={() => void cancel(o.id)}
                />
              </>
            )}
          </View>
        )}
      />
    </ScreenContainer>
  );
}
