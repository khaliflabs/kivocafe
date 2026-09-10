import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
export const publicConfig = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  stripeKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
};
// Chunked native secure storage avoids the platform per-entry size limit. Manifest commits last.
const storage = {
  async getItem(key: string) {
    const manifest = await SecureStore.getItemAsync(key);
    if (!manifest) return null;
    const { id, count } = JSON.parse(manifest) as { id: string; count: number };
    if (!Number.isInteger(count) || count < 1 || count > 100) return null;
    const pieces = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${id}.${i}`),
      ),
    );
    return pieces.some((p) => p === null) ? null : pieces.join("");
  },
  async setItem(key: string, value: string) {
    const previous = await SecureStore.getItemAsync(key);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const count = Math.ceil(value.length / 500);
    if (count > 100) throw new Error("Session exceeds secure storage limit");
    for (let i = 0; i < count; i++)
      await SecureStore.setItemAsync(
        `${key}.${id}.${i}`,
        value.slice(i * 500, (i + 1) * 500),
      );
    await SecureStore.setItemAsync(key, JSON.stringify({ id, count }));
    if (previous) {
      const old = JSON.parse(previous);
      for (let i = 0; i < old.count; i++)
        await SecureStore.deleteItemAsync(`${key}.${old.id}.${i}`);
    }
  },
  async removeItem(key: string) {
    const previous = await SecureStore.getItemAsync(key);
    await SecureStore.deleteItemAsync(key);
    if (previous) {
      const old = JSON.parse(previous);
      for (let i = 0; i < old.count; i++)
        await SecureStore.deleteItemAsync(`${key}.${old.id}.${i}`);
    }
  },
};
export const supabase =
  publicConfig.supabaseUrl?.startsWith("https://") && publicConfig.supabaseKey
    ? createClient(publicConfig.supabaseUrl, publicConfig.supabaseKey, {
        auth: {
          storage: Platform.OS === "web" ? undefined : storage,
          persistSession: Platform.OS !== "web",
          autoRefreshToken: true,
          detectSessionInUrl: false,
          lock: processLock,
        },
      })
    : null;
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const url = publicConfig.apiUrl;
  if (
    !url ||
    !(
      url.startsWith("https://") ||
      (__DEV__ && /^http:\/\/(localhost|127\.0\.0\.1):3001$/.test(url))
    )
  )
    throw new Error(
      "The staging API is not connected yet. Menu and cart preview remain available.",
    );
  if (!supabase) throw new Error("Sign-in configuration is unavailable.");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in to continue.");
  const response = await fetch(`${url}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    const message =
      result?.error?.code === "PAYMENTS_NOT_READY"
        ? "Test payments are waiting for verified webhook setup. No payment was taken."
        : result?.error?.code === "QUOTE_EXPIRED"
          ? "This quote expired. Return to your cart for a fresh quote."
          : "Unable to complete this request. Please try again.";
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
