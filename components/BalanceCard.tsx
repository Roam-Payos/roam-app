/**
 * BalanceCard — unified dual-balance card.
 * Left side: home currency (NGN/GHS/KES/ZAR).
 * Right side: USD wallet.
 * A single card, no tabs.
 */
import * as Haptics from "expo-haptics";
import { Eye, EyeOff, TrendingDown, TrendingUp } from "lucide-react-native";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  homeBalance: number;
  currency: string;
  symbol: string;
  flag: string;
  usdBalance: number;
  kycTier: 1 | 2 | 3;
  kycBlocked?: boolean;
  onConvert: () => void;
}

export function BalanceCard({
  homeBalance, currency, symbol, flag, usdBalance,
  kycTier, kycBlocked, onConvert,
}: Props) {
  const colors = useColors();
  const [hidden, setHidden] = useState(false);

  function toggle() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHidden((h) => !h);
  }

  // Full number always — no abbreviation (fintech standard).
  // Dynamic font size shrinks only when the string is very long.
  function fmtBalance(n: number, sym: string, locale: string) {
    const full   = n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dotIdx = full.lastIndexOf(".");
    const main   = `${sym}${dotIdx >= 0 ? full.slice(0, dotIdx) : full}`;
    const cents  = dotIdx >= 0 ? full.slice(dotIdx) : ".00";
    return { main, cents };
  }

  function homeFontSize(str: string): number {
    const len = str.length; // e.g. "₦1,307,195" = 11 chars
    if (len <= 8)  return 26;
    if (len <= 10) return 22;
    if (len <= 12) return 18;
    return 15;
  }

  const fmtHome = fmtBalance(homeBalance, symbol, "en-NG");
  const fmtUsd  = fmtBalance(usdBalance,  "$",    "en-US");
  const homeFZ  = homeFontSize(fmtHome.main);   // scale based on integer+symbol length

  const tierColor = kycBlocked
    ? colors.warning
    : kycTier === 3 ? colors.success
    : kycTier === 2 ? "#3B82F6"
    : colors.primary;
  const tierLabel = kycBlocked ? "Blocked" : `KYC Tier ${kycTier}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>

      {/* ── Top row: label + eye ───────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>Your Wallets</Text>
        <Pressable onPress={toggle} hitSlop={14}>
          {hidden
            ? <EyeOff size={16} color={colors.mutedForeground} strokeWidth={1.8} />
            : <Eye    size={16} color={colors.mutedForeground} strokeWidth={1.8} />
          }
        </Pressable>
      </View>

      {/* ── Dual balance row ───────────────────────────────────────────── */}
      <View style={styles.balanceRow}>

        {/* Home currency side */}
        <View style={styles.balanceSide}>
          <View style={styles.currencyLabel}>
            <Text style={styles.flagText}>{flag}</Text>
            <Text style={[styles.currencyCode, { color: colors.mutedForeground }]}>{currency}</Text>
          </View>
          {hidden ? (
            <Text style={[styles.homeAmount, { color: colors.foreground }]}>{symbol} ••••••</Text>
          ) : (
            <View style={styles.amountRow}>
              <Text style={[styles.homeAmount, { color: colors.foreground, fontSize: homeFZ }]}>
                {fmtHome.main}
              </Text>
              <Text style={[styles.homeCents, { color: colors.mutedForeground, fontSize: homeFZ }]}>
                {fmtHome.cents}
              </Text>
            </View>
          )}
        </View>

        {/* Vertical separator */}
        <View style={[styles.vSeparator, { backgroundColor: colors.border }]} />

        {/* USD side */}
        <View style={[styles.balanceSide, styles.balanceSideRight]}>
          <View style={styles.currencyLabel}>
            <Text style={styles.flagText}>🇺🇸</Text>
            <Text style={[styles.currencyCode, { color: "#7EB8D9" }]}>USD</Text>
          </View>
          {hidden ? (
            <Text style={[styles.usdAmount, { color: "#93C5FD" }]}>$ ••••••</Text>
          ) : (
            <View style={styles.amountRow}>
              <Text style={[styles.usdAmount, { color: "#93C5FD" }]}>
                {fmtUsd.main}
              </Text>
              <Text style={[styles.usdCents, { color: "#7EB8D9" }]}>
                {fmtUsd.cents}
              </Text>
            </View>
          )}
          <Pressable onPress={onConvert} style={[styles.convertPill, { backgroundColor: "#1E3A55" }]}>
            <Text style={styles.convertPillText}>Convert →</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Divider ────────────────────────────────────────────────────── */}
      <View style={[styles.hDivider, { backgroundColor: colors.border }]} />

      {/* ── Footer: stats + tier badge ─────────────────────────────────── */}
      <View style={styles.footerRow}>
        <View style={styles.stat}>
          <TrendingUp size={13} color={colors.success} strokeWidth={1.8} />
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Income</Text>
        </View>
        <View style={styles.stat}>
          <TrendingDown size={13} color={colors.primary} strokeWidth={1.8} />
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Expenses</Text>
        </View>
        <View style={[styles.tierBadge, { backgroundColor: tierColor + "22" }]}>
          <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
          <Text style={[styles.tierText, { color: tierColor }]}>{tierLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  // ── Dual balance ──────────────────────────────────────────────────────────
  balanceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 0,
    marginBottom: 16,
  },
  balanceSide: {
    flex: 1,
    gap: 6,
  },
  balanceSideRight: {
    paddingLeft: 16,
  },
  currencyLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  flagText: {
    fontSize: 14,
  },
  currencyCode: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "nowrap",
  },
  homeAmount: {
    fontSize: 26,           // overridden inline by homeFZ
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  homeCents: {
    fontSize: 26,           // overridden inline by homeFZ
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginLeft: 1,
  },
  usdAmount: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  usdCents: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    marginLeft: 1,
  },
  vSeparator: {
    width: 1,
    alignSelf: "stretch",
    marginHorizontal: 0,
    marginVertical: 4,
  },
  convertPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  convertPillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#7EB8D9",
  },
  // ── Divider ──────────────────────────────────────────────────────────────
  hDivider: {
    height: 1,
    marginBottom: 13,
  },
  // ── Footer ───────────────────────────────────────────────────────────────
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tierDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tierText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
