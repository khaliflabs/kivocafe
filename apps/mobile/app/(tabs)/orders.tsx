import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandDivider } from "@/components/brand/BrandDivider";
import { KivoEmblem } from "@/components/brand/KivoEmblem";
import { KivoButton } from "@/components/ui/KivoButton";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { useMenuCart } from "@/src/menu/MenuCart";
import {
  formatGBP,
  getProduct,
  quantityTotal,
  unitPrice,
} from "@/src/menu/menuLogic";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { typography } from "@/src/theme/typography";
export default function OrdersScreen() {
  const { lines, remove } = useMenuCart();
  const total =
    lines.reduce(
      (pence, line) =>
        pence +
        Math.round(
          quantityTotal(
            unitPrice(getProduct(line.productId)!, line.variantId),
            line.quantity,
          ) * 100,
        ),
      0,
    ) / 100;
  return (
    <ScreenContainer>
      <FlatList
        data={lines}
        keyExtractor={(line) => `${line.productId}:${line.variantId ?? ""}`}
        ListHeaderComponent={
          <View style={styles.header}>
            <KivoEmblem size={52} />
            <Text accessibilityRole="header" style={typography.pageTitle}>
              Your local draft
            </Text>
            <Text style={styles.note}>
              Not an order. Nothing is sent or paid for. This draft resets when
              the app restarts.
            </Text>
            <BrandDivider botanical />
          </View>
        }
        renderItem={({ item: line }) => {
          const item = getProduct(line.productId)!;
          return (
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${item.name}`}
                onPress={() =>
                  router.push({
                    pathname: "/product/[id]",
                    params: { id: item.id },
                  })
                }
              >
                <Text style={typography.body}>
                  {line.quantity} × {item.name}
                </Text>
              </Pressable>
              <Text style={styles.note}>
                {
                  item.variants?.find(
                    (variant) => variant.id === line.variantId,
                  )?.name
                }
                {item.optionGroups?.length ? "Sauce not selected" : ""}
              </Text>
              <View style={styles.bottom}>
                <Text style={typography.body}>
                  {formatGBP(
                    quantityTotal(
                      unitPrice(item, line.variantId),
                      line.quantity,
                    ),
                  )}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name} from draft`}
                  onPress={() => remove(line)}
                  style={styles.remove}
                >
                  <Text style={styles.note}>Remove</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.note}>
            Your next café moment starts in the menu.
          </Text>
        }
        ListFooterComponent={
          <View style={styles.header}>
            {lines.length > 0 && (
              <Text style={typography.sectionTitle}>
                Draft total {formatGBP(total)}
              </Text>
            )}
            <KivoButton
              label="EXPLORE MENU"
              onPress={() => router.push("/(tabs)/menu")}
            />
          </View>
        }
      />
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  header: { gap: spacing.lg, paddingVertical: spacing.lg },
  note: { ...typography.body, color: colors.mutedText, fontSize: 13 },
  row: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  bottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  remove: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
});
