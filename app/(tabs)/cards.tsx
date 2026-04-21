import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronRight,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  Globe,
  Lock,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Smartphone,
  Wifi,
  Zap,
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useRoam } from "@/context/RoamContext";

const { width: SW } = Dimensions.get("window");
const CARD_W = Math.min(SW - 40, 380);

// ── Card definitions ──────────────────────────────────────────────────────────

interface CardDef {
  id: string;
  label: string;
  network: string;
  currency: string;
  symbol: string;
  number: string;
  expiry: string;
  cvv: string;
  type: "debit" | "credit" | "usd";
  gradient: [string, string];
  scheme: "visa" | "mastercard";
}

const BASE_CARDS: CardDef[] = [
  {
    id: "ngn",
    label: "Roam NGN Debit",
    network: "Visa Virtual",
    currency: "NGN",
    symbol: "₦",
    number: "4242 4242 4242 4242",
    expiry: "12/28",
    cvv: "473",
    type: "debit",
    gradient: ["#1D4ED8", "#1E3A8A"],
    scheme: "visa",
  },
  {
    id: "usd",
    label: "Roam USD Card",
    network: "Mastercard Virtual",
    currency: "USD",
    symbol: "$",
    number: "5399 1234 5678 9012",
    expiry: "09/27",
    cvv: "281",
    type: "usd",
    gradient: ["#0F172A", "#1E293B"],
    scheme: "mastercard",
  },
];

// ── Card spend mock transactions ─────────────────────────────────────────────

interface CardTx {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  symbol: string;
  date: string;
  cardId: string;
  logo: string;
}

const CARD_TXS: CardTx[] = [
  { id: "c1", merchant: "Netflix", category: "Streaming", amount: -4.99, currency: "USD", symbol: "$", date: new Date(Date.now() - 3600000).toISOString(), cardId: "usd", logo: "🎬" },
  { id: "c2", merchant: "Shopify Checkout", category: "Shopping", amount: -29.00, currency: "USD", symbol: "$", date: new Date(Date.now() - 86400000).toISOString(), cardId: "usd", logo: "🛒" },
  { id: "c3", merchant: "Amazon Prime", category: "Subscription", amount: -14.99, currency: "USD", symbol: "$", date: new Date(Date.now() - 86400000 * 2).toISOString(), cardId: "usd", logo: "📦" },
  { id: "c4", merchant: "Uber Nigeria", category: "Transport", amount: -1800, currency: "NGN", symbol: "₦", date: new Date(Date.now() - 7200000).toISOString(), cardId: "ngn", logo: "🚗" },
  { id: "c5", merchant: "Shoprite", category: "Groceries", amount: -12500, currency: "NGN", symbol: "₦", date: new Date(Date.now() - 86400000).toISOString(), cardId: "ngn", logo: "🛍️" },
  { id: "c6", merchant: "DSTV", category: "Entertainment", amount: -6200, currency: "NGN", symbol: "₦", date: new Date(Date.now() - 86400000 * 3).toISOString(), cardId: "ngn", logo: "📺" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function mask(num: string): string {
  return num.slice(0, 4) + " **** **** " + num.slice(-4);
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CardsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, balance, usdBalance, deductBalance, addTransaction } = useRoam();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = 90 + (Platform.OS === "web" ? 34 : 0);

  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [frozen, setFrozen] = useState<Record<string, boolean>>({});
  const [hasCards, setHasCards] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showRequesting, setShowRequesting] = useState(false);
  const [onlineEnabled, setOnlineEnabled] = useState<Record<string, boolean>>({ ngn: true, usd: true });
  const [atmEnabled, setAtmEnabled] = useState<Record<string, boolean>>({ ngn: false, usd: false });
  const [contactlessEnabled, setContactlessEnabled] = useState<Record<string, boolean>>({ ngn: true, usd: true });

  const flatListRef = useRef<FlatList>(null);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const card = BASE_CARDS[activeIdx]!;
  const isRevealed = revealed[card.id] ?? false;
  const isFrozen = frozen[card.id] ?? false;

  const cardBalance = card.currency === "USD"
    ? `$${usdBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `₦${balance.toLocaleString("en-NG")}`;

  const cardTxs = CARD_TXS.filter((t) => t.cardId === card.id);

  function vibrate() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function toggleReveal() {
    vibrate();
    setRevealed((r) => ({ ...r, [card.id]: !isRevealed }));
  }

  function toggleFreeze() {
    vibrate();
    const next = !isFrozen;
    setFrozen((f) => ({ ...f, [card.id]: next }));
    Alert.alert(next ? "Card Frozen" : "Card Unfrozen",
      next ? "All transactions on this card have been blocked." : "Your card is active again.");
  }

  async function copyNumber() {
    vibrate();
    await Clipboard.setStringAsync(card.number);
    Alert.alert("Copied", "Card number copied to clipboard.");
  }

  async function copyCvv() {
    vibrate();
    await Clipboard.setStringAsync(card.cvv);
    Alert.alert("Copied", "CVV copied to clipboard.");
  }

  function handleTopUp() {
    if (card.currency === "NGN") {
      const amt = 50000;
      if (balance < amt) { Alert.alert("Insufficient Balance", "Top up your wallet first."); return; }
      deductBalance(amt);
      addTransaction({ type: "card", title: "Card Top-Up", subtitle: "Roam NGN Debit Card", amount: -amt, currency: "NGN", symbol: "₦", status: "completed" });
      Alert.alert("Success", "₦50,000 moved to NGN card.");
    } else {
      Alert.alert("Top Up USD Card", "Convert NGN to USD in your wallet and the balance will reflect here automatically.");
    }
  }

  if (!hasCards) {
    return <EmptyState colors={colors} topPad={topPad} botPad={botPad} onRequest={() => { setHasCards(true); setShowRequesting(true); }} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad }}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>My Cards</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {BASE_CARDS.length} virtual {BASE_CARDS.length === 1 ? "card" : "cards"}
            </Text>
          </View>
          <Pressable
            onPress={() => setShowSettings(true)}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Settings size={18} color={colors.mutedForeground} strokeWidth={1.8} />
          </Pressable>
        </View>

        {/* ── Card Carousel ── */}
        <FlatList
          ref={flatListRef}
          data={BASE_CARDS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + 20));
            setActiveIdx(Math.min(Math.max(idx, 0), BASE_CARDS.length - 1));
          }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 20 }}
          snapToInterval={CARD_W + 20}
          decelerationRate="fast"
          renderItem={({ item }) => (
            <CardFace
              card={item}
              revealed={revealed[item.id] ?? false}
              frozen={frozen[item.id] ?? false}
              balance={item.currency === "USD"
                ? `$${usdBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                : `₦${balance.toLocaleString("en-NG")}`}
              userName={user?.name ?? "Card User"}
            />
          )}
          style={{ marginTop: 20 }}
        />

        {/* ── Dots ── */}
        {BASE_CARDS.length > 1 && (
          <View style={styles.dots}>
            {BASE_CARDS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, {
                  backgroundColor: i === activeIdx ? colors.primary : colors.border,
                  width: i === activeIdx ? 20 : 6,
                }]}
              />
            ))}
          </View>
        )}

        {/* ── Freeze banner ── */}
        {isFrozen && (
          <View style={[styles.frozenBanner, { backgroundColor: "#EF444420", borderColor: "#EF4444" }]}>
            <Lock size={14} color="#EF4444" strokeWidth={2} />
            <Text style={[styles.frozenText, { color: "#EF4444" }]}>This card is frozen — all transactions are blocked</Text>
          </View>
        )}

        {/* ── Action row ── */}
        <View style={styles.actions}>
          <ActionBtn Icon={isRevealed ? EyeOff : Eye} label={isRevealed ? "Hide" : "Reveal"} color={colors.primary} onPress={toggleReveal} colors={colors} />
          <ActionBtn Icon={isFrozen ? PlayCircle : PauseCircle} label={isFrozen ? "Unfreeze" : "Freeze"} color="#3B82F6" onPress={toggleFreeze} colors={colors} />
          <ActionBtn Icon={RefreshCw} label="Top Up" color={colors.success ?? "#16A34A"} onPress={handleTopUp} colors={colors} />
          <ActionBtn Icon={Plus} label="New Card" color="#8B5CF6" onPress={() => Alert.alert("Request Card", "You can have up to 3 virtual cards. This feature is coming soon.")} colors={colors} />
        </View>

        {/* ── Card Details ── */}
        <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <DetailRow label="Card Type" value={card.network} colors={colors} />
          <DetailRow
            label="Card Number"
            value={isRevealed ? card.number : mask(card.number)}
            onCopy={isRevealed ? copyNumber : undefined}
            colors={colors}
          />
          <DetailRow
            label="Expiry"
            value={isRevealed ? card.expiry : "••/••"}
            colors={colors}
          />
          <DetailRow
            label="CVV"
            value={isRevealed ? card.cvv : "•••"}
            onCopy={isRevealed ? copyCvv : undefined}
            colors={colors}
          />
          <DetailRow
            label="Billing"
            value="Online Use Only"
            colors={colors}
          />
          <DetailRow
            label="Status"
            value={isFrozen ? "Frozen" : "Active"}
            valueColor={isFrozen ? "#EF4444" : colors.success ?? "#16A34A"}
            colors={colors}
            last
          />
        </View>

        {/* ── Spend controls ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Spend Controls</Text>
          <ControlRow
            Icon={Globe}
            label="Online Purchases"
            sub="e-commerce & international"
            value={onlineEnabled[card.id] ?? true}
            onChange={(v) => setOnlineEnabled((p) => ({ ...p, [card.id]: v }))}
            colors={colors}
            accent={colors.primary}
          />
          <ControlRow
            Icon={Smartphone}
            label="Contactless / NFC"
            sub="tap to pay"
            value={contactlessEnabled[card.id] ?? true}
            onChange={(v) => setContactlessEnabled((p) => ({ ...p, [card.id]: v }))}
            colors={colors}
            accent={colors.primary}
          />
          <ControlRow
            Icon={Zap}
            label="ATM Withdrawals"
            sub="physical cash withdrawals"
            value={atmEnabled[card.id] ?? false}
            onChange={(v) => setAtmEnabled((p) => ({ ...p, [card.id]: v }))}
            colors={colors}
            accent={colors.primary}
            last
          />
        </View>

        {/* ── Security features ── */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Security</Text>
          <SecurityRow Icon={Shield} label="3D Secure (3DS)" value="Enabled" colors={colors} />
          <SecurityRow Icon={BadgeCheck} label="PIN Protection" value="Required" colors={colors} />
          <SecurityRow Icon={AlertTriangle} label="Fraud Alerts" value="On" colors={colors} last />
        </View>

        {/* ── Card transactions ── */}
        <View style={styles.txSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 20 }]}>
            Card Transactions
          </Text>
          {cardTxs.length === 0 ? (
            <View style={[styles.emptyTx, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <CreditCard size={28} color={colors.mutedForeground} strokeWidth={1.5} />
              <Text style={[styles.emptyTxText, { color: colors.mutedForeground }]}>No transactions yet</Text>
            </View>
          ) : (
            <View style={[styles.txList, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {cardTxs.map((tx, i) => (
                <CardTxRow key={tx.id} tx={tx} colors={colors} last={i === cardTxs.length - 1} />
              ))}
            </View>
          )}
        </View>

        {/* ── Notice ── */}
        <View style={[styles.notice, { backgroundColor: colors.muted ?? colors.card, borderColor: colors.border }]}>
          <DollarSign size={13} color={colors.mutedForeground} strokeWidth={2} />
          <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
            All online purchases are deducted from your {card.currency} wallet in real time.
            FX conversion is applied automatically for cross-currency merchants.
          </Text>
        </View>
      </ScrollView>

      {/* ── Card Settings Modal ── */}
      <CardSettingsModal
        visible={showSettings}
        card={card}
        onClose={() => setShowSettings(false)}
        colors={colors}
      />
    </View>
  );
}

// ── Card face ─────────────────────────────────────────────────────────────────

function CardFace({
  card, revealed, frozen, balance, userName,
}: {
  card: CardDef; revealed: boolean; frozen: boolean; balance: string; userName: string;
}) {
  return (
    <View style={[styles.card, { width: CARD_W, backgroundColor: card.gradient[0] }]}>
      {frozen && (
        <View style={styles.frozenOverlay}>
          <Lock size={32} color="rgba(255,255,255,0.9)" strokeWidth={1.8} />
          <Text style={styles.frozenOverlayText}>FROZEN</Text>
        </View>
      )}

      {/* Top row */}
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.cardLabel2}>ROAM</Text>
          <Text style={styles.cardNetwork}>{card.network}</Text>
        </View>
        <Wifi size={22} color="rgba(255,255,255,0.5)" strokeWidth={1.6} />
      </View>

      {/* Balance */}
      <View style={styles.cardBalRow}>
        <Text style={styles.cardBalLabel}>Available Balance</Text>
        <Text style={styles.cardBal}>{balance}</Text>
      </View>

      {/* Card number */}
      <Text style={styles.cardNumber}>
        {revealed ? card.number : mask(card.number)}
      </Text>

      {/* Bottom row */}
      <View style={styles.cardBottom}>
        <View>
          <Text style={styles.cardMeta}>CARD HOLDER</Text>
          <Text style={styles.cardMetaVal}>{userName.toUpperCase().slice(0, 22)}</Text>
        </View>
        <View>
          <Text style={styles.cardMeta}>EXPIRES</Text>
          <Text style={styles.cardMetaVal}>{revealed ? card.expiry : "••/••"}</Text>
        </View>
        {card.scheme === "visa" ? (
          <Text style={styles.schemeBadgeVisa}>VISA</Text>
        ) : (
          <View style={styles.mcWrap}>
            <View style={[styles.mcCircle, { backgroundColor: "#EB001B", marginRight: -10 }]} />
            <View style={[styles.mcCircle, { backgroundColor: "#F79E1B" }]} />
          </View>
        )}
      </View>

      {/* Decoration circles */}
      <View style={styles.decCircle1} />
      <View style={styles.decCircle2} />
    </View>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({
  Icon, label, color, onPress, colors,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string; color: string; onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + "1A" }]}>
        <Icon size={18} color={color} strokeWidth={1.8} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

// ── Detail row ────────────────────────────────────────────────────────────────

function DetailRow({
  label, value, valueColor, onCopy, last, colors,
}: {
  label: string; value: string; valueColor?: string; onCopy?: () => void; last?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.detailRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[styles.detailValue, { color: valueColor ?? colors.foreground }]}>{value}</Text>
        {onCopy && (
          <Pressable onPress={onCopy} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Text style={{ fontSize: 11, color: colors.primary, fontFamily: "Inter_500Medium" }}>Copy</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Control row (toggle) ──────────────────────────────────────────────────────

function ControlRow({
  Icon, label, sub, value, onChange, colors, accent, last,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string; sub: string; value: boolean; onChange: (v: boolean) => void;
  colors: ReturnType<typeof useColors>; accent: string; last?: boolean;
}) {
  return (
    <View style={[styles.controlRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={[styles.controlIcon, { backgroundColor: accent + "18" }]}>
        <Icon size={15} color={accent} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.controlLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.controlSub, { color: colors.mutedForeground }]}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: accent + "60" }}
        thumbColor={value ? accent : "#9CA3AF"}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

// ── Security row ──────────────────────────────────────────────────────────────

function SecurityRow({
  Icon, label, value, colors, last,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string; value: string;
  colors: ReturnType<typeof useColors>; last?: boolean;
}) {
  return (
    <View style={[styles.secRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Icon size={15} color={colors.success ?? "#16A34A"} strokeWidth={2} />
      <Text style={[styles.secLabel, { color: colors.foreground }]}>{label}</Text>
      <Text style={[styles.secValue, { color: colors.success ?? "#16A34A" }]}>{value}</Text>
    </View>
  );
}

// ── Card transaction row ──────────────────────────────────────────────────────

function CardTxRow({ tx, colors, last }: { tx: CardTx; colors: ReturnType<typeof useColors>; last: boolean }) {
  return (
    <View style={[styles.txRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={[styles.txIcon, { backgroundColor: colors.muted ?? colors.background }]}>
        <Text style={{ fontSize: 18 }}>{tx.logo}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.txMerchant, { color: colors.foreground }]}>{tx.merchant}</Text>
        <Text style={[styles.txCat, { color: colors.mutedForeground }]}>{tx.category} · {fmtDate(tx.date)}</Text>
      </View>
      <Text style={[styles.txAmount, { color: tx.amount < 0 ? "#EF4444" : "#16A34A" }]}>
        {tx.amount < 0 ? "-" : "+"}{tx.symbol}{Math.abs(tx.amount).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ colors, topPad, botPad, onRequest }: {
  colors: ReturnType<typeof useColors>; topPad: number; botPad: number; onRequest: () => void;
}) {
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>My Cards</Text>
      </View>
      <ScrollView contentContainerStyle={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: botPad }}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <CreditCard size={40} color={colors.mutedForeground} strokeWidth={1.5} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No virtual card yet</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
          Request a virtual Visa or Mastercard to pay online, subscribe to services, and shop globally in any currency.
        </Text>
        <Pressable
          onPress={onRequest}
          style={({ pressed }) => [styles.createBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Plus size={18} color="#fff" strokeWidth={2} />
          <Text style={styles.createBtnText}>Request Virtual Card</Text>
        </Pressable>
        <View style={[styles.perksRow, { borderColor: colors.border }]}>
          <Perk emoji="🌍" text="Pay in 180+ countries" colors={colors} />
          <Perk emoji="🔒" text="3D Secure protected" colors={colors} />
          <Perk emoji="⚡" text="Instant issuance" colors={colors} />
        </View>
      </ScrollView>
    </View>
  );
}

function Perk({ emoji, text, colors }: { emoji: string; text: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ alignItems: "center", gap: 4, flex: 1 }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: "center", fontFamily: "Inter_400Regular" }}>{text}</Text>
    </View>
  );
}

// ── Card settings modal ───────────────────────────────────────────────────────

function CardSettingsModal({ visible, card, onClose, colors }: {
  visible: boolean; card: CardDef; onClose: () => void; colors: ReturnType<typeof useColors>;
}) {
  const items = [
    { label: "Report Card Lost / Stolen", icon: "🚨", danger: true },
    { label: "Change PIN", icon: "🔑", danger: false },
    { label: "View Statement", icon: "📄", danger: false },
    { label: "Set Spending Limit", icon: "💳", danger: false },
    { label: "Request Physical Card", icon: "📮", danger: false },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop} />
      </TouchableWithoutFeedback>
      <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>Card Settings</Text>
        <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>{card.label}</Text>
        {items.map((item, i) => (
          <Pressable
            key={i}
            onPress={() => { onClose(); setTimeout(() => Alert.alert(item.label, "This feature is coming soon."), 400); }}
            style={({ pressed }) => [styles.modalItem, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ fontSize: 20 }}>{item.icon}</Text>
            <Text style={[styles.modalItemText, { color: item.danger ? "#EF4444" : colors.foreground }]}>{item.label}</Text>
            <ChevronRight size={16} color={colors.mutedForeground} strokeWidth={1.8} />
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  // Card
  card: { borderRadius: 22, padding: 22, minHeight: 200, overflow: "hidden", position: "relative" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  cardLabel2: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  cardNetwork: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardBalRow: { marginBottom: 14 },
  cardBalLabel: { color: "rgba(255,255,255,0.55)", fontSize: 10, fontFamily: "Inter_400Regular", letterSpacing: 1, textTransform: "uppercase" },
  cardBal: { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold", marginTop: 2, letterSpacing: -0.5 },
  cardNumber: { color: "#fff", fontSize: 15, fontFamily: "Inter_400Regular", letterSpacing: 3, marginBottom: 18 },
  cardBottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  cardMeta: { color: "rgba(255,255,255,0.55)", fontSize: 9, fontFamily: "Inter_400Regular", letterSpacing: 1, textTransform: "uppercase" },
  cardMetaVal: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  schemeBadgeVisa: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", fontStyle: "italic" },
  mcWrap: { flexDirection: "row", alignItems: "center" },
  mcCircle: { width: 24, height: 24, borderRadius: 12, opacity: 0.9 },
  decCircle1: { position: "absolute", width: 200, height: 200, borderRadius: 100, right: -60, top: -60, backgroundColor: "rgba(255,255,255,0.06)" },
  decCircle2: { position: "absolute", width: 140, height: 140, borderRadius: 70, right: -20, top: 60, backgroundColor: "rgba(255,255,255,0.04)" },

  // Frozen
  frozenOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 10, alignItems: "center", justifyContent: "center", borderRadius: 22, gap: 8 },
  frozenOverlayText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 4 },
  frozenBanner: { marginHorizontal: 20, marginTop: 12, borderRadius: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  frozenText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },

  // Dots
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 16 },
  dot: { height: 6, borderRadius: 3 },

  // Actions
  actions: { flexDirection: "row", paddingHorizontal: 16, marginTop: 18, gap: 10 },
  actionBtn: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 12, alignItems: "center", gap: 7 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },

  // Detail card
  detailCard: { margin: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  detailLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailValue: { fontSize: 13, fontFamily: "Inter_500Medium" },

  // Section / controls
  section: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  controlRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  controlIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  controlLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  controlSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  // Security
  secRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  secLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  secValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Transactions
  txSection: { marginBottom: 12 },
  txList: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  txIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txMerchant: { fontSize: 13, fontFamily: "Inter_500Medium" },
  txCat: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  txAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyTx: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 28, alignItems: "center", gap: 8 },
  emptyTxText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  // Notice
  notice: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  // Empty state
  emptyIcon: { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: 12 },
  emptyTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21, marginTop: 6 },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 15, borderRadius: 16, marginTop: 20 },
  createBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  perksRow: { flexDirection: "row", marginTop: 24, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 20, width: "100%", gap: 8 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2, marginBottom: 16 },
  modalItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  modalItemText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
});
