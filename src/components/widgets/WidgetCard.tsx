"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface WidgetCardProps {
  title: string;
  href?: string;
  children: ReactNode;
}

export function WidgetCard({ title, href, children }: WidgetCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-sm dark:shadow-[0_4px_10px_rgba(0,0,0,0.45)]">
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
