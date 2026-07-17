"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

const ROLE_LABEL: Record<string, string> = {
  salarie: "Salarié",
  manager: "Manager",
  gerant: "Gérant",
};

export default function ParametresPage() {
  const profile = useUserProfile();
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [savingNom, setSavingNom] = useState(false);
  const [nomSaved, setNomSaved] = useState(false);
  const [nomError, setNomError] = useState<string | null>(null);

  const [nouveauMdp, setNouveauMdp] = useState("");
  const [confirmationMdp, setConfirmationMdp] = useState("");
  const [savingMdp, setSavingMdp] = useState(false);
  const [mdpSaved, setMdpSaved] = useState(false);
  const [mdpError, setMdpError] = useState<string | null>(null);

  const [signingOut, setSigningOut] = useState(false);

  const loadEmail = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    setEmail(data.user?.email ?? null);
  }, []);

  useEffect(() => {
    loadEmail();
  }, [loadEmail]);

  useEffect(() => {
    if (profile) setNom(profile.nom);
  }, [profile]);

  async function handleSaveNom(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSavingNom(true);
    setNomError(null);
    setNomSaved(false);

    const { error } = await supabase
      .from("utilisateurs")
      .update({ nom: nom.trim() })
      .eq("id", profile.id);

    setSavingNom(false);

    if (error) {
      setNomError(error.message);
      return;
    }

    setNomSaved(true);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (nouveauMdp !== confirmationMdp) {
      setMdpError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (nouveauMdp.length < 6) {
      setMdpError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setSavingMdp(true);
    setMdpError(null);
    setMdpSaved(false);

    const { error } = await supabase.auth.updateUser({ password: nouveauMdp });

    setSavingMdp(false);

    if (error) {
      setMdpError(error.message);
      return;
    }

    setNouveauMdp("");
    setConfirmationMdp("");
    setMdpSaved(true);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-foreground">Paramètres</h1>

      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">Informations du compte</p>

        {nomError && <p className="text-sm text-red-600 dark:text-red-400">{nomError}</p>}

        <form onSubmit={handleSaveNom} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="nom" className="text-sm text-muted-foreground">
              Nom affiché
            </label>
            <input
              id="nom"
              required
              value={nom}
              onChange={(e) => {
                setNom(e.target.value);
                setNomSaved(false);
              }}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="rounded-md border border-border bg-border/20 px-3 py-2 text-sm text-foreground">
              {email ?? "…"}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Rôle</p>
            <p className="text-sm text-foreground">
              {ROLE_LABEL[profile.role] ?? profile.role}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingNom || nom.trim() === profile.nom}
              className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {savingNom ? "Enregistrement..." : "Enregistrer"}
            </button>
            {nomSaved && (
              <p className="text-sm text-green-600 dark:text-green-400">Enregistré.</p>
            )}
          </div>
        </form>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">Mot de passe</p>

        {mdpError && <p className="text-sm text-red-600 dark:text-red-400">{mdpError}</p>}

        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="nouveau_mdp" className="text-sm text-muted-foreground">
              Nouveau mot de passe
            </label>
            <input
              id="nouveau_mdp"
              type="password"
              required
              minLength={6}
              value={nouveauMdp}
              onChange={(e) => {
                setNouveauMdp(e.target.value);
                setMdpSaved(false);
              }}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirmation_mdp" className="text-sm text-muted-foreground">
              Confirmer le nouveau mot de passe
            </label>
            <input
              id="confirmation_mdp"
              type="password"
              required
              minLength={6}
              value={confirmationMdp}
              onChange={(e) => {
                setConfirmationMdp(e.target.value);
                setMdpSaved(false);
              }}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingMdp || !nouveauMdp || !confirmationMdp}
              className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {savingMdp ? "Mise à jour..." : "Changer le mot de passe"}
            </button>
            {mdpSaved && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Mot de passe mis à jour.
              </p>
            )}
          </div>
        </form>
      </div>

      {(profile.role === "manager" || profile.role === "gerant") && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-foreground">Raccourcis</p>
          <div className="flex flex-col gap-2">
            <Link
              href="/boutique"
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              {profile.role === "gerant" ? "Mes boutiques" : "Ma boutique"}
            </Link>
            <Link
              href="/equipe"
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Gérer l&apos;équipe
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="self-start rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-border/40 disabled:opacity-50"
        >
          {signingOut ? "Déconnexion..." : "Se déconnecter"}
        </button>
      </div>
    </main>
  );
}
