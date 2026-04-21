import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  Phone,
  PlusCircle,
  Share2,
  ShoppingBag,
  X,
  XCircle,
  Zap,
} from "lucide-react-native";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Transaction, TxType } from "@/context/RoamContext";
import { useColors } from "@/hooks/useColors";

/* ── icon + color map ─────────────────────────────────────────────────────── */
const TX_META: Record<TxType, { label: string; icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; color: string }> = {
  send:    { label: "Money Sent",      icon: ArrowUpRight,   color: "#F97316" },
  receive: { label: "Money Received",  icon: ArrowDownLeft,  color: "#10B981" },
  pay:     { label: "Payment",         icon: ShoppingBag,    color: "#6366F1" },
  card:    { label: "Card Payment",    icon: CreditCard,     color: "#8B5CF6" },
  airtime: { label: "Airtime Top-up",  icon: Phone,          color: "#3B82F6" },
  bills:   { label: "Bill Payment",    icon: Zap,            color: "#F59E0B" },
  fund:    { label: "Wallet Funding",  icon: PlusCircle,     color: "#10B981" },
  convert: { label: "Conversion",      icon: ArrowLeftRight, color: "#0EA5E9" },
};

/* ── helpers ──────────────────────────────────────────────────────────────── */
function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true });
  return { date, time };
}

function shortRef(id: string) {
  return id.replace(/-/g, "").slice(0, 16).toUpperCase();
}

/* ── dashed divider ───────────────────────────────────────────────────────── */
function DashedDivider({ color }: { color: string }) {
  return (
    <View style={[s.dashedWrap]}>
      {Array.from({ length: 26 }).map((_, i) => (
        <View key={i} style={[s.dash, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

/* ── receipt row ──────────────────────────────────────────────────────────── */
function Row({ label, value, valueColor, colors }: {
  label: string; value: string; valueColor?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[s.rowValue, { color: valueColor ?? colors.foreground }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/* ── main component ───────────────────────────────────────────────────────── */
interface Props {
  transaction: Transaction | null;
  visible: boolean;
  onClose: () => void;
}

export function TransactionReceipt({ transaction: tx, visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (!tx) return null;

  const meta      = TX_META[tx.type] ?? TX_META.send;
  const IconComp  = meta.icon;
  const isCredit  = tx.amount > 0;
  const absAmt    = Math.abs(tx.amount);
  const { date, time } = formatDateTime(tx.date);
  const ref       = shortRef(tx.id);

  async function handleShare() {
    if (!tx) return;
    const sign    = isCredit ? "+" : "-";
    const amtFmt  = `${sign}${tx.symbol}${absAmt.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
    const message = [
      `━━━━━━━━━━━━━━━━━━━━━`,
      `   ROAM BY PAYOS`,
      `   TRANSACTION RECEIPT`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `  ${meta.label}`,
      `  Amount  : ${amtFmt}`,
      `  Status  : ${(tx.status ?? "").toUpperCase()}`,
      ``,
      `  Ref No. : ${ref}`,
      `  Date    : ${date}`,
      `  Time    : ${time}`,
      `  Desc    : ${tx.subtitle ?? ""}`,
      `  Fee     : ${tx.symbol ?? ""}0.00`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `  Powered by PayOs`,
      `  payosng.com`,
      `━━━━━━━━━━━━━━━━━━━━━`,
    ].join("\n");

    try {
      await Share.share({ message, title: "Roam by PayOs — Transaction Receipt" });
    } catch {
      // user cancelled or share not supported — do nothing
    }
  }

  const statusColor =
    tx.status === "completed" ? colors.success :
    tx.status === "pending"   ? colors.warning :
    colors.destructive;

  const StatusIcon =
    tx.status === "completed" ? CheckCircle2 :
    tx.status === "pending"   ? Clock3 :
    XCircle;

  const statusLabel =
    tx.status === "completed" ? "Completed" :
    tx.status === "pending"   ? "Pending"   :
    "Failed";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* scrim */}
      <Pressable style={s.scrim} onPress={onClose} />

      <View style={[s.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>
        {/* drag handle */}
        <View style={[s.handle, { backgroundColor: colors.border }]} />

        {/* close */}
        <Pressable onPress={onClose} style={[s.closeBtn, { backgroundColor: colors.card }]}>
          <X size={18} color={colors.mutedForeground} strokeWidth={2} />
        </Pressable>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 0 }}>

          {/* status circle */}
          <View style={s.heroSection}>
            <View style={[s.statusRing, { borderColor: statusColor + "30", backgroundColor: statusColor + "15" }]}>
              <View style={[s.statusInner, { backgroundColor: statusColor + "25" }]}>
                <StatusIcon size={36} color={statusColor} strokeWidth={1.5} />
              </View>
            </View>
            <Text style={[s.heroLabel, { color: colors.mutedForeground }]}>{meta.label}</Text>
            <Text style={[s.heroAmount, { color: isCredit ? colors.success : colors.foreground }]}>
              {isCredit ? "+" : "-"}{tx.symbol}{absAmt.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[s.heroSub, { color: colors.mutedForeground }]}>{tx.title}</Text>
          </View>

          {/* receipt body */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

            {/* receipt label */}
            <View style={s.receiptLabelRow}>
              <View style={[s.receiptLine, { backgroundColor: colors.border }]} />
              <Text style={[s.receiptLabel, { color: colors.mutedForeground }]}>RECEIPT</Text>
              <View style={[s.receiptLine, { backgroundColor: colors.border }]} />
            </View>

            {/* rows */}
            <View style={s.rows}>
              <Row label="Reference No."  value={ref}           colors={colors} />
              <Row label="Date"           value={date}          colors={colors} />
              <Row label="Time"           value={time}          colors={colors} />
              <Row label="Type"           value={meta.label}    colors={colors} />
              <Row label="Description"    value={tx.subtitle}   colors={colors} />
            </View>

            <DashedDivider color={colors.border} />

            {/* status row */}
            <View style={[s.row, { paddingVertical: 14 }]}>
              <Text style={[s.rowLabel, { color: colors.mutedForeground }]}>Status</Text>
              <View style={s.statusPill}>
                <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>

            {/* amount breakdown */}
            <View style={[s.amountBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={s.row}>
                <Text style={[s.rowLabel, { color: colors.mutedForeground }]}>Amount</Text>
                <Text style={[s.rowValue, { color: colors.foreground }]}>
                  {tx.symbol}{absAmt.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={[s.thinDivider, { backgroundColor: colors.border }]} />
              <View style={s.row}>
                <Text style={[s.rowLabel, { color: colors.mutedForeground }]}>Fee</Text>
                <Text style={[s.rowValue, { color: colors.mutedForeground }]}>{tx.symbol}0.00</Text>
              </View>
              <View style={[s.thinDivider, { backgroundColor: colors.border }]} />
              <View style={s.row}>
                <Text style={[s.totalLabel, { color: colors.foreground }]}>Total</Text>
                <Text style={[s.totalValue, { color: isCredit ? colors.success : colors.foreground }]}>
                  {isCredit ? "+" : "-"}{tx.symbol}{absAmt.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* type badge */}
            <View style={[s.typeBadge, { backgroundColor: meta.color + "15" }]}>
              <IconComp size={14} color={meta.color} strokeWidth={2} />
              <Text style={[s.typeBadgeText, { color: meta.color }]}>Powered by PayOs · {tx.currency}</Text>
            </View>
          </View>

          {/* actions */}
          <View style={s.actions}>
            <Pressable
              style={[s.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleShare}
            >
              <Share2 size={16} color={colors.foreground} strokeWidth={2} />
              <Text style={[s.shareBtnText, { color: colors.foreground }]}>Share Receipt</Text>
            </Pressable>
            <Pressable style={[s.doneBtn, { backgroundColor: colors.primary }]} onPress={onClose}>
              <Text style={s.doneBtnText}>Done</Text>
            </Pressable>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet:   {
    position: "absolute", left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 20,
    maxHeight: "94%",
  },
  handle:  { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  closeBtn:{ position: "absolute", top: 20, right: 20, zIndex: 10, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },

  /* hero */
  heroSection: { alignItems: "center", paddingVertical: 8, gap: 6 },
  statusRing:  { width: 100, height: 100, borderRadius: 50, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statusInner: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  heroLabel:   { fontSize: 13, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  heroAmount:  { fontSize: 34, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  heroSub:     { fontSize: 13, fontFamily: "Inter_400Regular" },

  /* card */
  card:        { borderRadius: 20, borderWidth: 1, overflow: "hidden", marginTop: 16 },

  /* receipt label */
  receiptLabelRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  receiptLine:     { flex: 1, height: 1 },
  receiptLabel:    { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },

  /* rows */
  rows:      { paddingHorizontal: 16, gap: 0 },
  row:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 10, gap: 12 },
  rowLabel:  { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  rowValue:  { fontSize: 13, fontFamily: "Inter_500Medium", flex: 2, textAlign: "right" },

  /* dashed */
  dashedWrap:{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, marginVertical: 2, paddingHorizontal: 16 },
  dash:      { width: 4, height: 1.5, borderRadius: 1 },

  /* status */
  statusPill:{ flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText:{ fontSize: 13, fontFamily: "Inter_600SemiBold" },

  /* amount box */
  amountBox: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: "hidden" },
  thinDivider:{ height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  totalLabel:{ fontSize: 13, fontFamily: "Inter_700Bold", flex: 1 },
  totalValue:{ fontSize: 14, fontFamily: "Inter_700Bold", flex: 2, textAlign: "right" },

  /* type badge */
  typeBadge:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, marginHorizontal: 16, marginBottom: 16, borderRadius: 12 },
  typeBadgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  /* actions */
  actions:     { flexDirection: "row", gap: 12, marginTop: 16, marginBottom: 8 },
  shareBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 16, borderWidth: 1 },
  shareBtnText:{ fontSize: 14, fontFamily: "Inter_600SemiBold" },
  doneBtn:     { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 15, borderRadius: 16 },
  doneBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
