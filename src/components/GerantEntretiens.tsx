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
  demandeurNom: string;
  boutiqueNom: string | null;
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

export function GerantEntretiens() {
  const profile = useUserProfile();
  const [vue, setVue] = useState<"a_traiter" | "traitees">("a_traiter");
  const [demandes, setDemandes] = useState<DemandeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Saisies par demande en attente : date proposée et réponse libre.
  const [dates, setDates] = useState<Record<string, string>>({});
  const [reponses, setReponses] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("demandes_entretien")
      .select(
        "id, commentaire, statut, date_entretien, reponse, created_at, demandeur:utilisateurs!demandeur_id(nom), boutiques(nom)"
      )
      .order("created_at", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    type Join = { nom: string } | { nom: string }[] | null;
    const rows = (data ?? []) as unknown as {
      id: string;
      commentaire: string;
      statut: DemandeRow["statut"];
      date_entretien: string | null;
      reponse: string | null;
      created_at: string;
      demandeur: Join;
      boutiques: Join;
    }[];

    setDemandes(
      rows.map((r) => {
        const demandeur = Array.isArray(r.demandeur) ? r.demandeur[0] : r.demandeur;
        const boutique = Array.isArray(r.boutiques) ? r.boutiques[0] : r.boutiques;
        return {
          id: r.id,
          commentaire: r.commentaire,
          statut: r.statut,
          date_entretien: r.date_entretien,
          reponse: r.reponse,
          created_at: r.created_at,
          demandeurNom: demandeur?.nom ?? "?",
          boutiqueNom: boutique?.nom ?? null,
        };
      })
    );
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, statut: "acceptee" | "refusee") {
    if (!profile) return;
    setDecidingId(id);
    setError(null);

    const { error: updateError } = await supabase
      .from("demandes_entretien")
      .update({
        statut,
        date_entretien: statut === "acceptee" ? dates[id] || null : null,
        reponse: reponses[id]?.trim() || null,
        traite_par: profile.id,
      })
      .eq("id", id);

    setDecidingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await load();
  }

  if (!profile) return null;

  const enAttente = demandes.filter((d) => d.statut === "en_attente");
  const traitees = demandes
    .filter((d) => d.statut !== "en_attente")
    .reverse();
  const visibles = vue === "a_traiter" ? enAttente : traitees;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-medium text-foreground">Entretiens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Demandes d&apos;entretien de vos équipes, toutes boutiques confondues.
        </p>
      </div>

      <div className="inline-flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => setVue("a_traiter")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            vue === "a_traiter"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
          }`}
        >
          À traiter{enAttente.length > 0 ? ` (${enAttente.length})` : ""}
        </button>
        <button
          onClick={() => setVue("traitees")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            vue === "traitees"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
          }`}
        >
          Traitées
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-faint-foreground">
          {vue === "a_traiter"
            ? "Aucune demande en attente pour l'instant."
            : "Aucune demande traitée pour l'instant."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {visibles.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  {d.demandeurNom}
                  {d.boutiqueNom && (
                    <span className="ml-2 rounded-full bg-border/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {d.boutiqueNom}
                    </span>
                  )}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_STYLE[d.statut]}`}
                >
                  {STATUT_LABEL[d.statut]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{d.commentaire}</p>
              <p className="text-xs text-faint-foreground">
                Demandé le {formatDateTime(d.created_at)}
              </p>

              {d.statut === "en_attente" ? (
                <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`date-${d.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Date proposée (optionnelle)
                    </label>
                    <input
                      id={`date-${d.id}`}
                      type="date"
                      value={dates[d.id] ?? ""}
                      onChange={(e) =>
                        setDates((prev) => ({ ...prev, [d.id]: e.target.value }))
                      }
                      className="w-fit rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`reponse-${d.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Réponse (optionnelle)
                    </label>
                    <textarea
                      id={`reponse-${d.id}`}
                      rows={2}
                      value={reponses[d.id] ?? ""}
                      onChange={(e) =>
                        setReponses((prev) => ({
                          ...prev,
                          [d.id]: e.target.value,
                        }))
                      }
                      placeholder="ex. Jeudi 16h à la boutique, prévois 30 minutes."
                      className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => decide(d.id, "acceptee")}
                      disabled={decidingId === d.id}
                      className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => decide(d.id, "refusee")}
                      disabled={decidingId === d.id}
                      className="rounded-md border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {d.statut === "acceptee" && d.date_entretien && (
                    <p className="text-xs font-medium text-green-600 dark:text-green-400">
                      Entretien prévu le {formatDate(d.date_entretien)}
                    </p>
                  )}
                  {d.reponse && (
                    <p className="text-xs text-muted-foreground">
                      Réponse : {d.reponse}
                    </p>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
