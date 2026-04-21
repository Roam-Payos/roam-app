import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { PinKeypad } from "@/components/PinKeypad";
import { COUNTRIES } from "@/context/RoamContext";

export default function PinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { phone, countryCode, email, name, dob, ninNumber, phoneMatch } = useLocalSearchParams<{
    phone: string; countryCode: string; email: string; name: string; dob: string; ninNumber?: string; phoneMatch?: string;
  }>();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [error, setError] = useState("");

  function handlePinComplete(val: string) {
    setPin(val);
    setStep("confirm");
    setConfirm("");
  }

  function handleConfirmComplete(val: string) {
    if (val !== pin) {
      setError("PINs do not match. Try again.");
      setConfirm("");
      return;
    }
    router.push({
      pathname: "/(onboarding)/kyc",
      params: { phone, countryCode, email, name, dob, pin, ninNumber: ninNumber ?? "", phoneMatch: phoneMatch ?? "true" },
    });
  }

  function goBack() {
    if (step === "confirm") {
      setStep("create");
      setPin("");
      setConfirm("");
      setError("");
    } else {
      router.back();
    }
  }

  const current = step === "create" ? pin : confirm;
  const setCurrent = step === "create" ? setPin : setConfirm;
  const onComplete = step === "create" ? handlePinComplete : handleConfirmComplete;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <Pressable onPress={goBack} style={styles.back}>
        <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {step === "create" ? "Create your PIN" : "Confirm your PIN"}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {step === "create"
            ? "This 4-digit PIN secures your wallet and authorises transactions"
            : "Re-enter your PIN to confirm"}
        </Text>
      </View>

      {!!error && (
        <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
      )}

      <View style={styles.keypadWrap}>
        <PinKeypad
          value={current}
          maxLength={4}
          onChange={setCurrent}
          onSubmit={onComplete}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1C3D" },
  back: { padding: 20 },
  backText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  header: { paddingHorizontal: 24, gap: 10, marginBottom: 8 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  error: { textAlign: "center", fontSize: 13, fontFamily: "Inter_400Regular", paddingHorizontal: 24 },
  keypadWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 40 },
});
