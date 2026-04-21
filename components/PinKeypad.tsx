import * as Haptics from "expo-haptics";
import { Delete } from "lucide-react-native";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  value: string;
  maxLength?: number;
  onChange: (val: string) => void;
  onSubmit?: (val: string) => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export function PinKeypad({ value, maxLength = 4, onChange, onSubmit }: Props) {
  const colors = useColors();

  function handleKey(key: string) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === "del") {
      onChange(value.slice(0, -1));
    } else if (key && value.length < maxLength) {
      const next = value + key;
      onChange(next);
      if (next.length === maxLength && onSubmit) {
        setTimeout(() => onSubmit(next), 80);
      }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < value.length ? colors.primary : colors.border,
                transform: [{ scale: i < value.length ? 1.15 : 1 }],
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.grid}>
        {KEYS.map((key, idx) => (
          <KeyButton key={idx} keyVal={key} onPress={handleKey} colors={colors} />
        ))}
      </View>
    </View>
  );
}

function KeyButton({
  keyVal,
  onPress,
  colors,
}: {
  keyVal: string;
  onPress: (k: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  if (!keyVal)
    return <View style={styles.keyEmpty} />;

  return (
    <Pressable
      onPress={() => onPress(keyVal)}
      style={({ pressed }) => [
        styles.key,
        { backgroundColor: pressed ? colors.border : colors.card },
      ]}
    >
      {keyVal === "del" ? (
        <Delete size={20} color={colors.foreground} strokeWidth={1.8} />
      ) : (
        <Text style={[styles.keyText, { color: colors.foreground }]}>{keyVal}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 32,
  },
  dots: {
    flexDirection: "row",
    gap: 18,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 280,
    gap: 12,
    justifyContent: "center",
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  keyEmpty: {
    width: 80,
    height: 80,
  },
  keyText: {
    fontSize: 24,
    fontFamily: "Inter_400Regular",
  },
});
