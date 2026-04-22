import { ChevronDown, ChevronRight, Plane, Search, X } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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

export default function ArriveDestinationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

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
        c.airport_code.toLowerCase().includes(q)
    );
  }, [cities, query]);

  const grouped = useMemo(() => {
    const acc: Record<string, City[]> = {};
    for (const c of filtered) {
      if (!acc[c.country]) acc[c.country] = [];
      acc[c.country].push(c);
    }
    return Object.entries(acc).map(([country, items]) => ({
      country,
      flag: items[0].flag,
      cities: items,
    }));
  }, [filtered]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  function handleSelect(city: City) {
    setSelectedCity(city);
    setDropdownOpen(false);
    setQuery("");
  }

  function handleContinue() {
    if (!selectedCity) return;
    router.push({
      pathname: "/arrive/hub",
      params: {
        cityId: selectedCity.id,
        cityName: selectedCity.name,
        country: selectedCity.country,
        flag: selectedCity.flag,
        airport: selectedCity.airport_code,
        symbol: selectedCity.symbol,
      },
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Roam Arrive</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Where are you going?</Text>
          </View>
          <Pressable onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <X size={18} color={colors.mutedForeground} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.banner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
        <Plane size={18} color={colors.primary} strokeWidth={1.8} />
        <Text style={[styles.bannerText, { color: colors.primary }]}>
          Land fully prepared — flights, hotel, ride, insurance & more
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>SELECT DESTINATION</Text>

        {/* Dropdown trigger */}
        <Pressable
          onPress={() => setDropdownOpen(true)}
          style={[styles.dropdownTrigger, { backgroundColor: colors.card, borderColor: selectedCity ? colors.primary : colors.border }]}
        >
          {selectedCity ? (
            <View style={styles.selectedRow}>
              <Text style={styles.selectedFlag}>{selectedCity.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.selectedCity, { color: colors.foreground }]}>{selectedCity.name}</Text>
                <Text style={[styles.selectedSub, { color: colors.mutedForeground }]}>{selectedCity.country} · {selectedCity.airport_code}</Text>
              </View>
              <ChevronDown size={18} color={colors.primary} strokeWidth={2} />
            </View>
          ) : (
            <View style={styles.placeholderRow}>
              <Search size={18} color={colors.mutedForeground} strokeWidth={1.8} />
              <Text style={[styles.placeholder, { color: colors.mutedForeground }]}>Choose city or country…</Text>
              <ChevronDown size={18} color={colors.mutedForeground} strokeWidth={2} />
            </View>
          )}
        </Pressable>

        {/* Continue button */}
        {selectedCity && (
          <Pressable
            onPress={handleContinue}
            style={[styles.continueBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.continueBtnText}>Plan my arrival in {selectedCity.name}</Text>
            <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
          </Pressable>
        )}
      </View>

      {/* Dropdown modal */}
      <Modal
        visible={dropdownOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDropdownOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDropdownOpen(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Search size={16} color={colors.mutedForeground} strokeWidth={1.8} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search city or country…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")}>
                <X size={16} color={colors.mutedForeground} strokeWidth={2} />
              </Pressable>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} size="large" />
          ) : (
            <FlatList
              data={grouped}
              keyExtractor={s => s.country}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
              renderItem={({ item: section }) => (
                <View style={{ marginBottom: 20 }}>
                  <View style={styles.countryHeader}>
                    <Text style={styles.countryFlag}>{section.flag}</Text>
                    <Text style={[styles.countryName, { color: colors.mutedForeground }]}>{section.country}</Text>
                  </View>
                  <View style={[styles.cityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {section.cities.map((city, idx) => (
                      <Pressable
                        key={city.id}
                        onPress={() => handleSelect(city)}
                        style={[
                          styles.cityRow,
                          idx < section.cities.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                          selectedCity?.id === city.id && { backgroundColor: colors.primary + "12" },
                        ]}
                      >
                        <View>
                          <Text style={[styles.cityName, { color: colors.foreground }]}>{city.name}</Text>
                          <Text style={[styles.cityAirport, { color: colors.mutedForeground }]}>{city.airport_code} Airport</Text>
                        </View>
                        {selectedCity?.id === city.id ? (
                          <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.checkText}>✓</Text>
                          </View>
                        ) : (
                          <ChevronRight size={16} color={colors.mutedForeground} strokeWidth={1.8} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No cities found for "{query}"</Text>
              }
            />
          )}
        </View>
      </Modal>

      {/* Direct city list below when no selection yet */}
      {!selectedCity && !loading && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <Text style={[styles.orLabel, { color: colors.mutedForeground }]}>— or tap a destination —</Text>
          {grouped.map(section => (
            <View key={section.country} style={{ marginBottom: 20 }}>
              <View style={styles.countryHeader}>
                <Text style={styles.countryFlag}>{section.flag}</Text>
                <Text style={[styles.countryName, { color: colors.mutedForeground }]}>{section.country}</Text>
              </View>
              <View style={[styles.cityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {section.cities.map((city, idx) => (
                  <Pressable
                    key={city.id}
                    onPress={() => handleSelect(city)}
                    style={[
                      styles.cityRow,
                      idx < section.cities.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    ]}
                  >
                    <View>
                      <Text style={[styles.cityName, { color: colors.foreground }]}>{city.name}</Text>
                      <Text style={[styles.cityAirport, { color: colors.mutedForeground }]}>Airport: {city.airport_code}</Text>
                    </View>
                    <View style={[styles.cityBadge, { backgroundColor: colors.primary + "15" }]}>
                      <Text style={[styles.cityBadgeText, { color: colors.primary }]}>Select →</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 4 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginBottom: 20, padding: 14, borderRadius: 12, borderWidth: 1 },
  bannerText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  dropdownTrigger: { borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 12 },
  placeholderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  placeholder: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  selectedRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  selectedFlag: { fontSize: 24 },
  selectedCity: { fontSize: 16, fontFamily: "Inter_700Bold" },
  selectedSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  continueBtn: { borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  continueBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "75%", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginBottom: 16, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  countryHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  countryFlag: { fontSize: 20 },
  countryName: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  cityCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  cityName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cityAirport: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  cityBadgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  checkBadge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  checkText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  emptyText: { textAlign: "center", marginTop: 40, fontSize: 14, fontFamily: "Inter_400Regular" },
  orLabel: { textAlign: "center", fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 16, letterSpacing: 0.3 },
});
