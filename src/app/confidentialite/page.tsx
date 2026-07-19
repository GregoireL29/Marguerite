import Link from "next/link";
import { MargueriteLogo } from "@/components/MargueriteLogo";

const CONTACT_EMAIL = "gregoirephelippeau@icloud.com";

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <MargueriteLogo className="h-10 w-10" />
        <h1 className="text-xl font-medium text-foreground">
          Confidentialité et sécurité
        </h1>
        <p className="text-sm text-muted-foreground">
          Comment les données de votre entreprise sont hébergées et protégées
          sur Marguerite.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <section className="rounded-md border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">Hébergement</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Les données sont hébergées chez Supabase, sur des serveurs situés à
            Paris (région <span className="text-foreground">eu-west-3</span>),
            en France. Elles ne quittent pas l&apos;Union européenne.
          </p>
        </section>

        <section className="rounded-md border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">
            Cloisonnement entre entreprises
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Marguerite héberge plusieurs entreprises clientes sur la même
            infrastructure, mais leurs données sont strictement cloisonnées.
            Un système technique (Row Level Security), appliqué directement au
            niveau de la base de données, vérifie à chaque lecture ou
            écriture que le compte connecté appartient bien à l&apos;entreprise
            concernée. Un compte d&apos;une entreprise ne peut ni lire ni
            modifier les données d&apos;une autre, quelle que soit la demande
            envoyée.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette protection a été testée concrètement, pas seulement conçue
            en théorie : depuis un compte réel d&apos;une entreprise, une
            tentative de lecture sans filtre de l&apos;ensemble des données de
            l&apos;application n&apos;a renvoyé aucune donnée appartenant à une
            autre entreprise.
          </p>
        </section>

        <section className="rounded-md border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">
            Ce qui n&apos;est jamais fait
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vos données ne sont ni vendues, ni partagées avec des tiers à des
            fins commerciales.
          </p>
        </section>

        <section className="rounded-md border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">Vos droits</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vous pouvez à tout moment demander l&apos;accès, la correction ou
            la suppression de vos données. Il suffit d&apos;en faire la
            demande à :{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-foreground underline underline-offset-2 hover:text-accent-foreground"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      <div className="rounded-md bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Marguerite est un produit en développement actif. Cette page sera
          formalisée avec un accompagnement juridique avant l&apos;ouverture à
          de nouveaux clients.
        </p>
      </div>

      <Link
        href="/login"
        className="self-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Retour à la connexion
      </Link>
    </main>
  );
}
