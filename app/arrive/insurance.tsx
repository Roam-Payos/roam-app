import { ArrowLeft, CheckCircle } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useRoam } from "@/context/RoamContext";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface InsurancePlan {
  id: string;
  name: string;
  price: number;
  coverage_days: number;
  features: string[];
  emoji: string;
}

const PLAN_COLORS: Record<string, string> = {
  Basic: "#6366F1",
  Standard: "#F97316",
  Premium: "#10B981",
};

export default function ArriveInsuranceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cityName, flag } = useLocalSearchParams<{ cityName: string; flag: string }>();
  const { user, syncBalance, getAuthHeaders } = useRoam();
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + 24;

  useEffect(() => {
    fetch(`${API}/arrive/insurance`)
      .then(r => r.json())
      .then(d => setPlans(d.plans ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handlePurchase(plan: InsurancePlan) {
    if (!user) return;
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + plan.coverage_days);

    Alert.alert(
      `${plan.name} Travel Insurance`,
      `${plan.coverage_days}-day coverage\nExpires: ${expiresDate.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}\n\nCost: ₦${plan.price.toLocaleString()}\n\nPay from Roam Wallet?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Purchase",
          onPress: async () => {
            setPurchasing(plan.id);
            try {
              const r = await fetch(`${API}/arrive/insurance/purchase`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ userId: user.id, planId: plan.id, cityName }),
              });
              const data = await r.json();
              if (!r.ok) throw new Error(data.error || "Purchase failed");
              await syncBalance();
              Alert.alert(
                "Insurance Active! 🛡",
                `${plan.name} plan activated\n\nRef: ${data.txRef}\nExpires: ${data.expiresAt}\n\nYou're covered for ${plan.coverage_days} days. Travel safe!`,
                [{ text: "Done", onPress: () => router.back() }]
              );
            } catch (err: any) {
              Alert.alert("Purchase Failed", err.message || "Please try again.");
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: botPad }}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ArrowLeft size={18} color={colors.foreground} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Travel Insurance {flag ? `for ${cityName} ${flag}` : ""}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            30-day coverage · Active immediately
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} size="large" />
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 16 }}>
            {plans.map(plan => {
              const accentColor = PLAN_COLORS[plan.name] ?? colors.primary;
              const features: string[] = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features as any);
              return (
                <View key={plan.id} style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.planHeader, { backgroundColor: accentColor + "18" }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={styles.planEmoji}>{plan.emoji}</Text>
                      <View>
                        <Text style={[styles.planName, { color: accentColor }]}>{plan.name}</Text>
                        <Text style={[styles.planDays, { color: colors.mutedForeground }]}>{plan.coverage_days} days</Text>
                      </View>
                    </View>
                    <View>
                      <Text style={[styles.planPrice, { color: accentColor }]}>₦{plan.price.toLocaleString()}</Text>
                      <Text style={[styles.planPriceLabel, { color: colors.mutedForeground }]}>one-time</Text>
                    </View>
                  </View>

                  <View style={{ padding: 16, gap: 10 }}>
                    {features.map((feature, idx) => (
                      <View key={idx} style={styles.featureRow}>
                        <CheckCircle size={14} color={accentColor} strokeWidth={2} />
                        <Text style={[styles.featureText, { color: colors.foreground }]}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                    <Pressable
                      onPress={() => handlePurchase(plan)}
                      disabled={purchasing === plan.id}
                      style={[styles.purchaseBtn, { backgroundColor: accentColor, opacity: purchasing === plan.id ? 0.6 : 1 }]}
                    >
                      {purchasing === plan.id
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.purchaseBtnText}>Get {plan.name} — ₦{plan.price.toLocaleString()}</Text>
                      }
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={[styles.disclaimer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            🔒 Roam Travel Insurance is underwritten by PayOs Insurance Partners. Policy documents will be sent to your registered email address upon purchase.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  planCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  planEmoji: { fontSize: 28 },
  planName: { fontSize: 17, fontFamily: "Inter_700Bold" },
  planDays: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  planPrice: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "right" },
  planPriceLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  featureText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  purchaseBtn: { borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  purchaseBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  disclaimer: { margin: 20, borderRadius: 12, borderWidth: 1, padding: 14 },
  disclaimerText: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
