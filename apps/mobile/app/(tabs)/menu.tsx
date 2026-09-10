import { useMemo, useRef, useState } from "react";
import { router } from 'expo-router';
import { KivoButton } from '@/components/ui/KivoButton';
import { useMenuCart } from '@/src/menu/MenuCart';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KivoWordmark } from "@/components/brand/KivoWordmark";
import { BrandDivider } from "@/components/brand/BrandDivider";
import { ProductCard } from "@/components/menu/ProductCard";
import { menuCategories } from "@/src/menu/menuCategories";
import { filterMenu } from "@/src/menu/menuLogic";
import type { MenuItem } from "@/src/menu/menuTypes";
import { colors } from "@/src/theme/colors";
import { layout, spacing } from "@/src/theme/spacing";
import { typography } from "@/src/theme/typography";
const tabs = [{ id: "popular", name: "Popular" }, ...menuCategories];
export default function MenuScreen() {
  const cart=useMenuCart();
  const [category, setCategory] = useState("popular");
  const [query, setQuery] = useState("");
  const list = useRef<FlatList<MenuItem>>(null);
  const items = useMemo(() => filterMenu(query, category), [query, category]);
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.wordmark}>
          <KivoWordmark compact />
        </View>
        <Text accessibilityRole="header" style={typography.pageTitle}>
          The menu
        </Text>
        <Text style={styles.support}>
          A little indulgence. A moment for you.
        </Text>
        <KivoButton label={`CART · ${cart.lines.reduce((n,l)=>n+l.quantity,0)}`} variant="secondary" onPress={()=>router.push('/cart')}/>
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              list.current?.scrollToOffset({ offset: 0, animated: false });
            }}
            placeholder="Search treats or categories"
            placeholderTextColor={colors.mutedText}
            accessibilityLabel="Search menu by name or category"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.search}
          />
          {query !== "" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
              style={styles.clear}
            >
              <Text style={styles.support}>Clear</Text>
            </Pressable>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: !query && category === tab.id }}
              onPress={() => {
                setQuery("");
                setCategory(tab.id);
                list.current?.scrollToOffset({ offset: 0, animated: false });
              }}
              style={[
                styles.chip,
                !query && category === tab.id && styles.selected,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  !query && category === tab.id && styles.selectedText,
                ]}
              >
                {tab.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <BrandDivider />
      </View>
      <FlatList
        ref={list}
        style={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductCard item={item} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        initialNumToRender={4}
        windowSize={5}
        ListHeaderComponent={
          <View style={styles.listHeading}>
            <Text accessibilityRole="header" style={typography.sectionTitle}>
              {query.trim()
                ? "SEARCH RESULTS"
                : tabs.find((tab) => tab.id === category)?.name.toUpperCase()}
            </Text>
            <Text accessibilityLiveRegion="polite" style={styles.support}>
              {items.length} {items.length === 1 ? "selection" : "selections"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={typography.pageTitle}>Nothing just yet</Text>
            <Text style={styles.support}>
              Try a product name or a category such as Waffles.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setQuery("");
                setCategory("popular");
              }}
              style={styles.clear}
            >
              <Text style={typography.body}>Explore favourites</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          <Text style={styles.note}>
            Photography is representative stock, not KIVO product photography.
            Presentation may differ. This is a local menu preview; no orders are
            sent.
          </Text>
        }
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  wordmark: { width: 165, alignSelf: "flex-end" },
  support: { ...typography.body, color: colors.mutedText, fontSize: 13 },
  searchRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
  },
  search: {
    ...typography.body,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  clear: { padding: spacing.md, minHeight: 48, justifyContent: "center" },
  chips: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body, fontSize: 13 },
  selectedText: { color: colors.onPrimary },
  list: { flex: 1 },
  content: {
    width: "100%",
    alignSelf: "center",
    maxWidth: layout.maxContentWidth,
    padding: spacing.xl,
  },
  listHeading: { gap: spacing.xs, marginBottom: spacing.lg },
  empty: { gap: spacing.md, paddingVertical: spacing.xxl },
  note: {
    ...typography.body,
    fontSize: 12,
    lineHeight: 19,
    color: colors.mutedText,
    paddingBottom: spacing.xl,
  },
});
