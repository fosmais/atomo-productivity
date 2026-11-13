"use client";
import { useVyraNavigation } from "./vyra-module-context";
import MykaPortrait from "@/components/myka-portrait";
import GlobalSearch from "./global-search";

export default function VyraHeader() {
  const { navigateTo } = useVyraNavigation();
  return (
    <header className="flex items-center justify-between rounded-2xl border border-cyan-300/15 bg-[#0b1628]/90 px-5 py-4 text-white">
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
          <img
            src="/myryra-logo.png"
            alt="Logotipo MYRYRA"
            className="h-full w-full object-cover"
          />
        </div>

        <div>
          <p className="text-base font-bold tracking-[0.2em]">
            MYRYRA
          </p>
          <p className="text-xs text-slate-400">
            Your life. In sync.
          </p>
        </div>
      </div>


      <div className="flex items-center gap-2 sm:gap-3">
      <GlobalSearch />
      <button
        type="button"
        onClick={() => navigateTo("vyra-ai")}
        aria-label="Conversar com MIKA"
        title="Conversar com MIKA"
        className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-cyan-300/40 bg-slate-950 shadow-lg shadow-cyan-400/15 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 motion-reduce:transition-none"
      >
        <MykaPortrait className="h-full w-full" />
      </button>
      </div>
    </header>
  );
}