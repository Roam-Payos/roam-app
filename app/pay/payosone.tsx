/**
 * Pay by PAYOSONE Merchant Code
 *
 * Flow:
 *   Step 1 — Enter PAYOSONE code (P1-XXXXXX) → API resolves merchant + NUBAN
 *   Step 2 — Enter amount + optional note  → live fee preview
 *   Step 3 — PIN confirmation
 *   Step 4 — Success
 *
 * The resolved NUBAN is used as the NIP destination — same mocked
 * executeNipTransfer() placeholder as bank.tsx. Swap for real API when live.
 */

import { router } from "expo-router";
import {
  X, CheckCircle2, AlertCircle, Shield, Store,
  Tag, MapPin, Sparkles,
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useRoam } from "@/context/RoamContext";

const API = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type Step = "code" | "amount" | "pin" | "success";

const CATEGORY_COLORS: Record<string, string> = {
  events:          "#8B5CF6",
  shopping_mall:   "#EC4899",
  insurance:       "#10B981",
  betting:         "#F97316",
  coupons_loyalty: "#3B82F6",
  food:            "#EF4444",
  other:           "#6B7280",
};

interface MerchantInfo {
  id: string; name: string; category: string;
  city: string | null; country: string;
  logoUrl: string | null; description: string | null;
}

async function executeNipTransfer(_params: {
  accountNumber: string; bankCode: string; accountName: string;
  amount: number; narration: string; reference: string;
}): Promise<{ sessionId: string; status: "completed" | "failed" }> {
  await new Promise(r => setTimeout(r, 1800));
  return { sessionId: `NIP${Date.now()}`, status: "completed" };
}

function genRef() {
  return `P1-PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function formatCode(raw: string): string {
  const upper = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (upper.length <= 2) return upper;
  return `${upper.slice(0, 2)}-${upper.slice(2, 8)}`;
}

export default function PayPayosoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, balance, deductBalance, addTransaction } = useRoam();

  const [step, setStep]       = useState<Step>("code");
  const [codeInput, setCodeInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const [merchant, setMerchant]   = useState<MerchantInfo | null>(null);
  const [nuban, setNuban]         = useState("");
  const [bankCode, setBankCode]   = useState("");
  const [bankName, setBankName]   = useState("");

  const [amount, setAmount] = useState("");
  const [note, setNote]     = useState("");
  const [error, setError]   = useState("");
  const [pin, setPin]       = useState("");
  const [processing, setProcessing] = useState(false);
  const [nipSession, setNipSession] = useState("");

  const successScale = useRef(new Animated.Value(0)).current;
  const ref          = useRef(genRef()).current;

  const fromCurrency = user?.country.currency ?? "NGN";
  const fromSymbol   = user?.country.symbol    ?? "₦";
  const numAmount    = parseFloat(amount.replace(/,/g, "")) || 0;
  const fee          = fromCurrency === "NGN" ? 50 : Math.round(numAmount * 0.005);
  const total        = numAmount + fee;

  const topPad    = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = Math.max(insets.bottom, 20) + (Platform.OS === "web" ? 34 : 0);

  const accentColor = merchant
    ? (CATEGORY_COLORS[merchant.category] ?? CATEGORY_COLORS.other)
    : colors.primary;

  async function doLookup() {
    const code = codeInput.toUpperCase().trim();
    if (!code || code.length < 4) {
      setLookupError("Enter a valid PAYOSONE code (e.g. P1-4KX9MN)");
      return;
    }
    setLooking(true); setLookupError(""); setMerchant(null);
    try {
      const res = await fetch(`${API}/api/payosone/lookup?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok || !data.merchant) {
        setLookupError(data.error ?? "Code not found. Check the code on the merchant's receipt.");
        return;
      }
      setMerchant(data.merchant);
      setNuban(data.nuban ?? "");
      setBankCode(data.bankCode ?? "");
      setBankName(data.bankName ?? "");
    } catch {
      setLookupError("Could not reach server. Check your connection.");
    } finally {
      setLooking(false);
    }
  }

  function goToAmount() {
    if (!merchant) { setLookupError("Look up a merchant first"); return; }
    setStep("amount"); setError("");
  }

  function goToPin() {
    if (numAmount < 100) { setError(`Minimum transfer is ${fromSymbol}100`); return; }
    if (total > balance)  { setError("Insufficient balance"); return; }
    setStep("pin"); setError("");
  }

  async function executePay() {
    if (pin.length < 4) return;
    setProcessing(true); setError("");
    try {
      const result = await executeNipTransfer({
        accountNumber: nuban,
        bankCode,
        accountName:   merchant!.name,
        amount:        numAmount,
        narration:     note || `PayOs PAYOSONE payment to ${merchant!.name}`,
        reference:     ref,
      });
      if (result.status === "completed") {
        deductBalance(total);
        addTransaction({
          type:     "pay",
          title:    `Paid ${merchant!.name}`,
          subtitle: `PAYOSONE · ${codeInput.toUpperCase()}`,
          amount:   -total,
          currency: fromCurrency,
          symbol:   fromSymbol,
          status:   "completed",
        });
        setNipSession(result.sessionId);
        setStep("success");
        Animated.spring(successScale, {
          toValue: 1, useNativeDriver: true, tension: 50, friction: 7,
        }).start();
      } else {
        setError("Transfer failed. Please try again.");
        setStep("amount");
      }
    } catch {
      setError("Payment could not be processed. Try again.");
      setStep("amount");
    } finally {
      setProcessing(false);
    }
  }

  const titleByStep: Record<Step, string> = {
    code:    "PAYOSONE Code",
    amount:  "Enter Amount",
    pin:     "Confirm PIN",
    success: "Payment Sent!",
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <Pressable
          onPress={() => step === "code" || step === "success" ? router.back() : setStep(step === "pin" ? "amount" : "code")}
          style={s.closeBtn}
        >
          <X size={22} color={colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>{titleByStep[step]}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress dots */}
      {step !== "success" && (
        <View style={s.dots}>
          {(["code", "amount", "pin"] as Step[]).map((s2, i) => (
            <View
              key={s2}
              style={[s.dot, {
                backgroundColor: (["code","amount","pin"] as Step[]).indexOf(step) >= i
                  ? accentColor : colors.border,
                width: step === s2 ? 20 : 8,
              }]}
            />
          ))}
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 14 }}
        >

          {/* ── STEP 1: Code Lookup ── */}
          {step === "code" && (
            <>
              {/* Hero banner */}
              <View style={[s.heroBanner, { backgroundColor: accentColor + "15", borderColor: accentColor + "33" }]}>
                <View style={[s.heroIcon, { backgroundColor: accentColor + "22" }]}>
                  <Sparkles size={22} color={accentColor} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.heroTitle, { color: colors.foreground }]}>Pay by PAYOSONE Code</Text>
                  <Text style={[s.heroSub, { color: colors.mutedForeground }]}>
                    Enter the code displayed at any PayOs-registered merchant to pay instantly
                  </Text>
                </View>
              </View>

              {/* Code input */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>PAYOSONE Code</Text>
                <View style={[s.codeRow, { backgroundColor: colors.card, borderColor: merchant ? accentColor : lookupError ? colors.destructive : colors.border }]}>
                  <TextInput
                    style={[s.codeInput, { color: colors.foreground, flex: 1 }]}
                    placeholder="P1-4KX9MN"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={9}
                    value={codeInput}
                    onChangeText={t => {
                      setCodeInput(formatCode(t));
                      setLookupError("");
                      setMerchant(null);
                    }}
                    onSubmitEditing={doLookup}
                  />
                  <Pressable
                    onPress={doLookup}
                    disabled={looking}
                    style={({ pressed }) => [s.lookupBtn, { backgroundColor: accentColor, opacity: pressed ? 0.8 : 1 }]}
                  >
                    {looking
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.lookupBtnText}>Find</Text>
                    }
                  </Pressable>
                </View>
                <Text style={[s.codeHint, { color: colors.mutedForeground }]}>
                  Format: P1-XXXXXX  ·  Found on merchant's receipt, counter display, or QR code
                </Text>
              </View>

              {/* Lookup error */}
              {!!lookupError && !looking && (
                <View style={[s.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "33" }]}>
                  <AlertCircle size={15} color={colors.destructive} />
                  <Text style={[s.errorText, { color: colors.destructive }]}>{lookupError}</Text>
                </View>
              )}

              {/* Merchant card (after successful lookup) */}
              {merchant && !looking && (
                <View style={[s.merchantCard, { backgroundColor: colors.card, borderColor: accentColor + "55" }]}>
                  <View style={[s.merchantIcon, { backgroundColor: accentColor + "22" }]}>
                    <Store size={26} color={accentColor} strokeWidth={1.6} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={s.merchantNameRow}>
                      <Text style={[s.merchantName, { color: colors.foreground }]}>{merchant.name}</Text>
                      <CheckCircle2 size={16} color={accentColor} strokeWidth={2} />
                    </View>
                    <View style={s.merchantMeta}>
                      <Tag size={12} color={colors.mutedForeground} strokeWidth={1.8} />
                      <Text style={[s.merchantMetaText, { color: colors.mutedForeground }]}>
                        {merchant.category.replace("_", " ")}
                      </Text>
                      {merchant.city && (
                        <>
                          <Text style={[s.merchantMetaText, { color: colors.border }]}>·</Text>
                          <MapPin size={12} color={colors.mutedForeground} strokeWidth={1.8} />
                          <Text style={[s.merchantMetaText, { color: colors.mutedForeground }]}>{merchant.city}</Text>
                        </>
                      )}
                    </View>
                    {merchant.description && (
                      <Text style={[s.merchantDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {merchant.description}
                      </Text>
                    )}
                    <View style={[s.verifiedTag, { backgroundColor: accentColor + "18" }]}>
                      <Text style={[s.verifiedText, { color: accentColor }]}>✓ PayOs Verified Merchant</Text>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}

          {/* ── STEP 2: Amount ── */}
          {step === "amount" && merchant && (
            <>
              {/* Merchant summary strip */}
              <View style={[s.stripCard, { backgroundColor: accentColor + "18", borderColor: accentColor + "33" }]}>
                <View style={[s.stripIcon, { backgroundColor: accentColor + "33" }]}>
                  <Store size={18} color={accentColor} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.stripName, { color: colors.foreground }]}>{merchant.name}</Text>
                  <Text style={[s.stripCode, { color: accentColor }]}>
                    {codeInput.toUpperCase()} · PayOs Merchant
                  </Text>
                </View>
                <CheckCircle2 size={18} color={accentColor} strokeWidth={2} />
              </View>

              {/* Amount input */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>Amount ({fromCurrency})</Text>
                <View style={[s.amountRow, { backgroundColor: colors.card, borderColor: numAmount > 0 ? accentColor : colors.border }]}>
                  <Text style={[s.amountSym, { color: colors.mutedForeground }]}>{fromSymbol}</Text>
                  <TextInput
                    style={[s.amountInput, { color: colors.foreground }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={t => { setAmount(t); setError(""); }}
                    autoFocus
                  />
                </View>
              </View>

              {/* Quick amounts */}
              <View style={s.quickRow}>
                {[5000, 10000, 20000, 50000].map(v => (
                  <Pressable
                    key={v}
                    onPress={() => setAmount(v.toString())}
                    style={({ pressed }) => [s.quickBtn, {
                      backgroundColor: amount === v.toString() ? accentColor + "22" : colors.card,
                      borderColor: amount === v.toString() ? accentColor : colors.border,
                      opacity: pressed ? 0.75 : 1,
                    }]}
                  >
                    <Text style={[s.quickText, { color: amount === v.toString() ? accentColor : colors.mutedForeground }]}>
                      ₦{v >= 1000 ? `${v / 1000}K` : v}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Note */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>Payment note (optional)</Text>
                <TextInput
                  style={[s.noteInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="e.g. Table 5, Order #102, Delivery"
                  placeholderTextColor={colors.mutedForeground}
                  value={note}
                  onChangeText={setNote}
                />
              </View>

              {/* Fee summary */}
              {numAmount > 0 && (
                <View style={[s.preview, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <View style={s.previewRow}>
                    <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>Merchant receives</Text>
                    <Text style={[s.previewVal, { color: colors.foreground }]}>{fromSymbol}{numAmount.toLocaleString()}</Text>
                  </View>
                  <View style={s.previewRow}>
                    <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>NIP transfer fee</Text>
                    <Text style={[s.previewVal, { color: colors.foreground }]}>{fromSymbol}{fee.toLocaleString()}</Text>
                  </View>
                  <View style={s.previewRow}>
                    <Text style={[s.previewLabel, { color: colors.mutedForeground }]}>Settlement time</Text>
                    <Text style={[s.previewVal, { color: "#10B981" }]}>Instant (NIP)</Text>
                  </View>
                  <View style={[s.previewRow, s.previewTotal]}>
                    <Text style={[s.previewLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Total deducted</Text>
                    <Text style={[s.previewVal, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
                      {fromSymbol}{total.toLocaleString("en", { maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              )}

              {!!error && (
                <View style={[s.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "33" }]}>
                  <AlertCircle size={15} color={colors.destructive} />
                  <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              )}
            </>
          )}

          {/* ── STEP 3: PIN ── */}
          {step === "pin" && (
            <View style={s.pinContainer}>
              <View style={[s.pinShield, { backgroundColor: accentColor + "22" }]}>
                <Shield size={32} color={accentColor} strokeWidth={1.6} />
              </View>
              <Text style={[s.pinTitle, { color: colors.foreground }]}>Confirm with PIN</Text>
              <Text style={[s.pinSub, { color: colors.mutedForeground }]}>
                Sending {fromSymbol}{total.toLocaleString("en", { maximumFractionDigits: 0 })} to {merchant?.name}
              </Text>

              <View style={s.pinDots}>
                {[0,1,2,3].map(i => (
                  <View key={i} style={[s.pinDot, { backgroundColor: pin.length > i ? accentColor : colors.border }]} />
                ))}
              </View>

              <View style={s.numpad}>
                {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
                  <Pressable
                    key={i}
                    onPress={() => {
                      if (!k) return;
                      if (k === "⌫") { setPin(p => p.slice(0,-1)); return; }
                      if (pin.length < 4) setPin(p => p + k);
                    }}
                    style={({ pressed }) => [s.numKey, {
                      backgroundColor: k ? (pressed ? accentColor + "33" : colors.card) : "transparent",
                      borderColor: k ? colors.border : "transparent",
                    }]}
                  >
                    <Text style={[s.numKeyText, { color: k === "⌫" ? colors.destructive : colors.foreground }]}>{k}</Text>
                  </Pressable>
                ))}
              </View>

              {processing && (
                <View style={s.verifyRow}>
                  <ActivityIndicator size="small" color={accentColor} />
                  <Text style={[s.verifyText, { color: colors.mutedForeground }]}>Processing payment…</Text>
                </View>
              )}
              {!!error && (
                <View style={[s.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "33" }]}>
                  <AlertCircle size={15} color={colors.destructive} />
                  <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              )}
            </View>
          )}

          {/* ── STEP 4: Success ── */}
          {step === "success" && merchant && (
            <View style={s.successContainer}>
              <Animated.View style={[s.successCircle, { backgroundColor: accentColor + "22", transform: [{ scale: successScale }] }]}>
                <CheckCircle2 size={56} color={accentColor} strokeWidth={1.5} />
              </Animated.View>
              <Text style={[s.successTitle, { color: colors.foreground }]}>Payment Sent!</Text>
              <Text style={[s.successSub, { color: colors.mutedForeground }]}>
                {fromSymbol}{numAmount.toLocaleString()} paid to
              </Text>
              <Text style={[s.successName, { color: colors.foreground }]}>{merchant.name}</Text>
              <Text style={[s.successCode, { color: accentColor }]}>
                PAYOSONE · {codeInput.toUpperCase()}
              </Text>

              <View style={[s.sessionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sessionLabel, { color: colors.mutedForeground }]}>NIP Session ID</Text>
                <Text style={[s.sessionId, { color: accentColor }]}>{nipSession}</Text>
                <Text style={[s.sessionNote, { color: colors.mutedForeground }]}>
                  Merchant receives funds instantly. Keep this ID for any dispute.
                </Text>
              </View>

              <Pressable
                onPress={() => router.back()}
                style={[s.doneBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={[s.doneBtnText, { color: colors.foreground }]}>Done</Text>
              </Pressable>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer CTA */}
      {step === "code" && (
        <View style={[s.footer, { paddingBottom: bottomPad }]}>
          <Pressable
            onPress={goToAmount}
            disabled={!merchant}
            style={({ pressed }) => [s.btn, {
              backgroundColor: merchant ? accentColor : colors.border,
              opacity: pressed ? 0.85 : 1,
            }]}
          >
            <Text style={[s.btnText, { color: merchant ? "#fff" : colors.mutedForeground }]}>
              {merchant ? `Pay ${merchant.name.split(" ")[0]}` : "Look Up Code First"}
            </Text>
          </Pressable>
        </View>
      )}
      {step === "amount" && (
        <View style={[s.footer, { paddingBottom: bottomPad }]}>
          <Pressable
            onPress={goToPin}
            style={({ pressed }) => [s.btn, { backgroundColor: accentColor, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={s.btnText}>
              Continue {numAmount > 0 ? `· ${fromSymbol}${total.toLocaleString("en", { maximumFractionDigits: 0 })}` : ""}
            </Text>
          </Pressable>
        </View>
      )}
      {step === "pin" && pin.length === 4 && !processing && (
        <View style={[s.footer, { paddingBottom: bottomPad }]}>
          <Pressable
            onPress={executePay}
            style={({ pressed }) => [s.btn, { backgroundColor: accentColor, opacity: pressed ? 0.85 : 1 }]}
          >
            <CheckCircle2 size={18} color="#fff" strokeWidth={1.8} />
            <Text style={s.btnText}>
              Confirm {fromSymbol}{total.toLocaleString("en", { maximumFractionDigits: 0 })}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  closeBtn:        { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title:           { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  dots:            { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 },
  dot:             { height: 8, borderRadius: 4 },
  field:           { gap: 6 },
  label:           { fontSize: 13, fontFamily: "Inter_500Medium" },

  heroBanner:      { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  heroIcon:        { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  heroTitle:       { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  heroSub:         { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

  codeRow:         { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, overflow: "hidden" },
  codeInput:       { paddingHorizontal: 14, paddingVertical: 14, fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: 3 },
  lookupBtn:       { paddingHorizontal: 20, paddingVertical: 14, alignItems: "center", justifyContent: "center", minWidth: 70 },
  lookupBtnText:   { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  codeHint:        { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },

  errorBox:        { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  errorText:       { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  verifyRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  verifyText:      { fontSize: 13, fontFamily: "Inter_400Regular" },

  merchantCard:    { borderRadius: 18, borderWidth: 1.5, padding: 16, flexDirection: "row", gap: 14, alignItems: "flex-start" },
  merchantIcon:    { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  merchantNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  merchantName:    { fontSize: 16, fontFamily: "Inter_700Bold" },
  merchantMeta:    { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  merchantMetaText:{ fontSize: 12, fontFamily: "Inter_400Regular" },
  merchantDesc:    { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 2 },
  verifiedTag:     { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 4 },
  verifiedText:    { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  stripCard:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  stripIcon:       { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stripName:       { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  stripCode:       { fontSize: 12, fontFamily: "Inter_500Medium" },

  amountRow:       { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, gap: 4 },
  amountSym:       { fontSize: 24, fontFamily: "Inter_400Regular" },
  amountInput:     { flex: 1, fontSize: 32, fontFamily: "Inter_700Bold", paddingVertical: 14 },
  quickRow:        { flexDirection: "row", gap: 8 },
  quickBtn:        { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  quickText:       { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  noteInput:       { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },

  preview:         { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  previewRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  previewLabel:    { fontSize: 13, fontFamily: "Inter_400Regular" },
  previewVal:      { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  previewTotal:    { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.1)" },

  pinContainer:    { alignItems: "center", paddingTop: 20, gap: 14 },
  pinShield:       { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  pinTitle:        { fontSize: 20, fontFamily: "Inter_700Bold" },
  pinSub:          { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 260 },
  pinDots:         { flexDirection: "row", gap: 14, marginVertical: 10 },
  pinDot:          { width: 14, height: 14, borderRadius: 7 },
  numpad:          { flexDirection: "row", flexWrap: "wrap", width: 280, gap: 10, justifyContent: "center" },
  numKey:          { width: 80, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  numKeyText:      { fontSize: 22, fontFamily: "Inter_500Medium" },

  successContainer:{ alignItems: "center", paddingTop: 24, gap: 10 },
  successCircle:   { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  successTitle:    { fontSize: 26, fontFamily: "Inter_700Bold" },
  successSub:      { fontSize: 14, fontFamily: "Inter_400Regular" },
  successName:     { fontSize: 20, fontFamily: "Inter_700Bold" },
  successCode:     { fontSize: 13, fontFamily: "Inter_500Medium" },
  sessionBox:      { width: "100%", borderRadius: 14, borderWidth: 1, padding: 16, gap: 6, marginTop: 16, alignItems: "center" },
  sessionLabel:    { fontSize: 12, fontFamily: "Inter_400Regular" },
  sessionId:       { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  sessionNote:     { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
  doneBtn:         { marginTop: 12, paddingHorizontal: 40, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  doneBtnText:     { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  footer:          { paddingHorizontal: 16, paddingTop: 10 },
  btn:             { height: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText:         { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
