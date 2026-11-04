alter table public.estadisticas_registros
  add column if not exists centro_encargo text,
  add column if not exists nombre_apoderado text,
  add column if not exists centro_firma text,
  add column if not exists entidad text,
  add column if not exists circuito_notarial text;

insert into public.estadisticas_campos_calculados
  (codigo,nombre,tipo_dato,descripcion,activo,orden)
values
  ('centro_encargo','Centro de encargo','texto','Centro al que se asigna o desde el que se encarga el expediente.',true,10),
  ('tipo_gestion','Tipo Gestión','texto','Clasificación del tipo de gestión.',true,20),
  ('nombre_apoderado','Nombre del apoderado','texto','Nombre normalizado del apoderado, derivado de las columnas originales.',true,30),
  ('centro_firma','Centro que firma','texto','Centro responsable de la firma del expediente.',true,40),
  ('entidad','Entidad','texto','Entidad clasificada mediante reglas de negocio.',true,50),
  ('circuito_notarial','Circuito notarial','texto','Circuito notarial asignado al expediente.',true,60),
  ('tipo_firma','Tipo de firma','texto','Modalidad de firma del expediente.',true,70)
on conflict (codigo) do update
set nombre=excluded.nombre,
    tipo_dato=excluded.tipo_dato,
    descripcion=excluded.descripcion,
    activo=true,
    orden=excluded.orden,
    actualizado_en=now();

update public.estadisticas_reglas_calculo r
set activa=false,vigente_hasta=now()
from public.estadisticas_campos_calculados c
where c.id=r.campo_id
  and c.codigo='tipo_entidad'
  and r.activa=true;

update public.estadisticas_campos_calculados
set activo=false,actualizado_en=now()
where codigo='tipo_entidad';

do $seed$
declare
  v_field_id uuid;
  v_version integer;
  v_definition jsonb;
begin
  select id into v_field_id
  from public.estadisticas_campos_calculados
  where codigo='entidad'
  limit 1;

  update public.estadisticas_reglas_calculo
  set activa=false,vigente_hasta=now()
  where campo_id=v_field_id and activa=true;

  select coalesce(max(version),0)+1 into v_version
  from public.estadisticas_reglas_calculo
  where campo_id=v_field_id;

  v_definition:=pg_catalog.jsonb_build_object(
    'schema',1,
    'logica','AND',
    'destino',pg_catalog.jsonb_build_object('tipo','registro','campo','entidad'),
    'prioridad',10,
    'condiciones',pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('campo','contrato','operador','in','valores',pg_catalog.jsonb_build_array('9272','9320','9620'),'resultado','Caixabank'),
      pg_catalog.jsonb_build_object('campo','apoderado','operador','in','valores',pg_catalog.jsonb_build_array('Colaboradores','Molsan'),'resultado','Caixabank')
    ),
    'por_defecto','Otra entidad'
  );

  insert into public.estadisticas_reglas_calculo(campo_id,version,prioridad,definicion,activa,motor,notas)
  values(v_field_id,v_version,10,v_definition,true,'expresion_v1',
    'Regla: contrato 9272, 9320 o 9620 Y apoderado Colaboradores o Molsan = Caixabank; resto = Otra entidad. Destino: Entidad.');
end;
$seed$;

create or replace function public.evaluar_regla_estadistica(p_record jsonb, p_definicion jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_condicion jsonb;
  v_operador text;
  v_campo text;
  v_raw text;
  v_valor text;
  v_esperado text;
  v_coincide boolean;
  v_todas boolean := true;
  v_alguna boolean := false;
  v_total integer := 0;
  v_resultado jsonb;
  v_default jsonb := coalesce(p_definicion->'por_defecto', 'null'::jsonb);
begin
  for v_condicion in
    select value from pg_catalog.jsonb_array_elements(coalesce(p_definicion->'condiciones','[]'::jsonb))
  loop
    v_total := v_total + 1;
    v_campo := v_condicion->>'campo';
    v_operador := coalesce(v_condicion->>'operador','equals');
    v_raw := coalesce(p_record->>v_campo,'');
    v_valor := pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(v_raw)),'áéíóúüñ','aeiouun');
    v_coincide := false;

    if v_operador = 'empty' then
      v_coincide := v_valor = '';
    elsif v_operador = 'not_empty' then
      v_coincide := v_valor <> '';
    elsif v_operador = 'in' then
      select exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(coalesce(v_condicion->'valores','[]'::jsonb)) x
        where v_valor = pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(x)),'áéíóúüñ','aeiouun')
      ) into v_coincide;
    elsif v_operador = 'equals' then
      v_esperado := coalesce(v_condicion->'valores'->>0,'');
      v_coincide := v_valor = pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(v_esperado)),'áéíóúüñ','aeiouun');
    elsif v_operador = 'not_equals' then
      v_esperado := coalesce(v_condicion->'valores'->>0,'');
      v_coincide := v_valor <> pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(v_esperado)),'áéíóúüñ','aeiouun');
    elsif v_operador = 'contains' then
      v_esperado := coalesce(v_condicion->'valores'->>0,'');
      v_coincide := v_esperado <> '' and v_valor like '%' || pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(v_esperado)),'áéíóúüñ','aeiouun') || '%';
    elsif v_operador = 'greater_than' then
      v_esperado := coalesce(v_condicion->'valores'->>0,'');
      v_coincide := v_raw ~ '^-?[0-9]+([.][0-9]+)?$'
        and v_esperado ~ '^-?[0-9]+([.][0-9]+)?$'
        and v_raw::numeric > v_esperado::numeric;
    elsif v_operador = 'less_than' then
      v_esperado := coalesce(v_condicion->'valores'->>0,'');
      v_coincide := v_raw ~ '^-?[0-9]+([.][0-9]+)?$'
        and v_esperado ~ '^-?[0-9]+([.][0-9]+)?$'
        and v_raw::numeric < v_esperado::numeric;
    end if;

    if v_coincide then
      v_alguna := true;
      if v_resultado is null then
        v_resultado := case when v_condicion->>'resultado' = '$origen' then pg_catalog.to_jsonb(v_raw) else v_condicion->'resultado' end;
      end if;
    else
      v_todas := false;
    end if;
  end loop;

  if v_total = 0 then return v_default; end if;
  if coalesce(p_definicion->>'logica','OR') = 'AND' then
    if v_todas then return coalesce(v_resultado,v_default); end if;
  elsif v_alguna then
    return coalesce(v_resultado,v_default);
  end if;
  return v_default;
end;
$function$;


create or replace function public.consolidar_importacion(p_importacion_id uuid)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_total integer;
  v_insertados integer;
  v_importados integer;
  v_rechazados integer;
  v_registro record;
  v_regla record;
  v_destino jsonb;
  v_destino_tipo text;
  v_destino_campo text;
  v_destino_key text;
  v_campo_destino_id uuid;
  v_valor jsonb;
  v_destinos_aplicados text[];
begin
  if auth.uid() is null
     or not coalesce(estadisticas_private.es_usuario_unico(), false) then
    raise exception 'Usuario no autorizado';
  end if;

  perform 1
  from public.estadisticas_importaciones
  where id = p_importacion_id
  for update;

  if not found then
    raise exception 'No existe la importación indicada';
  end if;

  select count(*) into v_total
  from public.estadisticas_filas_importacion
  where importacion_id = p_importacion_id
    and estado in ('pendiente','valida');

  select count(*) into v_rechazados
  from public.estadisticas_filas_importacion
  where importacion_id = p_importacion_id
    and estado = 'con_errores';

  if v_total = 0 then
    select count(*) into v_importados
    from public.estadisticas_filas_importacion
    where importacion_id = p_importacion_id and estado = 'importada';
    return jsonb_build_object('importadas',v_importados,'nuevas',0,'rechazadas',v_rechazados);
  end if;

  if v_rechazados > 0 then
    raise exception 'La importación contiene filas con errores; corrígelas antes de consolidar';
  end if;

  if exists (
    select 1
    from public.estadisticas_filas_importacion f
    where f.importacion_id = p_importacion_id
      and f.estado in ('pendiente','valida')
      and (
        nullif(btrim(f.datos_mapeados->>'expediente'),'') is null
        or nullif(btrim(f.datos_mapeados->>'oficina'),'') is null
        or nullif(btrim(f.datos_mapeados->>'fecha_alta'),'') is null
        or nullif(btrim(f.datos_mapeados->>'fecha_protocolo'),'') is null
        or nullif(btrim(f.datos_mapeados->>'envio_notario'),'') is null
        or (f.datos_mapeados->>'fecha_alta') !~ '^([0-3][0-9])-([0-1][0-9])-([0-9]{4})$'
        or (f.datos_mapeados->>'fecha_protocolo') !~ '^([0-3][0-9])-([0-1][0-9])-([0-9]{4})$'
        or (f.datos_mapeados->>'envio_notario') !~ '^([0-3][0-9])-([0-1][0-9])-([0-9]{4})$'
        or (f.datos_mapeados->>'dias_excel') !~ '^-?[0-9]+$'
      )
  ) then
    raise exception 'Hay filas incompletas o con formatos de fecha/días no válidos';
  end if;

  if exists (
    select 1
    from public.estadisticas_filas_importacion f
    where f.importacion_id = p_importacion_id
      and f.estado in ('pendiente','valida')
      and (
        to_char(to_date(f.datos_mapeados->>'fecha_alta','DD-MM-YYYY'),'DD-MM-YYYY') <> f.datos_mapeados->>'fecha_alta'
        or to_char(to_date(f.datos_mapeados->>'fecha_protocolo','DD-MM-YYYY'),'DD-MM-YYYY') <> f.datos_mapeados->>'fecha_protocolo'
        or to_char(to_date(f.datos_mapeados->>'envio_notario','DD-MM-YYYY'),'DD-MM-YYYY') <> f.datos_mapeados->>'envio_notario'
      )
  ) then
    raise exception 'Hay fechas de calendario no válidas';
  end if;

  insert into public.estadisticas_registros (
    importacion_id, numero_fila, expediente, oficina, fecha_alta, contrato,
    tipo_provision, notario, provincia, municipio, comunidad, protocolo,
    fecha_protocolo, vc, apoderado, envio_notario, dias_excel, datos_originales
  )
  select
    f.importacion_id,
    f.numero_fila,
    nullif(btrim(f.datos_mapeados->>'expediente'),''),
    nullif(btrim(f.datos_mapeados->>'oficina'),''),
    to_date(f.datos_mapeados->>'fecha_alta','DD-MM-YYYY'),
    nullif(btrim(f.datos_mapeados->>'contrato'),''),
    nullif(btrim(f.datos_mapeados->>'tipo_provision'),''),
    nullif(btrim(f.datos_mapeados->>'notario'),''),
    nullif(btrim(f.datos_mapeados->>'provincia'),''),
    nullif(btrim(f.datos_mapeados->>'municipio'),''),
    nullif(btrim(f.datos_mapeados->>'comunidad'),''),
    nullif(btrim(f.datos_mapeados->>'protocolo'),''),
    to_date(f.datos_mapeados->>'fecha_protocolo','DD-MM-YYYY'),
    nullif(btrim(f.datos_mapeados->>'vc'),''),
    nullif(btrim(f.datos_mapeados->>'apoderado'),''),
    to_date(f.datos_mapeados->>'envio_notario','DD-MM-YYYY'),
    (f.datos_mapeados->>'dias_excel')::integer,
    f.datos_originales
  from public.estadisticas_filas_importacion f
  where f.importacion_id = p_importacion_id
    and f.estado in ('pendiente','valida')
  on conflict (importacion_id, numero_fila) do nothing;

  get diagnostics v_insertados = row_count;

  update public.estadisticas_filas_importacion f
  set estado = 'importada',
      registro_id = r.id,
      importada_en = now()
  from public.estadisticas_registros r
  where f.importacion_id = p_importacion_id
    and r.importacion_id = f.importacion_id
    and r.numero_fila = f.numero_fila
    and f.estado in ('pendiente','valida');

  for v_registro in
    select r.id, f.datos_mapeados
    from public.estadisticas_filas_importacion f
    join public.estadisticas_registros r on r.id = f.registro_id
    where f.importacion_id = p_importacion_id
      and f.estado = 'importada'
    order by f.numero_fila
  loop
    v_destinos_aplicados := array[]::text[];

    for v_regla in
      select rr.id, rr.campo_id, rr.definicion, rr.prioridad
      from public.estadisticas_reglas_calculo rr
      join public.estadisticas_campos_calculados cf on cf.id = rr.campo_id
      where rr.activa = true and cf.activo = true
      order by rr.prioridad asc, rr.creado_en asc, rr.id asc
    loop
      v_destino := coalesce(v_regla.definicion->'destino',
        pg_catalog.jsonb_build_object('tipo','calculado','campo_id',v_regla.campo_id::text));
      v_destino_tipo := coalesce(v_destino->>'tipo','calculado');
      v_destino_campo := coalesce(v_destino->>'campo',v_destino->>'campo_id','');
      v_destino_key := v_destino_tipo || ':' || v_destino_campo;

      if v_destino_key = any(v_destinos_aplicados) then
        continue;
      end if;

      v_valor := public.evaluar_regla_estadistica(v_registro.datos_mapeados,v_regla.definicion);
      if v_valor is null or v_valor = 'null'::jsonb then
        continue;
      end if;

      if v_destino_tipo = 'registro' then
        if v_destino_campo not in ('centro_encargo','tipo_gestion','nombre_apoderado','centro_firma','entidad','circuito_notarial','tipo_firma','tipo_entidad','centro','circuito','oficina_origen') then
          raise exception 'Destino de expediente no permitido: %', v_destino_campo;
        end if;
        execute pg_catalog.format('update public.estadisticas_registros set %I = $1 where id = $2',v_destino_campo)
          using v_valor #>> '{}', v_registro.id;
        select id into v_campo_destino_id
        from public.estadisticas_campos_calculados
        where codigo = v_destino_campo
        limit 1;
        v_campo_destino_id := coalesce(v_campo_destino_id,v_regla.campo_id);
      elsif v_destino_tipo = 'calculado' then
        v_campo_destino_id := nullif(v_destino->>'campo_id','')::uuid;
        if v_campo_destino_id is null or not exists (
          select 1 from public.estadisticas_campos_calculados
          where id = v_campo_destino_id and activo = true
        ) then
          raise exception 'El campo calculado de destino no existe o está inactivo';
        end if;
      else
        raise exception 'Tipo de destino no válido: %', v_destino_tipo;
      end if;

      insert into public.estadisticas_valores_calculados(registro_id,campo_id,regla_id,valor)
      values(v_registro.id,v_campo_destino_id,v_regla.id,v_valor)
      on conflict (registro_id,campo_id,regla_id)
      do update set valor = excluded.valor, calculado_en = now();

      v_destinos_aplicados := array_append(v_destinos_aplicados,v_destino_key);
    end loop;
  end loop;

  select count(*) into v_importados
  from public.estadisticas_filas_importacion
  where importacion_id = p_importacion_id and estado = 'importada';

  update public.estadisticas_importaciones
  set estado = case when v_rechazados > 0 then 'importada_con_errores' else 'importada' end,
      filas_importadas = v_importados,
      filas_rechazadas = v_rechazados,
      finalizada_en = now()
  where id = p_importacion_id;

  return jsonb_build_object(
    'importadas',v_importados,
    'nuevas',v_insertados,
    'rechazadas',v_rechazados
  );
end;
$function$;

