import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

type Message = { id: string; role: string; content: string; created_at: string };

export function MykaHistory({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
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
  async function send() {
    const content = draft.trim();
    if (!content || content.length > 1500 || sending) return;
    setSending(true); setError(null); setReply(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token || sessionData.session?.user.id !== userId) throw new Error("Sessão inválida");
      const base = process.env.EXPO_PUBLIC_MYRYRA_API_URL;
      if (!base || !/^https:\/\//.test(base)) throw new Error("Configure a URL HTTPS do backend MYRYRA.");
      const response = await fetch(`${base.replace(/\/$/, "")}/api/concierge`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", content }] }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error("MYKA indisponível no momento.");
      if (!result || typeof result !== "object" || !("reply" in result) || typeof result.reply !== "string") throw new Error("Resposta inesperada.");
      setReply(result.reply); setDraft("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao enviar mensagem."); }
    finally { setSending(false); }
  }
  return <View style={styles.box}>
    <Text style={styles.heading}>MYKA AI</Text>
    <Text style={styles.caption}>Converse com a MYKA · suas sugestões precisam de confirmação antes de serem executadas</Text>
    <TextInput accessibilityLabel="Mensagem para MYKA" multiline maxLength={1500} value={draft} onChangeText={setDraft} placeholder="Como posso ajudar?" placeholderTextColor="#B0A4C7" style={{ color: "#fff", backgroundColor: "#382A52", padding: 12, borderRadius: 10, minHeight: 70 }} />
    <Pressable accessibilityRole="button" disabled={sending || !draft.trim()} onPress={() => void send()}><Text style={styles.action}>{sending ? "Enviando..." : "Enviar para MYKA"}</Text></Pressable>
    {reply ? <View style={styles.message}><Text style={styles.role}>MYKA · resposta recente</Text><Text style={styles.content}>{reply}</Text></View> : null}
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
