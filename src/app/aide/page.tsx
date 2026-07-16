"use client";

import { useUserProfile } from "@/components/AppShell";
import { IconChevronDown } from "@/components/icons/MenuIcons";

const CONTACT_EMAIL = "gregoirephelippeau@icloud.com";

type Role = "salarie" | "manager" | "gerant";

interface Section {
  titre: string;
  roles: Role[];
  contenu: React.ReactNode;
}

// Contenu volontairement statique et sobre : quelques concepts qui peuvent
// surprendre à la première prise en main, filtrés selon le rôle connecté
// (un salarié n'a pas besoin de lire comment gérer plusieurs boutiques).
const SECTIONS: Section[] = [
  {
    titre: "Les trois rôles : salarié, manager, gérant",
    roles: ["salarie", "manager", "gerant"],
    contenu: (
      <>
        <p>
          Chaque compte Marguerite a un rôle qui détermine ce qu&apos;il voit et
          ce qu&apos;il peut faire :
        </p>
        <p>
          <span className="font-medium text-foreground">Salarié</span>{" "}— consulte
          son propre planning et ses tâches du jour, demande des congés ou un
          entretien, dépose ses notes de frais et retrouve ses documents. Il ne
          voit que sa boutique et ses propres données.
        </p>
        <p>
          <span className="font-medium text-foreground">Manager</span>{" "}— pilote
          sa boutique : il construit le planning de l&apos;équipe, valide les
          congés et les notes de frais, saisit les ventes du jour, publie les
          annonces et suit les indicateurs. Il ne voit que sa boutique.
        </p>
        <p>
          <span className="font-medium text-foreground">Gérant</span>{" "}— vue
          transversale sur toutes les boutiques de la structure. Il peut agir
          partout avec les mêmes droits qu&apos;un manager, et dispose en plus de
          vues consolidées (comparatif des boutiques, congés et échéances toutes
          boutiques, demandes d&apos;entretien de toute la structure).
        </p>
      </>
    ),
  },
  {
    titre: "La génération automatique du planning",
    roles: ["manager", "gerant"],
    contenu: (
      <>
        <p>
          Sur l&apos;onglet Planning, le bouton{" "}
          <span className="font-medium text-foreground">
            « Générer le planning »
          </span>{" "}
          construit automatiquement la semaine à partir de deux choses : le
          profil de chaque salarié (heures hebdo au contrat, jours de repos
          fixes, disponibilités) et les besoins de couverture de la boutique
          (horaires d&apos;ouverture, effectif minimum à l&apos;ouverture, en
          journée et à la fermeture).
        </p>
        <p>
          Les règles légales de repos — 11 heures entre deux journées, 24 heures
          consécutives par semaine — sont respectées automatiquement : vous
          n&apos;avez pas à les vérifier vous-même.
        </p>
        <p>
          Le planning généré reste entièrement modifiable : chaque créneau peut
          être déplacé, modifié ou supprimé à la main, et vous pouvez aussi tout
          créer manuellement sans passer par la génération.
        </p>
      </>
    ),
  },
  {
    titre: "Comment mon planning est-il construit ?",
    roles: ["salarie"],
    contenu: (
      <>
        <p>
          Votre planning est préparé par votre manager, à la main ou avec une
          aide automatique qui tient compte de votre contrat (heures hebdo,
          jours de repos fixes, disponibilités renseignées dans votre profil).
        </p>
        <p>
          Dans tous les cas, les règles légales de repos — 11 heures entre deux
          journées, 24 heures consécutives par semaine — sont vérifiées
          automatiquement par l&apos;application.
        </p>
        <p>
          Si un créneau ne vous convient pas, parlez-en à votre manager ou
          envoyez-lui un message depuis l&apos;onglet Messagerie.
        </p>
      </>
    ),
  },
  {
    titre: "Le sélecteur de boutique",
    roles: ["gerant"],
    contenu: (
      <>
        <p>
          En tant que gérant, la plupart des onglets (Planning, Tâches,
          Documents, Notes de frais...) affichent un menu déroulant{" "}
          <span className="font-medium text-foreground">« Boutique »</span>{" "}en
          haut de page. Choisissez une boutique : vous voyez alors exactement ce
          que voit son manager, avec les mêmes possibilités d&apos;action.
        </p>
        <p>
          Certains onglets s&apos;ouvrent directement sur une vue consolidée
          toutes boutiques : Indicateurs (comparatif, cliquez sur une boutique
          pour son détail), Congés, Rappels et échéances, Factures fournisseurs
          et Entretiens.
        </p>
        <p>
          La liste des boutiques se gère depuis « Mes boutiques », accessible en
          haut de l&apos;onglet Planning.
        </p>
      </>
    ),
  },
  {
    titre: "Inviter un nouveau salarié",
    roles: ["manager", "gerant"],
    contenu: (
      <>
        <p>
          Ouvrez{" "}
          <span className="font-medium text-foreground">
            « Gérer l&apos;équipe »
          </span>{" "}
          (lien en haut de l&apos;onglet Planning) et ajoutez la personne avec
          son nom et son rôle. Elle apparaît immédiatement dans l&apos;équipe et
          dans le planning, même sans compte.
        </p>
        <p>
          Pour lui donner accès à l&apos;application, envoyez-lui son lien
          d&apos;invitation (bouton d&apos;envoi par email sur sa ligne). En
          ouvrant le lien, elle choisit son mot de passe et son compte est
          automatiquement rattaché à la bonne boutique, avec le bon rôle.
        </p>
        <p>
          Tant que l&apos;invitation n&apos;est pas utilisée, vous pouvez
          continuer à planifier la personne normalement.
        </p>
      </>
    ),
  },
];

export default function AidePage() {
  const profile = useUserProfile();

  if (!profile) return null;

  const role = profile.role as Role;
  const sections = SECTIONS.filter((s) => s.roles.includes(role));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-medium text-foreground">Aide</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les réponses aux questions les plus courantes sur Marguerite.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {sections.map((s) => (
          <details key={s.titre} className="group rounded-md border border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              {s.titre}
              <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
              {s.contenu}
            </div>
          </details>
        ))}
      </div>

      <div className="rounded-md bg-card p-4">
        <p className="text-sm text-foreground">
          Une question non couverte ici ?
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Écrivez-nous :{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-foreground underline underline-offset-2 hover:text-accent-foreground"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
