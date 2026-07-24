import type { ReactNode } from "react";

type StatTier = "hero" | "secondary" | "tertiary";

const VALUE_CLASS: Record<StatTier, string> = {
  hero: "mt-1 text-6xl font-semibold tracking-tight text-foreground",
  secondary: "mt-1 text-4xl font-semibold text-foreground",
  tertiary: "mt-1 text-lg font-medium text-foreground",
};

const LABEL_CLASS: Record<StatTier, string> = {
  hero: "text-xs uppercase tracking-wide text-muted-foreground",
  secondary: "text-xs uppercase tracking-wide text-muted-foreground",
  tertiary: "text-xs text-muted-foreground",
};

const FOOTER_MARGIN: Record<StatTier, string> = {
  hero: "mt-2",
  secondary: "mt-1",
  tertiary: "mt-1",
};

interface StatProps {
  label: string;
  value: ReactNode;
  tier?: StatTier;
  /** Contenu libre sous la valeur (delta, objectif, unité...) — l'espacement est géré selon le palier. */
  children?: ReactNode;
  className?: string;
}

// Hiérarchie typographique à paliers validée sur Indicateurs (PR #76) :
// un seul chiffre héros par écran, quelques secondaires, le reste en
// tertiaire. Ne modélise que la taille/l'espacement — le contenu du footer
// (delta, objectif, unité) reste libre car il varie trop d'un écran à
// l'autre pour être figé ici.
export function Stat({ label, value, tier = "secondary", children, className = "" }: StatProps) {
  return (
    <div className={className}>
      <p className={LABEL_CLASS[tier]}>{label}</p>
      <p className={VALUE_CLASS[tier]}>{value}</p>
      {children && <div className={FOOTER_MARGIN[tier]}>{children}</div>}
    </div>
  );
}
