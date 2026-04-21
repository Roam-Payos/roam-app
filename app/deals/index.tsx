/**
 * Hot Deals — Country Home Screen
 *
 * Sections:
 *  • 📍 Near You (geo-sorted)
 *  • ⭐ Featured
 *  • 🏙️ Cities tab strip
 *  • 🛍️ Category chips
 */
import { router } from "expo-router";
import { ArrowLeft, Flame, MapPin, Navigation, Search, Ticket } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoam } from "@/context/RoamContext";
import { useColors } from "@/hooks/useColors";
import DealCard from "@/components/DealCard";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const CATEGORY_ICONS: Record<string, string> = {
  Food: "🍔", Travel: "✈️", Shopping: "🛍️", Entertainment: "🎬",
  Health: "💊", Telecom: "📶", All: "🔥", Events: "🎟️",
};

const COUNTRY_LABELS: Record<string, { name: string; flag: string }> = {
  NG: { name: "Nigeria",      flag: "🇳🇬" },
  GH: { name: "Ghana",        flag: "🇬🇭" },
  KE: { name: "Kenya",        flag: "🇰🇪" },
  ZA: { name: "South Africa", flag: "🇿🇦" },
};

export default function HotDealsHome() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user } = useRoam();

  const country    = user?.country?.code ?? "NG";
  const countryInfo = COUNTRY_LABELS[country] ?? { name: "Africa", flag: "🌍" };

  const [allDeals,      setAllDeals]      = useState<Deal[]>([]);
  const [featured,      setFeatured]      = useState<Deal[]>([]);
  const [nearby,        setNearby]        = useState<Deal[]>([]);
  const [eventDeals,    setEventDeals]    = useState<Deal[]>([]);
  const [cities,        setCities]        = useState<CityRow[]>([]);
  const [categories,    setCategories]    = useState<string[]>(["All"]);
  const [activeCity,    setActiveCity]    = useState<string>("All");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);

  const topPad = insets.top + 12;

  async function getCoords(): Promise<{ lat: number; lng: number } | null> {
    try {
      if (Platform.OS !== "web") {
        const Location = await import("expo-location");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return null;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
      // Web: use native geolocation if available
      if (typeof navigator === "undefined" || !navigator.geolocation) return null;
      return await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 5000 },
        );
      });
    } catch {
      return null;
    }
  }

  async function load(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const coords = await getCoords();
      setLocationGranted(!!coords);

      const nearbyPromise = coords
        ? fetch(`${API}/roam/deals/nearby?lat=${coords.lat}&lng=${coords.lng}&country=${country}&radius=20&limit=8`)
            .then(r => r.json()).catch(() => ({ deals: [] }))
        : Promise.resolve({ deals: [] });

      const [dealsRes, featuredRes, citiesRes, catsRes, nearbyRes, eventsRes] = await Promise.all([
        fetch(`${API}/roam/deals?country=${country}&limit=50`).then((r) => r.json()).catch(() => ({ deals: [] })),
        fetch(`${API}/roam/deals/featured?country=${country}`).then((r) => r.json()).catch(() => ({ deals: [] })),
        fetch(`${API}/roam/deals/cities?country=${country}`).then((r) => r.json()).catch(() => ({ cities: [] })),
        fetch(`${API}/roam/deals/categories?country=${country}`).then((r) => r.json()).catch(() => ({ categories: [] })),
        nearbyPromise,
        fetch(`${API}/roam/deals?country=${country}&deal_type=event&limit=20`).then(r => r.json()).catch(() => ({ deals: [] })),
      ]);
      setAllDeals(dealsRes.deals ?? []);
      setFeatured(featuredRes.deals ?? []);
      setNearby(nearbyRes.deals ?? []);
      setEventDeals(eventsRes.deals ?? []);
      setCities(citiesRes.cities ?? []);
      const catList = ["All", ...(catsRes.categories ?? []).map((c: { category: string }) => c.category), "Events"];
      setCategories(catList);
    } catch {
      // silently fail — show empty state
    }
    if (refresh) setRefreshing(false); else setLoading(false);
  }

  useEffect(() => { load(); }, [country]);

  // When "Events" is selected, show eventDeals; otherwise filter normally
  const matchesQuery = (d: Deal) => !searchQuery ||
    d.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.merchant_name ?? "").toLowerCase().includes(searchQuery.toLowerCase());

  const filtered = activeCategory === "Events"
    ? eventDeals.filter(d => (activeCity === "All" || d.city === activeCity) && matchesQuery(d))
    : allDeals.filter((d) =>
        (activeCity === "All" || d.city === activeCity) &&
        (activeCategory === "All" || d.category === activeCategory) &&
        matchesQuery(d) &&
        d.deal_type !== "event",
      );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 100, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View>
            {/* ── Header ── */}
            <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Back button — always visible circle */}
              <Pressable
                onPress={() => router.replace("/(tabs)/" as never)}
                style={[styles.backBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <ArrowLeft size={18} color={colors.foreground} strokeWidth={2.5} />
              </Pressable>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Flame size={20} color="#F97316" strokeWidth={2} />
                  <Text style={[styles.headerTitle, { color: colors.foreground }]}>Hot Deals</Text>
                </View>
                <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
                  {countryInfo.flag} {countryInfo.name}
                </Text>
              </View>

              <Pressable
                onPress={() => router.push("/deals/coupons" as never)}
                style={[styles.couponsBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}
              >
                <Text style={[styles.couponsBtnText, { color: colors.primary }]}>🎟 My Coupons</Text>
              </Pressable>
            </View>

            {/* ── Search ── */}
            <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Search size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search deals, merchants..."
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* ── 📍 Near You ── */}
            {nearby.length > 0 && activeCategory === "All" && !searchQuery && (
              <View style={{ marginBottom: 4 }}>
                <View style={[styles.nearHeader]}>
                  <Navigation size={14} color="#10B981" strokeWidth={2.5} />
                  <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0, paddingHorizontal: 0 }]}>
                    Near You
                  </Text>
                  <View style={[styles.nearBadge, { backgroundColor: "#10B98118", borderColor: "#10B98135" }]}>
                    <Text style={{ color: "#10B981", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>{nearby.length} nearby</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {nearby.map((d) => {
                    const km = Number(d.distance_km);
                    return (
                      <View key={d.id}>
                        <DealCard deal={d} size="large" onPress={() => router.push(`/deals/${d.id}` as never)} />
                        {!isNaN(km) && (
                          <View style={styles.distancePill}>
                            <MapPin size={9} color="#10B981" strokeWidth={2.5} />
                            <Text style={{ color: "#10B981", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>
                              {km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── 🎟️ Upcoming Events ── */}
            {eventDeals.length > 0 && activeCategory === "All" && !searchQuery && (
              <View style={{ marginBottom: 4 }}>
                <View style={[styles.nearHeader]}>
                  <Ticket size={14} color="#8B5CF6" strokeWidth={2.5} />
                  <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0, paddingHorizontal: 0 }]}>
                    Upcoming Events
                  </Text>
                  <Pressable onPress={() => setActiveCategory("Events")} style={[styles.nearBadge, { backgroundColor: "#8B5CF618", borderColor: "#8B5CF635" }]}>
                    <Text style={{ color: "#8B5CF6", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>See all</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {eventDeals.slice(0, 5).map((d) => (
                    <View key={d.id} style={styles.eventCardWrap}>
                      <DealCard deal={d} size="large" onPress={() => router.push(`/deals/${d.id}` as never)} />
                      {(d as any).event_venue && (
                        <View style={[styles.venuePill, { backgroundColor: "#8B5CF618", borderColor: "#8B5CF635" }]}>
                          <MapPin size={9} color="#8B5CF6" strokeWidth={2.5} />
                          <Text style={{ color: "#8B5CF6", fontSize: 10, fontFamily: "Inter_600SemiBold" }} numberOfLines={1}>
                            {(d as any).event_venue}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── ⭐ Featured ── */}
            {featured.length > 0 && activeCity === "All" && activeCategory === "All" && !searchQuery && (
              <View style={{ marginBottom: 4 }}>
                <SectionTitle title="⭐ Featured" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {featured.map((d) => (
                    <DealCard key={d.id} deal={d} size="large" onPress={() => router.push(`/deals/${d.id}` as never)} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Cities ── */}
            {cities.length > 0 && (
              <View style={{ marginBottom: 4 }}>
                <SectionTitle title="🏙️ By City" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                  {["All", ...cities.map((c) => c.city)].map((city) => (
                    <Pressable
                      key={city}
                      onPress={() => setActiveCity(city)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: activeCity === city ? colors.primary : colors.card,
                          borderColor: activeCity === city ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: activeCity === city ? "#fff" : colors.foreground }]}>
                        {city}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Categories ── */}
            <View style={{ marginBottom: 8 }}>
              <SectionTitle title="🛍️ Categories" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                {categories.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setActiveCategory(cat)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: activeCategory === cat ? colors.primary : colors.card,
                        borderColor: activeCategory === cat ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: activeCategory === cat ? "#fff" : colors.foreground }]}>
                      {CATEGORY_ICONS[cat] ?? "🏷️"} {cat}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* ── All Deals header ── */}
            <View style={styles.allHeader}>
              <SectionTitle title={`All Deals (${filtered.length})`} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <DealCard deal={item} size="small" onPress={() => router.push(`/deals/${item.id}` as never)} style={{ flex: 1 }} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🔍</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No deals found</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Try a different city or category</Text>
          </View>
        }
      />
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
  );
}

type Deal = {
  id: string; merchant_name: string; merchant_logo?: string; country: string; city?: string;
  title: string; description?: string; category?: string;
  deal_type?: string; event_venue?: string;
  price: number; discount_percent: number; discounted_price: number;
  loyalty_points: number; currency: string; lat?: number; lng?: number;
  end_date: string; start_date?: string; status: string; distance_km?: number;
};

type CityRow = { city: string; deal_count: number };

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle:    { fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSub:      { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  couponsBtn:     { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  couponsBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginVertical: 12,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },

  chip:     { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", paddingHorizontal: 16, marginBottom: 10, marginTop: 4 },
  allHeader:    { marginTop: 8 },

  nearHeader:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, marginBottom: 10, marginTop: 4 },
  nearBadge:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  distancePill: { flexDirection: "row", alignItems: "center", gap: 3, position: "absolute", bottom: 8, left: 8, backgroundColor: "#10B98122", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  eventCardWrap:{ position: "relative" },
  venuePill:    { flexDirection: "row", alignItems: "center", gap: 3, position: "absolute", bottom: 8, left: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },

  empty:     { alignItems: "center", gap: 8, paddingTop: 40, paddingHorizontal: 40 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptySub:  { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});

// ── Expo Router error boundary ─────────────────────────────────────────────────
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 40 }}>😔</Text>
      <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#EF4444" }}>Couldn't load deals</Text>
      <Text style={{ fontSize: 13, color: "#888", textAlign: "center" }}>Something went wrong loading Hot Deals. Please try again.</Text>
      <Pressable
        onPress={retry}
        style={{ marginTop: 12, backgroundColor: "#6366F1", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}
      >
        <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Try Again</Text>
      </Pressable>
    </View>
  );
}
