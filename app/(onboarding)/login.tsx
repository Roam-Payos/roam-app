import { router } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { ArrowLeft, Fingerprint } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { PinKeypad } from "@/components/PinKeypad";
import { useRoam, COUNTRIES } from "@/context/RoamContext";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, loginByBiometric } = useRoam();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"phone" | "pin">("phone");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<"fingerprint" | "face" | null>(null);

  useEffect(() => {
    checkBiometric();
  }, []);

  async function checkBiometric() {
    if (Platform.OS === "web") return;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        setBiometricAvailable(true);
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType("face");
        } else {
          setBiometricType("fingerprint");
        }
      }
    } catch {}
  }

  async function handleBiometricLogin() {
    setLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Sign in to Roam",
        cancelLabel: "Use PIN instead",
        disableDeviceFallback: false,
      });
      if (result.success) {
        const ok = await loginByBiometric();
        if (ok) {
          router.replace("/(tabs)/");
        } else {
          Alert.alert(
            "Biometric login unavailable",
            "You haven't enabled biometric login for this account. Please sign in with your PIN.",
          );
        }
      }
    } catch {
      Alert.alert("Error", "Biometric authentication failed. Please use your PIN.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePinSubmit(val: string) {
    setLoading(true);
    setLoginError("");
    const fullPhone = COUNTRIES[0].dialCode + phone.replace(/\D/g, "");
    const success = await login(fullPhone, val);
    setLoading(false);
    if (success) {
      router.replace("/(tabs)/");
    } else {
      const next = attempts + 1;
      setAttempts(next);
      setPin("");
      if (next >= 2) {
        setLoginError("Incorrect PIN or no account found. You can create a new account below.");
      } else {
        setLoginError("Incorrect phone number or PIN. Please try again.");
      }
    }
  }

  const padTop = insets.top + (Platform.OS === "web" ? 67 : 0);
  const padBottom = Math.max(insets.bottom, 24) + (Platform.OS === "web" ? 34 : 0);

  if (step === "pin") {
    return (
      <View style={[styles.container, { paddingTop: padTop }]}>
        <Pressable onPress={() => { setStep("phone"); setLoginError(""); setAttempts(0); }} style={styles.back}>
          <ArrowLeft size={22} color={colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Enter your PIN</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Welcome back! Enter your 4-digit PIN to access your wallet.
          </Text>
        </View>
        {!!loginError && (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "1A", borderColor: colors.destructive + "55" }]}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>{loginError}</Text>
            {attempts >= 2 && (
              <Pressable onPress={() => router.replace("/(onboarding)/welcome")} style={styles.errorLink}>
                <Text style={[styles.errorLinkText, { color: colors.primary }]}>Create a new account →</Text>
              </Pressable>
            )}
          </View>
        )}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.keypadWrap}>
            <PinKeypad value={pin} maxLength={4} onChange={setPin} onSubmit={handlePinSubmit} />
          </View>
        )}
        {biometricAvailable && !loading && (
          <View style={[styles.bioFooter, { paddingBottom: padBottom }]}>
            <Pressable
              onPress={handleBiometricLogin}
              style={[styles.bioBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Fingerprint size={20} color={colors.primary} strokeWidth={1.8} />
              <Text style={[styles.bioBtnText, { color: colors.foreground }]}>
                Use {biometricType === "face" ? "Face ID" : "Fingerprint"} instead
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: padTop }]}>
      <Pressable onPress={() => router.replace("/(onboarding)/welcome")} style={styles.back}>
        <ArrowLeft size={22} color={colors.foreground} strokeWidth={1.8} />
      </Pressable>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>Enter your phone number to sign in</Text>
      </View>
      <View style={styles.body}>
        <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.flag}>{COUNTRIES[0].flag}</Text>
          <Text style={[styles.dialCode, { color: colors.mutedForeground }]}>{COUNTRIES[0].dialCode}</Text>
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Phone number"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            autoFocus
          />
        </View>

        {biometricAvailable && (
          <Pressable
            onPress={handleBiometricLogin}
            disabled={loading}
            style={[styles.bioCard, { backgroundColor: colors.card, borderColor: colors.primary + "44" }]}
          >
            <View style={[styles.bioIcon, { backgroundColor: colors.primary + "1A" }]}>
              <Fingerprint size={24} color={colors.primary} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bioCardTitle, { color: colors.foreground }]}>
                {biometricType === "face" ? "Sign in with Face ID" : "Sign in with Fingerprint"}
              </Text>
              <Text style={[styles.bioCardSub, { color: colors.mutedForeground }]}>
                Use biometrics if you've enabled it for this account
              </Text>
            </View>
            {loading && <ActivityIndicator size="small" color={colors.primary} />}
          </Pressable>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: padBottom }]}>
        <Pressable
          onPress={() => setStep("pin")}
          disabled={phone.length < 8}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: phone.length >= 8 ? colors.primary : colors.muted, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.btnText, { color: phone.length >= 8 ? "#fff" : colors.mutedForeground }]}>
            Continue with PIN
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1C3D" },
  back: { padding: 20 },
  header: { paddingHorizontal: 24, gap: 10, marginBottom: 8 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 28, gap: 16 },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, height: 58, overflow: "hidden" },
  flag: { fontSize: 22, paddingLeft: 14 },
  dialCode: { fontSize: 15, fontFamily: "Inter_500Medium", paddingHorizontal: 8 },
  sep: { width: 1, height: 28 },
  input: { flex: 1, height: 58, paddingHorizontal: 14, fontSize: 16, fontFamily: "Inter_400Regular" },
  bioCard: { borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  bioIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bioCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  bioCardSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  footer: { padding: 20 },
  btn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  keypadWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  bioFooter: { padding: 20, paddingTop: 0 },
  errorBox: { marginHorizontal: 20, marginBottom: 8, padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  errorLink: { paddingTop: 2 },
  errorLinkText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  bioBtn: { height: 52, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  bioBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
