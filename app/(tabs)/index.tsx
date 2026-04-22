import { router } from "expo-router";
import {
  AlertTriangle, ArrowLeftRight, Bell, CreditCard, Download, Flame,
  Gift, Inbox, Phone, PiggyBank, Plane, QrCode, Send, Share2, ShoppingBag, Star, Zap,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, Share, StyleSheet, Text, TextInput,
  TouchableWithoutFeedback, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BalanceCard } from "@/components/BalanceCard";
import { QuickActions, ActionItem } from "@/components/QuickAction";
import { TransactionItem } from "@/components/TransactionItem";
import { TransactionReceipt } from "@/components/TransactionReceipt";
import DealCard from "@/components/DealCard";
import SponsoredAds from "@/components/SponsoredAds";
import CreditAlertBanner from "@/components/CreditAlertBanner";
import { useRoam, convertAmount, Transaction } from "@/context/RoamContext";
import { useColors } from "@/hooks/useColors";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const QUICK_ACTIONS: ActionItem[] = [
  { id: "send",      label: "Send",      icon: Send,        route: "/send",          color: "#F97316" },
  { id: "pay",       label: "Pay",       icon: ShoppingBag, route: "/pay",           color: "#6366F1" },
  { id: "arrive",    label: "Arrive",    icon: Plane,       route: "/arrive",        color: "#10B981" },
  { id: "receive",   label: "Receive",   icon: Download,    route: "/receive",       color: "#10B981" },
  { id: "save",      label: "Save",      icon: PiggyBank,   route: "/(tabs)/save",   color: "#8B5CF6" },
  { id: "paycode",   label: "PayCode",   icon: QrCode,      route: "/paycode",       color: "#0EA5E9" },
  { id: "hot-deals", label: "Hot Deals", icon: Flame,       route: "/deals",         color: "#EF4444" },
  { id: "airtime",   label: "Airtime & Data", icon: Phone,  route: "/airtime",       color: "#3B82F6" },
  { id: "cards",     label: "Cards",     icon: CreditCard,  route: "/(tabs)/cards",  color: "#EC4899" },
  { id: "bills",     label: "Bills",     icon: Zap,         route: "/bills",         color: "#F59E0B" },
  { id: "gift-card", label: "Gift Card", icon: Gift,        route: "/gift-card",     color: "#EC4899" },
];

interface UserStats {
  totalLoyaltyPoints: number;
  checkInStreak: number;
  checkedInToday: boolean;
  referralCode: string;
}

export default function HomeScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const {
    user, balance, usdBalance,
    transactions, usdTransactions,
    convertUsdToHome, previewCrossConvert,
    fxRatesUpdatedAt, isAuthenticated,
    creditAlert, clearCreditAlert, syncBalance,
  } = useRoam();


  const [refreshing, setRefreshing]         = useState(false);
  const [convertOpen, setConvertOpen]       = useState(false);
  const [convertAmt, setConvertAmt]         = useState("");
  const [convertResult, setConvertResult]   = useState<{ homeAmount: number; appliedRate: number; feeAmount: number; done: boolean } | null>(null);
  const [userStats, setUserStats]           = useState<UserStats | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState<{ pts: number; streak: number } | null>(null);
  const [trendingDeals, setTrendingDeals]   = useState<any[]>([]);
  const [referOpen, setReferOpen]           = useState(false);
  const [selectedTx, setSelectedTx]         = useState<Transaction | null>(null);

  const isBlocked = !!user?.kycBlocked;
  const topPad    = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad    = 90 + (Platform.OS === "web" ? 34 : 0);
  const currency  = user?.country.currency ?? "NGN";
  const symbol    = user?.country.symbol   ?? "₦";
  const flag      = user?.country.flag     ?? "🏠";
  const country   = user?.country?.code    ?? "NG";

  const allTx = useMemo(() => {
    const merged = [...transactions, ...usdTransactions];
    merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return merged.slice(0, 20);
  }, [transactions, usdTransactions]);

  const usdInput    = parseFloat(convertAmt.replace(/,/g, "")) || 0;
  const fxPreview   = usdInput > 0 ? previewCrossConvert(usdInput, "USD", currency) : null;
  const homePreview = fxPreview?.outputAmount ?? 0;
  const canConvert  = usdInput > 0 && usdInput <= usdBalance && !convertResult?.done;
  const ratesAgo = fxRatesUpdatedAt
    ? (() => {
        const mins = Math.round((Date.now() - new Date(fxRatesUpdatedAt).getTime()) / 60000);
        return mins < 2 ? "just now" : `${mins}m ago`;
      })()
    : null;

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API}/roam/users/${user.id}/stats`);
      if (res.ok) setUserStats(await res.json());
    } catch {}
  }, [user?.id]);

  const loadTrending = useCallback(async () => {
    try {
      const res = await fetch(`${API}/roam/deals?country=${country}&limit=4`);
      if (res.ok) { const d = await res.json(); setTrendingDeals(d.deals ?? []); }
    } catch {}
  }, [country]);

  useEffect(() => {
    loadStats();
    loadTrending();
  }, [loadStats, loadTrending]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadStats(), loadTrending(), syncBalance()]);
    setRefreshing(false);
  }

  async function handleCheckIn() {
    if (!user?.id || checkInLoading || userStats?.checkedInToday) return;
    setCheckInLoading(true);
    try {
      const res = await fetch(`${API}/roam/users/${user.id}/checkin`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setCheckInSuccess({ pts: data.pointsEarned, streak: data.streak });
        setUserStats(prev => prev ? { ...prev, checkedInToday: true, checkInStreak: data.streak, totalLoyaltyPoints: prev.totalLoyaltyPoints + data.pointsEarned } : prev);
        setTimeout(() => setCheckInSuccess(null), 4000);
      }
    } catch {}
    setCheckInLoading(false);
  }

  async function handleShare() {
    if (!userStats?.referralCode) return;
    try {
      await Share.share({
        message: `Join me on Roam by PayOs — the app for free deals & cross-border payments across Africa! 🔥\n\nUse my referral code ${userStats.referralCode} to get 50 bonus loyalty points when you sign up.\n\nDownload now: https://roam.payos.africa`,
      });
    } catch {}
  }

  function handleAction(route: string) {
    if (isBlocked) { router.push("/(tabs)/profile"); return; }
    router.push(route as never);
  }

  function openConvertModal() { setConvertAmt(""); setConvertResult(null); setConvertOpen(true); }

  function doConvert() {
    if (!canConvert) return;
    const result = convertUsdToHome(usdInput);
    if (result.success) {
      setConvertResult({ homeAmount: result.convertedAmount, appliedRate: result.appliedRate, feeAmount: result.feeAmount, done: true });
    }
  }

  if (!isAuthenticated) return null;

  const streakLabel = userStats ? (
    userStats.checkInStreak >= 7 ? `🔥 ${userStats.checkInStreak} day streak — +20 pts!` :
    userStats.checkInStreak >= 3 ? `⭐ ${userStats.checkInStreak} day streak — +10 pts` :
    userStats.checkInStreak > 0  ? `✅ ${userStats.checkInStreak} day streak` : null
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Credit Alert overlay notification ── */}
      {creditAlert && (
        <CreditAlertBanner alert={creditAlert} onDismiss={clearCreditAlert} />
      )}

      <FlatList
        data={allTx}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        scrollEnabled
        contentContainerStyle={{ paddingBottom: botPad }}
        ListHeaderComponent={
          <View>
            {/* ── Top bar ── */}
            <View style={[styles.topBar, { paddingTop: topPad }]}>
              <View>
                <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Good {getGreeting()},</Text>
                <Text style={[styles.name, { color: colors.foreground }]}>{user?.name?.split(" ")[0] ?? "Traveller"}</Text>
              </View>
              <View style={styles.topActions}>
                <Pressable
                  style={[styles.notifBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push("/(tabs)/history")}
                >
                  <Bell size={18} color={colors.foreground} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={() => router.push("/(tabs)/profile")}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>{(user?.name ?? "U").slice(0, 1).toUpperCase()}</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* ── KYC blocked banner ── */}
            {isBlocked && (
              <Pressable
                onPress={() => router.push("/(tabs)/profile")}
                style={[styles.blockedBanner, { backgroundColor: colors.warning + "18", borderColor: colors.warning + "55" }]}
              >
                <AlertTriangle size={18} color={colors.warning} strokeWidth={1.8} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.blockedTitle, { color: colors.warning }]}>Account Restricted — Transactions Blocked</Text>
                  <Text style={[styles.blockedSub, { color: colors.mutedForeground }]}>Tap to complete KYC and unlock your account.</Text>
                </View>
              </Pressable>
            )}

            {/* ── Loyalty + Check-in row ── */}
            {userStats && (
              <View style={{ flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 16 }}>
                {/* Points card */}
                <Pressable
                  onPress={() => router.push("/deals/coupons" as never)}
                  style={[styles.engageCard, { backgroundColor: "#F97316" + "12", borderColor: "#F97316" + "30", flex: 1 }]}
                >
                  <Star size={16} color="#F97316" fill="#F97316" strokeWidth={0} />
                  <Text style={[styles.engageVal, { color: "#F97316" }]}>{userStats.totalLoyaltyPoints.toLocaleString()}</Text>
                  <Text style={[styles.engageLabel, { color: colors.mutedForeground }]}>Loyalty Points</Text>
                </Pressable>

                {/* Check-in card */}
                <Pressable
                  onPress={handleCheckIn}
                  disabled={userStats.checkedInToday || checkInLoading}
                  style={[
                    styles.engageCard,
                    {
                      flex: 1,
                      backgroundColor: userStats.checkedInToday ? (colors.success + "10") : (colors.primary + "12"),
                      borderColor: userStats.checkedInToday ? (colors.success + "30") : (colors.primary + "30"),
                    },
                  ]}
                >
                  <Text style={{ fontSize: 16 }}>{userStats.checkedInToday ? "✅" : "🎁"}</Text>
                  <Text style={[styles.engageVal, { color: userStats.checkedInToday ? colors.success : colors.primary }]}>
                    {checkInLoading ? "..." : userStats.checkedInToday ? "Done!" : "+5 pts"}
                  </Text>
                  <Text style={[styles.engageLabel, { color: colors.mutedForeground }]}>
                    {userStats.checkedInToday ? "Checked in" : "Daily Check-in"}
                  </Text>
                </Pressable>

                {/* Referral card */}
                <Pressable
                  onPress={() => setReferOpen(true)}
                  style={[styles.engageCard, { flex: 1, backgroundColor: "#6366F1" + "12", borderColor: "#6366F1" + "30" }]}
                >
                  <Share2 size={16} color="#6366F1" />
                  <Text style={[styles.engageVal, { color: "#6366F1" }]}>+50</Text>
                  <Text style={[styles.engageLabel, { color: colors.mutedForeground }]}>Refer & Earn</Text>
                </Pressable>
              </View>
            )}

            {/* Check-in success toast */}
            {checkInSuccess && (
              <View style={[styles.toastWrap, { backgroundColor: colors.success + "18", borderColor: colors.success + "40" }]}>
                <Text style={[styles.toastText, { color: colors.success }]}>
                  🎉 +{checkInSuccess.pts} pts earned! {streakLabel}
                </Text>
              </View>
            )}

            {/* ── Streak label ── */}
            {streakLabel && !checkInSuccess && userStats?.checkedInToday && (
              <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
                <Text style={[styles.streakText, { color: colors.mutedForeground }]}>{streakLabel}</Text>
              </View>
            )}

            {/* ── Dual balance card ── */}
            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <BalanceCard
                homeBalance={balance}
                currency={currency}
                symbol={symbol}
                flag={flag}
                usdBalance={usdBalance}
                kycTier={user?.kycTier ?? 1}
                kycBlocked={user?.kycBlocked}
                onConvert={openConvertModal}
              />
            </View>


            {/* ── Quick actions ── */}
            <View style={{ marginBottom: 24 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
              <QuickActions actions={QUICK_ACTIONS} onPress={handleAction} />
            </View>

            {/* ── Sponsored Ads ── */}
            <SponsoredAds country={country} />

            {/* ── Trending Deals strip ── */}
            {trendingDeals.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <View style={[styles.txHeader, { paddingRight: 16, marginBottom: 12 }]}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>🔥 Trending Deals</Text>
                  <Pressable onPress={() => router.push("/deals" as never)}>
                    <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
                  </Pressable>
                </View>
                <FlatList
                  horizontal
                  data={trendingDeals}
                  keyExtractor={(d) => d.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                  renderItem={({ item }) => (
                    <DealCard
                      deal={item}
                      size="large"
                      onPress={() => router.push(`/deals/${item.id}` as never)}
                    />
                  )}
                />
              </View>
            )}

            {/* ── Transactions header ── */}
            <View style={[styles.txHeader, { paddingRight: 16, marginBottom: 4 }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Recent Activity</Text>
              <Pressable onPress={() => router.push("/(tabs)/history")}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => <TransactionItem transaction={item} onPress={setSelectedTx} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Inbox size={36} color={colors.mutedForeground} strokeWidth={1.5} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No transactions yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Fund your wallet or make a payment to get started</Text>
          </View>
        }
      />

      {/* ── Transaction Receipt ── */}
      <TransactionReceipt
        transaction={selectedTx}
        visible={!!selectedTx}
        onClose={() => setSelectedTx(null)}
      />

      {/* ── Refer Modal ── */}
      <Modal visible={referOpen} transparent animationType="slide" onRequestClose={() => setReferOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableWithoutFeedback onPress={() => setReferOpen(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>🎁 Refer & Earn</Text>
            <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
              Share your code. When a friend joins and claims their first deal, you BOTH get 50 loyalty points.
            </Text>
            <View style={[styles.referCodeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.referCode, { color: colors.primary }]}>{userStats?.referralCode ?? "—"}</Text>
            </View>
            <Pressable
              onPress={handleShare}
              style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Share2 size={18} color="#fff" />
                <Text style={[styles.confirmBtnText, { color: "#fff" }]}>Share My Code</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => setReferOpen(false)} style={{ alignItems: "center" }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>Close</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Convert USD → Home modal ── */}
      <Modal visible={convertOpen} transparent animationType="slide" onRequestClose={() => setConvertOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableWithoutFeedback onPress={() => !convertResult?.done && setConvertOpen(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Convert USD → {currency}</Text>
            <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
              Available: ${usdBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </Text>

            {!convertResult?.done ? (
              <>
                <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.inputPrefix, { color: colors.mutedForeground }]}>$</Text>
                  <TextInput
                    style={[styles.amountInput, { color: colors.foreground }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    value={convertAmt}
                    onChangeText={setConvertAmt}
                    autoFocus
                  />
                  <Pressable onPress={() => setConvertAmt(usdBalance.toFixed(2))}>
                    <Text style={[styles.maxBtn, { color: colors.primary }]}>MAX</Text>
                  </Pressable>
                </View>

                {fxPreview && usdInput > 0 && (
                  <View style={[styles.rateRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={styles.rateCol}>
                      <Text style={[styles.rateKey, { color: colors.mutedForeground }]}>You convert</Text>
                      <Text style={[styles.rateVal, { color: colors.foreground }]}>${usdInput.toFixed(2)} USD</Text>
                      <Text style={[styles.rateKey, { color: colors.mutedForeground, marginTop: 6 }]}>
                        Mid-market: {symbol}{fxPreview.midRate.toLocaleString("en-NG", { maximumFractionDigits: 2 })}/USD
                      </Text>
                    </View>
                    <ArrowLeftRight size={16} color={colors.mutedForeground} strokeWidth={1.5} />
                    <View style={[styles.rateCol, { alignItems: "flex-end" }]}>
                      <Text style={[styles.rateKey, { color: colors.mutedForeground }]}>You receive</Text>
                      <Text style={[styles.rateVal, { color: colors.success }]}>
                        {symbol}{Math.floor(homePreview).toLocaleString("en-NG")} {currency}
                      </Text>
                      <Text style={[styles.rateKey, { color: colors.mutedForeground, marginTop: 6 }]}>
                        Fee: {symbol}{fxPreview.feeAmount.toLocaleString("en-NG", { maximumFractionDigits: 0 })} (1.5% spread)
                      </Text>
                    </View>
                  </View>
                )}

                {ratesAgo && usdInput > 0 && (
                  <Text style={[styles.rateStamp, { color: colors.mutedForeground }]}>
                    Rate updated {ratesAgo} · open.er-api.com
                  </Text>
                )}
                {usdInput > usdBalance && (
                  <Text style={[styles.errText, { color: colors.destructive }]}>Amount exceeds your USD balance.</Text>
                )}
                <Pressable
                  onPress={doConvert}
                  disabled={!canConvert}
                  style={({ pressed }) => [styles.confirmBtn, { backgroundColor: canConvert ? colors.primary : colors.muted, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={[styles.confirmBtnText, { color: canConvert ? "#fff" : colors.mutedForeground }]}>Confirm Conversion</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.successWrap}>
                <View style={[styles.successCircle, { backgroundColor: colors.success + "18" }]}>
                  <Text style={{ fontSize: 34 }}>✓</Text>
                </View>
                <Text style={[styles.successTitle, { color: colors.foreground }]}>Conversion Successful!</Text>
                <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
                  {symbol}{convertResult.homeAmount.toLocaleString("en-NG")} {currency} added to your wallet.{"\n"}
                  Rate: {symbol}{convertResult.appliedRate.toLocaleString("en-NG", { maximumFractionDigits: 2 })}/USD · Fee: {symbol}{convertResult.feeAmount.toLocaleString("en-NG", { maximumFractionDigits: 0 })}
                </Text>
                <Pressable onPress={() => setConvertOpen(false)} style={[styles.confirmBtn, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.confirmBtnText, { color: "#fff" }]}>Done</Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 4,
  },
  greeting:   { fontSize: 13, fontFamily: "Inter_400Regular" },
  name:       { fontSize: 22, fontFamily: "Inter_700Bold" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  notifBtn:   { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  avatar:     { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

  blockedBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    marginHorizontal: 16, marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1,
  },
  blockedTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  blockedSub:   { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

  engageCard: {
    borderRadius: 14, borderWidth: 1, padding: 12,
    alignItems: "center", gap: 4, minHeight: 76,
  },
  engageVal:   { fontSize: 16, fontFamily: "Inter_700Bold" },
  engageLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },

  toastWrap: {
    marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1,
  },
  toastText: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  streakText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", paddingHorizontal: 16, marginBottom: 12 },
  txHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seeAll:       { fontSize: 13, fontFamily: "Inter_500Medium" },
  empty:        { alignItems: "center", gap: 8, paddingTop: 40 },
  emptyText:    { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptySub:     { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },

  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 44, borderWidth: 1, borderBottomWidth: 0, gap: 16,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  sheetTitle:  { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  sheetSub:    { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: -8 },

  referCodeBox: { borderRadius: 12, borderWidth: 1, padding: 16, alignItems: "center" },
  referCode:    { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: 3 },

  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  inputPrefix: { fontSize: 22, fontFamily: "Inter_600SemiBold" },
  amountInput: { flex: 1, fontSize: 28, fontFamily: "Inter_700Bold" },
  maxBtn:      { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  rateRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 14, borderRadius: 14, borderWidth: 1, gap: 8,
  },
  rateCol:  { gap: 3, flex: 1 },
  rateKey:  { fontSize: 11, fontFamily: "Inter_400Regular" },
  rateVal:  { fontSize: 14, fontFamily: "Inter_700Bold" },

  errText:   { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  rateStamp: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", opacity: 0.65 },

  confirmBtn:     { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  confirmBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  successWrap:   { alignItems: "center", gap: 12, paddingVertical: 8 },
  successCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  successTitle:  { fontSize: 20, fontFamily: "Inter_700Bold" },
  successSub:    { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, paddingHorizontal: 16 },
});
