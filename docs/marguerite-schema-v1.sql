-- Marguerite — Schéma V1 (module Planning)
create extension if not exists "uuid-ossp";

create table structures (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  created_at timestamptz not null default now()
);

-- horaires : objet jsonb avec une clé par jour ("lun".."dim"), chacune
-- contenant une liste de créneaux { "debut": "HH:MM", "fin": "HH:MM" }.
-- Liste vide = fermé ce jour-là. Plusieurs créneaux = fermeture le midi.
-- Exemple : {"lun": [{"debut":"09:00","fin":"12:30"},{"debut":"14:00","fin":"19:00"}], "dim": []}
create table boutiques (
  id uuid primary key default uuid_generate_v4(),
  structure_id uuid not null references structures(id) on delete cascade,
  nom text not null,
  adresse text,
  horaires jsonb not null default '{"lun":[],"mar":[],"mer":[],"jeu":[],"ven":[],"sam":[],"dim":[]}',
  -- Effectif minimum requis : effectif_min_ouverture pour la première
  -- heure de chaque créneau d'ouverture, effectif_min_fermeture pour la
  -- dernière heure, effectif_min_journee pour le reste de la plage.
  effectif_min_ouverture integer not null default 1,
  effectif_min_fermeture integer not null default 1,
  effectif_min_journee integer not null default 1,
  created_at timestamptz not null default now()
);

create type role_utilisateur as enum ('gerant', 'manager', 'salarie');

create table utilisateurs (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid unique,
  structure_id uuid not null references structures(id) on delete cascade,
  boutique_id uuid references boutiques(id) on delete set null,
  nom text not null,
  email text unique not null,
  role role_utilisateur not null default 'salarie',
  couleur text not null default '#6B8F5E',
  created_at timestamptz not null default now()
);

create table profils_salarie (
  id uuid primary key default uuid_generate_v4(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  type_contrat text not null default 'cdi_temps_plein',
  heures_hebdo numeric(4,1) not null default 35,
  jours_repos_fixes jsonb not null default '[]',
  disponibilites jsonb not null default '[]',
  -- Solde de congés en jours, optionnel : si non renseigné, l'écran
  -- salarié n'affiche pas de solde restant.
  solde_conges_jours integer,
  updated_at timestamptz not null default now()
);

create type statut_planning as enum ('brouillon', 'genere_ia', 'publie');

create table plannings (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  semaine_debut date not null,
  statut statut_planning not null default 'brouillon',
  created_at timestamptz not null default now(),
  unique (boutique_id, semaine_debut)
);

create table creneaux (
  id uuid primary key default uuid_generate_v4(),
  planning_id uuid not null references plannings(id) on delete cascade,
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  jour date not null,
  heure_debut time not null,
  heure_fin time not null,
  created_at timestamptz not null default now()
);

create index idx_creneaux_planning on creneaux(planning_id);
create index idx_creneaux_utilisateur on creneaux(utilisateur_id);
create index idx_utilisateurs_structure on utilisateurs(structure_id);
create index idx_boutiques_structure on boutiques(structure_id);

create type statut_demande_conges as enum ('en_attente', 'validee', 'refusee');

create table demandes_conges (
  id uuid primary key default uuid_generate_v4(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  message text,
  statut statut_demande_conges not null default 'en_attente',
  created_at timestamptz not null default now()
);

create index idx_demandes_conges_utilisateur on demandes_conges(utilisateur_id);

create type categorie_tache as enum ('ouverture', 'journee', 'fermeture');
create type statut_tache as enum ('a_faire', 'faite', 'reportee');

create table taches (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  titre text not null,
  categorie categorie_tache not null,
  assigne_a uuid references utilisateurs(id) on delete set null,
  date date not null,
  statut statut_tache not null default 'a_faire',
  created_at timestamptz not null default now()
);

create index idx_taches_boutique_date on taches(boutique_id, date);
create index idx_taches_assigne_a on taches(assigne_a);

create table ventes_quotidiennes (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  date date not null,
  chiffre_affaires numeric(10,2) not null,
  frequentation integer not null,
  created_at timestamptz not null default now(),
  unique (boutique_id, date)
);

create index idx_ventes_quotidiennes_boutique_date on ventes_quotidiennes(boutique_id, date);

create type periode_objectif as enum ('semaine', 'mois', 'annee');

create table objectifs (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  periode periode_objectif not null,
  date_debut date not null,
  ca_cible numeric(10,2) not null,
  panier_moyen_cible numeric(10,2) not null,
  created_at timestamptz not null default now(),
  unique (boutique_id, periode, date_debut)
);

create index idx_objectifs_boutique on objectifs(boutique_id);

create type type_document as enum ('contrat', 'avenant', 'justificatif');

-- fichier_url stocke le chemin de l'objet dans le bucket de stockage
-- "documents" (bucket privé), pas une URL publique : le téléchargement se
-- fait via une URL signée générée à la demande.
create table documents (
  id uuid primary key default uuid_generate_v4(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  boutique_id uuid not null references boutiques(id) on delete cascade,
  nom text not null,
  type type_document not null,
  uploaded_by uuid references utilisateurs(id) on delete set null,
  fichier_url text not null,
  created_at timestamptz not null default now()
);

create index idx_documents_utilisateur on documents(utilisateur_id);
create index idx_documents_boutique on documents(boutique_id);

create type statut_note_frais as enum ('en_attente', 'validee', 'refusee', 'remboursee');

-- ticket_url stocke le chemin de l'objet dans le bucket "documents"
-- (réutilisé, même logique d'URL signée que pour les documents RH).
create table notes_frais (
  id uuid primary key default uuid_generate_v4(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  boutique_id uuid not null references boutiques(id) on delete cascade,
  montant numeric(10,2) not null,
  categorie text not null,
  descriptif text not null,
  ticket_url text not null,
  statut statut_note_frais not null default 'en_attente',
  created_at timestamptz not null default now()
);

create index idx_notes_frais_utilisateur on notes_frais(utilisateur_id);
create index idx_notes_frais_boutique_statut on notes_frais(boutique_id, statut);

create table fournisseurs (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  nom text not null,
  siren text,
  adresse text,
  contact_commercial text,
  created_at timestamptz not null default now()
);

create index idx_fournisseurs_boutique on fournisseurs(boutique_id);

-- fichier_url stocke le chemin de l'objet dans le bucket "documents"
-- (réutilisé, même logique d'URL signée que pour les autres onglets).
create table factures_fournisseurs (
  id uuid primary key default uuid_generate_v4(),
  fournisseur_id uuid not null references fournisseurs(id) on delete cascade,
  boutique_id uuid not null references boutiques(id) on delete cascade,
  descriptif text not null,
  montant_ht numeric(10,2) not null,
  taux_tva numeric(5,2) not null,
  categorie text not null,
  fichier_url text not null,
  date_facture date not null,
  created_at timestamptz not null default now()
);

create index idx_factures_fournisseurs_fournisseur on factures_fournisseurs(fournisseur_id);
create index idx_factures_fournisseurs_boutique_date on factures_fournisseurs(boutique_id, date_facture);

create type cible_annonce as enum ('tous', 'managers_uniquement');

create table annonces (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  auteur_id uuid not null references utilisateurs(id) on delete cascade,
  titre text not null,
  message text not null,
  cible_role cible_annonce not null default 'tous',
  created_at timestamptz not null default now()
);

create index idx_annonces_boutique on annonces(boutique_id);

create table annonces_lectures (
  id uuid primary key default uuid_generate_v4(),
  annonce_id uuid not null references annonces(id) on delete cascade,
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  lu_at timestamptz not null default now(),
  unique (annonce_id, utilisateur_id)
);

create index idx_annonces_lectures_annonce on annonces_lectures(annonce_id);
create index idx_annonces_lectures_utilisateur on annonces_lectures(utilisateur_id);

-- Row Level Security
-- V1 : une seule structure, pas encore de distinction de droits par rôle.
-- Tout utilisateur authentifié a un accès complet (lecture/écriture) sur
-- les tables du module Planning. À affiner quand les rôles (vendeur,
-- manager, gérant) et le multi-structure seront réellement utilisés.
alter table structures enable row level security;
alter table boutiques enable row level security;
alter table utilisateurs enable row level security;
alter table profils_salarie enable row level security;
alter table plannings enable row level security;
alter table creneaux enable row level security;
alter table demandes_conges enable row level security;
alter table taches enable row level security;
alter table ventes_quotidiennes enable row level security;
alter table objectifs enable row level security;
alter table documents enable row level security;
alter table notes_frais enable row level security;
alter table fournisseurs enable row level security;
alter table factures_fournisseurs enable row level security;
alter table annonces enable row level security;
alter table annonces_lectures enable row level security;

create policy "authenticated_full_access" on structures
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on boutiques
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on utilisateurs
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on profils_salarie
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on plannings
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on creneaux
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on demandes_conges
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on taches
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on ventes_quotidiennes
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on objectifs
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on documents
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on notes_frais
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on fournisseurs
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on factures_fournisseurs
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on annonces
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on annonces_lectures
  for all to authenticated using (true) with check (true);

-- Stockage : bucket privé dédié aux documents (contrats, avenants,
-- justificatifs). Le téléchargement passe par des URL signées générées
-- côté client, jamais par un accès public direct.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_authenticated_full_access" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');
