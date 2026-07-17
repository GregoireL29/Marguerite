"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { SalarieIndicateurs } from "@/components/SalarieIndicateurs";
import { ManagerIndicateurs } from "@/components/ManagerIndicateurs";
import { GerantIndicateurs } from "@/components/GerantIndicateurs";
import { BoutiqueSelector } from "@/components/BoutiqueSelector";

// Un manager voit par défaut uniquement sa propre boutique (comportement
// historique). Si le gérant a activé le réglage structure
// indicateurs_autres_boutiques_actif, un sélecteur de boutique apparaît
// pour consulter en lecture seule les autres boutiques de la structure —
// même composant que celui déjà utilisé côté gérant.
function ManagerIndicateursPage() {
  const profile = useUserProfile();
  const [autresBoutiquesActif, setAutresBoutiquesActif] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedBoutiqueId, setSelectedBoutiqueId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("structures")
      .select("indicateurs_autres_boutiques_actif")
      .eq("id", profile.structure_id)
      .maybeSingle();
    setAutresBoutiquesActif(data?.indicateurs_autres_boutiques_actif ?? false);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (profile?.boutique_id && !selectedBoutiqueId) {
      setSelectedBoutiqueId(profile.boutique_id);
    }
  }, [profile, selectedBoutiqueId]);

  if (!profile) return null;

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </main>
    );
  }

  if (!autresBoutiquesActif) {
    return <ManagerIndicateurs />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-8">
      <BoutiqueSelector value={selectedBoutiqueId} onChange={setSelectedBoutiqueId} />
      {selectedBoutiqueId && (
        <div className="-mx-4">
          <ManagerIndicateurs boutiqueId={selectedBoutiqueId} />
        </div>
      )}
    </div>
  );
}

export default function IndicateursPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieIndicateurs />;
  }

  if (profile.role === "gerant") {
    return <GerantIndicateurs />;
  }

  return <ManagerIndicateursPage />;
}
