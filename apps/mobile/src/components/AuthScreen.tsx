import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

const CAPTCHA_PAGE = "https://www.myryra.com/mobile-captcha";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaPending, setCaptchaPending] = useState(false);
  const challengeState = useRef<string | null>(null);

  useEffect(() => {
    const acceptCallback = (url: string | null) => {
      if (!url) return;
      try {
        const callback = new URL(url);
        if (callback.protocol !== "myryra:" || callback.hostname !== "captcha") return;
        const token = callback.searchParams.get("token") || "";
        const state = callback.searchParams.get("state") || "";
        if (!token || !challengeState.current || state !== challengeState.current) return;
        challengeState.current = null;
        setCaptchaToken(token);
        setCaptchaPending(false);
        Alert.alert("Verificação concluída", "Agora toque em Entrar para concluir seu acesso.");
      } catch {
        // Ignore malformed or unrelated deep links.
      }
    };

    const subscription = Linking.addEventListener("url", ({ url }) => acceptCallback(url));
    void Linking.getInitialURL().then(acceptCallback);
    return () => subscription.remove();
  }, []);

  async function startCaptcha() {
    if (busy || captchaPending) return;
    const state = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    challengeState.current = state;
    setCaptchaPending(true);
    try {
      await Linking.openURL(`${CAPTCHA_PAGE}?state=${encodeURIComponent(state)}`);
    } catch {
      challengeState.current = null;
      setCaptchaPending(false);
      Alert.alert("Verificação indisponível", "Não foi possível abrir a verificação de segurança. Tente novamente.");
    }
  }

  async function login() {
    if (!email.trim() || !password) { Alert.alert("Preencha e-mail e senha."); return; }
    if (!captchaToken) {
      await startCaptcha();
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: { captchaToken },
      });
      if (error) {
        setCaptchaToken("");
        Alert.alert("Não foi possível entrar", error.message);
      }
    } catch {
      setCaptchaToken("");
      Alert.alert("Erro de conexão", "Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <View style={styles.box}>
    <Text style={styles.heading}>Entrar na MYRYRA</Text>
    <TextInput accessibilityLabel="E-mail" autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="E-mail" placeholderTextColor="#B0A4C7" value={email} onChangeText={setEmail} style={styles.input} editable={!busy} />
    <TextInput accessibilityLabel="Senha" secureTextEntry autoComplete="password" placeholder="Senha" placeholderTextColor="#B0A4C7" value={password} onChangeText={setPassword} style={styles.input} editable={!busy} />
    <Text accessibilityRole="text" style={styles.captchaStatus}>
      {captchaToken ? "✓ Verificação de segurança concluída." : captchaPending ? "Conclua a verificação no navegador e retorne ao MYRYRA." : "A verificação antirobô é necessária para entrar."}
    </Text>
    <Pressable accessibilityRole="button" disabled={busy || captchaPending} onPress={login} style={styles.button}>
      {busy || captchaPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{captchaToken ? "Entrar" : "Verificar e entrar"}</Text>}
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  box: { width: "100%", gap: 14, marginTop: 36 },
  heading: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  input: { color: "#fff", backgroundColor: "#261B3E", borderRadius: 12, padding: 15 },
  captchaStatus: { color: "#D5C3FF", fontSize: 12, textAlign: "center" },
  button: { backgroundColor: "#793DE5", padding: 16, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
});
