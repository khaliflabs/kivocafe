import { router } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { BrandDivider } from "@/components/brand/BrandDivider";
import { KivoButton } from "@/components/ui/KivoButton";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { useMenuCart } from "@/src/menu/MenuCart";
import { formatGBP, getProduct, unitPrice } from "@/src/menu/menuLogic";
import { cartPence } from "@/src/backend/contracts";
import { typography } from "@/src/theme/typography";
import { colors } from "@/src/theme/colors";
export default function CartScreen() {
  const cart = useMenuCart();
  return (
    <ScreenContainer>
      <FlatList
        data={cart.lines}
        keyExtractor={(l) => `${l.productId}:${l.variantId ?? ""}`}
        ListHeaderComponent={
          <View style={{ gap: 20, paddingBottom: 24 }}>
            <KivoButton
              label="MENU"
              variant="secondary"
              onPress={() => router.replace("/(tabs)/menu")}
            />
            <Text style={typography.pageTitle}>Your café moment</Text>
            <Text style={typography.body}>
              Saved on this device. Nothing is ordered until checkout.
            </Text>
            {cart.storageError && (
              <Text style={typography.body}>
                Your cart could not be saved on this device.
              </Text>
            )}
            <BrandDivider botanical />
          </View>
        }
        renderItem={({ item: line }) => {
          const p = getProduct(line.productId)!;
          return (
            <View
              style={{
                gap: 12,
                paddingVertical: 20,
                borderBottomWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={typography.sectionTitle}>{p.name}</Text>
              <Text style={typography.body}>
                {p.variants?.find((v) => v.id === line.variantId)?.name}
              </Text>
              <Text style={typography.body}>
                {formatGBP(unitPrice(p, line.variantId) * line.quantity)}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <KivoButton
                  label="−"
                  disabled={line.quantity <= 1}
                  variant="secondary"
                  onPress={() => cart.setQuantity(line, line.quantity - 1)}
                />
                <Text accessibilityLiveRegion="polite" style={typography.body}>
                  {line.quantity}
                </Text>
                <KivoButton
                  label="+"
                  disabled={line.quantity >= 20}
                  variant="secondary"
                  onPress={() => cart.setQuantity(line, line.quantity + 1)}
                />
              </View>
              <KivoButton
                label="REMOVE"
                variant="secondary"
                onPress={() => cart.remove(line)}
              />
              {!!p.optionGroups?.length && (
                <Text style={typography.caption}>
                  Sauce selection is not ready. This item cannot be checked out
                  yet.
                </Text>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={typography.body}>
            {cart.ready ? "Your cart is empty." : "Restoring your cart…"}
          </Text>
        }
        ListFooterComponent={
          <View style={{ gap: 20, paddingVertical: 24, paddingBottom: 48 }}>
            <Text style={typography.sectionTitle}>
              Estimated total {formatGBP(cartPence(cart.lines) / 100)}
            </Text>
            <Text style={typography.caption}>
              Final prices are checked securely by KIVO.
            </Text>
            <KivoButton
              label="REVIEW CHECKOUT"
              disabled={!cart.ready || !cart.lines.length}
              onPress={() => router.push("/checkout")}
            />
          </View>
        }
      />
    </ScreenContainer>
  );
}
