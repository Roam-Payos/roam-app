import { MapPin, Plane, Search, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { router } from "expo-router";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface City {
  id: string;
  name: string;
  country: string;
  country_code: string;
  airport_code: string;
  currency: string;
  symbol: string;
  flag: string;
}

type ListItem =
  | { type: "hero" }
  | { type: "search" }
  | { type: "section_header"; country: string; flag: string }
  | { type: "city"; city: City; isLast: boolean };

export default function ArriveDestinationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`${API}/arrive/cities`)
      .then(r => r.json())
      .then(d => setCities(d.cities ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return cities;
    return cities.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.airport_code.toLowerCase().includes(q),
    );
  }, [cities, query]);

  // Build a flat list: [hero, search, section_header, city, city, section_header, city, ...]
  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = [{ type: "hero" }, { type: "search" }];
    const grouped: Record<string, City[]> = {};
    for (const c of filtered) {
      if (!grouped[c.country]) grouped[c.country] = [];
      grouped[c.country].push(c);
    }
    for (const [country, citiesInCountry] of Object.entries(grouped)) {
      items.push({ type: "section_header", country, flag: citiesInCountry[0].flag });
      citiesInCountry.forEach((city, idx) =>
        items.push({ type: "city", city, isLast: idx === citiesInCountry.length - 1 }),
      );
    }
    return items;
  }, [filtered]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  function navigateToHub(city: City) {
    router.push({
      pathname: "/arrive/hub",
      params: {
        cityId: city.id,
        cityName: city.name,
        country: city.country,
        flag: city.flag,
        airport: city.airport_code,
        symbol: city.symbol,
      },
    });
  }

  function renderItem({ item }: { item: ListItem }) {
    if (item.type === "hero") {
      return (
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary + "20" }]}>
            <Plane size={32} color={colors.primary} strokeWidth={1.6} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Where are you going?</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Choose a destination and we'll help you land fully prepared
          </Text>
        </View>
      );
    }

    if (item.type === "search") {
      return (
        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Search size={18} color={query ? colors.primary : colors.mutedForeground} strokeWidth={1.8} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search city, country or airport…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            returnKeyType="search"
            clearButtonMode="never"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => { setQuery(""); inputRef.current?.focus(); }}
              hitSlop={12}
              style={[styles.clearBtn, { backgroundColor: colors.mutedForeground + "30" }]}
            >
              <X size={12} color={colors.mutedForeground} strokeWidth={2.5} />
            </Pressable>
          )}
        </View>
      );
    }

    if (item.type === "section_header") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionFlag}>{item.flag}</Text>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{item.country.toUpperCase()}</Text>
        </View>
      );
    }

    if (item.type === "city") {
      const { city, isLast } = item;
      return (
        <Pressable
          onPress={() => navigateToHub(city)}
          style={({ pressed }) => [
            styles.cityRow,
            { backgroundColor: pressed ? colors.primary + "15" : colors.card },
            { borderColor: colors.border },
            !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
            isLast && styles.cityRowLast,
          ]}
        >
          <View style={[styles.cityIconWrap, { backgroundColor: colors.primary + "18" }]}>
            <MapPin size={16} color={colors.primary} strokeWidth={1.8} />
          </View>
          <View style={styles.cityInfo}>
            <Text style={[styles.cityName, { color: colors.foreground }]}>{city.name}</Text>
            <Text style={[styles.cityMeta, { color: colors.mutedForeground }]}>
              {city.country_code} · {city.airport_code} Airport
            </Text>
          </View>
          <View style={[styles.cityArrow, { backgroundColor: colors.primary + "15" }]}>
            <Text style={[styles.cityArrowText, { color: colors.primary }]}>→</Text>
          </View>
        </Pressable>
      );
    }

    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed top bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 6, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.topBarTitle, { color: colors.foreground }]}>Roam Arrive</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}
          style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <X size={16} color={colors.mutedForeground} strokeWidth={2.5} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading destinations…</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, idx) => {
            if (item.type === "hero") return "hero";
            if (item.type === "search") return "search";
            if (item.type === "section_header") return `sh-${item.country}`;
            return `city-${item.city.id}`;
          }}
          renderItem={renderItem}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                No destinations found for "{query}"
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  // Hero block
  hero: { paddingTop: 32, paddingBottom: 28, alignItems: "center", gap: 12 },
  heroIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  heroSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21, paddingHorizontal: 16 },

  // Search bar
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 28,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },
  clearBtn: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    marginBottom: 6,
    marginTop: 4,
  },
  sectionFlag: { fontSize: 18 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.2 },

  // City rows — grouped as a card
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cityRowLast: { borderBottomWidth: 1, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  cityIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cityInfo: { flex: 1 },
  cityName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cityMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cityArrow: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  cityArrowText: { fontSize: 15, fontFamily: "Inter_700Bold" },

  // Empty state
  emptyBox: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
