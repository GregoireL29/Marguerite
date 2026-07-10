"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { TacheReportConfirmation, type TacheStale } from "@/components/TacheReportConfirmation";

interface Tache {
  id: string;
  titre: string;
  categorie: string;
  assigne_a: string | null;
  statut: "a_faire" | "faite" | "reportee";
  boutique_id: string;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function SalarieTaches() {
  const profile = useUserProfile();
  const [staleTaches, setStaleTaches] = useState<TacheStale[] | null>(null);
  const [taches, setTaches] = useState<Tache[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const todayISO = toISODate(new Date());

    const [staleRes, todayRes] = await Promise.all([
      supabase
        .from("taches")
        .select("id, titre, categorie, assigne_a, statut, boutique_id")
        .eq("assigne_a", profile.id)
        .eq("statut", "a_faire")
        .lt("date", todayISO),
      supabase
        .from("taches")
        .select("id, titre, categorie, assigne_a, statut, boutique_id")
        .eq("assigne_a", profile.id)
        .eq("date", todayISO)
        .order("created_at"),
    ]);

    if (staleRes.error) {
      setError(staleRes.error.message);
      setLoading(false);
      return;
    }
    if (todayRes.error) {
      setError(todayRes.error.message);
      setLoading(false);
      return;
    }

    setStaleTaches((staleRes.data ?? []) as TacheStale[]);
    setTaches((todayRes.data ?? []) as Tache[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(t: Tache) {
    const next = t.statut === "faite" ? "a_faire" : "faite";
    const { error: updateError } = await supabase
      .from("taches")
      .update({ statut: next })
      .eq("id", t.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await load();
  }

  if (!profile) return null;

  if (loading || staleTaches === null) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </main>
    );
  }

  if (staleTaches.length > 0) {
    return <TacheReportConfirmation taches={staleTaches} onDone={load} />;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-foreground">Tâches du jour</h1>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {taches.length === 0 ? (
        <p className="text-sm text-faint-foreground">
          Aucune tâche pour aujourd&apos;hui.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {taches.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-3">
              <input
                type="checkbox"
                checked={t.statut === "faite"}
                onChange={() => toggle(t)}
              />
              <span
                className={`text-sm ${
                  t.statut === "faite"
                    ? "text-faint-foreground line-through"
                    : "text-foreground"
                }`}
              >
                {t.titre}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
