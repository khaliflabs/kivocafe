import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import { addCartLine } from "./menuLogic";
import type { CartLine } from "./menuTypes";
const CartContext = createContext<{
  lines: CartLine[];
  add: (line: CartLine) => void;
  remove: (line: CartLine) => void;
} | null>(null);
export function MenuCartProvider({ children }: PropsWithChildren) {
  const [lines, setLines] = useState<CartLine[]>([]);
  return (
    <CartContext.Provider
      value={{
        lines,
        add: (line) => setLines((current) => addCartLine(current, line)),
        remove: (line) =>
          setLines((current) =>
            current.filter(
              (value) =>
                value.productId !== line.productId ||
                value.variantId !== line.variantId,
            ),
          ),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
export function useMenuCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("MenuCartProvider is missing");
  return cart;
}
