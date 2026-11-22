import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function login() {
    if (!email.trim() || !password) { Alert.alert("Preencha e-mail e senha."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) Alert.alert("Não foi possível entrar", error.message);
    } catch { Alert.alert("Erro de conexão", "Tente novamente."); }
    finally { setBusy(false); }
  }
  return <View style={styles.box}>
    <Text style={styles.heading}>Entrar na MYRYRA</Text>
    <TextInput accessibilityLabel="E-mail" autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="E-mail" placeholderTextColor="#B0A4C7" value={email} onChangeText={setEmail} style={styles.input} />
    <TextInput accessibilityLabel="Senha" secureTextEntry autoComplete="password" placeholder="Senha" placeholderTextColor="#B0A4C7" value={password} onChangeText={setPassword} style={styles.input} />
    <Pressable accessibilityRole="button" disabled={busy} onPress={login} style={styles.button}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}</Pressable>
  </View>;
}
const styles = StyleSheet.create({
  box: { width: "100%", gap: 14, marginTop: 36 },
  heading: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  input: { color: "#fff", backgroundColor: "#261B3E", borderRadius: 12, padding: 15 },
  button: { backgroundColor: "#793DE5", padding: 16, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
});
