"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { MargueriteLogo } from "@/components/MargueriteLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

const TABS: { label: string; href?: string }[] = [
  { label: "Accueil", href: "/" },
  { label: "Planning", href: "/planning" },
  { label: "Tâches du jour", href: "/taches" },
  { label: "Congés", href: "/conges" },
  { label: "Documents", href: "/documents" },
  { label: "Indicateurs", href: "/indicateurs" },
  { label: "Notes de frais", href: "/notes-frais" },
  { label: "Factures fournisseurs", href: "/factures-fournisseurs" },
  { label: "Annonces", href: "/annonces" },
  { label: "Onboarding", href: "/onboarding" },
  { label: "Rappels et échéances", href: "/echeances" },
  { label: "Messagerie", href: "/messagerie" },
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
    <header className="flex flex-col border-b border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MargueriteLogo className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Marguerite
          </span>
        </div>
        <ThemeToggle />
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2">
        {TABS.map((tab) =>
          tab.href ? (
            <Link
              key={tab.label}
              href={tab.href}
              className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium ${
                pathname === tab.href
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ) : (
            <span
              key={tab.label}
              title="Bientôt disponible"
              className="shrink-0 cursor-not-allowed whitespace-nowrap rounded-md px-3 py-2 text-sm text-faint-foreground"
            >
              {tab.label}
            </span>
          )
        )}
      </nav>
    </header>
  );
}
