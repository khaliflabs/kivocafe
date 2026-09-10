import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { menuCategories } from "@/src/menu/menuCategories";
import { menuImages } from "@/src/menu/menuImages";
import { formatGBP } from "@/src/menu/menuLogic";
import type { MenuItem } from "@/src/menu/menuTypes";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { spacing } from "@/src/theme/spacing";
import { typography } from "@/src/theme/typography";
export function ProductCard({ item }: { item: MenuItem }) {
  const category = menuCategories.find(
    (value) => value.id === item.categoryId,
  )?.name;
  const image = item.imageKey ? menuImages[item.imageKey] : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${category}, ${item.variants ? "from " : ""}${formatGBP(item.price)}. View details.`}
      onPress={() =>
        router.push({ pathname: "/product/[id]", params: { id: item.id } })
      }
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {image && (
        <View style={styles.photo}><Image
          source={image}
          style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
          accessibilityLabel={`Representative dessert photograph for ${item.name}; not a KIVO product photograph`}
        /></View>
      )}
      <View style={styles.copy}>
        {image && (
          <Text style={styles.photoNote}>Representative photograph</Text>
        )}
        <Text style={styles.eyebrow}>
          {category?.toUpperCase()}
          {item.popular ? " · KIVO FAVOURITE" : ""}
        </Text>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.description}>{item.shortDescription}</Text>
        <View style={styles.bottom}>
          <Text style={styles.price}>
            {item.variants ? "From " : ""}
            {formatGBP(item.price)}
          </Text>
          <Text style={styles.more}>View details ↗</Text>
        </View>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  pressed: { opacity: 0.75 },
  photo: {
    width: "100%",
    aspectRatio: 1.65,
    backgroundColor: colors.surfaceMuted,
  },
  photoNote: { ...typography.caption, letterSpacing: 0, fontSize: 10 },
  copy: { padding: spacing.lg, gap: spacing.sm },
  eyebrow: { ...typography.caption, letterSpacing: 1.2 },
  title: {
    color: colors.primary,
    fontFamily: fonts.serifMedium,
    fontSize: 29,
    lineHeight: 33,
  },
  description: { ...typography.body, color: colors.mutedText },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  price: { ...typography.body, fontFamily: fonts.sansSemiBold },
  more: { ...typography.caption, letterSpacing: 0.5, color: colors.secondary },
});
