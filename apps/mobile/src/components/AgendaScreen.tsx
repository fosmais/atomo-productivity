import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, Alert, View } from "react-native";
import { supabase } from "../lib/supabase";
import { EditEventTitle } from "./EditEventTitle";

type EventRow = { id: string; title: string; starts_at: string; ends_at: string; location: string | null; event_status: string | null };

export function AgendaScreen({ userId }: { userId: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  async function cancelEvent(eventId: string) {
    setCancelingId(eventId);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || auth.user?.id !== userId) throw new Error("Sessão inválida");
      const { data, error: updateError } = await supabase.from("events")
        .update({ event_status: "canceled" }).eq("id", eventId).eq("user_id", userId)
        .select("id").maybeSingle();
      if (updateError || !data) throw new Error("Falha ao cancelar");
      await load();
      Alert.alert("Compromisso cancelado", "O compromisso foi marcado como cancelado.");
    } catch { Alert.alert("Erro", "Não foi possível cancelar o compromisso."); }
    finally { setCancelingId(null); }
  }
  function confirmCancel(eventId: string) {
    Alert.alert("Cancelar compromisso?", "Esta ação marcará o compromisso como cancelado.", [
      { text: "Voltar", style: "cancel" },
      { text: "Cancelar compromisso", style: "destructive", onPress: () => void cancelEvent(eventId) }
    ]);
  }
  async function createEvent() {
    if (!title.trim() || title.trim().length > 200) { Alert.alert("Informe um título de até 200 caracteres."); return; }
    const parse = (date: string, time: string) => {
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(time)) return null;
      const [year, month, dayOfMonth] = date.split("-").map(Number);
      const [hours, minutes] = time.split(":").map(Number);
      const value = new Date(year, month - 1, dayOfMonth, hours, minutes);
      if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== dayOfMonth || value.getHours() !== hours || value.getMinutes() !== minutes) return null;
      return value;
    };
    const start = parse(day, startTime); const end = parse(day, endTime);
    if (!start || !end || end <= start) { Alert.alert("Confira a data e os horários. O término deve ser posterior ao início."); return; }
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || auth.user?.id !== userId) throw new Error("Sessão inválida.");
      const { error: insertError } = await supabase.from("events").insert({ user_id: userId, title: title.trim(), starts_at: start.toISOString(), ends_at: end.toISOString(), event_type: "appointment", blocks_time: true });
      if (insertError) throw insertError;
      setTitle(""); setDay(""); setStartTime(""); setEndTime(""); setShowForm(false);
      await load();
      Alert.alert("Compromisso criado", "Evento salvo na agenda.");
    } catch { Alert.alert("Não foi possível salvar", "Confira sua conexão e as permissões da agenda."); }
    finally { setSaving(false); }
  }
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    try {
      const { data, error: queryError } = await supabase.from("events")
        .select("id,title,starts_at,ends_at,location,event_status")
        .eq("user_id", userId)
        .neq("event_status", "canceled")
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
    <Pressable accessibilityRole="button" onPress={() => setShowForm(value => !value)}><Text style={styles.refresh}>{showForm ? "Fechar formulário" : "+ Novo compromisso"}</Text></Pressable>
    {showForm ? <View style={styles.form}>
      <TextInput accessibilityLabel="Título do compromisso" placeholder="Título" placeholderTextColor="#B0A4C7" style={styles.input} value={title} onChangeText={setTitle} maxLength={200} />
      <TextInput accessibilityLabel="Data do compromisso" placeholder="Data: AAAA-MM-DD" placeholderTextColor="#B0A4C7" style={styles.input} value={day} onChangeText={setDay} autoCapitalize="none" />
      <TextInput accessibilityLabel="Horário de início" placeholder="Início: HH:mm" placeholderTextColor="#B0A4C7" style={styles.input} value={startTime} onChangeText={setStartTime} />
      <TextInput accessibilityLabel="Horário de término" placeholder="Término: HH:mm" placeholderTextColor="#B0A4C7" style={styles.input} value={endTime} onChangeText={setEndTime} />
      <Pressable accessibilityRole="button" disabled={saving} style={styles.save} onPress={() => void createEvent()}><Text style={styles.name}>{saving ? "Salvando..." : "Salvar compromisso"}</Text></Pressable>
    </View> : null}
    <Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.refresh}>Atualizar agenda</Text></Pressable>
    {loading ? <ActivityIndicator color="#B98AFF" /> : error ? <Text style={styles.muted}>{error}</Text> : events.length === 0 ? <Text style={styles.muted}>Nenhum compromisso encontrado.</Text> : events.map(event =>
      <View key={event.id} style={styles.item}>
        <Text style={styles.name}>{event.title}</Text>
        <Text style={styles.muted}>{new Date(event.starts_at).toLocaleString("pt-BR")} – {new Date(event.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text>
        {event.location ? <Text style={styles.muted}>{event.location}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => setEditingId(editingId === event.id ? null : event.id)}><Text style={styles.refresh}>{editingId === event.id ? "Fechar edição" : "Editar título"}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={cancelingId === event.id} onPress={() => confirmCancel(event.id)}><Text style={styles.refresh}>{cancelingId === event.id ? "Cancelando..." : "Cancelar compromisso"}</Text></Pressable>
        {editingId === event.id ? <EditEventTitle eventId={event.id} userId={userId} initialTitle={event.title} onSaved={() => { setEditingId(null); void load(); }} /> : null}
      </View>
    )}
  </View>;
}
const styles = StyleSheet.create({ form: { gap: 10 }, input: { color: "#fff", backgroundColor: "#261B3E", padding: 13, borderRadius: 10 }, save: { backgroundColor: "#793DE5", padding: 14, alignItems: "center", borderRadius: 10 }, box: { width: "100%", gap: 12, marginTop: 16 }, heading: { color: "#fff", fontSize: 19, fontWeight: "700" }, refresh: { color: "#B98AFF", fontWeight: "700" }, item: { backgroundColor: "#261B3E", padding: 14, borderRadius: 12, gap: 6 }, name: { color: "#fff", fontWeight: "700" }, muted: { color: "#D5C3FF", fontSize: 13 } });
