import { Plane, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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

  useEffect(() => {
    fetch(`${API}/arrive/cities`)
      .then(r => r.json())
      .then(d => setCities(d.cities ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const grouped = cities.reduce<Record<string, City[]>>((acc, c) => {
    if (!acc[c.country]) acc[c.country] = [];
    acc[c.country].push(c);
    return acc;
  }, {});

  const sections = Object.entries(grouped).map(([country, items]) => ({
    country,
    flag: items[0].flag,
    cities: items,
  }));

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

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
          Land fully prepared — hotel, ride, insurance & more
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} size="large" />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={s => s.country}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item: section }) => (
            <View style={{ marginBottom: 24 }}>
              <View style={styles.countryHeader}>
                <Text style={styles.countryFlag}>{section.flag}</Text>
                <Text style={[styles.countryName, { color: colors.mutedForeground }]}>{section.country}</Text>
              </View>
              <View style={[styles.cityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {section.cities.map((city, idx) => (
                  <Pressable
                    key={city.id}
                    onPress={() => router.push({
                      pathname: "/arrive/hub",
                      params: {
                        cityId: city.id,
                        cityName: city.name,
                        country: city.country,
                        flag: city.flag,
                        airport: city.airport_code,
                        symbol: city.symbol,
                      },
                    })}
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
                      <Text style={[styles.cityBadgeText, { color: colors.primary }]}>Plan arrival →</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        />
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
  countryHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  countryFlag: { fontSize: 20 },
  countryName: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  cityCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  cityName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cityAirport: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  cityBadgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
