/**
 * KYC Tier Upgrade Screen
 * Reached from Profile → KYC Verification → Upgrade
 * Handles upgrades from Tier 1 → 2 and Tier 2 → 3
 */
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft, Check, CheckCircle, FileText,
  Shield, Upload, Trash2,
} from "lucide-react-native";
import React, { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import {
  ActivityIndicator,
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
import { useRoam } from "@/context/RoamContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

const VALID_ID_TYPES = [
  { key: "voters_card",     label: "Voter's Card" },
  { key: "intl_passport",   label: "International Passport" },
  { key: "national_id",     label: "National ID Card" },
  { key: "drivers_license", label: "Driver's License" },
  { key: "employee_id",     label: "Employee ID" },
];

const ADDRESS_TYPES = [
  { key: "electricity",    label: "Electricity Bill" },
  { key: "water",          label: "Water Bill" },
  { key: "telephone",      label: "Telephone Bill" },
  { key: "bank_statement", label: "Bank Statement" },
  { key: "waste",          label: "Waste Bill" },
];

type UploadedDoc = {
  fileName: string;
  mimeType: string;
  fileSizeKb: number;
  savedId?: string;
};

type Step = "overview" | "bvn" | "valid_id" | "address" | "photo" | "submitting" | "done";

export default function KycUpgradeScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { user, upgradeKycTier } = useRoam();
  const { targetTier: targetTierParam } = useLocalSearchParams<{ targetTier?: string }>();

  const targetTier = (Number(targetTierParam) === 3 ? 3 : 2) as 2 | 3;
  const isTier3    = targetTier === 3;

  const padTop    = insets.top    + (Platform.OS === "web" ? 67 : 0);
  const padBottom = Math.max(insets.bottom, 24) + (Platform.OS === "web" ? 34 : 0);

  const [step, setStep] = useState<Step>("overview");

  // BVN
  const [bvnNumber,  setBvnNumber]  = useState("");
  const [bvnLoading, setBvnLoading] = useState(false);
  const [bvnError,   setBvnError]   = useState("");
  const [bvnVerified, setBvnVerified] = useState(user?.bvnVerified ?? false);
  const [bvnName,    setBvnName]    = useState("");


  // Valid ID
  const [selectedIdType, setSelectedIdType] = useState("");
  const [idNumber,       setIdNumber]        = useState("");
  const [idDoc,          setIdDoc]           = useState<UploadedDoc | null>(null);
  const [idUploading,    setIdUploading]     = useState(false);
  const [idUploadError,  setIdUploadError]   = useState("");

  // Address
  const [selectedAddressType, setSelectedAddressType] = useState("");
  const [addressDoc,          setAddressDoc]           = useState<UploadedDoc | null>(null);
  const [addrUploading,       setAddrUploading]        = useState(false);
  const [addrUploadError,     setAddrUploadError]      = useState("");

  // Photo (Tier-3)
  const [photoDoc,       setPhotoDoc]       = useState<UploadedDoc | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState("");

  // Submission
  const [submitError, setSubmitError] = useState("");

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function pickPdf(
    category: "government_id" | "proof_of_address" | "passport_photo",
    docType: string | null,
    onPicked: (doc: UploadedDoc) => void,
    setUploading: (v: boolean) => void,
    setError: (v: string) => void,
  ) {
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset    = result.assets[0];
      const fileName = asset.name ?? `kyc-${category}-${Date.now()}.pdf`;
      const mimeType = asset.mimeType ?? "application/pdf";

      // Enforce PDF on the client as well
      if (!fileName.toLowerCase().endsWith(".pdf") && mimeType !== "application/pdf") {
        setError("Only PDF files are accepted. Please select a PDF document.");
        return;
      }

      setUploading(true);

      // Read as base64 — handle three URI shapes:
      // 1. data: URI  — strip prefix (rare but possible)
      // 2. blob: URI  — web browser blob, convert with FileReader
      // 3. file:// / content:// — native, use expo-file-system
      let fileDataB64: string;
      if (asset.uri.startsWith("data:")) {
        fileDataB64 = asset.uri.replace(/^data:[^;]+;base64,/, "");
      } else if (Platform.OS === "web" || asset.uri.startsWith("blob:")) {
        // Web: fetch the blob and use FileReader to get base64
        const blob = await fetch(asset.uri).then((r) => r.blob());
        fileDataB64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve((reader.result as string).replace(/^data:[^;]+;base64,/, ""));
          reader.onerror = () => reject(new Error("FileReader error"));
          reader.readAsDataURL(blob);
        });
      } else {
        fileDataB64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const fileSizeKb = Math.round((asset.size ?? fileDataB64.length * 0.75) / 1024);

      // Optimistic update (no savedId yet)
      onPicked({ fileName, mimeType, fileSizeKb });

      const res = await fetch(`${API_BASE}/roam/kyc/document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone:       user?.phone ?? "",
          docCategory: category,
          docType:     docType ?? category,
          fileName,
          mimeType,
          fileDataB64,
        }),
      });

      const data = await res.json() as { success?: boolean; document?: { id: string }; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Upload failed. Please try again.");
        onPicked({ fileName, mimeType, fileSizeKb }); // keep preview, no savedId
        return;
      }

      onPicked({ fileName, mimeType, fileSizeKb, savedId: data.document?.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("PDF pick/upload error:", msg);
      setError(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  }

  async function verifyBvn() {
    if (bvnNumber.trim().length !== 11) { setBvnError("BVN must be exactly 11 digits."); return; }
    setBvnLoading(true); setBvnError("");
    try {
      const res = await fetch(`${API_BASE}/bvn/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bvn: bvnNumber.trim(), phone: user?.phone ?? "" }),
      });
      const data = await res.json() as { verified?: boolean; name?: string; error?: string };
      if (!res.ok || !data.verified) { setBvnError(data.error ?? "BVN not found. Please check and try again."); return; }
      setBvnVerified(true);
      setBvnName(data.name ?? "");
      // AML/PEP screening runs silently in the background on the server
      // and is stored for compliance review — no flags shown to the user.
      await fetch(`${API_BASE}/roam/kyc/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: user?.phone ?? "", docType: "bvn", docNumber: bvnNumber.trim(), verifiedName: data.name ?? "", phoneMatch: true }),
      });
      setStep("valid_id");
    } catch {
      setBvnError("Network error. Please check your connection.");
    } finally {
      setBvnLoading(false);
    }
  }

  async function handleSubmit() {
    setSubmitError(""); setStep("submitting");
    const result = await upgradeKycTier(targetTier, {
      validIdType: selectedIdType,
      validIdNumber: idNumber.trim(),
      addressType: selectedAddressType,
      addressConfirmed: !!addressDoc,
      hasPhoto: isTier3 ? !!photoDoc : undefined,
    });
    if (result.success) { setStep("done"); }
    else {
      setSubmitError(result.error ?? "Upgrade failed. Please try again.");
      setStep(isTier3 ? "photo" : "address");
    }
  }

  const requirements = isTier3
    ? [
        { label: "BVN (Bank Verification Number)",     done: bvnVerified || user?.bvnVerified },
        { label: "NIN (National Identification Number)", done: user?.ninVerified },
        { label: "Valid Government-Issued ID",          done: false },
        { label: "Proof of Address (within 3 months)", done: false },
        { label: "Recent Passport Photograph",         done: false },
      ]
    : [
        { label: "BVN (Bank Verification Number)",     done: bvnVerified || user?.bvnVerified },
        { label: "NIN (National Identification Number)", done: user?.ninVerified },
        { label: "Valid Government-Issued ID",          done: false },
        { label: "Proof of Address (within 3 months)", done: false },
      ];

  // ── Overview ──────────────────────────────────────────────────────────────
  if (step === "overview") {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.topBar, { paddingTop: padTop }]}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <ArrowLeft size={22} color={colors.foreground} strokeWidth={1.8} />
          </Pressable>
          <Text style={[s.screenTitle, { color: colors.foreground }]}>Upgrade to Tier {targetTier}</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: padBottom, paddingHorizontal: 20 }}>
          <View style={[s.tierBadgeCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }]}>
            <Shield size={28} color={colors.primary} strokeWidth={1.5} />
            <View style={{ flex: 1 }}>
              <Text style={[s.tierBadgeTitle, { color: colors.primary }]}>Tier {targetTier} — {isTier3 ? "Premium" : "Verified"}</Text>
              <Text style={[s.tierBadgeSub, { color: colors.mutedForeground }]}>
                Daily limit: ₦{isTier3 ? "5,000,000" : "500,000"} · Balance cap: ₦{isTier3 ? "10,000,000" : "2,000,000"}
              </Text>
            </View>
          </View>

          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Requirements</Text>
          <View style={[s.requirementsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {requirements.map((req, i) => (
              <View key={req.label} style={[
                s.reqRow,
                i < requirements.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}>
                <View style={[s.reqCheck, { backgroundColor: req.done ? colors.success + "1A" : colors.muted }]}>
                  {req.done
                    ? <Check size={13} color={colors.success} strokeWidth={2.5} />
                    : <View style={[s.reqDot, { backgroundColor: colors.mutedForeground }]} />}
                </View>
                <Text style={[s.reqLabel, { color: req.done ? colors.foreground : colors.mutedForeground }]}>{req.label}</Text>
                {req.done && <Text style={[s.reqDone, { color: colors.success }]}>Done</Text>}
              </View>
            ))}
          </View>

          {!user?.ninVerified && (
            <View style={[s.warnBanner, { backgroundColor: colors.warning + "18", borderColor: colors.warning + "44" }]}>
              <Text style={[s.warnText, { color: colors.warning }]}>
                ⚠  Your NIN must be verified before upgrading. Please complete NIN verification first.
              </Text>
            </View>
          )}

          <Pressable
            onPress={() => setStep(bvnVerified || user?.bvnVerified ? "valid_id" : "bvn")}
            disabled={!user?.ninVerified}
            style={({ pressed }) => [s.primaryBtn, {
              backgroundColor: user?.ninVerified ? colors.primary : colors.muted,
              opacity: pressed ? 0.85 : 1,
            }]}
          >
            <Text style={[s.primaryBtnText, { color: user?.ninVerified ? "#fff" : colors.mutedForeground }]}>
              Begin Upgrade
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── BVN ───────────────────────────────────────────────────────────────────
  if (step === "bvn") {
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: padTop }]}>
        <View style={s.topBar}>
          <Pressable onPress={() => setStep("overview")} style={s.backBtn}>
            <ArrowLeft size={22} color={colors.foreground} strokeWidth={1.8} />
          </Pressable>
          <Text style={[s.screenTitle, { color: colors.foreground }]}>BVN Verification</Text>
          <View style={{ width: 42 }} />
        </View>

        <View style={s.formBody}>
          <Text style={[s.formHint, { color: colors.mutedForeground }]}>
            Enter your 11-digit Bank Verification Number to verify your identity.
          </Text>
          <TextInput
            style={[s.textInput, { backgroundColor: colors.card, borderColor: bvnError ? colors.destructive : colors.border, color: colors.foreground }]}
            placeholder="Enter BVN" placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad" maxLength={11}
            value={bvnNumber} onChangeText={(t) => { setBvnNumber(t.replace(/\D/g, "")); setBvnError(""); }}
          />
          {!!bvnError && <Text style={[s.errorText, { color: colors.destructive }]}>{bvnError}</Text>}
          <View style={[s.infoBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.infoText, { color: colors.mutedForeground }]}>
              Your BVN is a unique 11-digit number. Find it by dialling *565*0# on your registered phone.
            </Text>
          </View>
        </View>

        <View style={[s.footer, { paddingBottom: padBottom }]}>
          <Pressable onPress={verifyBvn} disabled={bvnNumber.length !== 11 || bvnLoading}
            style={({ pressed }) => [s.primaryBtn, { backgroundColor: bvnNumber.length === 11 ? colors.primary : colors.muted, opacity: pressed ? 0.85 : 1 }]}>
            {bvnLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={[s.primaryBtnText, { color: bvnNumber.length === 11 ? "#fff" : colors.mutedForeground }]}>Verify BVN</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Valid ID ──────────────────────────────────────────────────────────────
  if (step === "valid_id") {
    const canProceed = selectedIdType !== "" && idNumber.trim().length >= 5 && !!idDoc?.savedId;
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: padTop }]}>
        <View style={s.topBar}>
          <Pressable onPress={() => setStep(bvnVerified || user?.bvnVerified ? "overview" : "bvn")} style={s.backBtn}>
            <ArrowLeft size={22} color={colors.foreground} strokeWidth={1.8} />
          </Pressable>
          <Text style={[s.screenTitle, { color: colors.foreground }]}>Government-Issued ID</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={[s.formBody, { paddingBottom: padBottom + 80 }]}>
          <Text style={[s.formHint, { color: colors.mutedForeground }]}>
            Select your ID type, enter the ID number, and upload a clear photo or scan of the document.
          </Text>

          {/* ID type selector */}
          {VALID_ID_TYPES.map((idType) => (
            <Pressable key={idType.key} onPress={() => setSelectedIdType(idType.key)}
              style={[s.selectOption, {
                backgroundColor: selectedIdType === idType.key ? colors.primary + "12" : colors.card,
                borderColor:     selectedIdType === idType.key ? colors.primary : colors.border,
              }]}>
              <FileText size={16} color={selectedIdType === idType.key ? colors.primary : colors.mutedForeground} strokeWidth={1.8} />
              <Text style={[s.selectLabel, { color: selectedIdType === idType.key ? colors.primary : colors.foreground }]}>
                {idType.label}
              </Text>
              {selectedIdType === idType.key && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
            </Pressable>
          ))}

          {selectedIdType !== "" && (
            <>
              {/* ID number */}
              <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>ID Number</Text>
              <TextInput
                style={[s.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Enter ID number" placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters" value={idNumber} onChangeText={setIdNumber}
              />

              {/* Upload ID document */}
              <Text style={[s.inputLabel, { color: colors.mutedForeground, marginTop: 8 }]}>
                Upload ID Document <Text style={{ color: colors.destructive }}>*</Text>
              </Text>

              {idDoc ? (
                <View style={[s.docPreview, { backgroundColor: colors.card, borderColor: idDoc.savedId ? colors.success + "60" : colors.primary + "60" }]}>
                  <View style={[s.pdfIcon, { backgroundColor: colors.primary + "18" }]}>
                    <FileText size={22} color={colors.primary} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.docFileName, { color: colors.foreground }]} numberOfLines={1}>{idDoc.fileName}</Text>
                    <Text style={[s.docMeta, { color: colors.mutedForeground }]}>{idDoc.fileSizeKb} KB · PDF</Text>
                    {idDoc.savedId
                      ? <Text style={[s.docStatus, { color: colors.success }]}>✓ Uploaded successfully</Text>
                      : <Text style={[s.docStatus, { color: colors.primary }]}>Saving…</Text>}
                  </View>
                  <Pressable onPress={() => { setIdDoc(null); setIdUploadError(""); }}
                    style={[s.docRemoveBtn, { backgroundColor: colors.destructive + "18" }]}>
                    <Trash2 size={16} color={colors.destructive} strokeWidth={1.8} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => pickPdf("government_id", selectedIdType, setIdDoc, setIdUploading, setIdUploadError)}
                  disabled={idUploading}
                  style={[s.uploadBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  {idUploading
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Upload size={20} color={colors.primary} strokeWidth={1.8} />}
                  <Text style={[s.uploadBtnText, { color: colors.primary }]}>
                    {idUploading ? "Uploading…" : "Select PDF Document"}
                  </Text>
                </Pressable>
              )}

              {!!idUploadError && (
                <Text style={[s.errorText, { color: colors.destructive }]}>{idUploadError}</Text>
              )}

              <Text style={[s.uploadHint, { color: colors.mutedForeground }]}>
                PDF only · All 4 corners of your ID must be visible · Max 5 MB
              </Text>
            </>
          )}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: padBottom }]}>
          <Pressable onPress={() => setStep("address")} disabled={!canProceed}
            style={({ pressed }) => [s.primaryBtn, { backgroundColor: canProceed ? colors.primary : colors.muted, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={[s.primaryBtnText, { color: canProceed ? "#fff" : colors.mutedForeground }]}>Continue</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Proof of Address ──────────────────────────────────────────────────────
  if (step === "address") {
    const canProceed = selectedAddressType !== "" && !!addressDoc?.savedId;
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: padTop }]}>
        <View style={s.topBar}>
          <Pressable onPress={() => setStep("valid_id")} style={s.backBtn}>
            <ArrowLeft size={22} color={colors.foreground} strokeWidth={1.8} />
          </Pressable>
          <Text style={[s.screenTitle, { color: colors.foreground }]}>Proof of Address</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={[s.formBody, { paddingBottom: padBottom + 80 }]}>
          <Text style={[s.formHint, { color: colors.mutedForeground }]}>
            Select your document type and upload a copy. It must be dated within the last 3 months.
          </Text>

          {ADDRESS_TYPES.map((addrType) => (
            <Pressable key={addrType.key} onPress={() => setSelectedAddressType(addrType.key)}
              style={[s.selectOption, {
                backgroundColor: selectedAddressType === addrType.key ? colors.primary + "12" : colors.card,
                borderColor:     selectedAddressType === addrType.key ? colors.primary : colors.border,
              }]}>
              <FileText size={16} color={selectedAddressType === addrType.key ? colors.primary : colors.mutedForeground} strokeWidth={1.8} />
              <Text style={[s.selectLabel, { color: selectedAddressType === addrType.key ? colors.primary : colors.foreground }]}>
                {addrType.label}
              </Text>
              {selectedAddressType === addrType.key && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
            </Pressable>
          ))}

          {selectedAddressType !== "" && (
            <>
              <Text style={[s.inputLabel, { color: colors.mutedForeground, marginTop: 8 }]}>
                Upload Document <Text style={{ color: colors.destructive }}>*</Text>
              </Text>

              {addressDoc ? (
                <View style={[s.docPreview, { backgroundColor: colors.card, borderColor: addressDoc.savedId ? colors.success + "60" : colors.primary + "60" }]}>
                  <View style={[s.pdfIcon, { backgroundColor: colors.primary + "18" }]}>
                    <FileText size={22} color={colors.primary} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.docFileName, { color: colors.foreground }]} numberOfLines={1}>{addressDoc.fileName}</Text>
                    <Text style={[s.docMeta, { color: colors.mutedForeground }]}>{addressDoc.fileSizeKb} KB · PDF</Text>
                    {addressDoc.savedId
                      ? <Text style={[s.docStatus, { color: colors.success }]}>✓ Uploaded successfully</Text>
                      : <Text style={[s.docStatus, { color: colors.primary }]}>Saving…</Text>}
                  </View>
                  <Pressable onPress={() => { setAddressDoc(null); setAddrUploadError(""); }}
                    style={[s.docRemoveBtn, { backgroundColor: colors.destructive + "18" }]}>
                    <Trash2 size={16} color={colors.destructive} strokeWidth={1.8} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => pickPdf("proof_of_address", selectedAddressType, setAddressDoc, setAddrUploading, setAddrUploadError)}
                  disabled={addrUploading}
                  style={[s.uploadBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  {addrUploading
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Upload size={20} color={colors.primary} strokeWidth={1.8} />}
                  <Text style={[s.uploadBtnText, { color: colors.primary }]}>
                    {addrUploading ? "Uploading…" : "Select PDF Document"}
                  </Text>
                </Pressable>
              )}

              {!!addrUploadError && (
                <Text style={[s.errorText, { color: colors.destructive }]}>{addrUploadError}</Text>
              )}

              <Text style={[s.uploadHint, { color: colors.mutedForeground }]}>
                PDF only · Must clearly show name, address, and date (within 3 months) · Max 5 MB
              </Text>
            </>
          )}

          {!!submitError && <Text style={[s.errorText, { color: colors.destructive }]}>{submitError}</Text>}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: padBottom }]}>
          <Pressable onPress={() => isTier3 ? setStep("photo") : handleSubmit()} disabled={!canProceed}
            style={({ pressed }) => [s.primaryBtn, { backgroundColor: canProceed ? colors.primary : colors.muted, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={[s.primaryBtnText, { color: canProceed ? "#fff" : colors.mutedForeground }]}>
              {isTier3 ? "Continue" : "Submit for Upgrade"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Photo (Tier-3 only) ───────────────────────────────────────────────────
  if (step === "photo") {
    const canProceed = !!photoDoc?.savedId;
    return (
      <View style={[s.container, { backgroundColor: colors.background, paddingTop: padTop }]}>
        <View style={s.topBar}>
          <Pressable onPress={() => setStep("address")} style={s.backBtn}>
            <ArrowLeft size={22} color={colors.foreground} strokeWidth={1.8} />
          </Pressable>
          <Text style={[s.screenTitle, { color: colors.foreground }]}>Passport Photograph</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={[s.formBody, { paddingBottom: padBottom + 80 }]}>
          <Text style={[s.formHint, { color: colors.mutedForeground }]}>
            Upload a scanned PDF of a recent passport photograph taken against a plain background. Your full face must be visible.
          </Text>

          {photoDoc ? (
            <View style={[s.docPreview, { backgroundColor: colors.card, borderColor: photoDoc.savedId ? colors.success + "60" : colors.primary + "60" }]}>
              <View style={[s.pdfIcon, { backgroundColor: colors.primary + "18" }]}>
                <FileText size={22} color={colors.primary} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.docFileName, { color: colors.foreground }]} numberOfLines={1}>{photoDoc.fileName}</Text>
                <Text style={[s.docMeta, { color: colors.mutedForeground }]}>{photoDoc.fileSizeKb} KB · PDF</Text>
                {photoDoc.savedId
                  ? <Text style={[s.docStatus, { color: colors.success }]}>✓ Uploaded successfully</Text>
                  : <Text style={[s.docStatus, { color: colors.primary }]}>Saving…</Text>}
              </View>
              <Pressable onPress={() => { setPhotoDoc(null); setPhotoUploadError(""); }}
                style={[s.docRemoveBtn, { backgroundColor: colors.destructive + "18" }]}>
                <Trash2 size={16} color={colors.destructive} strokeWidth={1.8} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => pickPdf("passport_photo", "passport_photo", setPhotoDoc, setPhotoUploading, setPhotoUploadError)}
              disabled={photoUploading}
              style={[s.photoPicker, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {photoUploading
                ? <ActivityIndicator size="large" color={colors.primary} />
                : <Upload size={36} color={colors.mutedForeground} strokeWidth={1.5} />}
              <Text style={[s.photoPickerLabel, { color: colors.foreground }]}>
                {photoUploading ? "Uploading…" : "Select PDF Document"}
              </Text>
              <Text style={[s.photoPickerSub, { color: colors.mutedForeground }]}>
                PDF only · Max 5 MB · Plain background required
              </Text>
            </Pressable>
          )}

          {!!photoUploadError && <Text style={[s.errorText, { color: colors.destructive }]}>{photoUploadError}</Text>}
          {!!submitError      && <Text style={[s.errorText, { color: colors.destructive }]}>{submitError}</Text>}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: padBottom }]}>
          <Pressable onPress={handleSubmit} disabled={!canProceed}
            style={({ pressed }) => [s.primaryBtn, { backgroundColor: canProceed ? colors.primary : colors.muted, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={[s.primaryBtnText, { color: canProceed ? "#fff" : colors.mutedForeground }]}>
              Submit for Tier 3 Upgrade
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Submitting ────────────────────────────────────────────────────────────
  if (step === "submitting") {
    return (
      <View style={[s.container, s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[s.submittingText, { color: colors.mutedForeground }]}>Upgrading your account…</Text>
      </View>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, s.centered, { backgroundColor: colors.background, paddingHorizontal: 32 }]}>
      <View style={[s.doneIcon, { backgroundColor: colors.success + "1A" }]}>
        <CheckCircle size={44} color={colors.success} strokeWidth={1.5} />
      </View>
      <Text style={[s.doneTitle, { color: colors.foreground }]}>Tier {targetTier} Unlocked!</Text>
      <Text style={[s.doneSub, { color: colors.mutedForeground }]}>
        Your account has been upgraded to Tier {targetTier}. You now enjoy{" "}
        {isTier3 ? "a ₦5,000,000 daily limit and ₦10,000,000 balance cap." : "a ₦500,000 daily limit and ₦2,000,000 balance cap."}
      </Text>
      <View style={[s.limitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.limitRow}>
          <Text style={[s.limitKey, { color: colors.mutedForeground }]}>Daily limit</Text>
          <Text style={[s.limitVal, { color: colors.success }]}>₦{isTier3 ? "5,000,000" : "500,000"}</Text>
        </View>
        <View style={[s.limitRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
          <Text style={[s.limitKey, { color: colors.mutedForeground }]}>Balance cap</Text>
          <Text style={[s.limitVal, { color: colors.success }]}>₦{isTier3 ? "10,000,000" : "2,000,000"}</Text>
        </View>
      </View>
      <Pressable onPress={() => router.replace("/(tabs)/")}
        style={({ pressed }) => [s.primaryBtn, { width: "100%", marginTop: 8, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
        <Text style={[s.primaryBtnText, { color: "#fff" }]}>Go to Home</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1 },
  centered:   { justifyContent: "center", alignItems: "center" },
  topBar:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 16 },
  backBtn:    { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" },
  screenTitle:{ fontSize: 17, fontWeight: "600", letterSpacing: 0.2 },
  formBody:   { padding: 20, gap: 12 },
  formHint:   { fontSize: 14, lineHeight: 21, marginBottom: 4 },
  footer:     { paddingHorizontal: 20, paddingTop: 12 },

  tierBadgeCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 20, marginTop: 4 },
  tierBadgeTitle:{ fontSize: 15, fontWeight: "700", marginBottom: 2 },
  tierBadgeSub:  { fontSize: 12 },

  sectionTitle: { fontSize: 13, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },
  requirementsCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  reqRow:    { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  reqCheck:  { width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  reqDot:    { width: 7, height: 7, borderRadius: 3.5 },
  reqLabel:  { flex: 1, fontSize: 14 },
  reqDone:   { fontSize: 12, fontWeight: "600" },

  warnBanner: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 16 },
  warnText:   { fontSize: 13, lineHeight: 19 },

  primaryBtn:     { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", marginTop: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: "700" },

  textInput:  { height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  inputLabel: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  errorText:  { fontSize: 13, marginTop: 4 },

  infoBanner: { borderRadius: 10, borderWidth: 1, padding: 14 },
  infoText:   { fontSize: 13, lineHeight: 19 },

  selectOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  selectLabel:  { flex: 1, fontSize: 14, fontWeight: "500" },

  // Upload button
  uploadBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed" },
  uploadBtnText: { fontSize: 14, fontWeight: "600" },
  uploadHint:    { fontSize: 12, lineHeight: 17, marginTop: 2 },

  // Doc preview row (after upload)
  docPreview:  { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  pdfIcon:     { width: 44, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  docFileName: { fontSize: 13, fontWeight: "500", marginBottom: 1 },
  docMeta:     { fontSize: 11, marginBottom: 2 },
  docStatus:   { fontSize: 12 },
  docRemoveBtn:{ width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },

  // Photo picker (Tier-3)
  photoPicker:     { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 36, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed" },
  photoPickerLabel:{ fontSize: 15, fontWeight: "600" },
  photoPickerSub:  { fontSize: 12 },

  // Done screen
  doneIcon:  { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  doneTitle: { fontSize: 24, fontWeight: "800", marginBottom: 10, textAlign: "center" },
  doneSub:   { fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 24 },
  limitCard: { width: "100%", borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 24 },
  limitRow:  { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14 },
  limitKey:  { fontSize: 14 },
  limitVal:  { fontSize: 14, fontWeight: "700" },

  submittingText: { marginTop: 16, fontSize: 14 },

});
