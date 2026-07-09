-- =============================================================
-- Migración 04 — Congelar cotizaciones
-- Ejecutar en el SQL Editor de Supabase sobre la base ya creada.
-- (Para instalaciones nuevas basta con schema.sql, que ya incluye esto.)
-- =============================================================

-- Una cotización congelada ya no se puede volver a editar
alter table public.cotizaciones
  add column if not exists congelada boolean not null default false;
