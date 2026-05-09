-- =====================================================================
-- Migration 0002 — Diagnoser V2 (autonomous business understanding)
-- À exécuter dans Supabase Studio → SQL Editor → New query → Run.
-- Idempotent : safe à rerun.
-- =====================================================================

-- 1. business_sector devient optionnel. Le Diagnoser V2 le déduit du site,
--    on ne demande plus à l'opérateur de le renseigner manuellement.
alter table public.consulting_leads
    alter column business_sector drop not null;

-- 2. Nouvelles colonnes sur consulting_diagnostics, pour stocker
--    la compréhension business produite par l'étape 1.
alter table public.consulting_diagnostics
    add column if not exists inferred_sector             text,
    add column if not exists inferred_subsector          text,
    add column if not exists what_they_sell              text,
    add column if not exists target_customer             text,
    add column if not exists how_they_sell               text,
    add column if not exists contact_channels            jsonb,
    add column if not exists team_size_estimate          text,
    add column if not exists price_range_visible         text,
    add column if not exists key_services_or_offers      jsonb,
    add column if not exists website_quality_score       numeric(3,2),
    add column if not exists understanding_confidence    numeric(3,2),
    add column if not exists understanding_notes         text,
    add column if not exists automation_potential_score  numeric(3,2),
    add column if not exists schema_accent_color         text default '#6366f1';

-- 3. Index utiles pour les requêtes de dashboard et de tri par qualité.
create index if not exists idx_consulting_diag_understand_conf
    on public.consulting_diagnostics (understanding_confidence desc);
create index if not exists idx_consulting_diag_inferred_sector
    on public.consulting_diagnostics (inferred_sector);
