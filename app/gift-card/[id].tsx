import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle, ImageIcon, MapPin, MessageCircle, RefreshCw } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView,
  Share, StyleSheet, Text, View,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface GiftCard {
  id: string;
  card_number: string;
  balance_pin: string;          // 6-digit PIN for beneficiary balance check
  beneficiary_name: string;
  beneficiary_phone: string | null;
  personal_message: string | null;
  currency: string;
  face_value: string;
  redeemed_amount: string;
  remaining_balance: string;
  status: "active" | "redeemed" | "expired" | "cancelled";
  expires_at: string;
  created_at: string;
  partner_name: string;
  logo_emoji: string;
  accent_color: string;
  partner_city: string;
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function statusBadge(s: GiftCard["status"]) {
  if (s === "active")   return { label: "✓ Active",    bg: "rgba(209,250,229,0.95)", fg: "#065F46" };
  if (s === "redeemed") return { label: "✓ Fully Used", bg: "rgba(229,231,235,0.9)",  fg: "#374151" };
  if (s === "expired")  return { label: "⚠ Expired",   bg: "rgba(254,226,226,0.9)",  fg: "#991B1B" };
  return                         { label: "✗ Cancelled", bg: "rgba(254,243,199,0.9)",  fg: "#92400E" };
}

// ── Fine diagonal lines (guilloche-style background) ─────────────────────────
function DiagLines() {
  return (
    <>
      {Array.from({ length: 18 }).map((_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: -300,
            left: -60 + i * 26,
            width: 1,
            height: 900,
            backgroundColor: "rgba(255,255,255,0.045)",
            transform: [{ rotate: "-52deg" }],
          }}
        />
      ))}
    </>
  );
}

// ── Concentric rings — top-left corner ───────────────────────────────────────
function CornerRings() {
  const rings = [220, 170, 124, 84, 50];
  return (
    <>
      {rings.map((size, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: -size / 2 + 18,
            left: -size / 2 + 18,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1,
            borderColor: `rgba(255,255,255,${0.05 + i * 0.025})`,
          }}
        />
      ))}
    </>
  );
}

// ── Subtle dot grid — bottom half ────────────────────────────────────────────
function DotGrid() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 10 }).map((_, col) => (
          <View
            key={`${row}-${col}`}
            style={{
              position: "absolute",
              bottom: 22 + row * 20,
              left: 18 + col * 32,
              width: 2.5,
              height: 2.5,
              borderRadius: 1.25,
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          />
        ))
      )}
    </>
  );
}

// ── Full gift card visual — navy blue edition ─────────────────────────────────
function GiftCardVisual({ card }: { card: GiftCard }) {
  const accent  = card.accent_color;   // used for the partner pill tint only
  const sym     = card.currency === "NGN" ? "₦" : card.currency === "GHS" ? "₵" : card.currency === "KES" ? "KSh" : "R";
  const faceVal   = Number(card.face_value);
  const remaining = Number(card.remaining_balance);
  const badge     = statusBadge(card.status);

  // QR encodes the public balance check URL — scanning opens payos.com/gift-card/check pre-filled
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "payos.com";
  const checkUrl = `https://${domain}/gift-card/check?card=${encodeURIComponent(card.card_number)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(checkUrl)}&bgcolor=0A1F44&color=FFFFFF&qzone=1&format=png`;

  return (
    <LinearGradient
      colors={["#0A1F44", "#1E4DB7", "#3A86FF"] as const}
      locations={[0, 0.55, 1]}
      start={{ x: 0.0, y: 0.0 }}
      end={{ x: 1.0, y: 1.0 }}
      style={styles.cardVisual}
    >
      {/* Fine decorative layers */}
      <DiagLines />
      <CornerRings />
      <DotGrid />

      {/* Soft white radial glow — top right (the "alive" effect) */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowTopRightInner} />

      {/* Merchant accent glow — subtle tint from partner colour */}
      <View style={[styles.accentGlow, { backgroundColor: accent + "18" }]} />

      {/* Thin gold accent line at top */}
      <View style={styles.goldLine} />

      {/* Row 1 — brand left, QR code top-right */}
      <View style={styles.cvTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cvBrand}>ROAM</Text>
          <Text style={styles.cvSubBrand}>Shopping Gift Card</Text>
        </View>
        {/* QR code embedded inside card — links to public balance check page */}
        <View style={{ alignItems: "center" }}>
          <View style={styles.cvQrWrap}>
            <Image
              source={{ uri: qrUrl }}
              style={styles.cvQrImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.cvQrHint}>Scan to check{"\n"}balance</Text>
        </View>
      </View>

      {/* Partner store pill — tinted with merchant accent */}
      <View style={[styles.partnerPill, { backgroundColor: accent + "33", borderColor: accent + "66", borderWidth: 1 }]}>
        <Text style={styles.partnerPillText}>{card.logo_emoji}  {card.partner_name.toUpperCase()}</Text>
        {card.partner_city ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 6 }}>
            <MapPin size={9} color="rgba(255,255,255,0.5)" />
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginLeft: 2 }}>{card.partner_city}</Text>
          </View>
        ) : null}
      </View>

      {/* Amount — centrepiece */}
      <Text style={styles.cvAmount}>{sym}{faceVal.toLocaleString()}</Text>
      {remaining < faceVal && (
        <View style={styles.remainingRow}>
          <View style={[styles.remainingBar, { width: `${Math.round((remaining / faceVal) * 100)}%` as any }]} />
          <Text style={styles.cvRemaining}>{sym}{remaining.toLocaleString()} remaining</Text>
        </View>
      )}

      {/* Personal message */}
      {card.personal_message ? (
        <Text style={styles.cvMessage} numberOfLines={2}>"{card.personal_message}"</Text>
      ) : null}

      {/* Divider */}
      <View style={styles.cvDivider} />

      {/* Beneficiary */}
      <View style={styles.cvBeneficiaryRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cvBeneficiaryLabel}>GIFT TO</Text>
          <Text style={styles.cvBeneficiaryName} numberOfLines={1}>{card.beneficiary_name}</Text>
        </View>
        <View style={[styles.cvStatusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.cvStatusText, { color: badge.fg }]}>{badge.label}</Text>
        </View>
      </View>

      {/* Card number + expiry */}
      <View style={styles.cvCardFooter}>
        <Text style={[styles.cvCardNumber, { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }]}>
          {card.card_number}
        </Text>
        <Text style={styles.cvExpiry}>
          {new Date(card.expires_at).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
        </Text>
      </View>

      {/* Balance PIN — shown on card so beneficiary can check balance */}
      {card.balance_pin ? (
        <View style={styles.cvPinRow}>
          <Text style={styles.cvPinLabel}>BALANCE PIN</Text>
          <Text style={[styles.cvPinValue, { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }]}>
            {card.balance_pin}
          </Text>
          <Text style={styles.cvPinHint}>  · Scan QR above to check balance</Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function GiftCardDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const topPad  = insets.top + (Platform.OS === "web" ? 67 : 0);

  const [card, setCard]     = useState<GiftCard | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Two-step share state ────────────────────────────────────────────────────
  const [converting, setConverting] = useState(false);  // step 1 spinner
  const [cardReady, setCardReady]   = useState(false);   // step 1 done
  const [cardBlob, setCardBlob]     = useState<Blob | null>(null);  // web PNG
  const [cardUri, setCardUri]       = useState<string | null>(null); // native URI
  const [sending, setSending]       = useState(false);   // step 2 spinner
  const [sent, setSent]             = useState(false);   // "Card Delivered ✓"

  const cardRef = useRef<View>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const url = isUuid
        ? `${API}/roam/gift-cards/by-id/${id}`
        : `${API}/roam/gift-cards/${id}`;
      const r = await fetch(url);
      const j = await r.json();
      setCard(j.card ?? null);
    } catch {
      setCard(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── STEP 1: Convert card to PNG and store it ──────────────────────────────
  async function convertToPng() {
    if (!card || converting) return;
    setConverting(true);
    setCardReady(false);
    setCardBlob(null);
    setCardUri(null);
    setSent(false);
    try {
      if (Platform.OS !== "web") {
        // Native (iOS / Android): use react-native-view-shot
        if (!cardRef.current) return;
        const uri = await captureRef(cardRef, { format: "jpg", quality: 0.97, result: "tmpfile" });
        setCardUri(uri);
        setCardReady(true);
      } else {
        // Web: use html2canvas
        if (!cardRef.current) return;
        const h2c = (await import("html2canvas")).default;
        const canvas = await h2c(cardRef.current as unknown as HTMLElement, {
          backgroundColor: null,
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const blob = await new Promise<Blob | null>((res) => {
          canvas.toBlob((b) => res(b), "image/png", 0.97);
        });
        if (blob) { setCardBlob(blob); setCardReady(true); }
      }
    } catch {
      /* ignore — cardReady stays false, user can try again */
    } finally {
      setConverting(false);
    }
  }

  // ── STEP 2: Send the stored PNG to WhatsApp ────────────────────────────────
  async function sendViaWhatsApp() {
    if (!card || !cardReady || sending) return;
    setSending(true);
    const waMsg = buildShareMessage(card, sym);
    try {
      if (Platform.OS !== "web" && cardUri) {
        // Native: open system share sheet with the image file
        await Share.share({ url: cardUri, message: waMsg });
        setSent(true);
      } else if (cardBlob) {
        // Web: download the PNG, then open WhatsApp Web pre-filled
        const filename = `roam-gift-card-${card.card_number}.png`;
        const objUrl   = URL.createObjectURL(cardBlob);
        const a = document.createElement("a");
        a.href = objUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(objUrl);

        const phone  = card.beneficiary_phone?.replace(/\D/g, "") ?? "";
        const waUrl  = phone
          ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(waMsg)}`
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(waMsg)}`;
        window.open(waUrl, "_blank");
        setSent(true);
      }
    } catch {} finally {
      setSending(false);
    }
  }

  function buildShareMessage(c: GiftCard, s: string): string {
    const expiry = new Date(c.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "payos.com";
    const balanceUrl = `https://${domain}/gift-card/check?card=${encodeURIComponent(c.card_number)}`;
    return [
      `🎁 *You've received a Roam Shopping Gift Card!*`,
      ``,
      `*Store:* ${c.logo_emoji} ${c.partner_name}`,
      `*Gift Amount:* ${s}${Number(c.face_value).toLocaleString()}`,
      c.personal_message ? `*Message:* "${c.personal_message}"` : "",
      ``,
      `*Card Number:* ${c.card_number}`,
      `*Valid Until:* ${expiry}`,
      ``,
      `📍 *How to use:*`,
      `1. Go to any ${c.partner_name} store`,
      `2. Shop and proceed to the cashier`,
      `3. Tell the cashier: "Roam Gift Card"`,
      `4. Give them your card number: *${c.card_number}*`,
      `5. They scan or enter it — amount deducted instantly`,
      `6. Any *unused balance stays on the card* — spend it later!`,
      ``,
      `💰 *Check your remaining balance — privately:*`,
      `Tap the QR code on your card or visit:`,
      `${balanceUrl}`,
      ``,
      `*Balance PIN:* ${c.balance_pin}`,
      `_(Your PIN is private — the sender cannot check your balance)_`,
      ``,
      `Powered by Roam by PayOs`,
    ].filter(Boolean).join("\n");
  }

  const sym = card?.currency === "NGN" ? "₦" : card?.currency === "GHS" ? "₵" : card?.currency === "KES" ? "KSh" : "R";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card }]}>
        <Pressable
          onPress={() => {
            // router.back() is unreliable when arriving via router.replace.
            // Always navigate explicitly to the gift card list.
            if (router.canGoBack()) router.back();
            else router.replace("/gift-card");
          }}
          style={styles.backBtn}
        >
          <Text style={[styles.backText, { color: colors.text }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Gift Card</Text>
        <Pressable onPress={load} style={styles.refreshBtn}>
          <RefreshCw size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#EC4899" size="large" />
        </View>
      ) : !card ? (
        <CardLoadedFromState id={id ?? ""} colors={colors} sym={sym} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        >
          {/* Wrap card in a ref'd view so we can capture it as an image */}
          <View ref={cardRef} collapsable={false}>
            <GiftCardVisual card={card} />
          </View>

          {/* Balance bar */}
          <BalanceSection card={card} sym={sym} colors={colors} />

          {/* Details */}
          <View style={[styles.detailBox, { backgroundColor: colors.card }]}>
            <DetailRow label="Beneficiary"   value={card.beneficiary_name}     colors={colors} />
            {card.beneficiary_phone && <DetailRow label="Phone" value={card.beneficiary_phone} colors={colors} />}
            <DetailRow label="Valid at"     value={card.partner_name}           colors={colors} />
            <DetailRow label="Issued"       value={new Date(card.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} colors={colors} />
            <DetailRow label="Expires"      value={new Date(card.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} colors={colors} />
          </View>

          {/* How to use */}
          <View style={[styles.howToBox, { backgroundColor: "#FDF2F8" }]}>
            <Text style={[styles.howToTitle, { color: "#9D174D" }]}>How to use this card</Text>
            <Text style={styles.howToText}>
              1. Go to any {card.partner_name} store{card.partner_city ? ` in ${card.partner_city}` : ""}.{"\n"}
              2. Shop and proceed to the cashier counter.{"\n"}
              3. Tell the cashier you're paying with a Roam Gift Card.{"\n"}
              4. Share card number <Text style={{ fontWeight: "700" }}>{card.card_number}</Text> or let them scan it.{"\n"}
              5. The amount is instantly deducted. Any unused balance stays on the card.
            </Text>
          </View>

          {/* QR Code for cashier scan */}
          <View style={[styles.qrBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.qrTitle, { color: colors.text }]}>Cashier Scan Code</Text>
            <Text style={[styles.qrSub, { color: colors.mutedForeground }]}>
              Show this to the cashier or let them type the number
            </Text>
            <View style={styles.qrImageWrap}>
              <Image
                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(card.card_number)}&bgcolor=132144&color=EC4899&qzone=2&format=png` }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.cardNumberLarge, { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", color: "#EC4899" }]}>
              {card.card_number}
            </Text>
          </View>

          {/* ── Two-step share UI ─────────────────────────────────────────── */}
          <View style={styles.shareStepsBox}>
            <Text style={styles.shareStepsTitle}>Share this Gift Card</Text>

            {/* STEP 1 — Convert to PNG */}
            <Pressable
              onPress={convertToPng}
              disabled={converting}
              style={[
                styles.stepBtn,
                cardReady ? styles.stepBtnDone : styles.stepBtnPrimary,
                converting && { opacity: 0.6 },
              ]}
            >
              {converting ? (
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              ) : cardReady ? (
                <CheckCircle size={18} color="#fff" style={{ marginRight: 8 }} />
              ) : (
                <ImageIcon size={18} color="#fff" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.stepBtnText}>
                {converting ? "Converting to PNG…" : cardReady ? "PNG Ready ✓  (tap to regenerate)" : "Step 1 — Convert Card to PNG"}
              </Text>
            </Pressable>

            {/* STEP 2 — Send via WhatsApp (unlocked after step 1) */}
            <Pressable
              onPress={sendViaWhatsApp}
              disabled={!cardReady || sending || sent}
              style={[
                styles.stepBtn,
                styles.stepBtnWhatsApp,
                (!cardReady || sent) && styles.stepBtnLocked,
                sending && { opacity: 0.6 },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              ) : sent ? (
                <CheckCircle size={18} color="#fff" style={{ marginRight: 8 }} />
              ) : (
                <MessageCircle size={18} color={cardReady ? "#fff" : "rgba(255,255,255,0.4)"} style={{ marginRight: 8 }} />
              )}
              <Text style={[styles.stepBtnText, !cardReady && { color: "rgba(255,255,255,0.4)" }]}>
                {sending ? "Opening WhatsApp…"
                  : sent    ? "Card Delivered ✓"
                  : cardReady
                    ? (card.beneficiary_phone ? `Step 2 — Send to ${card.beneficiary_name} via WhatsApp` : "Step 2 — Send via WhatsApp")
                    : "Step 2 — Send via WhatsApp (convert first)"}
              </Text>
            </Pressable>

            {/* Delivered banner */}
            {sent && (
              <View style={styles.deliveredBanner}>
                <Text style={styles.deliveredText}>
                  🎉 Gift card sent!{Platform.OS === "web" ? " The image was downloaded and WhatsApp Web has opened." : " The image was shared via your device."}
                </Text>
                <Pressable onPress={() => { setSent(false); setCardReady(false); setCardBlob(null); setCardUri(null); }}>
                  <Text style={styles.deliveredReset}>Send again</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// After purchase, card data comes from the navigation state (router.replace with card in params)
// Fallback: show a placeholder with the ID
function CardLoadedFromState({ id, colors, sym }: { id: string; colors: any; sym: string }) {
  return (
    <View style={styles.center}>
      <View style={[styles.fallbackCard, { backgroundColor: colors.card }]}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🎁</Text>
        <Text style={[{ fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 8 }]}>
          Gift Card Sent!
        </Text>
        <Text style={[{ fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 20, marginBottom: 16 }]}>
          Your gift card has been created and the funds are being held safely.
        </Text>
        <View style={[styles.cardNumberBox, { backgroundColor: "#F3E8FF" }]}>
          <Text style={{ fontWeight: "700", color: "#7C3AED", fontSize: 12, marginBottom: 4 }}>
            CARD NUMBER
          </Text>
          <Text style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 14, color: "#7C3AED" }}>
            {id.length > 20 ? "View card list for details" : id}
          </Text>
        </View>
        <Pressable
          onPress={() => router.replace("/gift-card")}
          style={{ backgroundColor: "#EC4899", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, marginTop: 16 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>View My Gift Cards</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BalanceSection({ card, sym, colors }: { card: GiftCard; sym: string; colors: any }) {
  const faceVal   = Number(card.face_value);
  const redeemed  = Number(card.redeemed_amount);
  const remaining = Number(card.remaining_balance);
  const pct = faceVal > 0 ? Math.max(0, (remaining / faceVal) * 100) : 0;

  return (
    <View style={[styles.balanceBox, { backgroundColor: colors.card }]}>
      <View style={styles.balanceRow}>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Loaded</Text>
          <Text style={[styles.balanceValue, { color: colors.text }]}>{sym}{faceVal.toLocaleString()}</Text>
        </View>
        <View style={styles.balanceSep} />
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Used</Text>
          <Text style={[styles.balanceValue, { color: "#EF4444" }]}>{sym}{redeemed.toLocaleString()}</Text>
        </View>
        <View style={styles.balanceSep} />
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Remaining</Text>
          <Text style={[styles.balanceValue, { color: "#10B981" }]}>{sym}{remaining.toLocaleString()}</Text>
        </View>
      </View>
      <View style={[styles.progressBg, { backgroundColor: colors.border, marginTop: 12 }]}>
        <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: "#10B981" }]} />
      </View>
    </View>
  );
}

function DetailRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  backBtn:         { marginRight: 8 },
  backText:        { fontSize: 15, fontWeight: "500" },
  headerTitle:     { flex: 1, fontSize: 18, fontWeight: "700", textAlign: "center" },
  refreshBtn:      { padding: 4 },
  center:          { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  // Gift card visual — navy blue
  cardVisual:      { borderRadius: 24, padding: 22, paddingBottom: 18, minHeight: 290, overflow: "hidden", marginBottom: 16, position: "relative" },
  glowTopRight:      { position: "absolute", width: 300, height: 300, borderRadius: 150, top: -120, right: -100, backgroundColor: "rgba(255,255,255,0.10)" },
  glowTopRightInner: { position: "absolute", width: 160, height: 160, borderRadius: 80,  top: -60,  right: -40,  backgroundColor: "rgba(255,255,255,0.08)" },
  accentGlow:        { position: "absolute", width: 260, height: 260, borderRadius: 130, bottom: -80, left: -80 },
  goldLine:          { position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(212,175,55,0.7)" },
  cvTopRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  cvBrand:         { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 4, textTransform: "uppercase" },
  cvSubBrand:      { color: "rgba(255,255,255,0.5)", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 3 },
  // In-card QR code (top-right, captured in PNG)
  cvQrWrap:        { width: 68, height: 68, borderRadius: 8, backgroundColor: "#ffffff", padding: 3, marginLeft: 10, elevation: 4 },
  cvQrImage:       { width: 62, height: 62, borderRadius: 6 },
  cvQrHint:        { color: "rgba(255,255,255,0.45)", fontSize: 8, textAlign: "center", marginTop: 4, lineHeight: 11, letterSpacing: 0.3 },
  // Partner pill
  partnerPill:     { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 16 },
  partnerPillText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  // Amount
  cvAmount:        { color: "#fff", fontSize: 46, fontWeight: "900", letterSpacing: -2, lineHeight: 52 },
  remainingRow:    { marginTop: 6, marginBottom: 2 },
  remainingBar:    { height: 3, backgroundColor: "rgba(125,211,252,0.7)", borderRadius: 2, marginBottom: 4 },
  cvRemaining:     { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  cvMessage:       { color: "rgba(255,255,255,0.7)", fontSize: 12, fontStyle: "italic", marginTop: 8, lineHeight: 18 },
  // Divider
  cvDivider:       { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 14 },
  // Beneficiary + status
  cvBeneficiaryRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 },
  cvBeneficiaryLabel: { color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  cvBeneficiaryName:  { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 3, letterSpacing: -0.3 },
  cvStatusBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  cvStatusText:    { fontSize: 10, fontWeight: "700" },
  // Card footer
  cvCardFooter:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cvCardNumber:    { color: "rgba(255,255,255,0.7)", fontSize: 12, letterSpacing: 2 },
  cvExpiry:        { color: "rgba(255,255,255,0.6)", fontSize: 12, letterSpacing: 1 },
  // Balance PIN row
  cvPinRow:        { flexDirection: "row", alignItems: "center", marginTop: 10, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  cvPinLabel:      { color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", marginRight: 8 },
  cvPinValue:      { color: "#7DD3FC", fontSize: 15, fontWeight: "800", letterSpacing: 4 },
  cvPinHint:       { color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: 0.5, marginLeft: 2 },
  // Balance
  balanceBox:      { borderRadius: 16, padding: 16, marginBottom: 16 },
  balanceRow:      { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  balanceLabel:    { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  balanceValue:    { fontSize: 18, fontWeight: "800" },
  balanceSep:      { width: 1, height: 40, backgroundColor: "rgba(0,0,0,0.08)" },
  progressBg:      { height: 6, borderRadius: 6, overflow: "hidden" },
  progressFill:    { height: 6, borderRadius: 6 },
  // Details
  detailBox:       { borderRadius: 16, padding: 16, marginBottom: 16 },
  howToBox:        { borderRadius: 16, padding: 16, marginBottom: 16 },
  howToTitle:      { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  howToText:       { fontSize: 13, lineHeight: 22, color: "#831843" },
  fallbackCard:    { borderRadius: 20, padding: 28, alignItems: "center", width: "100%" },
  cardNumberBox:   { borderRadius: 12, padding: 14, alignItems: "center", width: "100%" },
  // QR code
  qrBox:           { borderRadius: 16, padding: 16, marginBottom: 16, alignItems: "center" },
  qrTitle:         { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  qrSub:           { fontSize: 12, marginBottom: 14, textAlign: "center" },
  qrImageWrap:     { width: 180, height: 180, marginBottom: 12 },
  qrImage:         { width: 180, height: 180 },
  cardNumberLarge: { fontSize: 16, letterSpacing: 3, fontWeight: "600" },
  // Two-step share panel
  shareStepsBox:   { borderRadius: 18, backgroundColor: "#1A1A2E", padding: 18, marginBottom: 16 },
  shareStepsTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 14, letterSpacing: 0.2 },
  stepBtn:         { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16, marginBottom: 10, justifyContent: "center" },
  stepBtnPrimary:  { backgroundColor: "#EC4899" },
  stepBtnDone:     { backgroundColor: "#10B981" },
  stepBtnWhatsApp: { backgroundColor: "#25D366" },
  stepBtnLocked:   { backgroundColor: "#374151", opacity: 0.65 },
  stepBtnText:     { color: "#fff", fontWeight: "700", fontSize: 14, flexShrink: 1, textAlign: "center" },
  // Delivered banner
  deliveredBanner: { backgroundColor: "#D1FAE5", borderRadius: 12, padding: 14, marginTop: 4, alignItems: "center" },
  deliveredText:   { color: "#065F46", fontSize: 13, lineHeight: 20, fontWeight: "500", textAlign: "center", marginBottom: 8 },
  deliveredReset:  { color: "#059669", fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
});
