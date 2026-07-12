"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { BoutiqueForm } from "@/components/BoutiqueForm";

interface BoutiqueRow {
  id: string;
  nom: string;
  adresse: string | null;
}

function ManagerBoutique({ boutiqueId }: { boutiqueId: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/planning" className="text-sm text-muted-foreground hover:underline">
          &larr; Planning
        </Link>
        <h1 className="mt-1 text-xl font-medium text-foreground">Ma boutique</h1>
      </div>

      <BoutiqueForm boutiqueId={boutiqueId} />
    </main>
  );
}

function GerantBoutiques() {
  const profile = useUserProfile();
  const [boutiques, setBoutiques] = useState<BoutiqueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [heureOuverture, setHeureOuverture] = useState("09:00");
  const [heureFermeture, setHeureFermeture] = useState("19:00");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("boutiques")
      .select("id, nom, adresse")
      .eq("structure_id", profile.structure_id)
      .order("nom");

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    setBoutiques(data ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setCreating(true);
    setError(null);

    const boutiqueId = crypto.randomUUID();
    const creneauOuverture = { debut: heureOuverture, fin: heureFermeture };
    const horaires = {
      lun: [creneauOuverture],
      mar: [creneauOuverture],
      mer: [creneauOuverture],
      jeu: [creneauOuverture],
      ven: [creneauOuverture],
      sam: [creneauOuverture],
      dim: [],
    };

    const { error: insertError } = await supabase.from("boutiques").insert({
      id: boutiqueId,
      structure_id: profile.structure_id,
      nom,
      adresse: adresse || null,
      horaires,
    });

    setCreating(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNom("");
    setAdresse("");
    setHeureOuverture("09:00");
    setHeureFermeture("19:00");
    setShowCreate(false);
    await load();
  }

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/planning" className="text-sm text-muted-foreground hover:underline">
            &larr; Planning
          </Link>
          <h1 className="mt-1 text-xl font-medium text-foreground">Mes boutiques</h1>
        </div>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
        >
          {showCreate ? "Annuler" : "+ Nouvelle boutique"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-md border border-border p-4"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="nom_boutique" className="text-sm text-muted-foreground">
              Nom de la boutique
            </label>
            <input
              id="nom_boutique"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="adresse_boutique" className="text-sm text-muted-foreground">
              Adresse (optionnel)
            </label>
            <input
              id="adresse_boutique"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="heure_ouverture" className="text-sm text-muted-foreground">
                Ouverture
              </label>
              <input
                id="heure_ouverture"
                type="time"
                value={heureOuverture}
                onChange={(e) => setHeureOuverture(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="heure_fermeture" className="text-sm text-muted-foreground">
                Fermeture
              </label>
              <input
                id="heure_fermeture"
                type="time"
                value={heureFermeture}
                onChange={(e) => setHeureFermeture(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {creating ? "Création..." : "Créer la boutique"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : boutiques.length === 0 ? (
        <p className="text-sm text-faint-foreground">Aucune boutique pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {boutiques.map((b) => (
            <li key={b.id} className="flex flex-col gap-3 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{b.nom}</p>
                  {b.adresse && (
                    <p className="text-xs text-muted-foreground">{b.adresse}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedId(selectedId === b.id ? null : b.id)}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  {selectedId === b.id ? "Fermer" : "Modifier"}
                </button>
              </div>

              {selectedId === b.id && (
                <div className="rounded-md border border-border p-4">
                  <BoutiqueForm boutiqueId={b.id} onSaved={load} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function BoutiquePage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "gerant") {
    return <GerantBoutiques />;
  }

  if (!profile.boutique_id) return null;

  return <ManagerBoutique boutiqueId={profile.boutique_id} />;
}
