"use client";

import { AccueilGrid } from "@/components/AccueilGrid";
import { DEFAULT_MANAGER_PINS, MANAGER_WIDGETS } from "@/components/widgets/registry";

export function ManagerAccueil() {
  return <AccueilGrid availableWidgets={MANAGER_WIDGETS} defaultPins={DEFAULT_MANAGER_PINS} />;
}
