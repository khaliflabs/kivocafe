import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./client";
const Context = createContext<{ session: Session | null; ready: boolean }>({
  session: null,
  ready: false,
});
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          setSession(error ? null : data.session);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setReady(true);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase!.auth.startAutoRefresh();
      else supabase!.auth.stopAutoRefresh();
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      appState.remove();
    };
  }, []);
  return (
    <Context.Provider value={{ session, ready }}>{children}</Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
