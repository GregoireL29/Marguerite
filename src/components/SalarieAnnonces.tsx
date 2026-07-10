"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

interface Annonce {
  id: string;
  titre: string;
  message: string;
  created_at: string;
  auteur_nom: string;
  lu: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SalarieAnnonces() {
  const profile = useUserProfile();
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const { data: annoncesData, error: annoncesError } = await supabase
      .from("annonces")
      .select("id, titre, message, created_at, utilisateurs(nom)")
      .eq("boutique_id", profile.boutique_id)
      .eq("cible_role", "tous")
      .order("created_at", { ascending: false });

    if (annoncesError) {
      setError(annoncesError.message);
      setLoading(false);
      return;
    }

    const rows = (annoncesData ?? []) as unknown as {
      id: string;
      titre: string;
      message: string;
      created_at: string;
      utilisateurs: { nom: string } | { nom: string }[] | null;
    }[];

    const ids = rows.map((r) => r.id);
    const { data: lecturesData, error: lecturesError } = await supabase
      .from("annonces_lectures")
      .select("annonce_id")
      .eq("utilisateur_id", profile.id)
      .in("annonce_id", ids.length > 0 ? ids : [""]);

    if (lecturesError) {
      setError(lecturesError.message);
      setLoading(false);
      return;
    }

    const luIds = new Set((lecturesData ?? []).map((l) => l.annonce_id));

    setAnnonces(
      rows.map((r) => ({
        id: r.id,
        titre: r.titre,
        message: r.message,
        created_at: r.created_at,
        auteur_nom: Array.isArray(r.utilisateurs)
          ? (r.utilisateurs[0]?.nom ?? "?")
          : (r.utilisateurs?.nom ?? "?"),
        lu: luIds.has(r.id),
      }))
    );

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function marquerLu(annonceId: string) {
    if (!profile) return;
    setMarkingId(annonceId);
    setError(null);

    const { error: upsertError } = await supabase
      .from("annonces_lectures")
      .upsert(
        { annonce_id: annonceId, utilisateur_id: profile.id },
        { onConflict: "annonce_id,utilisateur_id" }
      );

    setMarkingId(null);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setAnnonces((prev) =>
      prev.map((a) => (a.id === annonceId ? { ...a, lu: true } : a))
    );
  }

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-foreground">Annonces</h1>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : annonces.length === 0 ? (
        <p className="text-sm text-faint-foreground">Aucune annonce pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {annonces.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{a.titre}</p>
                <p className="text-xs text-faint-foreground">{formatDate(a.created_at)}</p>
              </div>
              <p className="text-xs text-muted-foreground">Par {a.auteur_nom}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.message}</p>
              {a.lu ? (
                <span className="self-start rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                  Lu
                </span>
              ) : (
                <button
                  onClick={() => marquerLu(a.id)}
                  disabled={markingId === a.id}
                  className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
                >
                  J&apos;ai pris connaissance
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
