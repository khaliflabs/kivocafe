import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandDivider } from "@/components/brand/BrandDivider";
import { KivoEmblem } from "@/components/brand/KivoEmblem";
import { KivoButton } from "@/components/ui/KivoButton";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { menuCategories } from "@/src/menu/menuCategories";
import { menuImages } from "@/src/menu/menuImages";
import {
  formatGBP,
  getProduct,
  quantityTotal,
  unitPrice,
} from "@/src/menu/menuLogic";
import { useMenuCart } from "@/src/menu/MenuCart";
import type { MenuItem } from "@/src/menu/menuTypes";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { spacing } from "@/src/theme/spacing";
import { typography } from "@/src/theme/typography";

const back = () =>
  router.canGoBack() ? router.back() : router.replace("/(tabs)/menu");
export default function ProductRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = getProduct(id);
  if (!product)
    return (
      <ScreenContainer>
        <KivoEmblem />
        <Text style={typography.pageTitle}>Selection not found</Text>
        <Text style={typography.body}>
          This treat is not on the current menu.
        </Text>
        <KivoButton
          label="BACK TO MENU"
          onPress={() => router.replace("/(tabs)/menu")}
        />
      </ScreenContainer>
    );
  return <ProductDetail key={product.id} product={product} />;
}
function ProductDetail({ product }: { product: MenuItem }) {
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState(product.variants?.[0]?.id);
  const [message, setMessage] = useState("");
  const cart = useMenuCart();
  const price = unitPrice(product, variant);
  const existing =
    cart.lines.find(
      (line) => line.productId === product.id && line.variantId === variant,
    )?.quantity ?? 0;
  const image = product.imageKey ? menuImages[product.imageKey] : undefined;
  return (
    <ScreenContainer scroll contentContainerStyle={styles.page}>
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to menu"
          onPress={back}
          style={styles.back}
        >
          <Text style={typography.body}>← Back</Text>
        </Pressable>
        <Text style={typography.caption}>KIVO CAFÉ</Text>
      </View>
      {image ? (
        <>
          <View style={styles.hero}><Image
            source={image}
            style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
            accessibilityLabel={`Representative dessert photograph for ${product.name}, not a KIVO photograph`}
          /></View>
          <Text style={styles.photoNote}>
            Representative photograph · presentation may differ
          </Text>
        </>
      ) : (
        <View style={styles.emblem}>
          <KivoEmblem size={80} />
        </View>
      )}
      <Text style={typography.caption}>
        {menuCategories
          .find((category) => category.id === product.categoryId)
          ?.name.toUpperCase()}
      </Text>
      <Text accessibilityRole="header" style={typography.pageTitle}>
        {product.name}
      </Text>
      <Text style={styles.price}>{formatGBP(price)}</Text>
      <Text style={styles.description}>{product.description}</Text>
      <BrandDivider botanical />
      {!!product.variants?.length && (
        <View style={styles.group}>
          <Text style={styles.label}>Choose size</Text>
          {product.variants.map((value) => (
            <Pressable
              key={value.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: variant === value.id }}
              accessibilityLabel={`${value.name}, ${formatGBP(value.price)}`}
              onPress={() => {
                setVariant(value.id);
                setMessage("");
              }}
              style={[styles.variant, variant === value.id && styles.chosen]}
            >
              <Text style={typography.body}>
                {variant === value.id ? "●" : "○"} {value.name}
              </Text>
              <Text style={typography.body}>{formatGBP(value.price)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {product.optionGroups?.length ? (
        <View style={styles.notice}>
          <Text style={styles.label}>Sauce selection coming soon</Text>
          <Text style={styles.note}>
            Sauce choices are not confirmed yet. Your draft will not contain a
            sauce selection.
          </Text>
        </View>
      ) : null}
      <View style={styles.quantity}>
        <Text style={styles.label}>Quantity</Text>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
            accessibilityState={{ disabled: quantity === 1 }}
            disabled={quantity === 1}
            onPress={() => {
              setQuantity((value) => value - 1);
              setMessage("");
            }}
            style={[styles.stepButton, quantity === 1 && styles.disabled]}
          >
            <Text style={styles.count}>−</Text>
          </Pressable>
          <Text
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Quantity ${quantity}`}
            style={styles.count}
          >
            {quantity}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
            accessibilityState={{ disabled: quantity === 99 }}
            disabled={quantity === 99}
            onPress={() => {
              setQuantity((value) => value + 1);
              setMessage("");
            }}
            style={[styles.stepButton, quantity === 99 && styles.disabled]}
          >
            <Text style={styles.count}>+</Text>
          </Pressable>
        </View>
      </View>
      <KivoButton
        label={`ADD TO CART — ${formatGBP(quantityTotal(price, quantity))}`}
        disabled={!cart.ready}
        onPress={() => {
          if (existing + quantity > 99) {
            setMessage(
              "Your cart can hold up to 99 of each selection. Checkout permits 20 per selection.",
            );
            return;
          }
          cart.add({ productId: product.id, variantId: variant, quantity });
          setMessage(
            `${quantity} × ${product.name} added to your cart. Nothing has been ordered yet.`,
          );
        }}
      />
      {!!message && (
        <View style={styles.notice}>
          <Text accessibilityLiveRegion="polite" style={typography.body}>
            {message}
          </Text>
          <KivoButton
            label="VIEW CART"
            variant="secondary"
            onPress={() => router.push('/cart')}
          />
        </View>
      )}
      <Text style={styles.note}>
        Saved on this device. Final prices are confirmed at checkout. Ask the
        café about ingredients and allergens before ordering. Test payments only.
      </Text>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  page: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  back: { minHeight: 44, justifyContent: "center", paddingRight: spacing.xl },
  hero: {
    overflow: "hidden",
    width: "100%",
    aspectRatio: 1.15,
    borderRadius: 7,
    backgroundColor: colors.surfaceMuted,
  },
  photoNote: {
    ...typography.caption,
    letterSpacing: 0,
    fontSize: 11,
    marginTop: -spacing.sm,
  },
  emblem: {
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.surfaceMuted,
  },
  price: { ...typography.body, fontSize: 22, fontFamily: fonts.sansSemiBold },
  description: { ...typography.body, color: colors.mutedText },
  group: { gap: spacing.md },
  label: { ...typography.body, fontFamily: fonts.sansSemiBold },
  variant: {
    minHeight: 56,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  chosen: { backgroundColor: colors.surfaceMuted, borderColor: colors.primary },
  quantity: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  stepper: { flexDirection: "row", alignItems: "center" },
  stepButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 5,
  },
  count: {
    ...typography.body,
    fontSize: 22,
    textAlign: "center",
    minWidth: 48,
  },
  disabled: { opacity: 0.4 },
  notice: {
    padding: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.md,
  },
  note: {
    ...typography.body,
    fontSize: 12,
    lineHeight: 19,
    color: colors.mutedText,
  },
});
