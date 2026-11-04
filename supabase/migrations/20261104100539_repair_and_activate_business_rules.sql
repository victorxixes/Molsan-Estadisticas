-- Repairs the rule evaluator and activates the seven agreed business-rule destinations.
CREATE OR REPLACE FUNCTION public.evaluar_regla_estadistica(p_record jsonb, p_definicion jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
  v_lookup_result text;
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
    v_lookup_result := null;

    if v_operador = 'empty' then
      v_coincide := v_valor = '';
    elsif v_operador = 'not_empty' then
      v_coincide := v_valor <> '';
    elsif v_operador = 'in' then
      select exists (
        select 1 from pg_catalog.jsonb_array_elements_text(coalesce(v_condicion->'valores','[]'::jsonb)) x
        where v_valor = pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(x)),'áéíóúüñ','aeiouun')
      ) into v_coincide;
    elsif v_operador = 'starts_with' then
      select exists (
        select 1 from pg_catalog.jsonb_array_elements_text(coalesce(v_condicion->'valores','[]'::jsonb)) x
        where v_valor like pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(x)),'áéíóúüñ','aeiouun') || '%'
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
    elsif v_operador = 'lookup_notary_circuit' then
      select case
        when pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(n.provincia)),'áéíóúüñ','aeiouun')
             in ('las palmas de gran canaria','santa cruz de tenerife') then 'Canarias'
        else 'Península'
      end
      into v_lookup_result
      from public.ctn_notarios n
      where pg_catalog.translate(pg_catalog.lower(pg_catalog.btrim(pg_catalog.concat_ws(' ',n.nombre,n.apellidos))),'áéíóúüñ','aeiouun') = v_valor
      order by n.id
      limit 1;
      v_coincide := v_lookup_result is not null;
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
        if v_operador = 'lookup_notary_circuit' then
          v_resultado := pg_catalog.to_jsonb(v_lookup_result);
        elsif v_condicion->>'resultado' = '$origen' then
          v_resultado := pg_catalog.to_jsonb(v_raw);
        elsif v_condicion->>'resultado' = '$lookup_circuito_notarial' then
          v_resultado := pg_catalog.to_jsonb(v_lookup_result);
        else
          v_resultado := v_condicion->'resultado';
        end if;
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
$function$


revoke all on function public.evaluar_regla_estadistica(jsonb,jsonb) from public;
grant execute on function public.evaluar_regla_estadistica(jsonb,jsonb) to authenticated;

update public.estadisticas_reglas_calculo r
set activa=false, vigente_hasta=coalesce(r.vigente_hasta,now())
from public.estadisticas_campos_calculados c
where c.id=r.campo_id
  and c.codigo in ('centro_encargo','tipo_gestion','nombre_apoderado','centro_firma','entidad','circuito_notarial','tipo_firma')
  and r.vigente_hasta is null;

with definitions(codigo,prioridad,definicion,notas) as (
 values
 ('centro_encargo',10,'{"logica":"OR","schema":1,"destino":{"tipo":"registro","campo":"centro_encargo"},"prioridad":100,"condiciones":[{"campo":"oficina","valores":["5316"],"operador":"equals","resultado":"Cancela"},{"campo":"oficina","valores":["5316"],"operador":"not_equals","resultado":"Oficina"}],"por_defecto":"Pendiente de clasificar"}'::jsonb,'Regla recuperada y normalizada: oficina 5316 = Cancela; cualquier otra oficina informada = Oficina.'),
('centro_firma',40,'{"logica":"OR","schema":1,"destino":{"tipo":"registro","campo":"centro_firma"},"prioridad":100,"condiciones":[{"campo":"apoderado","valores":["Yolanda Vives Solsona","Pedro Pérez Sola","ALBERTO LOPEZ RODRIGUEZ","GASTON BEGUIRISTAIN AMORIN","Carlos Barbera García","Ferran Badia Caralps","Ana Cartagena Puerta","Víctor Tomás Castellsagué"],"operador":"in","resultado":"Molsan"},{"campo":"apoderado","valores":["GESTCANARIAS","GESGALICIA","YARZA GESTION","JULIO CUESTA","CASTILLO 11","GESTORIA MAS"],"operador":"in","resultado":"Colaboradores"},{"campo":"apoderado","valores":["Oficina Otra entidad"],"operador":"equals","resultado":"Oficina OE"},{"campo":"apoderado","valores":["Oficina CaixaBank"],"operador":"equals","resultado":"Oficina CBK"}],"por_defecto":"Pendiente de clasificar"}'::jsonb,'Regla recuperada del catálogo de apoderados: Molsan, Colaboradores, Oficina OE y Oficina CBK.'),
('circuito_notarial',50,'{"logica":"OR","schema":1,"destino":{"tipo":"registro","campo":"circuito_notarial"},"prioridad":100,"condiciones":[{"campo":"notario","valores":[],"operador":"lookup_notary_circuit","resultado":"$lookup_circuito_notarial"}],"por_defecto":"Pendiente de clasificar"}'::jsonb,'Clasificación dinámica consultando el catálogo CTN de notarios: provincias Las Palmas y Santa Cruz de Tenerife = Canarias; resto de notarios catalogados = Península; notario no encontrado = Pendiente de clasificar.'),
('entidad',10,'{"logica":"AND","schema":1,"destino":{"tipo":"registro","campo":"entidad"},"prioridad":100,"condiciones":[{"campo":"contrato","valores":["9272","9320","9620"],"operador":"starts_with","resultado":"Caixabank"},{"campo":"apoderado","valores":["Yolanda Vives Solsona","Pedro Pérez Sola","ALBERTO LOPEZ RODRIGUEZ","GASTON BEGUIRISTAIN AMORIN","Carlos Barbera García","Ferran Badia Caralps","Ana Cartagena Puerta","Víctor Tomás Castellsagué","GESTCANARIAS","GESGALICIA","YARZA GESTION","JULIO CUESTA","CASTILLO 11","GESTORIA MAS"],"operador":"in","resultado":"Caixabank"}],"por_defecto":"Otra entidad"}'::jsonb,'Regla de negocio acordada: prefijo de contrato 9272/9320/9620 Y apoderado perteneciente a Molsan o Colaboradores = Caixabank; en cualquier otro caso = Otra entidad.'),
('nombre_apoderado',30,'{"logica":"OR","schema":1,"destino":{"tipo":"registro","campo":"nombre_apoderado"},"prioridad":100,"condiciones":[{"campo":"apoderado","valores":["Ana Cartagena Puerta"],"operador":"equals","resultado":"Ana"},{"campo":"apoderado","valores":["Víctor Tomás Castellsagué"],"operador":"equals","resultado":"Víctor"},{"campo":"apoderado","valores":["GESTCANARIAS"],"operador":"equals","resultado":"Gerardo"},{"campo":"apoderado","valores":["Carlos Barbera García"],"operador":"equals","resultado":"Carlos"},{"campo":"apoderado","valores":["Ferran Badia Caralps"],"operador":"equals","resultado":"Ferran"},{"campo":"apoderado","valores":["GESGALICIA"],"operador":"equals","resultado":"María"},{"campo":"apoderado","valores":["YARZA GESTION"],"operador":"equals","resultado":"Juan Yarza"},{"campo":"apoderado","valores":["JULIO CUESTA"],"operador":"equals","resultado":"Julio"},{"campo":"apoderado","valores":["CASTILLO 11"],"operador":"equals","resultado":"Ignacio"},{"campo":"apoderado","valores":["GESTORIA MAS"],"operador":"equals","resultado":"Francisca"},{"campo":"apoderado","valores":["Yolanda Vives Solsona"],"operador":"equals","resultado":"Yolanda"},{"campo":"apoderado","valores":["Pedro Pérez Sola"],"operador":"equals","resultado":"Pedro"},{"campo":"apoderado","valores":["ALBERTO LOPEZ RODRIGUEZ"],"operador":"equals","resultado":"Alberto"},{"campo":"apoderado","valores":["GASTON BEGUIRISTAIN AMORIN"],"operador":"equals","resultado":"Gastón"},{"campo":"apoderado","valores":["Oficina Otra entidad"],"operador":"equals","resultado":"Otra entidad"},{"campo":"apoderado","valores":["Oficina CaixaBank"],"operador":"equals","resultado":"CaixaBank"}],"por_defecto":"Pendiente de clasificar"}'::jsonb,'Se conserva el mapa de nombres y gestorías definido en la versión 2; comparación exacta normalizada.'),
('tipo_firma',60,'{"logica":"OR","schema":1,"destino":{"tipo":"registro","campo":"tipo_firma"},"prioridad":100,"condiciones":[{"campo":"vc","valores":["N"],"operador":"equals","resultado":"Presencial"},{"campo":"vc","valores":["S"],"operador":"equals","resultado":"VideoConferencia"}],"por_defecto":"Pendiente de clasificar"}'::jsonb,'Regla recuperada: V.C. N = Presencial; V.C. S = VideoConferencia.'),
('tipo_gestion',20,'{"logica":"OR","schema":1,"destino":{"tipo":"registro","campo":"tipo_gestion"},"prioridad":100,"condiciones":[{"campo":"tipo_provision","valores":["CANCELACIÓN","Cancelación con provisión","Novación","Subrogación","Constitución","Cancelacion con provision"],"operador":"in","resultado":"Con provisión"},{"campo":"tipo_provision","valores":["CANCELACIÓN SIN PROVISIÓN","Cancelación sin provisión","Cancelacion sin provision"],"operador":"in","resultado":"Sin provisión"}],"por_defecto":"Pendiente de clasificar"}'::jsonb,'Regla recuperada; listas separadas en valores individuales y comparación normalizada sin acentos.')
)
insert into public.estadisticas_reglas_calculo
  (campo_id,version,definicion,activa,vigente_desde,vigente_hasta,notas,motor,prioridad)
select c.id,
       coalesce((select max(old.version)+1 from public.estadisticas_reglas_calculo old where old.campo_id=c.id),1),
       d.definicion,true,now(),null,d.notas,'expresion_v1',d.prioridad
from definitions d
join public.estadisticas_campos_calculados c on c.codigo=d.codigo and c.activo=true;

do $backfill$
declare
  v_registro record;
  v_regla record;
  v_record_json jsonb;
  v_valor jsonb;
  v_destino jsonb;
  v_destino_campo text;
begin
  for v_registro in
    select id,contrato,oficina,tipo_provision,notario,vc,apoderado
    from public.estadisticas_registros order by id
  loop
    v_record_json:=pg_catalog.jsonb_build_object(
      'contrato',v_registro.contrato,'oficina',v_registro.oficina,
      'tipo_provision',v_registro.tipo_provision,'notario',v_registro.notario,
      'vc',v_registro.vc,'apoderado',v_registro.apoderado);
    for v_regla in
      select r.id,r.campo_id,r.definicion,r.prioridad
      from public.estadisticas_reglas_calculo r
      join public.estadisticas_campos_calculados c on c.id=r.campo_id
      where r.activa=true and c.activo=true
        and c.codigo in ('centro_encargo','tipo_gestion','nombre_apoderado','centro_firma','entidad','circuito_notarial','tipo_firma')
      order by r.prioridad asc,r.creado_en asc,r.id asc
    loop
      v_destino:=v_regla.definicion->'destino';
      v_destino_campo:=v_destino->>'campo';
      v_valor:=public.evaluar_regla_estadistica(v_record_json,v_regla.definicion);
      if v_valor is null or v_valor='null'::jsonb then continue; end if;
      if v_destino_campo not in ('centro_encargo','tipo_gestion','nombre_apoderado','centro_firma','entidad','circuito_notarial','tipo_firma') then
        raise exception 'Destino no permitido en recalculo: %',v_destino_campo;
      end if;
      execute pg_catalog.format('update public.estadisticas_registros set %I=$1 where id=$2',v_destino_campo)
        using v_valor #>> '{}',v_registro.id;
      insert into public.estadisticas_valores_calculados(registro_id,campo_id,regla_id,valor)
      values(v_registro.id,v_regla.campo_id,v_regla.id,v_valor)
      on conflict(registro_id,campo_id,regla_id)
      do update set valor=excluded.valor,calculado_en=now();
    end loop;
  end loop;
end;
$backfill$;
