"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type JourRepos = "lun" | "mar" | "mer" | "jeu" | "ven" | "sam" | "dim";

const JOURS: { value: JourRepos; label: string }[] = [
  { value: "lun", label: "Lun" },
  { value: "mar", label: "Mar" },
  { value: "mer", label: "Mer" },
  { value: "jeu", label: "Jeu" },
  { value: "ven", label: "Ven" },
  { value: "sam", label: "Sam" },
  { value: "dim", label: "Dim" },
];

const TYPES_CONTRAT = [
  { value: "cdi_temps_plein", label: "CDI temps plein" },
  { value: "cdi_temps_partiel", label: "CDI temps partiel" },
  { value: "cdd", label: "CDD" },
  { value: "alternance", label: "Alternance" },
  { value: "extra", label: "Extra" },
];

interface ProfilSalarie {
  id: string;
  utilisateur_id: string;
  type_contrat: string;
  heures_hebdo: number;
  jours_repos_fixes: JourRepos[];
  solde_conges_jours: number | null;
}

interface Salarie {
  id: string;
  nom: string;
  email: string;
  couleur: string;
  profils_salarie: ProfilSalarie[];
}

interface FormState {
  nom: string;
  email: string;
  couleur: string;
  type_contrat: string;
  heures_hebdo: string;
  jours_repos_fixes: JourRepos[];
  solde_conges_jours: string;
}

const EMPTY_FORM: FormState = {
  nom: "",
  email: "",
  couleur: "#6B8F5E",
  type_contrat: "cdi_temps_plein",
  heures_hebdo: "35",
  jours_repos_fixes: [],
  solde_conges_jours: "",
};

export default function EquipePage() {
  const [salaries, setSalaries] = useState<Salarie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadSalaries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("utilisateurs")
      .select("id, nom, email, couleur, profils_salarie(*)")
      .order("nom");

    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setSalaries((data ?? []) as unknown as Salarie[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSalaries();
  }, [loadSalaries]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setMode("form");
  }

  function startEdit(salarie: Salarie) {
    const profil = salarie.profils_salarie[0];
    setEditingId(salarie.id);
    setForm({
      nom: salarie.nom,
      email: salarie.email,
      couleur: salarie.couleur,
      type_contrat: profil?.type_contrat ?? "cdi_temps_plein",
      heures_hebdo: profil ? String(profil.heures_hebdo) : "35",
      jours_repos_fixes: profil?.jours_repos_fixes ?? [],
      solde_conges_jours:
        profil?.solde_conges_jours != null
          ? String(profil.solde_conges_jours)
          : "",
    });
    setError(null);
    setMode("form");
  }

  function toggleJour(jour: JourRepos) {
    setForm((f) => ({
      ...f,
      jours_repos_fixes: f.jours_repos_fixes.includes(jour)
        ? f.jours_repos_fixes.filter((j) => j !== jour)
        : [...f.jours_repos_fixes, jour],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const heuresHebdo = Number(form.heures_hebdo);
    const soldeCongesJours =
      form.solde_conges_jours.trim() === ""
        ? null
        : Number(form.solde_conges_jours);

    if (editingId) {
      const { error: updateUserError } = await supabase
        .from("utilisateurs")
        .update({ nom: form.nom, email: form.email, couleur: form.couleur })
        .eq("id", editingId);

      if (updateUserError) {
        setError(updateUserError.message);
        setSaving(false);
        return;
      }

      const existing = salaries.find((s) => s.id === editingId);
      const existingProfil = existing?.profils_salarie[0];

      const profilPayload = {
        type_contrat: form.type_contrat,
        heures_hebdo: heuresHebdo,
        jours_repos_fixes: form.jours_repos_fixes,
        solde_conges_jours: soldeCongesJours,
      };

      const { error: profilError } = existingProfil
        ? await supabase
            .from("profils_salarie")
            .update(profilPayload)
            .eq("id", existingProfil.id)
        : await supabase
            .from("profils_salarie")
            .insert({ utilisateur_id: editingId, ...profilPayload });

      if (profilError) {
        setError(profilError.message);
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      const { data: currentUser, error: currentUserError } = await supabase
        .from("utilisateurs")
        .select("structure_id")
        .eq("auth_id", authUser?.id ?? "")
        .maybeSingle();

      if (currentUserError || !currentUser?.structure_id) {
        setError(
          currentUserError?.message ?? "Impossible de déterminer votre structure."
        );
        setSaving(false);
        return;
      }

      const { data: newUser, error: insertUserError } = await supabase
        .from("utilisateurs")
        .insert({
          structure_id: currentUser.structure_id,
          nom: form.nom,
          email: form.email,
          couleur: form.couleur,
        })
        .select("id")
        .single();

      if (insertUserError || !newUser) {
        setError(insertUserError?.message ?? "Erreur lors de la création.");
        setSaving(false);
        return;
      }

      const { error: insertProfilError } = await supabase
        .from("profils_salarie")
        .insert({
          utilisateur_id: newUser.id,
          type_contrat: form.type_contrat,
          heures_hebdo: heuresHebdo,
          jours_repos_fixes: form.jours_repos_fixes,
          solde_conges_jours: soldeCongesJours,
        });

      if (insertProfilError) {
        setError(insertProfilError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setMode("list");
    await loadSalaries();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            &larr; Planning
          </Link>
          <h1 className="mt-1 text-xl font-medium text-zinc-900">Équipe</h1>
        </div>
        {mode === "list" && (
          <button
            onClick={startCreate}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
          >
            + Ajouter un salarié
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {mode === "list" &&
        (loading ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : salaries.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucun salarié pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200">
            {salaries.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: s.couleur }}
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {s.nom}
                    </p>
                    <p className="text-xs text-zinc-500">{s.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => startEdit(s)}
                  className="text-sm text-zinc-600 hover:underline"
                >
                  Modifier
                </button>
              </li>
            ))}
          </ul>
        ))}

      {mode === "form" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="nom" className="text-sm text-zinc-600">
              Nom
            </label>
            <input
              id="nom"
              required
              value={form.nom}
              onChange={(e) =>
                setForm((f) => ({ ...f, nom: e.target.value }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm text-zinc-600">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="couleur" className="text-sm text-zinc-600">
              Couleur
            </label>
            <input
              id="couleur"
              type="color"
              value={form.couleur}
              onChange={(e) =>
                setForm((f) => ({ ...f, couleur: e.target.value }))
              }
              className="h-10 w-16 rounded-md border border-zinc-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="type_contrat" className="text-sm text-zinc-600">
              Type de contrat
            </label>
            <select
              id="type_contrat"
              value={form.type_contrat}
              onChange={(e) =>
                setForm((f) => ({ ...f, type_contrat: e.target.value }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            >
              {TYPES_CONTRAT.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="heures_hebdo" className="text-sm text-zinc-600">
              Heures hebdo
            </label>
            <input
              id="heures_hebdo"
              type="number"
              step="0.5"
              min="0"
              required
              value={form.heures_hebdo}
              onChange={(e) =>
                setForm((f) => ({ ...f, heures_hebdo: e.target.value }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="solde_conges_jours"
              className="text-sm text-zinc-600"
            >
              Solde de congés (jours, optionnel)
            </label>
            <input
              id="solde_conges_jours"
              type="number"
              step="0.5"
              min="0"
              value={form.solde_conges_jours}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  solde_conges_jours: e.target.value,
                }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-zinc-600">
              Jours de repos fixes
            </span>
            <div className="flex flex-wrap gap-2">
              {JOURS.map((j) => (
                <label
                  key={j.value}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
                    form.jours_repos_fixes.includes(j.value)
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 text-zinc-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={form.jours_repos_fixes.includes(j.value)}
                    onChange={() => toggleJour(j.value)}
                  />
                  {j.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => setMode("list")}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
