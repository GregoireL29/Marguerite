import type { ReactNode } from "react";
import { IconChevronDown } from "@/components/icons/MenuIcons";

// Bloc repliable pour les réglages secondaires d'un écran (ex. "Réglages"
// sur Indicateurs) : reprend le trait fin de Section pour la séparation,
// fermé par défaut pour ne pas alourdir la hiérarchie visuelle principale.
export function Disclosure({
  summary,
  children,
  className = "",
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`group border-t border-border pt-8 ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {summary}
        <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-6 flex flex-col gap-8">{children}</div>
    </details>
  );
}
