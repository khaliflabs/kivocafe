import { useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { BrandDivider } from "@/components/brand/BrandDivider";
import { KivoEmblem } from "@/components/brand/KivoEmblem";
import { KivoButton } from "@/components/ui/KivoButton";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { useAuth } from "@/src/backend/AuthProvider";
import { supabase } from "@/src/backend/client";
import { typography } from "@/src/theme/typography";
export default function ProfileScreen() {
  const { session, ready } = useAuth();
  const [message, setMessage] = useState("");
  async function signOut() {
    try {
      const r = await supabase!.auth.signOut();
      if (r.error) throw r.error;
    } catch {
      setMessage("Unable to sign out. Please try again.");
    }
  }
  return (
    <ScreenContainer>
      <View style={{ gap: 24 }}>
        <KivoEmblem size={56} />
        <Text style={typography.pageTitle}>Your KIVO</Text>
        <BrandDivider botanical />
        <Text style={typography.body}>
          {!ready
            ? "Restoring your session…"
            : session
              ? session.user.email
              : "Sign in to keep track of your orders."}
        </Text>
        {session ? (
          <KivoButton
            label="SIGN OUT"
            variant="secondary"
            onPress={() => void signOut()}
          />
        ) : (
          <KivoButton
            label="SIGN IN / CREATE ACCOUNT"
            onPress={() => router.push("/auth")}
          />
        )}
        {!!message && (
          <Text accessibilityRole="alert" style={typography.body}>
            {message}
          </Text>
        )}
      </View>
    </ScreenContainer>
  );
}
