"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { SalarieNotesFrais } from "@/components/SalarieNotesFrais";
import { IconReceipt } from "@/components/icons/MenuIcons";

interface NoteRow {
  id: string;
  montant: number;
  categorie: string;
  descriptif: string;
  ticket_url: string;
  created_at: string;
  nom: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function loadNotesByStatut(
  boutiqueId: string,
  statut: "en_attente" | "validee"
): Promise<NoteRow[]> {
  const { data, error } = await supabase
    .from("notes_frais")
    .select(
      "id, montant, categorie, descriptif, ticket_url, created_at, utilisateurs(nom)"
    )
    .eq("boutique_id", boutiqueId)
    .eq("statut", statut)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    id: string;
    montant: number;
    categorie: string;
    descriptif: string;
    ticket_url: string;
    created_at: string;
    utilisateurs: { nom: string } | { nom: string }[] | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    montant: r.montant,
    categorie: r.categorie,
    descriptif: r.descriptif,
    ticket_url: r.ticket_url,
    created_at: r.created_at,
    nom: Array.isArray(r.utilisateurs)
      ? (r.utilisateurs[0]?.nom ?? "?")
      : (r.utilisateurs?.nom ?? "?"),
  }));
}

export function ManagerNotesFrais({ boutiqueId }: { boutiqueId?: string }) {
  const profile = useUserProfile();
  const effectiveBoutiqueId = boutiqueId ?? profile?.boutique_id ?? null;
  // Validation première ligne (légitimité) et action financière
  // (remboursement) sont deux responsabilités séparées : le manager ne voit
  // que la file "En attente", le gérant ne voit que "À rembourser", sans
  // repasser derrière la décision de légitimité déjà tranchée par le
  // manager (cf. docs/cahier-des-charges.md).
  const isGerant = profile?.role === "gerant";
  const isManager = profile?.role === "manager";
  const [vue, setVue] = useState<"equipe" | "perso">("equipe");
  const [enAttente, setEnAttente] = useState<NoteRow[]>([]);
  const [aRembourser, setARembourser] = useState<NoteRow[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!effectiveBoutiqueId) return;
    setLoading(true);
    setError(null);

    try {
      if (isGerant) {
        const validated = await loadNotesByStatut(effectiveBoutiqueId, "validee");
        setARembourser(validated);
      } else {
        const pending = await loadNotesByStatut(effectiveBoutiqueId, "en_attente");
        setEnAttente(pending);

        const signedEntries = await Promise.all(
          pending.map(async (n) => {
            const { data } = await supabase.storage
              .from("documents")
              .createSignedUrl(n.ticket_url, 300);
            return [n.id, data?.signedUrl ?? ""] as const;
          })
        );
        setPreviews(Object.fromEntries(signedEntries));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement.");
    }

    setLoading(false);
  }, [effectiveBoutiqueId, isGerant]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, statut: "validee" | "refusee") {
    setProcessingId(id);
    setError(null);

    const { error: updateError } = await supabase
      .from("notes_frais")
      .update({ statut })
      .eq("id", id);

    setProcessingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await load();
  }

  async function marquerRembourse(id: string) {
    setProcessingId(id);
    setError(null);

    const { error: updateError } = await supabase
      .from("notes_frais")
      .update({ statut: "remboursee" })
      .eq("id", id);

    setProcessingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await load();
  }

  async function ouvrirTicket(ticketUrl: string) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(ticketUrl, 60);
    if (data) window.open(data.signedUrl, "_blank");
  }

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-foreground">
        Notes de frais {isGerant ? "— à rembourser" : vue === "equipe" ? "— en attente" : ""}
      </h1>

      {isManager && (
        <div className="inline-flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setVue("equipe")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              vue === "equipe"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
            }`}
          >
            Équipe
          </button>
          <button
            onClick={() => setVue("perso")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              vue === "perso"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
            }`}
          >
            Mes notes de frais
          </button>
        </div>
      )}

      {vue === "perso" ? (
        <SalarieNotesFrais embedded />
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : !isGerant ? (
        enAttente.length === 0 ? (
          <p className="text-sm text-faint-foreground">Aucune note en attente.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {enAttente.map((n) => (
              <li key={n.id} className="flex gap-4 py-4">
                {previews[n.id] && (
                  <button
                    onClick={() => ouvrirTicket(n.ticket_url)}
                    className="flex shrink-0 flex-col items-center gap-1"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previews[n.id]}
                      alt="Aperçu du ticket"
                      className="h-20 w-20 rounded-md border border-border object-cover shadow-sm transition-opacity hover:opacity-80"
                    />
                    <span className="text-[10px] text-faint-foreground">Ticket</span>
                  </button>
                )}
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{n.nom}</p>
                    <p className="text-sm text-foreground">
                      {Number(n.montant).toFixed(2)} €
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {n.categorie} · {formatDate(n.created_at)}
                  </p>
                  <p className="text-sm text-muted-foreground">{n.descriptif}</p>
                  <div className="mt-2 flex gap-3">
                    <button
                      onClick={() => decide(n.id, "validee")}
                      disabled={processingId === n.id}
                      className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
                    >
                      Valider
                    </button>
                    <button
                      onClick={() => decide(n.id, "refusee")}
                      disabled={processingId === n.id}
                      className="rounded-md border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : aRembourser.length === 0 ? (
        <p className="text-sm text-faint-foreground">Aucune note validée à rembourser.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {aRembourser.map((n) => (
            <li key={n.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {n.nom} — {Number(n.montant).toFixed(2)} €
                </p>
                <p className="text-xs text-muted-foreground">
                  {n.categorie} · {formatDate(n.created_at)}
                </p>
                <p className="text-sm text-muted-foreground">{n.descriptif}</p>
                <button
                  onClick={() => ouvrirTicket(n.ticket_url)}
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-border/40"
                >
                  <IconReceipt className="h-3.5 w-3.5 shrink-0" />
                  Voir le ticket
                </button>
              </div>
              <button
                onClick={() => marquerRembourse(n.id)}
                disabled={processingId === n.id}
                className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
              >
                Marquer comme remboursé
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
