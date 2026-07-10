"use client";

import { AccueilGrid } from "@/components/AccueilGrid";
import { DEFAULT_SALARIE_PINS, SALARIE_WIDGETS } from "@/components/widgets/registry";

export function SalarieAccueil() {
  return <AccueilGrid availableWidgets={SALARIE_WIDGETS} defaultPins={DEFAULT_SALARIE_PINS} />;
}
