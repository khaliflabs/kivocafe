import assert from "node:assert/strict";
import test from "node:test";
import { menuItems } from "./menuData.ts";
import { menuCategories } from "./menuCategories.ts";
import {
  addCartLine,
  filterMenu,
  formatGBP,
  getProduct,
  quantityTotal,
  unitPrice,
} from "./menuLogic.ts";

test("GBP formatting is fixed to two decimals", () => {
  assert.equal(formatGBP(8.95), "£8.95");
  assert.equal(formatGBP(5), "£5.00");
  assert.equal(formatGBP(0), "£0.00");
  for (const invalid of [-1, NaN, Infinity])
    assert.throws(() => formatGBP(invalid));
});
test("49 unique products and 11 valid, ordered categories", () => {
  assert.equal(menuItems.length, 49);
  assert.equal(new Set(menuItems.map((item) => item.id)).size, 49);
  assert.equal(menuCategories.length, 11);
  assert.equal(new Set(menuCategories.map((category) => category.id)).size, 11);
  menuCategories.forEach((category, index) =>
    assert.equal(category.sortOrder, index),
  );
  menuItems.forEach((item) => {
    assert.ok(
      menuCategories.some((category) => category.id === item.categoryId),
    );
    assert.ok(item.price > 0 && Number.isFinite(item.price));
    assert.ok(item.description && item.shortDescription);
  });
});
test("all authoritative printed prices are preserved", () => {
  const expected = {
    "cinnamon-rolls": [4.95],
    waffles: [7.95, 7.95, 8.95, 7.95, 7.95],
    "cookie-dough": [6.95, 6.95, 6.95],
    crepes: [6.95, 7.95, 7.95, 7.95],
    specials: [4.95, 7.95, 6.99, 4.95],
    croffles: [5.99, 5.99, 5.99, 5.99],
    "french-toast": [9.95, 9.95, 9.95, 9.95, 9.95, 9.95],
    smoothies: [5.99, 5.99, 5.99, 5.99],
    cakes: [4.95, 4.95, 4.95, 4.95, 4.95, 4.95, 4.49],
    shakes: [4.99, 4.99, 4.99, 4.99, 4.99, 4.99, 4.99, 4.99, 5.99],
    drinks: [1.99, 1.99],
  };
  for (const [category, prices] of Object.entries(expected))
    assert.deepEqual(
      menuItems
        .filter((item) => item.categoryId === category)
        .map((item) => item.price),
      prices,
      category,
    );
});
test("strawberry variants are one product with exact prices", () => {
  const item = getProduct("chocolate-strawberries");
  assert.deepEqual(item.variants, [
    { id: "six", name: "6 pcs", price: 4.95 },
    { id: "ten", name: "10 pcs", price: 9.95 },
  ]);
  assert.equal(unitPrice(item, "six"), 4.95);
  assert.equal(unitPrice(item, "ten"), 9.95);
  assert.throws(() => unitPrice(item, "invalid"));
  assert.throws(() => unitPrice(item));
});
test("lookup covers every detail route and rejects unknown or malformed IDs", () => {
  menuItems.forEach((item) => assert.equal(getProduct(item.id), item));
  for (const id of ["unknown", "__proto__", "", undefined, ["king-ferrero"]])
    assert.equal(getProduct(id), undefined);
});
test("search is case-insensitive, trimmed, and spans names and categories", () => {
  assert.equal(filterMenu(" KING FERRERO ")[0].id, "king-ferrero");
  assert.equal(filterMenu("french toast").length, 6);
  assert.equal(filterMenu("crepes").length, 4);
  assert.equal(filterMenu("lotus").length, 7);
  assert.equal(filterMenu("not-a-dessert").length, 0);
  assert.equal(filterMenu("", "drinks").length, 2);
  assert.equal(filterMenu(" ", "popular").length, 6);
  assert.equal(filterMenu("", "all").length, 49);
});
test("quantity totals use integer pence and reject invalid quantities", () => {
  assert.equal(quantityTotal(4.95, 3), 14.85);
  assert.equal(quantityTotal(9.95, 2), 19.9);
  assert.equal(quantityTotal(6.99, 3), 20.97);
  for (const quantity of [0, -1, 1.5, 100, NaN])
    assert.throws(() => quantityTotal(4.95, quantity));
});
test("cart merges identical selections without merging different sizes", () => {
  const first = addCartLine([], {
    productId: "chocolate-strawberries",
    variantId: "six",
    quantity: 1,
  });
  const second = addCartLine(first, {
    productId: "chocolate-strawberries",
    variantId: "six",
    quantity: 2,
  });
  assert.equal(second[0].quantity, 3);
  assert.equal(first[0].quantity, 1);
  assert.equal(
    addCartLine(second, {
      productId: "chocolate-strawberries",
      variantId: "ten",
      quantity: 1,
    }).length,
    2,
  );
  assert.throws(() => addCartLine([], { productId: "unknown", quantity: 1 }));
  assert.throws(() =>
    addCartLine(first, {
      productId: "chocolate-strawberries",
      variantId: "six",
      quantity: 99,
    }),
  );
});
test("unconfirmed sauce choices have no invented options or extra prices", () => {
  const groups = menuItems.flatMap((item) => item.optionGroups ?? []);
  assert.equal(groups.length, 5);
  groups.forEach((group) => {
    assert.equal(group.required, true);
    assert.deepEqual(group.options, []);
  });
});
