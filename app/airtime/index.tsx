/**
 * Roam – Airtime & Data
 *
 * Flow:
 *   Step 0 — Service (Airtime | Data) + Country search box (dropdown)
 *   Step 1 — Network provider selection
 *   Step 2 — Phone number entry
 *   Step 3 — Amount / Data bundle
 *   Step 4 — Confirm & Pay
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import {
  AlertCircle, CheckCircle, ChevronDown, ChevronRight,
  Clock, Globe, Search, Signal, Wifi, X, Zap,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TouchableWithoutFeedback, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useRoam } from "@/context/RoamContext";

/* ─── FX helper ──────────────────────────────────────────────────────────── */
function fxConvert(
  amount: number, from: string, to: string,
  ratesPerUsd: Record<string, number>,
): number {
  if (from === to || amount === 0) return amount;
  return amount * ((ratesPerUsd[to] ?? 1) / (ratesPerUsd[from] ?? 1));
}

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const RECENT_KEY = "roam_airtime_recent_numbers";
const MAX_RECENT = 6;

/* ─── Country catalogue ──────────────────────────────────────────────────── */
interface AirtimeCountry {
  code: string; name: string; flag: string; dialCode: string;
  currency: string; symbol: string;
  provider: "interswitch" | "international";
  isw_cat_ids?: number[];
}
const COUNTRIES: AirtimeCountry[] = [
  { code:"NG", name:"Nigeria",       flag:"🇳🇬", dialCode:"+234", currency:"NGN", symbol:"₦",   provider:"interswitch",  isw_cat_ids:[4,8] },
  { code:"GH", name:"Ghana",         flag:"🇬🇭", dialCode:"+233", currency:"GHS", symbol:"₵",   provider:"international" },
  { code:"KE", name:"Kenya",         flag:"🇰🇪", dialCode:"+254", currency:"KES", symbol:"KSh", provider:"international" },
  { code:"ZA", name:"South Africa",  flag:"🇿🇦", dialCode:"+27",  currency:"ZAR", symbol:"R",   provider:"international" },
  { code:"GB", name:"United Kingdom",flag:"🇬🇧", dialCode:"+44",  currency:"GBP", symbol:"£",   provider:"international" },
  { code:"US", name:"United States", flag:"🇺🇸", dialCode:"+1",   currency:"USD", symbol:"$",   provider:"international" },
  { code:"TZ", name:"Tanzania",      flag:"🇹🇿", dialCode:"+255", currency:"TZS", symbol:"TSh", provider:"international" },
  { code:"UG", name:"Uganda",        flag:"🇺🇬", dialCode:"+256", currency:"UGX", symbol:"USh", provider:"international" },
  { code:"SN", name:"Senegal",       flag:"🇸🇳", dialCode:"+221", currency:"XOF", symbol:"CFA", provider:"international" },
];

/* ─── Static networks ────────────────────────────────────────────────────── */
const STATIC_NETWORKS: Record<string, { name: string; color: string }[]> = {
  GH: [{ name:"MTN Ghana",    color:"#FFCC00" },{ name:"Vodafone GH", color:"#E60000" },
       { name:"AirtelTigo",   color:"#FF6600" },{ name:"Glo Ghana",   color:"#018001" }],
  KE: [{ name:"Safaricom",    color:"#017A27" },{ name:"Airtel Kenya",color:"#FF0000" },
       { name:"Telkom KE",    color:"#1A1A73" }],
  ZA: [{ name:"Vodacom",      color:"#E60000" },{ name:"MTN SA",      color:"#FFCC00" },
       { name:"Cell C",       color:"#000066" },{ name:"Telkom SA",   color:"#006EB9" }],
  GB: [{ name:"Vodafone UK",  color:"#E60000" },{ name:"EE",          color:"#007B40" },
       { name:"O2",           color:"#003087" },{ name:"Three UK",    color:"#FF6A10" },
       { name:"giffgaff",     color:"#000000" }],
  US: [{ name:"AT&T",         color:"#00A8E0" },{ name:"T-Mobile",    color:"#E20074" },
       { name:"Verizon",      color:"#CD040B" },{ name:"Metro",       color:"#E20074" }],
  TZ: [{ name:"Vodacom TZ",   color:"#E60000" },{ name:"Airtel TZ",   color:"#FF0000" },
       { name:"Tigo TZ",      color:"#0099CC" },{ name:"Halotel",     color:"#FF6600" }],
  UG: [{ name:"MTN Uganda",   color:"#FFCC00" },{ name:"Airtel UG",   color:"#FF0000" },
       { name:"Africell",     color:"#EF3E23" }],
  SN: [{ name:"Orange SN",    color:"#FF6600" },{ name:"Free SN",     color:"#E60000" },
       { name:"Expresso SN",  color:"#00A19A" }],
};

/* ─── Static data bundles ────────────────────────────────────────────────── */
const STATIC_DATA: Record<string, { name: string; amount: number; validity: string }[]> = {
  GH: [{ name:"1GB / 7 days",    amount:10,  validity:"7 days"  },
       { name:"2.5GB / 30 days", amount:20,  validity:"30 days" },
       { name:"5GB / 30 days",   amount:35,  validity:"30 days" },
       { name:"10GB / 30 days",  amount:60,  validity:"30 days" }],
  KE: [{ name:"1GB / 7 days",   amount:200, validity:"7 days"  },
       { name:"2GB / 30 days",   amount:350, validity:"30 days" },
       { name:"5GB / 30 days",   amount:700, validity:"30 days" }],
  ZA: [{ name:"1GB / 30 days",  amount:40,  validity:"30 days" },
       { name:"2GB / 30 days",   amount:75,  validity:"30 days" },
       { name:"5GB / 30 days",   amount:149, validity:"30 days" }],
  GB: [{ name:"1GB / 30 days",  amount:5,   validity:"30 days" },
       { name:"5GB / 30 days",   amount:10,  validity:"30 days" },
       { name:"10GB / 30 days",  amount:15,  validity:"30 days" },
       { name:"Unlimited / 30d", amount:25,  validity:"30 days" }],
  US: [{ name:"1GB / 30 days",  amount:5,   validity:"30 days" },
       { name:"5GB / 30 days",   amount:10,  validity:"30 days" },
       { name:"Unlimited / 30d", amount:25,  validity:"30 days" }],
};

/* ─── MNO types (from /api/isw/nigeria/networks) ────────────────────────── */
interface DataBundle    { id:number; size:string; validity:string; amountNgn:number; amountKobo:number }
interface MNOBiller     { billerId:number; iswName:string; amountType:number; bundles?:DataBundle[] }
interface MNOEntry      { name:string; color:string; airtime:MNOBiller|null; data:MNOBiller|null }

/* size/validity are populated from DataBundle fields for Nigerian MNOs */
interface ISWPaymentItem{
  Id:number; Name:string; Code:string;
  Amount:number; IsAmountFixed:boolean;
  size?:string; validity?:string; amountNgn?:number;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const NET_COLORS: Record<string,string> = {
  MTN:"#FFCC00", AIRTEL:"#FF0000", GLO:"#018001", "9MOBILE":"#006600",
  VODACOM:"#E60000", VODAFONE:"#E60000", SAFARICOM:"#017A27", ORANGE:"#FF6600",
};
function brandColor(n: string): string {
  const u = n.toUpperCase();
  for (const [k,c] of Object.entries(NET_COLORS)) if (u.includes(k)) return c;
  return "#6366F1";
}
function detectCountry(phone: string): AirtimeCountry | undefined {
  const c = phone.replace(/\s/g,"");
  if (!c.startsWith("+")) return undefined;
  return COUNTRIES.find(x => c.startsWith(x.dialCode));
}
const PRESETS = [100, 200, 500, 1000, 2000, 5000];

/* ─── Nigerian MNO number prefix map ────────────────────────────────────── */
const NG_PREFIXES: Record<string, string[]> = {
  MTN:     ["0703","0706","0803","0806","0810","0813","0814","0816","0903","0906","0913","0916"],
  Airtel:  ["0701","0708","0802","0808","0812","0901","0902","0907","0911","0915"],
  Glo:     ["0705","0805","0807","0811","0815","0905","0915"],
  "9mobile":["0809","0817","0818","0908","0909"],
};

/**
 * Strips all non-digits, then normalises to 11-digit local form for Nigeria.
 * Returns the cleaned string for non-NG countries.
 */
function normalizePhone(raw: string, countryCode: string): string {
  const digits = raw.replace(/\D/g, "");
  if (countryCode === "NG") {
    if (digits.startsWith("234") && digits.length === 13) return "0" + digits.slice(3);
    if (digits.startsWith("0")   && digits.length === 11) return digits;
  }
  return digits;
}

/**
 * Returns an error string or null if valid.
 * For Nigeria: enforces 11-digit local format with valid mobile prefix.
 * For other countries: just ensures a reasonable digit count.
 */
function validatePhone(raw: string, countryCode: string, network?: string): string | null {
  const normalized = normalizePhone(raw, countryCode);
  if (!normalized) return "Enter a phone number";
  if (countryCode === "NG") {
    if (normalized.length !== 11)
      return "Nigerian numbers must be 11 digits — e.g. 08012345678";
    if (!normalized.startsWith("0"))
      return "Nigerian numbers must start with 0";
    const badStart = !["070","071","080","081","090","091"].some(p => normalized.startsWith(p));
    if (badStart) return "Not a valid Nigerian mobile number";
    if (network && NG_PREFIXES[network]) {
      const prefix4 = normalized.slice(0, 4);
      if (!NG_PREFIXES[network].includes(prefix4))
        return `${prefix4} is not a ${network} number — please check the network`;
    }
    return null;
  }
  if (normalized.length < 6)  return "Number is too short";
  if (normalized.length > 15) return "Number is too long";
  return null;
}

type Tab  = "airtime" | "data";
type Step = 0 | 1 | 2 | 3 | 4;
// 0=ServiceCountry 1=Network 2=Phone 3=Amount 4=Confirm
const STEP_LABELS = ["Service", "Network", "Phone", "Amount", "Confirm"];
interface RecentNum { phone:string; network:string; countryCode:string; date?:string }

/* ═══════════════════════════════════════════════════════════════════════════
   SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AirtimeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, balance, deductBalance, addTransaction, fxRatesPerUsd } = useRoam();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const homeCountry = useMemo(() => {
    const code = user?.country?.code ?? "NG";
    return COUNTRIES.find(c => c.code === code) ?? COUNTRIES[0];
  }, [user]);

  /* ── core state ── */
  const [tab,     setTab]     = useState<Tab>("airtime");
  const [step,    setStep]    = useState<Step>(0);
  const [country, setCountry] = useState<AirtimeCountry | null>(null);
  const [network, setNetwork] = useState("");
  const [phone,   setPhone]   = useState("");

  const [airtimeAmt, setAirtimeAmt] = useState<number | null>(null);
  const [customAmt,  setCustomAmt]  = useState("");

  /* ── country picker modal ── */
  const [cpOpen,  setCpOpen]  = useState(false);
  const [cpQuery, setCpQuery] = useState("");

  /* ── Nigerian MNO networks (from /api/isw/nigeria/networks) ── */
  const [mnoNetworks,    setMnoNetworks]    = useState<MNOEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selMNO,         setSelMNO]         = useState<MNOEntry | null>(null);

  /* ── ISW data bundles ── */
  const [bundles,        setBundles]        = useState<ISWPaymentItem[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [selBundle,      setSelBundle]      = useState<ISWPaymentItem | null>(null);

  /* ── payment ── */
  const [paying, setPaying] = useState(false);
  const [done,   setDone]   = useState(false);
  const [payErr, setPayErr] = useState("");
  const [txRef,  setTxRef]  = useState("");
  const [phoneErr, setPhoneErr] = useState("");

  /* ── recent numbers ── */
  const [recent, setRecent] = useState<RecentNum[]>([]);
  const phoneRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then(v => { if (v) setRecent(JSON.parse(v)); }).catch(() => {});
  }, []);

  const todayStr = () => new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  function saveRecent(r: RecentNum) {
    setRecent(prev => {
      const next = [{ ...r, date: todayStr() }, ...prev.filter(x => x.phone !== r.phone)].slice(0, MAX_RECENT);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  /* ── load Nigerian MNOs from /api/isw/nigeria/networks ── */
  useEffect(() => {
    if (country?.provider !== "interswitch") { setMnoNetworks([]); return; }
    setCatalogLoading(true);
    fetch(`${API}/isw/nigeria/networks`)
      .then(r => r.json())
      .then((d: { networks?: MNOEntry[] }) => {
        setMnoNetworks(d.networks ?? []);
      })
      .catch(() => setMnoNetworks([]))
      .finally(() => setCatalogLoading(false));
  }, [country]);

  /* ── load ISW data bundles ── */
  const loadBundles = useCallback(async (billerId: number) => {
    setBundlesLoading(true);
    setBundles([]);
    setSelBundle(null);
    try {
      const r = await fetch(`${API}/isw/billers/${billerId}/items`);
      const d = await r.json() as { items?: ISWPaymentItem[] };
      setBundles(d.items ?? []);
    } catch { setBundles([]); }
    finally { setBundlesLoading(false); }
  }, []);

  /* ── auto-detect country from phone ── */
  useEffect(() => {
    if (phone.startsWith("+")) {
      const det = detectCountry(phone);
      if (det && det.code !== country?.code) { setCountry(det); setNetwork(""); }
    }
  }, [phone]);

  /* ── derived: active biller ID depends on tab + selMNO ── */
  const selBillerId: number | null = useMemo(() => {
    if (!selMNO) return null;
    if (tab === "airtime") return selMNO.airtime?.billerId ?? null;
    if (tab === "data")    return selMNO.data?.billerId    ?? null;
    return null;
  }, [selMNO, tab]);

  /* ── Networks displayed in Step 1 (Nigeria → 4 MNOs, others → static) ── */
  const displayNetworks = useMemo((): { name:string; color:string; mno?:MNOEntry }[] => {
    if (!country) return [];
    if (country.provider === "interswitch")
      return mnoNetworks
        .filter(m => tab === "airtime" ? m.airtime !== null : m.data !== null)
        .map(m => ({ name:m.name, color:m.color, mno:m }));
    return (STATIC_NETWORKS[country.code] ?? []).map(n => ({ ...n }));
  }, [country, mnoNetworks, tab]);

  const staticBundles = country ? (STATIC_DATA[country.code] ?? []) : [];

  const localAmt: number = useMemo(() => {
    if (tab === "data") {
      if (selBundle?.IsAmountFixed && (selBundle.Amount ?? 0) > 0)
        return country?.provider === "interswitch" ? selBundle.Amount / 100 : selBundle.Amount;
      return parseFloat(customAmt) || 0;
    }
    return (airtimeAmt ?? parseFloat(customAmt)) || 0;
  }, [tab, selBundle, country, airtimeAmt, customAmt]);

  const ngnAmt: number = useMemo(() => {
    if (!country || country.code === "NG") return localAmt;
    return fxConvert(localAmt, country.currency, "NGN", fxRatesPerUsd);
  }, [localAmt, country, fxRatesPerUsd]);

  const isCrossBorder = !!(country && homeCountry && country.code !== homeCountry.code);

  /* ── country picker ── */
  function openCountryPicker() { setCpQuery(""); setCpOpen(true); }
  function pickCountry(c: AirtimeCountry) {
    setCountry(c);
    setNetwork("");
    setSelMNO(null);
    setBundles([]);
    setSelBundle(null);
    setCpOpen(false);
  }

  /* ── navigation ── */
  function prevStep() {
    if (step === 0) { router.back(); return; }
    setStep((step - 1) as Step);
  }
  function goNext() { setStep((step + 1) as Step); }

  /* ── Convert DataBundle → ISWPaymentItem (normalises the two bundle sources) ── */
  function dataBundleToItem(b: DataBundle): ISWPaymentItem {
    return {
      Id:          b.id,
      Name:        `${b.size} · ${b.validity}`,
      Code:        String(b.id),
      Amount:      b.amountKobo,
      IsAmountFixed: true,
      size:        b.size,
      validity:    b.validity,
      amountNgn:   b.amountNgn,
    };
  }

  /* ── pick network → go to phone ── */
  function pickNetwork(name: string, mno?: MNOEntry) {
    setNetwork(name);
    setSelMNO(mno ?? null);
    setSelBundle(null);
    if (tab === "data" && mno?.data?.bundles && mno.data.bundles.length > 0) {
      // Nigeria: bundles are embedded in the MNO entry — no ISW call needed
      setBundles(mno.data.bundles.map(dataBundleToItem));
    } else if (tab === "data" && mno?.data) {
      // International / other ISW billers: fetch from API
      loadBundles(mno.data.billerId);
    } else {
      setBundles([]);
    }
    goNext();
  }

  /* ── pay ── */
  async function pay() {
    if (!country) return;
    if (ngnAmt > balance) { setPayErr("Insufficient NGN wallet balance"); return; }
    setPayErr("");
    setPaying(true);
    try {
      if (country.provider === "interswitch" && selBillerId !== null) {
        const normPhone = normalizePhone(phone.trim(), country.code);
        const r = await fetch(`${API}/isw/bills/pay`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            customerId:normPhone, serviceId:selBillerId,
            paymentItemId:selBundle?.Id ?? 0,
            amount:Math.round(localAmt * 100), customerMobile:normPhone,
          }),
        });
        const d = await r.json() as {
          ResponseCode?:string; ResponseDescription?:string;
          requestReference?:string; _outcome?:string; _reason?:string;
        };
        const outcome = d._outcome ?? (
          (d.ResponseCode === "00" || d.ResponseCode === "90000") ? "approved" : "declined"
        );
        if (outcome === "approved") {
          setTxRef(d.requestReference ?? "");
          recordSuccess();
        } else if (outcome === "pending") {
          setTxRef(d.requestReference ?? "");
          setPayErr("Payment is still processing — we'll update your balance once confirmed.");
        } else {
          setPayErr(d._reason ?? d.ResponseDescription ?? "Payment declined — please try again.");
        }
      } else {
        await new Promise(res => setTimeout(res, 1800));
        recordSuccess();
      }
    } catch { setPayErr("Network error — please check your connection."); }
    finally { setPaying(false); }
  }

  function recordSuccess() {
    if (!country) return;
    deductBalance(ngnAmt);
    addTransaction({
      type:"airtime",
      title:`${tab === "data" ? "Data" : "Airtime"} — ${network}`,
      subtitle:`${phone}${selBundle ? " · "+selBundle.Name : ""}${isCrossBorder ? " (Int'l)" : ""}`,
      amount:-ngnAmt, currency:"NGN", symbol:"₦", status:"completed",
    });
    saveRecent({ phone:phone.trim(), network, countryCode:country.code });
    setDone(true);
  }

  /* ── done ── */
  if (done && country) {
    return (
      <View style={[s.container, { backgroundColor:colors.background, alignItems:"center", justifyContent:"center", paddingHorizontal:24 }]}>
        <View style={[s.resultIcon, { backgroundColor:colors.success+"1A" }]}>
          <CheckCircle size={60} color={colors.success} strokeWidth={1.5} />
        </View>
        <Text style={[s.resultTitle, { color:colors.foreground }]}>
          {tab === "data" ? "Data Activated!" : "Airtime Sent!"}
        </Text>
        <Text style={[s.resultSub, { color:colors.mutedForeground }]}>
          {country.flag} {country.name} · {network}{"\n"}{phone}{"\n"}
          {country.symbol}{localAmt.toLocaleString()}
          {isCrossBorder ? `  (₦${ngnAmt.toLocaleString()} debited)` : ""}
        </Text>
        {!!txRef && <Text style={[s.hint, { color:colors.mutedForeground, marginBottom:8 }]}>Ref: {txRef}</Text>}
        <Pressable onPress={() => router.back()} style={[s.bigBtn, { backgroundColor:colors.primary }]}>
          <Text style={s.bigBtnText}>Done</Text>
        </Pressable>
        <Pressable
          onPress={() => { setDone(false); setStep(0); setPhone(""); setNetwork(""); setAirtimeAmt(null); setCustomAmt(""); setSelBundle(null); setCountry(null); }}
          style={{ marginTop:12 }}
        >
          <Text style={{ color:colors.primary, fontSize:14, fontFamily:"Inter_500Medium" }}>Buy Again</Text>
        </Pressable>
      </View>
    );
  }

  if (paying) {
    return (
      <View style={[s.container, { backgroundColor:colors.background, alignItems:"center", justifyContent:"center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color:colors.mutedForeground, marginTop:16, fontSize:15, fontFamily:"Inter_400Regular" }}>
          {isCrossBorder ? "Converting & sending…" : "Processing…"}
        </Text>
      </View>
    );
  }

  /* ── filtered countries for picker ── */
  const filteredCountries = COUNTRIES.filter(c =>
    !cpQuery || c.name.toLowerCase().includes(cpQuery.toLowerCase()) || c.dialCode.includes(cpQuery)
  );

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════════ */
  return (
    <View style={[s.container, { backgroundColor:colors.background }]}>

      {/* ── Country picker modal ── */}
      <Modal visible={cpOpen} animationType="slide" transparent onRequestClose={() => setCpOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setCpOpen(false)}>
          <View style={s.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={[s.modalSheet, { backgroundColor:colors.background, paddingBottom: insets.bottom + 20 }]}>
          {/* Sheet header */}
          <View style={[s.sheetHeader, { borderBottomColor:colors.border }]}>
            <Text style={[s.sheetTitle, { color:colors.foreground }]}>Select Country</Text>
            <Pressable onPress={() => setCpOpen(false)} style={s.sheetClose}>
              <X size={20} color={colors.mutedForeground} strokeWidth={2} />
            </Pressable>
          </View>
          {/* Search */}
          <View style={[s.cpSearchBox, { backgroundColor:colors.card, borderColor:colors.border, margin:16, marginBottom:8 }]}>
            <Search size={16} color={colors.mutedForeground} strokeWidth={2} />
            <TextInput
              style={[s.cpSearchInput, { color:colors.foreground }]}
              placeholder="Search country or code…"
              placeholderTextColor={colors.mutedForeground}
              value={cpQuery}
              onChangeText={setCpQuery}
              autoFocus
            />
            {!!cpQuery && (
              <Pressable onPress={() => setCpQuery("")}>
                <X size={14} color={colors.mutedForeground} strokeWidth={2} />
              </Pressable>
            )}
          </View>
          {/* List */}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal:16, gap:8, paddingBottom:20 }}>
            {filteredCountries.map(c => (
              <Pressable
                key={c.code}
                onPress={() => pickCountry(c)}
                style={[
                  s.cpRow,
                  { backgroundColor: country?.code === c.code ? colors.primary+"18" : colors.card,
                    borderColor:     country?.code === c.code ? colors.primary       : colors.border }
                ]}
              >
                <Text style={s.cpFlag}>{c.flag}</Text>
                <View style={{ flex:1 }}>
                  <Text style={[s.cpName,     { color:colors.foreground }]}>{c.name}</Text>
                  <Text style={[s.cpDialCode, { color:colors.mutedForeground }]}>{c.dialCode}</Text>
                </View>
                {c.provider === "interswitch"
                  ? <View style={[s.badge, { backgroundColor:colors.success+"22" }]}>
                      <Zap  size={10} color={colors.success} strokeWidth={2} />
                      <Text style={[s.badgeText, { color:colors.success }]}>Live</Text>
                    </View>
                  : <View style={[s.badge, { backgroundColor:colors.primary+"22" }]}>
                      <Globe size={10} color={colors.primary} strokeWidth={2} />
                      <Text style={[s.badgeText, { color:colors.primary }]}>Int'l</Text>
                    </View>
                }
                {country?.code === c.code && (
                  <CheckCircle size={16} color={colors.primary} strokeWidth={2} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop:topPad }]}>
        <Pressable onPress={prevStep} style={s.headerBtn}>
          {step === 0
            ? <X size={22} color={colors.foreground} strokeWidth={1.8} />
            : <ChevronRight size={22} color={colors.foreground} strokeWidth={1.8} style={{ transform:[{ rotate:"180deg" }] }} />
          }
        </Pressable>
        <Text style={[s.headerTitle, { color:colors.foreground }]}>Airtime & Data</Text>
        <View style={{ width:36 }} />
      </View>

      {/* ── Progress dots ── */}
      <View style={s.progress}>
        {STEP_LABELS.map((_, i) => (
          <View key={i} style={[
            s.dot,
            { backgroundColor: i <= step ? colors.primary : colors.border,
              width: i === step ? 24 : 8,
              opacity: i > step ? 0.35 : 1 }
          ]} />
        ))}
      </View>

      {/* ══════════════════════════════════════════════════════════════════
          STEP 0 — SERVICE PICKER + COUNTRY SEARCH BOX
         ══════════════════════════════════════════════════════════════════ */}
      {step === 0 && (
        <ScrollView contentContainerStyle={{ padding:20, gap:24, paddingBottom:40 }}>

          {/* ── Airtime / Data toggle ── */}
          <View>
            <Text style={[s.sectionLabel, { color:colors.mutedForeground, marginBottom:12 }]}>
              What would you like to buy?
            </Text>
            <View style={[s.serviceRow, { backgroundColor:colors.card, borderColor:colors.border }]}>
              <Pressable
                onPress={() => { setTab("airtime"); setSelBundle(null); setCustomAmt(""); setAirtimeAmt(null); setNetwork(""); setSelMNO(null); setBundles([]); }}
                style={[s.serviceBtn, { backgroundColor: tab === "airtime" ? colors.primary : "transparent" }]}
              >
                <Signal size={22} color={tab === "airtime" ? "#fff" : colors.mutedForeground} strokeWidth={1.8} />
                <Text style={[s.serviceBtnText, { color: tab === "airtime" ? "#fff" : colors.mutedForeground }]}>
                  Airtime
                </Text>
                <Text style={[s.serviceBtnSub, { color: tab === "airtime" ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                  Top up credit
                </Text>
              </Pressable>

              <Pressable
                onPress={() => { setTab("data"); setSelBundle(null); setCustomAmt(""); setAirtimeAmt(null); setNetwork(""); setSelMNO(null); setBundles([]); }}
                style={[s.serviceBtn, { backgroundColor: tab === "data" ? colors.primary : "transparent" }]}
              >
                <Wifi size={22} color={tab === "data" ? "#fff" : colors.mutedForeground} strokeWidth={1.8} />
                <Text style={[s.serviceBtnText, { color: tab === "data" ? "#fff" : colors.mutedForeground }]}>
                  Data
                </Text>
                <Text style={[s.serviceBtnSub, { color: tab === "data" ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                  Internet bundle
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ── Country search box ── */}
          <View>
            <Text style={[s.sectionLabel, { color:colors.mutedForeground, marginBottom:12 }]}>
              Select country
            </Text>

            {/* The search trigger — tapping opens the modal */}
            <Pressable
              onPress={openCountryPicker}
              style={[s.countrySelector, { backgroundColor:colors.card, borderColor: country ? colors.primary : colors.border }]}
            >
              {country ? (
                <>
                  <Text style={s.cpFlag}>{country.flag}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={[s.cpName,     { color:colors.foreground }]}>{country.name}</Text>
                    <Text style={[s.cpDialCode, { color:colors.mutedForeground }]}>{country.dialCode}</Text>
                  </View>
                  {country.provider === "interswitch"
                    ? <View style={[s.badge, { backgroundColor:colors.success+"22" }]}>
                        <Zap  size={10} color={colors.success} strokeWidth={2} />
                        <Text style={[s.badgeText, { color:colors.success }]}>Live</Text>
                      </View>
                    : <View style={[s.badge, { backgroundColor:colors.primary+"22" }]}>
                        <Globe size={10} color={colors.primary} strokeWidth={2} />
                        <Text style={[s.badgeText, { color:colors.primary }]}>Int'l</Text>
                      </View>
                  }
                  <ChevronDown size={16} color={colors.mutedForeground} strokeWidth={2} />
                </>
              ) : (
                <>
                  <View style={[s.searchIconBox, { backgroundColor:colors.border }]}>
                    <Search size={18} color={colors.mutedForeground} strokeWidth={2} />
                  </View>
                  <Text style={[s.cpPlaceholder, { color:colors.mutedForeground }]}>
                    Search country…
                  </Text>
                  <ChevronDown size={16} color={colors.mutedForeground} strokeWidth={2} />
                </>
              )}
            </Pressable>
          </View>

          {/* ── Continue button ── */}
          <Pressable
            onPress={() => { if (country) goNext(); }}
            disabled={!country}
            style={[s.bigBtn, { backgroundColor: country ? colors.primary : colors.muted, marginTop:4 }]}
          >
            <Text style={[s.bigBtnText, { color: country ? "#fff" : colors.mutedForeground }]}>
              Continue
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 1 — NETWORK SELECTION
         ══════════════════════════════════════════════════════════════════ */}
      {step === 1 && country && (
        <ScrollView contentContainerStyle={{ padding:16, gap:14, paddingBottom:40 }}>
          {/* Country badge */}
          <Pressable
            onPress={() => setStep(0)}
            style={[s.chipRow, { backgroundColor:colors.card, borderColor:colors.border }]}
          >
            <Text style={{ fontSize:20 }}>{country.flag}</Text>
            <View style={{ flex:1 }}>
              <Text style={[s.cpName,     { color:colors.foreground }]}>{country.name}</Text>
              <Text style={[s.cpDialCode, { color:colors.mutedForeground }]}>{country.dialCode}</Text>
            </View>
            <Text style={[s.hint, { color:colors.primary }]}>Change</Text>
          </Pressable>

          <Text style={[s.sectionLabel, { color:colors.mutedForeground }]}>
            Select your network provider
          </Text>

          {catalogLoading ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[s.hint, { color:colors.mutedForeground, marginTop:8 }]}>Loading networks…</Text>
            </View>
          ) : displayNetworks.length === 0 ? (
            <View style={s.center}>
              <AlertCircle size={36} color={colors.mutedForeground} strokeWidth={1.5} />
              <Text style={[s.hint, { color:colors.mutedForeground, marginTop:8 }]}>No networks found.</Text>
            </View>
          ) : (
            displayNetworks.map(net => (
              <Pressable
                key={net.name}
                onPress={() => pickNetwork(net.name, net.mno)}
                style={[
                  s.networkRow,
                  { backgroundColor:colors.card,
                    borderColor: network === net.name ? net.color : colors.border,
                    borderWidth: network === net.name ? 2 : 1 }
                ]}
              >
                <View style={[s.avatar, { backgroundColor:net.color+"22" }]}>
                  <Text style={[s.avatarTxt, { color:net.color }]}>{net.name.slice(0,2).toUpperCase()}</Text>
                </View>
                <Text style={[s.networkName, { color:colors.foreground }]}>{net.name}</Text>
                {network === net.name
                  ? <CheckCircle size={18} color={net.color} strokeWidth={2} />
                  : <ChevronRight size={16} color={colors.mutedForeground} strokeWidth={1.8} />
                }
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 2 — PHONE NUMBER
         ══════════════════════════════════════════════════════════════════ */}
      {step === 2 && country && (
        <ScrollView contentContainerStyle={{ padding:16, gap:20, paddingBottom:40 }}>
          {/* Network + country badge */}
          <View style={[s.netChip, { backgroundColor:brandColor(network)+"18", borderColor:brandColor(network)+"40" }]}>
            <View style={[s.avatar, { backgroundColor:brandColor(network)+"22" }]}>
              <Text style={[s.avatarTxt, { color:brandColor(network) }]}>{network.slice(0,2).toUpperCase()}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={[s.networkName, { color:colors.foreground }]}>{network}</Text>
              <Text style={[s.hint,        { color:colors.mutedForeground }]}>{country.flag} {country.name}</Text>
            </View>
            <Pressable onPress={() => setStep(1)}>
              <Text style={[s.hint, { color:colors.primary }]}>Change</Text>
            </Pressable>
          </View>

          {/* Phone input */}
          {(() => {
            const isNG       = country.code === "NG";
            const maxLen     = isNG ? 11 : 15;
            const digitCount = phone.replace(/\D/g, "").length;
            const showCount  = isNG && digitCount > 0;
            const borderCol  = phoneErr
              ? colors.destructive
              : (isNG && digitCount === 11 && !phoneErr ? colors.success : colors.border);
            return (
              <View style={{ gap:8 }}>
                <View style={[s.labelRow]}>
                  <Text style={[s.label, { color:colors.mutedForeground }]}>Phone number</Text>
                  {showCount && (
                    <Text style={[s.hint, {
                      color: digitCount === 11 ? colors.success : colors.mutedForeground,
                      fontFamily:"Inter_600SemiBold",
                    }]}>
                      {digitCount}/{maxLen}
                    </Text>
                  )}
                </View>
                <View style={[s.phoneRow, { backgroundColor:colors.card, borderColor: borderCol }]}>
                  <Pressable onPress={() => setStep(0)} style={s.dialBtn}>
                    <Text style={[s.dialBtnTxt, { color:colors.foreground }]}>{country.dialCode}</Text>
                  </Pressable>
                  <View style={[s.divider, { backgroundColor:colors.border }]} />
                  <TextInput
                    ref={phoneRef}
                    style={[s.phoneInput, { color:colors.foreground }]}
                    placeholder={isNG ? "08012345678" : "Enter number"}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="phone-pad"
                    value={phone}
                    maxLength={maxLen}
                    onChangeText={t => {
                      const clean = isNG ? t.replace(/\D/g, "") : t;
                      setPhone(clean);
                      if (clean.length >= (isNG ? 6 : 4)) {
                        const err = validatePhone(clean, country.code, network);
                        setPhoneErr(err ?? "");
                      } else {
                        setPhoneErr("");
                      }
                    }}
                    autoFocus
                  />
                </View>
                {!!phoneErr
                  ? <Text style={[s.errTxt, { color:colors.destructive }]}>{phoneErr}</Text>
                  : <Text style={[s.hint, { color:colors.mutedForeground }]}>
                      {isNG
                        ? "11 digits, start with 0 — e.g. 08012345678"
                        : `Include country code if needed (e.g. ${country.dialCode}…)`}
                    </Text>
                }
              </View>
            );
          })()}

          {/* Recent numbers — today only */}
          {recent.filter(r => r.date === todayStr()).length > 0 && (
            <View style={{ gap:10 }}>
              <View style={s.row}>
                <Clock size={13} color={colors.mutedForeground} strokeWidth={2} />
                <Text style={[s.sectionLabel, { color:colors.mutedForeground }]}>Used today</Text>
              </View>
              <View style={s.recentGrid}>
                {recent.filter(r => r.date === todayStr()).map(r => {
                  const rc = COUNTRIES.find(c => c.code === r.countryCode);
                  return (
                    <Pressable
                      key={r.phone}
                      onPress={() => { setPhone(r.phone); setNetwork(r.network); if (rc) setCountry(rc); setStep(3); }}
                      style={[s.recentBtn, { backgroundColor:colors.card, borderColor:colors.border }]}
                    >
                      <Text style={{ fontSize:18 }}>{rc?.flag ?? "📱"}</Text>
                      <Text style={[s.recentPhone,   { color:colors.foreground }]} numberOfLines={1}>
                        {r.phone.length > 11 ? r.phone.slice(0,11)+"…" : r.phone}
                      </Text>
                      <Text style={[s.recentNetwork, { color:colors.mutedForeground }]} numberOfLines={1}>
                        {r.network}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <Pressable
            onPress={() => {
              const err = validatePhone(phone, country?.code ?? "", network);
              if (err) { setPhoneErr(err); return; }
              setPhoneErr("");
              goNext();
            }}
            style={[s.bigBtn, { backgroundColor:colors.primary }]}
          >
            <Text style={s.bigBtnText}>Continue</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 3 — AMOUNT / DATA BUNDLE
         ══════════════════════════════════════════════════════════════════ */}
      {step === 3 && country && (
        <ScrollView contentContainerStyle={{ padding:16, gap:20, paddingBottom:40 }}>
          {/* Network + phone summary */}
          <View style={[s.netChip, { backgroundColor:brandColor(network)+"18", borderColor:brandColor(network)+"40" }]}>
            <View style={[s.avatar, { backgroundColor:brandColor(network)+"22" }]}>
              <Text style={[s.avatarTxt, { color:brandColor(network) }]}>{network.slice(0,2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={[s.networkName, { color:colors.foreground }]}>{network}</Text>
              <Text style={[s.hint,        { color:colors.mutedForeground }]}>{country.flag} {country.name} · {phone}</Text>
            </View>
          </View>

          {/* Airtime/Data tab toggle */}
          <View style={[s.tabRow, { backgroundColor:colors.card, borderColor:colors.border }]}>
            {(["airtime","data"] as Tab[]).map(t => (
              <Pressable
                key={t}
                onPress={() => {
                  setTab(t);
                  setSelBundle(null);
                  setAirtimeAmt(null);
                  setCustomAmt("");
                  setBundles([]);
                  if (t === "data") {
                    if (selMNO?.data?.bundles?.length)
                      setBundles(selMNO.data.bundles.map(dataBundleToItem));
                    else if (selMNO?.data)
                      loadBundles(selMNO.data.billerId);
                  }
                }}
                style={[s.tabBtn, { backgroundColor: tab === t ? colors.primary : "transparent" }]}
              >
                {t === "airtime"
                  ? <Signal size={13} color={tab === t ? "#fff" : colors.mutedForeground} strokeWidth={2} />
                  : <Wifi   size={13} color={tab === t ? "#fff" : colors.mutedForeground} strokeWidth={2} />
                }
                <Text style={[s.tabTxt, { color: tab === t ? "#fff" : colors.mutedForeground }]}>
                  {t === "airtime" ? "Airtime" : "Data"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ── AIRTIME ── */}
          {tab === "airtime" && (
            <>
              <View style={{ gap:10 }}>
                <Text style={[s.label, { color:colors.mutedForeground }]}>Amount ({country.currency})</Text>
                <View style={s.presetGrid}>
                  {PRESETS.map(a => (
                    <Pressable
                      key={a}
                      onPress={() => { setAirtimeAmt(a); setCustomAmt(String(a)); }}
                      style={[s.presetBtn, {
                        backgroundColor: airtimeAmt === a ? colors.primary : colors.card,
                        borderColor:     airtimeAmt === a ? colors.primary : colors.border,
                      }]}
                    >
                      <Text style={[s.presetTxt, { color: airtimeAmt === a ? "#fff" : colors.foreground }]}>
                        {country.symbol}{a.toLocaleString()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ gap:6 }}>
                <Text style={[s.label, { color:colors.mutedForeground }]}>Custom amount</Text>
                <View style={[s.amtRow, { backgroundColor:colors.card, borderColor:colors.border }]}>
                  <Text style={[s.amtSym, { color:colors.mutedForeground }]}>{country.symbol}</Text>
                  <TextInput
                    style={[s.amtInput, { color:colors.foreground }]}
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    value={customAmt}
                    onChangeText={t => { setCustomAmt(t); setAirtimeAmt(null); }}
                  />
                </View>
              </View>
            </>
          )}

          {/* ── DATA — Nigeria ISW ── */}
          {tab === "data" && country.provider === "interswitch" && (
            bundlesLoading ? (
              <View style={s.center}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[s.hint, { color:colors.mutedForeground }]}>Loading bundles…</Text>
              </View>
            ) : bundles.length === 0 ? (
              <View style={{ gap:8 }}>
                <Text style={[s.hint, { color:colors.mutedForeground }]}>No fixed bundles — enter amount:</Text>
                <View style={[s.amtRow, { backgroundColor:colors.card, borderColor:colors.border }]}>
                  <Text style={[s.amtSym, { color:colors.mutedForeground }]}>₦</Text>
                  <TextInput
                    style={[s.amtInput, { color:colors.foreground }]}
                    placeholder="Amount"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    value={customAmt}
                    onChangeText={setCustomAmt}
                  />
                </View>
              </View>
            ) : (
              bundles.map(b => {
                const isSelected  = selBundle?.Id === b.Id;
                const displayAmt  = b.amountNgn ?? (b.Amount > 0 ? b.Amount / 100 : 0);
                const hasSize     = !!b.size;
                return (
                  <Pressable
                    key={b.Id}
                    onPress={() => setSelBundle(b)}
                    style={[s.bundleCard, {
                      backgroundColor: isSelected ? colors.primary+"18" : colors.card,
                      borderColor:     isSelected ? colors.primary       : colors.border,
                    }]}
                  >
                    {/* Left: size + validity (or plain name for non-NG bundles) */}
                    <View style={{ flex:1, gap:2 }}>
                      {hasSize ? (
                        <>
                          <Text style={[s.bundleSize, { color:colors.foreground }]}>{b.size}</Text>
                          <Text style={[s.bundleValidity, { color:colors.mutedForeground }]}>
                            {b.validity ?? ""}
                          </Text>
                        </>
                      ) : (
                        <Text style={[s.bundleName, { color:colors.foreground }]}>{b.Name}</Text>
                      )}
                    </View>
                    {/* Right: price + checkmark */}
                    <View style={{ alignItems:"flex-end", gap:4 }}>
                      {displayAmt > 0 && (
                        <Text style={[s.bundlePrice, { color:colors.primary }]}>
                          ₦{displayAmt.toLocaleString()}
                        </Text>
                      )}
                      {isSelected && <CheckCircle size={16} color={colors.primary} strokeWidth={2} />}
                    </View>
                  </Pressable>
                );
              })
            )
          )}

          {/* ── DATA — International static bundles ── */}
          {tab === "data" && country.provider !== "interswitch" && (
            staticBundles.length > 0 ? staticBundles.map(b => (
              <Pressable
                key={b.name}
                onPress={() => { setCustomAmt(String(b.amount)); setAirtimeAmt(null); setSelBundle(null); }}
                style={[s.bundleCard, {
                  backgroundColor: customAmt === String(b.amount) ? colors.primary+"18" : colors.card,
                  borderColor:     customAmt === String(b.amount) ? colors.primary       : colors.border,
                }]}
              >
                <View style={{ flex:1, gap:3 }}>
                  <Text style={[s.bundleName, { color:colors.foreground }]}>{b.name}</Text>
                  <View style={s.row}>
                    <Text style={[s.bundlePrice,    { color:colors.primary }]}>{country.symbol}{b.amount.toLocaleString()}</Text>
                    <Text style={[s.bundleValidity, { color:colors.mutedForeground }]}>{b.validity}</Text>
                  </View>
                </View>
                {customAmt === String(b.amount) && <CheckCircle size={18} color={colors.primary} strokeWidth={2} />}
              </Pressable>
            )) : (
              <View style={{ gap:8 }}>
                <Text style={[s.hint, { color:colors.mutedForeground }]}>Enter data amount ({country.currency}):</Text>
                <View style={[s.amtRow, { backgroundColor:colors.card, borderColor:colors.border }]}>
                  <Text style={[s.amtSym, { color:colors.mutedForeground }]}>{country.symbol}</Text>
                  <TextInput
                    style={[s.amtInput, { color:colors.foreground }]}
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    value={customAmt}
                    onChangeText={setCustomAmt}
                  />
                </View>
              </View>
            )
          )}

          {/* FX banner */}
          {isCrossBorder && localAmt > 0 && (
            <View style={[s.fxBanner, { backgroundColor:colors.primary+"12", borderColor:colors.primary+"30" }]}>
              <Globe size={14} color={colors.primary} strokeWidth={2} />
              <Text style={[s.fxTxt, { color:colors.primary }]}>
                {country.symbol}{localAmt.toLocaleString()} {country.currency} = ₦{ngnAmt.toLocaleString()} NGN will be debited
              </Text>
            </View>
          )}

          <Pressable
            onPress={() => { if (localAmt > 0) goNext(); }}
            disabled={localAmt <= 0}
            style={[s.bigBtn, { backgroundColor: localAmt > 0 ? colors.primary : colors.muted }]}
          >
            <Text style={[s.bigBtnText, { color: localAmt > 0 ? "#fff" : colors.mutedForeground }]}>
              Review Order
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 4 — CONFIRM & PAY
         ══════════════════════════════════════════════════════════════════ */}
      {step === 4 && country && (
        <ScrollView contentContainerStyle={{ padding:16, gap:16, paddingBottom:40 }}>
          <View style={[s.amtDisplay, { backgroundColor:colors.primary+"12", borderColor:colors.primary+"30" }]}>
            <Text style={[s.amtDisplayType, { color:colors.mutedForeground }]}>
              {tab === "data" ? "Data bundle" : "Airtime"} · {country.flag} {country.name}
            </Text>
            <Text style={[s.amtDisplayValue, { color:colors.primary }]}>
              {country.symbol}{localAmt.toLocaleString()}
            </Text>
            {isCrossBorder && (
              <Text style={[s.amtDisplaySub, { color:colors.mutedForeground }]}>
                Debits ₦{ngnAmt.toLocaleString()} from NGN wallet
              </Text>
            )}
          </View>

          <View style={[s.summaryCard, { backgroundColor:colors.card, borderColor:colors.border }]}>
            <SRow label="Network"       value={network}                                             colors={colors} />
            <SRow label="Number"        value={phone}                                               colors={colors} />
            <SRow label="Country"       value={`${country.flag} ${country.name}`}                  colors={colors} />
            {selBundle && (
              <SRow
                label="Bundle"
                value={selBundle.size ? `${selBundle.size}${selBundle.validity ? ` · ${selBundle.validity}` : ""}` : selBundle.Name}
                colors={colors}
              />
            )}
            <SRow label="Type"          value={tab === "airtime" ? "Airtime recharge" : "Data"}    colors={colors} />
            <SRow label="Provider"      value={country.provider === "interswitch" ? "Interswitch" : "International"} colors={colors} />
            <SRow label="You pay (NGN)" value={`₦${ngnAmt.toLocaleString()}`}                      colors={colors} last />
          </View>

          {ngnAmt > balance && (
            <View style={[s.alertRow, { backgroundColor:colors.destructive+"18", borderColor:colors.destructive+"40" }]}>
              <AlertCircle size={14} color={colors.destructive} />
              <Text style={[s.alertTxt, { color:colors.destructive }]}>
                Wallet balance ₦{balance.toLocaleString()} is insufficient
              </Text>
            </View>
          )}
          {!!payErr && <Text style={[s.errTxt, { color:colors.destructive, textAlign:"center" }]}>{payErr}</Text>}

          <Pressable
            onPress={pay}
            disabled={ngnAmt > balance || ngnAmt <= 0}
            style={[s.bigBtn, { backgroundColor: (ngnAmt > balance || ngnAmt <= 0) ? colors.muted : colors.primary }]}
          >
            <Text style={[s.bigBtnText, { color: (ngnAmt > balance || ngnAmt <= 0) ? colors.mutedForeground : "#fff" }]}>
              Pay ₦{ngnAmt.toLocaleString()}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

/* ─── Summary row ────────────────────────────────────────────────────────── */
function SRow({ label, value, colors, last = false }: {
  label:string; value:string; colors:ReturnType<typeof useColors>; last?:boolean;
}) {
  return (
    <View style={[s.sRow, !last && { borderBottomWidth:StyleSheet.hairlineWidth, borderColor:colors.border }]}>
      <Text style={[s.sLabel, { color:colors.mutedForeground }]}>{label}</Text>
      <Text style={[s.sValue, { color:colors.foreground }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  container:      { flex:1 },
  header:         { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingBottom:8 },
  headerBtn:      { width:36, height:36, borderRadius:18, alignItems:"center", justifyContent:"center" },
  headerTitle:    { fontSize:18, fontFamily:"Inter_600SemiBold" },

  progress:       { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, paddingBottom:12 },
  dot:            { height:8, borderRadius:4 },

  sectionLabel:   { fontSize:13, fontFamily:"Inter_500Medium" },
  label:          { fontSize:13, fontFamily:"Inter_500Medium" },
  labelRow:       { flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  hint:           { fontSize:12, fontFamily:"Inter_400Regular" },
  errTxt:         { fontSize:13, fontFamily:"Inter_400Regular" },
  row:            { flexDirection:"row", alignItems:"center", gap:8 },

  /* ── service toggle ── */
  serviceRow:     { flexDirection:"row", borderRadius:18, borderWidth:1, padding:6, gap:6 },
  serviceBtn:     { flex:1, borderRadius:14, alignItems:"center", paddingVertical:18, gap:6 },
  serviceBtnText: { fontSize:16, fontFamily:"Inter_700Bold" },
  serviceBtnSub:  { fontSize:11, fontFamily:"Inter_400Regular" },

  /* ── country selector ── */
  countrySelector:{ flexDirection:"row", alignItems:"center", borderRadius:16, borderWidth:1.5, padding:16, gap:12 },
  searchIconBox:  { width:36, height:36, borderRadius:18, alignItems:"center", justifyContent:"center" },
  cpPlaceholder:  { flex:1, fontSize:15, fontFamily:"Inter_400Regular" },
  cpFlag:         { fontSize:26 },
  cpName:         { fontSize:15, fontFamily:"Inter_600SemiBold" },
  cpDialCode:     { fontSize:12, fontFamily:"Inter_400Regular" },
  badge:          { flexDirection:"row", alignItems:"center", gap:4, borderRadius:8, paddingHorizontal:8, paddingVertical:4 },
  badgeText:      { fontSize:11, fontFamily:"Inter_600SemiBold" },

  /* ── modal sheet ── */
  modalOverlay:   { flex:1, backgroundColor:"rgba(0,0,0,0.5)" },
  modalSheet:     { maxHeight:"85%", borderTopLeftRadius:24, borderTopRightRadius:24, overflow:"hidden" },
  sheetHeader:    { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, paddingVertical:16, borderBottomWidth:StyleSheet.hairlineWidth },
  sheetTitle:     { fontSize:17, fontFamily:"Inter_600SemiBold" },
  sheetClose:     { width:32, height:32, borderRadius:16, alignItems:"center", justifyContent:"center" },
  cpSearchBox:    { flexDirection:"row", alignItems:"center", borderRadius:14, borderWidth:1, paddingHorizontal:14, height:46, gap:10 },
  cpSearchInput:  { flex:1, fontSize:15, fontFamily:"Inter_400Regular", padding:0 },
  cpRow:          { flexDirection:"row", alignItems:"center", borderRadius:14, borderWidth:1, padding:14, gap:12 },

  /* ── network ── */
  chipRow:        { flexDirection:"row", alignItems:"center", borderRadius:14, borderWidth:1, padding:14, gap:12 },
  netChip:        { flexDirection:"row", alignItems:"center", gap:12, borderRadius:16, borderWidth:1, padding:14 },
  networkRow:     { flexDirection:"row", alignItems:"center", borderRadius:14, padding:14, gap:12 },
  networkName:    { fontSize:15, fontFamily:"Inter_600SemiBold", flex:1 },
  avatar:         { width:44, height:44, borderRadius:22, alignItems:"center", justifyContent:"center" },
  avatarTxt:      { fontSize:14, fontFamily:"Inter_700Bold" },

  /* ── phone ── */
  phoneRow:       { flexDirection:"row", alignItems:"center", borderRadius:14, borderWidth:1, height:58, overflow:"hidden" },
  dialBtn:        { paddingHorizontal:14, alignSelf:"stretch", alignItems:"center", justifyContent:"center" },
  dialBtnTxt:     { fontSize:16, fontFamily:"Inter_600SemiBold" },
  divider:        { width:1, alignSelf:"stretch", marginVertical:10 },
  phoneInput:     { flex:1, fontSize:18, fontFamily:"Inter_500Medium", paddingHorizontal:14 },

  /* ── recent ── */
  recentGrid:     { flexDirection:"row", flexWrap:"wrap", gap:10 },
  recentBtn:      { borderRadius:14, borderWidth:1, padding:12, gap:4, width:"30%", alignItems:"center" },
  recentPhone:    { fontSize:12, fontFamily:"Inter_500Medium" },
  recentNetwork:  { fontSize:10, fontFamily:"Inter_400Regular" },

  /* ── tabs ── */
  tabRow:         { flexDirection:"row", borderRadius:14, borderWidth:1, padding:4 },
  tabBtn:         { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", paddingVertical:10, borderRadius:10, gap:6 },
  tabTxt:         { fontSize:14, fontFamily:"Inter_600SemiBold" },

  /* ── amount ── */
  presetGrid:     { flexDirection:"row", flexWrap:"wrap", gap:10 },
  presetBtn:      { paddingHorizontal:14, paddingVertical:13, borderRadius:13, borderWidth:1, minWidth:"30%" },
  presetTxt:      { fontSize:14, fontFamily:"Inter_600SemiBold", textAlign:"center" },
  amtRow:         { flexDirection:"row", alignItems:"center", borderRadius:14, borderWidth:1, height:56, paddingHorizontal:14, gap:8 },
  amtSym:         { fontSize:18, fontFamily:"Inter_600SemiBold" },
  amtInput:       { flex:1, fontSize:22, fontFamily:"Inter_600SemiBold", padding:0 },

  /* ── bundles ── */
  bundleCard:     { flexDirection:"row", alignItems:"center", borderRadius:14, borderWidth:1, padding:14, gap:12 },
  bundleName:     { fontSize:14, fontFamily:"Inter_600SemiBold" },
  bundleSize:     { fontSize:20, fontFamily:"Inter_700Bold" },
  bundleValidity: { fontSize:12, fontFamily:"Inter_400Regular" },
  bundlePrice:    { fontSize:15, fontFamily:"Inter_700Bold" },

  /* ── FX ── */
  fxBanner:       { flexDirection:"row", alignItems:"center", gap:8, borderRadius:12, borderWidth:1, padding:12 },
  fxTxt:          { fontSize:13, fontFamily:"Inter_500Medium", flex:1 },

  /* ── confirm ── */
  amtDisplay:     { borderRadius:20, borderWidth:1, padding:24, alignItems:"center", gap:6 },
  amtDisplayType: { fontSize:13, fontFamily:"Inter_500Medium" },
  amtDisplayValue:{ fontSize:40, fontFamily:"Inter_700Bold" },
  amtDisplaySub:  { fontSize:13, fontFamily:"Inter_400Regular" },
  summaryCard:    { borderRadius:16, borderWidth:1, overflow:"hidden" },
  sRow:           { flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, paddingVertical:13 },
  sLabel:         { fontSize:14, fontFamily:"Inter_400Regular" },
  sValue:         { fontSize:14, fontFamily:"Inter_600SemiBold", maxWidth:"55%", textAlign:"right" },
  alertRow:       { flexDirection:"row", alignItems:"center", gap:8, borderRadius:12, borderWidth:1, padding:12 },
  alertTxt:       { fontSize:13, fontFamily:"Inter_500Medium", flex:1 },

  /* ── buttons ── */
  bigBtn:         { borderRadius:16, paddingVertical:16, alignItems:"center" },
  bigBtnText:     { fontSize:16, fontFamily:"Inter_700Bold", color:"#fff" },

  /* ── misc ── */
  center:         { alignItems:"center", justifyContent:"center", paddingVertical:40, gap:8 },
  resultIcon:     { width:100, height:100, borderRadius:50, alignItems:"center", justifyContent:"center", marginBottom:16 },
  resultTitle:    { fontSize:24, fontFamily:"Inter_700Bold", marginBottom:8 },
  resultSub:      { fontSize:15, fontFamily:"Inter_400Regular", textAlign:"center", lineHeight:24, marginBottom:8 },
});
