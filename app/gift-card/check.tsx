import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface BalanceResult {
  card_number: string;
  beneficiary_name: string;
  face_value: string;
  redeemed_amount: string;
  remaining_balance: string;
  status: string;
  expires_at: string;
  partner_name: string;
  logo_emoji: string;
  currency: string;
}

interface HistoryEntry {
  amount: string;
  partner_name: string;
  store_emoji: string;
  cashier_note: string | null;
  created_at: string;
}

function symFor(currency: string) {
  if (currency === "NGN") return "₦";
  if (currency === "GHS") return "₵";
  if (currency === "KES") return "KSh";
  return "R";
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    active:    { label: "✓ Active",      bg: "#D1FAE5", fg: "#065F46" },
    redeemed:  { label: "✓ Fully Used",  bg: "#E5E7EB", fg: "#374151" },
    expired:   { label: "⚠ Expired",    bg: "#FEE2E2", fg: "#991B1B" },
    cancelled: { label: "✗ Cancelled",  bg: "#FEF3C7", fg: "#92400E" },
  };
  const chip = map[status] ?? map.active!;
  return (
    <View style={[styles.statusChip, { backgroundColor: chip.bg }]}>
      <Text style={[styles.statusChipText, { color: chip.fg }]}>{chip.label}</Text>
    </View>
  );
}

function formatCardInput(raw: string) {
  const upper = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!upper.startsWith("ROAM")) {
    if ("ROAM".startsWith(upper)) return upper;
  }
  const body = upper.replace(/^ROAM/, "");
  const hex  = body.replace(/[^0-9A-F]/g, "");
  const parts: string[] = [];
  for (let i = 0; i < hex.length && parts.length < 3; i += 4) {
    parts.push(hex.slice(i, i + 4));
  }
  const formatted = parts.length ? `ROAM-${parts.join("-")}` : "ROAM";
  return formatted.slice(0, 19);
}

export default function CheckBalanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const [cardInput, setCardInput] = useState("");
  const [pinInput,  setPinInput]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<BalanceResult | null>(null);
  const [history,   setHistory]   = useState<HistoryEntry[]>([]);
  const [error,     setError]     = useState<string | null>(null);

  const cardReady = cardInput.length === 19 && pinInput.trim().length === 6;

  function reset() {
    setResult(null);
    setHistory([]);
    setError(null);
  }

  async function checkBalance() {
    const card = cardInput.trim().toUpperCase();
    const pin  = pinInput.trim();

    if (!card.match(/^ROAM-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/)) {
      setError("Enter a valid card number: ROAM-XXXX-XXXX-XXXX");
      return;
    }
    if (!pin.match(/^\d{6}$/)) {
      setError("Enter your 6-digit Balance PIN");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setHistory([]);
    try {
      const url = `${API}/roam/gift-cards/balance-check?cardNumber=${encodeURIComponent(card)}&pin=${encodeURIComponent(pin)}`;
      const r   = await fetch(url);
      const j   = await r.json();
      if (!r.ok || !j.card) {
        setError(j.error ?? "Card not found or PIN incorrect. Please check and try again.");
      } else {
        setResult(j.card);
        setHistory(j.history ?? []);
      }
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const sym    = result ? symFor(result.currency) : "";
  const face   = result ? Number(result.face_value) : 0;
  const used   = result ? Number(result.redeemed_amount) : 0;
  const rem    = result ? Number(result.remaining_balance) : 0;
  const pct    = face > 0 ? Math.max(0, (rem / face) * 100) : 0;
  const expiry = result
    ? new Date(result.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/gift-card"))}
          style={styles.backBtn}
        >
          <Text style={[styles.backText, { color: colors.text }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Check Balance</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {/* Hero */}
        <View style={[styles.heroBox, { backgroundColor: colors.card }]}>
          <Text style={styles.heroEmoji}>🔐</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Private Balance Check</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Enter your card number and the 6-digit Balance PIN from your gift card.
            Only you can check this balance.
          </Text>
        </View>

        {/* Input form */}
        <View style={[styles.inputBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Card Number</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: error ? "#EF4444" : colors.border }]}
            placeholder="ROAM-XXXX-XXXX-XXXX"
            placeholderTextColor={colors.mutedForeground}
            value={cardInput}
            onChangeText={(t) => { setCardInput(formatCardInput(t)); reset(); }}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
            returnKeyType="next"
            maxLength={19}
          />

          <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Balance PIN</Text>
          <TextInput
            style={[styles.input, styles.pinInput, { color: colors.text, borderColor: error ? "#EF4444" : colors.border }]}
            placeholder="6-digit PIN"
            placeholderTextColor={colors.mutedForeground}
            value={pinInput}
            onChangeText={(t) => { setPinInput(t.replace(/\D/g, "").slice(0, 6)); reset(); }}
            keyboardType="number-pad"
            secureTextEntry={false}
            returnKeyType="search"
            onSubmitEditing={checkBalance}
            maxLength={6}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            onPress={checkBalance}
            disabled={loading || !cardReady}
            style={[styles.checkBtn, (!cardReady || loading) && { opacity: 0.5 }]}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.checkBtnText}>Check My Balance</Text>
            }
          </Pressable>
        </View>

        {/* Result */}
        {result && (
          <>
            <View style={[styles.resultBox, { backgroundColor: colors.card }]}>
              {/* Store + status */}
              <View style={styles.storeRow}>
                <Text style={styles.storeEmoji}>{result.logo_emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.storeLabel, { color: colors.mutedForeground }]}>Valid at</Text>
                  <Text style={[styles.storeName, { color: colors.text }]}>{result.partner_name}</Text>
                </View>
                <StatusChip status={result.status} />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Three balance columns */}
              <View style={styles.balanceRow}>
                <View style={{ alignItems: "center" }}>
                  <Text style={[styles.balLabel, { color: colors.mutedForeground }]}>Loaded</Text>
                  <Text style={[styles.balValue, { color: colors.text }]}>{sym}{face.toLocaleString()}</Text>
                </View>
                <View style={[styles.balSep, { backgroundColor: colors.border }]} />
                <View style={{ alignItems: "center" }}>
                  <Text style={[styles.balLabel, { color: colors.mutedForeground }]}>Used</Text>
                  <Text style={[styles.balValue, { color: "#EF4444" }]}>{sym}{used.toLocaleString()}</Text>
                </View>
                <View style={[styles.balSep, { backgroundColor: colors.border }]} />
                <View style={{ alignItems: "center" }}>
                  <Text style={[styles.balLabel, { color: colors.mutedForeground }]}>Remaining</Text>
                  <Text style={[styles.balValue, { color: "#10B981", fontWeight: "900" }]}>
                    {sym}{rem.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={[styles.progBg, { backgroundColor: colors.border }]}>
                <View style={[styles.progFill, { width: `${pct}%` as any }]} />
              </View>
              <Text style={[styles.progLabel, { color: colors.mutedForeground }]}>
                {pct.toFixed(0)}% remaining · Expires {expiry}
              </Text>

              {/* Card number */}
              <View style={[styles.cardNumBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.cardNumLabel, { color: colors.mutedForeground }]}>Card Number</Text>
                <Text style={[styles.cardNum, {
                  color: "#1E4DB7",
                  fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                }]}>
                  {result.card_number}
                </Text>
              </View>

              {result.status === "active" && rem > 0 && (
                <View style={styles.useTip}>
                  <Text style={styles.useTipText}>
                    💡 You have {sym}{rem.toLocaleString()} left to spend at {result.partner_name}.
                    Just give the cashier your card number — amount deducted instantly.
                  </Text>
                </View>
              )}
            </View>

            {/* Redemption history — beneficiary's private view */}
            <View style={[styles.historyBox, { backgroundColor: colors.card }]}>
              <Text style={[styles.historyTitle, { color: colors.text }]}>Spend History</Text>
              {history.length === 0 ? (
                <Text style={[styles.historyEmpty, { color: colors.mutedForeground }]}>
                  No purchases yet. This card hasn't been used.
                </Text>
              ) : (
                history.map((h, i) => {
                  const date = new Date(h.created_at).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  });
                  const time = new Date(h.created_at).toLocaleTimeString("en-GB", {
                    hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <View key={i} style={[styles.historyRow, i < history.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                      <Text style={styles.historyEmoji}>{h.store_emoji ?? "🏪"}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyStore, { color: colors.text }]}>{h.partner_name}</Text>
                        {h.cashier_note ? (
                          <Text style={[styles.historyNote, { color: colors.mutedForeground }]}>{h.cashier_note}</Text>
                        ) : null}
                        <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>{date} · {time}</Text>
                      </View>
                      <Text style={[styles.historyAmt, { color: "#EF4444" }]}>
                        -{sym}{Number(h.amount).toLocaleString()}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* Where to find card number + PIN */}
        <View style={[styles.helpBox, { backgroundColor: "#EFF6FF" }]}>
          <Text style={[styles.helpTitle, { color: "#1E40AF" }]}>Where do I find these?</Text>
          <Text style={[styles.helpText, { color: "#1E3A8A" }]}>
            <Text style={{ fontWeight: "700" }}>Card Number:</Text>{"\n"}
            • On the gift card image (e.g. ROAM-A1B2-C3D4-E5F6){"\n"}
            • In the WhatsApp message sent with your card{"\n"}
            • In the Roam app → Gift Cards → tap your card{"\n\n"}
            <Text style={{ fontWeight: "700" }}>Balance PIN:</Text>{"\n"}
            • Printed at the bottom of your gift card image{"\n"}
            • In the WhatsApp message alongside the card number{"\n"}
            • Your PIN is private — the sender cannot check your balance.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  backBtn:        { width: 56 },
  backText:       { fontSize: 15, fontWeight: "500" },
  headerTitle:    { flex: 1, fontSize: 18, fontWeight: "700", textAlign: "center" },
  heroBox:        { borderRadius: 16, padding: 20, alignItems: "center", marginBottom: 16 },
  heroEmoji:      { fontSize: 40, marginBottom: 10 },
  heroTitle:      { fontSize: 20, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  heroSub:        { fontSize: 14, lineHeight: 20, textAlign: "center" },
  inputBox:       { borderRadius: 16, padding: 16, marginBottom: 16 },
  inputLabel:     { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  input:          { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: "700", letterSpacing: 3, marginBottom: 4 },
  pinInput:       { letterSpacing: 8, fontSize: 22 },
  errorText:      { color: "#EF4444", fontSize: 13, marginBottom: 8, marginTop: 6 },
  checkBtn:       { backgroundColor: "#1E4DB7", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 14 },
  checkBtnText:   { color: "#fff", fontWeight: "700", fontSize: 15 },
  resultBox:      { borderRadius: 16, padding: 18, marginBottom: 16 },
  storeRow:       { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  storeEmoji:     { fontSize: 32 },
  storeLabel:     { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  storeName:      { fontSize: 16, fontWeight: "700" },
  statusChip:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  divider:        { height: 1, marginBottom: 16 },
  balanceRow:     { flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginBottom: 16 },
  balLabel:       { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  balValue:       { fontSize: 20, fontWeight: "800" },
  balSep:         { width: 1, height: 40 },
  progBg:         { height: 8, borderRadius: 8, overflow: "hidden", marginBottom: 8 },
  progFill:       { height: 8, borderRadius: 8, backgroundColor: "#10B981" },
  progLabel:      { fontSize: 12, textAlign: "center", marginBottom: 14 },
  cardNumBox:     { borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 14 },
  cardNumLabel:   { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  cardNum:        { fontSize: 16, letterSpacing: 3, fontWeight: "700" },
  useTip:         { backgroundColor: "#D1FAE5", borderRadius: 12, padding: 14 },
  useTipText:     { color: "#065F46", fontSize: 13, lineHeight: 20 },
  historyBox:     { borderRadius: 16, padding: 16, marginBottom: 16 },
  historyTitle:   { fontSize: 16, fontWeight: "800", marginBottom: 14 },
  historyEmpty:   { fontSize: 14, textAlign: "center", paddingVertical: 12 },
  historyRow:     { flexDirection: "row", alignItems: "flex-start", paddingVertical: 12, gap: 12 },
  historyEmoji:   { fontSize: 24, marginTop: 2 },
  historyStore:   { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  historyNote:    { fontSize: 12, marginBottom: 2 },
  historyDate:    { fontSize: 12 },
  historyAmt:     { fontSize: 16, fontWeight: "800", marginTop: 2 },
  helpBox:        { borderRadius: 16, padding: 16, marginBottom: 16 },
  helpTitle:      { fontSize: 14, fontWeight: "700", marginBottom: 8 },
  helpText:       { fontSize: 13, lineHeight: 22 },
});
