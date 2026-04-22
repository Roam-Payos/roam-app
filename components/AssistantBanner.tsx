/**
 * AssistantBanner — shows the top unread Smart Assistant notification
 * as a dismissible in-app banner on the home screen.
 */

import { router } from "expo-router";
import { X } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AssistantNotification } from "@/hooks/useAssistant";
import { useColors } from "@/hooks/useColors";

interface Props {
  notification: AssistantNotification;
  onDismiss: (id: string) => void;
  onPress: (notification: AssistantNotification) => void;
}

const TYPE_ACCENT: Record<string, string> = {
  suggestion: "#F97316",
  tip:        "#6366F1",
  upsell:     "#10B981",
  alert:      "#EF4444",
};

export default function AssistantBanner({ notification, onDismiss, onPress }: Props) {
  const colors = useColors();
  const slideY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [notification.id]);

  const accent = TYPE_ACCENT[notification.type] ?? "#F97316";

  function handlePress() {
    onPress(notification);
    if (notification.cta_route) {
      try { router.push(notification.cta_route as any); } catch {}
    }
  }

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          transform: [{ translateY: slideY }],
          opacity,
        },
      ]}
    >
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      <Pressable style={styles.body} onPress={handlePress} android_ripple={{ color: "#ffffff10" }}>
        {notification.icon ? (
          <Text style={styles.icon}>{notification.icon}</Text>
        ) : null}
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]} numberOfLines={2}>
            {notification.message}
          </Text>
          {notification.cta_label ? (
            <Text style={[styles.cta, { color: accent }]}>{notification.cta_label} →</Text>
          ) : null}
        </View>
      </Pressable>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => onDismiss(notification.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={15} color={colors.mutedForeground} strokeWidth={2.5} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  accentBar: {
    width: 3,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  icon: {
    fontSize: 24,
    lineHeight: 30,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  message: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  cta: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 3,
  },
  closeBtn: {
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
