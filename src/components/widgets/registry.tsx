import { WidgetDernieresAnnonces } from "@/components/widgets/WidgetDernieresAnnonces";
import {
  WidgetCaDuJour,
  WidgetCongesEnAttente,
  WidgetEcheancesProches,
  WidgetEquipePresente,
  WidgetNotesFraisEnAttente,
  WidgetProgressionOnboardingEquipe,
  WidgetProgressionTaches,
  WidgetTotalFacturesMois,
} from "@/components/widgets/ManagerWidgets";
import {
  WidgetMaProgressionObjectif,
  WidgetMesTaches,
  WidgetMonParcoursFormation,
  WidgetMonPlanningJour,
} from "@/components/widgets/SalarieWidgets";

export interface WidgetDef {
  key: string;
  label: string;
  component: React.ComponentType;
}

export const MANAGER_WIDGETS: WidgetDef[] = [
  { key: "ca_du_jour", label: "CA du jour", component: WidgetCaDuJour },
  { key: "equipe_presente", label: "Équipe présente aujourd'hui", component: WidgetEquipePresente },
  { key: "progression_taches", label: "Progression des tâches", component: WidgetProgressionTaches },
  { key: "conges_en_attente", label: "Demandes de congés en attente", component: WidgetCongesEnAttente },
  { key: "echeances_proches", label: "Échéances proches", component: WidgetEcheancesProches },
  { key: "dernieres_annonces", label: "Dernières annonces", component: WidgetDernieresAnnonces },
  { key: "notes_frais_en_attente", label: "Notes de frais en attente", component: WidgetNotesFraisEnAttente },
  { key: "total_factures_mois", label: "Total factures du mois", component: WidgetTotalFacturesMois },
  {
    key: "progression_onboarding_equipe",
    label: "Progression onboarding de l'équipe",
    component: WidgetProgressionOnboardingEquipe,
  },
];

export const SALARIE_WIDGETS: WidgetDef[] = [
  { key: "mon_planning_jour", label: "Mon planning du jour", component: WidgetMonPlanningJour },
  { key: "mes_taches", label: "Mes tâches", component: WidgetMesTaches },
  {
    key: "ma_progression_objectif",
    label: "Ma progression vers l'objectif d'équipe",
    component: WidgetMaProgressionObjectif,
  },
  { key: "dernieres_annonces", label: "Dernières annonces", component: WidgetDernieresAnnonces },
  { key: "mon_parcours_formation", label: "Mon parcours de formation", component: WidgetMonParcoursFormation },
];

export const DEFAULT_MANAGER_PINS = MANAGER_WIDGETS.map((w) => w.key);
export const DEFAULT_SALARIE_PINS = SALARIE_WIDGETS.map((w) => w.key);
