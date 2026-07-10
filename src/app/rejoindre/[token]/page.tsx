"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { MargueriteLogo } from "@/components/MargueriteLogo";

type Stage =
  | "loading"
  | "invalid"
  | "form"
  | "confirm-email"
  | "claiming"
  | "claim-failed";

interface InviteInfo {
  nom: string;
  email: string;
  structure_nom: string;
  boutique_nom: string | null;
}

export default function RejoindrePage() {
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("loading");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function tryClaim() {
    const { error: claimError } = await supabase.rpc("claim_invite", {
      p_token: token,
    });
    return !claimError;
  }

  useEffect(() => {
    if (!token) return;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData.session) {
        setStage("claiming");
        const ok = await tryClaim();
        if (ok) {
          router.push("/");
          return;
        }
        setError(
          "Ce lien d'invitation n'est plus valable, ou ce compte est déjà relié à un autre profil."
        );
        setStage("claim-failed");
        return;
      }

      const { data, error: rpcError } = await supabase.rpc(
        "get_invite_details",
        { p_token: token }
      );
      const row = Array.isArray(data) ? data[0] : null;

      if (rpcError || !row) {
        setStage("invalid");
        return;
      }

      setInfo(row as InviteInfo);
      setStage("form");
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!info) return;
    setSubmitting(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: info.email,
      password,
      options: { emailRedirectTo: window.location.href },
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    if (!data.session) {
      setStage("confirm-email");
      setSubmitting(false);
      return;
    }

    const ok = await tryClaim();
    setSubmitting(false);

    if (!ok) {
      setError("Impossible de finaliser votre inscription. Contactez votre manager.");
      setStage("claim-failed");
      return;
    }

    router.push("/");
  }

  async function handleSignOutAndRetry() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-1">
        <MargueriteLogo className="h-12 w-12" />
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Marguerite
        </span>
      </div>

      {stage === "loading" || stage === "claiming" ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {stage === "claiming" ? "Finalisation de votre compte..." : "Chargement..."}
        </p>
      ) : stage === "invalid" ? (
        <div className="mt-8 flex w-full max-w-sm flex-col gap-2 text-center">
          <h1 className="text-xl font-medium text-foreground">Invitation invalide</h1>
          <p className="text-sm text-muted-foreground">
            Ce lien d&apos;invitation n&apos;existe pas ou a expiré. Demandez à votre
            manager de vous en envoyer un nouveau.
          </p>
        </div>
      ) : stage === "claim-failed" ? (
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3 text-center">
          <h1 className="text-xl font-medium text-foreground">
            Impossible de finaliser
          </h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={handleSignOutAndRetry}
            className="mt-2 self-center rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-border/40"
          >
            Se déconnecter et réessayer
          </button>
        </div>
      ) : stage === "confirm-email" ? (
        <div className="mt-8 flex w-full max-w-sm flex-col gap-2 text-center">
          <h1 className="text-xl font-medium text-foreground">Presque terminé</h1>
          <p className="text-sm text-muted-foreground">
            Un email de confirmation vient d&apos;être envoyé à {info?.email}.
            Cliquez sur le lien qu&apos;il contient pour finaliser votre inscription
            et rejoindre l&apos;équipe.
          </p>
        </div>
      ) : (
        info && (
          <>
            <div className="mt-8 flex w-full max-w-sm flex-col gap-1 text-center">
              <h1 className="text-2xl font-medium text-foreground">
                Bonjour {info.nom}
              </h1>
              <p className="text-sm text-muted-foreground">
                Vous êtes invité·e à rejoindre {info.structure_nom}
                {info.boutique_nom ? ` — ${info.boutique_nom}` : ""}. Définissez un
                mot de passe pour créer votre compte.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6 flex w-full max-w-sm flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="email" className="text-sm text-muted-foreground">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={info.email}
                  disabled
                  className="rounded-md border border-border bg-border/20 px-3 py-2 text-sm text-muted-foreground"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="password" className="text-sm text-muted-foreground">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
              >
                {submitting ? "Création..." : "Rejoindre l'équipe"}
              </button>
            </form>
          </>
        )
      )}
    </main>
  );
}
