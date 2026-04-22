import { ArrowLeft, BaggageClaim, Bus, Hotel, Package, Plane, Shield, Smartphone } from "lucide-react-native";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useColors } from "@/hooks/useColors";

const SERVICES = [
  {
    id: "flights",
    label: "Flights",
    icon: Plane,
    color: "#6366F1",
    desc: "Inter-Africa routes",
    route: "/arrive/flights",
  },
  {
    id: "bus",
    label: "Bus / Transport",
    icon: Bus,
    color: "#8B5CF6",
    desc: "from ₦2,800",
    route: "/arrive/bus",
  },
  {
    id: "hotels",
    label: "Hotels",
    icon: Hotel,
    color: "#F97316",
    desc: "from ₦32,000/night",
    route: "/arrive/hotels",
  },
  {
    id: "rides",
    label: "Airport Ride",
    icon: BaggageClaim,
    color: "#0EA5E9",
    desc: "from ₦25,000",
    route: "/arrive/rides",
  },
  {
    id: "insurance",
    label: "Insurance",
    icon: Shield,
    color: "#10B981",
    desc: "from ₦3,500",
    route: "/arrive/insurance",
  },
  {
    id: "sim",
    label: "Data & SIM",
    icon: Smartphone,
    color: "#EC4899",
    desc: "from ₦2,000",
    route: "/airtime",
    external: true,
  },
];

export default function ArriveHubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cityId, cityName, country, flag, airport, symbol } = useLocalSearchParams<{
    cityId: string; cityName: string; country: string; flag: string; airport: string; symbol: string;
  }>();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + 24;

  function handleService(svc: typeof SERVICES[0]) {
    if (svc.external) {
      router.push(svc.route as any);
      return;
    }
    router.push({
      pathname: svc.route as any,
      params: { cityId, cityName, country, flag, airport, symbol },
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: botPad }}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ArrowLeft size={18} color={colors.foreground} strokeWidth={2} />
          </Pressable>
          <View style={styles.headerTextBlock}>
            <View style={styles.flagRow}>
              <Text style={styles.flag}>{flag}</Text>
              <Text style={[styles.cityLabel, { color: colors.mutedForeground }]}>{country}</Text>
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Welcome to {cityName}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Plan your perfect arrival</Text>
          </View>
        </View>

        <View style={[styles.arrivalCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
          <Text style={[styles.arrivalCardTitle, { color: colors.foreground }]}>Your Arrival Hub</Text>
          <Text style={[styles.arrivalCardSub, { color: colors.mutedForeground }]}>
            Everything you need when you land in {cityName} — book individually or save 15% with the Arrival Bundle.
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Services</Text>

        <View style={styles.servicesGrid}>
          {SERVICES.map(svc => {
            const Icon = svc.icon;
            return (
              <Pressable
                key={svc.id}
                onPress={() => handleService(svc)}
                style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.serviceIcon, { backgroundColor: svc.color + "20" }]}>
                  <Icon size={24} color={svc.color} strokeWidth={1.8} />
                </View>
                <Text style={[styles.serviceLabel, { color: colors.foreground }]}>{svc.label}</Text>
                <Text style={[styles.serviceDesc, { color: colors.mutedForeground }]}>{svc.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Best Value</Text>

        <Pressable
          onPress={() => router.push({ pathname: "/arrive/bundle", params: { cityId, cityName, country, flag, airport, symbol } })}
          style={[styles.bundleCard, { backgroundColor: colors.primary }]}
        >
          <View style={styles.bundleLeft}>
            <Package size={28} color="#fff" strokeWidth={1.8} />
            <View style={{ marginLeft: 14 }}>
              <Text style={styles.bundleTitle}>Arrival Bundle</Text>
              <Text style={styles.bundleSub}>Hotel + Ride + Insurance · Save 15%</Text>
            </View>
          </View>
          <View style={styles.bundleArrow}>
            <Text style={styles.bundleArrowText}>→</Text>
          </View>
        </Pressable>

        <View style={[styles.trustRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { emoji: "✅", label: "Fixed Pricing" },
            { emoji: "🔒", label: "Secure Payment" },
            { emoji: "📞", label: "24/7 Support" },
          ].map(t => (
            <View key={t.label} style={styles.trustItem}>
              <Text style={styles.trustEmoji}>{t.emoji}</Text>
              <Text style={[styles.trustLabel, { color: colors.mutedForeground }]}>{t.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  headerTextBlock: {},
  flagRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  flag: { fontSize: 22 },
  cityLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
  arrivalCard: { marginHorizontal: 20, padding: 18, borderRadius: 16, borderWidth: 1, marginBottom: 28 },
  arrivalCardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 6 },
  arrivalCardSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, marginLeft: 20, marginBottom: 12 },
  servicesGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12, marginBottom: 28 },
  serviceCard: { width: "47%", borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  serviceIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  serviceLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  serviceDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  bundleCard: { marginHorizontal: 20, borderRadius: 18, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28 },
  bundleLeft: { flexDirection: "row", alignItems: "center" },
  bundleTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  bundleSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  bundleArrow: { backgroundColor: "rgba(255,255,255,0.2)", width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  bundleArrowText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  trustRow: { marginHorizontal: 20, borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: "row", justifyContent: "space-around" },
  trustItem: { alignItems: "center", gap: 6 },
  trustEmoji: { fontSize: 20 },
  trustLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
});
