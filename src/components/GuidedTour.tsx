"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useUserProfile } from "@/components/AppShell";

const STORAGE_KEY = "marguerite-tour-seen-role";

interface StepDef {
  route: string;
  selector: string;
  title: string;
  description: string;
  openCategory?: string;
}

const STEP_ACCUEIL: StepDef = {
  route: "/",
  selector: '[data-tour="accueil-personnaliser"]',
  title: "Bienvenue sur Marguerite !",
  description:
    "Cet écran est personnalisable : vous pouvez choisir les widgets à afficher via « Personnaliser ».",
};

const STEP_MENU: StepDef = {
  route: "/",
  selector: '[data-tour="menu-category-quotidien"]',
  title: "Un menu organisé",
  description:
    "Le menu est organisé en trois catégories : Quotidien pour votre équipe au jour le jour, Pilotage pour vos chiffres, Équipe pour la gestion RH.",
};

const STEP_PLANNING_GENERER: StepDef = {
  route: "/planning",
  selector: '[data-tour="planning-generer"]',
  title: "Le planning assisté par IA",
  description:
    "Laissez l'IA construire le planning de la semaine à partir des contrats et disponibilités de votre équipe — vous gardez la main pour tout ajuster ensuite.",
};

const STEPS_BY_ROLE: Record<string, StepDef[]> = {
  salarie: [
    STEP_ACCUEIL,
    {
      route: "/planning",
      selector: '[data-tour="planning-semaine"]',
      title: "Votre planning",
      description:
        "Voici votre planning de la semaine. Vos créneaux apparaissent ici, jour par jour.",
    },
    {
      route: "/planning",
      selector: '[data-tour="menu-tab-/conges"]',
      title: "Vos congés",
      description:
        "Besoin de vous absenter ? Faites votre demande ici, votre manager la validera.",
      openCategory: "quotidien",
    },
  ],
  manager: [STEP_ACCUEIL, STEP_MENU, STEP_PLANNING_GENERER],
  gerant: [
    STEP_ACCUEIL,
    STEP_MENU,
    {
      route: "/planning",
      selector: '[data-tour="boutique-selector"]',
      title: "Vos boutiques",
      description:
        "En tant que gérant, choisissez une boutique ici pour voir et agir exactement comme son manager.",
    },
    STEP_PLANNING_GENERER,
    {
      route: "/indicateurs",
      selector: '[data-tour="indicateurs-comparatif"]',
      title: "Comparez vos boutiques",
      description:
        "Comparez les performances de toutes vos boutiques en un coup d'œil, avant de plonger dans le détail de l'une d'elles.",
    },
  ],
};

export function GuidedTour() {
  const profile = useUserProfile();
  const router = useRouter();
  const role = profile?.role;

  useEffect(() => {
    if (!role) return;
    if (typeof window === "undefined") return;

    const defs = STEPS_BY_ROLE[role];
    if (!defs || defs.length === 0) return;

    if (localStorage.getItem(STORAGE_KEY) === role) return;

    function markSeen() {
      localStorage.setItem(STORAGE_KEY, role!);
    }

    function finishTour(driverObj: ReturnType<typeof driver>) {
      markSeen();
      driverObj.destroy();
    }

    function goToStep(driverObj: ReturnType<typeof driver>, index: number) {
      const step = defs[index];
      if (!step) return;
      if (step.openCategory) {
        document
          .querySelector<HTMLButtonElement>(
            `[data-tour="menu-category-${step.openCategory}"]`
          )
          ?.click();
      }
      if (step.route !== window.location.pathname) {
        router.push(step.route);
      }
      if (driverObj.isActive()) {
        driverObj.moveTo(index);
      } else {
        driverObj.drive(index);
      }
    }

    const steps: DriveStep[] = defs.map((d) => ({
      element: d.selector,
      popover: { title: d.title, description: d.description },
    }));

    const driverObj = driver({
      showProgress: false,
      allowClose: true,
      overlayClickBehavior: () => finishTour(driverObj),
      showButtons: ["next", "close"],
      nextBtnText: "Suivant",
      doneBtnText: "Terminer",
      overlayOpacity: 0.6,
      stagePadding: 6,
      waitForElement: 5000,
      popoverClass: "marguerite-tour-popover",
      steps,
      onPopoverRender: (popoverDom) => {
        const btn = popoverDom.closeButton;
        btn.textContent = "Passer";
        btn.setAttribute("aria-label", "Passer le parcours guidé");
        btn.style.cssText =
          "all: unset; cursor: pointer; position: absolute; top: 14px; right: 14px; " +
          "width: auto; height: auto; padding: 3px 7px; font-size: 12px; font-weight: 500; " +
          "color: var(--muted-foreground); border-radius: 4px; transition: color .15s, background-color .15s;";
        btn.onmouseenter = () => {
          btn.style.color = "var(--foreground)";
          btn.style.backgroundColor = "var(--border)";
        };
        btn.onmouseleave = () => {
          btn.style.color = "var(--muted-foreground)";
          btn.style.backgroundColor = "transparent";
        };
      },
      onNextClick: (_element, _step, opts) => {
        const nextIndex = (opts.index ?? 0) + 1;
        if (nextIndex < defs.length) {
          goToStep(driverObj, nextIndex);
        } else {
          finishTour(driverObj);
        }
      },
      onCloseClick: () => finishTour(driverObj),
      onDoneClick: () => finishTour(driverObj),
    });

    goToStep(driverObj, 0);

    return () => {
      driverObj.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return null;
}
