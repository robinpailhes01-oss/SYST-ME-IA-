-- 0007_subject_and_nullable_diagnostic.sql
-- Adds a custom subject column to consulting_messages and relaxes the
-- diagnostic_id NOT NULL constraint so manual cold-outreach messages
-- (not coming from the diagnoser pipeline) can be inserted.

alter table public.consulting_messages
    add column if not exists subject text;

alter table public.consulting_messages
    alter column diagnostic_id drop not null;
