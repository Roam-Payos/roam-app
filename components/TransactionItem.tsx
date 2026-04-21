import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  Phone,
  PlusCircle,
  ShoppingBag,
  Zap,
} from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Transaction, TxType } from "@/context/RoamContext";

type IconDef = {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
};

const TX_ICONS: Record<TxType, IconDef> = {
  send:    { icon: ArrowUpRight,   color: "#F97316" },
  receive: { icon: ArrowDownLeft,  color: "#10B981" },
  pay:     { icon: ShoppingBag,    color: "#6366F1" },
  card:    { icon: CreditCard,     color: "#8B5CF6" },
  airtime: { icon: Phone,          color: "#3B82F6" },
  bills:   { icon: Zap,            color: "#F59E0B" },
  fund:    { icon: PlusCircle,     color: "#10B981" },
  convert: { icon: ArrowLeftRight, color: "#0EA5E9" },
};

interface Props {
  transaction: Transaction;
  onPress?: (tx: Transaction) => void;
}

export function TransactionItem({ transaction, onPress }: Props) {
  const colors = useColors();
  const meta = TX_ICONS[transaction.type] ?? TX_ICONS.send;
  const isCredit = transaction.amount > 0;
  const dateStr = formatDate(transaction.date);
  const IconComponent = meta.icon;

  return (
    <Pressable
      onPress={() => onPress?.(transaction)}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: meta.color + "1A" }]}>
        <IconComponent size={18} color={meta.color} strokeWidth={1.8} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {transaction.title}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {transaction.subtitle} · {dateStr}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: isCredit ? colors.success : colors.foreground }]}>
          {isCredit ? "+" : ""}{transaction.symbol}{Math.abs(transaction.amount).toLocaleString()}
        </Text>
        <StatusBadge status={transaction.status} colors={colors} />
      </View>
    </Pressable>
  );
}

function StatusBadge({
  status,
  colors,
}: {
  status: Transaction["status"];
  colors: ReturnType<typeof useColors>;
}) {
  if (status === "completed") return null;
  const color = status === "pending" ? colors.warning : colors.destructive;
  return (
    <View style={[styles.badge, { backgroundColor: color + "22" }]}>
      <Text style={[styles.badgeText, { color }]}>{status}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3600000;
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return "Yesterday";
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  sub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  right: {
    alignItems: "flex-end",
    gap: 3,
  },
  amount: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
});
