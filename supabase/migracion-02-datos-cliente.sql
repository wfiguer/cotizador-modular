-- =============================================================
-- Migración 02 — Datos adicionales del cliente en Cotizaciones
-- Ejecutar en el SQL Editor de Supabase sobre la base ya creada.
-- (Para instalaciones nuevas basta con schema.sql, que ya incluye esto.)
-- =============================================================

alter table public.cotizaciones
  add column if not exists numero_documento text not null default '',
  add column if not exists direccion text not null default '',
  add column if not exists telefono text not null default '',
  add column if not exists ciudad text not null default '',
  add column if not exists version text not null default '';
