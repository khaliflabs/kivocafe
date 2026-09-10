import type { PropsWithChildren } from "react";
// Web must not resolve the native Stripe package at all, including SSR bundling.
export const nativePaymentAvailable = false;
export const stripeSDK: typeof import("@stripe/stripe-react-native") | null =
  null;
export function PaymentProvider({ children }: PropsWithChildren) {
  return children;
}
