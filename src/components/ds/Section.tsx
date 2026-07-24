import type { ReactNode } from "react";

// Sépare deux blocs de contenu par un simple trait fin plutôt qu'un cadre :
// c'est la seule "frontière" visuelle utilisée entre sections dans le
// nouveau style (jamais de bordure/fond autour d'un bloc non interactif).
// Ne force pas de gap interne — chaque écran compose sa propre mise en
// page (flex/grid) à l'intérieur, la forme du contenu variant trop d'un
// écran à l'autre pour être figée ici.
export function Section({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`border-t border-border pt-8 ${className}`}>{children}</div>;
}

// Libellé de section en petites capitales espacées, au-dessus d'un bloc de
// contenu (ex. "Bilan", "Indicateurs optionnels"). `muted` atténue encore
// le libellé pour les sections clairement secondaires.
export function SectionLabel({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <p
      className={`text-xs uppercase tracking-wide ${
        muted ? "text-faint-foreground" : "text-muted-foreground"
      }`}
    >
      {children}
    </p>
  );
}
