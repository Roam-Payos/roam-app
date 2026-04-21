/**
 * DealCard — reusable card for Hot Deals module.
 * Supports two sizes: "large" (horizontal scroll featured) and "small" (2-col grid).
 * Shows FOMO signals: claim count, countdown timer, hot badge.
 */
import { MapPin, Clock, Flame, TrendingUp } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

export type Deal = {
  id: string;
  merchant_name: string;
  country: string;
  city?: string;
  title: string;
  description?: string;
  category?: string;
  price: number;
  discount_percent: number;
  discounted_price: number;
  loyalty_points: number;
  currency: string;
  end_date: string;
  distance_km?: number;
  claim_count?: number;
  seconds_remaining?: number;
};

type Props = {
  deal: Deal;
  size?: "large" | "small";
  onPress?: () => void;
  style?: ViewStyle;
};

const CATEGORY_EMOJI: Record<string, string> = {
  Food: "🍔", Travel: "✈️", Shopping: "🛍️", Entertainment: "🎬",
  Health: "💊", Telecom: "📶",
};

const CURRENCY_SYMBOL: Record<string, string> = {
  NGN: "₦", GHS: "₵", KES: "KSh", ZAR: "R", USD: "$",
};

function useCountdown(endDate: string) {
  const [secsLeft, setSecsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(endDate).getTime() - Date.now()) / 1000)),
  );
  useEffect(() => {
    if (secsLeft <= 0) return;
    const t = setInterval(() => {
      setSecsLeft(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return secsLeft;
}

function formatCountdown(secs: number) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 3) return null;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m ${String(s).padStart(2, "0")}s left`;
}

export default function DealCard({ deal, size = "small", onPress, style }: Props) {
  const colors  = useColors();
  const symbol  = CURRENCY_SYMBOL[deal.currency] ?? deal.currency;
  const emoji   = CATEGORY_EMOJI[deal.category ?? ""] ?? "🏷️";
  const secsLeft = useCountdown(deal.end_date);
  const countdown = formatCountdown(secsLeft);
  const isUrgent  = secsLeft > 0 && secsLeft < 86400 * 3;
  const isHot     = (deal.claim_count ?? 0) >= 10;
  const isLarge   = size === "large";

  const cardStyle = [
    styles.card,
    isLarge ? styles.cardLarge : styles.cardSmall,
    { backgroundColor: colors.card, borderColor: isHot ? "#F9731630" : colors.border },
    style,
  ];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [...cardStyle, { opacity: pressed ? 0.88 : 1 }]}
    >
      {/* Top row: discount badge + hot badge */}
      <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeText}>{deal.discount_percent}% OFF</Text>
        </View>
        {isHot && (
          <View style={[styles.badge, { backgroundColor: "#EF444420", flexDirection: "row", alignItems: "center", gap: 2 }]}>
            <Flame size={9} color="#EF4444" fill="#EF4444" />
            <Text style={[styles.badgeText, { color: "#EF4444" }]}>HOT</Text>
          </View>
        )}
      </View>

      {/* Emoji icon */}
      <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>

      {/* Merchant */}
      <Text style={[styles.merchant, { color: colors.mutedForeground }]} numberOfLines={1}>
        {deal.merchant_name}
      </Text>

      {/* Title */}
      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
        {deal.title}
      </Text>

      {/* Price row */}
      <View style={styles.priceRow}>
        <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
          {symbol}{Number(deal.price).toLocaleString()}
        </Text>
        <Text style={[styles.newPrice, { color: colors.primary }]}>
          {symbol}{Number(deal.discounted_price).toLocaleString()}
        </Text>
      </View>

      {/* Bottom row */}
      <View style={styles.bottomRow}>
        {deal.loyalty_points > 0 && (
          <View style={[styles.pointsTag, { backgroundColor: "#F97316" + "18" }]}>
            <Text style={[styles.pointsText, { color: "#F97316" }]}>+{deal.loyalty_points} pts</Text>
          </View>
        )}
        {deal.distance_km != null ? (
          <View style={styles.metaRow}>
            <MapPin size={10} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{deal.distance_km}km</Text>
          </View>
        ) : deal.city ? (
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>📍 {deal.city}</Text>
        ) : null}
      </View>

      {/* FOMO: claim count */}
      {(deal.claim_count ?? 0) > 0 && (
        <View style={styles.metaRow}>
          <TrendingUp size={9} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {deal.claim_count} claimed
          </Text>
        </View>
      )}

      {/* Countdown strip */}
      {countdown && (
        <View style={[styles.urgencyStrip, { backgroundColor: (isUrgent ? colors.destructive : "#F59E0B") + "15" }]}>
          <Clock size={10} color={isUrgent ? colors.destructive : "#F59E0B"} />
          <Text style={[styles.urgencyText, { color: isUrgent ? colors.destructive : "#F59E0B" }]}>
            {countdown}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1, overflow: "hidden",
    padding: 12, gap: 5,
  },
  cardSmall: { minHeight: 200 },
  cardLarge: { width: 200, minHeight: 220 },

  badge: {
    alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },

  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginVertical: 2,
  },
  emoji: { fontSize: 24 },

  merchant: { fontSize: 11, fontFamily: "Inter_400Regular" },
  title:    { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },

  priceRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  oldPrice:  { fontSize: 11, fontFamily: "Inter_400Regular", textDecorationLine: "line-through" },
  newPrice:  { fontSize: 14, fontFamily: "Inter_700Bold" },

  bottomRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },

  pointsTag:  { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  pointsText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  metaRow:  { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 10, fontFamily: "Inter_400Regular" },

  urgencyStrip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 2, padding: 4, borderRadius: 6,
  },
  urgencyText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
});
