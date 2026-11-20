import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MIKA Insights | MYRYRA",
  description: "Capture ideias, organize seus insights e transforme sugestões da MIKA em planos para revisar.",
  robots: { index: false, follow: false },
};

export default function MikaInsightsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
