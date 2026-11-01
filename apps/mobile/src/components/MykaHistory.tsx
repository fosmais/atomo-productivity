import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

type Message = { id: string; role: string; content: string; created_at: string };

export function MykaHistory({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: conversation, error: conversationError } = await supabase.from("myka_conversations")
        .select("id").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (conversationError) throw conversationError;
      if (!conversation) { setMessages([]); return; }
      const { data, error: queryError } = await supabase.from("myka_messages")
        .select("id,role,content,created_at").eq("user_id", userId).eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false }).limit(30);
      if (queryError) throw queryError;
      setMessages(((data ?? []) as Message[]).reverse());
    } catch {
      setError("Histórico indisponível. Confira as permissões e tente novamente.");
    } finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.box}>
    <Text style={styles.heading}>MYKA AI</Text>
    <Text style={styles.caption}>Última conversa · somente leitura</Text>
    <Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.action}>Atualizar mensagens</Text></Pressable>
    {loading ? <ActivityIndicator color="#B98AFF" /> : error ? <Text style={styles.caption}>{error}</Text>
      : messages.length === 0 ? <Text style={styles.caption}>Nenhuma mensagem encontrada.</Text>
      : messages.map(message => <View key={message.id} style={styles.message}>
          <Text style={styles.role}>{message.role === "assistant" ? "MYKA" : "Você"}</Text>
          <Text style={styles.content}>{message.content}</Text>
        </View>)}
  </View>;
}
const styles = StyleSheet.create({
  box: { width: "100%", marginTop: 24, gap: 12 },
  heading: { color: "#fff", fontSize: 20, fontWeight: "700" },
  caption: { color: "#CDBDE8", fontSize: 13 },
  action: { color: "#B98AFF", fontWeight: "700" },
  message: { padding: 14, borderRadius: 12, backgroundColor: "#261B3E", gap: 6 },
  role: { color: "#B98AFF", fontWeight: "700" },
  content: { color: "#fff", lineHeight: 21 }
});
