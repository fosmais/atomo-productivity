type VyraLoadingProps = {
  message?: string;
  compact?: boolean;
};

export default function VyraLoading({
  message = "A MYRYRA está preparando tudo...",
  compact = false,
}: VyraLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-4 rounded-xl border border-violet-500/20 bg-violet-500/5 ${
        compact ? "p-3" : "p-5"
      }`}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-400" />

        <span className="text-lg font-bold text-violet-300">
          V
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold text-white">
          MYRYRA Intelligence
        </p>

        <p className="mt-1 text-xs text-slate-400">
          {message}
        </p>
      </div>
    </div>
  );
}
