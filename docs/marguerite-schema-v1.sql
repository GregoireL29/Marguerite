-- Marguerite — Schéma V1 (module Planning)
create extension if not exists "uuid-ossp";

create table structures (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  created_at timestamptz not null default now()
);

create table boutiques (
  id uuid primary key default uuid_generate_v4(),
  structure_id uuid not null references structures(id) on delete cascade,
  nom text not null,
  adresse text,
  jours_ouverture jsonb not null default '["lun","mar","mer","jeu","ven","sam"]',
  heure_ouverture time not null default '09:00',
  heure_fermeture time not null default '19:00',
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
