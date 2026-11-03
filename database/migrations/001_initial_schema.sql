-- Molsan Estadísticas — initial logical schema
-- This migration is for isolated development/preview databases only.
-- Do not run against production until the Excel data dictionary is validated.

BEGIN;

CREATE TABLE IF NOT EXISTS app_user (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_session (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  remote_ip INET,
  CONSTRAINT app_session_expiry_ck CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS app_session_user_expiry_idx ON app_session(user_id, expires_at);
CREATE INDEX IF NOT EXISTS app_session_active_expiry_idx ON app_session(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS classification_rule_version (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version_name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS classification_rule (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_version_id BIGINT NOT NULL REFERENCES classification_rule_version(id) ON DELETE RESTRICT,
  field_name TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'prefix', 'contains', 'regex', 'alias')),
  match_value TEXT NOT NULL,
  result_value TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS classification_rule_lookup_idx
  ON classification_rule(rule_version_id, field_name, priority) WHERE is_enabled = TRUE;

CREATE TABLE IF NOT EXISTS dimension_value (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dimension_type TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dimension_type, canonical_key),
  CONSTRAINT dimension_aliases_array_ck CHECK (jsonb_typeof(aliases) = 'array')
);

CREATE TABLE IF NOT EXISTS import_job (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  original_file_name TEXT NOT NULL,
  file_sha256 CHAR(64) NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'validating', 'ready', 'committing', 'committed', 'failed', 'cancelled')),
  rule_version_id BIGINT REFERENCES classification_rule_version(id) ON DELETE RESTRICT,
  total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows INTEGER NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  warning_rows INTEGER NOT NULL DEFAULT 0 CHECK (warning_rows >= 0),
  error_rows INTEGER NOT NULL DEFAULT 0 CHECK (error_rows >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  committed_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS import_job_created_idx ON import_job(created_at DESC);
CREATE INDEX IF NOT EXISTS import_job_hash_idx ON import_job(file_sha256);

CREATE TABLE IF NOT EXISTS import_row (
  import_job_id BIGINT NOT NULL REFERENCES import_job(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL CHECK (row_number > 0),
  source_data JSONB NOT NULL,
  normalized_data JSONB,
  row_sha256 CHAR(64),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'valid', 'warning', 'error', 'duplicate', 'committed')),
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  signature_id BIGINT,
  PRIMARY KEY (import_job_id, row_number),
  CHECK (jsonb_typeof(source_data) = 'object'),
  CHECK (jsonb_typeof(errors) = 'array'),
  CHECK (jsonb_typeof(warnings) = 'array')
);
CREATE INDEX IF NOT EXISTS import_row_status_idx ON import_row(import_job_id, status);

CREATE TABLE IF NOT EXISTS signature (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  import_job_id BIGINT REFERENCES import_job(id) ON DELETE SET NULL,
  source_row_number INTEGER,
  source_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_row_sha256 CHAR(64),

  expediente TEXT,
  oficina TEXT,
  fecha_alta DATE,
  contrato_original TEXT,
  entidad_clasificada TEXT,
  tipo_provision TEXT,
  notario TEXT,
  provincia TEXT,
  municipio TEXT,
  comunidad TEXT,
  protocolo TEXT,
  fecha_protocolo DATE,
  vc TEXT,
  apoderado TEXT,
  envio_notario DATE,
  dias NUMERIC(10,2),

  mes_numero SMALLINT,
  anio SMALLINT,
  centro TEXT,
  tipo_gestion TEXT,
  nombre TEXT,
  apellidos TEXT,
  centro_que_firma TEXT,
  notario_clasificado TEXT,
  circuito TEXT,
  tipo_firma TEXT,
  rule_version_id BIGINT REFERENCES classification_rule_version(id) ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signature_month_ck CHECK (mes_numero IS NULL OR mes_numero BETWEEN 1 AND 12),
  CONSTRAINT signature_days_ck CHECK (dias IS NULL OR dias >= 0)
);
CREATE INDEX IF NOT EXISTS signature_year_month_idx ON signature(anio, mes_numero);
CREATE INDEX IF NOT EXISTS signature_expediente_idx ON signature(expediente);
CREATE INDEX IF NOT EXISTS signature_office_idx ON signature(oficina, centro);
CREATE INDEX IF NOT EXISTS signature_agent_idx ON signature(apoderado);
CREATE INDEX IF NOT EXISTS signature_notary_circuit_idx ON signature(notario, circuito);
CREATE INDEX IF NOT EXISTS signature_type_idx ON signature(tipo_firma, tipo_provision);

ALTER TABLE import_row
  DROP CONSTRAINT IF EXISTS import_row_signature_fk;
ALTER TABLE import_row
  ADD CONSTRAINT import_row_signature_fk
  FOREIGN KEY (signature_id) REFERENCES signature(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS saved_report (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'archived')),
  created_by BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_revision (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id BIGINT NOT NULL REFERENCES saved_report(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  content_json JSONB NOT NULL,
  snapshot_json JSONB NOT NULL,
  rule_version_id BIGINT REFERENCES classification_rule_version(id) ON DELETE RESTRICT,
  created_by BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, revision_number)
);

CREATE TABLE IF NOT EXISTS meeting_minute (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  meeting_date DATE,
  start_time TIME,
  end_time TIME,
  location TEXT,
  introduction_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'archived')),
  created_by BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_attendee (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meeting_id BIGINT NOT NULL REFERENCES meeting_minute(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role_title TEXT,
  attendance_status TEXT NOT NULL DEFAULT 'present'
);

CREATE TABLE IF NOT EXISTS meeting_agenda_item (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meeting_id BIGINT NOT NULL REFERENCES meeting_minute(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  body_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (meeting_id, position)
);

CREATE TABLE IF NOT EXISTS meeting_decision (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meeting_id BIGINT NOT NULL REFERENCES meeting_minute(id) ON DELETE CASCADE,
  agenda_item_id BIGINT REFERENCES meeting_agenda_item(id) ON DELETE SET NULL,
  decision_text TEXT NOT NULL,
  responsible TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS action_item (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source_meeting_id BIGINT REFERENCES meeting_minute(id) ON DELETE SET NULL,
  responsible TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS backup_record (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('database', 'application_export')),
  sha256 CHAR(64) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  storage_reference TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'verified', 'failed', 'restored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES app_user(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_event (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'blocked')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_event_created_idx ON audit_event(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_event_resource_idx ON audit_event(resource_type, resource_id);

CREATE TABLE IF NOT EXISTS migration_run (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_description TEXT NOT NULL,
  source_sha256 CHAR(64),
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'validated', 'committed', 'failed', 'rolled_back')),
  source_count BIGINT,
  inserted_count BIGINT,
  updated_count BIGINT,
  skipped_count BIGINT,
  discrepancy_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

COMMIT;
