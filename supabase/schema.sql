-- =====================================================================
-- AI Consulting Pipeline — Supabase schema
-- Préfixe `consulting_` pour ne pas interférer avec le projet Harmonie Yacht.
-- À exécuter dans : Supabase Studio → SQL Editor → New query.
-- Idempotent : safe à rerun.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- emails / urls case-insensitive

-- ---------------------------------------------------------------------
-- ENUMs
-- ---------------------------------------------------------------------
do $$ begin
    create type consulting_lead_status as enum (
        'new',           -- créé, pas encore traité
        'diagnosing',    -- Diagnoser en cours
        'diagnosed',     -- diagnostic prêt
        'schema_ready',  -- schéma généré
        'message_ready', -- message rédigé, en attente de validation humaine
        'sent',          -- message envoyé
        'replied',       -- prospect a répondu
        'won',           -- contrat signé
        'lost',          -- pas intéressé
        'quarantine'     -- erreur ou doute → review manuelle
    );
exception when duplicate_object then null; end $$;

do $$ begin
    create type consulting_channel as enum ('email', 'instagram', 'linkedin', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
    create type consulting_log_severity as enum ('info', 'warn', 'error', 'critical');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Table: consulting_leads
-- Le prospect — identité + état courant. Une ligne = une entreprise.
-- ---------------------------------------------------------------------
create table if not exists public.consulting_leads (
    id              uuid primary key default gen_random_uuid(),
    business_name   text not null,
    business_url    citext not null,
    business_sector text not null,
    instagram_handle text,
    contact_email   citext,
    contact_name    text,
    source          text,                                  -- "manual", "apollo", "linkedin", etc.
    status          consulting_lead_status not null default 'new',
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    last_contact_at timestamptz,                           -- dernier envoi vers ce lead, tous canaux
    constraint consulting_leads_url_unique unique (business_url)
);

create index if not exists idx_consulting_leads_status   on public.consulting_leads (status);
create index if not exists idx_consulting_leads_sector   on public.consulting_leads (business_sector);
create index if not exists idx_consulting_leads_created  on public.consulting_leads (created_at desc);

-- ---------------------------------------------------------------------
-- Table: consulting_diagnostics
-- Output du Diagnoser. 1..n par lead (re-diagnostic possible plus tard).
-- ---------------------------------------------------------------------
create table if not exists public.consulting_diagnostics (
    id                       uuid primary key default gen_random_uuid(),
    lead_id                  uuid not null references public.consulting_leads(id) on delete cascade,
    agent_version            text not null default 'diagnoser-v1',
    raw_html_snippet         text,                         -- les ~5k 1ers chars du scrape, pour audit
    raw_response             jsonb,                        -- réponse brute Claude, telle quelle
    -- Champs structurés (extraits de raw_response.tasks pour requêtes rapides)
    total_hours_lost_weekly  numeric(6,2),
    total_cost_annual        numeric(10,2),
    pitch_hook               text,
    confidence               numeric(3,2),                 -- 0..1, score de confiance auto-évalué
    is_approved              boolean,                      -- null = non revu, true/false = revu
    approved_at              timestamptz,
    created_at               timestamptz not null default now()
);

create index if not exists idx_consulting_diag_lead   on public.consulting_diagnostics (lead_id);
create index if not exists idx_consulting_diag_created on public.consulting_diagnostics (created_at desc);

-- ---------------------------------------------------------------------
-- Table: consulting_schemas
-- Schéma visuel HTML/PDF généré pour un diagnostic donné.
-- ---------------------------------------------------------------------
create table if not exists public.consulting_schemas (
    id              uuid primary key default gen_random_uuid(),
    lead_id         uuid not null references public.consulting_leads(id) on delete cascade,
    diagnostic_id   uuid not null references public.consulting_diagnostics(id) on delete cascade,
    agent_version   text not null default 'schema-builder-v1',
    html_content    text not null,                         -- HTML auto-contenu, prêt à servir
    public_url      text,                                  -- URL si uploadé dans Supabase Storage
    pdf_url         text,                                  -- (futur) version PDF
    is_approved     boolean,
    created_at      timestamptz not null default now()
);

create index if not exists idx_consulting_schemas_lead on public.consulting_schemas (lead_id);

-- ---------------------------------------------------------------------
-- Table: consulting_messages
-- Drafts de messages d'outreach. 1 ligne = 1 message + 1 canal.
-- Si on génère email + DM, on a 2 lignes.
-- ---------------------------------------------------------------------
create table if not exists public.consulting_messages (
    id              uuid primary key default gen_random_uuid(),
    lead_id         uuid not null references public.consulting_leads(id) on delete cascade,
    diagnostic_id   uuid not null references public.consulting_diagnostics(id) on delete cascade,
    schema_id       uuid references public.consulting_schemas(id) on delete set null,
    channel         consulting_channel not null,
    body            text not null,
    word_count      int generated always as (array_length(regexp_split_to_array(body, '\s+'), 1)) stored,
    checker_passed  boolean,                               -- résultat global du Checker
    checker_report  jsonb,                                 -- détail par règle
    is_approved     boolean,                               -- humain a validé l'envoi
    sent_at         timestamptz,
    reply_at        timestamptz,
    agent_version   text not null default 'pitcher-v1',
    created_at      timestamptz not null default now(),
    -- Anti-doublon : on ne renvoie pas 2 messages au même lead sur le même canal
    -- non encore envoyés. La contrainte unique partielle empêche les drafts redondants.
    constraint consulting_messages_no_dup_draft
        unique (lead_id, channel, agent_version)
);

create index if not exists idx_consulting_messages_lead    on public.consulting_messages (lead_id);
create index if not exists idx_consulting_messages_pending on public.consulting_messages (is_approved, sent_at)
    where sent_at is null;

-- ---------------------------------------------------------------------
-- Table: consulting_pipeline_logs
-- Audit trail. Chaque étape du pipeline écrit une ligne.
-- Immuable : pas d'UPDATE, on append seulement.
-- ---------------------------------------------------------------------
create table if not exists public.consulting_pipeline_logs (
    id            uuid primary key default gen_random_uuid(),
    lead_id       uuid references public.consulting_leads(id) on delete set null,
    agent         text not null,                           -- "diagnoser", "schema_builder", etc.
    step          text not null,                           -- "scrape", "claude_call", "supabase_insert", etc.
    severity      consulting_log_severity not null default 'info',
    message       text,
    payload       jsonb,                                   -- données contextuelles (durée, tokens, etc.)
    created_at    timestamptz not null default now()
);

create index if not exists idx_consulting_logs_lead      on public.consulting_pipeline_logs (lead_id);
create index if not exists idx_consulting_logs_severity  on public.consulting_pipeline_logs (severity, created_at desc);
create index if not exists idx_consulting_logs_agent     on public.consulting_pipeline_logs (agent, created_at desc);

-- ---------------------------------------------------------------------
-- Trigger : updated_at automatique sur consulting_leads
-- ---------------------------------------------------------------------
create or replace function public.consulting_set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_consulting_leads_updated on public.consulting_leads;
create trigger trg_consulting_leads_updated
    before update on public.consulting_leads
    for each row execute function public.consulting_set_updated_at();

-- ---------------------------------------------------------------------
-- Vue : pipeline_dashboard
-- Vue dénormalisée pour le dashboard mobile. Lecture seule.
-- ---------------------------------------------------------------------
create or replace view public.consulting_dashboard as
select
    l.id                          as lead_id,
    l.business_name,
    l.business_sector,
    l.business_url,
    l.status,
    l.created_at                  as lead_created_at,
    l.last_contact_at,
    d.id                          as latest_diagnostic_id,
    d.total_hours_lost_weekly,
    d.total_cost_annual,
    d.confidence                  as diag_confidence,
    s.id                          as latest_schema_id,
    s.public_url                  as schema_url,
    (
        select count(*) from public.consulting_messages m
        where m.lead_id = l.id and m.is_approved is true and m.sent_at is not null
    ) as messages_sent_count,
    (
        select count(*) from public.consulting_messages m
        where m.lead_id = l.id and m.is_approved is null
    ) as messages_pending_review
from public.consulting_leads l
left join lateral (
    select * from public.consulting_diagnostics
    where lead_id = l.id order by created_at desc limit 1
) d on true
left join lateral (
    select * from public.consulting_schemas
    where lead_id = l.id order by created_at desc limit 1
) s on true;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
-- Modèle : un seul user (toi) en service_role + auth pour le futur dashboard.
-- Pour l'instant : tout est verrouillé, seule la service_key écrit/lit.
-- Quand tu ouvriras le dashboard, ajoute une policy pour `auth.uid() = owner_id`.

alter table public.consulting_leads             enable row level security;
alter table public.consulting_diagnostics       enable row level security;
alter table public.consulting_schemas           enable row level security;
alter table public.consulting_messages          enable row level security;
alter table public.consulting_pipeline_logs     enable row level security;

-- service_role bypass RLS par défaut, donc les workflows n8n (qui utilisent
-- SUPABASE_SERVICE_KEY) fonctionnent sans policy explicite.
-- On crée des policies "deny all" implicites en n'ajoutant aucune policy
-- pour les rôles authenticated/anon.

-- Quand le dashboard sera prêt, décommenter et adapter :
-- create policy "authenticated_read_leads" on public.consulting_leads
--     for select to authenticated using (true);
-- create policy "authenticated_read_diagnostics" on public.consulting_diagnostics
--     for select to authenticated using (true);
-- create policy "authenticated_update_message_approval" on public.consulting_messages
--     for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- Storage : bucket public pour les schémas HTML
-- ---------------------------------------------------------------------
-- À créer manuellement dans Supabase Studio → Storage :
--   Name: consulting-schemas
--   Public: yes
--   File size limit: 5 MB
--   Allowed MIME types: text/html, application/pdf, image/png
-- Puis dans le SQL editor, policy de lecture publique :
--
-- insert into storage.buckets (id, name, public)
-- values ('consulting-schemas', 'consulting-schemas', true)
-- on conflict (id) do nothing;
