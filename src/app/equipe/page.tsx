"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

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

const ROLES = [
  { value: "salarie", label: "Salarié" },
  { value: "manager", label: "Manager" },
  { value: "gerant", label: "Gérant" },
];

interface Salarie {
  id: string;
  nom: string;
  email: string;
  couleur: string;
  role: string;
  auth_id: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  profils_salarie: ProfilSalarie[];
}

interface FormState {
  nom: string;
  email: string;
  couleur: string;
  role: string;
  type_contrat: string;
  heures_hebdo: string;
  jours_repos_fixes: JourRepos[];
  solde_conges_jours: string;
}

const EMPTY_FORM: FormState = {
  nom: "",
  email: "",
  couleur: "#6B8F5E",
  role: "salarie",
  type_contrat: "cdi_temps_plein",
  heures_hebdo: "35",
  jours_repos_fixes: [],
  solde_conges_jours: "",
};

export default function EquipePage() {
  const profile = useUserProfile();
  const [salaries, setSalaries] = useState<Salarie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [inviteError, setInviteError] = useState<string | null>(null);

  const loadSalaries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("utilisateurs")
      .select(
        "id, nom, email, couleur, role, auth_id, invite_token, invite_expires_at, profils_salarie(*)"
      )
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
      role: salarie.role,
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

  async function handleInvite(salarie: Salarie) {
    if (!profile) return;
    setInvitingId(salarie.id);
    setInviteError(null);

    const token = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: updateError } = await supabase
      .from("utilisateurs")
      .update({
        invite_token: token,
        invite_expires_at: expiresAt,
        // Un gérant n'est pas rattaché à une boutique unique : on ne le
        // fixe que pour un salarié/manager invité.
        ...(salarie.role === "gerant" ? {} : { boutique_id: profile.boutique_id }),
      })
      .eq("id", salarie.id);

    setInvitingId(null);

    if (updateError) {
      setInviteError(updateError.message);
      return;
    }

    setInviteLinks((links) => ({
      ...links,
      [salarie.id]: `${window.location.origin}/rejoindre/${token}`,
    }));
    await loadSalaries();
  }

  async function handleCopyLink(link: string) {
    await navigator.clipboard.writeText(link);
  }

  // Ouvre le client mail par défaut du manager avec le message pré-rempli :
  // pas d'envoi automatisé côté serveur pour cette première version, un
  // envoi à la demande via mailto suffit.
  function buildInviteMailto(salarie: Salarie, link: string): string {
    const subject = "Invitation à rejoindre Marguerite";
    const body = `Bonjour ${salarie.nom},\n\nVoici votre lien d'invitation pour rejoindre votre espace Marguerite :\n${link}\n\nCe lien expire dans 7 jours.`;
    return `mailto:${salarie.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
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
        .update({
          nom: form.nom,
          email: form.email,
          couleur: form.couleur,
          role: form.role,
        })
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
          role: form.role,
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
          <Link href="/planning" className="text-sm text-muted-foreground hover:underline">
            &larr; Planning
          </Link>
          <h1 className="mt-1 text-xl font-medium text-foreground">Équipe</h1>
        </div>
        {mode === "list" && (
          <button
            onClick={startCreate}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
          >
            + Ajouter un salarié
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {inviteError && (
        <p className="text-sm text-red-600 dark:text-red-400">{inviteError}</p>
      )}

      {mode === "list" &&
        (loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : salaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun salarié pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {salaries.map((s) => {
              const isExpired =
                s.invite_expires_at != null &&
                new Date(s.invite_expires_at) < new Date();
              const hasPendingInvite =
                !s.auth_id && s.invite_token != null && !isExpired;
              const link =
                inviteLinks[s.id] ??
                (hasPendingInvite && typeof window !== "undefined"
                  ? `${window.location.origin}/rejoindre/${s.invite_token}`
                  : null);

              return (
                <li key={s.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: s.couleur }}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {s.nom}
                          {s.role !== "salarie" && (
                            <span className="ml-2 rounded-full bg-border/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {s.role === "gerant" ? "Gérant" : "Manager"}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {!s.auth_id && (
                        <button
                          onClick={() => handleInvite(s)}
                          disabled={invitingId === s.id}
                          className="text-sm text-accent hover:underline disabled:opacity-50"
                        >
                          {invitingId === s.id
                            ? "Envoi..."
                            : hasPendingInvite
                              ? "Renvoyer"
                              : "Inviter"}
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(s)}
                        className="text-sm text-muted-foreground hover:underline"
                      >
                        Modifier
                      </button>
                    </div>
                  </div>

                  {!s.auth_id && link && (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                      <p className="flex-1 truncate text-xs text-muted-foreground">
                        {link}
                      </p>
                      <button
                        onClick={() => handleCopyLink(link)}
                        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-border/40"
                      >
                        Copier
                      </button>
                      <a
                        href={buildInviteMailto(s, link)}
                        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-border/40"
                      >
                        Envoyer par email
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ))}

      {mode === "form" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="nom" className="text-sm text-muted-foreground">
              Nom
            </label>
            <input
              id="nom"
              required
              value={form.nom}
              onChange={(e) =>
                setForm((f) => ({ ...f, nom: e.target.value }))
              }
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm text-muted-foreground">
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
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="couleur" className="text-sm text-muted-foreground">
              Couleur
            </label>
            <input
              id="couleur"
              type="color"
              value={form.couleur}
              onChange={(e) =>
                setForm((f) => ({ ...f, couleur: e.target.value }))
              }
              className="h-10 w-16 rounded-md border border-border"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="role" className="text-sm text-muted-foreground">
              Rôle
            </label>
            <select
              id="role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="type_contrat" className="text-sm text-muted-foreground">
              Type de contrat
            </label>
            <select
              id="type_contrat"
              value={form.type_contrat}
              onChange={(e) =>
                setForm((f) => ({ ...f, type_contrat: e.target.value }))
              }
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {TYPES_CONTRAT.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="heures_hebdo" className="text-sm text-muted-foreground">
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
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="solde_conges_jours"
              className="text-sm text-muted-foreground"
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
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">
              Jours de repos fixes
            </span>
            <div className="flex flex-wrap gap-2">
              {JOURS.map((j) => (
                <label
                  key={j.value}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
                    form.jours_repos_fixes.includes(j.value)
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground"
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
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => setMode("list")}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
