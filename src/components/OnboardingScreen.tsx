"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface OnboardingScreenProps {
  authId: string;
  email: string;
  onComplete: () => Promise<void> | void;
}

export function OnboardingScreen({
  authId,
  email,
  onComplete,
}: OnboardingScreenProps) {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [nomStructure, setNomStructure] = useState("");
  const [nomBoutique, setNomBoutique] = useState("");
  const [adresse, setAdresse] = useState("");
  const [heureOuverture, setHeureOuverture] = useState("09:00");
  const [heureFermeture, setHeureFermeture] = useState("19:00");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // UUID généré côté client, sans .select() chaîné après l'insert : à la
    // création, aucune ligne utilisateurs ne référence encore cette
    // structure/boutique, donc la policy RLS de lecture (qui exige une
    // appartenance) bloquerait le RETURNING d'un insert().select().
    const structureId = crypto.randomUUID();
    const { error: structureError } = await supabase
      .from("structures")
      .insert({ id: structureId, nom: nomStructure });

    if (structureError) {
      setError(structureError.message);
      setSaving(false);
      return;
    }

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
    const { error: boutiqueError } = await supabase.from("boutiques").insert({
      id: boutiqueId,
      structure_id: structureId,
      nom: nomBoutique,
      adresse: adresse || null,
      horaires,
    });

    if (boutiqueError) {
      setError(boutiqueError.message);
      setSaving(false);
      return;
    }

    const { data: existing } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();

    const payload = {
      structure_id: structureId,
      boutique_id: boutiqueId,
      role: "manager",
    };

    const { error: userError } = existing
      ? await supabase
          .from("utilisateurs")
          .update(payload)
          .eq("id", existing.id)
      : await supabase.from("utilisateurs").insert({
          auth_id: authId,
          nom,
          email,
          ...payload,
        });

    if (userError) {
      setError(userError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    await onComplete();
    router.push("/");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <div>
          <h1 className="text-xl font-medium text-zinc-900">
            Bienvenue sur Marguerite
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configurons votre structure et votre première boutique.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="nom" className="text-sm text-zinc-600">
            Votre nom
          </label>
          <input
            id="nom"
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="nom_structure" className="text-sm text-zinc-600">
            Nom de la structure
          </label>
          <input
            id="nom_structure"
            required
            value={nomStructure}
            onChange={(e) => setNomStructure(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="nom_boutique" className="text-sm text-zinc-600">
            Nom de la boutique
          </label>
          <input
            id="nom_boutique"
            required
            value={nomBoutique}
            onChange={(e) => setNomBoutique(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="adresse" className="text-sm text-zinc-600">
            Adresse (optionnel)
          </label>
          <input
            id="adresse"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="heure_ouverture" className="text-sm text-zinc-600">
              Ouverture
            </label>
            <input
              id="heure_ouverture"
              type="time"
              value={heureOuverture}
              onChange={(e) => setHeureOuverture(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="heure_fermeture" className="text-sm text-zinc-600">
              Fermeture
            </label>
            <input
              id="heure_fermeture"
              type="time"
              value={heureFermeture}
              onChange={(e) => setHeureFermeture(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Configuration..." : "Configurer mon espace"}
        </button>
      </form>
    </main>
  );
}
