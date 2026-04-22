import { ArrowLeft, ArrowRight, ChevronDown, Clock, Plane, Users } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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

interface FlightResult {
  id: string;
  airline: string;
  flight_num: string;
  from_city: string;
  to_city: string;
  from_code: string;
  to_code: string;
  dep_time: string;
  arr_time: string;
  duration_min: number;
  price: number;
  total: number;
  passengers: number;
}

const CITIES = ["Lagos", "Abuja", "Nairobi", "Accra", "Johannesburg"];

function fmt(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}
function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
}

type Step = "search" | "results" | "confirm";

export default function FlightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useRoam() as any;
  const { cityName } = useLocalSearchParams<{ cityName?: string }>();

  const [step, setStep] = useState<Step>("search");
  const [fromCity, setFromCity] = useState("Lagos");
  const [toCity, setToCity] = useState(cityName ?? "Accra");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [passengers, setPassengers] = useState(1);
  const [flights, setFlights] = useState<FlightResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FlightResult | null>(null);
  const [booking, setBooking] = useState(false);
  const [cityPicker, setCityPicker] = useState<"from" | "to" | null>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  async function doSearch() {
    if (fromCity === toCity) {
      Alert.alert("Same city", "Please choose different origin and destination.");
      return;
    }
    setSearching(true);
    setStep("results");
    try {
      const r = await fetch(`${API}/arrive/tickets/flights/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromCity, toCity, passengers }),
      });
      const d = await r.json();
      setFlights(d.flights ?? []);
    } catch {
      Alert.alert("Error", "Could not load flights. Please try again.");
      setStep("search");
    } finally {
      setSearching(false);
    }
  }

  async function doBook() {
    if (!selected || !user?.id) return;
    setBooking(true);
    try {
      const r = await fetch(`${API}/arrive/tickets/flights/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, scheduleId: selected.id, travelDate: date, passengers }),
      });
      const d = await r.json();
      if (!r.ok) { Alert.alert("Booking Failed", d.error ?? "Try again."); return; }
      Alert.alert(
        "Booking Confirmed ✅",
        `Flight ${selected.airline} ${selected.flight_num}\nPNR: ${d.pnr}\n${selected.from_city} → ${selected.to_city}\n${date}\n\n${fmt(d.total)} debited from wallet.`,
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch {
      Alert.alert("Error", "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  const displayDate = useMemo(() => {
    try {
      return new Date(date + "T00:00:00").toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    } catch { return date; }
  }, [date]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={step === "search" ? () => router.back() : () => setStep(step === "confirm" ? "results" : "search")}
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ArrowLeft size={18} color={colors.foreground} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Flights</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {step === "search" ? "Search inter-Africa flights" : step === "results" ? `${fromCity} → ${toCity}` : "Confirm booking"}
          </Text>
        </View>
      </View>

      {/* ── SEARCH STEP ── */}
      {step === "search" && (
        <ScrollView contentContainerStyle={styles.searchContent}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FROM</Text>
            <Pressable onPress={() => setCityPicker("from")} style={[styles.cityPicker, { borderColor: colors.border }]}>
              <Plane size={16} color={colors.primary} strokeWidth={1.8} />
              <Text style={[styles.cityPickerText, { color: colors.foreground }]}>{fromCity}</Text>
              <ChevronDown size={16} color={colors.mutedForeground} strokeWidth={2} />
            </Pressable>

            <View style={styles.swapRow}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Pressable onPress={() => { const t = fromCity; setFromCity(toCity); setToCity(t); }}
                style={[styles.swapBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
                <Text style={[styles.swapText, { color: colors.primary }]}>⇅</Text>
              </Pressable>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TO</Text>
            <Pressable onPress={() => setCityPicker("to")} style={[styles.cityPicker, { borderColor: colors.border }]}>
              <Plane size={16} color="#10B981" strokeWidth={1.8} />
              <Text style={[styles.cityPickerText, { color: colors.foreground }]}>{toCity}</Text>
              <ChevronDown size={16} color={colors.mutedForeground} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TRAVEL DATE</Text>
            <View style={styles.dateRow}>
              {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                const d = new Date(); d.setDate(d.getDate() + 7 + offset);
                const iso = d.toISOString().split("T")[0];
                const isSelected = date === iso;
                const dayName = d.toLocaleDateString("en-NG", { weekday: "short" });
                const dayNum = d.getDate();
                return (
                  <Pressable key={iso} onPress={() => setDate(iso)}
                    style={[styles.dateChip, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : colors.card }]}>
                    <Text style={[styles.dateChipDay, { color: isSelected ? "#fff" : colors.mutedForeground }]}>{dayName}</Text>
                    <Text style={[styles.dateChipNum, { color: isSelected ? "#fff" : colors.foreground }]}>{dayNum}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PASSENGERS</Text>
            <View style={styles.passengerRow}>
              <Users size={18} color={colors.primary} strokeWidth={1.8} />
              <Text style={[styles.passengerCount, { color: colors.foreground }]}>{passengers} {passengers === 1 ? "Passenger" : "Passengers"}</Text>
              <View style={styles.passengerControls}>
                <Pressable onPress={() => setPassengers(Math.max(1, passengers - 1))}
                  style={[styles.counterBtn, { backgroundColor: colors.border }]}>
                  <Text style={[styles.counterBtnText, { color: colors.foreground }]}>−</Text>
                </Pressable>
                <Pressable onPress={() => setPassengers(Math.min(9, passengers + 1))}
                  style={[styles.counterBtn, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.counterBtnText, { color: "#fff" }]}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <Pressable onPress={doSearch} style={[styles.searchBtn, { backgroundColor: colors.primary }]}>
            <Plane size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.searchBtnText}>Search Flights</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── RESULTS STEP ── */}
      {step === "results" && (
        <>
          <View style={[styles.routeBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.routeText, { color: colors.foreground }]}>{fromCity}</Text>
            <ArrowRight size={14} color={colors.mutedForeground} strokeWidth={2} />
            <Text style={[styles.routeText, { color: colors.foreground }]}>{toCity}</Text>
            <View style={[styles.routeSep, { backgroundColor: colors.border }]} />
            <Text style={[styles.routeSub, { color: colors.mutedForeground }]}>{displayDate} · {passengers} pax</Text>
          </View>
          {searching ? (
            <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 60 }} />
          ) : flights.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>✈️</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No flights found</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>No scheduled flights for this route yet.</Text>
              <Pressable onPress={() => setStep("search")} style={[styles.backToSearch, { backgroundColor: colors.primary }]}>
                <Text style={styles.backToSearchText}>Change Route</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={flights}
              keyExtractor={f => f.id}
              contentContainerStyle={{ padding: 20, gap: 14 }}
              renderItem={({ item: f }) => (
                <Pressable onPress={() => { setSelected(f); setStep("confirm"); }}
                  style={[styles.flightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.flightTop}>
                    <Text style={[styles.flightAirline, { color: colors.foreground }]}>{f.airline}</Text>
                    <Text style={[styles.flightNum, { color: colors.mutedForeground }]}>{f.flight_num}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.flightPrice, { color: colors.primary }]}>{fmt(f.price)}</Text>
                  </View>
                  <View style={styles.flightRoute}>
                    <View style={{ alignItems: "center" }}>
                      <Text style={[styles.flightTime, { color: colors.foreground }]}>{f.dep_time}</Text>
                      <Text style={[styles.flightCode, { color: colors.mutedForeground }]}>{f.from_code}</Text>
                    </View>
                    <View style={styles.flightLine}>
                      <View style={[styles.flightDot, { backgroundColor: colors.primary }]} />
                      <View style={[styles.flightDash, { backgroundColor: colors.border }]} />
                      <Plane size={14} color={colors.primary} strokeWidth={1.8} />
                      <View style={[styles.flightDash, { backgroundColor: colors.border }]} />
                      <View style={[styles.flightDot, { backgroundColor: colors.primary }]} />
                    </View>
                    <View style={{ alignItems: "center" }}>
                      <Text style={[styles.flightTime, { color: colors.foreground }]}>{f.arr_time}</Text>
                      <Text style={[styles.flightCode, { color: colors.mutedForeground }]}>{f.to_code}</Text>
                    </View>
                  </View>
                  <View style={styles.flightBottom}>
                    <Clock size={12} color={colors.mutedForeground} strokeWidth={1.8} />
                    <Text style={[styles.flightDuration, { color: colors.mutedForeground }]}>{fmtDuration(f.duration_min)}</Text>
                    {passengers > 1 && (
                      <Text style={[styles.flightTotal, { color: colors.primary }]}>Total: {fmt(f.total)}</Text>
                    )}
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.selectText, { color: colors.primary }]}>Select →</Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </>
      )}

      {/* ── CONFIRM STEP ── */}
      {step === "confirm" && selected && (
        <ScrollView contentContainerStyle={styles.confirmContent}>
          <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.confirmAirline, { backgroundColor: colors.primary + "12" }]}>
              <Plane size={24} color={colors.primary} strokeWidth={1.8} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.confirmAirlineName, { color: colors.foreground }]}>{selected.airline}</Text>
                <Text style={[styles.confirmFlightNum, { color: colors.mutedForeground }]}>{selected.flight_num}</Text>
              </View>
            </View>
            <View style={styles.confirmRouteRow}>
              <View style={{ alignItems: "center" }}>
                <Text style={[styles.confirmCode, { color: colors.foreground }]}>{selected.from_code}</Text>
                <Text style={[styles.confirmCity, { color: colors.mutedForeground }]}>{selected.from_city}</Text>
                <Text style={[styles.confirmTime, { color: colors.primary }]}>{selected.dep_time}</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={[styles.confirmDuration, { color: colors.mutedForeground }]}>{fmtDuration(selected.duration_min)}</Text>
                <View style={[styles.confirmDash, { backgroundColor: colors.border }]} />
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={[styles.confirmCode, { color: colors.foreground }]}>{selected.to_code}</Text>
                <Text style={[styles.confirmCity, { color: colors.mutedForeground }]}>{selected.to_city}</Text>
                <Text style={[styles.confirmTime, { color: colors.primary }]}>{selected.arr_time}</Text>
              </View>
            </View>
          </View>

          {[
            ["Travel Date", displayDate],
            ["Passengers", `${passengers} ${passengers === 1 ? "Passenger" : "Passengers"}`],
            ["Price per seat", fmt(selected.price)],
            ...(passengers > 1 ? [["Total", fmt(selected.total)]] : []),
          ].map(([label, value]) => (
            <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
            </View>
          ))}

          <View style={[styles.totalBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "25" }]}>
            <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Amount to debit from wallet</Text>
            <Text style={[styles.totalAmt, { color: colors.primary }]}>{fmt(selected.total)}</Text>
          </View>

          <Pressable onPress={doBook} disabled={booking}
            style={[styles.bookBtn, { backgroundColor: booking ? colors.mutedForeground : colors.primary }]}>
            {booking ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Plane size={18} color="#fff" strokeWidth={2} />
                <Text style={styles.bookBtnText}>Confirm & Pay {fmt(selected.total)}</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}

      {/* City picker modal */}
      <Modal visible={cityPicker !== null} animationType="slide" transparent onRequestClose={() => setCityPicker(null)}>
        <Pressable style={styles.overlay} onPress={() => setCityPicker(null)} />
        <View style={[styles.pickerSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.pickerHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.pickerTitle, { color: colors.foreground }]}>
            {cityPicker === "from" ? "Flying from" : "Flying to"}
          </Text>
          {CITIES.map(city => (
            <Pressable key={city} onPress={() => {
              if (cityPicker === "from") setFromCity(city);
              else setToCity(city);
              setCityPicker(null);
            }}
              style={[styles.pickerItem, { borderBottomColor: colors.border,
                backgroundColor: (cityPicker === "from" ? fromCity : toCity) === city ? colors.primary + "12" : "transparent" }]}>
              <Text style={[styles.pickerItemText, { color: colors.foreground }]}>{city}</Text>
              {(cityPicker === "from" ? fromCity : toCity) === city && (
                <Text style={[styles.pickerCheck, { color: colors.primary }]}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  searchContent: { padding: 20, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 8 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  cityPicker: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  cityPickerText: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  swapRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  divider: { flex: 1, height: 1 },
  swapBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  swapText: { fontSize: 18 },
  dateRow: { flexDirection: "row", gap: 6 },
  dateChip: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 8, alignItems: "center" },
  dateChipDay: { fontSize: 10, fontFamily: "Inter_500Medium" },
  dateChipNum: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 2 },
  passengerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  passengerCount: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  passengerControls: { flexDirection: "row", gap: 8 },
  counterBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  counterBtnText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  searchBtn: { borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 6 },
  searchBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  routeBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  routeText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  routeSep: { width: 1, height: 14, marginHorizontal: 4 },
  routeSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 8 },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  backToSearch: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backToSearchText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  flightCard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 14 },
  flightTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  flightAirline: { fontSize: 15, fontFamily: "Inter_700Bold" },
  flightNum: { fontSize: 12, fontFamily: "Inter_400Regular" },
  flightPrice: { fontSize: 17, fontFamily: "Inter_700Bold" },
  flightRoute: { flexDirection: "row", alignItems: "center", gap: 8 },
  flightTime: { fontSize: 18, fontFamily: "Inter_700Bold" },
  flightCode: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  flightLine: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  flightDot: { width: 6, height: 6, borderRadius: 3 },
  flightDash: { flex: 1, height: 1 },
  flightBottom: { flexDirection: "row", alignItems: "center", gap: 6 },
  flightDuration: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  flightTotal: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  selectText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  confirmContent: { padding: 20, gap: 0 },
  confirmCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
  confirmAirline: { flexDirection: "row", alignItems: "center", padding: 20 },
  confirmAirlineName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  confirmFlightNum: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  confirmRouteRow: { flexDirection: "row", alignItems: "center", padding: 20, paddingTop: 0 },
  confirmCode: { fontSize: 24, fontFamily: "Inter_700Bold" },
  confirmCity: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2, textAlign: "center" },
  confirmTime: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 6 },
  confirmDuration: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 6 },
  confirmDash: { width: "80%", height: 1 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  detailValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  totalBox: { borderRadius: 14, borderWidth: 1, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 16 },
  totalLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  totalAmt: { fontSize: 22, fontFamily: "Inter_700Bold" },
  bookBtn: { borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  bookBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  pickerSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 },
  pickerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", paddingHorizontal: 20, paddingVertical: 12 },
  pickerItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerItemText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  pickerCheck: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
