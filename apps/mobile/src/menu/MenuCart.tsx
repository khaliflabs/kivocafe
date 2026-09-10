import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type PropsWithChildren,
} from "react";
import { addCartLine } from "./menuLogic";
import type { CartLine } from "./menuTypes";
import AsyncStorage from "@react-native-async-storage/async-storage";
const CartContext = createContext<{
  lines: CartLine[];
  ready: boolean;
  storageError: boolean;
  clear: () => void;
  setQuantity: (line: CartLine, quantity: number) => void;
  add: (line: CartLine) => void;
  remove: (line: CartLine) => void;
} | null>(null);
export function MenuCartProvider({ children }: PropsWithChildren) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const pending = useRef(Promise.resolve());
  useEffect(() => {
    void AsyncStorage.getItem("kivo-cart-v1")
      .then((raw) => {
        if (raw) {
          const values = JSON.parse(raw);
          if (!Array.isArray(values) || values.length > 50)
            throw new Error("Invalid cart");
          setLines(
            values.reduce(
              (out: CartLine[], line: CartLine) => addCartLine(out, line),
              [],
            ),
          );
        }
      })
      .catch(() => setStorageError(true))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready)
      pending.current = pending.current
        .then(() => AsyncStorage.setItem("kivo-cart-v1", JSON.stringify(lines)))
        .catch(() => setStorageError(true));
  }, [lines, ready]);
  return (
    <CartContext.Provider
      value={{
        lines,
        ready,
        storageError,
        clear: () => setLines([]),
        setQuantity: (line, quantity) => {
          if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20)
            return;
          setLines((current) =>
            current.map((v) =>
              v.productId === line.productId && v.variantId === line.variantId
                ? { ...v, quantity }
                : v,
            ),
          );
        },
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
