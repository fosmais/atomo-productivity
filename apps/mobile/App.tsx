import React from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <Text style={styles.brand}>M</Text>
        <Text style={styles.title}>MYRYRA</Text>
        <Text style={styles.subtitle}>Your life. In sync.</Text>
        <Text style={styles.message}>
          O aplicativo Android está em construção. Login, agenda e MYKA serão integrados em etapas seguras.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#110B22" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 28 },
  brand: { color: "#B98AFF", fontSize: 68, fontWeight: "800" },
  title: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", letterSpacing: 3 },
  subtitle: { color: "#D5C3FF", fontSize: 16, marginTop: 8 },
  message: { color: "#BEB4D0", fontSize: 14, lineHeight: 22, textAlign: "center", marginTop: 36 },
});
