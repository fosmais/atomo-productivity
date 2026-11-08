"use client";

import { useEffect, useState } from "react";

type Theme = "violet" | "navy" | "graphite";
const colors: Record<Theme, string> = {
  violet: "linear-gradient(160deg, #0b061e, #020617 65%)",
  navy: "linear-gradient(160deg, #071a32, #020617 65%)",
  graphite: "linear-gradient(160deg, #15151d, #020617 65%)",
};
const key = "myryra:background-theme:v1";
function applyTheme(value: Theme) {
  const root = document.getElementById("dashboard-top")?.parentElement;
  if (root) root.style.background = colors[value];
}
export default function ThemePreferences() {
  const [theme, setTheme] = useState<Theme>("violet");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      let saved: Theme = "violet";
      try { const value = localStorage.getItem(key); if (value && value in colors) saved = value as Theme; } catch { /* optional */ }
      setTheme(saved); applyTheme(saved);
    });
    return () => { active = false; };
  }, []);
  return <div className="space-y-3 rounded-xl border border-white/15 bg-slate-900/75 p-4">
    <h3 className="font-semibold text-white">Aparência da tela</h3>
    <p className="text-sm text-slate-400">Escolha a tonalidade do fundo. Os elementos da MYKA e a identidade visual permanecem inalterados.</p>
    <div className="grid grid-cols-3 gap-2">{([
      ["violet", "Roxo"],
      ["navy", "Azul"],
      ["graphite", "Grafite"],
    ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => {
      setTheme(value); applyTheme(value);
      try { localStorage.setItem(key, value); } catch { /* optional */ }
    }} className={`rounded-xl border p-2 text-sm text-white ${theme === value ? "border-violet-300" : "border-white/15"}`}>
      <span className="mb-2 block h-12 rounded-lg" style={{ background: colors[value] }} /><span>{label}</span>
    </button>)}</div>
  </div>;
}
