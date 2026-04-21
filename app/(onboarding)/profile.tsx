import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import React, { useState } from "react";
import {
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

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { phone, countryCode, email, ninName, ninDob, ninNumber, phoneMatch } = useLocalSearchParams<{
    phone: string;
    countryCode: string;
    email: string;
    ninName?: string;
    ninDob?: string;
    ninNumber?: string;
    phoneMatch?: string;
  }>();

  const [name, setName] = useState(ninName ?? "");
  const [dob, setDob] = useState(ninDob ?? "");
  const [nameError, setNameError] = useState("");

  const ninPreFilled = !!ninName;

  function proceed() {
    if (name.trim().split(" ").length < 2) {
      setNameError("Please enter your full name (first & last)");
      return;
    }
    router.push({
      pathname: "/(onboarding)/pin",
      params: { phone, countryCode, email, name: name.trim(), dob, ninNumber: ninNumber ?? "", phoneMatch: phoneMatch ?? "true" },
    });
  }

  const isReady = name.trim().length > 3;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <ArrowLeft size={22} color={colors.foreground} strokeWidth={1.8} />
      </Pressable>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.steps}>
          {[1, 2, 3, 4, 5].map((s) => (
            <View
              key={s}
              style={[styles.step, { backgroundColor: s <= 3 ? colors.primary : colors.border }]}
            />
          ))}
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Your profile</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {ninPreFilled
              ? "We've pre-filled your details from your NIN — review and confirm"
              : "Tell us a little about yourself"}
          </Text>
        </View>

        {ninPreFilled && (
          <View style={[styles.ninBadge, { backgroundColor: colors.success + "1A", borderColor: colors.success + "44" }]}>
            <Text style={[styles.ninBadgeText, { color: colors.success }]}>
              ✓ Name verified via NIN — this field cannot be edited
            </Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Full Name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: ninPreFilled ? colors.muted : colors.card,
                  borderColor: nameError ? colors.destructive : ninPreFilled ? colors.success + "66" : colors.border,
                  color: ninPreFilled ? colors.foreground : colors.foreground,
                  opacity: ninPreFilled ? 0.9 : 1,
                },
              ]}
              placeholder="e.g. Amara Johnson"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={ninPreFilled ? undefined : (t) => { setName(t); setNameError(""); }}
              editable={!ninPreFilled}
              autoCapitalize="words"
              autoFocus={!ninPreFilled}
            />
            {ninPreFilled && (
              <Text style={[styles.lockedHint, { color: colors.success }]}>🔒 Sourced from NIMC — read only</Text>
            )}
            {!!nameError && <Text style={[styles.errText, { color: colors.destructive }]}>{nameError}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Date of Birth</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="DD / MM / YYYY"
              placeholderTextColor={colors.mutedForeground}
              value={dob}
              onChangeText={setDob}
              keyboardType="numeric"
              maxLength={14}
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) + (Platform.OS === "web" ? 34 : 0) }]}>
        <Pressable
          onPress={proceed}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: isReady ? colors.primary : colors.muted, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.btnText, { color: isReady ? "#fff" : colors.mutedForeground }]}>
            Continue
          </Text>
          <ArrowRight size={18} color={isReady ? "#fff" : colors.mutedForeground} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1C3D" },
  back: { padding: 20 },
  scroll: { paddingHorizontal: 24, paddingBottom: 20 },
  steps: { flexDirection: "row", gap: 6, marginBottom: 28, marginTop: 4 },
  step: { flex: 1, height: 4, borderRadius: 2 },
  header: { gap: 8, marginBottom: 20 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  ninBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20 },
  ninBadgeText: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
  input: { height: 56, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontFamily: "Inter_400Regular" },
  errText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  lockedHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  footer: { padding: 20 },
  btn: { height: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
