"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

interface DemandeRow {
  id: string;
  utilisateur_id: string;
  date_debut: string;
  date_fin: string;
  message: string | null;
  nom: string;
  hasConflit: boolean;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ManagerConges() {
  const profile = useUserProfile();
  const [demandes, setDemandes] = useState<DemandeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("demandes_conges")
      .select(
        "id, utilisateur_id, date_debut, date_fin, message, statut, utilisateurs(nom)"
      )
      .eq("statut", "en_attente")
      .order("created_at", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as {
      id: string;
      utilisateur_id: string;
      date_debut: string;
      date_fin: string;
      message: string | null;
      utilisateurs: { nom: string } | { nom: string }[] | null;
    }[];

    const withConflicts = await Promise.all(
      rows.map(async (r) => {
        const { count } = await supabase
          .from("creneaux")
          .select("id", { count: "exact", head: true })
          .eq("utilisateur_id", r.utilisateur_id)
          .gte("jour", r.date_debut)
          .lte("jour", r.date_fin);

        const nom = Array.isArray(r.utilisateurs)
          ? (r.utilisateurs[0]?.nom ?? "?")
          : (r.utilisateurs?.nom ?? "?");

        return {
          id: r.id,
          utilisateur_id: r.utilisateur_id,
          date_debut: r.date_debut,
          date_fin: r.date_fin,
          message: r.message,
          nom,
          hasConflit: (count ?? 0) > 0,
        };
      })
    );

    setDemandes(withConflicts);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, statut: "validee" | "refusee") {
    setDecidingId(id);
    setError(null);

    const { error: updateError } = await supabase
      .from("demandes_conges")
      .update({ statut })
      .eq("id", id);

    setDecidingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await load();
  }

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-foreground">Congés</h1>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : demandes.length === 0 ? (
        <p className="text-sm text-faint-foreground">
          Aucune demande en attente pour l&apos;instant.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {demandes.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {d.nom}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(d.date_debut)} – {formatDate(d.date_fin)}
                  </p>
                  {d.message && (
                    <p className="mt-1 text-xs text-muted-foreground">{d.message}</p>
                  )}
                </div>
              </div>

              {d.hasConflit && (
                <p className="text-xs font-medium text-amber-600">
                  ⚠ Chevauche un ou plusieurs créneaux déjà planifiés pour
                  cette période.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => decide(d.id, "validee")}
                  disabled={decidingId === d.id}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
                >
                  Valider
                </button>
                <button
                  onClick={() => decide(d.id, "refusee")}
                  disabled={decidingId === d.id}
                  className="rounded-md border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50"
                >
                  Refuser
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
