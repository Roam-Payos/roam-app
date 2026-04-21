/**
 * Bills Payment Screen — powered by Interswitch Quickteller V5
 *
 * Flow: Category → Biller → Customer ID → Payment Items → Confirm → Pay → Result
 */

import { router } from "expo-router";
import {
  AlertCircle, CheckCircle, ChevronLeft, ChevronRight,
  Loader, Search, X, Zap,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useRoam } from "@/context/RoamContext";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ISWBiller {
  Id: number;
  Name: string;
  ShortName: string;
  Narration: string;
  CustomerField1: string;
  CategoryId: number;
  CategoryName: string;
  CurrencySymbol: string;
  Surcharge: string;
  AmountType: number;
}

interface ISWCategory {
  Id: number;
  Name: string;
  Description: string;
  Billers: ISWBiller[];
}

// ISW returns Amount and IsAmountFixed as strings from /options?serviceId=
// IsAmountFixed: "1" = fixed, "0" or "2" = open/range
// Amount: amount in kobo as a string (e.g. "150000" = ₦1,500)
interface ISWPaymentItem {
  Id: number;
  Name: string;
  Code: string;
  PaymentCode: string;   // used in validatecustomers and Transactions body
  Amount: string;
  IsAmountFixed: string;
  CurrencySymbol?: string;
  CurrencyCode?: string;
  ItemFee?: string;
  ShortName?: string;
  BillerName?: string;
}

/** Parse ISW item amount string (kobo) → NGN number */
function iswAmountNgn(item: ISWPaymentItem): number {
  const kobo = parseInt(item.Amount ?? "0", 10);
  return isNaN(kobo) ? 0 : kobo / 100;
}

/** Returns true when this item has a fixed (non-zero) amount */
function iswIsFixed(item: ISWPaymentItem): boolean {
  return item.IsAmountFixed === "1" && iswAmountNgn(item) > 0;
}

type Step = "category" | "biller" | "customer" | "item" | "confirm" | "paying" | "success" | "error";

// ── Category icon mapping ─────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<number, string> = {
  1: "#F59E0B",  // Utility Bills
  2: "#6366F1",  // Cable TV
  3: "#3B82F6",  // Mobile Recharge
  4: "#3B82F6",  // Mobile Recharge
  8: "#10B981",  // Phone Bills
  9: "#8B5CF6",  // Subscriptions
  13: "#EC4899", // Insurance
  14: "#6B7280", // Others
  15: "#0EA5E9", // Airlines
  18: "#F97316", // Mobile Wallets
  23: "#EF4444", // Event Tickets
};

function categoryColor(id: number) { return CATEGORY_COLORS[id] ?? "#6366F1"; }

// Popular category IDs to show first
const PRIORITY_CATS = [1, 2, 4, 9, 13, 15, 18, 23];

export default function BillsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, balance, deductBalance, addTransaction } = useRoam();

  const symbol   = user?.country.symbol   ?? "₦";
  const currency = user?.country.currency ?? "NGN";
  const topPad   = insets.top + (Platform.OS === "web" ? 67 : 0);

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep]           = useState<Step>("category");
  const [categories, setCategories] = useState<ISWCategory[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [selCategory, setSelCategory] = useState<ISWCategory | null>(null);
  const [selBiller, setSelBiller]     = useState<ISWBiller | null>(null);
  const [billerSearch, setBillerSearch] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [validating, setValidating] = useState(false);
  const [customerError, setCustomerError] = useState("");

  const [paymentItems, setPaymentItems] = useState<ISWPaymentItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selItem, setSelItem]     = useState<ISWPaymentItem | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  const [payError, setPayError]   = useState("");
  const [txRef, setTxRef]         = useState("");

  // ── Load all billers on mount ──────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/isw/billers`)
      .then((r) => r.json())
      .then((d: { categories?: ISWCategory[] }) => {
        const cats = (d.categories ?? []).filter((c) => c.Billers.length > 0);
        // Sort: priority categories first, then alphabetically
        cats.sort((a, b) => {
          const pa = PRIORITY_CATS.indexOf(a.Id);
          const pb = PRIORITY_CATS.indexOf(b.Id);
          if (pa !== -1 && pb !== -1) return pa - pb;
          if (pa !== -1) return -1;
          if (pb !== -1) return 1;
          return a.Name.localeCompare(b.Name);
        });
        setCategories(cats);
        setFetchError("");
      })
      .catch(() => setFetchError("Unable to load billers. Check connection."))
      .finally(() => setLoading(false));
  }, []);

  // ── Filtered billers in selected category ─────────────────────────────────
  const filteredBillers = useMemo(() => {
    if (!selCategory) return [];
    const q = billerSearch.trim().toLowerCase();
    return q
      ? selCategory.Billers.filter((b) => b.Name.toLowerCase().includes(q))
      : selCategory.Billers;
  }, [selCategory, billerSearch]);

  // ── Load payment items when biller selected ───────────────────────────────
  const loadPaymentItems = useCallback(async (billerId: number) => {
    setItemsLoading(true);
    setPaymentItems([]);
    setSelItem(null);
    try {
      const r = await fetch(`${API}/isw/billers/${billerId}/items`);
      const d = await r.json() as { items?: ISWPaymentItem[] };
      setPaymentItems(d.items ?? []);
    } catch {
      setPaymentItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  // ── Validate customer ─────────────────────────────────────────────────────
  async function validateCustomer() {
    if (!selBiller || !customerId.trim()) { setStep("item"); return; }
    setValidating(true);
    setCustomerError("");
    try {
      const r = await fetch(`${API}/isw/billers/validate-customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentCode: selItem?.PaymentCode ?? String(selBiller.Id),
          customerId:  customerId.trim(),
        }),
      });
      const d = await r.json() as { customer?: { FullName?: string } };
      setCustomerName(d.customer?.FullName ?? "");
      setStep("item");
    } catch {
      // Validation not available for all billers — proceed anyway
      setCustomerName("");
      setStep("item");
    } finally {
      setValidating(false);
    }
  }

  // ── Derived amount ─────────────────────────────────────────────────────────
  const derivedAmountNgn: number = useMemo(() => {
    if (!selItem) return parseFloat(customAmount) || 0;
    if (iswIsFixed(selItem)) return iswAmountNgn(selItem);
    return parseFloat(customAmount) || 0;
  }, [selItem, customAmount]);

  const amountInKobo = Math.round(derivedAmountNgn * 100);

  // ── Pay ───────────────────────────────────────────────────────────────────
  async function pay() {
    if (!selBiller || !customerId.trim()) return;
    if (derivedAmountNgn <= 0) { setPayError("Enter a valid amount."); return; }
    if (derivedAmountNgn > balance) { setPayError("Insufficient wallet balance."); return; }

    setStep("paying");
    setPayError("");

    try {
      const r = await fetch(`${API}/isw/bills/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId:    customerId.trim(),
          serviceId:     selBiller.Id,
          paymentItemId: selItem?.Id ?? 0,
          amount:        amountInKobo,
          customerMobile: user?.phone ?? "",
          customerEmail: user?.email ?? "",
        }),
      });
      const d = await r.json() as {
        ResponseCode?: string; ResponseDescription?: string;
        requestReference?: string; _outcome?: string; _reason?: string;
      };

      const outcome = d._outcome ?? (
        (d.ResponseCode === "00" || d.ResponseCode === "90000") ? "approved" : "declined"
      );

      if (outcome === "approved") {
        deductBalance(derivedAmountNgn);
        addTransaction({
          type: "bills",
          title: selBiller.Name,
          subtitle: `${selBiller.CustomerField1 ?? "Account"}: ${customerId}`,
          amount: -derivedAmountNgn,
          currency,
          symbol,
          status: "completed",
        });
        setTxRef(d.requestReference ?? "");
        setStep("success");
      } else if (outcome === "pending") {
        // Transaction submitted but still processing — record as pending
        addTransaction({
          type: "bills",
          title: selBiller.Name,
          subtitle: `${selBiller.CustomerField1 ?? "Account"}: ${customerId}`,
          amount: -derivedAmountNgn,
          currency,
          symbol,
          status: "pending",
        });
        setTxRef(d.requestReference ?? "");
        setPayError("Payment is being processed. Your balance will update once confirmed.");
        setStep("error");
      } else if (outcome === "duplicate") {
        setPayError("This payment reference was already used. Please try again.");
        setStep("error");
      } else {
        setPayError(d._reason ?? d.ResponseDescription ?? "Payment was declined. Please try again.");
        setStep("error");
      }
    } catch (err: unknown) {
      setPayError("Network error — please check your connection and try again.");
      setStep("error");
    }
  }

  // ── Navigation helpers ─────────────────────────────────────────────────────
  function goBack() {
    if (step === "category")  { router.back(); return; }
    if (step === "biller")    { setStep("category"); setBillerSearch(""); return; }
    if (step === "customer")  { setStep("biller"); return; }
    if (step === "item")      { setStep("customer"); return; }
    if (step === "confirm")   { setStep("item"); return; }
    if (step === "error")     { setStep("confirm"); return; }
    router.back();
  }

  function selectCategory(cat: ISWCategory) {
    setSelCategory(cat);
    setSelBiller(null);
    setBillerSearch("");
    setCustomerId("");
    setCustomerName("");
    setPaymentItems([]);
    setSelItem(null);
    setCustomAmount("");
    setStep("biller");
  }

  function selectBiller(biller: ISWBiller) {
    setSelBiller(biller);
    setCustomerId("");
    setCustomerName("");
    setStep("customer");
    loadPaymentItems(biller.Id);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <View style={[s.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }]}>
        <View style={[s.successIcon, { backgroundColor: colors.success + "1A" }]}>
          <CheckCircle size={56} color={colors.success} strokeWidth={1.5} />
        </View>
        <Text style={[s.successTitle, { color: colors.foreground }]}>Payment Successful!</Text>
        <Text style={[s.successSub, { color: colors.mutedForeground }]}>
          {symbol}{derivedAmountNgn.toLocaleString()} paid to {selBiller?.Name}
          {"\n"}for account {customerId}
          {customerName ? `\n(${customerName})` : ""}
        </Text>
        {!!txRef && (
          <Text style={[s.txRef, { color: colors.mutedForeground }]}>Ref: {txRef}</Text>
        )}
        <Pressable onPress={() => router.back()} style={[s.doneBtn, { backgroundColor: colors.primary }]}>
          <Text style={s.doneBtnText}>Done</Text>
        </Pressable>
        <Pressable onPress={() => { setStep("category"); setSelCategory(null); setSelBiller(null); }} style={{ marginTop: 12 }}>
          <Text style={[{ color: colors.primary, fontSize: 14, fontFamily: "Inter_500Medium" }]}>Pay another bill</Text>
        </Pressable>
      </View>
    );
  }

  if (step === "error") {
    return (
      <View style={[s.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }]}>
        <View style={[s.successIcon, { backgroundColor: colors.destructive + "1A" }]}>
          <AlertCircle size={56} color={colors.destructive} strokeWidth={1.5} />
        </View>
        <Text style={[s.successTitle, { color: colors.foreground }]}>Payment Failed</Text>
        <Text style={[s.successSub, { color: colors.mutedForeground }]}>{payError}</Text>
        <Pressable onPress={() => setStep("confirm")} style={[s.doneBtn, { backgroundColor: colors.primary }]}>
          <Text style={s.doneBtnText}>Try Again</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={[{ color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }]}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (step === "paying") {
    return (
      <View style={[s.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[{ color: colors.mutedForeground, marginTop: 16, fontSize: 15, fontFamily: "Inter_400Regular" }]}>
          Processing payment…
        </Text>
      </View>
    );
  }

  const stepTitle: Record<Step, string> = {
    category: "Bill Payments",
    biller:   selCategory?.Name ?? "Select Provider",
    customer: selBiller?.Name ?? "Account Details",
    item:     "Payment Details",
    confirm:  "Confirm Payment",
    paying:   "Processing…",
    success:  "Success",
    error:    "Failed",
  };

  const showBack = !["paying", "success"].includes(step);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        {showBack ? (
          <Pressable onPress={goBack} style={s.headerBtn}>
            {step === "category"
              ? <X size={22} color={colors.foreground} strokeWidth={1.8} />
              : <ChevronLeft size={22} color={colors.foreground} strokeWidth={1.8} />
            }
          </Pressable>
        ) : <View style={{ width: 36 }} />}
        <Text style={[s.headerTitle, { color: colors.foreground }]}>{stepTitle[step]}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Step indicator */}
      <StepDots step={step} colors={colors} />

      {/* ── STEP: CATEGORY ── */}
      {step === "category" && (
        <>
          {loading ? (
            <View style={s.centerLoader}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[s.loaderText, { color: colors.mutedForeground }]}>Loading billers…</Text>
            </View>
          ) : fetchError ? (
            <View style={s.centerLoader}>
              <AlertCircle size={40} color={colors.destructive} strokeWidth={1.5} />
              <Text style={[s.loaderText, { color: colors.destructive }]}>{fetchError}</Text>
              <Pressable onPress={() => { setFetchError(""); setLoading(true); }} style={[s.retryBtn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={categories}
              keyExtractor={(c) => String(c.Id)}
              numColumns={2}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              columnWrapperStyle={{ gap: 12 }}
              renderItem={({ item: cat }) => (
                <Pressable
                  onPress={() => selectCategory(cat)}
                  style={({ pressed }) => [
                    s.catCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      flex: 1,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={[s.catDot, { backgroundColor: categoryColor(cat.Id) + "22" }]}>
                    <Zap size={20} color={categoryColor(cat.Id)} strokeWidth={1.8} />
                  </View>
                  <Text style={[s.catName, { color: colors.foreground }]} numberOfLines={2}>{cat.Name}</Text>
                  <Text style={[s.catCount, { color: colors.mutedForeground }]}>{cat.Billers.length} providers</Text>
                </Pressable>
              )}
            />
          )}
        </>
      )}

      {/* ── STEP: BILLER ── */}
      {step === "biller" && selCategory && (
        <>
          <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: colors.border, margin: 16, marginBottom: 8 }]}>
            <Search size={16} color={colors.mutedForeground} strokeWidth={1.8} />
            <TextInput
              style={[s.searchInput, { color: colors.foreground }]}
              placeholder={`Search ${selCategory.Name}…`}
              placeholderTextColor={colors.mutedForeground}
              value={billerSearch}
              onChangeText={setBillerSearch}
              autoFocus={false}
            />
            {billerSearch.length > 0 && (
              <Pressable onPress={() => setBillerSearch("")}>
                <X size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
          <FlatList
            data={filteredBillers}
            keyExtractor={(b) => String(b.Id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
            renderItem={({ item: biller }) => (
              <Pressable
                onPress={() => selectBiller(biller)}
                style={({ pressed }) => [
                  s.billerRow,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={[s.billerAvatar, { backgroundColor: categoryColor(biller.CategoryId) + "18" }]}>
                  <Text style={[s.billerInitial, { color: categoryColor(biller.CategoryId) }]}>
                    {biller.Name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.billerName, { color: colors.foreground }]}>{biller.Name}</Text>
                  {!!biller.Narration && (
                    <Text style={[s.billerDesc, { color: colors.mutedForeground }]} numberOfLines={1}>{biller.Narration}</Text>
                  )}
                </View>
                <ChevronRight size={16} color={colors.mutedForeground} strokeWidth={1.8} />
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={s.centerLoader}>
                <Text style={[s.loaderText, { color: colors.mutedForeground }]}>No providers match "{billerSearch}"</Text>
              </View>
            }
          />
        </>
      )}

      {/* ── STEP: CUSTOMER ID ── */}
      {step === "customer" && selBiller && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}>
          <View style={[s.billerInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[s.billerAvatar, { backgroundColor: categoryColor(selBiller.CategoryId) + "18", width: 48, height: 48, borderRadius: 14 }]}>
              <Text style={[s.billerInitial, { color: categoryColor(selBiller.CategoryId), fontSize: 20 }]}>
                {selBiller.Name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.billerName, { color: colors.foreground }]}>{selBiller.Name}</Text>
              <Text style={[s.billerDesc, { color: colors.mutedForeground }]}>{selBiller.CategoryName}</Text>
            </View>
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>
              {selBiller.CustomerField1 || "Account / Customer ID"}
            </Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.card, borderColor: customerError ? colors.destructive : colors.border, color: colors.foreground }]}
              placeholder={`Enter ${selBiller.CustomerField1 || "account number"}`}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="default"
              value={customerId}
              onChangeText={(t) => { setCustomerId(t); setCustomerError(""); }}
              autoFocus
            />
            {!!customerError && <Text style={[s.errText, { color: colors.destructive }]}>{customerError}</Text>}
          </View>

          <Pressable
            onPress={() => {
              if (!customerId.trim()) { setCustomerError("Please enter your account or customer ID"); return; }
              validateCustomer();
            }}
            disabled={validating}
            style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed || validating ? 0.85 : 1 }]}
          >
            {validating
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.primaryBtnText}>Continue</Text>
            }
          </Pressable>
        </ScrollView>
      )}

      {/* ── STEP: PAYMENT ITEM / AMOUNT ── */}
      {step === "item" && selBiller && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}>
          {/* Customer name badge */}
          {!!customerName && (
            <View style={[s.customerBadge, { backgroundColor: colors.success + "18", borderColor: colors.success + "40" }]}>
              <CheckCircle size={14} color={colors.success} strokeWidth={2} />
              <Text style={[s.customerBadgeText, { color: colors.success }]}>
                Verified: {customerName}
              </Text>
            </View>
          )}

          {/* Account summary */}
          <View style={[s.summaryBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SummaryRow label="Provider" value={selBiller.Name} colors={colors} />
            <SummaryRow label="Account" value={customerId} colors={colors} />
          </View>

          {/* Payment items */}
          {itemsLoading ? (
            <View style={s.centerLoader}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[s.loaderText, { color: colors.mutedForeground }]}>Loading plans…</Text>
            </View>
          ) : paymentItems.length > 1 ? (
            <View style={s.field}>
              <Text style={[s.label, { color: colors.mutedForeground }]}>Select Plan</Text>
              {paymentItems.map((item) => (
                <Pressable
                  key={item.Id}
                  onPress={() => { setSelItem(item); setCustomAmount(""); }}
                  style={[
                    s.itemRow,
                    {
                      backgroundColor: selItem?.Id === item.Id ? colors.primary + "18" : colors.card,
                      borderColor: selItem?.Id === item.Id ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemName, { color: colors.foreground }]}>{item.Name}</Text>
                    {iswIsFixed(item) && (
                      <Text style={[s.itemPrice, { color: colors.primary }]}>
                        {symbol}{iswAmountNgn(item).toLocaleString()}
                      </Text>
                    )}
                  </View>
                  {selItem?.Id === item.Id && (
                    <CheckCircle size={18} color={colors.primary} strokeWidth={2} />
                  )}
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Custom amount (if no fixed items or non-fixed item selected) */}
          {(paymentItems.length === 0 || (selItem && !iswIsFixed(selItem)) || (paymentItems.length === 1 && !iswIsFixed(paymentItems[0]))) && (
            <View style={s.field}>
              <Text style={[s.label, { color: colors.mutedForeground }]}>Amount ({currency})</Text>
              <View style={[s.amtInputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.amtSymbol, { color: colors.mutedForeground }]}>{symbol}</Text>
                <TextInput
                  style={[s.amtInput, { color: colors.foreground }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  value={customAmount}
                  onChangeText={setCustomAmount}
                />
              </View>
            </View>
          )}

          {/* If single fixed-price item, auto-select it */}
          {paymentItems.length === 1 && paymentItems[0].IsAmountFixed && (
            <View style={[s.summaryBox, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "30" }]}>
              <SummaryRow
                label="Amount to pay"
                value={`${symbol}${(paymentItems[0].Amount / 100).toLocaleString()}`}
                colors={colors}
                highlight
              />
            </View>
          )}

          <Pressable
            onPress={() => {
              // Auto-select single item if applicable
              if (paymentItems.length === 1 && !selItem) setSelItem(paymentItems[0]);
              if (derivedAmountNgn <= 0 && !(paymentItems.length === 1 && paymentItems[0].IsAmountFixed && paymentItems[0].Amount > 0)) {
                return;
              }
              const amt = paymentItems.length === 1 && paymentItems[0].IsAmountFixed && paymentItems[0].Amount > 0
                ? paymentItems[0].Amount / 100
                : derivedAmountNgn;
              if (amt <= 0) return;
              if (!selItem && paymentItems.length === 1) setSelItem(paymentItems[0]);
              setStep("confirm");
            }}
            style={({ pressed }) => [s.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={s.primaryBtnText}>Review & Confirm</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── STEP: CONFIRM ── */}
      {step === "confirm" && selBiller && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
          {/* Amount display */}
          <View style={[s.amtDisplay, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
            <Text style={[s.amtDisplayLabel, { color: colors.mutedForeground }]}>You will pay</Text>
            <Text style={[s.amtDisplayValue, { color: colors.primary }]}>
              {symbol}{derivedAmountNgn.toLocaleString()}
            </Text>
          </View>

          {/* Summary */}
          <View style={[s.summaryBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SummaryRow label="Provider"   value={selBiller.Name} colors={colors} />
            <SummaryRow label="Category"   value={selBiller.CategoryName} colors={colors} />
            <SummaryRow label="Account"    value={customerId} colors={colors} />
            {!!customerName && <SummaryRow label="Name" value={customerName} colors={colors} />}
            {selItem && <SummaryRow label="Plan" value={selItem.Name} colors={colors} />}
            <SummaryRow label="Currency"   value={currency} colors={colors} />
          </View>

          {/* Balance check */}
          {derivedAmountNgn > balance && (
            <View style={[s.customerBadge, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "40" }]}>
              <AlertCircle size={14} color={colors.destructive} strokeWidth={2} />
              <Text style={[s.customerBadgeText, { color: colors.destructive }]}>
                Insufficient balance — wallet has {symbol}{balance.toLocaleString()}
              </Text>
            </View>
          )}

          {!!payError && (
            <Text style={[s.errText, { color: colors.destructive, textAlign: "center" }]}>{payError}</Text>
          )}

          <Pressable
            onPress={pay}
            disabled={derivedAmountNgn > balance}
            style={({ pressed }) => [
              s.primaryBtn,
              {
                backgroundColor: derivedAmountNgn > balance ? colors.muted : colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[s.primaryBtnText, { color: derivedAmountNgn > balance ? colors.mutedForeground : "#fff" }]}>
              Pay {symbol}{derivedAmountNgn.toLocaleString()}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepDots({ step, colors }: { step: Step; colors: ReturnType<typeof useColors> }) {
  const steps: Step[] = ["category", "biller", "customer", "item", "confirm"];
  const idx = steps.indexOf(step);
  if (idx === -1) return null;
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 10 }}>
      {steps.map((_, i) => (
        <View
          key={i}
          style={{
            width: i === idx ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i <= idx ? colors.primary : colors.border,
          }}
        />
      ))}
    </View>
  );
}

function SummaryRow({
  label, value, colors, highlight,
}: {
  label: string; value: string;
  colors: ReturnType<typeof useColors>;
  highlight?: boolean;
}) {
  return (
    <View style={s.summaryRow}>
      <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[s.summaryValue, { color: highlight ? colors.primary : colors.foreground }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 4 },
  headerBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle:    { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  centerLoader:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  loaderText:     { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn:       { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  catCard:        { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10, minHeight: 110 },
  catDot:         { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  catName:        { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  catCount:       { fontSize: 12, fontFamily: "Inter_400Regular" },
  searchBar:      { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput:    { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },
  billerRow:      { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  billerAvatar:   { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  billerInitial:  { fontSize: 16, fontFamily: "Inter_700Bold" },
  billerName:     { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  billerDesc:     { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  billerInfoCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  field:          { gap: 10 },
  label:          { fontSize: 13, fontFamily: "Inter_500Medium" },
  input:          { height: 56, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontFamily: "Inter_400Regular" },
  errText:        { fontSize: 13, fontFamily: "Inter_400Regular" },
  primaryBtn:     { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  customerBadge:  { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  customerBadgeText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  summaryBox:     { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  summaryRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.08)" },
  summaryLabel:   { fontSize: 13, fontFamily: "Inter_400Regular" },
  summaryValue:   { fontSize: 14, fontFamily: "Inter_600SemiBold", maxWidth: "55%" as unknown as number, textAlign: "right" },
  itemRow:        { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  itemName:       { fontSize: 14, fontFamily: "Inter_500Medium" },
  itemPrice:      { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  amtInputRow:    { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, height: 56, gap: 8 },
  amtSymbol:      { fontSize: 18, fontFamily: "Inter_500Medium" },
  amtInput:       { flex: 1, fontSize: 20, fontFamily: "Inter_600SemiBold", padding: 0 },
  amtDisplay:     { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: "center", gap: 6 },
  amtDisplayLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  amtDisplayValue: { fontSize: 36, fontFamily: "Inter_700Bold" },
  successIcon:    { width: 110, height: 110, borderRadius: 35, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  successTitle:   { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 8 },
  successSub:     { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  txRef:          { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 8 },
  doneBtn:        { marginTop: 24, paddingHorizontal: 48, paddingVertical: 16, borderRadius: 16 },
  doneBtnText:    { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
