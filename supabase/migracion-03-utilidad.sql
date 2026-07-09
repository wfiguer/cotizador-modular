-- =============================================================
-- Migración 03 — Porcentaje de Utilidad
-- Ejecutar en el SQL Editor de Supabase sobre la base ya creada.
-- (Para instalaciones nuevas basta con schema.sql, que ya incluye esto.)
-- =============================================================

-- % de utilidad configurable (Configuración → Parámetros)
alter table public.parametros
  add column if not exists utilidad numeric not null default 0 check (utilidad >= 0);

-- Snapshot del % de utilidad con el que se guardó cada cotización
-- (solo cambia al guardar o al presionar «Recalcular» en la cotización)
alter table public.cotizaciones
  add column if not exists utilidad numeric not null default 0;
