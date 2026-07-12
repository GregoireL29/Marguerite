"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

type Onglet = "en_attente" | "a_rembourser";

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

export function ManagerNotesFrais() {
  const profile = useUserProfile();
  const [onglet, setOnglet] = useState<Onglet>("en_attente");
  const [enAttente, setEnAttente] = useState<NoteRow[]>([]);
  const [aRembourser, setARembourser] = useState<NoteRow[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.boutique_id) return;
    setLoading(true);
    setError(null);

    try {
      const [pending, validated] = await Promise.all([
        loadNotesByStatut(profile.boutique_id, "en_attente"),
        loadNotesByStatut(profile.boutique_id, "validee"),
      ]);

      setEnAttente(pending);
      setARembourser(validated);

      const signedEntries = await Promise.all(
        pending.map(async (n) => {
          const { data } = await supabase.storage
            .from("documents")
            .createSignedUrl(n.ticket_url, 300);
          return [n.id, data?.signedUrl ?? ""] as const;
        })
      );
      setPreviews(Object.fromEntries(signedEntries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement.");
    }

    setLoading(false);
  }, [profile]);

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
      <h1 className="text-xl font-medium text-foreground">Notes de frais</h1>

      <div className="flex gap-1">
        <button
          onClick={() => setOnglet("en_attente")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            onglet === "en_attente"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-border/40"
          }`}
        >
          En attente
        </button>
        <button
          onClick={() => setOnglet("a_rembourser")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            onglet === "a_rembourser"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-border/40"
          }`}
        >
          À rembourser
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : onglet === "en_attente" ? (
        enAttente.length === 0 ? (
          <p className="text-sm text-faint-foreground">Aucune note en attente.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {enAttente.map((n) => (
              <li key={n.id} className="flex gap-3 py-4">
                {previews[n.id] && (
                  <button onClick={() => ouvrirTicket(n.ticket_url)} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previews[n.id]}
                      alt="Aperçu du ticket"
                      className="h-20 w-20 rounded-md border border-border object-cover"
                    />
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
                  className="text-xs text-muted-foreground hover:underline"
                >
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
