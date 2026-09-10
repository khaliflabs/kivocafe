import { menuCategories } from "./menuCategories.ts";
import { menuItems } from "./menuData.ts";
import type { CartLine, MenuItem } from "./menuTypes.ts";
export function formatGBP(value: number): string {
  if (!Number.isFinite(value) || value < 0)
    throw new Error("Invalid GBP amount");
  return `£${value.toFixed(2)}`;
}
export function getProduct(id: unknown): MenuItem | undefined {
  return typeof id === "string"
    ? menuItems.find((item) => item.id === id)
    : undefined;
}
export function unitPrice(item: MenuItem, variantId?: string): number {
  if (!item.variants?.length) {
    if (variantId) throw new Error("Unexpected variant");
    return item.price;
  }
  const variant = item.variants.find((value) => value.id === variantId);
  if (!variant) throw new Error("Choose a valid size");
  return variant.price;
}
export function quantityTotal(price: number, quantity: number): number {
  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 99
  )
    throw new Error("Invalid quantity or price");
  return (Math.round(price * 100) * quantity) / 100;
}
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function filterMenu(query = "", categoryId = "popular"): MenuItem[] {
  const search = normalize(query);
  return menuItems.filter((item) => {
    const category =
      menuCategories.find((value) => value.id === item.categoryId)?.name ?? "";
    return search
      ? normalize(`${item.name} ${category}`).includes(search)
      : categoryId === "popular"
        ? !!item.popular
        : categoryId === "all" || item.categoryId === categoryId;
  });
}
export function addCartLine(lines: CartLine[], line: CartLine): CartLine[] {
  const product = getProduct(line.productId);
  if (!product) throw new Error("Unknown product");
  quantityTotal(unitPrice(product, line.variantId), line.quantity);
  const existing = lines.find(
    (value) =>
      value.productId === line.productId && value.variantId === line.variantId,
  );
  if (existing) {
    quantityTotal(
      unitPrice(product, line.variantId),
      existing.quantity + line.quantity,
    );
    return lines.map((value) =>
      value === existing
        ? { ...value, quantity: value.quantity + line.quantity }
        : value,
    );
  }
  return [...lines, { ...line }];
}
