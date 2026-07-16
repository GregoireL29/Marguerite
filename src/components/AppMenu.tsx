"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { MargueriteLogo } from "@/components/MargueriteLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUserProfile } from "@/components/AppShell";
import {
  IconHome,
  IconCalendar,
  IconChecklist,
  IconSun,
  IconSpeechBubble,
  IconDialogue,
  IconMegaphone,
  IconBarChart,
  IconReceipt,
  IconInvoice,
  IconFolder,
  IconBook,
  IconBell,
  IconClock,
  IconGauge,
  IconPeople,
  IconMoon,
  IconQuestion,
  IconChevronDown,
} from "@/components/icons/MenuIcons";

interface TabItem {
  label: string;
  href: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  // Rôles pour lesquels cet onglet reste masqué dans le menu (la protection
  // de route dans AppShell reste la garde-fou réel ; ceci n'est qu'un
  // affinage de navigation).
  hiddenForRoles?: string[];
}

interface CategoryItem {
  key: string;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  tabs: TabItem[];
}

const ACCUEIL: TabItem = { label: "Accueil", href: "/", icon: IconHome };
const AIDE: TabItem = { label: "Aide", href: "/aide", icon: IconQuestion };

const CATEGORIES: CategoryItem[] = [
  {
    key: "quotidien",
    label: "Quotidien",
    icon: IconClock,
    tabs: [
      { label: "Planning", href: "/planning", icon: IconCalendar },
      { label: "Tâches du jour", href: "/taches", icon: IconChecklist },
      { label: "Congés", href: "/conges", icon: IconSun },
      { label: "Messagerie", href: "/messagerie", icon: IconSpeechBubble },
      { label: "Annonces", href: "/annonces", icon: IconMegaphone },
      {
        label: "Fin de journée",
        href: "/fin-de-journee",
        icon: IconMoon,
        hiddenForRoles: ["gerant"],
      },
    ],
  },
  {
    key: "pilotage",
    label: "Pilotage",
    icon: IconGauge,
    tabs: [
      { label: "Indicateurs", href: "/indicateurs", icon: IconBarChart },
      { label: "Notes de frais", href: "/notes-frais", icon: IconReceipt },
      {
        label: "Factures fournisseurs",
        href: "/factures-fournisseurs",
        icon: IconInvoice,
        hiddenForRoles: ["salarie"],
      },
    ],
  },
  {
    key: "equipe",
    label: "Équipe",
    icon: IconPeople,
    tabs: [
      { label: "Documents", href: "/documents", icon: IconFolder },
      { label: "Onboarding", href: "/onboarding", icon: IconBook },
      { label: "Entretiens", href: "/entretiens", icon: IconDialogue },
      {
        label: "Rappels et échéances",
        href: "/echeances",
        icon: IconBell,
        hiddenForRoles: ["salarie"],
      },
    ],
  },
];

export function AppMenu() {
  const pathname = usePathname();
  const profile = useUserProfile();
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [alignPanelRight, setAlignPanelRight] = useState(false);
  const navRef = useRef<HTMLElement>(null);

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

  useEffect(() => {
    setOpenCategory(null);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenCategory(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!loaded || !session) return null;

  const role = profile?.role ?? "";
  const visibleCategories = CATEGORIES.map((cat) => ({
    ...cat,
    tabs: cat.tabs.filter((t) => !t.hiddenForRoles?.includes(role)),
  })).filter((cat) => cat.tabs.length > 0);

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
      <nav
        ref={navRef}
        className="relative flex flex-wrap gap-1 border-t border-border px-4 py-2"
      >
        <Link
          href={ACCUEIL.href}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${
            pathname === ACCUEIL.href
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
          }`}
        >
          <ACCUEIL.icon className="h-4 w-4 shrink-0" />
          {ACCUEIL.label}
        </Link>

        {visibleCategories.map((cat) => {
          const isActiveRoute = cat.tabs.some(
            (t) => pathname === t.href || pathname?.startsWith(`${t.href}/`)
          );
          const isOpen = openCategory === cat.key;

          return (
            <div key={cat.key} className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  if (!isOpen) {
                    // Le panneau (largeur fixe w-56, ancré à gauche du
                    // déclencheur) peut déborder à droite du viewport selon
                    // la position du bouton dans la barre en flex-wrap : on
                    // bascule l'ancrage à droite quand ça ne rentre pas.
                    const rect = e.currentTarget.getBoundingClientRect();
                    setAlignPanelRight(rect.left + 224 > window.innerWidth - 16);
                  }
                  setOpenCategory(isOpen ? null : cat.key);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${
                  isActiveRoute
                    ? "bg-accent text-accent-foreground"
                    : isOpen
                      ? "bg-border/40 text-foreground"
                      : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
                }`}
              >
                <cat.icon className="h-4 w-4 shrink-0" />
                {cat.label}
                <IconChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div
                  className={`absolute top-full z-20 mt-1 w-56 rounded-md border border-border bg-card p-1 shadow-sm ${
                    alignPanelRight ? "right-0" : "left-0"
                  }`}
                >
                  {cat.tabs.map((tab) => {
                    const isActiveTab = pathname === tab.href;
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                          isActiveTab
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-border/40"
                        }`}
                      >
                        <tab.icon className="h-4 w-4 shrink-0" />
                        {tab.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <Link
          href={AIDE.href}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${
            pathname === AIDE.href
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
          }`}
        >
          <AIDE.icon className="h-4 w-4 shrink-0" />
          {AIDE.label}
        </Link>
      </nav>
    </header>
  );
}
