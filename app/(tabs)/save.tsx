/**
 * Save & Invest tab
 *  • Sinking Fund — auto-sweeps a % of every incoming credit into a locked investment pot
 *  • Savings Goals — auto-deducts a % of every spend toward a named goal
 */
import { PiggyBank, Plus, Target, TrendingUp, Lock, ChevronRight, Trash2, Pause, Play, Edit2 } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView,
  Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoam } from "@/context/RoamContext";
import { useColors } from "@/hooks/useColors";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const EMOJI_OPTIONS = ["🎯","✈️","🏠","🚗","👗","📱","🎓","💍","🏖️","🎮","💪","🌍","🎸","🛍️","🎁"];

interface SavingsGoal {
  id: string; name: string; emoji: string;
  target_amount: string; current_amount: string;
  currency: string; deduction_pct: string;
  is_active: boolean; is_completed: boolean;
}
interface SinkingFund {
  id: string; label: string; balance: string;
  currency: string; deduction_pct: string; is_active: boolean;
}
interface Movement {
  id: string; amount: string; trigger_type: string;
  note: string; created_at: string;
  goal_name?: string; goal_emoji?: string; fund_label?: string;
}

const fmt = (n: number, currency = "NGN") =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export default function SaveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useRoam();
  const userId = user?.id?.toString() ?? "1";

  const [goals,     setGoals]     = useState<SavingsGoal[]>([]);
  const [fund,      setFund]      = useState<SinkingFund | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  // Goal modal state
  const [showGoalModal,  setShowGoalModal]  = useState(false);
  const [showFundModal,  setShowFundModal]  = useState(false);
  const [editingGoal,    setEditingGoal]    = useState<SavingsGoal | null>(null);
  const [goalName,       setGoalName]       = useState("");
  const [goalEmoji,      setGoalEmoji]      = useState("🎯");
  const [goalTarget,     setGoalTarget]     = useState("");
  const [goalPct,        setGoalPct]        = useState("5");
  const [fundLabel,      setFundLabel]      = useState("Investment Fund");
  const [fundPct,        setFundPct]        = useState("5");
  const [saving,         setSaving]         = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await fetch(`${API}/roam/users/${userId}/savings`);
      const d = await r.json();
      setGoals(d.goals ?? []);
      setFund(d.fund ?? null);
      setMovements(d.movements ?? []);
    } catch {}
    if (refresh) setRefreshing(false); else setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ── Create / update goal ──────────────────────────────────────────────────
  async function saveGoal() {
    if (!goalName.trim()) return Alert.alert("Name required", "Please enter a goal name.");
    if (!goalTarget || isNaN(parseFloat(goalTarget))) return Alert.alert("Target required", "Enter a valid target amount.");
    const pct = parseFloat(goalPct);
    if (isNaN(pct) || pct < 0.5 || pct > 50) return Alert.alert("Invalid %", "Enter a percentage between 0.5 and 50.");

    setSaving(true);
    try {
      const url    = editingGoal
        ? `${API}/roam/users/${userId}/savings/goals/${editingGoal.id}`
        : `${API}/roam/users/${userId}/savings/goals`;
      const method = editingGoal ? "PUT" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: goalName, emoji: goalEmoji, target_amount: parseFloat(goalTarget), deduction_pct: pct }),
      });
      if (!r.ok) throw new Error("Failed");
      setShowGoalModal(false);
      setEditingGoal(null);
      setGoalName(""); setGoalEmoji("🎯"); setGoalTarget(""); setGoalPct("5");
      load();
    } catch { Alert.alert("Error", "Could not save goal."); }
    setSaving(false);
  }

  // ── Create / update sinking fund ─────────────────────────────────────────
  async function saveFund() {
    const pct = parseFloat(fundPct);
    if (isNaN(pct) || pct < 0.5 || pct > 50) return Alert.alert("Invalid %", "Enter a percentage between 0.5 and 50.");
    setSaving(true);
    try {
      const method = fund ? "PUT" : "POST";
      const r = await fetch(`${API}/roam/users/${userId}/savings/fund`, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: fundLabel, deduction_pct: pct }),
      });
      if (!r.ok) throw new Error("Failed");
      setShowFundModal(false);
      load();
    } catch { Alert.alert("Error", "Could not save fund."); }
    setSaving(false);
  }

  async function toggleGoal(goal: SavingsGoal) {
    await fetch(`${API}/roam/users/${userId}/savings/goals/${goal.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !goal.is_active }),
    });
    load();
  }

  async function deleteGoal(goal: SavingsGoal) {
    Alert.alert("Delete goal?", `"${goal.name}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await fetch(`${API}/roam/users/${userId}/savings/goals/${goal.id}`, { method: "DELETE" });
        load();
      }},
    ]);
  }

  async function toggleFund() {
    if (!fund) return;
    await fetch(`${API}/roam/users/${userId}/savings/fund`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !fund.is_active }),
    });
    load();
  }

  function openEditGoal(goal: SavingsGoal) {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setGoalEmoji(goal.emoji);
    setGoalTarget(goal.target_amount.toString());
    setGoalPct(goal.deduction_pct.toString());
    setShowGoalModal(true);
  }

  if (loading) return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  const totalGoalSaved = goals.reduce((s, g) => s + parseFloat(g.current_amount), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top + 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Save & Invest</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Money that works while you spend
            </Text>
          </View>
          <View style={[styles.totalBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "35" }]}>
            <Text style={[styles.totalLabel, { color: colors.primary }]}>Total Saved</Text>
            <Text style={[styles.totalAmt, { color: colors.primary }]}>{fmt(totalGoalSaved)}</Text>
          </View>
        </View>

        {/* ── Sinking Fund card ── */}
        <View style={[styles.fundCard, { backgroundColor: "#6366F1" + "18", borderColor: "#6366F1" + "40" }]}>
          <View style={styles.fundTop}>
            <View style={styles.fundIconWrap}>
              <TrendingUp size={22} color="#6366F1" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fundTitle, { color: colors.foreground }]}>
                {fund?.label ?? "Investment Fund"}
              </Text>
              <Text style={[styles.fundSub, { color: colors.mutedForeground }]}>
                Auto-sweeps <Text style={{ color: "#6366F1", fontFamily: "Inter_700Bold" }}>{fund?.deduction_pct ?? "–"}%</Text> of every incoming credit
              </Text>
            </View>
            <Pressable
              onPress={() => fund ? toggleFund() : null}
              style={[styles.fundToggle, { backgroundColor: fund?.is_active ? "#6366F1" : colors.muted }]}
            >
              {fund?.is_active ? <Play size={12} color="#fff" /> : <Pause size={12} color="#fff" />}
            </Pressable>
          </View>

          <View style={[styles.fundBalanceRow, { borderTopColor: "#6366F1" + "30" }]}>
            <View>
              <Text style={[styles.fundBalanceLabel, { color: colors.mutedForeground }]}>Current Balance</Text>
              <Text style={[styles.fundBalance, { color: "#6366F1" }]}>
                {fund ? fmt(parseFloat(fund.balance), fund.currency) : "—"}
              </Text>
            </View>
            <View style={styles.fundLockBadge}>
              <Lock size={10} color="#6366F1" strokeWidth={2.5} />
              <Text style={[styles.fundLockText, { color: "#6366F1" }]}>Locked for investment</Text>
            </View>
          </View>

          <Pressable
            onPress={() => {
              if (fund) { setFundLabel(fund.label); setFundPct(fund.deduction_pct.toString()); }
              setShowFundModal(true);
            }}
            style={[styles.fundSetupBtn, { borderColor: "#6366F1" + "55" }]}
          >
            <Text style={{ color: "#6366F1", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
              {fund ? "Change Settings" : "Set Up Investment Fund"}
            </Text>
            <ChevronRight size={14} color="#6366F1" strokeWidth={2.5} />
          </Pressable>
        </View>

        {/* ── Savings Goals ── */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Savings Goals</Text>
          <Pressable
            onPress={() => { setEditingGoal(null); setGoalName(""); setGoalEmoji("🎯"); setGoalTarget(""); setGoalPct("5"); setShowGoalModal(true); }}
            style={[styles.addBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "35" }]}
          >
            <Plus size={14} color={colors.primary} strokeWidth={2.5} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>New Goal</Text>
          </Pressable>
        </View>

        {goals.length === 0 && (
          <View style={[styles.emptyGoals, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Target size={36} color={colors.mutedForeground} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No goals yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Create a goal and Roam will set aside a portion of every purchase toward it automatically.
            </Text>
          </View>
        )}

        {goals.map((goal) => {
          const current = parseFloat(goal.current_amount);
          const target  = parseFloat(goal.target_amount);
          const pct     = Math.min((current / target) * 100, 100);
          return (
            <Pressable
              key={goal.id}
              style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: goal.is_active ? 1 : 0.65 }]}
            >
              <View style={styles.goalHeader}>
                <View style={[styles.goalEmoji, { backgroundColor: colors.background }]}>
                  <Text style={{ fontSize: 22 }}>{goal.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.goalName, { color: colors.foreground }]} numberOfLines={1}>{goal.name}</Text>
                  <Text style={[styles.goalPct, { color: colors.mutedForeground }]}>
                    {goal.deduction_pct}% of every spend · {goal.is_completed ? "✅ Complete" : goal.is_active ? "Active" : "Paused"}
                  </Text>
                </View>
                <View style={styles.goalActions}>
                  <Pressable onPress={() => openEditGoal(goal)} style={styles.iconBtn}>
                    <Edit2 size={14} color={colors.mutedForeground} strokeWidth={2} />
                  </Pressable>
                  <Pressable onPress={() => toggleGoal(goal)} style={styles.iconBtn}>
                    {goal.is_active ? <Pause size={14} color={colors.mutedForeground} strokeWidth={2} /> : <Play size={14} color={colors.primary} strokeWidth={2} />}
                  </Pressable>
                  <Pressable onPress={() => deleteGoal(goal)} style={styles.iconBtn}>
                    <Trash2 size={14} color="#EF4444" strokeWidth={2} />
                  </Pressable>
                </View>
              </View>

              {/* Progress bar */}
              <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: goal.is_completed ? "#10B981" : colors.primary }]} />
              </View>
              <View style={styles.goalAmounts}>
                <Text style={[styles.goalAmt, { color: colors.foreground }]}>{fmt(current, goal.currency)}</Text>
                <Text style={[styles.goalAmt, { color: colors.mutedForeground }]}>{Math.round(pct)}% of {fmt(target, goal.currency)}</Text>
              </View>
            </Pressable>
          );
        })}

        {/* ── Recent Movements ── */}
        {movements.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 16 }]}>Recent Activity</Text>
            {movements.slice(0, 8).map((m) => (
              <View key={m.id} style={[styles.mvmtRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.mvmtDot, {
                  backgroundColor: m.trigger_type === "expense" ? "#F97316" + "22" : "#10B981" + "22",
                }]}>
                  {m.trigger_type === "expense"
                    ? <Target size={12} color="#F97316" strokeWidth={2.5} />
                    : <TrendingUp size={12} color="#10B981" strokeWidth={2.5} />
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mvmtLabel, { color: colors.foreground }]} numberOfLines={1}>
                    {m.goal_emoji} {m.goal_name ?? m.fund_label ?? "Savings"}
                  </Text>
                  <Text style={[styles.mvmtNote, { color: colors.mutedForeground }]} numberOfLines={1}>{m.note}</Text>
                </View>
                <Text style={[styles.mvmtAmt, { color: m.trigger_type === "withdrawal" ? "#EF4444" : colors.foreground }]}>
                  {m.trigger_type === "withdrawal" ? "-" : "+"}₦{parseFloat(m.amount).toFixed(0)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Goal Modal ── */}
      <Modal visible={showGoalModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowGoalModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setShowGoalModal(false)}>
              <Text style={{ color: colors.mutedForeground, fontSize: 15, fontFamily: "Inter_500Medium" }}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingGoal ? "Edit Goal" : "New Goal"}</Text>
            <Pressable onPress={saveGoal} disabled={saving}>
              <Text style={{ color: colors.primary, fontSize: 15, fontFamily: "Inter_700Bold" }}>
                {saving ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1, padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Emoji picker */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Choose an icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {EMOJI_OPTIONS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setGoalEmoji(e)}
                  style={[styles.emojiOpt, {
                    backgroundColor: goalEmoji === e ? colors.primary + "22" : colors.card,
                    borderColor: goalEmoji === e ? colors.primary : colors.border,
                  }]}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Goal name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Holiday, New Phone, Rent"
              placeholderTextColor={colors.mutedForeground}
              value={goalName}
              onChangeText={setGoalName}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Target amount (₦)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. 500000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={goalTarget}
              onChangeText={setGoalTarget}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Auto-save % of each purchase</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, flex: 1 }]}
                placeholder="5"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={goalPct}
                onChangeText={setGoalPct}
              />
              <Text style={{ color: colors.foreground, fontSize: 22, fontFamily: "Inter_700Bold" }}>%</Text>
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                💡 Every time you make a payment, {goalPct || "X"}% of the spend amount is automatically transferred here — silently, without you having to think about it.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Fund Modal ── */}
      <Modal visible={showFundModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFundModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setShowFundModal(false)}>
              <Text style={{ color: colors.mutedForeground, fontSize: 15, fontFamily: "Inter_500Medium" }}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Investment Fund</Text>
            <Pressable onPress={saveFund} disabled={saving}>
              <Text style={{ color: "#6366F1", fontSize: 15, fontFamily: "Inter_700Bold" }}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1, padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Fund name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Investment Fund, Rainy Day"
              placeholderTextColor={colors.mutedForeground}
              value={fundLabel}
              onChangeText={setFundLabel}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>% of every incoming credit to sweep in</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, flex: 1 }]}
                placeholder="5"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={fundPct}
                onChangeText={setFundPct}
              />
              <Text style={{ color: colors.foreground, fontSize: 22, fontFamily: "Inter_700Bold" }}>%</Text>
            </View>

            <View style={[styles.infoBox, { backgroundColor: "#6366F1" + "10", borderColor: "#6366F1" + "30" }]}>
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                🔒 Whenever money lands in your Roam wallet (transfers, payments received), {fundPct || "X"}% is automatically moved here and locked for investment. You can see the balance growing but it stays put until you withdraw it.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center" },

  headerRow:  { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 20 },
  title:      { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle:   { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  totalBadge: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, alignItems: "flex-end" },
  totalLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  totalAmt:   { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 1 },

  fundCard:     { marginHorizontal: 16, borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 24 },
  fundTop:      { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  fundIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#6366F120", alignItems: "center", justifyContent: "center" },
  fundTitle:    { fontSize: 15, fontFamily: "Inter_700Bold" },
  fundSub:      { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 },
  fundToggle:   { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fundBalanceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 12, marginBottom: 12 },
  fundBalanceLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  fundBalance:  { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  fundLockBadge:{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#6366F115", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  fundLockText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  fundSetupBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderRadius: 10, paddingVertical: 9 },

  sectionRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle:{ fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 12 },
  addBtn:      { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  addBtnText:  { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  emptyGoals:  { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 28, alignItems: "center", gap: 8, marginBottom: 16 },
  emptyTitle:  { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyText:   { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },

  goalCard:    { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  goalHeader:  { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  goalEmoji:   { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  goalName:    { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  goalPct:     { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  goalActions: { flexDirection: "row", gap: 2 },
  iconBtn:     { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  progressTrack:{ height: 6, borderRadius: 3, marginBottom: 6, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  goalAmounts: { flexDirection: "row", justifyContent: "space-between" },
  goalAmt:     { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  mvmtRow:   { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  mvmtDot:   { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  mvmtLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  mvmtNote:  { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  mvmtAmt:   { fontSize: 13, fontFamily: "Inter_700Bold" },

  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle:  { fontSize: 16, fontFamily: "Inter_700Bold" },
  fieldLabel:  { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  input:       { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 20 },
  emojiOpt:    { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", marginRight: 8 },
  infoBox:     { borderRadius: 12, borderWidth: 1, padding: 14 },
  infoText:    { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
