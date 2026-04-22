import { ArrowLeft, CheckCircle, Package } from "lucide-react-native";
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

interface Hotel { id: string; name: string; stars: number; price_per_night: number; location: string; emoji: string; }
interface Ride { id: string; label: string; price: number; emoji: string; description: string; }
interface Plan { id: string; name: string; price: number; emoji: string; }

export default function ArriveBundleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cityId, cityName, flag, airport, symbol } = useLocalSearchParams<{
    cityId: string; cityName: string; flag: string; airport: string; symbol: string;
  }>();
  const { user, syncBalance } = useRoam();

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [nights, setNights] = useState(2);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [booking, setBooking] = useState(false);

  const sym = symbol || "₦";
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + 100;

  useEffect(() => {
    Promise.all([
      fetch(`${API}/arrive/hotels?cityId=${cityId}`).then(r => r.json()),
      fetch(`${API}/arrive/rides?cityId=${cityId}`).then(r => r.json()),
      fetch(`${API}/arrive/insurance`).then(r => r.json()),
    ]).then(([h, ri, ins]) => {
      const hs = h.hotels ?? [];
      const rs = ri.rides ?? [];
      const ps = ins.plans ?? [];
      setHotels(hs);
      setRides(rs);
      setPlans(ps);
      if (hs.length) setSelectedHotel(hs[0]);
      if (rs.length) setSelectedRide(rs[0]);
      if (ps.length) setSelectedPlan(ps[0]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [cityId]);

  const hotelTotal = (selectedHotel?.price_per_night ?? 0) * nights;
  const rideTotal = selectedRide?.price ?? 0;
  const insuranceTotal = selectedPlan?.price ?? 0;
  const subtotal = hotelTotal + rideTotal + insuranceTotal;
  const discount = Math.round(subtotal * 0.15);
  const total = subtotal - discount;

  async function handleBook() {
    if (!user || !selectedHotel || !selectedRide) return;
    const checkin = new Date(); checkin.setDate(checkin.getDate() + 7);
    const checkout = new Date(checkin); checkout.setDate(checkout.getDate() + nights);
    const pickupTime = new Date(checkin); pickupTime.setHours(14, 0, 0, 0);

    Alert.alert(
      "Confirm Arrival Bundle",
      `🏨 ${selectedHotel.name} (${nights} nights)\n🚗 ${selectedRide.label}\n${selectedPlan ? `🛡 ${selectedPlan.name} Insurance\n` : ""}` +
      `\nSubtotal: ${sym}${subtotal.toLocaleString()}\n15% Bundle Discount: -${sym}${discount.toLocaleString()}\n\nTotal: ${sym}${total.toLocaleString()}\n\nPay from Roam Wallet?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Book Everything",
          onPress: async () => {
            setBooking(true);
            try {
              const r = await fetch(`${API}/arrive/bundle/book`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: user.id,
                  hotelId: selectedHotel.id,
                  checkinDate: checkin.toISOString().split("T")[0],
                  checkoutDate: checkout.toISOString().split("T")[0],
                  nights,
                  rideOptionId: selectedRide.id,
                  airport: `${airport} Airport`,
                  destination: selectedHotel.location,
                  pickupTime: pickupTime.toISOString(),
                  planId: selectedPlan?.id ?? undefined,
                  cityName,
                }),
              });
              const data = await r.json();
              if (!r.ok) throw new Error(data.error || "Bundle booking failed");
              await syncBalance();
              Alert.alert(
                "Bundle Booked! 🎉",
                `Everything is confirmed for ${cityName} ${flag}\n\nRef: ${data.txRef}\nSaved: ${sym}${data.discount.toLocaleString()}\n\nHave an amazing trip!`,
                [{ text: "Done", onPress: () => router.push("/(tabs)") }]
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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: botPad }}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ArrowLeft size={18} color={colors.foreground} strokeWidth={2} />
          </Pressable>
          <View style={styles.headerText}>
            <Package size={22} color={colors.primary} strokeWidth={1.8} />
            <View>
              <Text style={[styles.title, { color: colors.foreground }]}>Arrival Bundle</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{cityName} {flag} · Save 15%</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>🏨 Select Hotel</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
          {hotels.map(h => (
            <Pressable
              key={h.id}
              onPress={() => setSelectedHotel(h)}
              style={[
                styles.hotelChip,
                { backgroundColor: colors.card, borderColor: selectedHotel?.id === h.id ? colors.primary : colors.border },
                selectedHotel?.id === h.id && { borderWidth: 2 },
              ]}
            >
              <Text style={styles.hotelChipEmoji}>{h.emoji}</Text>
              <Text style={[styles.hotelChipName, { color: colors.foreground }]} numberOfLines={1}>{h.name}</Text>
              <Text style={[styles.hotelChipPrice, { color: colors.primary }]}>
                {sym}{(h.price_per_night * nights).toLocaleString()}
              </Text>
              <Text style={[styles.hotelChipNights, { color: colors.mutedForeground }]}>{nights} nights</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={[styles.nightsRow, { marginTop: 12 }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginLeft: 0 }]}>Nights</Text>
          <View style={styles.nightsStepper}>
            {[1, 2, 3, 4, 5].map(n => (
              <Pressable
                key={n}
                onPress={() => setNights(n)}
                style={[
                  styles.nightsBtn,
                  { backgroundColor: nights === n ? colors.primary : colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.nightsBtnText, { color: nights === n ? "#fff" : colors.foreground }]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>🚘 Airport Ride</Text>
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          {rides.map(r => (
            <Pressable
              key={r.id}
              onPress={() => setSelectedRide(r)}
              style={[
                styles.rideRow,
                { backgroundColor: colors.card, borderColor: selectedRide?.id === r.id ? colors.primary : colors.border },
                selectedRide?.id === r.id && { borderWidth: 2 },
              ]}
            >
              <Text style={styles.rideEmoji}>{r.emoji}</Text>
              <Text style={[styles.rideLabel, { color: colors.foreground, flex: 1 }]}>{r.label}</Text>
              <Text style={[styles.ridePrice, { color: colors.primary }]}>{sym}{r.price.toLocaleString()}</Text>
              {selectedRide?.id === r.id && <CheckCircle size={16} color={colors.primary} strokeWidth={2} style={{ marginLeft: 6 }} />}
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 20 }]}>🛡 Insurance (optional)</Text>
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          <Pressable
            onPress={() => setSelectedPlan(null)}
            style={[styles.rideRow, { backgroundColor: colors.card, borderColor: !selectedPlan ? colors.primary : colors.border }, !selectedPlan && { borderWidth: 2 }]}
          >
            <Text style={styles.rideEmoji}>❌</Text>
            <Text style={[styles.rideLabel, { color: colors.foreground, flex: 1 }]}>No Insurance</Text>
            {!selectedPlan && <CheckCircle size={16} color={colors.primary} strokeWidth={2} />}
          </Pressable>
          {plans.map(p => (
            <Pressable
              key={p.id}
              onPress={() => setSelectedPlan(p)}
              style={[
                styles.rideRow,
                { backgroundColor: colors.card, borderColor: selectedPlan?.id === p.id ? colors.primary : colors.border },
                selectedPlan?.id === p.id && { borderWidth: 2 },
              ]}
            >
              <Text style={styles.rideEmoji}>{p.emoji}</Text>
              <Text style={[styles.rideLabel, { color: colors.foreground, flex: 1 }]}>{p.name}</Text>
              <Text style={[styles.ridePrice, { color: colors.primary }]}>{sym}{p.price.toLocaleString()}</Text>
              {selectedPlan?.id === p.id && <CheckCircle size={16} color={colors.primary} strokeWidth={2} style={{ marginLeft: 6 }} />}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.footerPricing}>
          <View style={styles.footerRow}>
            <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
            <Text style={[styles.footerValue, { color: colors.foreground }]}>{sym}{subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={[styles.footerLabel, { color: "#10B981" }]}>Bundle Discount (15%)</Text>
            <Text style={[styles.footerValue, { color: "#10B981" }]}>-{sym}{discount.toLocaleString()}</Text>
          </View>
          <View style={[styles.footerRow, { marginTop: 4 }]}>
            <Text style={[styles.footerTotal, { color: colors.foreground }]}>Total</Text>
            <Text style={[styles.footerTotalAmount, { color: colors.primary }]}>{sym}{total.toLocaleString()}</Text>
          </View>
        </View>
        <Pressable
          onPress={handleBook}
          disabled={!selectedHotel || !selectedRide || booking}
          style={[styles.bookBtn, { backgroundColor: selectedHotel && selectedRide ? colors.primary : colors.border }]}
        >
          {booking
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.bookBtnText}>Book Everything — {sym}{total.toLocaleString()}</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  headerText: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, marginLeft: 20, marginBottom: 10, marginTop: 20 },
  hotelChip: { width: 160, borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  hotelChipEmoji: { fontSize: 24 },
  hotelChipName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  hotelChipPrice: { fontSize: 14, fontFamily: "Inter_700Bold" },
  hotelChipNights: { fontSize: 11, fontFamily: "Inter_400Regular" },
  nightsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 4 },
  nightsStepper: { flexDirection: "row", gap: 6 },
  nightsBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  nightsBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rideRow: { borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  rideEmoji: { fontSize: 22 },
  rideLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  ridePrice: { fontSize: 14, fontFamily: "Inter_700Bold" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 16 },
  footerPricing: { gap: 4, marginBottom: 12 },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  footerValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  footerTotal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  footerTotalAmount: { fontSize: 18, fontFamily: "Inter_700Bold" },
  bookBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  bookBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
