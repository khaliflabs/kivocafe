import { menuCategories } from "../../../apps/mobile/src/menu/menuCategories.ts";
import { menuItems } from "../../../apps/mobile/src/menu/menuData.ts";
import { pence } from "../src/domain.ts";
export const catalog = {
  categories: menuCategories.map((c) => ({
    id: c.id,
    name: c.name,
    sort_order: c.sortOrder,
  })),
  products: menuItems.map((p) => ({
    id: p.id,
    category_id: p.categoryId,
    name: p.name,
    description: p.description,
    price_pence: pence(p.price),
    active: true,
  })),
  product_variants: menuItems.flatMap((p) =>
    (p.variants ?? []).map((v) => ({
      id: `${p.id}:${v.id}`,
      product_id: p.id,
      name: v.name,
      price_pence: pence(v.price),
      active: true,
    })),
  ),
  product_option_groups: menuItems.flatMap((p) =>
    (p.optionGroups ?? []).map((g) => ({
      id: `${p.id}:${g.id}`,
      product_id: p.id,
      name: g.name,
      required: g.required,
    })),
  ),
  product_options: menuItems.flatMap((p) =>
    (p.optionGroups ?? []).flatMap((g) =>
      g.options.map((o) => ({
        id: `${p.id}:${g.id}:${o.id}`,
        group_id: `${p.id}:${g.id}`,
        name: o.name,
        price_pence: Math.round(o.price * 100),
        active: true,
      })),
    ),
  ),
};
export async function seedDatabase(query) {
  // Transaction is supplied by the caller. Idempotent: existing catalog is never overwritten.
  await query(
    "insert into public.stores(id,name) values('00000000-0000-4000-8000-000000000001','KIVO Café') on conflict do nothing",
  );
  for (const [table, rows] of Object.entries(catalog))
    for (const row of rows) {
      const columns = Object.keys(row);
      await query(
        `insert into public.${table}(${columns.join(",")}) values(${columns.map((_, i) => `$${i + 1}`).join(",")}) on conflict(id) do nothing`,
        Object.values(row),
      );
    }
}
