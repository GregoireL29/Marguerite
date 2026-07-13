"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

const CATEGORIES = ["Repas", "Déplacement", "Fournitures", "Matériel", "Autre"];

type Statut = "en_attente" | "validee" | "refusee" | "remboursee";

const STATUT_LABEL: Record<Statut, string> = {
  en_attente: "En attente",
  validee: "Validée",
  refusee: "Refusée",
  remboursee: "Remboursée",
};

const STATUT_STYLE: Record<Statut, string> = {
  en_attente: "bg-border/30 text-muted-foreground",
  validee: "bg-green-100 text-green-700 dark:text-green-400",
  refusee: "bg-red-100 text-red-700",
  remboursee: "bg-accent text-accent-foreground",
};

interface NoteFrais {
  id: string;
  montant: number;
  categorie: string;
  descriptif: string;
  ticket_url: string;
  statut: Statut;
  created_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SalarieNotesFrais({ embedded = false }: { embedded?: boolean } = {}) {
  const profile = useUserProfile();
  const [notes, setNotes] = useState<NoteFrais[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [montant, setMontant] = useState("");
  const [categorie, setCategorie] = useState(CATEGORIES[0]);
  const [descriptif, setDescriptif] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("notes_frais")
      .select("id, montant, categorie, descriptif, ticket_url, statut, created_at")
      .eq("utilisateur_id", profile.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setNotes((data ?? []) as NoteFrais[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !file) return;

    setSaving(true);
    setError(null);

    const path = `${profile.boutique_id}/notes-frais/${profile.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, file);

    if (uploadError) {
      setError(uploadError.message);
      setSaving(false);
      return;
    }

    // Un manager qui dépose une note pour lui-même n'a personne pour la
    // valider en première ligne (c'est justement son propre rôle pour son
    // équipe) : elle saute donc directement l'étape "en attente" et atterrit
    // dans la file "à rembourser" du gérant, sans repasser par lui-même.
    const statut = profile.role === "salarie" ? undefined : "validee";

    const { error: insertError } = await supabase.from("notes_frais").insert({
      utilisateur_id: profile.id,
      boutique_id: profile.boutique_id,
      montant: Number(montant),
      categorie,
      descriptif,
      ticket_url: path,
      ...(statut ? { statut } : {}),
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setMontant("");
    setCategorie(CATEGORIES[0]);
    setDescriptif("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSaving(false);
    await load();
  }

  if (!profile) return null;

  const content = (
    <>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-border p-4"
      >
        <p className="text-sm font-medium text-foreground">Nouvelle note de frais</p>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="montant" className="text-sm text-muted-foreground">
              Montant (€)
            </label>
            <input
              id="montant"
              type="number"
              step="0.01"
              min="0"
              required
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="categorie" className="text-sm text-muted-foreground">
              Catégorie
            </label>
            <select
              id="categorie"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="descriptif" className="text-sm text-muted-foreground">
            Descriptif
          </label>
          <textarea
            id="descriptif"
            required
            rows={2}
            value={descriptif}
            onChange={(e) => setDescriptif(e.target.value)}
            placeholder="ex. Repas client du 12/07"
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ticket-file" className="text-sm text-muted-foreground">
            Photo du ticket
          </label>
          <input
            id="ticket-file"
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-muted-foreground"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !file}
          className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {saving ? "Envoi..." : "Envoyer la note de frais"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">Historique</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-faint-foreground">Aucune note de frais pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {notes.map((n) => (
              <li key={n.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {n.categorie} — {Number(n.montant).toFixed(2)} €
                  </p>
                  <p className="text-xs text-muted-foreground">{n.descriptif}</p>
                  <p className="text-xs text-faint-foreground">{formatDate(n.created_at)}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_STYLE[n.statut]}`}
                >
                  {STATUT_LABEL[n.statut]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-6">{content}</div>;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-foreground">Notes de frais</h1>
      {content}
    </main>
  );
}
