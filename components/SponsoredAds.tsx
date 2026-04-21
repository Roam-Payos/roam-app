/**
 * SponsoredAds — auto-scrolling sponsored ad carousel for the home screen.
 * Works on both web and native via ScrollView + manual dot indicators.
 */
import { ExternalLink } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions, Linking, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

const API    = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const CARD_W = Math.min(Dimensions.get("window").width - 32, 460);

export interface Ad {
  id: string;
  merchant_name: string;
  title: string;
  tagline?: string;
  cta_text: string;
  deal_id?: string;
  external_url?: string;
  accent_color: string;
  emoji: string;
}

// Fallback placeholder shown when no ads exist yet
const PLACEHOLDER_ADS: Ad[] = [
  {
    id: "p1", merchant_name: "Roam by PayOs",
    title: "Your brand here — reach thousands of deal-hunters 🎯",
    tagline: "Advertise on Roam and put your deals in front of active shoppers across Africa.",
    cta_text: "Advertise Now", deal_id: undefined, external_url: undefined,
    accent_color: "#6366F1", emoji: "📢",
  },
  {
    id: "p2", merchant_name: "Roam by PayOs",
    title: "Send Money Across Africa in Seconds 🌍",
    tagline: "Cross-border payments, virtual cards, and the best FX rates — all in one app.",
    cta_text: "Try Roam Wallet", deal_id: undefined, external_url: undefined,
    accent_color: "#10B981", emoji: "💸",
  },
  {
    id: "p3", merchant_name: "Roam by PayOs",
    title: "Earn Loyalty Points on Every Deal 🏆",
    tagline: "Save coupons for free. Redeem your points at hundreds of merchants across Nigeria, Ghana & Kenya.",
    cta_text: "Browse Hot Deals", deal_id: undefined, external_url: undefined,
    accent_color: "#F97316", emoji: "🔥",
  },
];

function trackImpression(adId: string) {
  if (adId.startsWith("p")) return; // skip placeholders
  fetch(`${API}/roam/ads/${adId}/impression`, { method: "POST" }).catch(() => {});
}

function trackClick(adId: string) {
  if (adId.startsWith("p")) return;
  fetch(`${API}/roam/ads/${adId}/click`, { method: "POST" }).catch(() => {});
}

interface Props { country?: string }

export default function SponsoredAds({ country = "NG" }: Props) {
  const colors   = useColors();
  const [ads, setAds]     = useState<Ad[]>(PLACEHOLDER_ADS);
  const [page, setPage]   = useState(0);
  const scrollRef         = useRef<ScrollView>(null);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const adsRef            = useRef<Ad[]>(PLACEHOLDER_ADS);

  useEffect(() => {
    fetch(`${API}/roam/ads?country=${country}&limit=6`)
      .then(r => r.json())
      .then(d => {
        const list: Ad[] = d.ads ?? [];
        const display    = list.length > 0 ? list : PLACEHOLDER_ADS;
        setAds(display);
        adsRef.current = display;
        display.forEach(a => trackImpression(a.id));
      })
      .catch(() => {});
  }, [country]);

  // Auto-advance every 4s
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const len  = adsRef.current.length;
      if (len < 2) return;
      setPage(prev => {
        const next = (prev + 1) % len;
        scrollRef.current?.scrollTo({ x: next * CARD_W, animated: true });
        return next;
      });
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function handleCTA(ad: Ad) {
    trackClick(ad.id);
    if (ad.deal_id) {
      router.push(`/deals/${ad.deal_id}` as never);
    } else if (ad.external_url) {
      Linking.openURL(ad.external_url).catch(() => {});
    } else if (ad.id === "p2") {
      // placeholder — wallet promo
    } else if (ad.id === "p3") {
      router.push("/deals" as never);
    }
  }

  return (
    <View style={styles.wrapper}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[styles.sponsoredLabel, { color: colors.mutedForeground }]}>Sponsored</Text>
        <View style={styles.dots}>
          {ads.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => {
                setPage(i);
                scrollRef.current?.scrollTo({ x: i * CARD_W, animated: true });
              }}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === page ? "#F97316" : colors.border,
                    width: i === page ? 18 : 6,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={Platform.OS !== "web"}
        snapToInterval={CARD_W + 12}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        onScroll={e => {
          const x = e.nativeEvent.contentOffset.x;
          setPage(Math.round(x / (CARD_W + 12)));
        }}
        scrollEventThrottle={16}
      >
        {ads.map((ad) => {
          const accent = ad.accent_color ?? "#F97316";
          return (
            <Pressable
              key={ad.id}
              onPress={() => handleCTA(ad)}
              style={({ pressed }) => [
                styles.card,
                {
                  width: CARD_W,
                  backgroundColor: accent + "15",
                  borderColor: accent + "45",
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              {/* Glow blob */}
              <View style={[styles.glow, { backgroundColor: accent + "25" }]} />

              <View style={styles.cardInner}>
                {/* Left content */}
                <View style={{ flex: 1, gap: 5 }}>
                  <View style={styles.topRow}>
                    <View style={[styles.emojiWrap, { backgroundColor: accent + "22" }]}>
                      <Text style={styles.emoji}>{ad.emoji}</Text>
                    </View>
                    <View style={[styles.adTag, { backgroundColor: accent + "20" }]}>
                      <Text style={[styles.adTagText, { color: accent }]}>Ad</Text>
                    </View>
                  </View>

                  <Text style={[styles.merchantName, { color: accent }]} numberOfLines={1}>
                    {ad.merchant_name}
                  </Text>
                  <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
                    {ad.title}
                  </Text>
                  {ad.tagline ? (
                    <Text style={[styles.tagline, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {ad.tagline}
                    </Text>
                  ) : null}
                </View>

                {/* CTA */}
                <Pressable
                  onPress={() => handleCTA(ad)}
                  style={[styles.cta, { backgroundColor: accent }]}
                >
                  <Text style={styles.ctaText}>{ad.cta_text}</Text>
                  {ad.external_url && !ad.deal_id && (
                    <ExternalLink size={11} color="#fff" strokeWidth={2.5} />
                  )}
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 8 },

  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 10,
  },
  sponsoredLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.8, textTransform: "uppercase" },
  dots: { flexDirection: "row", gap: 4, alignItems: "center" },
  dot:  { height: 6, borderRadius: 3, transition: "all 0.2s" as any },

  card: {
    borderRadius: 20, borderWidth: 1, overflow: "hidden",
    padding: 16, minHeight: 130,
  },
  glow: {
    position: "absolute", top: -40, right: -40,
    width: 140, height: 140, borderRadius: 70,
  },

  cardInner: { flex: 1, gap: 10 },
  topRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  emojiWrap: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  emoji:     { fontSize: 22 },
  adTag:     { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  adTagText: { fontSize: 10, fontFamily: "Inter_700Bold" },

  merchantName: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  title:        { fontSize: 15, fontFamily: "Inter_700Bold", lineHeight: 21 },
  tagline:      { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9,
    alignSelf: "flex-start",
  },
  ctaText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
});
