"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { MargueriteLogo } from "@/components/MargueriteLogo";
import { SplashLogo } from "@/components/SplashLogo";

type SecondaryPanel = null | "creer-profil" | "decouvrir";

export default function LoginPage() {
  const router = useRouter();

  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFadingOut, setSplashFadingOut] = useState(false);

  function dismissSplash() {
    setSplashFadingOut(true);
    setTimeout(() => setSplashVisible(false), 300);
  }

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [panel, setPanel] = useState<SecondaryPanel>(null);

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/");
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);
    setSignupMessage(null);
    setSignupLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
    });

    setSignupLoading(false);

    if (error) {
      setSignupError(error.message);
      return;
    }

    if (!data.session) {
      setSignupMessage(
        `Un email de confirmation vient d'être envoyé à ${signupEmail}. Cliquez sur le lien qu'il contient, puis revenez vous connecter ici.`
      );
      return;
    }

    // Session active : l'écran de configuration de structure/boutique
    // s'affiche automatiquement (AppShell détecte l'absence de profil).
    router.push("/");
  }

  return (
    <>
      {splashVisible && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-300 ${
            splashFadingOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <SplashLogo onComplete={dismissSplash} />
        </div>
      )}

      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-sm flex-col items-center gap-1">
          <MargueriteLogo className="h-12 w-12" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Marguerite
          </span>
        </div>

        <div className="mt-8 flex w-full max-w-sm flex-col gap-1 text-center">
          <h1 className="text-2xl font-medium text-foreground">Bonjour</h1>
          <p className="text-sm text-muted-foreground">
            Connectez-vous pour retrouver votre espace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex w-full max-w-sm flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-10 w-full max-w-sm border-t border-border pt-6">
          <p className="text-sm font-medium text-foreground">Première connexion ?</p>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPanel(panel === "creer-profil" ? null : "creer-profil")}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                panel === "creer-profil"
                  ? "border-accent text-accent"
                  : "border-border text-foreground hover:bg-border/40"
              }`}
            >
              Créer une nouvelle entreprise
            </button>
            <button
              type="button"
              onClick={() => setPanel(panel === "decouvrir" ? null : "decouvrir")}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                panel === "decouvrir"
                  ? "border-accent text-accent"
                  : "border-border text-foreground hover:bg-border/40"
              }`}
            >
              Découvrir l&apos;application
            </button>
          </div>

          {panel === "creer-profil" && (
            <form onSubmit={handleSignup} className="mt-4 flex flex-col gap-3 rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">
                Créez votre compte, puis configurez votre structure et votre première boutique dans la foulée. Cette option sert uniquement à démarrer une toute nouvelle entreprise sur Marguerite.
              </p>
              <p className="text-sm text-muted-foreground">
                Vous rejoignez une équipe déjà présente sur Marguerite ? Utilisez plutôt le lien d&apos;invitation envoyé par votre manager.
              </p>

              <div className="flex flex-col gap-1">
                <label htmlFor="signup-email" className="text-sm text-muted-foreground">
                  Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="signup-password" className="text-sm text-muted-foreground">
                  Mot de passe
                </label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  minLength={6}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>

              {signupError && (
                <p className="text-sm text-red-600 dark:text-red-400">{signupError}</p>
              )}
              {signupMessage && (
                <p className="text-sm text-accent">{signupMessage}</p>
              )}

              <button
                type="submit"
                disabled={signupLoading}
                className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
              >
                {signupLoading ? "Création..." : "Créer mon entreprise"}
              </button>
            </form>
          )}

          {panel === "decouvrir" && (
            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border p-4">
              <p className="text-sm text-foreground">
                Marguerite gère le planning de votre équipe au quotidien : créneaux,
                congés, tâches, indicateurs, documents et bien plus, dans une
                application pensée pour les petites structures multi-boutiques.
              </p>
              <p className="text-sm text-muted-foreground">
                Créez votre profil pour l&apos;essayer avec vos propres données —
                un petit guide vous accueillera dès votre premier écran.
              </p>
            </div>
          )}
        </div>

        <Link
          href="/confidentialite"
          className="mt-8 text-xs text-faint-foreground underline underline-offset-2 hover:text-muted-foreground"
        >
          Confidentialité et sécurité
        </Link>
      </main>
    </>
  );
}
