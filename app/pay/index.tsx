import { router } from "expo-router";
import { Banknote, ChevronRight, Sparkles, X } from "lucide-react-native";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function PayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad    = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = Math.max(insets.bottom, 24) + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} style={s.closeBtn}>
          <X size={22} color={colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Pay Merchant</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Subtitle */}
      <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
        Choose how you want to pay
      </Text>

      {/* Options */}
      <View style={[s.options, { paddingBottom: bottomPad }]}>

        {/* PAYOSONE Code */}
        <Pressable
          onPress={() => router.push("/pay/payosone")}
          style={({ pressed }) => [s.card, {
            backgroundColor: "#6D28D9" + "12",
            borderColor: "#6D28D9" + "55",
            opacity: pressed ? 0.82 : 1,
          }]}
        >
          <View style={[s.iconWrap, { backgroundColor: "#6D28D9" + "22" }]}>
            <Sparkles size={28} color="#6D28D9" strokeWidth={1.7} />
          </View>
          <View style={s.cardBody}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>Pay by PAYOSONE Code</Text>
            <Text style={[s.cardSub, { color: colors.mutedForeground }]}>
              Enter the P1-XXXXXX code displayed at any PayOs-registered merchant
            </Text>
            <View style={[s.badge, { backgroundColor: "#6D28D9" + "22" }]}>
              <Text style={[s.badgeText, { color: "#6D28D9" }]}>✓ PayOs Verified Merchant</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#6D28D9" strokeWidth={2} />
        </Pressable>

        {/* Divider */}
        <View style={s.orRow}>
          <View style={[s.orLine, { backgroundColor: colors.border }]} />
          <Text style={[s.orText, { color: colors.mutedForeground }]}>or</Text>
          <View style={[s.orLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Bank Account */}
        <Pressable
          onPress={() => router.push("/pay/bank")}
          style={({ pressed }) => [s.card, {
            backgroundColor: "#10B981" + "10",
            borderColor: "#10B981" + "44",
            opacity: pressed ? 0.82 : 1,
          }]}
        >
          <View style={[s.iconWrap, { backgroundColor: "#10B981" + "22" }]}>
            <Banknote size={28} color="#10B981" strokeWidth={1.7} />
          </View>
          <View style={s.cardBody}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>Pay by Bank Account</Text>
            <Text style={[s.cardSub, { color: colors.mutedForeground }]}>
              Send directly to any Nigerian bank account — merchant doesn't need PayOs
            </Text>
            <View style={[s.badge, { backgroundColor: "#10B981" + "18" }]}>
              <Text style={[s.badgeText, { color: "#10B981" }]}>⚡ Instant NIP Settlement · ₦50 fee</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#10B981" strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header:    {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 4,
  },
  closeBtn:  { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title:     { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  subtitle:  { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 28, marginTop: 4 },
  options:   { flex: 1, paddingHorizontal: 16, gap: 0, justifyContent: "center" },
  card:      {
    borderRadius: 20, borderWidth: 1.5,
    padding: 20, flexDirection: "row", alignItems: "center", gap: 16,
  },
  iconWrap:  { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cardBody:  { flex: 1, gap: 6 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  cardSub:   { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  badge:     { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 2 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  orRow:     { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  orLine:    { flex: 1, height: 1 },
  orText:    { fontSize: 13, fontFamily: "Inter_400Regular" },
});
