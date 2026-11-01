import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AudioModule, RecordingPresets, useAudioRecorder } from "expo-audio";

type Props = { onRecorded: (uri: string) => void };

export function MykaVoiceRecorder({ onRecorded }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleRecording() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (recording) {
        await recorder.stop();
        setRecording(false);
        if (recorder.uri) onRecorded(recorder.uri);
        else setError("Não foi possível acessar o áudio gravado.");
      } else {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) {
          setError("Autorize o microfone nas configurações do Android.");
          return;
        }
        await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setRecording(true);
      }
    } catch {
      setError("Falha na gravação. Tente novamente.");
      setRecording(false);
    } finally {
      setBusy(false);
    }
  }

  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void toggleRecording()}>
      <Text style={{ color: "#B98AFF", fontWeight: "700" }}>
        {busy ? "Aguarde..." : recording ? "Encerrar gravação" : "Gravar mensagem de voz"}
      </Text>
    </Pressable>
    {recording ? <Text style={{ color: "#CDBDE8" }}>Microfone ativo. Toque para finalizar.</Text> : null}
    {error ? <Text style={{ color: "#FCA5A5" }}>{error}</Text> : null}
  </View>;
}
