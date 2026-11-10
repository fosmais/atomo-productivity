"use client";

import { useEffect, useState } from "react";

type Props = { journeyId: string; title: string; completedCount: number };

// Local preview only. A private Storage-backed gallery will be enabled after its migration is deployed.
export default function JourneyAchievementCard({ journeyId, title, completedCount }: Props) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("Cada passo valeu a pena!");
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo, journeyId]);
  function choosePhoto(file?: File) {
    setFeedback("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFeedback("Escolha uma imagem JPG, PNG ou WebP."); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedback("A imagem deve ter no máximo 5 MB."); return;
    }
    setPhoto(file);
  }
  async function share() {
    const text = "🏆 Concluí minha jornada " + title + " na MYRYRA! " + completedCount +
      " missões realizadas. " + message.trim();
    try {
      if (photo && navigator.canShare?.({ files: [photo] }) && navigator.share) {
        await navigator.share({ title: "Minha conquista MYRYRA", text, files: [photo] });
      } else if (navigator.share) {
        await navigator.share({ title: "Minha conquista MYRYRA", text });
        if (photo) setFeedback("Seu dispositivo compartilhou a mensagem sem anexar a foto.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setFeedback("Mensagem copiada. Compartilhe sua foto separadamente.");
      } else setFeedback("Compartilhamento não disponível neste dispositivo.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFeedback("Não foi possível compartilhar. Tente novamente.");
    }
  }
  return (
    <div className="mx-auto mt-5 max-w-lg space-y-3 rounded-2xl border border-white/20 bg-slate-950/60 p-4 text-left">
      <p className="text-sm font-bold text-amber-200">📸 Registre este momento</p>
      <label className="block text-xs text-violet-100">Sua foto (opcional)
        <input key={journeyId} type="file" accept="image/jpeg,image/png,image/webp"
          onChange={event => choosePhoto(event.target.files?.[0])}
          className="mt-2 block w-full text-xs text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-white" />
      </label>
      {preview && <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Prévia da foto da conquista" className="max-h-64 w-full rounded-xl object-contain" />
        <button type="button" onClick={() => { setPhoto(null); setFeedback(""); }} className="text-xs text-rose-200 underline">Remover foto</button>
      </div>}
      <label className="block text-xs text-violet-100">Sua mensagem
        <textarea value={message} maxLength={300} onChange={event => setMessage(event.target.value)}
          rows={2} className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-sm text-white" />
      </label>
      <button type="button" onClick={() => void share()}
        className="w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-bold text-slate-950">
        Compartilhar minha conquista
      </button>
      <p className="text-xs text-slate-400">A foto fica somente neste dispositivo durante esta sessão e não é salva na MYRYRA nesta versão. Compartilhe apenas o que desejar tornar público.</p>
      {feedback && <p role="status" className="text-xs text-amber-200">{feedback}</p>}
    </div>
  );
}
