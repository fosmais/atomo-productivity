import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

export function MfaChallenge({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return;
      if (error) { Alert.alert("Verificação indisponível", error.message); return; }
      setFactorId(data?.totp.find(factor => factor.status === "verified")?.id ?? null);
    }).catch(() => { if (active) Alert.alert("Não foi possível carregar o autenticador."); });
    return () => { active = false; };
  }, []);
  async function verify() {
    if (!factorId || !/^\\d{6}$/.test(code)) { Alert.alert("Informe os 6 dígitos do autenticador."); return; }
    setBusy(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error || !challenge.data) throw new Error(challenge.error?.message ?? "Falha ao iniciar desafio.");
      const result = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
      if (result.error) throw result.error;
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== "aal2") throw new Error("Autenticação adicional não confirmada.");
      onVerified();
    } catch (error) { Alert.alert("Código não validado", error instanceof Error ? error.message : "Tente novamente."); }
    finally { setBusy(false); }
  }
  return <View style={styles.box}>
    <Text style={styles.title}>Verificação em duas etapas</Text>
    <Text style={styles.hint}>{factorId ? "Digite o código do aplicativo autenticador." : "Nenhum autenticador disponível. Entre em contato com o suporte."}</Text>
    <TextInput accessibilityLabel="Código de seis dígitos" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="000000" placeholderTextColor="#B0A4C7" style={styles.input} />
    <Pressable disabled={busy || !factorId} accessibilityRole="button" onPress={verify} style={styles.button}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.action}>Verificar</Text>}</Pressable>
    <Pressable accessibilityRole="button" onPress={() => void supabase.auth.signOut()}><Text style={styles.hint}>Sair</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({ box: { marginTop: 32, width: "100%", gap: 16, alignItems: "center" }, title: { color: "#fff", fontSize: 20, fontWeight: "700" }, hint: { color: "#D5C3FF", textAlign: "center" }, input: { color: "#fff", backgroundColor: "#261B3E", borderRadius: 12, padding: 15, width: "100%", textAlign: "center", letterSpacing: 6 }, button: { backgroundColor: "#793DE5", padding: 16, borderRadius: 12, width: "100%", alignItems: "center" }, action: { color: "#fff", fontWeight: "700" } });
