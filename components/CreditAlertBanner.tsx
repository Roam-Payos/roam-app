import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "../hooks/useColors";
import type { CreditAlert } from "../context/RoamContext";

interface Props {
  alert: CreditAlert;
  onDismiss: () => void;
}

export default function CreditAlertBanner({ alert, onDismiss }: Props) {
  const colors   = useColors();
  const slideY   = useRef(new Animated.Value(-160)).current;
  const opacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: false,
        tension: 60,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();

    // Auto-dismiss after 6 s
    const timer = setTimeout(() => dismiss(), 6000);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    Animated.parallel([
      Animated.timing(slideY, { toValue: -160, duration: 300, useNativeDriver: false }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start(() => onDismiss());
  }

  const fmt = (n: number) =>
    n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const timeStr = new Date(alert.timestamp).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideY }], opacity },
      ]}
    >
      <View style={styles.banner}>
        {/* Green left accent bar */}
        <View style={styles.accent} />

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.icon}>🔔</Text>
            <Text style={styles.title}>Credit Alert</Text>
            <Text style={styles.time}>{timeStr}</Text>
          </View>

          <Text style={styles.amount}>
            {alert.symbol}{fmt(alert.amount)}
          </Text>

          <Text style={styles.detail}>
            {alert.bankName} · {alert.senderName}
          </Text>

          <View style={styles.footer}>
            <Text style={styles.balLabel}>Available Balance</Text>
            <Text style={styles.balValue}>
              {alert.symbol}{fmt(alert.newBalance)}
            </Text>
          </View>
        </View>

        {/* Dismiss button */}
        <Pressable onPress={dismiss} style={styles.closeBtn} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
    paddingTop: 52,
  },
  banner: {
    flexDirection: "row",
    backgroundColor: "#0E1F12",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  accent: {
    width: 5,
    backgroundColor: "#22C55E",
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: "#22C55E",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  time: {
    fontSize: 11,
    color: "#6B7280",
  },
  amount: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  detail: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  balLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  balValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#D1FAE5",
  },
  closeBtn: {
    padding: 14,
    justifyContent: "center",
  },
  closeText: {
    color: "#6B7280",
    fontSize: 14,
  },
});
