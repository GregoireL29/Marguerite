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
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900">{title}</p>
        {href && (
          <Link href={href} className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700">
            Voir
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

export function WidgetLoading() {
  return <p className="text-xs text-zinc-400">Chargement...</p>;
}

export function WidgetEmpty({ text }: { text: string }) {
  return <p className="text-xs text-zinc-400">{text}</p>;
}
