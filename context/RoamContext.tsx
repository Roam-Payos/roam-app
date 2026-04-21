import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export interface Country {
  name: string;
  code: string;
  currency: string;
  symbol: string;
  dialCode: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { name: "Nigeria", code: "NG", currency: "NGN", symbol: "₦", dialCode: "+234", flag: "🇳🇬" },
  { name: "Ghana", code: "GH", currency: "GHS", symbol: "₵", dialCode: "+233", flag: "🇬🇭" },
  { name: "Kenya", code: "KE", currency: "KES", symbol: "KSh", dialCode: "+254", flag: "🇰🇪" },
  { name: "South Africa", code: "ZA", currency: "ZAR", symbol: "R", dialCode: "+27", flag: "🇿🇦" },
];

// ── Live FX rates (units of currency per 1 USD) ──────────────────────────────
// Seeded with reasonable fallbacks; overwritten by live API on first fetch.
let _liveRatesPerUsd: Record<string, number> = {
  USD: 1,
  NGN: 1346,
  GHS: 11.09,
  KES: 129.2,
  ZAR: 16.37,
};
let _liveRatesUpdatedAt: string | null = null;
let _liveSpreadPct = 0.015; // 1.5 % default

/** Read current rates (units of currency per 1 USD). */
export function getFxRatesPerUsd(): Record<string, number> {
  return { ..._liveRatesPerUsd };
}

/** Called by RoamProvider after a successful API fetch to push live data. */
export function _setLiveRates(
  ratesPerUsd: Record<string, number>,
  updatedAt: string,
  spreadPct?: number,
): void {
  _liveRatesPerUsd   = { ...ratesPerUsd };
  _liveRatesUpdatedAt = updatedAt;
  if (spreadPct !== undefined) _liveSpreadPct = spreadPct;
}

/**
 * Convert `amount` of `from` currency into `to` currency using live rates.
 * No spread applied — use this for display/informational purposes.
 */
export function convertAmount(amount: number, from: string, to: string): number {
  const fromPerUsd = _liveRatesPerUsd[from] ?? 1; // units of "from" per USD
  const toPerUsd   = _liveRatesPerUsd[to]   ?? 1; // units of "to"   per USD
  // inUSD = amount / fromPerUsd   →  outAmount = inUSD * toPerUsd
  return (amount / fromPerUsd) * toPerUsd;
}

/**
 * Like convertAmount but applies the spread (i.e. what the customer actually receives).
 * Returns { outputAmount, midRate, appliedRate, spreadPct, feeAmount }.
 */
export function convertAmountWithSpread(
  amount: number,
  from: string,
  to: string,
  spreadPct = _liveSpreadPct,
): { outputAmount: number; midRate: number; appliedRate: number; spreadPct: number; feeAmount: number } {
  const fromPerUsd = _liveRatesPerUsd[from] ?? 1;
  const toPerUsd   = _liveRatesPerUsd[to]   ?? 1;
  const midRate    = toPerUsd / fromPerUsd; // 1 "from" = midRate "to"
  const appliedRate = midRate * (1 - spreadPct);
  const outputAmount = amount * appliedRate;
  const feeAmount    = amount * midRate * spreadPct;
  return { outputAmount, midRate, appliedRate, spreadPct, feeAmount };
}

// ── Keep FX_TO_USD for any legacy imports (rate_to_usd format) ───────────────
/** @deprecated Use convertAmount() instead. */
export const FX_TO_USD: Record<string, number> = new Proxy({} as Record<string, number>, {
  get(_target, currency: string) {
    const perUsd = _liveRatesPerUsd[currency];
    return perUsd ? 1 / perUsd : undefined;
  },
});

// ── Savings auto-trigger classification ──────────────────────────────────────
const SAVINGS_EXPENSE_TYPES = new Set(["send", "airtime", "bills", "card", "fx_merchant", "pay", "redeem", "coupon"]);
const SAVINGS_CREDIT_TYPES  = new Set(["receive", "fund", "deposit", "cashback", "refund"]);

// ─── CBN Tier limits (mirrors backend roam-limits.ts) ───────────────────────
export const CBN_LIMITS = {
  TIER1: { maxBalance: 300_000,    maxSingleDeposit: 50_000,    dailyStandard: 100_000,   dailyNewDevice: 20_000 },
  TIER2: { maxBalance: 2_000_000,  maxSingleDeposit: 500_000,   dailyStandard: 500_000,   dailyNewDevice: 100_000 },
  TIER3: { maxBalance: 10_000_000, maxSingleDeposit: 5_000_000, dailyStandard: 5_000_000, dailyNewDevice: 1_000_000 },
} as const;

export interface RoamUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  country: Country;
  kycTier: 1 | 2 | 3;
  kycBlocked: boolean;
  ninVerified: boolean;
  bvnVerified: boolean;
  biometricEnabled: boolean;
  pinHash: string;
  joinedAt: string;
}

export type TxType = "send" | "receive" | "pay" | "card" | "airtime" | "bills" | "fund" | "convert";

export interface Transaction {
  id: string;
  type: TxType;
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  symbol: string;
  date: string;
  status: "completed" | "pending" | "failed";
  wallet?: "home" | "usd"; // which wallet this belongs to
}

export interface CrossConvertPreview {
  fromCurrency:  string;
  toCurrency:    string;
  inputAmount:   number;
  outputAmount:  number;
  midRate:       number;
  appliedRate:   number;
  spreadPct:     number;
  feeAmount:     number;
  ratesUpdatedAt: string | null;
}

export interface CreditAlert {
  amount: number;
  currency: string;
  symbol: string;
  bankName: string;
  senderName: string;
  newBalance: number;
  timestamp: string;
}

interface RoamContextType {
  user: RoamUser | null;
  balance: number;
  usdBalance: number;
  transactions: Transaction[];
  usdTransactions: Transaction[];
  isAuthenticated: boolean;
  isLoading: boolean;
  hasExistingAccount: boolean;
  deviceId: string | null;
  isNewDevice: boolean;
  dailyLimit: number;
  maxSingleDeposit: number;
  maxBalance: number;
  // ── Credit alerts ────────────────────────────────────────────────────────
  creditAlert: CreditAlert | null;
  clearCreditAlert: () => void;
  syncBalance: () => Promise<void>;
  // ── FX ──────────────────────────────────────────────────────────────────
  fxRatesPerUsd: Record<string, number>;
  fxRatesUpdatedAt: string | null;
  refreshFxRates: () => Promise<void>;
  previewCrossConvert: (amount: number, from: string, to: string) => CrossConvertPreview;
  // ── Actions ─────────────────────────────────────────────────────────────
  register: (user: RoamUser, pin: string, startingBalance?: number) => Promise<void>;
  login: (phone: string, pin: string) => Promise<boolean>;
  loginByBiometric: () => Promise<boolean>;
  logout: () => Promise<void>;
  verifyPin: (pin: string) => boolean;
  getStoredPin: () => Promise<string | null>;
  addTransaction: (tx: Omit<Transaction, "id" | "date">) => void;
  addUsdTransaction: (tx: Omit<Transaction, "id" | "date">) => void;
  deductBalance: (amount: number) => boolean;
  addBalance: (amount: number) => void;
  addUsdBalance: (amount: number) => void;
  deductUsdBalance: (amount: number) => boolean;
  convertUsdToHome: (usdAmount: number) => { success: boolean; convertedAmount: number; appliedRate: number; feeAmount: number };
  upgradeKyc: () => void;
  upgradeKycTier: (targetTier: 2 | 3, payload: {
    validIdType: string; validIdNumber: string;
    addressType: string; addressConfirmed: boolean;
    hasPhoto?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  unblockKyc: () => void;
  enableBiometric: () => Promise<void>;
}

const RoamContext = createContext<RoamContextType | null>(null);

const STORAGE_KEYS = {
  USER: "roam_user",
  PIN: "roam_pin",
  BALANCE: "roam_balance",
  TRANSACTIONS: "roam_transactions",
  USD_BALANCE: "roam_usd_balance",
  USD_TRANSACTIONS: "roam_usd_transactions",
  HAS_ACCOUNT: "roam_has_account",
  SESSION: "roam_session",
  DEVICE_ID: "roam_device_id",
};

// ─── Device helpers ──────────────────────────────────────────────────────────

function genUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!id) {
    id = genUuid();
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
  }
  return id;
}

function getDeviceName(): string {
  if (Platform.OS === "web") {
    const ua = navigator.userAgent;
    const browser = ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Browser";
    const os = ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "macOS" : ua.includes("Linux") ? "Linux" : ua.includes("Android") ? "Android" : ua.includes("iPhone") ? "iPhone" : "Unknown OS";
    return `${browser} on ${os}`;
  }
  return `${Platform.OS} device`;
}

async function getGeolocation(): Promise<{ latitude?: number; longitude?: number; accuracy?: number } | null> {
  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.geolocation) {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 60000 },
      );
    });
  }
  return null;
}

async function doDeviceCheckin(userId: string, deviceId: string): Promise<{ isNewDevice: boolean }> {
  try {
    const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
    const geo = await getGeolocation();
    const res = await fetch(`${apiBase}/roam/device/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        deviceId,
        deviceName: getDeviceName(),
        platform: Platform.OS,
        geolocation: geo,
      }),
    });
    if (res.ok) {
      const data = await res.json() as { isNewDevice?: boolean };
      return { isNewDevice: data.isNewDevice ?? false };
    }
  } catch { /* non-fatal */ }
  return { isNewDevice: false };
}

const DEMO_USD_TRANSACTIONS: Transaction[] = [
  {
    id: "usd1",
    type: "receive",
    title: "Received from James O.",
    subtitle: "United Kingdom · International Transfer",
    amount: 200,
    currency: "USD",
    symbol: "$",
    date: new Date(Date.now() - 86400000 * 3).toISOString(),
    status: "completed",
    wallet: "usd",
  },
  {
    id: "usd2",
    type: "receive",
    title: "Freelance Payment",
    subtitle: "USA · SWIFT Transfer",
    amount: 450,
    currency: "USD",
    symbol: "$",
    date: new Date(Date.now() - 86400000).toISOString(),
    status: "completed",
    wallet: "usd",
  },
  {
    id: "usd3",
    type: "convert",
    title: "Converted to NGN",
    subtitle: "NGN wallet · Rate: ₦1,580/USD",
    amount: -150,
    currency: "USD",
    symbol: "$",
    date: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: "completed",
    wallet: "usd",
  },
];

const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: "tx1",
    type: "fund",
    title: "Wallet Funded",
    subtitle: "Bank Transfer",
    amount: 150000,
    currency: "NGN",
    symbol: "₦",
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: "completed",
  },
  {
    id: "tx2",
    type: "send",
    title: "Sent to Amara K.",
    subtitle: "Kenya · KSh 12,500",
    amount: -19230,
    currency: "NGN",
    symbol: "₦",
    date: new Date(Date.now() - 86400000).toISOString(),
    status: "completed",
  },
  {
    id: "tx3",
    type: "airtime",
    title: "Airtime — MTN",
    subtitle: "+234 812 345 6789",
    amount: -500,
    currency: "NGN",
    symbol: "₦",
    date: new Date(Date.now() - 3600000 * 5).toISOString(),
    status: "completed",
  },
  {
    id: "tx4",
    type: "bills",
    title: "AEDC Electricity",
    subtitle: "Prepaid · Meter 12345",
    amount: -5000,
    currency: "NGN",
    symbol: "₦",
    date: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: "completed",
  },
  {
    id: "tx5",
    type: "receive",
    title: "Received from Kofi A.",
    subtitle: "Ghana · ₵850",
    amount: 82000,
    currency: "NGN",
    symbol: "₦",
    date: new Date(Date.now() - 3600000).toISOString(),
    status: "completed",
  },
];

export function RoamProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<RoamUser | null>(null);
  const [balance, setBalance] = useState(0);
  const [usdBalance, setUsdBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [usdTransactions, setUsdTransactions] = useState<Transaction[]>([]);
  const [pin, setPin] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasExistingAccount, setHasExistingAccount] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isNewDevice, setIsNewDevice] = useState(false);
  const [creditAlert, setCreditAlert] = useState<CreditAlert | null>(null);
  const lastSyncedBalance = useRef<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userRef = useRef<RoamUser | null>(null);

  // Keep userRef in sync with state so the polling interval always sees latest
  useEffect(() => { userRef.current = user; }, [user]);

  // ── Real balance sync from ledger ─────────────────────────────────────────
  const syncBalance = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser?.id) return;

    try {
      const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
      const currency = currentUser.country?.currency ?? "NGN";

      // Fetch balance and transactions in parallel
      const [balRes, txRes] = await Promise.all([
        fetch(`${apiBase}/roam/users/${currentUser.id}/wallet-balance?currency=${currency}`),
        fetch(`${apiBase}/roam/users/${currentUser.id}/transactions?limit=60`),
      ]);

      if (!balRes.ok) return;
      const data = await balRes.json() as {
        available: number;
        latestTx: { id: string; type: string; title: string; amount: string; created_at: string } | null;
      };

      const newBal = Math.max(0, data.available);

      // Detect credit (balance went up) — fire alert if increase ≥ 1
      if (
        lastSyncedBalance.current !== null &&
        newBal > lastSyncedBalance.current + 0.99 &&
        data.latestTx?.type === "deposit"
      ) {
        const diff = newBal - lastSyncedBalance.current;
        const sym = currency === "NGN" ? "₦" : currency === "GHS" ? "₵" : currency === "KES" ? "KSh" : "R";
        setCreditAlert({
          amount: diff,
          currency,
          symbol: sym,
          bankName: "GTBank",
          senderName: "Bank Transfer",
          newBalance: newBal,
          timestamp: new Date().toISOString(),
        });
      }

      lastSyncedBalance.current = newBal;
      setBalance(newBal);
      await AsyncStorage.setItem(STORAGE_KEYS.BALANCE, String(newBal));

      // Merge backend transactions into local state
      if (txRes.ok) {
        const txData = await txRes.json() as { transactions: Transaction[] };
        const backendTxs: Transaction[] = txData.transactions ?? [];
        if (backendTxs.length > 0) {
          setTransactions(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const newOnes = backendTxs.filter(t => !existingIds.has(t.id));
            if (newOnes.length === 0) return prev;
            const merged = [...newOnes, ...prev];
            merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const trimmed = merged.slice(0, 150);
            AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(trimmed));
            return trimmed;
          });
        }
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const clearCreditAlert = useCallback(() => setCreditAlert(null), []);

  // ── Start balance polling when authenticated ──────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }
    // Immediate sync on login
    syncBalance();
    // Poll every 8 seconds
    pollIntervalRef.current = setInterval(() => syncBalance(), 8000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [user?.id]);

  // ── Live FX rates ──────────────────────────────────────────────────────────
  const [fxRatesPerUsd, setFxRatesPerUsd]     = useState<Record<string, number>>(_liveRatesPerUsd);
  const [fxRatesUpdatedAt, setFxRatesUpdatedAt] = useState<string | null>(_liveRatesUpdatedAt);

  const refreshFxRates = useCallback(async () => {
    try {
      const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
      const res = await fetch(`${apiBase}/roam/fx/rates`);
      if (!res.ok) return;
      const data = await res.json() as {
        rates: Record<string, number>;
        meta: Record<string, { spreadPct: number; updatedAt: string }>;
      };
      if (!data.rates) return;

      // data.rates = units per USD (e.g. NGN: 1346)
      _setLiveRates(
        data.rates,
        Object.values(data.meta ?? {})[0]?.updatedAt ?? new Date().toISOString(),
        Object.values(data.meta ?? {})[0]?.spreadPct,
      );
      setFxRatesPerUsd({ ...data.rates });
      setFxRatesUpdatedAt(Object.values(data.meta ?? {})[0]?.updatedAt ?? null);
    } catch {
      // Non-fatal — keep using last known rates
    }
  }, []);

  const previewCrossConvert = useCallback((amount: number, from: string, to: string): CrossConvertPreview => {
    const result = convertAmountWithSpread(amount, from, to);
    return {
      fromCurrency:   from,
      toCurrency:     to,
      inputAmount:    amount,
      outputAmount:   result.outputAmount,
      midRate:        result.midRate,
      appliedRate:    result.appliedRate,
      spreadPct:      result.spreadPct,
      feeAmount:      result.feeAmount,
      ratesUpdatedAt: _liveRatesUpdatedAt,
    };
  }, [fxRatesPerUsd]);

  useEffect(() => {
    loadSession();
    getOrCreateDeviceId().then(setDeviceId).catch(() => {});
    refreshFxRates(); // Fetch live rates on app launch
  }, []);

  async function loadSession() {
    try {
      const [
        storedUser, storedPin, storedBalance, storedTx,
        storedUsdBalance, storedUsdTx,
        storedHasAccount, storedSession,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.PIN),
        AsyncStorage.getItem(STORAGE_KEYS.BALANCE),
        AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
        AsyncStorage.getItem(STORAGE_KEYS.USD_BALANCE),
        AsyncStorage.getItem(STORAGE_KEYS.USD_TRANSACTIONS),
        AsyncStorage.getItem(STORAGE_KEYS.HAS_ACCOUNT),
        AsyncStorage.getItem(STORAGE_KEYS.SESSION),
      ]);
      if (storedHasAccount === "1") setHasExistingAccount(true);
      const isActiveSession = storedSession === "1";
      const isLegacySession = !storedSession && storedUser && storedPin;
      if (isLegacySession) {
        await AsyncStorage.setItem(STORAGE_KEYS.SESSION, "1");
      }
      if ((isActiveSession || isLegacySession) && storedUser && storedPin) {
        setUser(JSON.parse(storedUser));
        setPin(storedPin);
        setBalance(storedBalance ? Number(storedBalance) : 0);
        setTransactions(storedTx ? JSON.parse(storedTx) : []);
        setUsdBalance(storedUsdBalance ? Number(storedUsdBalance) : 0);
        setUsdTransactions(storedUsdTx ? JSON.parse(storedUsdTx) : []);
      }
    } catch (_) {}
    setIsLoading(false);
  }

  const register = useCallback(async (newUser: RoamUser, newPin: string, startingBalance = 0) => {
    setUser(newUser);
    setPin(newPin);
    setBalance(startingBalance);
    setTransactions([]);
    setUsdBalance(0);
    setUsdTransactions([]);
    setHasExistingAccount(true);
    const did = await getOrCreateDeviceId();
    setDeviceId(did);
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser)),
      AsyncStorage.setItem(STORAGE_KEYS.PIN, newPin),
      AsyncStorage.setItem(STORAGE_KEYS.BALANCE, String(startingBalance)),
      AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([])),
      AsyncStorage.setItem(STORAGE_KEYS.USD_BALANCE, "0"),
      AsyncStorage.setItem(STORAGE_KEYS.USD_TRANSACTIONS, JSON.stringify([])),
      AsyncStorage.setItem(STORAGE_KEYS.HAS_ACCOUNT, "1"),
      AsyncStorage.setItem(STORAGE_KEYS.SESSION, "1"),
    ]);
    doDeviceCheckin(newUser.id, did).then(({ isNewDevice: nd }) => setIsNewDevice(nd)).catch(() => {});
  }, []);

  const login = useCallback(async (phone: string, enteredPin: string): Promise<boolean> => {
    // ── Fast path: credentials still in local storage ──────────────────────────
    const [storedUser, storedPin] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.USER),
      AsyncStorage.getItem(STORAGE_KEYS.PIN),
    ]);
    if (storedUser && storedPin) {
      const parsedUser: RoamUser = JSON.parse(storedUser);
      if (parsedUser.phone === phone && storedPin === enteredPin) {
        await AsyncStorage.setItem(STORAGE_KEYS.SESSION, "1");
        await loadSession();
        const did = await getOrCreateDeviceId();
        setDeviceId(did);
        doDeviceCheckin(parsedUser.id, did).then(({ isNewDevice: nd }) => setIsNewDevice(nd)).catch(() => {});
        return true;
      }
      return false;
    }

    // ── Fallback: verify against the server (local storage was wiped) ──────────
    try {
      const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
      const res = await fetch(`${apiBase}/roam/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin: enteredPin }),
      });
      if (!res.ok) return false;

      const data = await res.json() as {
        success: boolean;
        user: {
          id: string; phone: string; email: string; name: string;
          countryCode: string; kycTier: number; kycBlocked: boolean;
          ninVerified: boolean; bvnVerified: boolean; joinedAt: string;
        };
      };
      if (!data.success) return false;

      const country = COUNTRIES.find((c) => c.code === data.user.countryCode) ?? COUNTRIES[0];
      const restoredUser: RoamUser = {
        id: String(data.user.id),
        name: data.user.name,
        phone: data.user.phone,
        email: data.user.email,
        country,
        kycTier: data.user.kycTier as 1 | 2 | 3,
        kycBlocked: data.user.kycBlocked,
        ninVerified: data.user.ninVerified,
        bvnVerified: data.user.bvnVerified ?? false,
        biometricEnabled: false,
        pinHash: enteredPin,
        joinedAt: data.user.joinedAt,
      };

      // Reconstruct local session from server data
      const did = await getOrCreateDeviceId();
      setDeviceId(did);
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(restoredUser)),
        AsyncStorage.setItem(STORAGE_KEYS.PIN, enteredPin),
        AsyncStorage.setItem(STORAGE_KEYS.BALANCE, "120000"),
        AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(DEMO_TRANSACTIONS)),
        AsyncStorage.setItem(STORAGE_KEYS.HAS_ACCOUNT, "1"),
        AsyncStorage.setItem(STORAGE_KEYS.SESSION, "1"),
      ]);
      await loadSession();
      doDeviceCheckin(restoredUser.id, did).then(({ isNewDevice: nd }) => setIsNewDevice(nd)).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }, []);

  const loginByBiometric = useCallback(async (): Promise<boolean> => {
    const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    const storedPin = await AsyncStorage.getItem(STORAGE_KEYS.PIN);
    if (!storedUser || !storedPin) return false;
    const parsedUser: RoamUser = JSON.parse(storedUser);
    if (!parsedUser.biometricEnabled) return false;
    await AsyncStorage.setItem(STORAGE_KEYS.SESSION, "1");
    await loadSession();
    return true;
  }, []);

  const getStoredPin = useCallback(async (): Promise<string | null> => {
    return AsyncStorage.getItem(STORAGE_KEYS.PIN);
  }, []);

  const enableBiometric = useCallback(async () => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, biometricEnabled: true };
      AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const unblockKyc = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, kycBlocked: false };
      AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setPin("");
    setBalance(0);
    setUsdBalance(0);
    setTransactions([]);
    setUsdTransactions([]);
    await AsyncStorage.removeItem(STORAGE_KEYS.SESSION);
  }, []);

  const verifyPin = useCallback((entered: string): boolean => {
    return entered === pin;
  }, [pin]);

  const addTransaction = useCallback((tx: Omit<Transaction, "id" | "date">) => {
    const newTx: Transaction = {
      ...tx,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      date: new Date().toISOString(),
    };
    setTransactions((prev) => {
      const updated = [newTx, ...prev];
      AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
      return updated;
    });

    // Fire-and-forget savings/investment trigger
    const uid = userRef.current?.id;
    const absAmount = Math.abs(tx.amount);
    if (uid && absAmount > 0) {
      const triggerType: "expense" | "credit" | null =
        SAVINGS_EXPENSE_TYPES.has(tx.type) ? "expense" :
        SAVINGS_CREDIT_TYPES.has(tx.type)  ? "credit"  : null;
      if (triggerType) {
        const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
        fetch(`${apiBase}/roam/users/${uid}/savings/trigger`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: absAmount,
            currency: tx.currency ?? "NGN",
            type: triggerType,
            note: tx.title,
          }),
        }).catch(() => {});
      }
    }
  }, []);

  const deductBalance = useCallback((amount: number): boolean => {
    let success = false;
    setBalance((prev) => {
      if (prev >= amount) {
        const next = prev - amount;
        AsyncStorage.setItem(STORAGE_KEYS.BALANCE, String(next));
        success = true;
        return next;
      }
      return prev;
    });
    return success;
  }, []);

  const addBalance = useCallback((amount: number) => {
    setBalance((prev) => {
      const next = prev + amount;
      AsyncStorage.setItem(STORAGE_KEYS.BALANCE, String(next));
      return next;
    });
  }, []);

  const addUsdBalance = useCallback((amount: number) => {
    setUsdBalance((prev) => {
      const next = prev + amount;
      AsyncStorage.setItem(STORAGE_KEYS.USD_BALANCE, String(next));
      return next;
    });
  }, []);

  const deductUsdBalance = useCallback((amount: number): boolean => {
    let success = false;
    setUsdBalance((prev) => {
      if (prev >= amount) {
        const next = prev - amount;
        AsyncStorage.setItem(STORAGE_KEYS.USD_BALANCE, String(next));
        success = true;
        return next;
      }
      return prev;
    });
    return success;
  }, []);

  const addUsdTransaction = useCallback((tx: Omit<Transaction, "id" | "date">) => {
    const newTx: Transaction = {
      ...tx,
      id: "usd_" + Date.now().toString() + Math.random().toString(36).substr(2, 6),
      date: new Date().toISOString(),
      wallet: "usd",
    };
    setUsdTransactions((prev) => {
      const updated = [newTx, ...prev];
      AsyncStorage.setItem(STORAGE_KEYS.USD_TRANSACTIONS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Converts USD from USD wallet → home currency using live spread-aware rate
  const convertUsdToHome = useCallback((usdAmount: number): { success: boolean; convertedAmount: number; appliedRate: number; feeAmount: number } => {
    const homeCurrency = user?.country.currency ?? "NGN";
    const { outputAmount, appliedRate, feeAmount } = convertAmountWithSpread(usdAmount, "USD", homeCurrency);
    const homeAmount = Math.floor(outputAmount);

    let success = false;
    setUsdBalance((prev) => {
      if (prev >= usdAmount) {
        const next = parseFloat((prev - usdAmount).toFixed(2));
        AsyncStorage.setItem(STORAGE_KEYS.USD_BALANCE, String(next));
        success = true;
        return next;
      }
      return prev;
    });

    if (success) {
      setBalance((prev) => {
        const next = prev + homeAmount;
        AsyncStorage.setItem(STORAGE_KEYS.BALANCE, String(next));
        return next;
      });

      const rateLabel = `${user?.country.symbol ?? "₦"}${appliedRate.toLocaleString("en-NG", { maximumFractionDigits: 2 })}/USD (incl. 1.5% spread)`;

      const usdTx: Transaction = {
        id: "conv_usd_" + Date.now(),
        type: "convert",
        title: `Converted to ${homeCurrency}`,
        subtitle: rateLabel,
        amount: -usdAmount,
        currency: "USD",
        symbol: "$",
        date: new Date().toISOString(),
        status: "completed",
        wallet: "usd",
      };
      const homeTx: Transaction = {
        id: "conv_home_" + Date.now(),
        type: "fund",
        title: "Converted from USD",
        subtitle: `$${usdAmount.toFixed(2)} USD · ${rateLabel}`,
        amount: homeAmount,
        currency: homeCurrency,
        symbol: user?.country.symbol ?? "₦",
        date: new Date().toISOString(),
        status: "completed",
        wallet: "home",
      };
      setUsdTransactions((prev) => {
        const updated = [usdTx, ...prev];
        AsyncStorage.setItem(STORAGE_KEYS.USD_TRANSACTIONS, JSON.stringify(updated));
        return updated;
      });
      setTransactions((prev) => {
        const updated = [homeTx, ...prev];
        AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
        return updated;
      });
    }

    return { success, convertedAmount: homeAmount, appliedRate, feeAmount };
  }, [user, fxRatesPerUsd]);

  const upgradeKyc = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, kycTier: 2 as const };
      AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
    const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    const parsedUser: RoamUser | null = storedUser ? JSON.parse(storedUser) : null;
    if (!parsedUser?.id) return;
    try {
      const res = await fetch(`${apiBase}/roam/user/${parsedUser.id}`);
      if (!res.ok) return;
      const data = await res.json() as { success?: boolean; user?: { kycTier: number; kycBlocked: boolean; ninVerified: boolean; bvnVerified: boolean } };
      if (!data.success || !data.user) return;
      setUser((prev) => {
        if (!prev) return prev;
        const updated: RoamUser = {
          ...prev,
          kycTier: (data.user!.kycTier as 1 | 2 | 3) ?? prev.kycTier,
          kycBlocked: data.user!.kycBlocked ?? prev.kycBlocked,
          ninVerified: data.user!.ninVerified ?? prev.ninVerified,
          bvnVerified: data.user!.bvnVerified ?? prev.bvnVerified,
        };
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
        return updated;
      });
    } catch {
      // Silently ignore — stale local state is better than a crash
    }
  }, []);

  const upgradeKycTier = useCallback(async (
    targetTier: 2 | 3,
    payload: { validIdType: string; validIdNumber: string; addressType: string; addressConfirmed: boolean; hasPhoto?: boolean },
  ): Promise<{ success: boolean; error?: string }> => {
    const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
    const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    const parsedUser: RoamUser | null = storedUser ? JSON.parse(storedUser) : null;
    if (!parsedUser) return { success: false, error: "Not logged in." };
    try {
      const res = await fetch(`${apiBase}/roam/kyc/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: parsedUser.id, targetTier, ...payload }),
      });
      const data = await res.json() as { success?: boolean; newTier?: number; error?: string };

      // 409 means the account is already at or above the target tier — treat as success
      // and sync local state to match the DB truth.
      if (res.status === 409) {
        const match = data.error?.match(/Tier\s+(\d)/i);
        const actualTier = match ? (parseInt(match[1]!, 10) as 1 | 2 | 3) : targetTier;
        setUser((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, kycTier: actualTier };
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
          return updated;
        });
        return { success: true };
      }

      if (!res.ok || !data.success) return { success: false, error: data.error ?? "Upgrade failed." };
      setUser((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, kycTier: (data.newTier ?? targetTier) as 1 | 2 | 3 };
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
        return updated;
      });
      return { success: true };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  }, []);

  const tierVal = user?.kycTier ?? 1;
  const tier: 1 | 2 | 3 = tierVal >= 3 ? 3 : tierVal >= 2 ? 2 : 1;
  const tierLimits = tier === 3 ? CBN_LIMITS.TIER3 : tier === 2 ? CBN_LIMITS.TIER2 : CBN_LIMITS.TIER1;
  const dailyLimit = isNewDevice ? tierLimits.dailyNewDevice : tierLimits.dailyStandard;

  return (
    <RoamContext.Provider
      value={{
        user,
        balance,
        usdBalance,
        transactions,
        usdTransactions,
        isAuthenticated: !!user,
        isLoading,
        hasExistingAccount,
        deviceId,
        isNewDevice,
        dailyLimit,
        maxSingleDeposit: tierLimits.maxSingleDeposit,
        maxBalance: tierLimits.maxBalance,
        creditAlert,
        clearCreditAlert,
        syncBalance,
        fxRatesPerUsd,
        fxRatesUpdatedAt,
        refreshFxRates,
        previewCrossConvert,
        register,
        login,
        loginByBiometric,
        logout,
        verifyPin,
        getStoredPin,
        addTransaction,
        addUsdTransaction,
        deductBalance,
        addBalance,
        addUsdBalance,
        deductUsdBalance,
        convertUsdToHome,
        upgradeKyc,
        upgradeKycTier,
        refreshUser,
        unblockKyc,
        enableBiometric,
      }}
    >
      {children}
    </RoamContext.Provider>
  );
}

export function useRoam() {
  const ctx = useContext(RoamContext);
  if (!ctx) throw new Error("useRoam must be used within RoamProvider");
  return ctx;
}
