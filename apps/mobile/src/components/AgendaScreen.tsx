import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

type EventRow = { id: string; title: string; starts_at: string; ends_at: string; location: string | null };

export function AgendaScreen({ userId }: { userId: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    try {
      const { data, error: queryError } = await supabase.from("events")
        .select("id,title,starts_at,ends_at,location")
        .eq("user_id", userId)
        .gte("ends_at", now.toISOString())
        .lt("starts_at", end.toISOString())
        .order("starts_at", { ascending: true })
        .limit(50);
      if (queryError) throw queryError;
      setEvents((data ?? []) as EventRow[]);
    } catch { setError("Não foi possível carregar a agenda. Tente novamente."); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.box}>
    <Text style={styles.heading}>Próximos 30 dias</Text>
    <Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.refresh}>Atualizar agenda</Text></Pressable>
    {loading ? <ActivityIndicator color="#B98AFF" /> : error ? <Text style={styles.muted}>{error}</Text> : events.length === 0 ? <Text style={styles.muted}>Nenhum compromisso encontrado.</Text> : events.map(event =>
      <View key={event.id} style={styles.item}>
        <Text style={styles.name}>{event.title}</Text>
        <Text style={styles.muted}>{new Date(event.starts_at).toLocaleString("pt-BR")} – {new Date(event.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text>
        {event.location ? <Text style={styles.muted}>{event.location}</Text> : null}
      </View>
    )}
  </View>;
}
const styles = StyleSheet.create({ box: { width: "100%", gap: 12, marginTop: 16 }, heading: { color: "#fff", fontSize: 19, fontWeight: "700" }, refresh: { color: "#B98AFF", fontWeight: "700" }, item: { backgroundColor: "#261B3E", padding: 14, borderRadius: 12, gap: 6 }, name: { color: "#fff", fontWeight: "700" }, muted: { color: "#D5C3FF", fontSize: 13 } });
