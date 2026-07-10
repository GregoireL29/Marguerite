"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import type { WidgetDef } from "@/components/widgets/registry";

interface AccueilGridProps {
  availableWidgets: WidgetDef[];
  defaultPins: string[];
}

export function AccueilGrid({ availableWidgets, defaultPins }: AccueilGridProps) {
  const profile = useUserProfile();
  const [pinnedKeys, setPinnedKeys] = useState<string[] | null>(null);
  const [personalizing, setPersonalizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWelcomeTip, setShowWelcomeTip] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("marguerite-welcome-seen")) {
      setShowWelcomeTip(true);
    }
  }, []);

  function dismissWelcomeTip() {
    localStorage.setItem("marguerite-welcome-seen", "1");
    setShowWelcomeTip(false);
  }

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("widgets_epingles")
      .select("widget_key, ordre")
      .eq("utilisateur_id", profile.id)
      .order("ordre");

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    // Ne garder que les clés qui existent réellement dans le catalogue de ce
    // rôle : si un compte a changé de rôle, ses anciennes pins ne
    // correspondent plus et on retombe sur la sélection par défaut plutôt
    // que d'afficher une grille clairsemée.
    const validKeys = (data ?? [])
      .map((d) => d.widget_key)
      .filter((key) => availableWidgets.some((w) => w.key === key));

    setPinnedKeys(validKeys.length > 0 ? validKeys : defaultPins);
  }, [profile, defaultPins, availableWidgets]);

  useEffect(() => {
    load();
  }, [load]);

  async function persist(newKeys: string[]) {
    if (!profile) return;
    setSaving(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("widgets_epingles")
      .delete()
      .eq("utilisateur_id", profile.id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    if (newKeys.length > 0) {
      const rows = newKeys.map((widget_key, i) => ({
        utilisateur_id: profile.id,
        widget_key,
        ordre: i,
      }));
      const { error: insertError } = await supabase.from("widgets_epingles").insert(rows);
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    setPinnedKeys(newKeys);
    setSaving(false);
  }

  function togglePin(key: string) {
    if (!pinnedKeys) return;
    const next = pinnedKeys.includes(key)
      ? pinnedKeys.filter((k) => k !== key)
      : [...pinnedKeys, key];
    persist(next);
  }

  function move(key: string, direction: "up" | "down") {
    if (!pinnedKeys) return;
    const idx = pinnedKeys.indexOf(key);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= pinnedKeys.length) return;

    const next = [...pinnedKeys];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    persist(next);
  }

  if (!profile || pinnedKeys === null) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <h1 className="text-xl font-medium text-foreground">Accueil</h1>
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </main>
    );
  }

  const pinnedWidgets = pinnedKeys
    .map((key) => availableWidgets.find((w) => w.key === key))
    .filter((w): w is WidgetDef => !!w);

  // En mode personnalisation, les widgets épinglés apparaissent d'abord
  // (dans leur ordre d'épinglage) afin que les flèches ↑/↓ soient
  // visuellement significatives, suivis des widgets non épinglés.
  const widgetsForPersonalize = [
    ...pinnedWidgets,
    ...availableWidgets.filter((w) => !pinnedKeys.includes(w.key)),
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground">Accueil</h1>
        <button
          onClick={() => setPersonalizing((p) => !p)}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-border/40"
        >
          {personalizing ? "Terminer" : "Personnaliser"}
        </button>
      </div>

      {showWelcomeTip && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 p-4">
          <p className="text-sm text-foreground">
            Bienvenue sur Marguerite ! Cet écran est personnalisable : cliquez
            sur « Personnaliser » pour choisir les widgets à afficher et les
            réorganiser selon vos besoins.
          </p>
          <button
            onClick={dismissWelcomeTip}
            aria-label="Fermer"
            className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {personalizing ? (
        <ul className="flex flex-col divide-y divide-border">
          {widgetsForPersonalize.map((w) => {
            const isPinned = pinnedKeys.includes(w.key);
            const idx = pinnedKeys.indexOf(w.key);

            return (
              <li key={w.key} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm text-foreground">{w.label}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {isPinned && (
                    <>
                      <button
                        onClick={() => move(w.key, "up")}
                        disabled={idx === 0 || saving}
                        className="text-xs text-muted-foreground hover:underline disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => move(w.key, "down")}
                        disabled={idx === pinnedKeys.length - 1 || saving}
                        className="text-xs text-muted-foreground hover:underline disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => togglePin(w.key)}
                    disabled={saving}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                      isPinned
                        ? "border border-border text-foreground"
                        : "bg-accent text-accent-foreground hover:bg-accent-hover"
                    }`}
                  >
                    {isPinned ? "Désépingler" : "Épingler"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : pinnedWidgets.length === 0 ? (
        <p className="text-sm text-faint-foreground">
          Aucun widget épinglé. Clique sur « Personnaliser » pour en ajouter.
        </p>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {pinnedWidgets.map((w) => (
            <div key={w.key} className="mb-4 break-inside-avoid">
              <w.component />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
