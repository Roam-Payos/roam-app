import { router } from "expo-router";
import { ArrowRight, ChevronDown, Mail, Phone } from "lucide-react-native";
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
import { COUNTRIES, Country } from "@/context/RoamContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function PhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dupError, setDupError] = useState("");

  const phoneValid = phone.replace(/\D/g, "").length >= 8;
  const emailValid = isValidEmail(email);
  const isValid = phoneValid && emailValid;

  const emailError = emailTouched && email.length > 0 && !emailValid
    ? "Enter a valid email address"
    : "";

  async function proceed() {
    if (!isValid || checking) return;
    setDupError("");
    setChecking(true);

    const fullPhone = selectedCountry.dialCode + phone.replace(/\D/g, "");

    try {
      const res = await fetch(`${API_BASE}/roam/check-duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, email: email.trim().toLowerCase() }),
      });
      const data = await res.json() as { available: boolean; conflict?: string; message?: string };

      if (!data.available) {
        setDupError(data.message ?? "This account already exists. Please sign in.");
        setChecking(false);
        return;
      }
    } catch {
      // Network error — continue anyway, server will catch it on registration
    }

    setChecking(false);
    router.push({
      pathname: "/(onboarding)/otp",
      params: {
        phone: fullPhone,
        countryCode: selectedCountry.code,
        email: email.trim().toLowerCase(),
      },
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Create your{"\n"}Roam account</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          We'll send a verification code to your email to get started
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            <Phone size={12} color={colors.mutedForeground} strokeWidth={1.8} /> {"  "}Phone Number
          </Text>
          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              style={styles.countryBtn}
              onPress={() => setShowPicker(!showPicker)}
            >
              <Text style={styles.flag}>{selectedCountry.flag}</Text>
              <Text style={[styles.dialCode, { color: colors.foreground }]}>
                {selectedCountry.dialCode}
              </Text>
              <ChevronDown size={14} color={colors.mutedForeground} strokeWidth={1.8} />
            </Pressable>
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Phone number"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={15}
              autoFocus
            />
          </View>
        </View>

        {showPicker && (
          <View style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ScrollView>
              {COUNTRIES.map((c) => (
                <Pressable
                  key={c.code}
                  style={[
                    styles.pickerItem,
                    c.code === selectedCountry.code && { backgroundColor: colors.primary + "22" },
                  ]}
                  onPress={() => { setSelectedCountry(c); setShowPicker(false); }}
                >
                  <Text style={styles.flag}>{c.flag}</Text>
                  <Text style={[styles.pickerName, { color: colors.foreground }]}>{c.name}</Text>
                  <Text style={[styles.dialCode, { color: colors.mutedForeground }]}>{c.dialCode}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            <Mail size={12} color={colors.mutedForeground} strokeWidth={1.8} /> {"  "}Email Address
          </Text>
          <View style={[
            styles.emailRow,
            {
              backgroundColor: colors.card,
              borderColor: emailError ? colors.destructive : colors.border,
            },
          ]}>
            <TextInput
              style={[styles.emailInput, { color: colors.foreground }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onBlur={() => setEmailTouched(true)}
            />
          </View>
          {!!emailError && (
            <Text style={[styles.fieldError, { color: colors.destructive }]}>{emailError}</Text>
          )}
          <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
            Your verification code will be sent here
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) + (Platform.OS === "web" ? 34 : 0) }]}>
        {!!dupError && (
          <View style={[styles.dupErrorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "44" }]}>
            <Text style={[styles.dupErrorText, { color: colors.destructive }]}>{dupError}</Text>
          </View>
        )}

        <Pressable
          onPress={proceed}
          disabled={!isValid || checking}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: isValid && !checking ? colors.primary : colors.muted, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {checking
            ? <ActivityIndicator size="small" color="#fff" />
            : (
              <>
                <Text style={[styles.btnText, { color: isValid ? "#fff" : colors.mutedForeground }]}>
                  Send Verification Code
                </Text>
                <ArrowRight size={18} color={isValid ? "#fff" : colors.mutedForeground} strokeWidth={2} />
              </>
            )
          }
        </Pressable>

        <Pressable onPress={() => router.push("/(onboarding)/login")} style={styles.link}>
          <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
            Already have an account?{" "}
            <Text style={{ color: colors.primary }}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1C3D" },
  header: { paddingHorizontal: 24, paddingTop: 24, gap: 10 },
  title: { fontSize: 30, fontFamily: "Inter_700Bold", lineHeight: 38 },
  sub: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 28, gap: 20 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, overflow: "hidden", height: 58 },
  countryBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 6 },
  flag: { fontSize: 22 },
  dialCode: { fontSize: 15, fontFamily: "Inter_500Medium" },
  sep: { width: 1, height: 28 },
  input: { flex: 1, height: 58, paddingHorizontal: 14, fontSize: 16, fontFamily: "Inter_400Regular" },
  emailRow: { height: 58, borderRadius: 16, borderWidth: 1, justifyContent: "center", paddingHorizontal: 16 },
  emailInput: { fontSize: 16, fontFamily: "Inter_400Regular", height: 58 },
  picker: { borderRadius: 16, borderWidth: 1, maxHeight: 200, overflow: "hidden", marginTop: -12 },
  pickerItem: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  pickerName: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  fieldError: { fontSize: 12, fontFamily: "Inter_400Regular" },
  fieldHint: { fontSize: 12, fontFamily: "Inter_400Regular", opacity: 0.7 },
  footer: { padding: 20, gap: 16 },
  btn: { height: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  link: { alignItems: "center" },
  linkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  dupErrorBox: { borderRadius: 12, borderWidth: 1, padding: 12 },
  dupErrorText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, textAlign: "center" },
});
