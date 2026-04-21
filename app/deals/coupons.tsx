/**
 * My Coupons Screen — Active, Used, Expired tabs
 */
import { router } from "expo-router";
import { ArrowLeft, Ticket } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoam } from "@/context/RoamContext";
import { useColors } from "@/hooks/useColors";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const CURRENCY_SYMBOL: Record<string, string> = { NGN: "₦", GHS: "₵", KES: "KSh", ZAR: "R", USD: "$" };

const TABS = ["active", "used", "expired"] as const;
type TabKey = (typeof TABS)[number];

type Coupon = {
  id: string; code: string; status: string; amount_paid: number; currency: string;
  created_at: string; expires_at: string; used_at?: string;
  title: string; merchant_name: string; category?: string; discount_percent: number;
  loyalty_points: number; city?: string;
};

export default function CouponsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useRoam();

  const [activeTab,  setActiveTab]  = useState<TabKey>("active");
  const [coupons,    setCoupons]    = useState<Coupon[]>([]);
  const [counts,     setCounts]     = useState({ active: 0, used: 0, expired: 0 });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!user) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${API}/roam/deals/coupons/${user.id}`);
      const data = await res.json();
      setCoupons(data.coupons ?? []);
      setCounts({ active: data.active ?? 0, used: data.used ?? 0, expired: data.expired ?? 0 });
    } catch {}
    if (refresh) setRefreshing(false); else setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const filtered = coupons.filter((c) => c.status === activeTab);
  const topPad   = insets.top + 12;

  function renderCoupon({ item: c }: { item: Coupon }) {
    const symbol  = CURRENCY_SYMBOL[c.currency] ?? c.currency;
    const isUsed  = c.status === "used";
    const isExp   = c.status === "expired";
    const opacity = isUsed || isExp ? 0.6 : 1;

    return (
      <Pressable
        onPress={() => !isUsed && !isExp && router.push(`/deals/${c.id}` as never)}
        style={[styles.couponCard, { backgroundColor: colors.card, borderColor: colors.border, opacity }]}
      >
        {/* Coupon-style left notch decoration */}
        <View style={[styles.leftTab, { backgroundColor: isUsed ? colors.success : isExp ? colors.destructive : colors.primary }]} />

        <View style={{ flex: 1, paddingLeft: 14, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.merchantName, { color: colors.mutedForeground }]} numberOfLines={1}>
                {c.merchant_name} {c.city ? `· ${c.city}` : ""}
              </Text>
              <Text style={[styles.dealTitle, { color: colors.foreground }]} numberOfLines={2}>
                {c.title}
              </Text>
            </View>
            <View style={[styles.discountBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.discountText}>{c.discount_percent}%</Text>
            </View>
          </View>

          {/* Code row */}
          <View style={[styles.codeRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ticket size={12} color={colors.primary} />
            <Text style={[styles.codeText, { color: colors.primary }]}>{c.code}</Text>
            {isUsed && <Text style={[styles.usedTag, { color: colors.success }]}>✓ Used</Text>}
            {isExp  && <Text style={[styles.usedTag, { color: colors.destructive }]}>Expired</Text>}
          </View>

          <View style={styles.footerRow}>
            {c.loyalty_points > 0 && (
              <Text style={[styles.ptsText, { color: "#F97316" }]}>
                {isUsed ? `+${c.loyalty_points} pts earned` : `Earn ${c.loyalty_points} pts on use`}
              </Text>
            )}
            <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
              {isUsed && c.used_at
                ? `Used ${new Date(c.used_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`
                : `Exp ${new Date(c.expires_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>🎟 My Coupons</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tab,
              activeTab === tab && [styles.tabActive, { borderColor: colors.primary }],
            ]}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            <View style={[
              styles.tabBadge,
              { backgroundColor: activeTab === tab ? colors.primary : colors.muted },
            ]}>
              <Text style={[styles.tabBadgeText, { color: activeTab === tab ? "#fff" : colors.mutedForeground }]}>
                {counts[tab]}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
          }
          renderItem={renderCoupon}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 42 }}>🎟️</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No {activeTab} coupons yet
              </Text>
              {activeTab === "active" && (
                <Pressable
                  onPress={() => router.push("/deals" as never)}
                  style={[styles.browseBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.browseBtnText}>Browse Hot Deals</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },

  tabBar: {
    flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 8,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabActive:   { borderBottomWidth: 2 },
  tabText:     { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabBadge:    { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: "center" },
  tabBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  couponCard: {
    borderRadius: 16, borderWidth: 1, flexDirection: "row",
    overflow: "hidden", minHeight: 110,
  },
  leftTab: { width: 6 },

  merchantName:  { fontSize: 11, fontFamily: "Inter_400Regular" },
  dealTitle:     { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 19, marginTop: 2 },
  discountBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  discountText:  { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },

  codeRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: "flex-start",
  },
  codeText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1.5 },
  usedTag:  { fontSize: 11, fontFamily: "Inter_600SemiBold", marginLeft: 6 },

  footerRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  amtText:   { fontSize: 12, fontFamily: "Inter_400Regular" },
  ptsText:   { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  dateText:  { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: "auto" },

  empty:       { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText:   { fontSize: 15, fontFamily: "Inter_500Medium" },
  browseBtn:   { marginTop: 8, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  browseBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
