-- =============================================================
-- Migración 01 — Parámetros de desperdicio y tipo lineal
-- Ejecutar en el SQL Editor de Supabase sobre la base ya creada.
-- (Para instalaciones nuevas basta con schema.sql, que ya incluye esto.)
-- =============================================================

-- Parámetros por usuario (porcentajes de desperdicio)
create table if not exists public.parametros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  desperdicio_area numeric not null default 0 check (desperdicio_area >= 0),
  desperdicio_lineal numeric not null default 0 check (desperdicio_lineal >= 0),
  updated_at timestamptz not null default now()
);

alter table public.parametros enable row level security;

drop policy if exists "parametros_por_usuario" on public.parametros;
create policy "parametros_por_usuario" on public.parametros
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Porcentaje de desperdicio aplicado en cada renglón (congelado al guardar,
-- se actualiza únicamente con el botón "Recalcular")
alter table public.modulo_items
  add column if not exists desperdicio numeric not null default 0;

alter table public.cotizacion_items
  add column if not exists desperdicio numeric not null default 0;
