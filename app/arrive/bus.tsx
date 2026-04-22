import { ArrowLeft, ArrowRight, Bus, ChevronDown, Clock, Users } from "lucide-react-native";
import React, { useMemo, useState } from "react";
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

interface BusRoute {
  id: string;
  from_city: string;
  to_city: string;
  operator: string;
  dep_time: string;
  duration_hours: number;
  price: number;
  seat_class: string;
  seats_available: number;
}

const CITY_ROUTES: Record<string, string[]> = {
  Lagos: ["Abuja", "Benin City", "Ibadan"],
  Abuja: ["Lagos", "Kaduna"],
  Accra: ["Kumasi"],
  Nairobi: ["Mombasa"],
  Johannesburg: ["Durban"],
};
const ALL_CITIES = Object.keys(CITY_ROUTES);

function fmt(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}
function fmtDuration(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return hrs > 0 ? `${hrs}h ${mins > 0 ? mins + "m" : ""}`.trim() : `${mins}m`;
}

type Step = "search" | "results" | "confirm";

export default function BusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useRoam() as any;
  const { cityName } = useLocalSearchParams<{ cityName?: string }>();

  const [step, setStep] = useState<Step>("search");
  const [fromCity, setFromCity] = useState("Lagos");
  const [toCity, setToCity] = useState(() => {
    const dest = cityName ?? "";
    const options = CITY_ROUTES[dest] ?? [];
    return options[0] ?? "Abuja";
  });
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });
  const [passengers, setPassengers] = useState(1);
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<BusRoute | null>(null);
  const [booking, setBooking] = useState(false);
  const [cityPicker, setCityPicker] = useState<"from" | "to" | null>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const toOptions = useMemo(() => CITY_ROUTES[fromCity] ?? ALL_CITIES.filter(c => c !== fromCity), [fromCity]);

  const displayDate = useMemo(() => {
    try {
      return new Date(date + "T00:00:00").toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    } catch { return date; }
  }, [date]);

  async function doSearch() {
    if (fromCity === toCity) { Alert.alert("Same city", "Please choose different origin and destination."); return; }
    setSearching(true);
    setStep("results");
    try {
      const r = await fetch(`${API}/arrive/tickets/bus/routes?from=${encodeURIComponent(fromCity)}&to=${encodeURIComponent(toCity)}`);
      const d = await r.json();
      setRoutes(d.routes ?? []);
    } catch {
      Alert.alert("Error", "Could not load routes. Please try again.");
      setStep("search");
    } finally {
      setSearching(false);
    }
  }

  async function doBook() {
    if (!selected || !user?.id) return;
    setBooking(true);
    try {
      const r = await fetch(`${API}/arrive/tickets/bus/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, routeId: selected.id, travelDate: date, passengers }),
      });
      const d = await r.json();
      if (!r.ok) { Alert.alert("Booking Failed", d.error ?? "Try again."); return; }
      Alert.alert(
        "Booking Confirmed ✅",
        `${selected.operator}\n${selected.from_city} → ${selected.to_city}\nDate: ${date}\nSeat: ${d.seatNumber}\n\n${fmt(d.total)} debited from wallet.`,
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch {
      Alert.alert("Error", "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  const classLabel: Record<string, string> = { standard: "Standard", executive: "Executive", luxury: "Luxury" };
  const classColor: Record<string, string> = { standard: "#6B7280", executive: "#6366F1", luxury: "#F59E0B" };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={step === "search" ? () => router.back() : () => setStep(step === "confirm" ? "results" : "search")}
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ArrowLeft size={18} color={colors.foreground} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Bus / Transport</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {step === "search" ? "Ground travel across Africa" : step === "results" ? `${fromCity} → ${toCity}` : "Confirm booking"}
          </Text>
        </View>
      </View>

      {/* ── SEARCH ── */}
      {step === "search" && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FROM</Text>
            <Pressable onPress={() => setCityPicker("from")} style={[styles.picker, { borderColor: colors.border }]}>
              <Bus size={16} color={colors.primary} strokeWidth={1.8} />
              <Text style={[styles.pickerText, { color: colors.foreground }]}>{fromCity}</Text>
              <ChevronDown size={16} color={colors.mutedForeground} strokeWidth={2} />
            </Pressable>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 8 }]}>TO</Text>
            <Pressable onPress={() => setCityPicker("to")} style={[styles.picker, { borderColor: colors.border }]}>
              <Bus size={16} color="#10B981" strokeWidth={1.8} />
              <Text style={[styles.pickerText, { color: colors.foreground }]}>{toCity}</Text>
              <ChevronDown size={16} color={colors.mutedForeground} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TRAVEL DATE</Text>
            <View style={styles.dateRow}>
              {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                const d = new Date(); d.setDate(d.getDate() + 3 + offset);
                const iso = d.toISOString().split("T")[0];
                const isSelected = date === iso;
                return (
                  <Pressable key={iso} onPress={() => setDate(iso)}
                    style={[styles.dateChip, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : colors.card }]}>
                    <Text style={[styles.dateChipDay, { color: isSelected ? "#fff" : colors.mutedForeground }]}>
                      {new Date(iso + "T00:00").toLocaleDateString("en-NG", { weekday: "short" })}
                    </Text>
                    <Text style={[styles.dateChipNum, { color: isSelected ? "#fff" : colors.foreground }]}>
                      {new Date(iso + "T00:00").getDate()}
                    </Text>
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
                <Pressable onPress={() => setPassengers(Math.min(6, passengers + 1))}
                  style={[styles.counterBtn, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.counterBtnText, { color: "#fff" }]}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <Pressable onPress={doSearch} style={[styles.searchBtn, { backgroundColor: colors.primary }]}>
            <Bus size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.searchBtnText}>Search Routes</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── RESULTS ── */}
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
          ) : routes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🚌</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No routes found</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>No bus operators on this route yet.</Text>
              <Pressable onPress={() => setStep("search")} style={[styles.backToSearch, { backgroundColor: colors.primary }]}>
                <Text style={styles.backToSearchText}>Change Route</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={routes}
              keyExtractor={r => r.id}
              contentContainerStyle={{ padding: 20, gap: 14 }}
              renderItem={({ item: r }) => (
                <Pressable onPress={() => { setSelected(r); setStep("confirm"); }}
                  style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.routeCardTop}>
                    <Text style={[styles.operatorName, { color: colors.foreground }]}>{r.operator}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.routePrice, { color: colors.primary }]}>{fmt(r.price)}</Text>
                  </View>
                  <View style={styles.routeCardMid}>
                    <Text style={[styles.routeTime, { color: colors.foreground }]}>{r.dep_time}</Text>
                    <View style={styles.routeLine}>
                      <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                      <View style={[styles.routeDash, { backgroundColor: colors.border }]} />
                      <Bus size={14} color={colors.primary} strokeWidth={1.8} />
                      <View style={[styles.routeDash, { backgroundColor: colors.border }]} />
                      <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                    </View>
                    <Text style={[styles.routeTime, { color: colors.foreground }]}>
                      {(() => {
                        const [h, m] = r.dep_time.split(":").map(Number);
                        const totalMin = h * 60 + m + r.duration_hours * 60;
                        const arrH = Math.floor(totalMin / 60) % 24;
                        const arrM = Math.round(totalMin % 60);
                        return `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}`;
                      })()}
                    </Text>
                  </View>
                  <View style={styles.routeCardBottom}>
                    <Clock size={12} color={colors.mutedForeground} strokeWidth={1.8} />
                    <Text style={[styles.routeDuration, { color: colors.mutedForeground }]}>{fmtDuration(r.duration_hours)}</Text>
                    <View style={[styles.classBadge, { backgroundColor: (classColor[r.seat_class] ?? "#6B7280") + "20" }]}>
                      <Text style={[styles.classText, { color: classColor[r.seat_class] ?? "#6B7280" }]}>{classLabel[r.seat_class] ?? r.seat_class}</Text>
                    </View>
                    {passengers > 1 && (
                      <Text style={[styles.routeTotal, { color: colors.primary }]}>Total: {fmt(r.price * passengers)}</Text>
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

      {/* ── CONFIRM ── */}
      {step === "confirm" && selected && (
        <ScrollView contentContainerStyle={styles.confirmContent}>
          <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.confirmTop, { backgroundColor: colors.primary + "12" }]}>
              <Bus size={24} color={colors.primary} strokeWidth={1.8} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.confirmOperator, { color: colors.foreground }]}>{selected.operator}</Text>
                <View style={[styles.classBadgeSm, { backgroundColor: (classColor[selected.seat_class] ?? "#6B7280") + "20" }]}>
                  <Text style={[styles.classTextSm, { color: classColor[selected.seat_class] ?? "#6B7280" }]}>{classLabel[selected.seat_class] ?? selected.seat_class}</Text>
                </View>
              </View>
            </View>
            <View style={styles.confirmRouteRow}>
              <View style={{ alignItems: "center" }}>
                <Text style={[styles.confirmCity, { color: colors.foreground }]}>{selected.from_city}</Text>
                <Text style={[styles.confirmTime, { color: colors.primary }]}>{selected.dep_time}</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={[styles.confirmDuration, { color: colors.mutedForeground }]}>{fmtDuration(selected.duration_hours)}</Text>
                <View style={[styles.confirmDash, { backgroundColor: colors.border }]} />
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={[styles.confirmCity, { color: colors.foreground }]}>{selected.to_city}</Text>
                <Text style={[styles.confirmTime, { color: colors.primary }]}>~arrival</Text>
              </View>
            </View>
          </View>

          {[
            ["Travel Date", displayDate],
            ["Passengers", `${passengers} ${passengers === 1 ? "Passenger" : "Passengers"}`],
            ["Price per seat", fmt(selected.price)],
            ...(passengers > 1 ? [["Total", fmt(selected.price * passengers)]] : []),
          ].map(([label, value]) => (
            <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
            </View>
          ))}

          <View style={[styles.totalBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "25" }]}>
            <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Amount to debit from wallet</Text>
            <Text style={[styles.totalAmt, { color: colors.primary }]}>{fmt(selected.price * passengers)}</Text>
          </View>

          <Pressable onPress={doBook} disabled={booking}
            style={[styles.bookBtn, { backgroundColor: booking ? colors.mutedForeground : colors.primary }]}>
            {booking ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Bus size={18} color="#fff" strokeWidth={2} />
                <Text style={styles.bookBtnText}>Confirm & Pay {fmt(selected.price * passengers)}</Text>
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
            {cityPicker === "from" ? "Departing from" : "Travelling to"}
          </Text>
          {(cityPicker === "from" ? ALL_CITIES : (toOptions.length > 0 ? toOptions : ALL_CITIES.filter(c => c !== fromCity))).map(city => (
            <Pressable key={city} onPress={() => {
              if (cityPicker === "from") {
                setFromCity(city);
                const opts = CITY_ROUTES[city] ?? [];
                if (opts.length > 0 && !opts.includes(toCity)) setToCity(opts[0]);
              } else {
                setToCity(city);
              }
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
  content: { padding: 20, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 8 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  picker: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  pickerText: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },
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
  routeCard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 12 },
  routeCardTop: { flexDirection: "row", alignItems: "center" },
  operatorName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  routePrice: { fontSize: 17, fontFamily: "Inter_700Bold" },
  routeCardMid: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeTime: { fontSize: 18, fontFamily: "Inter_700Bold" },
  routeLine: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  routeDot: { width: 6, height: 6, borderRadius: 3 },
  routeDash: { flex: 1, height: 1 },
  routeCardBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeDuration: { fontSize: 12, fontFamily: "Inter_400Regular" },
  classBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  classBadgeSm: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  classText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  classTextSm: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  routeTotal: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  selectText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  confirmContent: { padding: 20, gap: 0 },
  confirmCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
  confirmTop: { flexDirection: "row", alignItems: "center", padding: 20 },
  confirmOperator: { fontSize: 18, fontFamily: "Inter_700Bold" },
  confirmRouteRow: { flexDirection: "row", alignItems: "center", padding: 20, paddingTop: 4 },
  confirmCity: { fontSize: 18, fontFamily: "Inter_700Bold" },
  confirmTime: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
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
