import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

export function EditEventTitle({ eventId, userId, initialTitle, onSaved }: {
  eventId: string; userId: string; initialTitle: string; onSaved: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  async function save() {
    const clean = title.trim();
    if (!clean || clean.length > 200) {
      Alert.alert("Título inválido", "Informe até 200 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || auth.user?.id !== userId) throw new Error("Sessão inválida");
      const { data, error } = await supabase.from("events")
        .update({ title: clean }).eq("id", eventId).eq("user_id", userId)
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
    <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()}>
      <Text style={{ color: "#B98AFF" }}>{saving ? "Salvando..." : "Salvar título"}</Text>
    </Pressable>
  </View>;
}
