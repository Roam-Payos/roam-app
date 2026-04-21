/**
 * Send Money screen — three modes:
 *
 *  "ng_domestic"    Nigerian → Nigerian bank transfer (NUBAN lookup via Dojah)
 *  "cross"          Cross-border with live FX (NGN→GHS, NGN→KES, etc.)
 *  "other_domestic" Same-country, non-Nigerian (phone number, flat fee)
 *
 * Flow:
 *   Step 1  Recipient  → bank/phone + account verified
 *   Step 2  Amount     → preview of what's deducted / received
 *   Step 3  PIN        → 4-digit numpad confirmation
 *   Step 4  Success
 */

import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  AlertTriangle, ArrowLeftRight, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Info, Search, Shield, X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, SectionList, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COUNTRIES, Country, useRoam } from "@/context/RoamContext";
import { useColors } from "@/hooks/useColors";

// ── Types ─────────────────────────────────────────────────────────────────────
type Step  = "recipient" | "amount" | "pin" | "success";
type Mode  = "ng_domestic" | "cross" | "other_domestic";
interface NigerianBank { name: string; code: string; longCode?: string; }
interface NubanResult  {
  accountName: string;
  bankName?: string;
  serviceUnavailable?: boolean; // Dojah plan doesn't include this feature
}

const DOMESTIC_FEE: Record<string, number> = { NGN: 50, GHS: 2, KES: 10, ZAR: 3 };
const API = () => process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

// ── Group banks alphabetically for SectionList ────────────────────────────────
function groupBanks(banks: NigerianBank[]) {
  const map: Record<string, NigerianBank[]> = {};
  banks.forEach((b) => {
    const letter = b.name[0].toUpperCase();
    if (!map[letter]) map[letter] = [];
    map[letter].push(b);
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({ title, data }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// BankPickerModal
// ═══════════════════════════════════════════════════════════════════════════════
function BankPickerModal({
  visible, banks, loading, onSelect, onClose, colors,
}: {
  visible: boolean;
  banks: NigerianBank[];
  loading: boolean;
  onSelect: (b: NigerianBank) => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 200); }
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q
      ? banks.filter((b) => b.name.toLowerCase().includes(q))
      : banks;
  }, [query, banks]);

  const sections = useMemo(() => groupBanks(filtered), [filtered]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[mpStyles.sheet, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[mpStyles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 24 : 8), borderBottomColor: colors.border }]}>
          <Text style={[mpStyles.title, { color: colors.foreground }]}>Select Bank</Text>
          <Pressable onPress={onClose} style={[mpStyles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <X size={16} color={colors.foreground} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Search bar */}
        <View style={[mpStyles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Search size={16} color={colors.mutedForeground} strokeWidth={1.8} />
          <TextInput
            ref={inputRef}
            style={[mpStyles.searchInput, { color: colors.foreground }]}
            placeholder="Search bank name…"
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          {query.length > 0 && Platform.OS !== "ios" && (
            <Pressable onPress={() => setQuery("")}>
              <X size={14} color={colors.mutedForeground} strokeWidth={2} />
            </Pressable>
          )}
        </View>

        {/* Banks count */}
        <View style={[mpStyles.meta, { borderBottomColor: colors.border }]}>
          <Text style={[mpStyles.metaText, { color: colors.mutedForeground }]}>
            {loading ? "Loading banks…" : `${filtered.length} of ${banks.length} banks`}
          </Text>
        </View>

        {loading ? (
          <View style={mpStyles.loader}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[mpStyles.loadingText, { color: colors.mutedForeground }]}>Fetching banks…</Text>
          </View>
        ) : sections.length === 0 ? (
          <View style={mpStyles.loader}>
            <Text style={[mpStyles.loadingText, { color: colors.mutedForeground }]}>No banks match "{query}"</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.code}
            stickySectionHeadersEnabled
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 20 }}
            renderSectionHeader={({ section: { title } }) => (
              <View style={[mpStyles.sectionHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <Text style={[mpStyles.sectionLetter, { color: colors.primary }]}>{title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  mpStyles.bankRow,
                  { borderBottomColor: colors.border, backgroundColor: pressed ? colors.card : "transparent" },
                ]}
                onPress={() => { onSelect(item); onClose(); }}
              >
                {/* Letter avatar */}
                <View style={[mpStyles.avatar, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={[mpStyles.avatarLetter, { color: colors.primary }]}>
                    {item.name[0].toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[mpStyles.bankName, { color: colors.foreground }]}>{item.name}</Text>
                </View>

                <ChevronRight size={14} color={colors.border} strokeWidth={1.8} />
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SendScreen
// ═══════════════════════════════════════════════════════════════════════════════
export default function SendScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user, balance, deductBalance, addTransaction,
          previewCrossConvert, fxRatesUpdatedAt, verifyPin } = useRoam();

  const senderCountry = user?.country ?? COUNTRIES[0];
  const fromCurrency  = senderCountry.currency;
  const fromSymbol    = senderCountry.symbol;

  // ── Transfer mode ─────────────────────────────────────────────────────────
  const [toCountry, setToCountry] = useState<Country>(
    COUNTRIES.find((c) => c.code !== senderCountry.code) ?? COUNTRIES[1]
  );
  const mode: Mode = useMemo(() => {
    if (toCountry.code !== senderCountry.code) return "cross";
    if (senderCountry.code === "NG")            return "ng_domestic";
    return "other_domestic";
  }, [toCountry, senderCountry]);

  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("recipient");

  // ── Shared fields ─────────────────────────────────────────────────────────
  const [phone,     setPhone]     = useState("");
  const [recipName, setRecipName] = useState("");

  // ── Country picker ────────────────────────────────────────────────────────
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // ── Nigerian domestic ─────────────────────────────────────────────────────
  const [banks,          setBanks]          = useState<NigerianBank[]>([]);
  const [banksLoading,   setBanksLoading]   = useState(false);
  const [showBankModal,  setShowBankModal]  = useState(false);
  const [selectedBank,   setSelectedBank]   = useState<NigerianBank | null>(null);
  const [accountNumber,  setAccountNumber]  = useState("");
  const [nubanResult,    setNubanResult]    = useState<NubanResult | null>(null);
  const [nubanLoading,   setNubanLoading]   = useState(false);
  const [nubanError,     setNubanError]     = useState("");

  // ── Amount + errors ───────────────────────────────────────────────────────
  const [amount,     setAmount]     = useState("");
  const [fieldError, setFieldError] = useState("");

  // ── PIN ───────────────────────────────────────────────────────────────────
  const [pin,      setPin]      = useState("");
  const [pinError, setPinError] = useState("");

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = Math.max(insets.bottom, 16) + (Platform.OS === "web" ? 34 : 0);

  // ── Derived ───────────────────────────────────────────────────────────────
  const numAmount = parseFloat(amount.replace(/,/g, "")) || 0;
  const isCross   = mode === "cross";

  const fxPreview = useMemo(() => {
    if (!isCross || numAmount <= 0) return null;
    return previewCrossConvert(numAmount, fromCurrency, toCountry.currency);
  }, [numAmount, fromCurrency, toCountry, isCross, previewCrossConvert]);

  const recipientGets  = isCross ? (fxPreview?.outputAmount ?? 0) : numAmount;
  const domesticFee    = DOMESTIC_FEE[fromCurrency] ?? 50;
  const transferFee    = isCross ? 0 : domesticFee;
  const totalDeducted  = numAmount + transferFee;

  const ratesAgo = fxRatesUpdatedAt
    ? (() => {
        const m = Math.round((Date.now() - new Date(fxRatesUpdatedAt).getTime()) / 60000);
        return m < 2 ? "just now" : `${m}m ago`;
      })()
    : "–";

  const recipientLabel = mode === "ng_domestic"
    ? (nubanResult?.accountName ?? accountNumber)
    : (recipName.trim() || phone);

  // ── Load banks when NG domestic mode activates ────────────────────────────
  useEffect(() => {
    if (mode !== "ng_domestic" || banks.length > 0) return;
    setBanksLoading(true);
    fetch(`${API()}/api/nuban/banks`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.banks)) setBanks(d.banks); })
      .catch(() => {})
      .finally(() => setBanksLoading(false));
  }, [mode]);

  // ── Auto-NUBAN lookup (debounced 600ms) ───────────────────────────────────
  const lookupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNubanResult(null);
    setNubanError("");
    if (mode !== "ng_domestic" || accountNumber.length !== 10 || !selectedBank) return;

    if (lookupRef.current) clearTimeout(lookupRef.current);
    lookupRef.current = setTimeout(async () => {
      setNubanLoading(true);
      try {
        const r = await fetch(`${API()}/api/nuban/lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountNumber, bankCode: selectedBank.code }),
        });
        const d = await r.json() as {
          verified?: boolean;
          accountName?: string;
          bankName?: string;
          serviceUnavailable?: boolean;
          error?: string;
        };

        if (d.serviceUnavailable) {
          // Dojah plan doesn't have this product — allow bypass
          setNubanResult({ accountName: "", serviceUnavailable: true });
          return;
        }
        if (!r.ok || d.verified === false) {
          throw new Error(d.error ?? "Account not found. Please check the account number and selected bank.");
        }
        // Prefer the bank name the client already knows (from the picker) over Dojah's response,
        // since Dojah often returns a blank bank field even on successful lookups
        setNubanResult({
          accountName: d.accountName ?? "",
          bankName: selectedBank?.name || d.bankName,
        });
      } catch (e: unknown) {
        setNubanError((e as Error).message || "Could not verify account. Check number and bank.");
      } finally {
        setNubanLoading(false);
      }
    }, 600);

    return () => { if (lookupRef.current) clearTimeout(lookupRef.current); };
  }, [accountNumber, selectedBank, mode]);

  // ── Navigation ────────────────────────────────────────────────────────────
  function goBack() {
    if (step === "recipient") { router.back(); return; }
    setStep(step === "amount" ? "recipient" : step === "pin" ? "amount" : "recipient");
  }

  function goToAmount() {
    setFieldError("");
    if (mode === "ng_domestic") {
      if (!selectedBank)               { setFieldError("Select your recipient's bank"); return; }
      if (accountNumber.length !== 10) { setFieldError("Enter a valid 10-digit account number"); return; }
      if (nubanLoading)                { setFieldError("Account verification in progress…"); return; }
      // Allow bypass when service is unavailable; block only on "not yet verified" with no error
      if (!nubanResult && !nubanError) { setFieldError("Waiting for account verification…"); return; }
      // Block when Dojah returned a definitive error (account not found etc.)
      if (!nubanResult && nubanError)  { setFieldError(nubanError); return; }
    } else {
      if (phone.replace(/\D/g, "").length < 7) { setFieldError("Enter a valid phone number"); return; }
    }
    setStep("amount");
  }

  function goToPin() {
    setFieldError("");
    if (numAmount < 100)         { setFieldError(`Minimum send is ${fromSymbol}100`); return; }
    if (totalDeducted > balance) { setFieldError("Insufficient balance"); return; }
    setStep("pin");
  }

  function confirmSend() {
    if (pin.length < 4) { setPinError("Enter your 4-digit PIN"); return; }
    if (!verifyPin(pin)) { setPinError("Incorrect PIN"); setPin(""); return; }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deductBalance(totalDeducted);
    addTransaction({
      type:     "send",
      title:    `Sent to ${recipientLabel}`,
      subtitle: isCross
        ? `${toCountry.name} · ${toCountry.symbol}${Math.floor(recipientGets).toLocaleString()} ${toCountry.currency}`
        : mode === "ng_domestic"
          ? `${selectedBank?.name} · ${accountNumber}`
          : `${toCountry.name} · Domestic`,
      amount:   -totalDeducted,
      currency: fromCurrency,
      symbol:   fromSymbol,
      status:   "completed",
      wallet:   "home",
    });
    setStep("success");
  }

  function pinKey(d: string) { if (pin.length < 4) { setPin((p) => p + d); setPinError(""); } }
  function pinBack()         { setPin((p) => p.slice(0, -1)); setPinError(""); }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>

      {/* Bank Picker Modal */}
      <BankPickerModal
        visible={showBankModal}
        banks={banks}
        loading={banksLoading}
        colors={colors}
        onSelect={(b) => { setSelectedBank(b); setNubanResult(null); setNubanError(""); }}
        onClose={() => setShowBankModal(false)}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <Pressable onPress={goBack} style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <X size={18} color={colors.foreground} strokeWidth={1.8} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Send Money</Text>
            <View style={styles.stepDots}>
              {(["recipient","amount","pin"] as Step[]).map((s, i) => (
                <View key={s} style={[styles.dot, {
                  backgroundColor: step === s || (step === "success" && i === 2)
                    ? colors.primary : colors.border
                }]} />
              ))}
            </View>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: botPad, flexGrow: 1 }}>

          {/* ══════════════════════════════════════════════════════
              STEP 1 — Recipient
          ══════════════════════════════════════════════════════ */}
          {step === "recipient" && (
            <View style={styles.body}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>Who are you sending to?</Text>

              {/* Destination country */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Destination Country</Text>
                <Pressable
                  onPress={() => setShowCountryPicker((v) => !v)}
                  style={[styles.select, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={styles.flagText}>{toCountry.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.selectMain, { color: colors.foreground }]}>
                      {toCountry.name}{toCountry.code === senderCountry.code ? " (Domestic)" : ""}
                    </Text>
                    <Text style={[styles.selectSub, { color: colors.mutedForeground }]}>
                      {toCountry.currency}{toCountry.code === senderCountry.code ? " · No FX" : ` · ${toCountry.dialCode}`}
                    </Text>
                  </View>
                  <ChevronDown size={16} color={colors.mutedForeground} strokeWidth={1.8} />
                </Pressable>

                {showCountryPicker && (
                  <View style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {/* Domestic */}
                    <Pressable
                      style={[styles.pickerItem, { borderBottomColor: colors.border },
                        toCountry.code === senderCountry.code && { backgroundColor: colors.primary + "18" }]}
                      onPress={() => { setToCountry(senderCountry); setShowCountryPicker(false); }}
                    >
                      <Text style={styles.flagText}>{senderCountry.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerMain, { color: colors.foreground }]}>{senderCountry.name} (Domestic)</Text>
                        <Text style={[styles.pickerSub, { color: colors.mutedForeground }]}>{senderCountry.currency} · No FX</Text>
                      </View>
                      {toCountry.code === senderCountry.code && <CheckCircle2 size={16} color={colors.primary} strokeWidth={2} />}
                    </Pressable>
                    {/* Cross-border */}
                    {COUNTRIES.filter((c) => c.code !== senderCountry.code).map((c) => (
                      <Pressable
                        key={c.code}
                        style={[styles.pickerItem, { borderBottomColor: colors.border },
                          c.code === toCountry.code && { backgroundColor: colors.primary + "18" }]}
                        onPress={() => { setToCountry(c); setShowCountryPicker(false); }}
                      >
                        <Text style={styles.flagText}>{c.flag}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.pickerMain, { color: colors.foreground }]}>{c.name}</Text>
                          <Text style={[styles.pickerSub, { color: colors.mutedForeground }]}>{c.currency} · {c.dialCode}</Text>
                        </View>
                        {c.code === toCountry.code && <CheckCircle2 size={16} color={colors.primary} strokeWidth={2} />}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* ── Nigerian domestic ─────────────────────────────────────── */}
              {mode === "ng_domestic" && (
                <>
                  {/* Bank picker button */}
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Recipient's Bank</Text>
                    <Pressable
                      onPress={() => { if (!banksLoading) setShowBankModal(true); }}
                      style={[styles.select, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      {banksLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <View style={[styles.bankAvatar, { backgroundColor: colors.primary + "18" }]}>
                          <Text style={[styles.bankAvatarLetter, { color: colors.primary }]}>
                            {selectedBank ? selectedBank.name[0].toUpperCase() : "🏦"}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.selectMain, { color: selectedBank ? colors.foreground : colors.mutedForeground }]}>
                          {banksLoading ? "Loading banks…" : (selectedBank?.name ?? "Tap to select bank")}
                        </Text>
                        {selectedBank && (
                          <Text style={[styles.selectSub, { color: colors.mutedForeground }]}>
                            Tap to change
                          </Text>
                        )}
                      </View>
                      {!banksLoading && <ChevronDown size={16} color={colors.mutedForeground} strokeWidth={1.8} />}
                    </Pressable>
                  </View>

                  {/* Account number */}
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Account Number (NUBAN)</Text>
                    <View style={[styles.nubanRow, {
                      backgroundColor: colors.card,
                      borderColor: nubanResult && !nubanResult.serviceUnavailable
                        ? colors.success
                        : nubanResult?.serviceUnavailable
                          ? "#f59e0b"
                          : nubanError
                            ? colors.destructive
                            : colors.border,
                    }]}>
                      <TextInput
                        style={[styles.nubanInput, { color: colors.foreground }]}
                        placeholder="10-digit account number"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="number-pad"
                        maxLength={10}
                        value={accountNumber}
                        onChangeText={(t) => {
                          setAccountNumber(t.replace(/\D/g, ""));
                          setNubanResult(null);
                          setNubanError("");
                        }}
                      />
                      <View style={styles.nubanStatus}>
                        {nubanLoading && <ActivityIndicator size="small" color={colors.primary} />}
                        {!nubanLoading && nubanResult && !nubanResult.serviceUnavailable && (
                          <CheckCircle2 size={20} color={colors.success} strokeWidth={2} />
                        )}
                        {!nubanLoading && nubanResult?.serviceUnavailable && (
                          <AlertTriangle size={20} color="#f59e0b" strokeWidth={2} />
                        )}
                      </View>
                    </View>

                    {/* Progress dots */}
                    <View style={styles.nubanDots}>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <View key={i} style={[styles.nubanDot, {
                          backgroundColor: i < accountNumber.length
                            ? (nubanResult && !nubanResult.serviceUnavailable
                                ? colors.success
                                : nubanResult?.serviceUnavailable
                                  ? "#f59e0b"
                                  : colors.primary)
                            : colors.border,
                        }]} />
                      ))}
                      <Text style={[styles.nubanCounter, { color: colors.mutedForeground }]}>
                        {accountNumber.length}/10
                      </Text>
                    </View>

                    {/* ── State 1: Verified ✓ ── */}
                    {nubanResult && !nubanResult.serviceUnavailable && !nubanLoading && (
                      <View style={[styles.verifiedBanner, { backgroundColor: colors.success + "12", borderColor: colors.success + "25" }]}>
                        <CheckCircle2 size={16} color={colors.success} strokeWidth={2} />
                        <View>
                          <Text style={[styles.verifiedName, { color: colors.success }]}>{nubanResult.accountName}</Text>
                          {nubanResult.bankName && (
                            <Text style={[styles.verifiedBank, { color: colors.success + "aa" }]}>{nubanResult.bankName}</Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* ── State 2: Service unavailable ⚠ — bypass allowed ── */}
                    {nubanResult?.serviceUnavailable && !nubanLoading && (
                      <View style={[styles.verifiedBanner, { backgroundColor: "#f59e0b14", borderColor: "#f59e0b30" }]}>
                        <AlertTriangle size={16} color="#f59e0b" strokeWidth={2} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.verifiedName, { color: "#f59e0b" }]}>Verification unavailable</Text>
                          <Text style={[styles.verifiedBank, { color: "#f59e0baa" }]}>
                            Dojah account lookup is not active on this plan. Please confirm account details manually before proceeding.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* ── State 3: Error ✗ — account not found ── */}
                    {!!nubanError && !nubanLoading && (
                      <View style={[styles.warnBanner, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "25" }]}>
                        <Info size={14} color={colors.destructive} strokeWidth={2} />
                        <Text style={[styles.warnText, { color: colors.destructive }]}>{nubanError}</Text>
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* ── Cross / other domestic ────────────────────────────────── */}
              {mode !== "ng_domestic" && (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>
                      Recipient Name <Text style={{ opacity: 0.45 }}>(optional)</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                      placeholder="Full name"
                      placeholderTextColor={colors.mutedForeground}
                      value={recipName}
                      onChangeText={setRecipName}
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Recipient Phone</Text>
                    <View style={[styles.phoneRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[styles.dialCode, { borderRightColor: colors.border }]}>
                        <Text style={styles.flagText}>{toCountry.flag}</Text>
                        <Text style={[styles.dialText, { color: colors.mutedForeground }]}>{toCountry.dialCode}</Text>
                      </View>
                      <TextInput
                        style={[styles.phoneInput, { color: colors.foreground }]}
                        placeholder="800 000 0000"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={(t) => { setPhone(t); setFieldError(""); }}
                      />
                    </View>
                  </View>

                  {isCross && (
                    <View style={[styles.noticeBanner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "28" }]}>
                      <ArrowLeftRight size={14} color={colors.primary} strokeWidth={2} />
                      <Text style={[styles.noticeText, { color: colors.primary }]}>
                        Cross-border · live FX rate applies (1.5% spread). Full breakdown on next step.
                      </Text>
                    </View>
                  )}
                </>
              )}

              {!!fieldError && <Text style={[styles.error, { color: colors.destructive }]}>{fieldError}</Text>}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 2 — Amount + Preview
          ══════════════════════════════════════════════════════ */}
          {step === "amount" && (
            <View style={styles.body}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>How much?</Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                {mode === "ng_domestic"
                  ? `→ ${nubanResult?.accountName ?? accountNumber} · ${selectedBank?.name}`
                  : `→ ${recipientLabel} · ${toCountry.name}`}
              </Text>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>You Send ({fromCurrency})</Text>
                <View style={[styles.amountRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.amtSymbol, { color: colors.mutedForeground }]}>{fromSymbol}</Text>
                  <TextInput
                    style={[styles.amtInput, { color: colors.foreground }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={(t) => { setAmount(t); setFieldError(""); }}
                    autoFocus
                  />
                  <Text style={[styles.amtCurr, { color: colors.mutedForeground }]}>{fromCurrency}</Text>
                </View>
                <Text style={[styles.balanceHint, { color: colors.mutedForeground }]}>
                  Available: {fromSymbol}{balance.toLocaleString("en-NG", { maximumFractionDigits: 0 })}
                </Text>
              </View>

              {numAmount > 0 && (
                <View style={[styles.fxCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {isCross && fxPreview ? (
                    <>
                      {/* You send ↔ They receive */}
                      <View style={styles.fxMain}>
                        <View style={styles.fxSide}>
                          <Text style={[styles.fxLabel, { color: colors.mutedForeground }]}>You send</Text>
                          <Text style={[styles.fxAmount, { color: colors.foreground }]}>
                            {fromSymbol}{numAmount.toLocaleString("en-NG", { maximumFractionDigits: 0 })}
                          </Text>
                          <Text style={[styles.fxCurr, { color: colors.mutedForeground }]}>{fromCurrency}</Text>
                        </View>
                        <View style={[styles.fxArrow, { backgroundColor: colors.primary + "18" }]}>
                          <ArrowLeftRight size={16} color={colors.primary} strokeWidth={2} />
                        </View>
                        <View style={[styles.fxSide, { alignItems: "flex-end" }]}>
                          <Text style={[styles.fxLabel, { color: colors.mutedForeground }]}>They receive</Text>
                          <Text style={[styles.fxAmount, { color: colors.success }]}>
                            {toCountry.symbol}{Math.floor(recipientGets).toLocaleString("en-NG")}
                          </Text>
                          <Text style={[styles.fxCurr, { color: colors.mutedForeground }]}>{toCountry.currency}</Text>
                        </View>
                      </View>

                      <View style={[styles.fxDivider, { backgroundColor: colors.border }]} />
                      <FxRow label="Exchange route"              value={`${fromCurrency} → USD → ${toCountry.currency}`} muted colors={colors} />
                      <FxRow label="Mid-market rate"             value={`1 USD = ${fromSymbol}${fxPreview.midRate.toLocaleString("en-NG",{maximumFractionDigits:2})}`} colors={colors} />
                      <FxRow label="Applied rate (1.5% spread)" value={`${fromSymbol}${fxPreview.appliedRate.toLocaleString("en-NG",{maximumFractionDigits:2})}/USD`} colors={colors} />
                      <FxRow label="FX spread fee"               value={`${toCountry.symbol}${fxPreview.feeAmount.toLocaleString("en-NG",{maximumFractionDigits:2})} ${toCountry.currency}`} muted colors={colors} />
                      <FxRow label="Transfer fee"                value="Free ✓" highlight colors={colors} />
                      <View style={[styles.fxDivider, { backgroundColor: colors.border }]} />
                      <FxRow label="Total deducted"              value={`${fromSymbol}${numAmount.toLocaleString("en-NG")}`} bold colors={colors} />

                      <View style={styles.rateStamp}>
                        <Clock size={11} color={colors.mutedForeground} strokeWidth={1.8} />
                        <Text style={[styles.rateStampText, { color: colors.mutedForeground }]}>
                          Rate updated {ratesAgo} · open.er-api.com
                        </Text>
                      </View>
                    </>
                  ) : (
                    /* Domestic */
                    <>
                      <FxRow label="Recipient gets" value={`${fromSymbol}${numAmount.toLocaleString("en-NG")}`} colors={colors} />
                      {mode === "ng_domestic" && (
                        <FxRow label="Account" value={`${accountNumber} · ${selectedBank?.name}`} muted colors={colors} />
                      )}
                      <FxRow label="Transfer fee" value={`${fromSymbol}${domesticFee}`} muted colors={colors} />
                      <View style={[styles.fxDivider, { backgroundColor: colors.border }]} />
                      <FxRow label="Total deducted" value={`${fromSymbol}${totalDeducted.toLocaleString("en-NG")}`} bold colors={colors} />
                    </>
                  )}
                </View>
              )}

              {numAmount > 0 && totalDeducted > balance && (
                <View style={[styles.warnBanner, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "25" }]}>
                  <Info size={14} color={colors.destructive} strokeWidth={2} />
                  <Text style={[styles.warnText, { color: colors.destructive }]}>
                    Insufficient — need {fromSymbol}{(totalDeducted - balance).toLocaleString("en-NG",{maximumFractionDigits:0})} more.
                  </Text>
                </View>
              )}

              {!!fieldError && <Text style={[styles.error, { color: colors.destructive }]}>{fieldError}</Text>}
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 3 — PIN
          ══════════════════════════════════════════════════════ */}
          {step === "pin" && (
            <View style={[styles.body, { alignItems: "center" }]}>
              <View style={[styles.pinShield, { backgroundColor: colors.primary + "14" }]}>
                <Shield size={28} color={colors.primary} strokeWidth={1.8} />
              </View>
              <Text style={[styles.stepTitle, { color: colors.foreground, textAlign: "center" }]}>Confirm with PIN</Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground, textAlign: "center" }]}>
                Sending {fromSymbol}{numAmount.toLocaleString("en-NG")}
                {isCross ? ` → ${toCountry.symbol}${Math.floor(recipientGets).toLocaleString()} ${toCountry.currency}` : ""}{"\n"}
                to {recipientLabel}
              </Text>

              <View style={styles.pinDots}>
                {[0,1,2,3].map((i) => (
                  <View key={i} style={[styles.pinDot, {
                    borderColor:     pin.length > i ? colors.primary : colors.border,
                    backgroundColor: pin.length > i ? colors.primary : "transparent",
                  }]} />
                ))}
              </View>

              {!!pinError && <Text style={[styles.error, { color: colors.destructive }]}>{pinError}</Text>}

              <View style={styles.numpad}>
                {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k) => (
                  <Pressable
                    key={k || "empty"}
                    disabled={!k}
                    style={({ pressed }) => [
                      styles.numKey,
                      k === "" && { opacity: 0 },
                      { backgroundColor: k && k !== "⌫" ? colors.card : "transparent",
                        borderColor: colors.border, opacity: pressed && k ? 0.6 : 1 }
                    ]}
                    onPress={() => k === "⌫" ? pinBack() : k ? pinKey(k) : undefined}
                  >
                    <Text style={[styles.numKeyText, { color: k === "⌫" ? colors.mutedForeground : colors.foreground }]}>{k}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 4 — Success
          ══════════════════════════════════════════════════════ */}
          {step === "success" && (
            <View style={[styles.body, { alignItems: "center", justifyContent: "center", flex: 1, paddingTop: 40 }]}>
              <View style={[styles.successCircle, { backgroundColor: colors.success + "18" }]}>
                <CheckCircle2 size={52} color={colors.success} strokeWidth={1.5} />
              </View>
              <Text style={[styles.successTitle, { color: colors.foreground }]}>Sent!</Text>
              <Text style={[styles.successAmt, { color: colors.primary }]}>
                {fromSymbol}{numAmount.toLocaleString("en-NG")} {fromCurrency}
              </Text>
              {isCross && (
                <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
                  {recipientLabel} receives{"\n"}
                  {toCountry.symbol}{Math.floor(recipientGets).toLocaleString()} {toCountry.currency}
                </Text>
              )}
              {mode === "ng_domestic" && (
                <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
                  {nubanResult?.accountName ?? accountNumber}{"\n"}
                  {selectedBank?.name} · {accountNumber}
                </Text>
              )}
              {mode === "other_domestic" && (
                <Text style={[styles.successSub, { color: colors.mutedForeground }]}>{recipientLabel}</Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* ── Footer CTAs ───────────────────────────────────────────────── */}
        {step === "recipient" && (
          <View style={[styles.footer, { paddingBottom: botPad }]}>
            <Pressable
              onPress={goToAmount}
              style={({ pressed }) => [styles.cta, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.ctaText, { color: "#fff" }]}>Continue</Text>
            </Pressable>
          </View>
        )}

        {step === "amount" && (
          <View style={[styles.footer, { paddingBottom: botPad }]}>
            <Pressable
              onPress={goToPin}
              disabled={numAmount <= 0}
              style={({ pressed }) => [styles.cta, {
                backgroundColor: numAmount <= 0 ? colors.muted : colors.primary,
                opacity: pressed ? 0.85 : 1,
              }]}
            >
              <Text style={[styles.ctaText, { color: numAmount <= 0 ? colors.mutedForeground : "#fff" }]}>
                Review & Confirm
              </Text>
            </Pressable>
          </View>
        )}

        {step === "pin" && (
          <View style={[styles.footer, { paddingBottom: botPad }]}>
            <Pressable
              onPress={confirmSend}
              disabled={pin.length < 4}
              style={({ pressed }) => [styles.cta, {
                backgroundColor: pin.length < 4 ? colors.muted : colors.primary,
                opacity: pressed ? 0.85 : 1,
              }]}
            >
              <Text style={[styles.ctaText, { color: pin.length < 4 ? colors.mutedForeground : "#fff" }]}>
                Send Money
              </Text>
            </Pressable>
          </View>
        )}

        {step === "success" && (
          <View style={[styles.footer, { paddingBottom: botPad, flexDirection: "row", gap: 12 }]}>
            <Pressable
              onPress={() => router.push("/(tabs)/history")}
              style={[styles.cta, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            >
              <Text style={[styles.ctaText, { color: colors.foreground }]}>View History</Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={[styles.cta, { flex: 1, backgroundColor: colors.primary }]}
            >
              <Text style={[styles.ctaText, { color: "#fff" }]}>Done</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// ── FxRow ─────────────────────────────────────────────────────────────────────
function FxRow({ label, value, bold, muted, highlight, colors }: {
  label: string; value: string;
  bold?: boolean; muted?: boolean; highlight?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.fxRow}>
      <Text style={[styles.fxRowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.fxRowValue, {
        color: highlight ? colors.success : muted ? colors.mutedForeground : colors.foreground,
        fontFamily: bold ? "Inter_700Bold" : "Inter_500Medium",
      }]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 8,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerCenter: { alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  stepDots: { flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  body: { paddingHorizontal: 16, paddingTop: 20, gap: 20 },
  stepTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  stepSub:   { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: -8 },

  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },

  select: {
    minHeight: 64, borderRadius: 14, borderWidth: 1,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10,
  },
  selectMain: { fontSize: 15, fontFamily: "Inter_500Medium" },
  selectSub:  { fontSize: 12, fontFamily: "Inter_400Regular" },
  flagText:   { fontSize: 22 },

  bankAvatar:       { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  bankAvatarLetter: { fontSize: 16, fontFamily: "Inter_700Bold" },

  picker: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginTop: 4 },
  pickerItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 13, gap: 10, borderBottomWidth: 1,
  },
  pickerMain: { fontSize: 14, fontFamily: "Inter_500Medium" },
  pickerSub:  { fontSize: 12, fontFamily: "Inter_400Regular" },

  // NUBAN
  nubanRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 14, borderWidth: 2, overflow: "hidden",
  },
  nubanInput: {
    flex: 1, height: 58, paddingHorizontal: 16,
    fontSize: 20, fontFamily: "Inter_600SemiBold", letterSpacing: 3,
  },
  nubanStatus: { paddingRight: 14, alignItems: "center", justifyContent: "center" },
  nubanDots: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: -2,
  },
  nubanDot: { width: 16, height: 4, borderRadius: 2 },
  nubanCounter: { fontSize: 11, fontFamily: "Inter_500Medium", marginLeft: 4 },

  verifiedBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  verifiedName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  verifiedBank: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

  input: { height: 56, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular" },

  phoneRow: { height: 56, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  dialCode: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRightWidth: 1, height: "100%" },
  dialText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  phoneInput: { flex: 1, height: "100%", paddingHorizontal: 14, fontSize: 16, fontFamily: "Inter_400Regular" },

  noticeBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  noticeText:   { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  warnBanner:   { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  warnText:     { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  error:        { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: -8 },

  amountRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, gap: 6 },
  amtSymbol: { fontSize: 22, fontFamily: "Inter_400Regular" },
  amtInput:  { flex: 1, height: 66, fontSize: 30, fontFamily: "Inter_700Bold" },
  amtCurr:   { fontSize: 14, fontFamily: "Inter_500Medium" },
  balanceHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -4 },

  fxCard:     { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  fxMain:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 },
  fxSide:     { flex: 1, gap: 2 },
  fxArrow:    { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  fxLabel:    { fontSize: 12, fontFamily: "Inter_400Regular" },
  fxAmount:   { fontSize: 22, fontFamily: "Inter_700Bold" },
  fxCurr:     { fontSize: 12, fontFamily: "Inter_500Medium" },
  fxDivider:  { height: 1, marginVertical: 2 },
  fxRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fxRowLabel: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  fxRowValue: { fontSize: 13 },
  rateStamp:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  rateStampText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  pinShield:  { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  pinDots:    { flexDirection: "row", gap: 16, marginVertical: 12 },
  pinDot:     { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  numpad:     { flexDirection: "row", flexWrap: "wrap", width: 280, justifyContent: "center", gap: 14, marginTop: 8 },
  numKey:     { width: 76, height: 64, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  numKeyText: { fontSize: 22, fontFamily: "Inter_500Medium" },

  successCircle: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  successTitle:  { fontSize: 28, fontFamily: "Inter_700Bold" },
  successAmt:    { fontSize: 24, fontFamily: "Inter_700Bold", marginTop: -4 },
  successSub:    { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },

  footer:  { paddingHorizontal: 16, paddingTop: 10 },
  cta:     { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});

// ── BankPickerModal styles ─────────────────────────────────────────────────────
const mpStyles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  title:    { fontSize: 18, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
    paddingHorizontal: 12, height: 46, borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, height: 46, fontSize: 15, fontFamily: "Inter_400Regular" },

  meta: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  sectionHeader: {
    paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1,
  },
  sectionLetter: { fontSize: 13, fontFamily: "Inter_700Bold" },

  bankRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 16, fontFamily: "Inter_700Bold" },
  bankName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  bankCode: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
});
