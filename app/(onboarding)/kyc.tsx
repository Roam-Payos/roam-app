import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ChevronRight,
  CreditCard,
  FileText,
  MapPin,
  Shield,
  Zap,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { COUNTRIES, RoamUser, useRoam } from "@/context/RoamContext";

type DocType = {
  id: string;
  label: string;
  placeholder: string;
  hint: string;
  maxLength: number;
};

function getDocTypes(countryCode: string): DocType[] {
  switch (countryCode) {
    case "NG":
      return [
        { id: "bvn", label: "BVN", placeholder: "Enter 11-digit BVN", hint: "Bank Verification Number", maxLength: 11 },
        { id: "nin", label: "NIN", placeholder: "Enter 11-digit NIN", hint: "National Identity Number", maxLength: 11 },
        { id: "passport", label: "International Passport", placeholder: "e.g. A00000000", hint: "Nigerian passport number", maxLength: 10 },
        { id: "drivers", label: "Driver's License", placeholder: "e.g. ABC00000AA00", hint: "Federal Road Safety Commission ID", maxLength: 14 },
      ];
    case "GH":
      return [
        { id: "ghana_card", label: "Ghana Card", placeholder: "GHA-000000000-0", hint: "National Identification Authority card", maxLength: 15 },
        { id: "passport", label: "International Passport", placeholder: "Passport number", hint: "Ghanaian passport number", maxLength: 10 },
        { id: "drivers", label: "Driver's License", placeholder: "License number", hint: "DVLA driver's license", maxLength: 14 },
      ];
    case "KE":
      return [
        { id: "national_id", label: "National ID", placeholder: "e.g. 00000000", hint: "Kenya National Identity Card", maxLength: 10 },
        { id: "passport", label: "Passport", placeholder: "Passport number", hint: "Kenyan passport number", maxLength: 10 },
      ];
    case "ZA":
      return [
        { id: "rsa_id", label: "RSA ID Book", placeholder: "13-digit ID number", hint: "South African ID document", maxLength: 13 },
        { id: "passport", label: "Passport", placeholder: "Passport number", hint: "South African passport", maxLength: 10 },
      ];
    default:
      return [
        { id: "national_id", label: "National ID", placeholder: "ID number", hint: "Government-issued national ID", maxLength: 14 },
        { id: "passport", label: "Passport", placeholder: "Passport number", hint: "Passport number", maxLength: 10 },
      ];
  }
}

const LIMITS: Record<1 | 2, { send: string; receive: string; daily: string }> = {
  1: { send: "₦50,000", receive: "₦200,000", daily: "₦100,000" },
  2: { send: "₦5,000,000", receive: "Unlimited", daily: "₦10,000,000" },
};

export default function KycScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { phone, countryCode, email, name, pin, ninNumber, phoneMatch } = useLocalSearchParams<{
    phone: string;
    countryCode: string;
    email: string;
    name: string;
    pin: string;
    ninNumber?: string;
    phoneMatch?: string;
  }>();
  const { register } = useRoam();
  const ninPath = phoneMatch !== undefined;
  const ninPhoneMatch = phoneMatch === "true";

  const country = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];
  const docTypes = getDocTypes(country.code);

  const [step, setStep] = useState<"tier" | "doctype" | "details" | "verifying" | "done">(ninPath ? "verifying" : "tier");
  const [selectedTier, setSelectedTier] = useState<1 | 2 | null>(ninPath ? 1 : null);
  const [selectedDoc, setSelectedDoc] = useState<DocType | null>(null);
  const [docNumber, setDocNumber] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [docError, setDocError] = useState("");
  const [verifiedName, setVerifiedName] = useState("");
  const [verifyWarning, setVerifyWarning] = useState("");

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step]);

  useEffect(() => {
    if (ninPath) {
      const timer = setTimeout(() => doRegister(1), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  async function doRegister(tier: 1 | 2, bvnNumber?: string, bvnName?: string, bvnDob?: string) {
    const apiBase = process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
      : "http://localhost:8080/api";

    // Persist to PostgreSQL FIRST so we get the real server-generated user ID
    const regPayload = {
      phone: phone ?? "",
      email: email ?? "",
      name: name ?? "User",
      countryCode: country.code,
      kycTier: tier,
      kycBlocked: ninPath ? !ninPhoneMatch : false,
      ninVerified: ninPath,
      pinHash: pin ?? "0000",
    };
    const regRes = await fetch(`${apiBase}/roam/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regPayload),
    });

    // 409 = duplicate (already registered on server) — perfectly fine, just continue
    // Any other non-ok status is a real error we should surface
    if (!regRes.ok && regRes.status !== 409) {
      const errData = await regRes.json().catch(() => ({})) as { error?: string };
      setError(errData.error ?? "Registration failed. Please check your connection and try again.");
      setStep("initial");
      return;
    }

    // Use the server's real user ID so wallet queries match the database
    let serverId = Date.now().toString();
    try {
      if (regRes.status === 201) {
        const regData = await regRes.json() as { userId?: string };
        if (regData.userId) serverId = regData.userId;
      } else if (regRes.status === 409) {
        // Already registered — fetch the existing user's ID
        const lookupRes = await fetch(`${apiBase}/roam/lookup?phone=${encodeURIComponent(phone ?? "")}&email=${encodeURIComponent(email ?? "")}`);
        if (lookupRes.ok) {
          const lookupData = await lookupRes.json() as { userId?: string };
          if (lookupData.userId) serverId = lookupData.userId;
        }
      }
    } catch { /* keep local timestamp ID as fallback */ }

    const user: RoamUser = {
      id: serverId,
      name: name ?? "User",
      phone: phone ?? "",
      email: email ?? "",
      country,
      kycTier: tier,
      kycBlocked: ninPath ? !ninPhoneMatch : false,
      ninVerified: ninPath,
      biometricEnabled: false,
      pinHash: pin ?? "0000",
      joinedAt: new Date().toISOString(),
    };
    await register(user, pin ?? "0000", 120000);

    // Store KYC records — errors are non-fatal, local AsyncStorage still works
    try {
      if (ninPath && ninNumber && name) {
        await fetch(`${apiBase}/roam/kyc/store`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phone ?? "",
            docType: "nin",
            docNumber: ninNumber,
            verifiedName: name,
            phoneMatch: ninPhoneMatch,
          }),
        });
      }

      if (bvnNumber && bvnName) {
        await fetch(`${apiBase}/roam/kyc/store`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phone ?? "",
            docType: "bvn",
            docNumber: bvnNumber,
            verifiedName: bvnName,
            dob: bvnDob,
            phoneMatch: true,
          }),
        });
      }
    } catch {
      // silent — local AsyncStorage session is already saved above
    }

    router.replace("/(tabs)/");
  }

  async function chooseTier(tier: 1 | 2) {
    setSelectedTier(tier);
    if (tier === 1) {
      setStep("verifying");
      await doRegister(1);
    } else {
      fadeAnim.setValue(0);
      setStep("doctype");
    }
  }

  function chooseDoc(doc: DocType) {
    setSelectedDoc(doc);
    fadeAnim.setValue(0);
    setStep("details");
  }

  function validateDetails() {
    if (!docNumber.trim()) {
      setDocError("Please enter your document number");
      return false;
    }
    if (docNumber.trim().length < 5) {
      setDocError("Document number seems too short");
      return false;
    }
    if (!street.trim() || !city.trim() || !state.trim()) {
      setDocError("Please complete all address fields");
      return false;
    }
    return true;
  }

  async function submitDetails() {
    if (!validateDetails()) return;
    fadeAnim.setValue(0);
    setStep("verifying");

    const docId = selectedDoc?.id ?? "";
    const isLiveCheck = docId === "bvn" || docId === "nin";

    if (isLiveCheck) {
      try {
        const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
        const endpoint = docId === "bvn" ? `${apiBase}/bvn/verify` : `${apiBase}/nin/verify`;
        const bodyKey = docId === "bvn" ? "bvn" : "nin";

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [bodyKey]: docNumber.trim(), phone }),
        });

        const data = await res.json() as {
          verified?: boolean;
          name?: string;
          phoneMatch?: boolean;
          watchListed?: boolean;
          message?: string;
          error?: string;
        };

        if (!res.ok || !data.verified) {
          setDocError(data.error ?? "Verification failed. Please check your details.");
          fadeAnim.setValue(0);
          setStep("details");
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
          return;
        }

        if (data.name) setVerifiedName(data.name);
        if (data.watchListed) {
          setVerifyWarning("Your BVN appears on a financial watchlist. Transactions may be reviewed.");
        } else if (!data.phoneMatch) {
          setVerifyWarning("Phone number doesn't match your " + docId.toUpperCase() + " record.");
        }

        fadeAnim.setValue(0);
        setStep("done");
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();
      } catch {
        setDocError("Network error — please check your connection and try again.");
        fadeAnim.setValue(0);
        setStep("details");
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
      }
    } else {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 3500,
        useNativeDriver: false,
      }).start(async () => {
        fadeAnim.setValue(0);
        setStep("done");
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }).start();
      });
    }
  }

  async function completeVerified() {
    const isBvn = selectedDoc?.id === "bvn";
    const isNinDoc = selectedDoc?.id === "nin";
    await doRegister(
      2,
      isBvn || isNinDoc ? docNumber.trim() : undefined,
      verifiedName || undefined,
      undefined,
    );
  }

  const padBottom = Math.max(insets.bottom, 24) + (Platform.OS === "web" ? 34 : 0);

  if (step === "tier") {
    return (
      <Animated.View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0), opacity: fadeAnim }]}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: padBottom }]}>
          <View style={styles.tierHeader}>
            <Text style={[styles.title, { color: colors.foreground }]}>Verify your identity</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Choose your verification tier to set your transaction limits
            </Text>
          </View>

          <View style={styles.cards}>
            <Pressable
              onPress={() => chooseTier(1)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={[styles.cardIcon, { backgroundColor: colors.success + "1A" }]}>
                <Zap size={22} color={colors.success} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Tier 1 — Basic</Text>
                  <View style={[styles.badge, { backgroundColor: colors.success + "1A" }]}>
                    <Text style={[styles.badgeText, { color: colors.success }]}>Instant</Text>
                  </View>
                </View>
                <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
                  No documents needed. Start transacting immediately.
                </Text>
                <View style={styles.limitRow}>
                  <Text style={[styles.limitItem, { color: colors.mutedForeground }]}>
                    Deposit cap: <Text style={{ color: colors.foreground }}>{country.symbol}50,000</Text>
                  </Text>
                  <Text style={[styles.limitDot, { color: colors.border }]}>·</Text>
                  <Text style={[styles.limitItem, { color: colors.mutedForeground }]}>
                    Daily debit: <Text style={{ color: colors.foreground }}>{country.symbol}100,000</Text>
                  </Text>
                </View>
                <View style={styles.limitRow}>
                  <Text style={[styles.limitItem, { color: colors.mutedForeground }]}>
                    Balance cap: <Text style={{ color: colors.foreground }}>{country.symbol}300,000</Text>
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.mutedForeground} strokeWidth={1.8} />
            </Pressable>

            <Pressable
              onPress={() => chooseTier(2)}
              style={({ pressed }) => [
                styles.card,
                styles.cardPrimary,
                { backgroundColor: colors.primary + "10", borderColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={[styles.cardIcon, { backgroundColor: colors.primary + "1A" }]}>
                <Shield size={22} color={colors.primary} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Tier 2 — Verified</Text>
                  <View style={[styles.badge, { backgroundColor: colors.primary + "1A" }]}>
                    <Text style={[styles.badgeText, { color: colors.primary }]}>Recommended</Text>
                  </View>
                </View>
                <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
                  Provide a government-issued ID for higher limits.
                </Text>
                <View style={styles.limitRow}>
                  <Text style={[styles.limitItem, { color: colors.mutedForeground }]}>
                    Send: <Text style={{ color: colors.foreground }}>{country.symbol}5M</Text>
                  </Text>
                  <Text style={[styles.limitDot, { color: colors.border }]}>·</Text>
                  <Text style={[styles.limitItem, { color: colors.mutedForeground }]}>
                    Daily: <Text style={{ color: colors.foreground }}>{country.symbol}10M</Text>
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.primary} strokeWidth={1.8} />
            </Pressable>
          </View>

          <Text style={[styles.note, { color: colors.mutedForeground }]}>
            You can upgrade your tier anytime from your Profile settings
          </Text>
        </ScrollView>
      </Animated.View>
    );
  }

  if (step === "doctype") {
    return (
      <Animated.View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0), opacity: fadeAnim }]}>
        <Pressable onPress={() => { fadeAnim.setValue(0); setStep("tier"); }} style={styles.back}>
          <ArrowLeft size={22} color={colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: padBottom }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.stepIcon, { backgroundColor: colors.primary + "1A" }]}>
              <FileText size={22} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Select document</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Choose which government-issued ID you want to use for verification
            </Text>
          </View>
          <View style={styles.docList}>
            {docTypes.map((doc) => (
              <Pressable
                key={doc.id}
                onPress={() => chooseDoc(doc)}
                style={({ pressed }) => [
                  styles.docCard,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docLabel, { color: colors.foreground }]}>{doc.label}</Text>
                  <Text style={[styles.docHint, { color: colors.mutedForeground }]}>{doc.hint}</Text>
                </View>
                <ChevronRight size={16} color={colors.mutedForeground} strokeWidth={1.8} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    );
  }

  if (step === "details") {
    const detailsReady = docNumber.trim().length >= 5 && street.trim() && city.trim() && state.trim();
    return (
      <Animated.View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0), opacity: fadeAnim }]}>
        <Pressable onPress={() => { fadeAnim.setValue(0); setDocError(""); setStep("doctype"); }} style={styles.back}>
          <ArrowLeft size={22} color={colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: padBottom }]} keyboardShouldPersistTaps="handled">
          <View style={styles.sectionHeader}>
            <View style={[styles.stepIcon, { backgroundColor: colors.primary + "1A" }]}>
              <CreditCard size={22} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Document details</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Enter your {selectedDoc?.label} details and home address
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                {selectedDoc?.label} Number
              </Text>
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: colors.card,
                  borderColor: docError && !docNumber.trim() ? colors.destructive : colors.border,
                  color: colors.foreground,
                }]}
                placeholder={selectedDoc?.placeholder ?? "Document number"}
                placeholderTextColor={colors.mutedForeground}
                value={docNumber}
                onChangeText={(t) => { setDocNumber(t); setDocError(""); }}
                maxLength={selectedDoc?.maxLength ?? 20}
                autoCapitalize="characters"
                autoFocus
              />
            </View>

            <View style={[styles.dividerRow]}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={[styles.dividerIcon, { backgroundColor: colors.muted }]}>
                <MapPin size={14} color={colors.mutedForeground} strokeWidth={1.8} />
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </View>

            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Home Address</Text>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Street Address</Text>
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                }]}
                placeholder="e.g. 14 Adeola Odeku Street"
                placeholderTextColor={colors.mutedForeground}
                value={street}
                onChangeText={setStreet}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.rowFields}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>City</Text>
                <TextInput
                  style={[styles.textInput, {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  }]}
                  placeholder="Lagos"
                  placeholderTextColor={colors.mutedForeground}
                  value={city}
                  onChangeText={setCity}
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>State / Region</Text>
                <TextInput
                  style={[styles.textInput, {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  }]}
                  placeholder="Lagos State"
                  placeholderTextColor={colors.mutedForeground}
                  value={state}
                  onChangeText={setState}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {!!docError && (
              <Text style={[styles.errText, { color: colors.destructive }]}>{docError}</Text>
            )}
          </View>

          <Pressable
            onPress={submitDetails}
            disabled={!detailsReady}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: detailsReady ? colors.primary : colors.muted,
                opacity: pressed ? 0.85 : 1,
                marginTop: 8,
              },
            ]}
          >
            <Text style={[styles.btnText, { color: detailsReady ? "#fff" : colors.mutedForeground }]}>
              Verify Identity
            </Text>
            <ArrowRight size={18} color={detailsReady ? "#fff" : colors.mutedForeground} strokeWidth={2} />
          </Pressable>
        </ScrollView>
      </Animated.View>
    );
  }

  if (step === "verifying") {
    const barWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "100%"],
    });
    return (
      <View style={[styles.container, styles.centeredFull, { backgroundColor: "#0B1C3D" }]}>
        <View style={[styles.verifyIcon, { backgroundColor: colors.primary + "1A" }]}>
          <Shield size={36} color={colors.primary} strokeWidth={1.5} />
        </View>
        <Text style={[styles.verifyTitle, { color: colors.foreground }]}>
          {selectedTier === 1 ? "Setting up your wallet" : "Verifying your identity"}
        </Text>
        <Text style={[styles.verifySub, { color: colors.mutedForeground }]}>
          {selectedTier === 1
            ? "Preparing your Roam account…"
            : `Checking with ${country.name}'s identity registry…`}
        </Text>
        {selectedTier === 2 && (
          <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
            <Animated.View style={[styles.progressFill, { width: barWidth, backgroundColor: colors.primary }]} />
          </View>
        )}
        {selectedTier === 1 && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />}
      </View>
    );
  }

  if (step === "done") {
    return (
      <Animated.View style={[styles.container, styles.centeredFull, { backgroundColor: "#0B1C3D", opacity: fadeAnim }]}>
        <View style={[styles.verifyIcon, { backgroundColor: colors.success + "1A" }]}>
          <CheckCircle size={40} color={colors.success} strokeWidth={1.5} />
        </View>
        <Text style={[styles.verifyTitle, { color: colors.foreground }]}>Identity Verified!</Text>
        {verifiedName ? (
          <Text style={[styles.verifySub, { color: colors.mutedForeground }]}>
            Verified as <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{verifiedName}</Text>. Your Tier 2 account is ready.
          </Text>
        ) : (
          <Text style={[styles.verifySub, { color: colors.mutedForeground }]}>
            Your Tier 2 account is ready. Enjoy higher transaction limits.
          </Text>
        )}

        {!!verifyWarning && (
          <View style={[styles.warnBanner, { backgroundColor: colors.warning + "18", borderColor: colors.warning + "44" }]}>
            <Text style={[styles.warnText, { color: colors.warning }]}>{verifyWarning}</Text>
          </View>
        )}

        <View style={[styles.doneCard, { backgroundColor: colors.card, borderColor: colors.success + "44" }]}>
          <View style={styles.doneRow}>
            <Text style={[styles.doneKey, { color: colors.mutedForeground }]}>Send limit</Text>
            <Text style={[styles.doneVal, { color: colors.success }]}>{country.symbol}5,000,000</Text>
          </View>
          <View style={[styles.doneLine, { backgroundColor: colors.border }]} />
          <View style={styles.doneRow}>
            <Text style={[styles.doneKey, { color: colors.mutedForeground }]}>Receive limit</Text>
            <Text style={[styles.doneVal, { color: colors.success }]}>Unlimited</Text>
          </View>
          <View style={[styles.doneLine, { backgroundColor: colors.border }]} />
          <View style={styles.doneRow}>
            <Text style={[styles.doneKey, { color: colors.mutedForeground }]}>Daily limit</Text>
            <Text style={[styles.doneVal, { color: colors.success }]}>{country.symbol}10,000,000</Text>
          </View>
        </View>

        <Pressable
          onPress={completeVerified}
          style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, marginTop: 8 }]}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Open My Wallet</Text>
          <ArrowRight size={18} color="#fff" strokeWidth={2} />
        </Pressable>
      </Animated.View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1C3D" },
  centeredFull: { alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  scroll: { paddingHorizontal: 24, paddingTop: 8 },
  back: { padding: 20 },
  tierHeader: { gap: 10, marginBottom: 28, paddingTop: 8 },
  sectionHeader: { gap: 10, marginBottom: 28, alignItems: "flex-start" },
  stepIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  cards: { gap: 14 },
  card: { borderRadius: 18, borderWidth: 1, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  cardPrimary: { borderWidth: 1.5 },
  cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 8 },
  limitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  limitItem: { fontSize: 12, fontFamily: "Inter_400Regular" },
  limitDot: { fontSize: 16, lineHeight: 18 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  note: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 24, lineHeight: 18 },
  docList: { gap: 10 },
  docCard: { borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  docLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  docHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  form: { gap: 16 },
  field: { gap: 7 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
  textInput: { height: 54, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontFamily: "Inter_400Regular" },
  rowFields: { flexDirection: "row", gap: 12 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  divider: { flex: 1, height: 1 },
  dividerIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  errText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  btn: { height: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  verifyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  verifyTitle: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  verifySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 8 },
  progressBar: { width: "100%", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 16 },
  progressFill: { height: 6, borderRadius: 3 },
  doneCard: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 16, marginVertical: 12 },
  doneRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  doneLine: { height: 1 },
  doneKey: { fontSize: 14, fontFamily: "Inter_400Regular" },
  doneVal: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  warnBanner: { width: "100%", borderRadius: 12, borderWidth: 1, padding: 12 },
  warnText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, textAlign: "center" },
});
