import { router } from "expo-router";
import React, { useRef, useEffect } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 32) }]}>
      {/* ── Logo ─────────────────────────────────────────────── */}
      <View style={styles.top}>
        <View style={styles.logoRing}>
          <View style={styles.logoInner}>
            <Text style={styles.logoLetter}>R</Text>
          </View>
        </View>
        <Text style={styles.brand}>Roam</Text>
        <Text style={styles.tagline}>One balance. Any country.</Text>
      </View>

      {/* ── Illustration text ─────────────────────────────────── */}
      <Animated.View style={[styles.middle, { opacity, transform: [{ translateY: slideY }] }]}>
        <Text style={styles.headline}>Your pan-African wallet</Text>
        <Text style={styles.subline}>
          Send, receive and spend across Nigeria, Ghana, Kenya and South Africa — from one balance.
        </Text>
      </Animated.View>

      {/* ── Buttons ──────────────────────────────────────────── */}
      <Animated.View style={[styles.buttons, { opacity, transform: [{ translateY: slideY }] }]}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push("/(onboarding)/phone")}
        >
          <Text style={styles.primaryBtnText}>Create Account</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push("/(onboarding)/login")}
        >
          <Text style={styles.secondaryBtnText}>Sign In</Text>
        </Pressable>

        <Text style={styles.legal}>
          By continuing you agree to our{" "}
          <Text style={styles.legalLink}>Terms of Service</Text> &amp;{" "}
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1C3D",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 72,
  },
  top: {
    alignItems: "center",
    gap: 12,
  },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    lineHeight: 40,
  },
  brand: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#8BA0C4",
    letterSpacing: 0.3,
  },
  middle: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
  },
  headline: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#8BA0C4",
    textAlign: "center",
    lineHeight: 22,
  },
  buttons: {
    width: "100%",
    gap: 14,
    alignItems: "center",
  },
  primaryBtn: {
    width: "100%",
    height: 54,
    backgroundColor: "#F97316",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    width: "100%",
    height: 54,
    backgroundColor: "transparent",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#1A2B4A",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  legal: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#4A6080",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
  legalLink: {
    color: "#8BA0C4",
  },
});
