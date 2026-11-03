# Molsan Estadísticas API

Scaffold inicial de la API, todavía sin endpoints de negocio ni autenticación habilitada.

## Requisitos
- Node.js 22 o superior.
- PostgreSQL disponible.
- Variables de entorno: `DATABASE_URL`, `FRONTEND_ORIGIN`; opcionales `NODE_ENV`, `HOST`, `PORT`, `TRUST_PROXY`, `PGSSLMODE`.

## Desarrollo
```bash
npm install
npm run dev
```

## Compilación
```bash
npm run typecheck
npm run build
npm start
```

## Health checks
- `GET /health/live`: proceso activo.
- `GET /health/ready`: API y conexión PostgreSQL disponibles.

No conectar este servicio a producción. La autenticación, migraciones, endpoints de negocio y pruebas deben añadirse antes de desplegarlo. No introducir secretos en el repositorio.