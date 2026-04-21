import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CheckCircle, Shield, XCircle } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

type VerifyState = "idle" | "verifying" | "success_match" | "success_nomatch" | "error";

export default function NinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { phone, countryCode, email } = useLocalSearchParams<{
    phone: string;
    countryCode: string;
    email: string;
  }>();

  const [nin, setNin] = useState("");
  const [state, setState] = useState<VerifyState>("idle");
  const [error, setError] = useState("");
  const [ninName, setNinName] = useState("");
  const [ninDob, setNinDob] = useState("");
  const [phoneMatch, setPhoneMatch] = useState(false);

  const ninValid = /^\d{11}$/.test(nin.trim());

  async function verifyNin() {
    if (!ninValid) {
      setError("NIN must be exactly 11 digits");
      return;
    }
    setState("verifying");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/nin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nin: nin.trim(), phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed. Please try again.");
        setState("error");
        return;
      }
      setNinName(data.name ?? "");
      setNinDob(data.dob ?? "");
      setPhoneMatch(data.phoneMatch);
      setState(data.phoneMatch ? "success_match" : "success_nomatch");
    } catch {
      setError("Network error — please check your connection and try again.");
      setState("error");
    }
  }

  function proceed() {
    router.push({
      pathname: "/(onboarding)/profile",
      params: {
        phone,
        countryCode,
        email,
        ninName,
        ninDob,
        ninNumber: nin.trim(),
        phoneMatch: phoneMatch ? "true" : "false",
      },
    });
  }

  const padBottom = Math.max(insets.bottom, 24) + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <ArrowLeft size={22} color={colors.foreground} strokeWidth={1.8} />
      </Pressable>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: padBottom }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + "1A" }]}>
            <Shield size={28} color={colors.primary} strokeWidth={1.8} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>NIN Verification</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Enter your 11-digit National Identity Number (NIN) to verify your identity
          </Text>
        </View>

        {(state === "idle" || state === "error") && (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>National Identity Number (NIN)</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: error ? colors.destructive : colors.border,
                    color: colors.foreground,
                    letterSpacing: 4,
                  },
                ]}
                placeholder="00000000000"
                placeholderTextColor={colors.mutedForeground}
                value={nin}
                onChangeText={(t) => {
                  setNin(t.replace(/\D/g, "").slice(0, 11));
                  setError("");
                  if (state === "error") setState("idle");
                }}
                keyboardType="numeric"
                maxLength={11}
                autoFocus
              />
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                {nin.length}/11 digits — found on your National ID slip or NIMC app
              </Text>
              {!!error && <Text style={[styles.errText, { color: colors.destructive }]}>{error}</Text>}
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Your NIN is used to verify that your registered phone number matches NIMC records.
                Only your identity status is checked — your personal data stays private.
              </Text>
            </View>

            <Pressable
              onPress={verifyNin}
              disabled={!ninValid}
              style={({ pressed }) => [
                styles.btn,
                {
                  backgroundColor: ninValid ? colors.primary : colors.muted,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.btnText, { color: ninValid ? "#fff" : colors.mutedForeground }]}>
                Verify NIN
              </Text>
            </Pressable>
          </View>
        )}

        {state === "verifying" && (
          <View style={styles.verifyingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.verifyingTitle, { color: colors.foreground }]}>Verifying NIN…</Text>
            <Text style={[styles.verifyingSub, { color: colors.mutedForeground }]}>
              Checking with NIMC identity registry
            </Text>
          </View>
        )}

        {(state === "success_match" || state === "success_nomatch") && (
          <View style={styles.resultWrap}>
            <View style={[
              styles.resultIcon,
              { backgroundColor: state === "success_match" ? colors.success + "1A" : colors.warning + "1A" },
            ]}>
              {state === "success_match"
                ? <CheckCircle size={36} color={colors.success} strokeWidth={1.5} />
                : <XCircle size={36} color={colors.warning} strokeWidth={1.5} />
              }
            </View>

            <Text style={[styles.resultTitle, { color: colors.foreground }]}>
              {state === "success_match" ? "NIN Verified ✓" : "NIN Verified — Phone Mismatch"}
            </Text>

            {state === "success_match" ? (
              <>
                <Text style={[styles.resultSub, { color: colors.mutedForeground }]}>
                  Your phone number matches the registered number on your NIN. You're approved for Tier 1 transactions.
                </Text>
                <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.success + "55" }]}>
                  {!!ninName && (
                    <View style={styles.resultRow}>
                      <Text style={[styles.resultKey, { color: colors.mutedForeground }]}>Name on NIN</Text>
                      <Text style={[styles.resultVal, { color: colors.foreground }]}>{ninName}</Text>
                    </View>
                  )}
                  {!!ninDob && (
                    <View style={[styles.resultRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                      <Text style={[styles.resultKey, { color: colors.mutedForeground }]}>Date of Birth</Text>
                      <Text style={[styles.resultVal, { color: colors.foreground }]}>{ninDob}</Text>
                    </View>
                  )}
                  <View style={[styles.resultRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Text style={[styles.resultKey, { color: colors.mutedForeground }]}>Daily Debit Limit</Text>
                    <Text style={[styles.resultVal, { color: colors.success }]}>₦100,000</Text>
                  </View>
                  <View style={[styles.resultRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Text style={[styles.resultKey, { color: colors.mutedForeground }]}>Max Single Deposit</Text>
                    <Text style={[styles.resultVal, { color: colors.success }]}>₦50,000</Text>
                  </View>
                  <View style={[styles.resultRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Text style={[styles.resultKey, { color: colors.mutedForeground }]}>Balance Cap</Text>
                    <Text style={[styles.resultVal, { color: colors.success }]}>₦300,000</Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.resultSub, { color: colors.mutedForeground }]}>
                  The phone number you entered doesn't match the number registered with your NIN.
                  You can still create your account, but transactions will be restricted until you resolve this.
                </Text>
                <View style={[styles.warningBox, { backgroundColor: colors.warning + "15", borderColor: colors.warning + "44" }]}>
                  <Text style={[styles.warningText, { color: colors.warning }]}>
                    ⚠️  To unlock transactions, visit a NIMC enrolment centre to update your registered phone number, or use the number linked to your NIN.
                  </Text>
                </View>
              </>
            )}

            <Pressable
              onPress={proceed}
              style={({ pressed }) => [
                styles.btn,
                {
                  backgroundColor: state === "success_match" ? colors.primary : colors.warning,
                  opacity: pressed ? 0.85 : 1,
                  marginTop: 8,
                },
              ]}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>
                {state === "success_match" ? "Continue" : "Continue with Restricted Account"}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1C3D" },
  back: { padding: 20 },
  scroll: { paddingHorizontal: 24, paddingTop: 4 },
  header: { gap: 12, marginBottom: 32, alignItems: "flex-start" },
  iconWrap: { width: 60, height: 60, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
  input: { height: 58, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 20, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  errText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  infoBox: { borderRadius: 12, borderWidth: 1, padding: 14 },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  btn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  verifyingWrap: { alignItems: "center", gap: 16, paddingTop: 40 },
  verifyingTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  verifyingSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  resultWrap: { gap: 16, alignItems: "flex-start" },
  resultIcon: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  resultTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  resultSub: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  resultCard: { width: "100%", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  resultKey: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resultVal: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "right" },
  warningBox: { width: "100%", borderRadius: 12, borderWidth: 1, padding: 14 },
  warningText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
