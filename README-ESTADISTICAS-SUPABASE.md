# ESTADISTICAS-MOLSAN · Supabase-first frontend

Private single-owner statistics workspace. This branch replaces the legacy browser-storage entrypoint with a Supabase-backed application shell.

- No business records are persisted in IndexedDB or localStorage.
- Supabase Auth OTP with transient session storage.
- RLS restricts all statistics tables to one authorized email.
- Excel import is staged row-by-row for validation; it does not publish analytical records automatically.
- Catalogs and calculated-field dictionary connect to PostgreSQL.

Deploy this branch as a Render Static Site, publish directory `.`, with no build step. Configure Supabase Auth to allow the deployed URL. Keep this branch isolated from main until the real workbook and all business rules are validated.
