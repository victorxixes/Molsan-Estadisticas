-- CTN: acceso exclusivo del propietario y actualización Excel no destructiva.
-- El catálogo conserva los registros que no aparezcan en una importación posterior.

CREATE UNIQUE INDEX IF NOT EXISTS ctn_notarios_codigo_normalizado_uidx
    ON public.ctn_notarios ((lower(btrim(codigo))));

DROP POLICY IF EXISTS authenticated_read_ctn_notarios ON public.ctn_notarios;
DROP POLICY IF EXISTS authenticated_read_ctn_asociados ON public.ctn_notarios_asociados;
DROP POLICY IF EXISTS authenticated_read_ctn_importaciones ON public.ctn_importaciones;

CREATE POLICY acceso_unico_propietario_ctn
    ON public.ctn_notarios
    FOR ALL TO authenticated
    USING (estadisticas_private.es_usuario_unico())
    WITH CHECK (estadisticas_private.es_usuario_unico());

CREATE POLICY acceso_unico_propietario_ctn_asociados
    ON public.ctn_notarios_asociados
    FOR ALL TO authenticated
    USING (estadisticas_private.es_usuario_unico())
    WITH CHECK (estadisticas_private.es_usuario_unico());

CREATE POLICY acceso_unico_propietario_ctn_importaciones
    ON public.ctn_importaciones
    FOR ALL TO authenticated
    USING (estadisticas_private.es_usuario_unico())
    WITH CHECK (estadisticas_private.es_usuario_unico());

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.ctn_notarios, public.ctn_notarios_asociados, public.ctn_importaciones
    TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE public.ctn_notarios_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.importar_ctn_excel(
    p_nombre_fichero text,
    p_registros jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_total integer;
    v_insertados integer := 0;
    v_actualizados integer := 0;
    v_importacion_id uuid;
BEGIN
    IF auth.uid() IS NULL OR NOT estadisticas_private.es_usuario_unico() THEN
        RAISE EXCEPTION 'No autorizado para importar el catálogo CTN.'
            USING ERRCODE = '42501';
    END IF;

    IF p_registros IS NULL OR jsonb_typeof(p_registros) <> 'array' THEN
        RAISE EXCEPTION 'El contenido de la importación debe ser una lista de registros.'
            USING ERRCODE = '22023';
    END IF;

    v_total := jsonb_array_length(p_registros);

    IF v_total = 0 THEN
        RAISE EXCEPTION 'El fichero no contiene registros CTN válidos.'
            USING ERRCODE = '22023';
    END IF;

    IF v_total > 10000 THEN
        RAISE EXCEPTION 'La importación supera el límite de 10.000 registros por operación.'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_registros) AS x(codigo text)
        WHERE nullif(btrim(x.codigo), '') IS NULL
    ) THEN
        RAISE EXCEPTION 'Hay registros sin Código. No se ha modificado el catálogo.'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_registros) AS x(codigo text)
        GROUP BY lower(btrim(x.codigo))
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'El Excel contiene códigos duplicados. No se ha modificado el catálogo.'
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.ctn_importaciones (
        origen, nombre_fichero, registros_leidos, registros_importados, estado, detalle
    )
    VALUES (
        'EXCEL',
        coalesce(nullif(btrim(p_nombre_fichero), ''), 'CTN.xlsx'),
        v_total,
        0,
        'procesando',
        '{}'::jsonb
    )
    RETURNING id INTO v_importacion_id;

    WITH incoming AS (
        SELECT
            btrim(x.codigo) AS codigo,
            nullif(btrim(x.nombre), '') AS nombre,
            nullif(btrim(x.apellidos), '') AS apellidos,
            nullif(btrim(x.nif), '') AS nif,
            nullif(btrim(x.telefono), '') AS telefono,
            nullif(btrim(x.departamento_cancelaciones), '') AS departamento_cancelaciones,
            nullif(btrim(x.departamento_copias), '') AS departamento_copias,
            nullif(btrim(x.otros_departamentos), '') AS otros_departamentos,
            nullif(btrim(x.cp), '') AS cp,
            nullif(btrim(x.provincia), '') AS provincia,
            nullif(btrim(x.municipio), '') AS municipio,
            nullif(btrim(x.direccion), '') AS direccion,
            CASE
                WHEN lower(translate(btrim(coalesce(x.vc, '')), 'íÍ', 'iI'))
                     IN ('si', 's', 'vc', 'videoconferencia', 'videoconference', 'true', '1')
                    THEN 'VideoConferencia'
                ELSE 'Presencial'
            END AS vc,
            nullif(btrim(x.apoderado), '') AS apoderado,
            nullif(btrim(x.apoderado_s), '') AS apoderado_s,
            nullif(btrim(x.observacion), '') AS observacion
        FROM jsonb_to_recordset(p_registros) AS x(
            codigo text,
            nombre text,
            apellidos text,
            nif text,
            telefono text,
            departamento_cancelaciones text,
            departamento_copias text,
            otros_departamentos text,
            cp text,
            provincia text,
            municipio text,
            direccion text,
            vc text,
            apoderado text,
            apoderado_s text,
            observacion text
        )
    ),
    upserted AS (
        INSERT INTO public.ctn_notarios (
            codigo, nombre, apellidos, nif, telefono,
            departamento_cancelaciones, departamento_copias, otros_departamentos,
            cp, provincia, municipio, direccion, vc,
            apoderado, apoderado_s, observacion,
            source_system, source_synced_at, updated_at
        )
        SELECT
            codigo, nombre, apellidos, nif, telefono,
            departamento_cancelaciones, departamento_copias, otros_departamentos,
            cp, provincia, municipio, direccion, vc,
            apoderado, apoderado_s, observacion,
            'EXCEL', now(), now()
        FROM incoming
        ON CONFLICT ((lower(btrim(codigo)))) DO UPDATE SET
            codigo = EXCLUDED.codigo,
            nombre = EXCLUDED.nombre,
            apellidos = EXCLUDED.apellidos,
            nif = EXCLUDED.nif,
            telefono = EXCLUDED.telefono,
            departamento_cancelaciones = EXCLUDED.departamento_cancelaciones,
            departamento_copias = EXCLUDED.departamento_copias,
            otros_departamentos = EXCLUDED.otros_departamentos,
            cp = EXCLUDED.cp,
            provincia = EXCLUDED.provincia,
            municipio = EXCLUDED.municipio,
            direccion = EXCLUDED.direccion,
            vc = EXCLUDED.vc,
            apoderado = EXCLUDED.apoderado,
            apoderado_s = EXCLUDED.apoderado_s,
            observacion = EXCLUDED.observacion,
            source_system = 'EXCEL',
            source_synced_at = now(),
            updated_at = now()
        RETURNING (xmax = 0) AS es_nuevo
    )
    SELECT
        count(*) FILTER (WHERE es_nuevo)::integer,
        count(*) FILTER (WHERE NOT es_nuevo)::integer
    INTO v_insertados, v_actualizados
    FROM upserted;

    UPDATE public.ctn_importaciones
    SET
        registros_importados = v_total,
        estado = 'completada',
        detalle = jsonb_build_object(
            'insertados', v_insertados,
            'actualizados', v_actualizados,
            'modo', 'upsert_no_destructivo',
            'conserva_registros_ausentes', true
        )
    WHERE id = v_importacion_id;

    RETURN jsonb_build_object(
        'importacion_id', v_importacion_id,
        'leidos', v_total,
        'insertados', v_insertados,
        'actualizados', v_actualizados,
        'conserva_registros_ausentes', true
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.importar_ctn_excel(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.importar_ctn_excel(text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.importar_ctn_excel(text, jsonb)
    IS 'Importación CTN validada y transaccional: inserta o actualiza por código, sin borrar registros ausentes.';
