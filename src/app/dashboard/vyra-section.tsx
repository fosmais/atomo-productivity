import type { ReactNode } from "react";

type VyraSectionProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export default function VyraSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: VyraSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-6 space-y-5"
    >
      <div className="flex flex-col gap-2">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            {eyebrow}
          </p>
        )}

        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          {title}
        </h2>

        {description && (
          <p className="max-w-2xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        )}
      </div>

      <div className="min-w-0">
        {children}
      </div>
    </section>
  );
}
