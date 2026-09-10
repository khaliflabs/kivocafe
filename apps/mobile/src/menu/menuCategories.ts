import type { MenuCategory } from "./menuTypes.ts";
export const menuCategories: MenuCategory[] = [
  ["specials", "KIVO Specials"],
  ["waffles", "Waffles"],
  ["croffles", "Croffles"],
  ["french-toast", "French Toast"],
  ["cookie-dough", "Cookie Dough"],
  ["crepes", "Crepes"],
  ["cinnamon-rolls", "Cinnamon Rolls"],
  ["cakes", "Cakes"],
  ["shakes", "Shakes"],
  ["smoothies", "Smoothies"],
  ["drinks", "Drinks"],
].map(([id, name], sortOrder) => ({ id, name, sortOrder }));
