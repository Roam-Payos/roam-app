import { router } from "expo-router";
import { Check, ChevronRight, Gift, MessageCircle, Share2 } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRoam } from "@/context/RoamContext";
import { useColors } from "@/hooks/useColors";

const LOADING_FEE_PCT  = 2;   // 2% of card value
const ISSUANCE_FEE_PCT = 1;   // 1% issuance fee

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface Partner {
  id: string;
  name: string;
  category: string;
  city: string;
  logo_emoji: string;
  accent_color: string;
}

const PRESET_AMOUNTS = [5000, 10000, 20000, 50000, 100000, 200000];

// ── Beautiful preview card ────────────────────────────────────────────────────
function CardPreview({
  partner, beneficiary, message, amount, currency, symbol,
}: {
  partner: Partner | null;
  beneficiary: string;
  message: string;
  amount: number;
  currency: string;
  symbol: string;
}) {
  const accent = partner?.accent_color ?? "#6366F1";
  const light  = adjustColor(accent, 60);
  const dark   = adjustColor(accent, -70);
  const expStr = new Date(Date.now() + 365 * 86400_000).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

  return (
    <LinearGradient
      colors={[light, accent, dark, "#05050F"] as const}
      locations={[0, 0.35, 0.7, 1]}
      start={{ x: 0.05, y: 0 }}
      end={{ x: 0.95, y: 1 }}
      style={styles.cardPreview}
    >
      {/* Background glows */}
      <View style={[styles.decorCircle1, { backgroundColor: light + "22" }]} />
      <View style={styles.decorCircle2} />

      {/* Top row — ROAM brand + chip */}
      <View style={styles.cardTopRow}>
        <View>
          <Text style={styles.cardBrand}>ROAM</Text>
          <Text style={styles.cardSubBrand}>Shopping Gift Card</Text>
        </View>
        {/* EMV chip */}
        <View style={styles.cardChip}>
          <View style={styles.cardChipInner}>
            <View style={styles.cardChipH} />
            <View style={styles.cardChipV} />
            <View style={styles.cardChipH} />
          </View>
        </View>
      </View>

      {/* Partner pill */}
      <View style={styles.cardPartnerPill}>
        <Text style={styles.cardPartnerText}>
          {partner ? `${partner.logo_emoji}  ${partner.name.toUpperCase()}` : "✦  CHOOSE A STORE"}
        </Text>
      </View>

      {/* Amount */}
      <Text style={styles.cardAmount}>
        {symbol}{amount > 0 ? amount.toLocaleString() : "—"}
      </Text>

      {/* Beneficiary */}
      <Text style={styles.cardBeneficiaryLabel}>GIFT TO</Text>
      <Text style={styles.cardBeneficiary} numberOfLines={1}>
        {beneficiary.trim() || "Beneficiary Name"}
      </Text>

      {/* Personal message */}
      {message.trim() ? (
        <Text style={styles.cardMessage} numberOfLines={2}>
          "{message.trim()}"
        </Text>
      ) : null}

      {/* Bottom row */}
      <View style={styles.cardBottomRow}>
        <Text style={[styles.cardLabel, { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }]}>
          ROAM-XXXX-XXXX
        </Text>
        <Text style={styles.cardExpiry}>{expStr}</Text>
      </View>
    </LinearGradient>
  );
}

// naive color darkening for gradient pair
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function NewGiftCardScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user, balance } = useRoam();
  const topPad  = insets.top + (Platform.OS === "web" ? 67 : 0);

  const currency = user?.country?.currency ?? "NGN";
  const symbol   = user?.country?.symbol   ?? "₦";
  const country  = user?.country?.code     ?? "NG";

  const [step, setStep]         = useState<1 | 2 | 3>(1);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadingP, setLoadingP] = useState(true);
  const [selected, setSelected] = useState<Partner | null>(null);
  const [beneficiary, setBeneficiary] = useState("");
  const [phone, setPhone]       = useState("");
  const [message, setMessage]   = useState("");
  const [amount, setAmount]     = useState(0);
  const [customAmt, setCustomAmt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successCard, setSuccessCard] = useState<any | null>(null);

  const loadingFee   = Math.round(amount * (LOADING_FEE_PCT  / 100) * 100) / 100;
  const issuanceFee  = Math.round(amount * (ISSUANCE_FEE_PCT / 100) * 100) / 100;
  const totalCharged = amount + loadingFee + issuanceFee;

  useEffect(() => {
    fetch(`${API}/roam/gift-card-partners?country=${country}`)
      .then((r) => r.json())
      .then((j) => setPartners(j.partners ?? []))
      .catch(() => {})
      .finally(() => setLoadingP(false));
  }, [country]);

  const canProceed1 = !!selected;
  const canProceed2 = beneficiary.trim().length >= 2;
  const canProceed3 = amount >= 500 && totalCharged <= balance;

  function openWhatsApp() {
    if (!successCard) return;
    const phonePart = phone.trim().replace(/\D/g, "");
    const expiry = new Date(successCard.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const msg = [
      `🎁 *You've received a Roam Shopping Gift Card!*`,
      ``,
      `*From:* ${user?.name ?? "A Roam user"}`,
      message.trim() ? `*Message:* "${message.trim()}"` : "",
      ``,
      `*Store:* ${successCard.partnerEmoji} ${successCard.partnerName}`,
      `*Gift Amount:* ${symbol}${Number(successCard.faceValue).toLocaleString()}`,
      `*Card Number:* ${successCard.cardNumber}`,
      `*Valid Until:* ${expiry}`,
      ``,
      `📍 *How to use:*`,
      `1. Go to any ${successCard.partnerName} store`,
      `2. Shop, then tell the cashier you're paying with a Roam Gift Card`,
      `3. Give them your card number: *${successCard.cardNumber}*`,
      `4. They will scan or enter it — your purchase is deducted instantly`,
      ``,
      `Powered by Roam by PayOs`,
    ].filter(Boolean).join("\n");

    const url = phonePart
      ? `https://api.whatsapp.com/send?phone=${phonePart}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    Linking.openURL(url).catch(() =>
      Alert.alert("WhatsApp not found", "Please share the card details manually."),
    );
  }

  async function purchase() {
    if (!user?.id || !selected) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/roam/gift-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          partnerId: selected.id,
          beneficiaryName: beneficiary.trim(),
          beneficiaryPhone: phone.trim() || undefined,
          personalMessage: message.trim() || undefined,
          amount,
          currency,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Purchase failed");
      setSuccessCard(j.card);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card }]}>
        <Pressable onPress={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : router.back())} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.text }]}>
            {step > 1 ? "← Back" : "← Cancel"}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {step === 1 ? "Choose Store" : step === 2 ? "Recipient Details" : "Amount & Preview"}
          </Text>
          <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>Step {step} of 3</Text>
        </View>
      </View>

      {/* Step indicators */}
      <View style={styles.stepDots}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={[
              styles.stepDot,
              { backgroundColor: s <= step ? "#EC4899" : colors.border },
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Step 1: Partner selection ────────────────────────────────── */}
          {step === 1 && (
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Where can they shop?
              </Text>
              <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                Select a partner store. The gift card is valid only at the chosen location.
              </Text>
              {loadingP ? (
                <ActivityIndicator color="#EC4899" style={{ marginTop: 40 }} />
              ) : (
                <View style={styles.partnerGrid}>
                  {partners.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => setSelected(p)}
                      style={[
                        styles.partnerCard,
                        { backgroundColor: colors.card },
                        selected?.id === p.id && { borderColor: p.accent_color, borderWidth: 2 },
                      ]}
                    >
                      {selected?.id === p.id && (
                        <View style={[styles.checkBadge, { backgroundColor: p.accent_color }]}>
                          <Check size={10} color="#fff" />
                        </View>
                      )}
                      <Text style={styles.partnerCardEmoji}>{p.logo_emoji}</Text>
                      <Text style={[styles.partnerCardName, { color: colors.text }]} numberOfLines={2}>
                        {p.name}
                      </Text>
                      <Text style={[styles.partnerCardCategory, { color: colors.mutedForeground }]}>
                        {p.category}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Step 2: Beneficiary details ──────────────────────────────── */}
          {step === 2 && (
            <View>
              {/* Card preview strip */}
              <CardPreview
                partner={selected}
                beneficiary={beneficiary}
                message={message}
                amount={amount}
                currency={currency}
                symbol={symbol}
              />

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>
                Who is this for?
              </Text>

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Beneficiary Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g. Amara Okafor"
                placeholderTextColor={colors.mutedForeground}
                value={beneficiary}
                onChangeText={setBeneficiary}
                maxLength={50}
              />

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Phone Number (optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                placeholder="+234 801 234 5678"
                placeholderTextColor={colors.mutedForeground}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={20}
              />

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Personal Message (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                placeholder="Happy birthday! Enjoy your shopping 🎉"
                placeholderTextColor={colors.mutedForeground}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={120}
              />
              <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{message.length}/120</Text>
            </View>
          )}

          {/* ── Step 3: Amount & confirm ──────────────────────────────────── */}
          {step === 3 && (
            <View>
              {/* Full card preview */}
              <CardPreview
                partner={selected}
                beneficiary={beneficiary}
                message={message}
                amount={amount}
                currency={currency}
                symbol={symbol}
              />

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>
                How much to load?
              </Text>
              <Text style={[styles.walletHint, { color: colors.mutedForeground }]}>
                Wallet balance: {symbol}{balance.toLocaleString()}
              </Text>

              {/* Preset amounts */}
              <View style={styles.presetGrid}>
                {PRESET_AMOUNTS.map((a) => (
                  <Pressable
                    key={a}
                    onPress={() => { setAmount(a); setCustomAmt(""); }}
                    style={[
                      styles.presetBtn,
                      { backgroundColor: amount === a ? "#EC4899" : colors.card, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.presetText, { color: amount === a ? "#fff" : colors.text }]}>
                      {symbol}{(a / 1000).toFixed(0)}k
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Or enter custom amount</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                placeholder={`Minimum ${symbol}500`}
                placeholderTextColor={colors.mutedForeground}
                value={customAmt}
                onChangeText={(v) => {
                  setCustomAmt(v);
                  const n = parseFloat(v.replace(/,/g, "")) || 0;
                  setAmount(n);
                }}
                keyboardType="numeric"
              />

              {totalCharged > balance && amount >= 500 && (
                <Text style={styles.errorText}>
                  Insufficient balance. Need {symbol}{totalCharged.toLocaleString()} (card + fees)
                </Text>
              )}
              {amount > 0 && amount < 500 && (
                <Text style={styles.errorText}>Minimum amount is {symbol}500</Text>
              )}

              {/* Fee notice */}
              {amount >= 500 && (
                <View style={[styles.feeNotice, { backgroundColor: "#1E3060" }]}>
                  <Text style={{ color: "#93C5FD", fontSize: 12 }}>
                    💡 Fees: {LOADING_FEE_PCT}% loading ({symbol}{loadingFee.toLocaleString()}) + {ISSUANCE_FEE_PCT}% issuance ({symbol}{issuanceFee.toLocaleString()})
                  </Text>
                </View>
              )}

              {/* Summary */}
              {amount >= 500 && selected && (
                <View style={[styles.summaryBox, { backgroundColor: colors.card }]}>
                  <Text style={[styles.summaryTitle, { color: colors.text }]}>Summary</Text>
                  <Row label="Store"          value={`${selected.logo_emoji} ${selected.name}`}      color={colors} />
                  <Row label="For"            value={beneficiary}                                     color={colors} />
                  <Row label="Card Value"     value={`${symbol}${amount.toLocaleString()}`}           color={colors} />
                  <Row label={`Loading Fee (${LOADING_FEE_PCT}%)`} value={`${symbol}${loadingFee.toLocaleString()}`} color={colors} />
                  <Row label={`Issuance Fee (${ISSUANCE_FEE_PCT}%)`} value={`${symbol}${issuanceFee.toLocaleString()}`} color={colors} />
                  <Row label="Total Charged"  value={`${symbol}${totalCharged.toLocaleString()}`}    color={colors} highlight />
                  <Row label="Card Expires"   value="1 year from today"                              color={colors} />
                  {phone.trim() && (
                    <Row label="Send via"     value={`📱 WhatsApp to ${phone.trim()}`}               color={colors} />
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Purchase Success Modal ───────────────────────────────────────── */}
      <Modal visible={!!successCard} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            {/* Success icon */}
            <View style={styles.successIcon}>
              <Text style={{ fontSize: 48 }}>🎁</Text>
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>Gift Card Sent!</Text>
            <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
              {symbol}{Number(successCard?.faceValue ?? 0).toLocaleString()} gift card for{" "}
              <Text style={{ fontWeight: "700", color: colors.text }}>{beneficiary}</Text>
              {"\n"}at {successCard?.partnerEmoji} {successCard?.partnerName}
            </Text>

            {/* Card number */}
            <View style={[styles.cardNumBox, { backgroundColor: "#0B1C3D" }]}>
              <Text style={[styles.cardNumLabel, { color: colors.mutedForeground }]}>CARD NUMBER</Text>
              <Text style={[styles.cardNumValue, { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }]}>
                {successCard?.cardNumber}
              </Text>
            </View>

            {/* Open card detail → share as image from there */}
            <Pressable
              onPress={() => router.replace(`/gift-card/${successCard?.id}`)}
              style={styles.whatsappBtn}
            >
              <MessageCircle size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.whatsappBtnText}>
                {phone.trim() ? `Share Card Image to ${beneficiary}` : "Share Card Image"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace(`/gift-card/${successCard?.id}`)}
              style={[styles.viewCardBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.viewCardBtnText, { color: colors.text }]}>View Card Details</Text>
            </Pressable>

            <Pressable onPress={() => router.replace("/gift-card")} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Back to My Gift Cards</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* CTA button */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 16, backgroundColor: colors.background }]}>
        <Pressable
          onPress={() => {
            if (step < 3) setStep((s) => (s + 1) as 1 | 2 | 3);
            else purchase();
          }}
          disabled={
            submitting ||
            (step === 1 && !canProceed1) ||
            (step === 2 && !canProceed2) ||
            (step === 3 && !canProceed3)
          }
          style={[
            styles.ctaBtn,
            {
              backgroundColor:
                (step === 1 && !canProceed1) ||
                (step === 2 && !canProceed2) ||
                (step === 3 && !canProceed3)
                  ? "#D1D5DB"
                  : "#EC4899",
            },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.ctaBtnText}>
                {step < 3
                  ? "Continue"
                  : totalCharged > 0
                    ? `Pay ${symbol}${totalCharged.toLocaleString()} & Send Card`
                    : "Purchase Gift Card"}
              </Text>
              {step < 3 && <ChevronRight size={18} color="#fff" style={{ marginLeft: 4 }} />}
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value, color, highlight }: { label: string; value: string; color: any; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.border }}>
      <Text style={{ color: color.mutedForeground, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: highlight ? "#EC4899" : color.text, fontWeight: highlight ? "700" : "500", fontSize: 14 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  backBtn:        { marginRight: 8 },
  backText:       { fontSize: 15, fontWeight: "500" },
  headerTitle:    { fontSize: 17, fontWeight: "700" },
  stepLabel:      { fontSize: 12, marginTop: 2 },
  stepDots:       { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 10 },
  stepDot:        { width: 28, height: 4, borderRadius: 4 },
  sectionTitle:   { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  sectionSub:     { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  partnerGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  partnerCard:    { width: "29%", padding: 12, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: "transparent", position: "relative" },
  checkBadge:     { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  partnerCardEmoji:{ fontSize: 28, marginBottom: 6 },
  partnerCardName: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  partnerCardCategory: { fontSize: 10, marginTop: 3, textAlign: "center" },
  fieldLabel:     { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 16, textTransform: "uppercase", letterSpacing: 0.5 },
  input:          { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  textArea:       { height: 80, textAlignVertical: "top", paddingTop: 12 },
  charCount:      { fontSize: 11, textAlign: "right", marginTop: 4 },
  presetGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  presetBtn:      { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  presetText:     { fontWeight: "600", fontSize: 14 },
  walletHint:     { fontSize: 13, marginBottom: 14 },
  errorText:      { color: "#EF4444", fontSize: 13, marginTop: 6 },
  summaryBox:     { borderRadius: 16, padding: 16, marginTop: 20 },
  summaryTitle:   { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  ctaContainer:   { paddingHorizontal: 16, paddingTop: 12 },
  ctaBtn:         { borderRadius: 16, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  ctaBtnText:     { color: "#fff", fontWeight: "700", fontSize: 16 },
  // Card preview
  cardPreview:    { borderRadius: 22, padding: 22, paddingBottom: 18, minHeight: 220, overflow: "hidden", position: "relative" },
  cardTopRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  cardBrand:      { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 4, textTransform: "uppercase" },
  cardSubBrand:   { color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 3 },
  cardPartner:    { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 4 },
  // EMV chip
  cardChip:       { width: 46, height: 36, borderRadius: 6, backgroundColor: "rgba(255,215,0,0.85)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,200,0,0.5)" },
  cardChipInner:  { width: 34, height: 26, borderRadius: 3, borderWidth: 1, borderColor: "rgba(180,140,0,0.7)", justifyContent: "space-around", alignItems: "center", padding: 3 },
  cardChipH:      { height: 1, width: "100%", backgroundColor: "rgba(160,120,0,0.8)" },
  cardChipV:      { position: "absolute", width: 1, height: "80%", backgroundColor: "rgba(160,120,0,0.8)" },
  // Glows
  decorCircle1:   { position: "absolute", width: 200, height: 200, borderRadius: 100, top: -70, right: -60 },
  decorCircle2:   { position: "absolute", width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(255,255,255,0.04)", bottom: -30, left: "30%" },
  // Partner pill
  cardPartnerPill:  { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start", marginBottom: 12 },
  cardPartnerText:  { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  // Content
  cardBeneficiaryLabel: { color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  cardBeneficiary:{ color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: -0.3, marginTop: 2, marginBottom: 8 },
  cardAmount:     { color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: -1.5, lineHeight: 42, marginBottom: 6 },
  cardMessage:    { color: "rgba(255,255,255,0.7)", fontSize: 11, fontStyle: "italic", marginBottom: 8, lineHeight: 16 },
  cardBottomRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 8 },
  cardLabel:      { color: "rgba(255,255,255,0.6)", fontSize: 11 },
  cardExpiry:     { color: "rgba(255,255,255,0.7)", fontSize: 11, letterSpacing: 1 },
  feeNotice:      { borderRadius: 10, padding: 10, marginTop: 10, marginBottom: 4 },
  // Success modal
  modalOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard:      { borderRadius: 24, padding: 28, width: "100%", alignItems: "center" },
  successIcon:    { width: 88, height: 88, borderRadius: 44, backgroundColor: "#FCE7F3", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  successTitle:   { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  successSub:     { fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 20 },
  cardNumBox:     { borderRadius: 12, padding: 14, alignItems: "center", width: "100%", marginBottom: 20 },
  cardNumLabel:   { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" },
  cardNumValue:   { fontSize: 16, color: "#A78BFA", letterSpacing: 2 },
  whatsappBtn:    { flexDirection: "row", alignItems: "center", backgroundColor: "#25D366", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, width: "100%", justifyContent: "center", marginBottom: 12 },
  whatsappBtnText:{ color: "#fff", fontWeight: "700", fontSize: 15 },
  viewCardBtn:    { borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, width: "100%", alignItems: "center", marginBottom: 12 },
  viewCardBtnText:{ fontWeight: "600", fontSize: 15 },
});
