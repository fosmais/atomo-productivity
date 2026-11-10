"use client";

import { useEffect, useState } from "react";

type Props = { journeyId: string; title: string; completedCount: number };

// Private gallery photos use short-lived signed URLs; sharing is explicitly user initiated.
export default function JourneyAchievementCard({ journeyId, title, completedCount }: Props) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("Cada passo valeu a pena!");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [gallery, setGallery] = useState<{ id: string; title: string; message: string | null; photo_url: string | null }[]>([]);
  const [shareFiles, setShareFiles] = useState<Record<string, File>>({});
  const endpoint = "/api/journeys/" + encodeURIComponent(journeyId) + "/achievements";
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const photos = gallery.filter(item => item.photo_url);
    void Promise.all(photos.map(async item => {
      try {
        const response = await fetch(item.photo_url!, { signal: controller.signal });
        if (!response.ok) return null;
        const blob = await response.blob();
        const type = blob.type;
        if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return null;
        const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
        return { id: item.id, file: new File([blob], "conquista-myryra." + extension, { type }) };
      } catch { return null; }
    })).then(items => {
      if (!active) return;
      const ready: Record<string, File> = {};
      for (const item of items) if (item) ready[item.id] = item.file;
      setShareFiles(ready);
    });
    return () => { active = false; controller.abort(); };
  }, [gallery]);
  useEffect(() => { let alive = true; fetch(endpoint, { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (alive && Array.isArray(data?.achievements)) setGallery(data.achievements); }).catch(() => {}); return () => { alive = false; }; }, [endpoint]);
  async function removeAchievement(id: string) {
    if (!window.confirm("Excluir este registro e sua foto da galeria? Suas missões e MYRAs serão mantidas.")) return;
    setFeedback("");
    try {
      const response = await fetch(endpoint + "/" + encodeURIComponent(id), { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir.");
      setGallery(items => items.filter(item => item.id !== id));
      setFeedback(data.photoCleanupPending ? "Registro excluído; a remoção da foto precisa ser concluída." : "Conquista removida da galeria. Suas MYRAs foram preservadas.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Falha ao excluir."); }
  }
  async function save() {
    if (saving) return;
    setSaving(true); setFeedback("");
    try {
      const body = new FormData(); body.set("message", message);
      if (photo) body.set("photo", photo);
      const response = await fetch(endpoint, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao salvar.");
      setFeedback("Conquista salva na sua galeria privada.");
      const refreshed = await fetch(endpoint, { cache: "no-store" });
      if (refreshed.ok) { const payload = await refreshed.json(); if (Array.isArray(payload.achievements)) setGallery(payload.achievements); }
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  function choosePhoto(file?: File) {
    setFeedback("");
    setPhoto(null);
    setPreview("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFeedback("Escolha uma imagem JPG, PNG ou WebP."); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedback("A imagem deve ter no máximo 5 MB."); return;
    }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }
  async function shareSaved(item: { id: string; title: string; message: string | null; photo_url: string | null }) {
    const text = "🏆 Concluí minha jornada " + item.title + " na MYRYRA! " + completedCount + " missões realizadas. " + (item.message ?? "");
    setFeedback("");
    const file = shareFiles[item.id];
    try {
      // The file is prepared before the tap: navigator.share must retain user activation on Android.
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "Minha conquista MYRYRA", text, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: "Minha conquista MYRYRA", text });
        if (item.photo_url) setFeedback("Mensagem compartilhada sem foto. Use o botão Baixar foto para enviá-la separadamente.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setFeedback("Mensagem copiada para compartilhar.");
      } else setFeedback("Compartilhamento indisponível neste dispositivo.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFeedback(error instanceof Error ? error.message : "Não foi possível compartilhar.");
    }
  }
  function downloadPhoto(item: { id: string; title: string }) {
    const file = shareFiles[item.id];
    if (!file) { setFeedback("A foto ainda está carregando. Tente novamente em instantes."); return; }
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function shareWhatsApp(text: string) {
    const url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(text + " https://myryra.com/journey");
    window.open(url, "_blank", "noopener,noreferrer");
    setFeedback("WhatsApp aberto para você escolher o destinatário. Nenhuma publicação foi feita automaticamente.");
  }
  async function copyConquest(text: string) {
    try {
      await navigator.clipboard.writeText(text + " https://myryra.com/journey");
      setFeedback("Texto da conquista copiado.");
    } catch {
      setFeedback("Não foi possível copiar automaticamente. Tente pelo navegador.");
    }
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
        <button type="button" onClick={() => { setPhoto(null); setPreview(""); setFeedback(""); }} className="text-xs text-rose-200 underline">Remover foto</button>
      </div>}
      <label className="block text-xs text-violet-100">Sua mensagem
        <textarea value={message} maxLength={300} onChange={event => setMessage(event.target.value)}
          rows={2} className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-sm text-white" />
      </label>
      <button type="button" disabled={saving} onClick={() => void save()} className="w-full rounded-xl border border-amber-300/60 px-4 py-3 text-sm font-bold text-amber-100 disabled:opacity-50">{saving ? "Salvando..." : "Salvar na minha galeria"}</button>
      <button type="button" onClick={() => void share()}
        className="w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-bold text-slate-950">
        Compartilhar minha conquista
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => shareWhatsApp("🏆 Concluí minha jornada " + title + " na MYRYRA! " + completedCount + " missões realizadas. " + message.trim())} className="rounded-xl border border-emerald-300/60 px-3 py-2 text-xs font-bold text-emerald-100">Enviar pelo WhatsApp</button>
        <button type="button" onClick={() => void copyConquest("🏆 Concluí minha jornada " + title + " na MYRYRA! " + completedCount + " missões realizadas. " + message.trim())} className="rounded-xl border border-white/40 px-3 py-2 text-xs font-bold text-white">Copiar conquista</button>
      </div>
      <p className="text-xs text-slate-400">Fotos salvas ficam privadas. O compartilhamento é sempre uma ação sua; não publicamos sua foto automaticamente.</p>
      {gallery.length > 0 && <div className="space-y-2"><p className="text-sm font-semibold text-violet-100">Minha galeria de conquistas</p>{gallery.map(item => <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">{item.photo_url && <img src={item.photo_url} alt={"Foto da conquista " + item.title} className="max-h-48 w-full rounded-lg object-contain" /> }<p className="mt-2 text-sm font-semibold">{item.title}</p>{item.message && <p className="text-xs text-slate-300">{item.message}</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void shareSaved(item)} className="rounded-lg border border-amber-300/50 px-3 py-2 text-xs text-amber-100">Compartilhar</button>{item.photo_url && <button type="button" onClick={() => downloadPhoto(item)} className="rounded-lg border border-violet-300/40 px-3 py-2 text-xs text-violet-100">Baixar foto</button>}<button type="button" onClick={() => void removeAchievement(item.id)} className="rounded-lg border border-rose-300/40 px-3 py-2 text-xs text-rose-200">Excluir da galeria</button></div></div>)}</div>}
      {feedback && <p role="status" className="text-xs text-amber-200">{feedback}</p>}
    </div>
  );
}
