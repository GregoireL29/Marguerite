"use client";

import { AccueilGrid } from "@/components/AccueilGrid";
import { DEFAULT_GERANT_PINS, GERANT_WIDGETS } from "@/components/widgets/registry";

export function GerantAccueil() {
  return <AccueilGrid availableWidgets={GERANT_WIDGETS} defaultPins={DEFAULT_GERANT_PINS} />;
}
