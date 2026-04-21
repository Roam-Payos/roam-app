import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface ActionItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  route: string;
  color?: string;
}

interface Props {
  actions: ActionItem[];
  onPress: (route: string) => void;
}

export function QuickActions({ actions, onPress }: Props) {
  const colors = useColors();

  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <ActionButton key={action.id} action={action} onPress={onPress} colors={colors} />
      ))}
    </View>
  );
}

function ActionButton({
  action,
  onPress,
  colors,
}: {
  action: ActionItem;
  onPress: (route: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const iconColor = action.color ?? colors.primary;

  function handlePress() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(action.route);
  }

  const IconComponent = action.icon;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
      testID={`quick-action-${action.id}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconColor + "1A" }]}>
        <IconComponent size={20} color={iconColor} strokeWidth={1.8} />
      </View>
      <Text style={[styles.label, { color: colors.foreground }]}>{action.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 10,
    justifyContent: "space-between",
  },
  action: {
    width: "30%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 10,
    minHeight: 85,
    justifyContent: "center",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
