import { ArrowDownLeft, ArrowUpRight, List } from "lucide-react-native";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TransactionItem } from "@/components/TransactionItem";
import { TransactionReceipt } from "@/components/TransactionReceipt";
import { useColors } from "@/hooks/useColors";
import { useRoam, TxType, Transaction } from "@/context/RoamContext";

type Filter = "all" | TxType;

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Send", value: "send" },
  { label: "Receive", value: "receive" },
  { label: "Cards", value: "card" },
  { label: "Bills", value: "bills" },
  { label: "Airtime", value: "airtime" },
];

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions, syncBalance } = useRoam();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await syncBalance();
    setRefreshing(false);
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = 90 + (Platform.OS === "web" ? 34 : 0);

  const filtered = filter === "all" ? transactions : transactions.filter((t) => t.type === filter);

  const totalIn = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = Math.abs(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        scrollEnabled={true}
        contentContainerStyle={{ paddingBottom: botPad, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={[styles.header, { paddingTop: topPad }]}>
              <Text style={[styles.title, { color: colors.foreground }]}>Transactions</Text>
            </View>

            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.summaryIcon, { backgroundColor: colors.success + "1A" }]}>
                  <ArrowDownLeft size={16} color={colors.success} strokeWidth={1.8} />
                </View>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Money In</Text>
                <Text style={[styles.summaryAmount, { color: colors.success }]}>
                  +{totalIn.toLocaleString()}
                </Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.summaryIcon, { backgroundColor: colors.primary + "1A" }]}>
                  <ArrowUpRight size={16} color={colors.primary} strokeWidth={1.8} />
                </View>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Money Out</Text>
                <Text style={[styles.summaryAmount, { color: colors.foreground }]}>
                  -{totalOut.toLocaleString()}
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {FILTERS.map((f) => (
                <Pressable
                  key={f.value}
                  onPress={() => setFilter(f.value)}
                  style={[
                    styles.filterBtn,
                    {
                      backgroundColor: filter === f.value ? colors.primary : colors.card,
                      borderColor: filter === f.value ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: filter === f.value ? "#fff" : colors.mutedForeground },
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <TransactionItem transaction={item} onPress={setSelectedTx} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <List size={36} color={colors.mutedForeground} strokeWidth={1.5} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No {filter === "all" ? "" : filter} transactions
            </Text>
          </View>
        }
      />

      <TransactionReceipt
        transaction={selectedTx}
        visible={!!selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  summaryRow: { flexDirection: "row", paddingHorizontal: 16, gap: 12, marginBottom: 20 },
  summaryCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 },
  summaryIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  summaryAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  filters: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  empty: { alignItems: "center", gap: 8, paddingTop: 48 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
