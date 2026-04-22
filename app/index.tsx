import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useRoam } from "@/context/RoamContext";

const SPLASH_MIN_MS = 2400;

export default function SplashScreen() {
  const { isAuthenticated, isLoading } = useRoam();
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const mountedAt = useRef(Date.now());
  const navigated = useRef(false);

  // ── Run animation exactly once, immediately on mount ──────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []); // empty deps — never re-runs

  // ── Navigate only after loading is done AND minimum time has elapsed ───────
  useEffect(() => {
    if (isLoading || navigated.current) return;

    const elapsed = Date.now() - mountedAt.current;
    const delay = Math.max(0, SPLASH_MIN_MS - elapsed);

    const timer = setTimeout(() => {
      if (navigated.current) return;
      navigated.current = true;
      if (isAuthenticated) {
        router.replace("/(tabs)/");
      } else {
        router.replace("/(onboarding)/welcome");
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <View style={styles.logoRing}>
          <View style={styles.logoInner}>
            <Text style={styles.logoLetter}>R</Text>
          </View>
        </View>
        <Text style={styles.brand}>Roam</Text>
        <Text style={styles.tagline}>One balance. Any country.</Text>
      </Animated.View>
      <Animated.View style={[styles.footer, { opacity }]}>
        <Text style={styles.footerText}>by PayOs</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1C3D",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    gap: 16,
  },
  logoRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    lineHeight: 48,
  },
  brand: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#8BA0C4",
    letterSpacing: 0.3,
  },
  footer: {
    position: "absolute",
    bottom: 48,
  },
  footerText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#8BA0C4",
    letterSpacing: 1,
  },
});
