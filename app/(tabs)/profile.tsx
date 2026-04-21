import { router } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  CreditCard,
  DollarSign,
  Fingerprint,
  HelpCircle,
  Info,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Shield,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useRoam } from "@/context/RoamContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface KycRecord {
  docType: string;
  maskedDocNumber: string;
  verifiedName: string;
  maskedDob: string | null;
  phoneMatch: boolean;
  watchListed: boolean;
  verifiedAt: string;
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, upgradeKyc, unblockKyc, enableBiometric, refreshUser, verifyPin, getStoredPin } = useRoam();
  const [biometricAvail, setBiometricAvail] = useState(false);
  const [kycRecords, setKycRecords] = useState<KycRecord[]>([]);

  // ── Change PIN modal ──────────────────────────────────────────────────────
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);

  async function handleChangePin() {
    setPinError("");
    if (oldPin.length < 4) { setPinError("Enter your current 4-digit PIN."); return; }
    if (!verifyPin(oldPin)) { setPinError("Current PIN is incorrect."); return; }
    if (newPin.length < 4) { setPinError("New PIN must be 4 digits."); return; }
    if (newPin !== confirmPin) { setPinError("New PINs do not match."); return; }
    if (newPin === oldPin) { setPinError("New PIN must be different from current PIN."); return; }
    await AsyncStorage.setItem("roam_pin", newPin);
    setPinSuccess(true);
    setTimeout(() => {
      setPinModalOpen(false);
      setOldPin(""); setNewPin(""); setConfirmPin(""); setPinError(""); setPinSuccess(false);
    }, 1500);
  }

  function openChangePinModal() {
    setOldPin(""); setNewPin(""); setConfirmPin(""); setPinError(""); setPinSuccess(false);
    setPinModalOpen(true);
  }

  const fetchKycRecords = useCallback(async () => {
    if (!user?.phone) return;
    try {
      const res = await fetch(`${API_BASE}/roam/kyc/${encodeURIComponent(user.phone)}`);
      if (res.ok) {
        const data = await res.json() as { records: KycRecord[] };
        setKycRecords(data.records ?? []);
      }
    } catch {
      // Offline — show nothing extra
    }
  }, [user?.phone]);

  useEffect(() => {
    // Refresh user from server so KYC tier is always current
    refreshUser().catch(() => {});
    fetchKycRecords();
  }, [fetchKycRecords, refreshUser]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = 90 + (Platform.OS === "web" ? 34 : 0);

  useEffect(() => {
    if (Platform.OS !== "web") {
      LocalAuthentication.hasHardwareAsync().then((has) => {
        if (has) LocalAuthentication.isEnrolledAsync().then(setBiometricAvail);
      });
    }
  }, []);

  async function handleLogout() {
    async function doLogout() {
      await logout();
      router.replace("/(onboarding)/login");
    }

    if (Platform.OS === "web") {
      // Alert.alert buttons don't fire on web — use native confirm
      if (typeof window !== "undefined" && window.confirm("Sign out of Roam?")) {
        await doLogout();
      }
      return;
    }

    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: doLogout },
    ]);
  }

  async function handleUpgradeKyc() {
    // Sync with server first so we always navigate based on the real DB state
    await refreshUser().catch(() => {});
    // Read fresh tier from storage (avoids stale React closure)
    const stored = await AsyncStorage.getItem("roam_user").catch(() => null);
    const freshUser = stored ? (JSON.parse(stored) as { kycTier?: number }) : null;
    const currentTier = freshUser?.kycTier ?? user?.kycTier ?? 1;
    if (currentTier >= 3) {
      Alert.alert("Maximum Tier Reached", "Your account is already at the highest verification tier (Tier 3).");
      return;
    }
    const targetTier = currentTier + 1;
    router.push(`/(onboarding)/kyc-upgrade?targetTier=${targetTier}`);
  }

  async function handleToggleBiometric(value: boolean) {
    if (!value) {
      Alert.alert("Disable Biometrics", "Biometric login has been disabled. You'll need your PIN to sign in.");
      return;
    }
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirm biometric to enable",
        cancelLabel: "Cancel",
      });
      if (result.success) {
        await enableBiometric();
        Alert.alert("Biometrics Enabled", "You can now sign in using biometrics.");
      }
    } catch {
      Alert.alert("Error", "Biometric authentication failed. Please try again.");
    }
  }

  function handleUnblockKyc() {
    Alert.alert(
      "Complete KYC",
      "To unblock your account, please visit a NIMC enrolment centre to update your registered phone number to match your NIN, then contact support.",
      [
        { text: "Got it", style: "cancel" },
        {
          text: "Unblock (Demo)",
          onPress: () => {
            unblockKyc();
            Alert.alert("Account Unblocked", "Your account has been unblocked (demo mode). Transactions are now enabled.");
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: botPad }}>
        <View style={[styles.header, { paddingTop: topPad }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
        </View>

        {user?.kycBlocked && (
          <Pressable
            onPress={handleUnblockKyc}
            style={[styles.blockedBanner, { backgroundColor: colors.warning + "18", borderColor: colors.warning + "55" }]}
          >
            <AlertTriangle size={18} color={colors.warning} strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.blockedTitle, { color: colors.warning }]}>Account Restricted</Text>
              <Text style={[styles.blockedSub, { color: colors.mutedForeground }]}>
                Phone number doesn't match NIN. Tap to resolve.
              </Text>
            </View>
            <ChevronRight size={16} color={colors.warning} strokeWidth={1.8} />
          </Pressable>
        )}

        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{(user?.name ?? "U").slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.foreground }]}>{user?.name ?? "User"}</Text>
            <Text style={[styles.profilePhone, { color: colors.mutedForeground }]}>{user?.phone}</Text>
            {!!user?.email && (
              <View style={styles.emailRow}>
                <Mail size={11} color={colors.mutedForeground} strokeWidth={1.8} />
                <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{user.email}</Text>
              </View>
            )}
          </View>
          {(() => {
            const t = user?.kycTier ?? 1;
            const kycColor = user?.kycBlocked ? colors.warning : t === 3 ? colors.success : t === 2 ? "#3B82F6" : colors.primary;
            return (
              <View style={[styles.kycBadge, { backgroundColor: kycColor + "1A" }]}>
                <Shield size={12} color={kycColor} strokeWidth={1.8} />
                <Text style={[styles.kycText, { color: kycColor }]}>
                  {user?.kycBlocked ? "Blocked" : `Tier ${t}`}
                </Text>
              </View>
            );
          })()}
        </View>

        <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Account Details</Text>
          <InfoRow Icon={MapPin} label="Country" value={`${user?.country.flag} ${user?.country.name}`} colors={colors} />
          <InfoRow Icon={DollarSign} label="Currency" value={`${user?.country.currency} (${user?.country.symbol})`} colors={colors} />
          <InfoRow
            Icon={Shield}
            label="NIN Status"
            value={user?.ninVerified ? "Verified" : "Not verified"}
            valueColor={user?.ninVerified ? colors.success : colors.mutedForeground}
            colors={colors}
          />
          <InfoRow Icon={Calendar} label="Member Since" value={formatDate(user?.joinedAt)} colors={colors} last />
        </View>

        {kycRecords.length > 0 && (
          <>
            <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Verified Identity Documents</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {kycRecords.map((rec, i) => (
                <View
                  key={rec.docType}
                  style={[
                    styles.kycRow,
                    i < kycRecords.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.kycDocIcon, { backgroundColor: colors.primary + "1A" }]}>
                    <CreditCard size={16} color={colors.primary} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.kycDocType, { color: colors.foreground }]}>
                      {rec.docType.toUpperCase()}
                      {rec.watchListed && (
                        <Text style={{ color: colors.warning }}> ⚠ Watchlist</Text>
                      )}
                    </Text>
                    <Text style={[styles.kycDocNumber, { color: colors.mutedForeground }]}>
                      {rec.maskedDocNumber}
                    </Text>
                    <Text style={[styles.kycDocName, { color: colors.foreground }]}>
                      {rec.verifiedName}
                    </Text>
                    {rec.maskedDob && (
                      <Text style={[styles.kycDocDob, { color: colors.mutedForeground }]}>
                        DOB: {rec.maskedDob}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.kycStatus, { backgroundColor: colors.success + "1A" }]}>
                    <Text style={[styles.kycStatusText, { color: colors.success }]}>Verified</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Security</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MenuItem
            Icon={Lock}
            label="Change PIN"
            colors={colors}
            onPress={openChangePinModal}
          />
          <MenuItem
            Icon={Shield}
            label="KYC Verification"
            badge={user?.kycBlocked ? "Restricted" : user?.kycTier === 3 ? "Tier 3" : user?.kycTier === 2 ? "Upgrade to Tier 3" : "Upgrade to Tier 2"}
            badgeColor={user?.kycBlocked ? colors.warning : user?.kycTier === 3 ? colors.success : user?.kycTier === 2 ? "#3B82F6" : colors.primary}
            colors={colors}
            onPress={user?.kycBlocked ? handleUnblockKyc : handleUpgradeKyc}
            last={!biometricAvail}
          />
          {biometricAvail && (
            <View style={[styles.menuItem, styles.menuItemLast]}>
              <Fingerprint size={18} color={colors.foreground} strokeWidth={1.8} />
              <Text style={[styles.menuLabel, { color: colors.foreground, flex: 1 }]}>Biometric Login</Text>
              <Switch
                value={!!user?.biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: colors.border, true: colors.primary + "88" }}
                thumbColor={user?.biometricEnabled ? colors.primary : colors.mutedForeground}
              />
            </View>
          )}
        </View>

        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Support</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MenuItem Icon={HelpCircle} label="Help & Support" colors={colors} onPress={() => {
            const url = "mailto:support@payos.africa?subject=Roam%20Support";
            Linking.openURL(url).catch(() => Alert.alert("Contact Support", "Email us at support@payos.africa"));
          }} />
          <MenuItem Icon={Info} label="About Roam" colors={colors} onPress={() => Alert.alert("Roam by PayOs", "Version 1.0.0\n\nBuilt for seamless cross-border payments across Africa.\n\n© 2025 PayOs Africa Limited")} last />
        </View>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutBtn,
            { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40", opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <LogOut size={18} color={colors.destructive} strokeWidth={1.8} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>

      {/* ── Change PIN Modal ── */}
      <Modal visible={pinModalOpen} transparent animationType="slide" onRequestClose={() => setPinModalOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setPinModalOpen(false)}>
          <View style={pStyles.overlay} />
        </TouchableWithoutFeedback>
        <View style={[pStyles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[pStyles.handle, { backgroundColor: colors.border }]} />
          <Text style={[pStyles.title, { color: colors.foreground }]}>Change PIN</Text>
          {pinSuccess ? (
            <View style={pStyles.successBox}>
              <Text style={[pStyles.successText, { color: colors.success ?? "#16A34A" }]}>PIN changed successfully!</Text>
            </View>
          ) : (
            <>
              <Text style={[pStyles.fieldLabel, { color: colors.mutedForeground }]}>Current PIN</Text>
              <TextInput
                style={[pStyles.pinInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                secureTextEntry keyboardType="numeric" maxLength={4}
                placeholder="••••" placeholderTextColor={colors.mutedForeground}
                value={oldPin} onChangeText={setOldPin}
              />
              <Text style={[pStyles.fieldLabel, { color: colors.mutedForeground }]}>New PIN</Text>
              <TextInput
                style={[pStyles.pinInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                secureTextEntry keyboardType="numeric" maxLength={4}
                placeholder="••••" placeholderTextColor={colors.mutedForeground}
                value={newPin} onChangeText={setNewPin}
              />
              <Text style={[pStyles.fieldLabel, { color: colors.mutedForeground }]}>Confirm New PIN</Text>
              <TextInput
                style={[pStyles.pinInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                secureTextEntry keyboardType="numeric" maxLength={4}
                placeholder="••••" placeholderTextColor={colors.mutedForeground}
                value={confirmPin} onChangeText={setConfirmPin}
              />
              {!!pinError && (
                <Text style={[pStyles.errorText, { color: colors.destructive }]}>{pinError}</Text>
              )}
              <Pressable
                onPress={handleChangePin}
                style={({ pressed }) => [pStyles.confirmBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={pStyles.confirmBtnText}>Save New PIN</Text>
              </Pressable>
              <Pressable onPress={() => setPinModalOpen(false)} style={{ alignItems: "center", marginTop: 12 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const pStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  pinInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 20, letterSpacing: 8, fontFamily: "Inter_600SemiBold", marginBottom: 16, textAlign: "center" },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 12, textAlign: "center" },
  confirmBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  confirmBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  successBox: { alignItems: "center", paddingVertical: 30 },
  successText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});

function InfoRow({ Icon, label, value, colors, last, valueColor }: {
  Icon: LucideIcon; label: string; value: string;
  colors: ReturnType<typeof useColors>; last?: boolean; valueColor?: string;
}) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Icon size={15} color={colors.mutedForeground} strokeWidth={1.8} />
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

function MenuItem({ Icon, label, badge, badgeColor, colors, onPress, last }: {
  Icon: LucideIcon; label: string; badge?: string; badgeColor?: string;
  colors: ReturnType<typeof useColors>; onPress: () => void; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon size={18} color={colors.foreground} strokeWidth={1.8} />
      <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {badge && (
        <View style={[styles.menuBadge, { backgroundColor: (badgeColor ?? colors.primary) + "1A" }]}>
          <Text style={[styles.menuBadgeText, { color: badgeColor ?? colors.primary }]}>{badge}</Text>
        </View>
      )}
      <ChevronRight size={16} color={colors.mutedForeground} strokeWidth={1.8} />
    </Pressable>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  blockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  blockedTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  blockedSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  profileCard: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  profileInfo: { flex: 1, gap: 3 },
  profileName: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  profilePhone: { fontSize: 13, fontFamily: "Inter_400Regular" },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  profileEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  kycBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  kycText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  accountCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, textTransform: "uppercase" },
  infoRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  infoLabel: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  infoValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  groupLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.5, textTransform: "uppercase", paddingHorizontal: 20, paddingBottom: 8 },
  menuCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  menuItemLast: {},
  menuLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  menuBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  menuBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  logoutBtn: { margin: 16, borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  kycRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  kycDocIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  kycDocType: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, marginBottom: 2 },
  kycDocNumber: { fontSize: 15, fontFamily: "Inter_600SemiBold", letterSpacing: 2, marginBottom: 2 },
  kycDocName: { fontSize: 13, fontFamily: "Inter_400Regular" },
  kycDocDob: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  kycStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  kycStatusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
