"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { TacheReportConfirmation, type TacheStale } from "@/components/TacheReportConfirmation";

type Categorie = "ouverture" | "journee" | "fermeture";
type Statut = "a_faire" | "faite" | "reportee";

const CATEGORIES: { value: Categorie; label: string }[] = [
  { value: "ouverture", label: "Ouverture" },
  { value: "journee", label: "Journée" },
  { value: "fermeture", label: "Fermeture" },
];

interface Tache {
  id: string;
  titre: string;
  categorie: Categorie;
  assigne_a: string | null;
  statut: Statut;
  boutique_id: string;
}

interface Salarie {
  id: string;
  nom: string;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ManagerTaches({ boutiqueId }: { boutiqueId?: string }) {
  const profile = useUserProfile();
  const effectiveBoutiqueId = boutiqueId ?? profile?.boutique_id ?? null;
  const [staleTaches, setStaleTaches] = useState<TacheStale[] | null>(null);
  const [taches, setTaches] = useState<Tache[]>([]);
  const [salaries, setSalaries] = useState<Salarie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [titre, setTitre] = useState("");
  const [categorie, setCategorie] = useState<Categorie>("ouverture");
  const [assigneA, setAssigneA] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile || !effectiveBoutiqueId) return;
    setLoading(true);
    setError(null);

    const todayISO = toISODate(new Date());

    const [staleRes, todayRes, salariesRes] = await Promise.all([
      supabase
        .from("taches")
        .select("id, titre, categorie, assigne_a, statut, boutique_id")
        .eq("boutique_id", effectiveBoutiqueId)
        .eq("statut", "a_faire")
        .lt("date", todayISO),
      supabase
        .from("taches")
        .select("id, titre, categorie, assigne_a, statut, boutique_id")
        .eq("boutique_id", effectiveBoutiqueId)
        .eq("date", todayISO)
        .order("created_at"),
      supabase
        .from("utilisateurs")
        .select("id, nom")
        .eq("boutique_id", effectiveBoutiqueId)
        .order("nom"),
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
    if (salariesRes.error) {
      setError(salariesRes.error.message);
      setLoading(false);
      return;
    }

    setStaleTaches((staleRes.data ?? []) as TacheStale[]);
    setTaches((todayRes.data ?? []) as Tache[]);
    setSalaries(salariesRes.data ?? []);
    setLoading(false);
  }, [profile, effectiveBoutiqueId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(t: Tache) {
    const confirmed = window.confirm(`Supprimer la tâche "${t.titre}" ?`);
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("taches")
      .delete()
      .eq("id", t.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await load();
  }

  async function toggleStatut(t: Tache) {
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !effectiveBoutiqueId) return;
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("taches").insert({
      boutique_id: effectiveBoutiqueId,
      titre: titre.trim(),
      categorie,
      assigne_a: assigneA || null,
      date: toISODate(new Date()),
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTitre("");
    setCategorie("ouverture");
    setAssigneA("");
    setShowForm(false);
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

  const total = taches.length;
  const done = taches.filter((t) => t.statut === "faite").length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const salariesById = Object.fromEntries(salaries.map((s) => [s.id, s.nom]));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground">Tâches du jour</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
        >
          {showForm ? "Annuler" : "+ Ajouter une tâche"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {total > 0 && (
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full overflow-hidden rounded bg-border/30">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {done} / {total} tâches faites ({progress}%)
          </p>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-md border border-border p-4"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="titre" className="text-sm text-muted-foreground">
              Titre
            </label>
            <input
              id="titre"
              required
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="categorie" className="text-sm text-muted-foreground">
                Catégorie
              </label>
              <select
                id="categorie"
                value={categorie}
                onChange={(e) => setCategorie(e.target.value as Categorie)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="assigne_a" className="text-sm text-muted-foreground">
                Assigner à
              </label>
              <select
                id="assigne_a"
                value={assigneA}
                onChange={(e) => setAssigneA(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="">Non assigné</option>
                {salaries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {saving ? "Ajout..." : "Ajouter"}
          </button>
        </form>
      )}

      {total === 0 ? (
        <p className="text-sm text-faint-foreground">Aucune tâche aujourd&apos;hui.</p>
      ) : (
        CATEGORIES.map(({ value, label }) => {
          const items = taches.filter((t) => t.categorie === value);
          if (items.length === 0) return null;

          return (
            <div key={value} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-foreground">{label}</h2>
              <ul className="flex flex-col divide-y divide-border">
                {items.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between py-2"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={t.statut === "faite"}
                        onChange={() => toggleStatut(t)}
                      />
                      <span
                        className={
                          t.statut === "faite"
                            ? "text-faint-foreground line-through"
                            : "text-foreground"
                        }
                      >
                        {t.titre}
                      </span>
                    </label>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-faint-foreground">
                        {t.assigne_a
                          ? (salariesById[t.assigne_a] ?? "?")
                          : "Non assigné"}
                      </span>
                      <button
                        onClick={() => handleDelete(t)}
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </main>
  );
}
