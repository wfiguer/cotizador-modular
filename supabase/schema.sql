-- =============================================================
-- Cotizador Modular — Esquema de base de datos para Supabase
-- Ejecutar completo en el SQL Editor del proyecto de Supabase.
-- =============================================================

-- ---------- Tabla: articulos ----------
create table if not exists public.articulos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  cantidad numeric not null check (cantidad > 0),
  tipo_medida text not null,
  cantidad_x_medida numeric not null default 1,
  valor numeric not null check (valor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nombre único por usuario (respaldo de la validación del modal)
create unique index if not exists articulos_nombre_unico_por_usuario
  on public.articulos (user_id, lower(nombre));

-- Mantener updated_at al día
create or replace function public.actualizar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_articulos_updated_at on public.articulos;
create trigger trg_articulos_updated_at
  before update on public.articulos
  for each row execute function public.actualizar_updated_at();

-- ---------- Tabla: modulos ----------
create table if not exists public.modulos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  valor_final numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Tabla: modulo_items ----------
create table if not exists public.modulo_items (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references public.modulos (id) on delete cascade,
  tipo_item text not null check (tipo_item in ('articulo', 'modulo')),
  item_id uuid not null,
  cantidad numeric not null check (cantidad > 0),
  medida_lineal_1 numeric,
  medida_lineal_2 numeric,
  unidad_lineal text check (unidad_lineal in ('m', 'cm', 'mm')),
  desperdicio numeric not null default 0,
  valor_parcial numeric not null default 0
);

create index if not exists modulo_items_modulo_idx on public.modulo_items (modulo_id);
create index if not exists modulo_items_item_idx on public.modulo_items (tipo_item, item_id);

-- Validación en backend de referencias circulares entre módulos
create or replace function public.chequear_ciclo_modulo()
returns trigger language plpgsql as $$
declare
  hay_ciclo boolean;
begin
  if new.tipo_item = 'modulo' then
    if new.item_id = new.modulo_id then
      raise exception 'Referencia circular: un módulo no puede contenerse a sí mismo';
    end if;
    with recursive dependencias as (
      select mi.item_id
      from public.modulo_items mi
      where mi.modulo_id = new.item_id and mi.tipo_item = 'modulo'
      union
      select mi.item_id
      from public.modulo_items mi
      join dependencias d on mi.modulo_id = d.item_id
      where mi.tipo_item = 'modulo'
    )
    select exists (select 1 from dependencias where item_id = new.modulo_id)
      into hay_ciclo;
    if hay_ciclo then
      raise exception 'Referencia circular: el módulo seleccionado ya depende del módulo destino';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_modulo_items_ciclo on public.modulo_items;
create trigger trg_modulo_items_ciclo
  before insert or update on public.modulo_items
  for each row execute function public.chequear_ciclo_modulo();

-- ---------- Tabla: cotizaciones ----------
create table if not exists public.cotizaciones (
  id integer generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha_creacion date not null default current_date,
  fecha_actualizacion date not null default current_date,
  nombre_cliente text not null,
  numero_documento text not null default '',
  direccion text not null default '',
  telefono text not null default '',
  ciudad text not null default '',
  version text not null default '',
  valor_final numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Tabla: cotizacion_items ----------
create table if not exists public.cotizacion_items (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id integer not null references public.cotizaciones (id) on delete cascade,
  tipo_item text not null check (tipo_item in ('articulo', 'modulo')),
  item_id uuid not null,
  cantidad numeric not null check (cantidad > 0),
  medida_lineal_1 numeric,
  medida_lineal_2 numeric,
  unidad_lineal text check (unidad_lineal in ('m', 'cm', 'mm')),
  desperdicio numeric not null default 0,
  valor_parcial numeric not null default 0
);

create index if not exists cotizacion_items_cotizacion_idx on public.cotizacion_items (cotizacion_id);
create index if not exists cotizacion_items_item_idx on public.cotizacion_items (tipo_item, item_id);

-- Vista previa del próximo consecutivo de cotización (la secuencia es global
-- y nunca reutiliza números, incluso si se borra la última cotización).
create or replace function public.proximo_id_cotizacion()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  seq text;
  ultimo bigint;
  usado boolean;
begin
  seq := pg_get_serial_sequence('public.cotizaciones', 'id');
  execute format('select last_value, is_called from %s', seq) into ultimo, usado;
  if usado then
    return (ultimo + 1)::integer;
  else
    return ultimo::integer;
  end if;
end $$;

grant execute on function public.proximo_id_cotizacion() to authenticated;

-- ---------- Tabla: parametros ----------
-- Porcentajes de desperdicio por usuario (Configuración → Parámetros)
create table if not exists public.parametros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  desperdicio_area numeric not null default 0 check (desperdicio_area >= 0),
  desperdicio_lineal numeric not null default 0 check (desperdicio_lineal >= 0),
  updated_at timestamptz not null default now()
);

-- ---------- Políticas RLS ----------
alter table public.articulos enable row level security;
alter table public.modulos enable row level security;
alter table public.modulo_items enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.cotizacion_items enable row level security;
alter table public.parametros enable row level security;

drop policy if exists "parametros_por_usuario" on public.parametros;
create policy "parametros_por_usuario" on public.parametros
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "articulos_por_usuario" on public.articulos;
create policy "articulos_por_usuario" on public.articulos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "modulos_por_usuario" on public.modulos;
create policy "modulos_por_usuario" on public.modulos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "modulo_items_por_usuario" on public.modulo_items;
create policy "modulo_items_por_usuario" on public.modulo_items
  for all
  using (exists (
    select 1 from public.modulos m
    where m.id = modulo_id and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.modulos m
    where m.id = modulo_id and m.user_id = auth.uid()
  ));

drop policy if exists "cotizaciones_por_usuario" on public.cotizaciones;
create policy "cotizaciones_por_usuario" on public.cotizaciones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cotizacion_items_por_usuario" on public.cotizacion_items;
create policy "cotizacion_items_por_usuario" on public.cotizacion_items
  for all
  using (exists (
    select 1 from public.cotizaciones c
    where c.id = cotizacion_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.cotizaciones c
    where c.id = cotizacion_id and c.user_id = auth.uid()
  ));
