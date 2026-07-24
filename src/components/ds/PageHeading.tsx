import type { ComponentPropsWithoutRef } from "react";

// Titre d'écran unifié — même taille/graisse que sur Indicateurs (PR #76),
// à utiliser sur tous les écrans repassés au nouveau style plutôt que le
// text-xl font-medium hérité de la première version de l'app. Props HTML
// libres (ex. data-tour) pour rester compatible avec les points d'ancrage
// existants du parcours guidé.
export function PageHeading({ className = "", ...rest }: ComponentPropsWithoutRef<"h1">) {
  return (
    <h1
      className={`text-2xl font-semibold tracking-tight text-foreground ${className}`}
      {...rest}
    />
  );
}
