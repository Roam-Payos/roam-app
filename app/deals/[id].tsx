/**
 * Deal Detail Screen
 * Shows full deal info with pay & use + save-for-later actions.
 */
import { router, useLocalSearchParams } from "expo-router";
import { Linking } from "react-native";
import {
  ArrowLeft, MapPin, Clock, Star, Ticket, CheckCircle, Store, Globe, ExternalLink,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoam } from "@/context/RoamContext";
import { useColors } from "@/hooks/useColors";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const CURRENCY_SYMBOL: Record<string, string> = { NGN: "₦", GHS: "₵", KES: "KSh", ZAR: "R", USD: "$" };

const CATEGORY_EMOJI: Record<string, string> = {
  Food: "🍔", Travel: "✈️", Shopping: "🛍️", Entertainment: "🎬", Health: "💊", Telecom: "📶",
};

type Deal = {
  id: string; merchant_name: string; city?: string; country: string; title: string;
  description?: string; category?: string; price: number; discount_percent: number;
  discounted_price: number; loyalty_points: number; currency: string;
  lat?: number; lng?: number; end_date: string; status: string;
  redemption_type?: "in_store" | "online" | "both";
  coupon_url?: string;
};

type Coupon = {
  id: string; code: string; qr_data: string; expires_at: string;
  loyalty_points_earned: number;
};

function daysLeft(d: string) {
  return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));
}

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user } = useRoam();

  const [deal,      setDeal]      = useState<Deal | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [claiming,  setClaiming]  = useState(false);
  const [coupon,    setCoupon]    = useState<Coupon | null>(null);
  const [loyaltyOnRedeem, setLoyaltyOnRedeem] = useState(0);

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/roam/deals/${id}`)
      .then((r) => r.json())
      .then((d) => { setDeal(d.deal ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleClaim() {
    if (!deal || !user) return;
    setClaiming(true);
    try {
      const res = await fetch(`${API}/roam/deals/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: String(user.id), dealId: deal.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert(
          data.error === "You already have this coupon saved." ? "Already Saved" : "Claim Failed",
          data.error ?? "Unable to claim deal.",
        );
        return;
      }
      setLoyaltyOnRedeem(data.loyaltyPointsOnRedeem ?? 0);
      setCoupon({
        id: data.coupon.id,
        code: data.coupon.code,
        qr_data: data.coupon.qrData,
        expires_at: data.coupon.expiresAt,
        loyalty_points_earned: 0,
      });
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!deal) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errText, { color: colors.destructive }]}>Deal not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const symbol  = CURRENCY_SYMBOL[deal.currency] ?? deal.currency;
  const emoji   = CATEGORY_EMOJI[deal.category ?? ""] ?? "🏷️";
  const days    = daysLeft(deal.end_date);
  const urgent  = days <= 3;
  const saving  = Number(deal.price) - Number(deal.discounted_price);

  // ── Coupon success view ───────────────────────────────────────────────────
  if (coupon) {
    const rt = deal.redemption_type ?? "both";
    const showInStore  = rt === "in_store" || rt === "both";
    const showOnline   = rt === "online"   || rt === "both";
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.successIcon, { backgroundColor: "#10B981" + "18" }]}>
              <CheckCircle size={48} color="#10B981" strokeWidth={1.5} />
            </View>
            <Text style={[styles.successTitle, { color: colors.foreground }]}>Coupon Saved! 🎉</Text>
            <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
              Show this code when you shop at {deal.merchant_name} to get your discount.
            </Text>

            {/* Coupon code */}
            <View style={[styles.couponBox, { backgroundColor: colors.background, borderColor: colors.primary }]}>
              <Ticket size={20} color={colors.primary} />
              <Text style={[styles.couponCode, { color: colors.primary }]}>{coupon.code}</Text>
            </View>

            {/* Redemption instructions */}
            {showInStore && (
              <View style={[styles.redeemBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.redeemHeader}>
                  <Store size={16} color={colors.foreground} strokeWidth={2} />
                  <Text style={[styles.redeemTitle, { color: colors.foreground }]}>Redeem In-Store</Text>
                </View>
                <Text style={[styles.redeemSub, { color: colors.mutedForeground }]}>
                  Visit any {deal.merchant_name} branch and show this coupon code to the cashier before paying.
                </Text>
              </View>
            )}

            {showOnline && (
              <View style={[styles.redeemBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.redeemHeader}>
                  <Globe size={16} color={colors.foreground} strokeWidth={2} />
                  <Text style={[styles.redeemTitle, { color: colors.foreground }]}>Redeem Online</Text>
                </View>
                <Text style={[styles.redeemSub, { color: colors.mutedForeground }]}>
                  Add items to your cart, go to checkout, and paste your coupon code in the discount field.
                </Text>
                {deal.coupon_url ? (
                  <Pressable
                    onPress={() => Linking.openURL(deal.coupon_url!)}
                    style={[styles.shopBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary }]}
                  >
                    <ExternalLink size={14} color={colors.primary} strokeWidth={2} />
                    <Text style={[styles.shopBtnText, { color: colors.primary }]}>Shop Online at {deal.merchant_name}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            {/* Loyalty — shown as promise, earned at redemption */}
            {loyaltyOnRedeem > 0 && (
              <View style={[styles.loyaltyBadge, { backgroundColor: "#F97316" + "18" }]}>
                <Star size={14} color="#F97316" strokeWidth={2} />
                <Text style={[styles.loyaltyText, { color: "#F97316" }]}>
                  Earn {loyaltyOnRedeem} loyalty points when you use this coupon
                </Text>
              </View>
            )}

            <Text style={[styles.expiryNote, { color: colors.mutedForeground }]}>
              Expires: {new Date(coupon.expires_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
            </Text>

            <Pressable
              onPress={() => router.push("/deals/coupons" as never)}
              style={[styles.ctaBtn, { backgroundColor: colors.primary, width: "100%" }]}
            >
              <Text style={styles.ctaBtnText}>View All My Coupons</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/deals" as never)} style={{ marginTop: 8 }}>
              <Text style={[styles.backLink, { color: colors.mutedForeground }]}>Back to Hot Deals</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Deal detail view ──────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header banner */}
        <View style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border, paddingTop: insets.top + 16 }]}>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/deals" as never)}
            style={[styles.backBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
          >
            <ArrowLeft size={18} color={colors.foreground} strokeWidth={2.5} />
          </Pressable>

          <View style={[styles.bannerIcon, { backgroundColor: colors.background }]}>
            <Text style={{ fontSize: 52 }}>{emoji}</Text>
          </View>

          <View style={[styles.discountBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.discountBadgeText}>{deal.discount_percent}% OFF</Text>
          </View>
        </View>

        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.merchantName, { color: colors.mutedForeground }]}>{deal.merchant_name}</Text>
          <Text style={[styles.dealTitle, { color: colors.foreground }]}>{deal.title}</Text>

          {deal.description ? (
            <Text style={[styles.description, { color: colors.mutedForeground }]}>{deal.description}</Text>
          ) : null}

          {/* Price breakdown */}
          <View style={[styles.priceBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Original Price</Text>
              <Text style={[styles.oldPriceText, { color: colors.mutedForeground }]}>
                {symbol}{Number(deal.price).toLocaleString()}
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Your Price</Text>
              <Text style={[styles.newPriceText, { color: colors.primary }]}>
                {symbol}{Number(deal.discounted_price).toLocaleString()}
              </Text>
            </View>
            <View style={[styles.savingsRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.savingsLabel, { color: "#10B981" }]}>You Save</Text>
              <Text style={[styles.savingsValue, { color: "#10B981" }]}>
                {symbol}{saving.toLocaleString()} ({deal.discount_percent}%)
              </Text>
            </View>
          </View>

          {/* Meta row */}
          <View style={styles.metaRow}>
            {deal.city ? (
              <View style={styles.metaItem}>
                <MapPin size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{deal.city}</Text>
              </View>
            ) : null}
            <View style={[styles.metaItem, urgent ? { backgroundColor: colors.destructive + "10" } : {}]}>
              <Clock size={14} color={urgent ? colors.destructive : colors.mutedForeground} />
              <Text style={[styles.metaText, { color: urgent ? colors.destructive : colors.mutedForeground }]}>
                {days === 0 ? "Expires today!" : `${days} days left`}
              </Text>
            </View>
          </View>

          {/* Loyalty points */}
          {deal.loyalty_points > 0 && (
            <View style={[styles.loyaltyCard, { backgroundColor: "#F97316" + "12", borderColor: "#F97316" + "30" }]}>
              <Star size={18} color="#F97316" fill="#F97316" />
              <View>
                <Text style={[styles.loyaltyTitle, { color: "#F97316" }]}>
                  Earn {deal.loyalty_points} Loyalty Points
                </Text>
                <Text style={[styles.loyaltySub, { color: colors.mutedForeground }]}>
                  Credited when you redeem in-store or online
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA footer */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleClaim}
          disabled={claiming}
          style={({ pressed }) => [
            styles.ctaBtn, styles.ctaBtnFull,
            { backgroundColor: claiming ? colors.muted : colors.primary, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          {claiming ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaBtnText}>Save Coupon – Free</Text>
          )}
        </Pressable>
        <Text style={[styles.backLink, { color: colors.mutedForeground, textAlign: "center", marginTop: 6, fontSize: 12 }]}>
          Use in-store or online · Earn {deal.loyalty_points} pts when you redeem
        </Text>
        <Pressable onPress={() => router.push("/deals/coupons" as never)} style={{ marginTop: 4 }}>
          <Text style={[styles.backLink, { color: colors.mutedForeground, textAlign: "center" }]}>View My Coupons</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center" },
  errText:   { fontSize: 16, fontFamily: "Inter_500Medium" },

  banner: {
    alignItems: "center", paddingBottom: 32, borderBottomWidth: 1, position: "relative",
  },
  backBtn: {
    position: "absolute", left: 16, top: 56, zIndex: 10,
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  bannerIcon: {
    width: 100, height: 100, borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  discountBadge: {
    marginTop: 12, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 5,
  },
  discountBadgeText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

  infoCard: { margin: 16, borderRadius: 20, borderWidth: 1, padding: 20, gap: 14 },
  merchantName: { fontSize: 12, fontFamily: "Inter_400Regular" },
  dealTitle: { fontSize: 20, fontFamily: "Inter_700Bold", lineHeight: 26 },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },

  priceBox: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  priceRow: { flexDirection: "row", justifyContent: "space-between" },
  priceLabel:   { fontSize: 13, fontFamily: "Inter_400Regular" },
  oldPriceText: { fontSize: 13, fontFamily: "Inter_400Regular", textDecorationLine: "line-through" },
  newPriceText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  savingsRow:   { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, marginTop: 2 },
  savingsLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  savingsValue: { fontSize: 14, fontFamily: "Inter_700Bold" },

  metaRow:  { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  metaText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  loyaltyCard:  { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  loyaltyTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  loyaltySub:   { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  ctaBtn:     { borderRadius: 14, height: 54, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  ctaBtnFull: { width: "100%" },
  ctaBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  backLink:   { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },

  successCard:  { margin: 24, borderRadius: 24, borderWidth: 1, padding: 28, alignItems: "center", gap: 16 },
  successIcon:  { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  successSub:   { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  couponBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, borderWidth: 2, borderStyle: "dashed",
    paddingHorizontal: 24, paddingVertical: 16,
  },
  couponCode: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: 3 },
  loyaltyBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  loyaltyText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  expiryNote:  { fontSize: 12, fontFamily: "Inter_400Regular" },

  redeemBlock: { width: "100%", borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  redeemHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  redeemTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  redeemSub:   { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  shopBtn:     { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  shopBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
