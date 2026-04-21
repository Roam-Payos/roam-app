/**
 * Pay Any Merchant by Bank Account
 *
 * Flow:
 *   Step 1 — Enter account number + select bank → Dojah NUBAN resolves name
 *   Step 2 — Enter amount + optional note → live fee preview
 *   Step 3 — PIN confirmation (4-digit)
 *   Step 4 — Success (instant settlement to merchant's bank)
 *
 * Money movement: mocked until a banking partner NIP API is wired in.
 * Swap the `executeNipTransfer()` call below for your partner's real endpoint.
 */

import { router } from "expo-router";
import {
  X, Search, ChevronDown, CheckCircle2, AlertCircle,
  Building2, Banknote, Shield, Info,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, FlatList, KeyboardAvoidingView,
  Modal, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useRoam } from "@/context/RoamContext";

const API = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

interface NigerianBank { name: string; code: string; }
type Step = "account" | "amount" | "pin" | "success";

function genRef() {
  return `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export default function PayBankScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user, balance, deductBalance, addTransaction } = useRoam();

  const [step, setStep]         = useState<Step>("account");
  const [banks, setBanks]       = useState<NigerianBank[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankModal, setBankModal]   = useState(false);
  const [selectedBank, setSelectedBank] = useState<NigerianBank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName]     = useState("");
  const [looking, setLooking]   = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [verified, setVerified] = useState(false);

  const [amount, setAmount] = useState("");
  const [note, setNote]     = useState("");
  const [error, setError]   = useState("");

  const [pin, setPin]       = useState("");
  const [processing, setProcessing] = useState(false);
  const [nipSession, setNipSession] = useState("");

  const successScale = useRef(new Animated.Value(0)).current;

  const fromCurrency = user?.country.currency ?? "NGN";
  const fromSymbol   = user?.country.symbol    ?? "₦";
  const numAmount    = parseFloat(amount.replace(/,/g, "")) || 0;
  // Flat ₦50 fee for domestic NIP transfers (standard CBN-regulated charge)
  const fee          = fromCurrency === "NGN" ? 50 : Math.round(numAmount * 0.005);
  const total        = numAmount + fee;
  const ref          = useRef(genRef()).current;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = Math.max(insets.bottom, 20) + (Platform.OS === "web" ? 34 : 0);

  // Load bank list on mount — using ISW GetBanksCode (CBN codes)
  useEffect(() => {
    fetch(`${API}/api/isw/banks`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.banks)) {
          setBanks(d.banks.map((b: { bankName?: string; name?: string; bankCode?: string; code?: string }) => ({
            name: b.bankName ?? b.name ?? "",
            code: b.bankCode ?? b.code ?? "",
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Auto-lookup when account number hits 10 digits and bank is selected
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      doLookup(accountNumber, selectedBank.code);
    } else {
      setVerified(false);
      setAccountName("");
      setLookupError("");
    }
  }, [accountNumber, selectedBank]);

  // ── ISW Name Enquiry ─────────────────────────────────────────────────────────
  async function doLookup(acct: string, code: string) {
    setLooking(true); setLookupError(""); setVerified(false); setAccountName("");
    try {
      const res = await fetch(`${API}/api/isw/name-enquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber: acct, bankCode: code }),
      });
      const data = await res.json() as {
        accountName?: string; _outcome?: string; error?: string; responseDescription?: string;
      };
      if (data._outcome === "approved" && data.accountName) {
        setAccountName(data.accountName);
        setVerified(true);
      } else {
        setLookupError(data.error ?? data.responseDescription ?? "Account not found. Check number and bank.");
      }
    } catch {
      setLookupError("Could not verify account. Check your connection.");
    } finally {
      setLooking(false);
    }
  }

  function goToAmount() {
    if (!verified) { setError("Verify account first"); return; }
    setStep("amount"); setError("");
  }

  function goToPin() {
    if (numAmount < 100) { setError(`Minimum transfer is ${fromSymbol}100`); return; }
    if (total > balance) { setError("Insufficient balance"); return; }
    setStep("pin"); setError("");
  }

  // ── ISW DoTransfer ────────────────────────────────────────────────────────────
  async function executePay() {
    if (pin.length < 4) return;
    setProcessing(true); setError("");
    try {
      const res = await fetch(`${API}/api/isw/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditAccountNumber: accountNumber,
          creditAccountName:   accountName,
          creditBankCode:      selectedBank!.code,
          amount:              Math.round(numAmount * 100),  // kobo
          narration:           note || `PayOs wallet payment`,
        }),
      });
      const d = await res.json() as {
        _outcome?: string; _transactionOutcome?: string; sessionId?: string;
        transactionReference?: string; responseDescription?: string; error?: string;
      };

      const outcome = d._transactionOutcome ?? d._outcome ?? "declined";

      if (outcome === "approved") {
        deductBalance(total);
        addTransaction({
          type:     "pay",
          title:    `Paid ${accountName}`,
          subtitle: `${selectedBank!.name} · ${accountNumber} · NIP`,
          amount:   -total,
          currency: fromCurrency,
          symbol:   fromSymbol,
          status:   "completed",
        });
        setNipSession(d.sessionId ?? d.transactionReference ?? "");
        setStep("success");
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }).start();
      } else if (outcome === "pending") {
        // Transaction submitted but awaiting settlement (900A0 / 10001)
        addTransaction({
          type:     "pay",
          title:    `Paid ${accountName}`,
          subtitle: `${selectedBank!.name} · ${accountNumber} · Pending`,
          amount:   -total,
          currency: fromCurrency,
          symbol:   fromSymbol,
          status:   "pending",
        });
        setNipSession(d.transactionReference ?? "");
        setStep("success");
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }).start();
      } else {
        setError(d.error ?? d.responseDescription ?? "Transfer failed. Please try again.");
        setStep("amount");
      }
    } catch {
      setError("Transfer could not be processed. Try again.");
      setStep("amount");
    } finally {
      setProcessing(false);
    }
  }

  const filteredBanks = bankSearch
    ? banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))
    : banks;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => step === "account" || step === "success" ? router.back() : setStep("account")} style={s.closeBtn}>
          <X size={22} color={colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>
          {step === "account" ? "Pay by Bank Account" : step === "amount" ? "Enter Amount" : step === "pin" ? "Enter PIN" : "Payment Sent!"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress dots */}
      {step !== "success" && (
        <View style={s.dots}>
          {(["account", "amount", "pin"] as Step[]).map((s2, i) => (
            <View key={s2} style={[s.dot, { backgroundColor: ["account","amount","pin"].indexOf(step) >= i ? colors.primary : colors.border }]} />
          ))}
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>

          {/* ── STEP 1: Account ── */}
          {step === "account" && (
            <>
              {/* Info banner */}
              <View style={[s.infoBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "33" }]}>
                <Info size={15} color={colors.primary} strokeWidth={1.8} />
                <Text style={[s.infoText, { color: colors.primary }]}>
                  Pay any merchant in Nigeria instantly via bank transfer — no PayOs account required on their end.
                </Text>
              </View>

              {/* Bank selector */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>Bank</Text>
                <Pressable onPress={() => setBankModal(true)}
                  style={[s.selector, { backgroundColor: colors.card, borderColor: selectedBank ? colors.primary : colors.border }]}>
                  <Building2 size={18} color={selectedBank ? colors.primary : colors.mutedForeground} strokeWidth={1.8} />
                  <Text style={[s.selectorText, { color: selectedBank ? colors.foreground : colors.mutedForeground, flex: 1 }]}>
                    {selectedBank ? selectedBank.name : "Select Bank"}
                  </Text>
                  <ChevronDown size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {/* Account number */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>Account Number (NUBAN)</Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.card, borderColor: verified ? colors.primary : lookupError ? colors.destructive : colors.border, color: colors.foreground }]}
                  placeholder="10-digit account number"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  maxLength={10}
                  value={accountNumber}
                  onChangeText={t => { setAccountNumber(t.replace(/\D/g, "")); setLookupError(""); }}
                />
              </View>

              {/* Lookup status */}
              {looking && (
                <View style={s.verifyRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[s.verifyText, { color: colors.mutedForeground }]}>Verifying account via Dojah…</Text>
                </View>
              )}
              {verified && accountName && !looking && (
                <View style={[s.verifyBox, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "33" }]}>
                  <CheckCircle2 size={18} color={colors.primary} strokeWidth={1.8} />
                  <View>
                    <Text style={[s.verifyName, { color: colors.foreground }]}>{accountName}</Text>
                    <Text style={[s.verifySub, { color: colors.mutedForeground }]}>Account holder confirmed · {selectedBank?.name}</Text>
                  </View>
                </View>
              )}
              {!!lookupError && !looking && (
                <View style={[s.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "33" }]}>
                  <AlertCircle size={15} color={colors.destructive} />
                  <Text style={[s.errorText, { color: colors.destructive }]}>{lookupError}</Text>
                </View>
              )}
            </>
          )}

          {/* ── STEP 2: Amount ── */}
          {step === "amount" && (
            <>
              {/* Account card */}
              <View style={[s.acctCard, { backgroundColor: colors.card, borderColor: colors.primary + "44" }]}>
                <View style={[s.acctIcon, { backgroundColor: colors.primary + "22" }]}>
                  <Banknote size={24} color={colors.primary} strokeWidth={1.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.acctName, { color: colors.foreground }]}>{accountName}</Text>
                  <Text style={[s.acctSub, { color: colors.mutedForeground }]}>{selectedBank?.name} · {accountNumber}</Text>
                  <Text style={[s.acctTag, { color: colors.primary }]}>Instant NIP Settlement</Text>
                </View>
              </View>

              {/* Amount input */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>Amount ({fromCurrency})</Text>
                <View style={[s.amountRow, { backgroundColor: colors.card, borderColor: numAmount > 0 ? colors.primary : colors.border }]}>
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
                  <Pressable key={v} onPress={() => setAmount(v.toString())}
                    style={({ pressed }) => [s.quickBtn, { backgroundColor: amount === v.toString() ? colors.primary + "22" : colors.card, borderColor: amount === v.toString() ? colors.primary : colors.border, opacity: pressed ? 0.75 : 1 }]}>
                    <Text style={[s.quickText, { color: amount === v.toString() ? colors.primary : colors.mutedForeground }]}>
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
                  placeholder="e.g. Invoice #INV-001, Delivery payment"
                  placeholderTextColor={colors.mutedForeground}
                  value={note}
                  onChangeText={setNote}
                />
              </View>

              {/* Fee preview */}
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
                    <Text style={[s.previewVal, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
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
              <View style={[s.pinShield, { backgroundColor: colors.primary + "22" }]}>
                <Shield size={32} color={colors.primary} strokeWidth={1.6} />
              </View>
              <Text style={[s.pinTitle, { color: colors.foreground }]}>Confirm with PIN</Text>
              <Text style={[s.pinSub, { color: colors.mutedForeground }]}>
                Sending {fromSymbol}{total.toLocaleString("en", { maximumFractionDigits: 0 })} to {accountName}
              </Text>

              {/* PIN dots */}
              <View style={s.pinDots}>
                {[0,1,2,3].map(i => (
                  <View key={i} style={[s.pinDot, { backgroundColor: pin.length > i ? colors.primary : colors.border }]} />
                ))}
              </View>

              {/* Numpad */}
              <View style={s.numpad}>
                {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
                  <Pressable key={i} onPress={() => {
                    if (!k) return;
                    if (k === "⌫") { setPin(p => p.slice(0,-1)); return; }
                    if (pin.length < 4) setPin(p => p + k);
                  }} style={({ pressed }) => [s.numKey, { backgroundColor: k ? (pressed ? colors.primary + "33" : colors.card) : "transparent", borderColor: k ? colors.border : "transparent" }]}>
                    <Text style={[s.numKeyText, { color: k === "⌫" ? colors.destructive : colors.foreground }]}>{k}</Text>
                  </Pressable>
                ))}
              </View>

              {processing && (
                <View style={s.verifyRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[s.verifyText, { color: colors.mutedForeground }]}>Processing NIP transfer…</Text>
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
          {step === "success" && (
            <View style={s.successContainer}>
              <Animated.View style={[s.successCircle, { backgroundColor: "#10B981" + "22", transform: [{ scale: successScale }] }]}>
                <CheckCircle2 size={56} color="#10B981" strokeWidth={1.5} />
              </Animated.View>
              <Text style={[s.successTitle, { color: colors.foreground }]}>Payment Sent!</Text>
              <Text style={[s.successSub, { color: colors.mutedForeground }]}>
                {fromSymbol}{numAmount.toLocaleString()} sent to
              </Text>
              <Text style={[s.successName, { color: colors.foreground }]}>{accountName}</Text>
              <Text style={[s.successBank, { color: colors.mutedForeground }]}>{selectedBank?.name} · {accountNumber}</Text>

              <View style={[s.sessionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sessionLabel, { color: colors.mutedForeground }]}>NIP Session ID</Text>
                <Text style={[s.sessionId, { color: colors.primary }]}>{nipSession}</Text>
                <Text style={[s.sessionNote, { color: colors.mutedForeground }]}>
                  Merchant receives funds instantly. Keep this ID for disputes.
                </Text>
              </View>

              <Pressable onPress={() => router.back()}
                style={[s.doneBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.doneBtnText, { color: colors.foreground }]}>Done</Text>
              </Pressable>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer CTA */}
      {step === "account" && (
        <View style={[s.footer, { paddingBottom: bottomPad }]}>
          <Pressable onPress={goToAmount} disabled={!verified}
            style={({ pressed }) => [s.btn, { backgroundColor: verified ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={[s.btnText, { color: verified ? "#fff" : colors.mutedForeground }]}>
              Continue {verified ? `→ ${accountName.split(" ")[0]}` : ""}
            </Text>
          </Pressable>
        </View>
      )}
      {step === "amount" && (
        <View style={[s.footer, { paddingBottom: bottomPad }]}>
          <Pressable onPress={goToPin}
            style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={s.btnText}>
              Continue {numAmount > 0 ? `· ${fromSymbol}${total.toLocaleString("en", { maximumFractionDigits: 0 })}` : ""}
            </Text>
          </Pressable>
        </View>
      )}
      {step === "pin" && pin.length === 4 && !processing && (
        <View style={[s.footer, { paddingBottom: bottomPad }]}>
          <Pressable onPress={executePay}
            style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
            <CheckCircle2 size={18} color="#fff" strokeWidth={1.8} />
            <Text style={s.btnText}>Send {fromSymbol}{total.toLocaleString("en", { maximumFractionDigits: 0 })}</Text>
          </Pressable>
        </View>
      )}

      {/* Bank picker modal */}
      <Modal visible={bankModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBankModal(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHeader, { borderColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Select Bank</Text>
            <Pressable onPress={() => setBankModal(false)}>
              <X size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <View style={[s.bankSearch, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Search size={16} color={colors.mutedForeground} />
            <TextInput
              style={[s.bankSearchInput, { color: colors.foreground }]}
              placeholder="Search bank…"
              placeholderTextColor={colors.mutedForeground}
              value={bankSearch}
              onChangeText={setBankSearch}
              autoFocus
            />
          </View>
          <FlatList
            data={filteredBanks}
            keyExtractor={b => b.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable onPress={() => { setSelectedBank(item); setBankModal(false); setBankSearch(""); }}
                style={({ pressed }) => [s.bankItem, { borderColor: colors.border, backgroundColor: pressed ? colors.primary + "11" : "transparent" }]}>
                <Text style={[s.bankItemText, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[s.bankItemCode, { color: colors.mutedForeground }]}>{item.code}</Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={[s.sep, { backgroundColor: colors.border }]} />}
          />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  closeBtn:       { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title:          { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  dots:           { flexDirection: "row", gap: 6, justifyContent: "center", paddingBottom: 8 },
  dot:            { width: 6, height: 6, borderRadius: 3 },
  infoBanner:     { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  infoText:       { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  field:          { gap: 8 },
  label:          { fontSize: 13, fontFamily: "Inter_500Medium" },
  selector:       { flexDirection: "row", alignItems: "center", gap: 10, height: 54, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  selectorText:   { fontSize: 15, fontFamily: "Inter_400Regular" },
  input:          { height: 54, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, fontSize: 20, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  verifyRow:      { flexDirection: "row", alignItems: "center", gap: 8 },
  verifyText:     { fontSize: 13, fontFamily: "Inter_400Regular" },
  verifyBox:      { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  verifyName:     { fontSize: 15, fontFamily: "Inter_700Bold" },
  verifySub:      { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  errorBox:       { flexDirection: "row", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  errorText:      { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  acctCard:       { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, borderWidth: 1.5 },
  acctIcon:       { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  acctName:       { fontSize: 16, fontFamily: "Inter_700Bold" },
  acctSub:        { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  acctTag:        { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  amountRow:      { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1.5, height: 72, paddingLeft: 18 },
  amountSym:      { fontSize: 22, fontFamily: "Inter_400Regular", paddingRight: 6 },
  amountInput:    { flex: 1, height: 72, fontSize: 32, fontFamily: "Inter_700Bold" },
  quickRow:       { flexDirection: "row", gap: 8 },
  quickBtn:       { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  quickText:      { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  noteInput:      { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_400Regular" },
  preview:        { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  previewRow:     { flexDirection: "row", justifyContent: "space-between" },
  previewTotal:   { paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.1)" },
  previewLabel:   { fontSize: 13, fontFamily: "Inter_400Regular" },
  previewVal:     { fontSize: 13, fontFamily: "Inter_500Medium" },
  pinContainer:   { alignItems: "center", gap: 12, paddingTop: 10 },
  pinShield:      { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  pinTitle:       { fontSize: 20, fontFamily: "Inter_700Bold" },
  pinSub:         { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  pinDots:        { flexDirection: "row", gap: 14, marginVertical: 8 },
  pinDot:         { width: 14, height: 14, borderRadius: 7 },
  numpad:         { flexDirection: "row", flexWrap: "wrap", width: 270, gap: 12, justifyContent: "center" },
  numKey:         { width: 78, height: 64, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  numKeyText:     { fontSize: 22, fontFamily: "Inter_600SemiBold" },
  successContainer:{ alignItems: "center", paddingTop: 20, gap: 8 },
  successCircle:  { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  successTitle:   { fontSize: 24, fontFamily: "Inter_700Bold" },
  successSub:     { fontSize: 14, fontFamily: "Inter_400Regular" },
  successName:    { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  successBank:    { fontSize: 13, fontFamily: "Inter_400Regular" },
  sessionBox:     { marginTop: 16, padding: 16, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 6, width: "100%" },
  sessionLabel:   { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 1 },
  sessionId:      { fontSize: 13, fontFamily: "Inter_700Bold" },
  sessionNote:    { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 17 },
  doneBtn:        { marginTop: 12, height: 52, paddingHorizontal: 32, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", width: "100%" },
  doneBtnText:    { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  footer:         { paddingHorizontal: 16, paddingTop: 10 },
  btn:            { height: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText:        { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modal:          { flex: 1 },
  modalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle:     { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  bankSearch:     { flexDirection: "row", alignItems: "center", margin: 12, padding: 10, borderRadius: 12, borderWidth: 1, gap: 8 },
  bankSearchInput:{ flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  bankItem:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  bankItemText:   { fontSize: 15, fontFamily: "Inter_400Regular" },
  bankItemCode:   { fontSize: 12, fontFamily: "Inter_400Regular" },
  sep:            { height: StyleSheet.hairlineWidth },
});
