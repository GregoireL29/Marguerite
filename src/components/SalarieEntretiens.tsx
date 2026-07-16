"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

interface DemandeRow {
  id: string;
  commentaire: string;
  statut: "en_attente" | "acceptee" | "refusee";
  date_entretien: string | null;
  reponse: string | null;
  created_at: string;
}

const STATUT_LABEL: Record<DemandeRow["statut"], string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Refusée",
};

const STATUT_STYLE: Record<DemandeRow["statut"], string> = {
  en_attente: "bg-border/30 text-muted-foreground",
  acceptee: "bg-green-100 text-green-700 dark:text-green-400",
  refusee: "bg-red-100 text-red-700",
};

function formatDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SalarieEntretiens() {
  const profile = useUserProfile();
  const [demandes, setDemandes] = useState<DemandeRow[]>([]);
  const [commentaire, setCommentaire] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("demandes_entretien")
      .select("id, commentaire, statut, date_entretien, reponse, created_at")
      .eq("demandeur_id", profile.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setDemandes((data ?? []) as DemandeRow[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.boutique_id) return;

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase
      .from("demandes_entretien")
      .insert({
        demandeur_id: profile.id,
        boutique_id: profile.boutique_id,
        commentaire: commentaire.trim(),
      });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setCommentaire("");
    await load();
  }

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-medium text-foreground">Entretiens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Demandez un entretien au gérant en décrivant ce dont vous souhaitez
          parler.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="commentaire" className="text-sm text-muted-foreground">
            Ordre du jour souhaité
          </label>
          <textarea
            id="commentaire"
            required
            rows={3}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="ex. Point sur mon évolution, organisation des horaires..."
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !commentaire.trim()}
          className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {saving ? "Envoi..." : "Envoyer la demande"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">Mes demandes</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : demandes.length === 0 ? (
          <p className="text-sm text-faint-foreground">
            Aucune demande pour l&apos;instant.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {demandes.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-foreground">{d.commentaire}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_STYLE[d.statut]}`}
                  >
                    {STATUT_LABEL[d.statut]}
                  </span>
                </div>
                <p className="text-xs text-faint-foreground">
                  Demandé le {formatDateTime(d.created_at)}
                </p>
                {d.statut === "acceptee" && d.date_entretien && (
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">
                    Entretien prévu le {formatDate(d.date_entretien)}
                  </p>
                )}
                {d.reponse && (
                  <p className="text-xs text-muted-foreground">
                    Réponse du gérant : {d.reponse}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
