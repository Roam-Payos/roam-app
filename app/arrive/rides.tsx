import { ArrowLeft } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useRoam } from "@/context/RoamContext";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface RideOption {
  id: string;
  car_type: string;
  label: string;
  price: number;
  pax: number;
  description: string;
  emoji: string;
}

export default function ArriveRidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cityId, cityName, flag, airport, symbol } = useLocalSearchParams<{
    cityId: string; cityName: string; flag: string; airport: string; symbol: string;
  }>();
  const { user, syncBalance } = useRoam();
  const [rides, setRides] = useState<RideOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RideOption | null>(null);
  const [destination, setDestination] = useState("");
  const [booking, setBooking] = useState(false);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + 24;
  const sym = symbol || "₦";

  useEffect(() => {
    fetch(`${API}/arrive/rides?cityId=${cityId}`)
      .then(r => r.json())
      .then(d => setRides(d.rides ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cityId]);

  async function handleBook() {
    if (!user || !selected || !destination.trim()) return;
    const pickupTime = new Date();
    pickupTime.setDate(pickupTime.getDate() + 7);
    pickupTime.setHours(14, 0, 0, 0);

    Alert.alert(
      `Book ${selected.label}`,
      `From: ${airport} Airport\nTo: ${destination}\nPickup: ${pickupTime.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}\n\nTotal: ${sym}${selected.price.toLocaleString()}\n\nPay from Roam Wallet?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm & Pay",
          onPress: async () => {
            setBooking(true);
            try {
              const r = await fetch(`${API}/arrive/rides/book`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: user.id,
                  rideOptionId: selected.id,
                  airport: `${airport} Airport`,
                  destination: destination.trim(),
                  pickupTime: pickupTime.toISOString(),
                }),
              });
              const data = await r.json();
              if (!r.ok) throw new Error(data.error || "Booking failed");
              await syncBalance();
              Alert.alert(
                "Ride Booked! 🚗",
                `${selected.label}\n\nRef: ${data.txRef}\nDriver will be waiting at the arrivals hall.\n\nSafe travels!`,
                [{ text: "Done", onPress: () => router.back() }]
              );
            } catch (err: any) {
              Alert.alert("Booking Failed", err.message || "Please try again.");
            } finally {
              setBooking(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: botPad }} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ArrowLeft size={18} color={colors.foreground} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Airport Ride in {cityName} {flag}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Fixed pricing · Driver waiting at arrivals
          </Text>
        </View>

        <View style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.routeText, { color: colors.foreground }]}>{airport} Airport</Text>
          </View>
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: "#10B981" }]} />
            <TextInput
              placeholder="Enter your destination…"
              placeholderTextColor={colors.mutedForeground}
              value={destination}
              onChangeText={setDestination}
              style={[styles.destInput, { color: colors.foreground }]}
            />
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Choose your ride</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} size="large" />
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            {rides.map(ride => (
              <Pressable
                key={ride.id}
                onPress={() => setSelected(selected?.id === ride.id ? null : ride)}
                style={[
                  styles.rideCard,
                  { backgroundColor: colors.card, borderColor: selected?.id === ride.id ? colors.primary : colors.border },
                  selected?.id === ride.id && { borderWidth: 2 },
                ]}
              >
                <Text style={styles.rideEmoji}>{ride.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rideLabel, { color: colors.foreground }]}>{ride.label}</Text>
                  <Text style={[styles.rideDesc, { color: colors.mutedForeground }]}>{ride.description}</Text>
                  <Text style={[styles.ridePax, { color: colors.mutedForeground }]}>Up to {ride.pax} passengers</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.ridePrice, { color: colors.primary }]}>
                    {sym}{ride.price.toLocaleString()}
                  </Text>
                  <Text style={[styles.rideFixed, { color: colors.mutedForeground }]}>Fixed</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {selected && (
          <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <Pressable
              onPress={handleBook}
              disabled={!destination.trim() || booking}
              style={[
                styles.bookBtn,
                { backgroundColor: destination.trim() ? colors.primary : colors.border },
              ]}
            >
              {booking
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.bookBtnText}>
                    Book {selected.label} — {sym}{selected.price.toLocaleString()}
                  </Text>
              }
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2, marginBottom: 0 },
  routeCard: { marginHorizontal: 20, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  routeLine: { width: 2, height: 20, marginLeft: 4, marginVertical: 4 },
  destInput: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1, paddingVertical: 2 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, marginLeft: 20, marginBottom: 12 },
  rideCard: { borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  rideEmoji: { fontSize: 32 },
  rideLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rideDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 2 },
  ridePax: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  ridePrice: { fontSize: 16, fontFamily: "Inter_700Bold" },
  rideFixed: { fontSize: 11, fontFamily: "Inter_400Regular" },
  bookBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  bookBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
