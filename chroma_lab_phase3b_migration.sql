-- CHROMA.LAB — Phase 3b delta
-- Adds support for manually-integrated peaks.
--
-- Run AFTER chroma_lab_phase3_migration.sql.

alter table public.peaks add column if not exists manual boolean default false;
