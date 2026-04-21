import { router } from "expo-router";
import { Gift, Plus, Search, ShoppingBag } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Platform, Pressable,
  RefreshControl, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoam } from "@/context/RoamContext";
import { useColors } from "@/hooks/useColors";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface GiftCard {
  id: string;
  card_number: string;
  beneficiary_name: string;
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

function statusLabel(s: GiftCard["status"]) {
  if (s === "active")   return { label: "Active",   bg: "#D1FAE5", fg: "#065F46" };
  if (s === "redeemed") return { label: "Used",      bg: "#E5E7EB", fg: "#6B7280" };
  if (s === "expired")  return { label: "Expired",   bg: "#FEE2E2", fg: "#991B1B" };
  return                         { label: "Cancelled", bg: "#FEF3C7", fg: "#92400E" };
}

function MiniCard({ card, onPress }: { card: GiftCard; onPress: () => void }) {
  const colors = useColors();
  const sym = card.currency === "NGN" ? "₦" : card.currency === "GHS" ? "₵" : card.currency === "KES" ? "KSh" : "R";
  const remaining = Number(card.remaining_balance);
  const faceVal   = Number(card.face_value);
  const pct       = faceVal > 0 ? Math.max(0, (remaining / faceVal) * 100) : 0;
  const { label, bg, fg } = statusLabel(card.status);

  return (
    <Pressable onPress={onPress} style={[styles.miniCard, { backgroundColor: colors.card }]}>
      {/* Left accent strip */}
      <View style={[styles.accentStrip, { backgroundColor: card.accent_color }]} />

      {/* Card body */}
      <View style={styles.miniCardBody}>
        <View style={styles.miniCardTop}>
          <Text style={styles.partnerEmoji}>{card.logo_emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.partnerName, { color: colors.text }]} numberOfLines={1}>
              {card.partner_name}
            </Text>
            <Text style={[styles.beneficiaryLabel, { color: colors.mutedForeground }]}>
              For {card.beneficiary_name}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: bg }]}>
            <Text style={[styles.statusText, { color: fg }]}>{label}</Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={[styles.miniCardAmount, { color: colors.text }]}>
            {sym}{Number(card.face_value).toLocaleString()}
          </Text>
          {card.status === "active" && remaining < faceVal && (
            <Text style={[styles.remainingText, { color: card.accent_color }]}>
              {sym}{remaining.toLocaleString()} left
            </Text>
          )}
        </View>

        {/* Progress bar */}
        <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: card.accent_color }]} />
        </View>

        <Text style={[styles.cardNumberSmall, { color: colors.mutedForeground }]}>
          {card.card_number}
        </Text>
      </View>
    </Pressable>
  );
}

export default function GiftCardsScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user } = useRoam();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const [cards, setCards]       = useState<GiftCard[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const r = await fetch(`${API}/roam/users/${user.id}/gift-cards`);
      const j = await r.json();
      setCards(j.cards ?? []);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.text }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Gift Cards</Text>
        <Pressable
          onPress={() => router.push("/gift-card/new")}
          style={[styles.addBtn, { backgroundColor: "#EC4899" }]}
        >
          <Plus size={18} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#EC4899" size="large" />
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 100,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#EC4899"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: "#FCE7F3" }]}>
                <Gift size={40} color="#EC4899" />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Gift Cards Yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>
                Surprise someone special with a shopping gift card they can use at top stores across Africa.
              </Text>
              <Pressable
                onPress={() => router.push("/gift-card/new")}
                style={styles.emptyBtn}
              >
                <ShoppingBag size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.emptyBtnText}>Send a Gift Card</Text>
              </Pressable>
            </View>
          }
          ListHeaderComponent={(
            <View>
              {/* Check Balance — always visible at top */}
              <Pressable
                onPress={() => router.push("/gift-card/check")}
                style={[styles.checkBalBtn, { backgroundColor: colors.card }]}
              >
                <View style={styles.checkBalIcon}>
                  <Search size={18} color="#1E4DB7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.checkBalTitle, { color: colors.text }]}>Check Gift Card Balance</Text>
                  <Text style={[styles.checkBalSub, { color: colors.mutedForeground }]}>
                    Enter any card number to see remaining balance
                  </Text>
                </View>
                <Text style={{ color: "#1E4DB7", fontWeight: "700", fontSize: 18 }}>›</Text>
              </Pressable>
              {/* Count row when cards exist */}
              {cards.length > 0 && (
                <View style={styles.listHeader}>
                  <Text style={[styles.listHeaderTitle, { color: colors.text }]}>
                    You've sent {cards.length} gift card{cards.length !== 1 ? "s" : ""}
                  </Text>
                  <Pressable onPress={() => router.push("/gift-card/new")}>
                    <Text style={{ color: "#EC4899", fontWeight: "600" }}>+ New</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
          renderItem={({ item }) => (
            <MiniCard
              card={item}
              onPress={() => router.push(`/gift-card/${item.id}`)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  backBtn:         { marginRight: 8 },
  backText:        { fontSize: 15, fontWeight: "500" },
  headerTitle:     { flex: 1, fontSize: 18, fontWeight: "700", textAlign: "center" },
  addBtn:          { width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center" },
  center:          { flex: 1, justifyContent: "center", alignItems: "center" },
  miniCard:        { flexDirection: "row", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  accentStrip:     { width: 6 },
  miniCardBody:    { flex: 1, padding: 14 },
  miniCardTop:     { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  partnerEmoji:    { fontSize: 26, marginRight: 10 },
  partnerName:     { fontSize: 14, fontWeight: "700" },
  beneficiaryLabel:{ fontSize: 12, marginTop: 2 },
  statusBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:      { fontSize: 11, fontWeight: "600" },
  amountRow:       { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 },
  miniCardAmount:  { fontSize: 22, fontWeight: "800" },
  remainingText:   { fontSize: 12, fontWeight: "600" },
  progressBg:      { height: 4, borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  progressFill:    { height: 4, borderRadius: 4 },
  cardNumberSmall: { fontSize: 11, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  emptyState:      { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon:       { width: 90, height: 90, borderRadius: 45, justifyContent: "center", alignItems: "center", marginBottom: 24 },
  emptyTitle:      { fontSize: 22, fontWeight: "800", marginBottom: 10, textAlign: "center" },
  emptySubtext:    { fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 28 },
  emptyBtn:        { flexDirection: "row", alignItems: "center", backgroundColor: "#EC4899", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyBtnText:    { color: "#fff", fontWeight: "700", fontSize: 15 },
  listHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  listHeaderTitle: { fontSize: 15, fontWeight: "600" },
  checkBalBtn:     { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "rgba(30,77,183,0.15)" },
  checkBalIcon:    { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" },
  checkBalTitle:   { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  checkBalSub:     { fontSize: 12 },
});
