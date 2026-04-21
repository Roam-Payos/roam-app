import { router } from "expo-router";
import { Copy, CreditCard, Grid2X2, Link, Link2, RefreshCw, Share2, X } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useColors } from "@/hooks/useColors";
import { useRoam } from "@/context/RoamContext";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const METHODS: { id: string; Icon: LucideIcon; label: string; desc: string }[] = [
  { id: "bank", Icon: CreditCard, label: "Bank Transfer", desc: "Share account details" },
  { id: "qr",   Icon: Grid2X2,   label: "Personal QR",   desc: "Scan to pay" },
  { id: "link", Icon: Link,       label: "Payment Link",  desc: "Request money" },
];

interface VirtualAccount {
  id: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
  currency: string;
  status: string;
}

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

export default function ReceiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useRoam();
  const [selected, setSelected] = useState("bank");
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  // ── Fetch or auto-provision virtual account ───────────────────────────────
  const loadVirtualAccount = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/roam/virtual-accounts/${user.id}`);
      const data = await res.json() as { accounts?: VirtualAccount[] };
      if (data.accounts && data.accounts.length > 0) {
        setVirtualAccount(data.accounts[0]!);
      } else {
        // No VAN yet — auto-provision for KYC tier 1+ users
        if (user.kycTier >= 1) {
          await provisionAccount();
        }
      }
    } catch {
      // Offline — show placeholder
    } finally {
      setLoading(false);
    }
  }, [user]);

  const provisionAccount = async () => {
    if (!user?.id) return;
    setProvisioning(true);
    try {
      const res = await fetch(`${API_BASE}/roam/virtual-accounts/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: String(user.id) }),
      });
      const data = await res.json() as { success?: boolean; account?: VirtualAccount };
      if (data.success && data.account) {
        setVirtualAccount(data.account);
      }
    } catch {
      // ignore
    } finally {
      setProvisioning(false);
    }
  };

  useEffect(() => {
    loadVirtualAccount();
  }, [loadVirtualAccount]);

  // ── Account details list ──────────────────────────────────────────────────
  const accountDetails = virtualAccount
    ? [
        { label: "Account Number", value: virtualAccount.account_number, highlight: true },
        { label: "Account Name",   value: virtualAccount.account_name },
        { label: "Bank",           value: virtualAccount.bank_name },
        { label: "Currency",       value: virtualAccount.currency },
      ]
    : [
        { label: "Account Number", value: user?.kycTier && user.kycTier >= 1 ? "Provisioning…" : "Complete KYC to unlock", highlight: false },
        { label: "Account Name",   value: user?.name ?? "—" },
        { label: "Bank",           value: "Providus Bank (via PayOs)" },
        { label: "Currency",       value: user?.country?.currency ?? "NGN" },
      ];

  async function copyDetail(label: string, value: string) {
    try {
      await Clipboard.setStringAsync(value);
      Alert.alert("Copied", `${label} copied to clipboard`);
    } catch {
      Alert.alert("Copied", `"${value}" copied to clipboard`);
    }
  }

  async function copyAll() {
    if (!virtualAccount) return;
    const text = `Account Number: ${virtualAccount.account_number}\nAccount Name: ${virtualAccount.account_name}\nBank: ${virtualAccount.bank_name}`;
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copied", "All account details copied");
    } catch {}
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color={colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Receive Money</Text>
        <Pressable onPress={loadVirtualAccount} style={styles.closeBtn}>
          <RefreshCw size={18} color={colors.mutedForeground} strokeWidth={1.8} />
        </Pressable>
      </View>

      {/* Method tabs */}
      <View style={styles.methods}>
        {METHODS.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setSelected(m.id)}
            style={[
              styles.methodBtn,
              {
                backgroundColor: selected === m.id ? colors.primary + "22" : colors.card,
                borderColor: selected === m.id ? colors.primary : colors.border,
              },
            ]}
          >
            <m.Icon
              size={18}
              color={selected === m.id ? colors.primary : colors.mutedForeground}
              strokeWidth={1.8}
            />
            <Text style={[styles.methodLabel, { color: selected === m.id ? colors.primary : colors.foreground }]}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Bank transfer tab ─────────────────────────────────────────────── */}
        {selected === "bank" && (
          <>
            {/* Account card */}
            <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Card header */}
              <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.cardHeaderTitle, { color: colors.foreground }]}>Your Roam Account</Text>
                  <Text style={[styles.cardHeaderSub, { color: colors.mutedForeground }]}>
                    Anyone can transfer to this account via NIBSS/interbank
                  </Text>
                </View>
                {loading || provisioning ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
              </View>

              {/* Account details rows */}
              {accountDetails.map((d, i) => (
                <View
                  key={d.label}
                  style={[
                    styles.detailRow,
                    i < accountDetails.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{d.label}</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        { color: colors.foreground },
                        "highlight" in d && d.highlight && { color: colors.primary, fontSize: 20, letterSpacing: 1 },
                      ]}
                    >
                      {d.value}
                    </Text>
                  </View>
                  {virtualAccount && (
                    <Pressable
                      onPress={() => copyDetail(d.label, d.value)}
                      style={({ pressed }) => [styles.copyBtn, { opacity: pressed ? 0.6 : 1 }]}
                    >
                      <Copy size={16} color={colors.primary} strokeWidth={1.8} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>

            {/* Copy all button */}
            {virtualAccount && (
              <Pressable
                style={({ pressed }) => [
                  styles.copyAllBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={copyAll}
              >
                <Copy size={16} color="#fff" strokeWidth={1.8} />
                <Text style={styles.copyAllText}>Copy All Details</Text>
              </Pressable>
            )}

            {/* How it works info */}
            <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.infoTitle, { color: colors.foreground }]}>How it works</Text>
              {[
                "Share your account number with the sender",
                "They transfer from any Nigerian bank app, USSD, or internet banking",
                "Your Roam wallet is credited instantly via NIBSS NIP",
                "You can also receive from abroad via SWIFT/SEPA",
              ].map((step, i) => (
                <View key={i} style={styles.infoRow}>
                  <View style={[styles.infoDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{step}</Text>
                </View>
              ))}
            </View>

            {/* KYC required message for tier 0 users */}
            {!virtualAccount && !loading && (!user?.kycTier || user.kycTier < 1) && (
              <View style={[styles.kycBanner, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
                <Text style={[styles.kycBannerText, { color: colors.primary }]}>
                  Complete KYC verification to get your personal bank account number
                </Text>
                <Pressable
                  onPress={() => router.push("/(onboarding)/kyc-upgrade")}
                  style={({ pressed }) => [styles.kycBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={styles.kycBtnText}>Verify Identity</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* ── QR code tab ───────────────────────────────────────────────────── */}
        {selected === "qr" && (
          <View style={styles.qrSection}>
            <View style={[styles.qrBox, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={styles.qrPlaceholder}>
                <Grid2X2 size={80} color="#0B1C3D" strokeWidth={1} />
                {virtualAccount && (
                  <Text style={styles.qrAccountLabel}>{virtualAccount.account_number}</Text>
                )}
              </View>
            </View>
            <Text style={[styles.qrHint, { color: colors.mutedForeground }]}>
              Others can scan this to pay you directly
            </Text>
            <Pressable
              style={({ pressed }) => [styles.shareBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => Alert.alert("Share", "QR sharing coming soon")}
            >
              <Share2 size={16} color="#fff" strokeWidth={1.8} />
              <Text style={styles.shareBtnText}>Share QR</Text>
            </Pressable>
          </View>
        )}

        {/* ── Payment link tab ──────────────────────────────────────────────── */}
        {selected === "link" && (
          <View style={styles.linkSection}>
            <View style={[styles.linkPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Link2 size={24} color={colors.primary} strokeWidth={1.8} />
              <Text style={[styles.linkText, { color: colors.foreground }]}>
                roam.payosng.com/pay/{user?.name?.toLowerCase().replace(/\s+/g, ".")}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.shareBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => Alert.alert("Share Link", "Payment link copied and ready to share")}
            >
              <Share2 size={16} color="#fff" strokeWidth={1.8} />
              <Text style={styles.shareBtnText}>Share Payment Link</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 20,
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  methods: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 20 },
  methodBtn: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center", gap: 6 },
  methodLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  scrollContent: { paddingBottom: 40 },
  // Account card
  detailsCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 14 },
  cardHeader: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cardHeaderTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  cardHeaderSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  detailLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 3 },
  detailValue: { fontSize: 15, fontFamily: "Inter_500Medium" },
  copyBtn: { padding: 6 },
  copyAllBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginHorizontal: 16, borderRadius: 14, paddingVertical: 14,
    marginBottom: 16,
  },
  copyAllText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  // Info box
  infoBox: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  infoTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  infoDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  // KYC banner
  kycBanner: { marginHorizontal: 16, marginTop: 16, borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  kycBannerText: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 20 },
  kycBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, alignSelf: "flex-start" },
  kycBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  // QR
  qrSection: { alignItems: "center", gap: 16, paddingTop: 8, paddingHorizontal: 16 },
  qrBox: { borderRadius: 20, borderWidth: 1, padding: 20 },
  qrPlaceholder: { width: 160, height: 160, alignItems: "center", justifyContent: "center", gap: 8 },
  qrAccountLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#0B1C3D", letterSpacing: 1 },
  qrHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  shareBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16,
  },
  shareBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  // Link
  linkSection: { paddingHorizontal: 16, gap: 16, alignItems: "stretch" },
  linkPreview: { borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  linkText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
