import { ArrowLeft, Star, Wifi } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useRoam } from "@/context/RoamContext";

const API = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface Hotel {
  id: string;
  name: string;
  stars: number;
  price_per_night: number;
  location: string;
  description: string;
  emoji: string;
  amenities: string[];
}

function StarRow({ stars }: { stars: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {Array.from({ length: stars }).map((_, i) => (
        <Star key={i} size={10} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
      ))}
    </View>
  );
}

export default function ArriveHotelsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cityId, cityName, flag, symbol } = useLocalSearchParams<{
    cityId: string; cityName: string; flag: string; symbol: string;
  }>();
  const { user, syncBalance } = useRoam();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<string | null>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + 24;
  const sym = symbol || "₦";

  useEffect(() => {
    fetch(`${API}/arrive/hotels?cityId=${cityId}`)
      .then(r => r.json())
      .then(d => setHotels(d.hotels ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cityId]);

  async function handleBook(hotel: Hotel) {
    if (!user) return;

    const checkin = new Date();
    checkin.setDate(checkin.getDate() + 7);
    const checkout = new Date(checkin);
    checkout.setDate(checkout.getDate() + 2);

    const fmt = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

    Alert.alert(
      `Book ${hotel.name}`,
      `Check-in: ${fmt(checkin)}\nCheck-out: ${fmt(checkout)}\n2 nights\n\nTotal: ${sym}${(hotel.price_per_night * 2).toLocaleString()}\n\nPay from Roam Wallet?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm & Pay",
          onPress: async () => {
            setBooking(hotel.id);
            try {
              const r = await fetch(`${API}/arrive/hotels/book`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: user.id,
                  hotelId: hotel.id,
                  checkinDate: checkin.toISOString().split("T")[0],
                  checkoutDate: checkout.toISOString().split("T")[0],
                  nights: 2,
                }),
              });
              const data = await r.json();
              if (!r.ok) throw new Error(data.error || "Booking failed");
              await syncBalance();
              Alert.alert(
                "Booking Confirmed! 🏨",
                `${hotel.name}\n\nRef: ${data.txRef}\nCheck-in: ${fmt(checkin)}\nCheck-out: ${fmt(checkout)}\n\nHave a wonderful stay!`,
                [{ text: "Done", onPress: () => router.back() }]
              );
            } catch (err: any) {
              Alert.alert("Booking Failed", err.message || "Please try again.");
            } finally {
              setBooking(null);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: botPad }}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ArrowLeft size={18} color={colors.foreground} strokeWidth={2} />
          </Pressable>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Hotels in {cityName} {flag}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Select a hotel for your stay</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} size="large" />
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 16 }}>
            {hotels.map(hotel => (
              <View key={hotel.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardTop}>
                  <View style={styles.hotelInfo}>
                    <Text style={styles.hotelEmoji}>{hotel.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <StarRow stars={hotel.stars} />
                      <Text style={[styles.hotelName, { color: colors.foreground }]}>{hotel.name}</Text>
                      <Text style={[styles.hotelLocation, { color: colors.mutedForeground }]}>📍 {hotel.location}</Text>
                    </View>
                  </View>
                  <View style={styles.priceBlock}>
                    <Text style={[styles.price, { color: colors.primary }]}>
                      {sym}{hotel.price_per_night.toLocaleString()}
                    </Text>
                    <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>/night</Text>
                  </View>
                </View>

                <Text style={[styles.hotelDesc, { color: colors.mutedForeground }]}>{hotel.description}</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {(hotel.amenities || []).map(a => (
                      <View key={a} style={[styles.amenityTag, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[styles.amenityText, { color: colors.mutedForeground }]}>{a}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                <Pressable
                  onPress={() => handleBook(hotel)}
                  disabled={booking === hotel.id}
                  style={[styles.bookBtn, { backgroundColor: colors.primary, opacity: booking === hotel.id ? 0.6 : 1 }]}
                >
                  {booking === hotel.id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.bookBtnText}>Book — {sym}{(hotel.price_per_night * 2).toLocaleString()} (2 nights)</Text>
                  }
                </Pressable>
              </View>
            ))}
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
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  hotelInfo: { flexDirection: "row", gap: 10, flex: 1 },
  hotelEmoji: { fontSize: 32 },
  hotelName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 4, flexShrink: 1 },
  hotelLocation: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  priceBlock: { alignItems: "flex-end", marginLeft: 8 },
  price: { fontSize: 17, fontFamily: "Inter_700Bold" },
  priceLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  hotelDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  amenityTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  amenityText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  bookBtn: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  bookBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
