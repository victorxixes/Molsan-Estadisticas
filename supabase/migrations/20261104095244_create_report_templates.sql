create table if not exists public.estadisticas_plantillas_informes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  configuracion jsonb not null default '{}'::jsonb,
  activa boolean not null default true,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint estadisticas_plantillas_informes_nombre_check check (length(btrim(nombre)) > 0),
  constraint estadisticas_plantillas_informes_configuracion_check check (jsonb_typeof(configuracion) = 'object')
);
comment on table public.estadisticas_plantillas_informes is 'Plantillas configurables de informes estadísticos MOLSAN.';
alter table public.estadisticas_plantillas_informes enable row level security;
drop policy if exists acceso_unico_propietario on public.estadisticas_plantillas_informes;
create policy acceso_unico_propietario
  on public.estadisticas_plantillas_informes
  for all
  to authenticated
  using (estadisticas_private.es_usuario_unico())
  with check (estadisticas_private.es_usuario_unico());
grant select, insert, update, delete on public.estadisticas_plantillas_informes to authenticated;
