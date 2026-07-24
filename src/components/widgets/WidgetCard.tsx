"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface WidgetCardProps {
  title: string;
  href?: string;
  children: ReactNode;
}

// Plus de cadre/fond : chaque widget est une section parmi d'autres dans un
// flux vertical, séparée par un simple trait fin (géré par le parent qui
// empile les widgets, pas ici) plutôt qu'une carte. Seul le lien "Voir",
// réellement interactif, garde un traitement typographique dédié.
export function WidgetCard({ title, href, children }: WidgetCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {href && (
          <Link href={href} className="shrink-0 text-xs text-muted-foreground hover:text-accent">
            Voir
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

export function WidgetLoading() {
  return <p className="text-xs text-faint-foreground">Chargement...</p>;
}

export function WidgetEmpty({ text }: { text: string }) {
  return <p className="text-xs text-faint-foreground">{text}</p>;
}
