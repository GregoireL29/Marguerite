"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { BoutiqueSelector } from "@/components/BoutiqueSelector";

const CATEGORIES = ["Marchandises", "Fournitures", "Services", "Loyer", "Autre"];

interface Fournisseur {
  id: string;
  nom: string;
  siren: string | null;
  adresse: string | null;
  contact_commercial: string | null;
  telephone: string | null;
  email: string | null;
  note: string | null;
  boutique_id: string;
  boutiqueNom: string;
}

interface Facture {
  id: string;
  fournisseur_id: string;
  fournisseur_nom: string;
  descriptif: string;
  montant_ht: number;
  taux_tva: number;
  categorie: string;
  fichier_url: string;
  date_facture: string;
  boutiqueNom: string;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function montantTtc(facture: { montant_ht: number; taux_tva: number }): number {
  return facture.montant_ht * (1 + facture.taux_tva / 100);
}

function formatEuros(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function GerantFacturesFournisseurs() {
  const profile = useUserProfile();
  const [onglet, setOnglet] = useState<"deposer" | "consulter" | "annuaire">("deposer");
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulaire de dépôt
  const [depotBoutiqueId, setDepotBoutiqueId] = useState<string | null>(null);
  const [nouveauFournisseur, setNouveauFournisseur] = useState(false);
  const [fournisseurId, setFournisseurId] = useState("");
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauSiren, setNouveauSiren] = useState("");
  const [nouveauAdresse, setNouveauAdresse] = useState("");
  const [nouveauContact, setNouveauContact] = useState("");
  const [descriptif, setDescriptif] = useState("");
  const [montantHt, setMontantHt] = useState("");
  const [tauxTva, setTauxTva] = useState("20");
  const [categorie, setCategorie] = useState(CATEGORIES[0]);
  const [dateFacture, setDateFacture] = useState(toISODate(new Date()));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Consultation
  const [searchTerm, setSearchTerm] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Annuaire
  const [annuaireSearch, setAnnuaireSearch] = useState("");
  const [selectedGroupeKey, setSelectedGroupeKey] = useState<string | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editSiren, setEditSiren] = useState("");
  const [editAdresse, setEditAdresse] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editTelephone, setEditTelephone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNote, setEditNote] = useState("");
  const [savingFournisseur, setSavingFournisseur] = useState(false);
  const [fournisseurSaved, setFournisseurSaved] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    // Pas de filtre boutique_id : la RLS restreint déjà aux fournisseurs et
    // factures de toutes les boutiques de la structure.
    const [{ data: fournisseursData, error: fournisseursError }, { data: facturesData, error: facturesError }] =
      await Promise.all([
        supabase
          .from("fournisseurs")
          .select(
            "id, nom, siren, adresse, contact_commercial, telephone, email, note, boutique_id, boutiques(nom)"
          )
          .order("nom"),
        supabase
          .from("factures_fournisseurs")
          .select(
            "id, fournisseur_id, descriptif, montant_ht, taux_tva, categorie, fichier_url, date_facture, fournisseurs(nom), boutiques(nom)"
          )
          .order("date_facture", { ascending: false }),
      ]);

    if (fournisseursError) {
      setError(fournisseursError.message);
      setLoading(false);
      return;
    }
    if (facturesError) {
      setError(facturesError.message);
      setLoading(false);
      return;
    }

    const fournisseurRows = (fournisseursData ?? []) as unknown as {
      id: string;
      nom: string;
      siren: string | null;
      adresse: string | null;
      contact_commercial: string | null;
      telephone: string | null;
      email: string | null;
      note: string | null;
      boutique_id: string;
      boutiques: { nom: string } | { nom: string }[] | null;
    }[];

    setFournisseurs(
      fournisseurRows.map((r) => {
        const boutique = Array.isArray(r.boutiques) ? r.boutiques[0] : r.boutiques;
        return {
          id: r.id,
          nom: r.nom,
          siren: r.siren,
          adresse: r.adresse,
          contact_commercial: r.contact_commercial,
          telephone: r.telephone,
          email: r.email,
          note: r.note,
          boutique_id: r.boutique_id,
          boutiqueNom: boutique?.nom ?? "?",
        };
      })
    );

    const rows = (facturesData ?? []) as unknown as {
      id: string;
      fournisseur_id: string;
      descriptif: string;
      montant_ht: number;
      taux_tva: number;
      categorie: string;
      fichier_url: string;
      date_facture: string;
      fournisseurs: { nom: string } | { nom: string }[] | null;
      boutiques: { nom: string } | { nom: string }[] | null;
    }[];

    setFactures(
      rows.map((r) => {
        const fournisseur = Array.isArray(r.fournisseurs) ? r.fournisseurs[0] : r.fournisseurs;
        const boutique = Array.isArray(r.boutiques) ? r.boutiques[0] : r.boutiques;
        return {
          id: r.id,
          fournisseur_id: r.fournisseur_id,
          descriptif: r.descriptif,
          montant_ht: Number(r.montant_ht),
          taux_tva: Number(r.taux_tva),
          categorie: r.categorie,
          fichier_url: r.fichier_url,
          date_facture: r.date_facture,
          fournisseur_nom: fournisseur?.nom ?? "?",
          boutiqueNom: boutique?.nom ?? "?",
        };
      })
    );

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  // Fournisseurs de la boutique de dépôt sélectionnée uniquement : un
  // fournisseur est une fiche par boutique (voir groupement par nom
  // ci-dessous côté consultation), le formulaire de dépôt reste donc
  // scopé à une boutique précise comme côté manager.
  const fournisseursDepot = useMemo(
    () => fournisseurs.filter((f) => f.boutique_id === depotBoutiqueId),
    [fournisseurs, depotBoutiqueId]
  );

  useEffect(() => {
    if (!fournisseurId && fournisseursDepot.length > 0) {
      setFournisseurId(fournisseursDepot[0].id);
    }
  }, [fournisseursDepot, fournisseurId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !file || !depotBoutiqueId) return;
    if (nouveauFournisseur && !nouveauNom.trim()) return;
    if (!nouveauFournisseur && !fournisseurId) return;

    setSaving(true);
    setError(null);

    let resolvedFournisseurId = fournisseurId;

    if (nouveauFournisseur) {
      const { data: newFournisseur, error: insertFournisseurError } = await supabase
        .from("fournisseurs")
        .insert({
          boutique_id: depotBoutiqueId,
          nom: nouveauNom.trim(),
          siren: nouveauSiren.trim() || null,
          adresse: nouveauAdresse.trim() || null,
          contact_commercial: nouveauContact.trim() || null,
        })
        .select("id")
        .single();

      if (insertFournisseurError || !newFournisseur) {
        setError(insertFournisseurError?.message ?? "Erreur lors de la création du fournisseur.");
        setSaving(false);
        return;
      }
      resolvedFournisseurId = newFournisseur.id;
    }

    const path = `${depotBoutiqueId}/factures-fournisseurs/${resolvedFournisseurId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);

    if (uploadError) {
      setError(uploadError.message);
      setSaving(false);
      return;
    }

    const { error: insertFactureError } = await supabase.from("factures_fournisseurs").insert({
      fournisseur_id: resolvedFournisseurId,
      boutique_id: depotBoutiqueId,
      descriptif,
      montant_ht: Number(montantHt),
      taux_tva: Number(tauxTva),
      categorie,
      fichier_url: path,
      date_facture: dateFacture,
    });

    if (insertFactureError) {
      setError(insertFactureError.message);
      setSaving(false);
      return;
    }

    setNouveauFournisseur(false);
    setFournisseurId("");
    setNouveauNom("");
    setNouveauSiren("");
    setNouveauAdresse("");
    setNouveauContact("");
    setDescriptif("");
    setMontantHt("");
    setTauxTva("20");
    setCategorie(CATEGORIES[0]);
    setDateFacture(toISODate(new Date()));
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSaving(false);
    await load();
  }

  async function handleVoirFacture(fichierUrl: string, id: string) {
    setDownloadingId(id);
    const { data, error: signedUrlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(fichierUrl, 60);
    setDownloadingId(null);

    if (signedUrlError || !data) {
      setError(signedUrlError?.message ?? "Impossible de générer le lien de téléchargement.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  const totalMois = useMemo(() => {
    const now = new Date();
    const debutMois = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    const finMois = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const facturesDuMois = factures.filter(
      (f) => f.date_facture >= debutMois && f.date_facture <= finMois
    );
    const ht = facturesDuMois.reduce((s, f) => s + f.montant_ht, 0);
    const ttc = facturesDuMois.reduce((s, f) => s + montantTtc(f), 0);
    return { ht, ttc };
  }, [factures]);

  // Un même fournisseur réel est enregistré une fois par boutique (une
  // ligne fournisseurs par boutique_id) : on consolide donc par nom
  // normalisé plutôt que par fournisseur_id, sans quoi le total d'un
  // fournisseur livrant plusieurs boutiques serait fragmenté.
  const nomsFournisseursUniques = useMemo(() => {
    const vus = new Set<string>();
    const noms: string[] = [];
    for (const f of fournisseurs) {
      const key = f.nom.trim().toLowerCase();
      if (!vus.has(key)) {
        vus.add(key);
        noms.push(f.nom);
      }
    }
    return noms;
  }, [fournisseurs]);

  const pinnedGroup = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return null;
    const matches = fournisseurs.filter((f) => f.nom.trim().toLowerCase() === term);
    if (matches.length === 0) return null;
    const boutiquesNoms = Array.from(
      new Set(
        matches
          .map((f) => factures.find((fa) => fa.fournisseur_id === f.id)?.boutiqueNom)
          .filter((n): n is string => !!n)
      )
    );
    const reference = matches.find((f) => f.siren || f.adresse || f.contact_commercial) ?? matches[0];
    return {
      nom: reference.nom,
      siren: reference.siren,
      adresse: reference.adresse,
      contact: reference.contact_commercial,
      fournisseurIds: matches.map((f) => f.id),
      boutiquesNoms,
    };
  }, [fournisseurs, factures, searchTerm]);

  const filteredFactures = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return factures;
    return factures.filter((f) => f.fournisseur_nom.toLowerCase().includes(term));
  }, [factures, searchTerm]);

  const totalGroupe12Mois = useMemo(() => {
    if (!pinnedGroup) return null;
    const seuil = toISODate(new Date(Date.now() - 365 * 86400000));
    const recentes = factures.filter(
      (f) => pinnedGroup.fournisseurIds.includes(f.fournisseur_id) && f.date_facture >= seuil
    );
    if (recentes.length === 0) return null;
    return recentes.reduce((s, f) => s + montantTtc(f), 0);
  }, [factures, pinnedGroup]);

  // Annuaire : un groupe par nom normalisé (même logique que pinnedGroup
  // ci-dessus, mais calculé pour tous les fournisseurs d'un coup plutôt que
  // pour la seule recherche exacte de l'onglet Consulter). La fiche "de
  // référence" affichée est la première du groupe qui a au moins une
  // coordonnée renseignée, sinon la première du groupe.
  const fournisseurGroupes = useMemo(() => {
    const parKey = new Map<string, Fournisseur[]>();
    for (const f of fournisseurs) {
      const key = f.nom.trim().toLowerCase();
      const liste = parKey.get(key) ?? [];
      liste.push(f);
      parKey.set(key, liste);
    }
    return Array.from(parKey.entries()).map(([key, matches]) => {
      const reference =
        matches.find((f) => f.siren || f.adresse || f.contact_commercial || f.telephone || f.email || f.note) ??
        matches[0];
      const boutiquesNoms = Array.from(new Set(matches.map((f) => f.boutiqueNom)));
      return {
        key,
        nom: reference.nom,
        siren: reference.siren,
        adresse: reference.adresse,
        contact: reference.contact_commercial,
        telephone: reference.telephone,
        email: reference.email,
        note: reference.note,
        fournisseurIds: matches.map((f) => f.id),
        boutiquesNoms,
      };
    });
  }, [fournisseurs]);

  const filteredAnnuaireGroupes = useMemo(() => {
    const term = annuaireSearch.trim().toLowerCase();
    if (!term) return fournisseurGroupes;
    return fournisseurGroupes.filter((g) => g.nom.toLowerCase().includes(term));
  }, [fournisseurGroupes, annuaireSearch]);

  const selectedGroupe = useMemo(
    () => fournisseurGroupes.find((g) => g.key === selectedGroupeKey) ?? null,
    [fournisseurGroupes, selectedGroupeKey]
  );

  const facturesDuGroupeSelectionne = useMemo(() => {
    if (!selectedGroupe) return [];
    return factures.filter((f) => selectedGroupe.fournisseurIds.includes(f.fournisseur_id));
  }, [factures, selectedGroupe]);

  const totalFicheGroupe12Mois = useMemo(() => {
    if (!selectedGroupe) return null;
    const seuil = toISODate(new Date(Date.now() - 365 * 86400000));
    const recentes = facturesDuGroupeSelectionne.filter((f) => f.date_facture >= seuil);
    if (recentes.length === 0) return null;
    return recentes.reduce((s, f) => s + montantTtc(f), 0);
  }, [facturesDuGroupeSelectionne, selectedGroupe]);

  function openFiche(g: (typeof fournisseurGroupes)[number]) {
    setSelectedGroupeKey(g.key);
    setEditNom(g.nom);
    setEditSiren(g.siren ?? "");
    setEditAdresse(g.adresse ?? "");
    setEditContact(g.contact ?? "");
    setEditTelephone(g.telephone ?? "");
    setEditEmail(g.email ?? "");
    setEditNote(g.note ?? "");
    setFournisseurSaved(false);
  }

  // Édite toutes les fiches du groupe (une par boutique livrée) plutôt
  // qu'une seule : sans quoi corriger un numéro de téléphone depuis la vue
  // gérant ne mettrait à jour qu'une boutique sur les N qui commandent chez
  // ce fournisseur, et les autres resteraient silencieusement obsolètes.
  async function handleUpdateFournisseur(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGroupe || !editNom.trim()) return;

    setSavingFournisseur(true);
    setError(null);
    setFournisseurSaved(false);

    const { error: updateError } = await supabase
      .from("fournisseurs")
      .update({
        nom: editNom.trim(),
        siren: editSiren.trim() || null,
        adresse: editAdresse.trim() || null,
        contact_commercial: editContact.trim() || null,
        telephone: editTelephone.trim() || null,
        email: editEmail.trim() || null,
        note: editNote.trim() || null,
      })
      .in("id", selectedGroupe.fournisseurIds);

    setSavingFournisseur(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Le groupe est identifié par nom normalisé : si le nom vient de
    // changer, il faut suivre la fiche vers sa nouvelle clé plutôt que de
    // se retrouver silencieusement renvoyé à la liste après enregistrement.
    setSelectedGroupeKey(editNom.trim().toLowerCase());
    setFournisseurSaved(true);
    await load();
  }

  function exporterCsv() {
    const header = ["Date", "Boutique", "Fournisseur", "Montant HT", "TVA (%)", "Montant TTC", "Catégorie"];
    const rows = filteredFactures.map((f) => [
      f.date_facture,
      f.boutiqueNom,
      f.fournisseur_nom,
      f.montant_ht.toFixed(2),
      f.taux_tva.toFixed(2),
      montantTtc(f).toFixed(2),
      f.categorie,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factures-fournisseurs_${toISODate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-foreground">Factures fournisseurs</h1>

      <div className="flex gap-1">
        <button
          onClick={() => setOnglet("deposer")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            onglet === "deposer" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-border/40"
          }`}
        >
          Déposer
        </button>
        <button
          onClick={() => setOnglet("consulter")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            onglet === "consulter" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-border/40"
          }`}
        >
          Consulter
        </button>
        <button
          onClick={() => {
            setOnglet("annuaire");
            setSelectedGroupeKey(null);
          }}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            onglet === "annuaire" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-border/40"
          }`}
        >
          Annuaire
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {onglet === "deposer" ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-border p-4"
        >
          <p className="text-sm font-medium text-foreground">Nouvelle facture</p>

          <BoutiqueSelector
            value={depotBoutiqueId}
            onChange={(id) => {
              setDepotBoutiqueId(id);
              setFournisseurId("");
              setNouveauFournisseur(false);
            }}
          />

          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted-foreground">Fournisseur</label>
            {!nouveauFournisseur ? (
              <div className="flex items-center gap-2">
                <select
                  value={fournisseurId}
                  onChange={(e) => setFournisseurId(e.target.value)}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  {fournisseursDepot.length === 0 && <option value="">Aucun fournisseur</option>}
                  {fournisseursDepot.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nom}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNouveauFournisseur(true)}
                  className="shrink-0 text-sm text-muted-foreground hover:underline"
                >
                  + Nouveau
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nouveau fournisseur</span>
                  <button
                    type="button"
                    onClick={() => setNouveauFournisseur(false)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Annuler
                  </button>
                </div>
                <input
                  required
                  placeholder="Nom (obligatoire)"
                  value={nouveauNom}
                  onChange={(e) => setNouveauNom(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <input
                  placeholder="SIREN (optionnel)"
                  value={nouveauSiren}
                  onChange={(e) => setNouveauSiren(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <input
                  placeholder="Adresse (optionnel)"
                  value={nouveauAdresse}
                  onChange={(e) => setNouveauAdresse(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <input
                  placeholder="Contact commercial (optionnel)"
                  value={nouveauContact}
                  onChange={(e) => setNouveauContact(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="descriptif" className="text-sm text-muted-foreground">
              Descriptif
            </label>
            <textarea
              id="descriptif"
              required
              rows={2}
              value={descriptif}
              onChange={(e) => setDescriptif(e.target.value)}
              placeholder="ex. Livraison de marchandise du 05/07"
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="montant-ht" className="text-sm text-muted-foreground">
                Montant HT (€)
              </label>
              <input
                id="montant-ht"
                type="number"
                step="0.01"
                min="0"
                required
                value={montantHt}
                onChange={(e) => setMontantHt(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="taux-tva" className="text-sm text-muted-foreground">
                TVA (%)
              </label>
              <input
                id="taux-tva"
                type="number"
                step="0.1"
                min="0"
                required
                value={tauxTva}
                onChange={(e) => setTauxTva(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="categorie" className="text-sm text-muted-foreground">
                Catégorie
              </label>
              <select
                id="categorie"
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="date-facture" className="text-sm text-muted-foreground">
                Date de la facture
              </label>
              <input
                id="date-facture"
                type="date"
                required
                value={dateFacture}
                onChange={(e) => setDateFacture(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="facture-file" className="text-sm text-muted-foreground">
              Facture (photo ou PDF)
            </label>
            <input
              id="facture-file"
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-muted-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !file || !depotBoutiqueId}
            className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {saving ? "Envoi..." : "Déposer la facture"}
          </button>
        </form>
      ) : onglet === "consulter" ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm text-muted-foreground">Total du mois (toutes boutiques)</p>
              <p className="text-lg font-medium text-foreground">
                {formatEuros(totalMois.ttc)} € TTC
              </p>
              <p className="text-xs text-muted-foreground">{formatEuros(totalMois.ht)} € HT</p>
            </div>
            <button
              onClick={exporterCsv}
              disabled={filteredFactures.length === 0}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50"
            >
              Exporter en CSV
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="recherche-fournisseur" className="text-sm text-muted-foreground">
              Rechercher un fournisseur
            </label>
            <input
              id="recherche-fournisseur"
              list="fournisseurs-datalist"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nom du fournisseur..."
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <datalist id="fournisseurs-datalist">
              {nomsFournisseursUniques.map((nom) => (
                <option key={nom} value={nom} />
              ))}
            </datalist>
          </div>

          {pinnedGroup && (
            <div className="flex flex-col gap-1 rounded-lg border border-accent p-4">
              <p className="text-sm font-medium text-foreground">{pinnedGroup.nom}</p>
              <p className="text-xs text-muted-foreground">
                SIREN : {pinnedGroup.siren ?? "Non renseigné"}
              </p>
              <p className="text-xs text-muted-foreground">
                Adresse : {pinnedGroup.adresse ?? "Non renseignée"}
              </p>
              <p className="text-xs text-muted-foreground">
                Contact commercial : {pinnedGroup.contact ?? "Non renseigné"}
              </p>
              <p className="text-xs text-muted-foreground">
                Boutiques livrées :{" "}
                {pinnedGroup.boutiquesNoms.length > 0
                  ? pinnedGroup.boutiquesNoms.join(", ")
                  : "Aucune facture enregistrée"}
              </p>
              <p className="mt-1 text-sm text-foreground">
                {totalGroupe12Mois !== null
                  ? `Total facturé sur 12 mois (toutes boutiques) : ${formatEuros(totalGroupe12Mois)} € TTC`
                  : "Aucune facture sur les 12 derniers mois."}
              </p>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : filteredFactures.length === 0 ? (
            <p className="text-sm text-faint-foreground">Aucune facture pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {filteredFactures.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {f.fournisseur_nom} — {formatEuros(f.montant_ht)} € HT
                      <span className="ml-2 rounded-full bg-border/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {f.boutiqueNom}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.categorie} · {formatDate(f.date_facture)} · TVA {f.taux_tva}% ·{" "}
                      {formatEuros(montantTtc(f))} € TTC
                    </p>
                    <p className="text-sm text-muted-foreground">{f.descriptif}</p>
                  </div>
                  <button
                    onClick={() => handleVoirFacture(f.fichier_url, f.id)}
                    disabled={downloadingId === f.id}
                    className="shrink-0 text-sm text-muted-foreground hover:underline disabled:opacity-50"
                  >
                    Voir la facture
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : selectedGroupe ? (
        <div className="flex flex-col gap-6">
          <button
            onClick={() => setSelectedGroupeKey(null)}
            className="self-start text-sm text-muted-foreground hover:underline"
          >
            &larr; Annuaire
          </button>

          <form
            onSubmit={handleUpdateFournisseur}
            className="flex flex-col gap-4 rounded-lg border border-border p-4"
          >
            <p className="text-sm font-medium text-foreground">Coordonnées</p>
            <p className="text-xs text-muted-foreground">
              Boutiques livrées :{" "}
              {selectedGroupe.boutiquesNoms.length > 0 ? selectedGroupe.boutiquesNoms.join(", ") : "aucune"}
              {" — la modification s'applique à toutes les fiches de ce fournisseur."}
            </p>

            <div className="flex flex-col gap-1">
              <label htmlFor="edit-nom" className="text-sm text-muted-foreground">
                Nom
              </label>
              <input
                id="edit-nom"
                required
                value={editNom}
                onChange={(e) => setEditNom(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor="edit-siren" className="text-sm text-muted-foreground">
                  SIREN
                </label>
                <input
                  id="edit-siren"
                  value={editSiren}
                  onChange={(e) => setEditSiren(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor="edit-contact" className="text-sm text-muted-foreground">
                  Contact commercial
                </label>
                <input
                  id="edit-contact"
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="edit-adresse" className="text-sm text-muted-foreground">
                Adresse
              </label>
              <input
                id="edit-adresse"
                value={editAdresse}
                onChange={(e) => setEditAdresse(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor="edit-telephone" className="text-sm text-muted-foreground">
                  Téléphone
                </label>
                <input
                  id="edit-telephone"
                  type="tel"
                  value={editTelephone}
                  onChange={(e) => setEditTelephone(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor="edit-email" className="text-sm text-muted-foreground">
                  Email
                </label>
                <input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="edit-note" className="text-sm text-muted-foreground">
                Note (conditions de paiement, remarques...)
              </label>
              <textarea
                id="edit-note"
                rows={3}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingFournisseur}
                className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
              >
                {savingFournisseur ? "Enregistrement..." : "Enregistrer"}
              </button>
              {fournisseurSaved && (
                <p className="text-sm text-green-600 dark:text-green-400">Enregistré.</p>
              )}
            </div>
          </form>

          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Total facturé sur 12 mois (toutes boutiques)</p>
            <p className="text-lg font-medium text-foreground">
              {totalFicheGroupe12Mois !== null
                ? `${formatEuros(totalFicheGroupe12Mois)} € TTC`
                : "Aucune facture sur les 12 derniers mois."}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Historique des factures</p>
            {facturesDuGroupeSelectionne.length === 0 ? (
              <p className="text-sm text-faint-foreground">Aucune facture pour l&apos;instant.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {facturesDuGroupeSelectionne.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatEuros(f.montant_ht)} € HT
                        <span className="ml-2 rounded-full bg-border/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {f.boutiqueNom}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {f.categorie} · {formatDate(f.date_facture)} · TVA {f.taux_tva}% ·{" "}
                        {formatEuros(montantTtc(f))} € TTC
                      </p>
                      <p className="text-sm text-muted-foreground">{f.descriptif}</p>
                    </div>
                    <button
                      onClick={() => handleVoirFacture(f.fichier_url, f.id)}
                      disabled={downloadingId === f.id}
                      className="shrink-0 text-sm text-muted-foreground hover:underline disabled:opacity-50"
                    >
                      Voir la facture
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="recherche-annuaire" className="text-sm text-muted-foreground">
              Rechercher un fournisseur
            </label>
            <input
              id="recherche-annuaire"
              value={annuaireSearch}
              onChange={(e) => setAnnuaireSearch(e.target.value)}
              placeholder="Nom du fournisseur..."
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : filteredAnnuaireGroupes.length === 0 ? (
            <p className="text-sm text-faint-foreground">Aucun fournisseur pour l&apos;instant.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredAnnuaireGroupes.map((g) => (
                <button
                  key={g.key}
                  onClick={() => openFiche(g)}
                  className="flex flex-col gap-1 rounded-lg border border-border p-4 text-left hover:border-accent"
                >
                  <p className="text-sm font-medium text-foreground">{g.nom}</p>
                  {g.contact && <p className="text-xs text-muted-foreground">{g.contact}</p>}
                  <p className="text-xs text-muted-foreground">{g.telephone ?? "Téléphone non renseigné"}</p>
                  <p className="text-xs text-muted-foreground">{g.email ?? "Email non renseigné"}</p>
                  {g.boutiquesNoms.length > 1 && (
                    <p className="mt-1 text-[11px] text-faint-foreground">
                      {g.boutiquesNoms.length} boutiques : {g.boutiquesNoms.join(", ")}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
