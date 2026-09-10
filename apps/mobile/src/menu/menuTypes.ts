export type MenuCategory = { id: string; name: string; sortOrder: number };
export type MenuVariant = { id: string; name: string; price: number };
export type MenuOptionGroup = {
  id: string;
  name: string;
  required: boolean;
  options: { id: string; name: string; price: number }[];
};
export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  shortDescription: string;
  description: string;
  price: number;
  imageKey?: string;
  popular?: boolean;
  variants?: MenuVariant[];
  optionGroups?: MenuOptionGroup[];
};
export type CartLine = {
  productId: string;
  variantId?: string;
  quantity: number;
};
