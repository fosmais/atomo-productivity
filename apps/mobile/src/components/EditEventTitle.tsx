import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

export function EditEventTitle({ eventId, userId, initialTitle, initialStart, initialEnd, onSaved }: {
  eventId: string; userId: string; initialTitle: string; initialStart: string; initialEnd: string; onSaved: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const formatDate = (iso: string) => { const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
  const formatTime = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
  const [date, setDate] = useState(formatDate(initialStart));
  const [startTime, setStartTime] = useState(formatTime(initialStart));
  const [endTime, setEndTime] = useState(formatTime(initialEnd));
  const [saving, setSaving] = useState(false);
  async function save() {
    const clean = title.trim();
    if (!clean || clean.length > 200) {
      Alert.alert("Título inválido", "Informe até 200 caracteres.");
      return;
    }
    const parse = (time: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
      const [y,m,d] = date.split("-").map(Number); const [h,min] = time.split(":").map(Number);
      const value = new Date(y,m-1,d,h,min);
      return value.getFullYear() === y && value.getMonth() === m-1 && value.getDate() === d && value.getHours() === h ? value : null;
    };
    const start = parse(startTime), end = parse(endTime);
    if (!start || !end || end <= start) { Alert.alert("Data ou horários inválidos"); return; }
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || auth.user?.id !== userId) throw new Error("Sessão inválida");
      const { data, error } = await supabase.from("events")
        .update({ title: clean, starts_at: start.toISOString(), ends_at: end.toISOString() }).eq("id", eventId).eq("user_id", userId)
        .select("id").maybeSingle();
      if (error || !data) throw new Error("Não foi possível atualizar");
      onSaved();
    } catch {
      Alert.alert("Erro", "Não foi possível editar o compromisso.");
    } finally {
      setSaving(false);
    }
  }
  return <View style={{ gap: 8 }}>
    <TextInput accessibilityLabel="Editar título" value={title} onChangeText={setTitle}
      maxLength={200} style={{ color: "#fff", backgroundColor: "#382A52", padding: 10, borderRadius: 8 }} />
    <TextInput accessibilityLabel="Data" placeholder="AAAA-MM-DD" placeholderTextColor="#B0A4C7" value={date} onChangeText={setDate} style={{ color: "#fff", backgroundColor: "#382A52", padding: 10, borderRadius: 8 }} />
    <TextInput accessibilityLabel="Horário inicial" placeholder="HH:mm" placeholderTextColor="#B0A4C7" value={startTime} onChangeText={setStartTime} style={{ color: "#fff", backgroundColor: "#382A52", padding: 10, borderRadius: 8 }} />
    <TextInput accessibilityLabel="Horário final" placeholder="HH:mm" placeholderTextColor="#B0A4C7" value={endTime} onChangeText={setEndTime} style={{ color: "#fff", backgroundColor: "#382A52", padding: 10, borderRadius: 8 }} />
    <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()}>
      <Text style={{ color: "#B98AFF" }}>{saving ? "Salvando..." : "Salvar alterações"}</Text>
    </Pressable>
  </View>;
}
