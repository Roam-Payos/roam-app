import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Mail, RefreshCw } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
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

export default function OtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { phone, countryCode, email } = useLocalSearchParams<{
    phone: string;
    countryCode: string;
    email: string;
  }>();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(59);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    sendCode();
  }, []);

  useEffect(() => {
    if (!sentOk) return;
    const interval = setInterval(() => setTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, [sentOk]);

  async function sendCode() {
    if (!email) {
      setError("No email address found. Please go back and try again.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send code. Please try again.");
      } else {
        setSentOk(true);
        setTimer(59);
      }
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function handleInput(text: string, idx: number) {
    const clean = text.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[idx] = clean;
    setOtp(next);
    setError("");
    if (clean && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  }

  function handleKeyPress(e: { nativeEvent: { key: string } }, idx: number) {
    if (e.nativeEvent.key === "Backspace" && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  async function verify() {
    const code = otp.join("");
    if (code.length < 6) {
      setError("Enter the 6-digit code sent to your email");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid code. Please try again.");
        setVerifying(false);
      } else {
        const dest = countryCode === "NG"
          ? "/(onboarding)/nin"
          : "/(onboarding)/profile";
        router.push({
          pathname: dest as never,
          params: { phone, countryCode, email },
        });
      }
    } catch {
      setError("Network error — please check your connection and try again.");
      setVerifying(false);
    }
  }

  async function resend() {
    if (timer > 0 || sending) return;
    setOtp(["", "", "", "", "", ""]);
    inputRefs.current[0]?.focus();
    await sendCode();
  }

  const maskedEmail = email
    ? email.replace(/^(.{2}).*(@.*)$/, "$1•••$2")
    : "your email";

  if (sending && !sentOk) {
    return (
      <View style={[styles.loading, { backgroundColor: "#0B1C3D" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Sending verification code…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <ArrowLeft size={22} color={colors.foreground} strokeWidth={1.8} />
      </Pressable>

      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + "1A" }]}>
          <Mail size={28} color={colors.primary} strokeWidth={1.8} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Check your email</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          We sent a 6-digit code to{"\n"}
          <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
            {maskedEmail}
          </Text>
        </Text>
      </View>

      <View style={styles.otpRow}>
        {otp.map((digit, idx) => (
          <TextInput
            key={idx}
            ref={(r) => { inputRefs.current[idx] = r; }}
            style={[
              styles.otpBox,
              {
                backgroundColor: digit ? colors.primary + "22" : colors.card,
                borderColor: error ? colors.destructive : digit ? colors.primary : colors.border,
                color: colors.foreground,
              },
            ]}
            value={digit}
            onChangeText={(t) => handleInput(t, idx)}
            onKeyPress={(e) => handleKeyPress(e, idx)}
            keyboardType="numeric"
            maxLength={1}
            selectTextOnFocus
            autoFocus={idx === 0}
            editable={!verifying}
          />
        ))}
      </View>

      {!!error && (
        <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) + (Platform.OS === "web" ? 34 : 0) }]}>
        <Pressable
          onPress={verify}
          disabled={verifying || otp.join("").length < 6}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: colors.primary,
              opacity: (pressed || verifying || otp.join("").length < 6) ? 0.7 : 1,
            },
          ]}
        >
          {verifying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.btnText}>Verify & Continue</Text>
          )}
        </Pressable>

        <Pressable onPress={resend} disabled={timer > 0 || sending} style={styles.resend}>
          {sending ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            <View style={styles.resendRow}>
              {timer === 0 && <RefreshCw size={14} color={colors.primary} strokeWidth={1.8} />}
              <Text style={[
                styles.resendText,
                { color: timer > 0 ? colors.mutedForeground : colors.primary },
              ]}>
                {timer > 0
                  ? `Resend code in 0:${String(timer).padStart(2, "0")}`
                  : "Resend code"}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1C3D" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  back: { padding: 20 },
  header: { paddingHorizontal: 24, gap: 12, alignItems: "flex-start" },
  iconWrap: { width: 60, height: 60, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  otpRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginTop: 36, justifyContent: "center" },
  otpBox: { width: 48, height: 56, borderRadius: 14, borderWidth: 1.5, textAlign: "center", fontSize: 22, fontFamily: "Inter_600SemiBold" },
  error: { textAlign: "center", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 10, paddingHorizontal: 24 },
  footer: { flex: 1, justifyContent: "flex-end", padding: 20, gap: 14 },
  btn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  resend: { alignItems: "center", minHeight: 24, justifyContent: "center" },
  resendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  resendText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
