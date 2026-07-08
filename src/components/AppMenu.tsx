"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

const TABS: { label: string; href?: string }[] = [
  { label: "Planning", href: "/" },
  { label: "Tâches du jour", href: "/taches" },
  { label: "Congés", href: "/conges" },
  { label: "Documents", href: "/documents" },
  { label: "Indicateurs", href: "/indicateurs" },
  { label: "Notes de frais", href: "/notes-frais" },
  { label: "Factures fournisseurs", href: "/factures-fournisseurs" },
  { label: "Annonces", href: "/annonces" },
  { label: "Onboarding" },
  { label: "Rappels et échéances" },
  { label: "Messagerie" },
];

export function AppMenu() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoaded(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!loaded || !session) return null;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-4 py-2">
      {TABS.map((tab) =>
        tab.href ? (
          <Link
            key={tab.label}
            href={tab.href}
            className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium ${
              pathname === tab.href
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {tab.label}
          </Link>
        ) : (
          <span
            key={tab.label}
            title="Bientôt disponible"
            className="shrink-0 cursor-not-allowed whitespace-nowrap rounded-md px-3 py-2 text-sm text-zinc-400"
          >
            {tab.label}
          </span>
        )
      )}
    </nav>
  );
}
