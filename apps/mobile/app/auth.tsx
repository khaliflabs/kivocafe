import { useState } from "react";
import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { BrandDivider } from "@/components/brand/BrandDivider";
import { KivoEmblem } from "@/components/brand/KivoEmblem";
import { KivoButton } from "@/components/ui/KivoButton";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { supabase } from "@/src/backend/client";
import { colors } from "@/src/theme/colors";
import { typography } from "@/src/theme/typography";
export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = signup
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
      if (result.error)
        setMessage(
          "Unable to sign in or create this account. Check your details and email confirmation.",
        );
      else if (result.data.session) {
        setPassword("");
        router.replace("/(tabs)/profile");
      } else {
        setPassword("");
        setMessage("Check your email to confirm your account, then sign in.");
      }
    } catch {
      setMessage("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScreenContainer scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ gap: 20, paddingBottom: 48 }}>
          <KivoButton
            label="BACK"
            variant="secondary"
            onPress={() => router.back()}
          />
          <KivoEmblem size={56} />
          <Text style={typography.pageTitle}>
            {signup ? "Join KIVO" : "Welcome back"}
          </Text>
          <BrandDivider botanical />
          {!supabase && (
            <Text style={typography.body}>
              Account setup is not available in this preview. Menu and cart
              remain available.
            </Text>
          )}
          <Text style={typography.body}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            textContentType="emailAddress"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            style={{
              ...typography.body,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 7,
            }}
          />
          <Text style={typography.body}>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            textContentType={signup ? "newPassword" : "password"}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            style={{
              ...typography.body,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 7,
            }}
          />
          {!!message && (
            <Text accessibilityRole="alert" style={typography.body}>
              {message}
            </Text>
          )}
          <KivoButton
            label={
              busy ? "PLEASE WAIT…" : signup ? "CREATE ACCOUNT" : "SIGN IN"
            }
            disabled={!supabase || busy || !email.trim() || password.length < 6}
            onPress={() => void submit()}
          />
          <KivoButton
            label={signup ? "ALREADY A MEMBER?" : "CREATE AN ACCOUNT"}
            variant="secondary"
            disabled={busy}
            onPress={() => {
              setSignup(!signup);
              setMessage("");
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
