import React, { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View, Pressable } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { AuthScreen } from "./src/components/AuthScreen";
import { registerAuthLifecycle } from "./src/lib/auth-lifecycle";
import { MfaChallenge } from "./src/components/MfaChallenge";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [assuranceLoading, setAssuranceLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!session) { setRequiresMfa(false); return; }
    setAssuranceLoading(true);
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      if (!cancelled) setRequiresMfa(Boolean(error || (data?.nextLevel === "aal2" && data.currentLevel !== "aal2")));
    }).catch(() => { if (!cancelled) setRequiresMfa(true); })
      .finally(() => { if (!cancelled) setAssuranceLoading(false); });
    return () => { cancelled = true; };
  }, [session?.access_token]);
  useEffect(() => {
    const unregisterLifecycle = registerAuthLifecycle();
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setLoading(false); } }).catch(() => { if (mounted) setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { if (mounted) setSession(next); });
    return () => { mounted = false; subscription.unsubscribe(); unregisterLifecycle(); };
  }, []);
  return <SafeAreaView style={styles.page}>
    <StatusBar barStyle="light-content" />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.brand}>M</Text><Text style={styles.title}>MYRYRA</Text>
      <Text style={styles.subtitle}>Your life. In sync.</Text>
      {loading || assuranceLoading ? <ActivityIndicator style={{ marginTop: 36 }} color="#B98AFF" /> : session && requiresMfa ? <MfaChallenge onVerified={() => { setRequiresMfa(false); }} /> : session ?
        <View style={styles.welcome}><Text style={styles.message}>Olá, {session.user.email}</Text><Text style={styles.message}>Sua sessão está conectada. Agenda e MYKA serão integradas nos próximos blocos.</Text><Pressable onPress={() => void supabase.auth.signOut()} accessibilityRole="button"><Text style={styles.signout}>Sair</Text></Pressable></View>
        : <AuthScreen />}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#110B22" }, content: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 28 },
  brand: { color: "#B98AFF", fontSize: 68, fontWeight: "800" }, title: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", letterSpacing: 3 },
  subtitle: { color: "#D5C3FF", fontSize: 16, marginTop: 8 }, welcome: { marginTop: 36, gap: 18, alignItems: "center" },
  message: { color: "#D5C3FF", textAlign: "center", lineHeight: 22 }, signout: { color: "#B98AFF", fontWeight: "700" },
});
