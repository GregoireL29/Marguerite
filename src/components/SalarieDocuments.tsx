"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

type TypeDocument = "contrat" | "avenant" | "justificatif";

const TYPE_LABEL: Record<TypeDocument, string> = {
  contrat: "Contrat",
  avenant: "Avenant",
  justificatif: "Justificatif",
};

interface DocumentRow {
  id: string;
  nom: string;
  type: TypeDocument;
  fichier_url: string;
  created_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SalarieDocuments() {
  const profile = useUserProfile();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [nom, setNom] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("documents")
      .select("id, nom, type, fichier_url, created_at")
      .eq("utilisateur_id", profile.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setDocuments((data ?? []) as DocumentRow[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDownload(doc: DocumentRow) {
    setDownloadingId(doc.id);
    const { data, error: signedUrlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.fichier_url, 60);
    setDownloadingId(null);

    if (signedUrlError || !data) {
      setError(signedUrlError?.message ?? "Impossible de générer le lien de téléchargement.");
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !file) return;

    setUploading(true);
    setError(null);

    const path = `${profile.boutique_id}/${profile.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("documents").insert({
      utilisateur_id: profile.id,
      boutique_id: profile.boutique_id,
      nom: nom.trim() || file.name,
      type: "justificatif",
      uploaded_by: profile.id,
      fichier_url: path,
    });

    if (insertError) {
      setError(insertError.message);
      setUploading(false);
      return;
    }

    setNom("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
    await load();
  }

  if (!profile) return null;

  const documentsEmployeur = documents.filter(
    (d) => d.type === "contrat" || d.type === "avenant"
  );
  const justificatifs = documents.filter((d) => d.type === "justificatif");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
      <h1 className="text-xl font-medium text-zinc-900">Documents</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
        Les fiches de paie ne sont pas encore disponibles ici. Continuez à les
        consulter sur votre espace habituel.
      </p>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-900">
          Documents fournis par l&apos;employeur
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : documentsEmployeur.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Aucun document pour l&apos;instant.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200">
            {documentsEmployeur.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    {TYPE_LABEL[d.type]}
                  </span>
                  <div>
                    <p className="text-sm text-zinc-900">{d.nom}</p>
                    <p className="text-xs text-zinc-500">{formatDate(d.created_at)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(d)}
                  disabled={downloadingId === d.id}
                  className="text-sm text-zinc-600 hover:underline disabled:opacity-50"
                >
                  Télécharger
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-zinc-900">Mes justificatifs</h2>

        <form
          onSubmit={handleUpload}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="justificatif-nom" className="text-sm text-zinc-600">
              Nom du justificatif
            </label>
            <input
              id="justificatif-nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="ex. Arrêt maladie"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="salarie-doc-file" className="text-sm text-zinc-600">
              Fichier
            </label>
            <input
              id="salarie-doc-file"
              ref={fileInputRef}
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-zinc-600"
            />
          </div>

          <button
            type="submit"
            disabled={uploading || !file}
            className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? "Envoi..." : "Ajouter un justificatif"}
          </button>
        </form>

        {loading ? null : justificatifs.length === 0 ? (
          <p className="text-sm text-zinc-400">Aucun justificatif pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200">
            {justificatifs.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-zinc-900">{d.nom}</p>
                  <p className="text-xs text-zinc-500">{formatDate(d.created_at)}</p>
                </div>
                <button
                  onClick={() => handleDownload(d)}
                  disabled={downloadingId === d.id}
                  className="text-sm text-zinc-600 hover:underline disabled:opacity-50"
                >
                  Télécharger
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
