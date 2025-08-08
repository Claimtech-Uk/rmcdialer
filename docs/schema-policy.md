## Schema Policy

Source of truth and safety rules for database schemas in this project.

- Canonical application schema: `prisma/schema.prisma` (PostgreSQL). All app writes go here.
- External read-only schema: `prisma/replica.prisma` (MySQL). Generates `@/prisma/generated/mysql-client` used by `lib/mysql.ts` for read-only queries to the legacy Laravel database.
- Retired draft: `archive/prisma/schema-new-queues.prisma`. Do not use for generation or migrations.

Guidelines
- Only additive changes in production. Never drop or rename columns via Prisma migrations. Use custom SQL with backups if a destructive change is absolutely required.
- Validate production state before changes:
  - `npm run schema:diff:prod` (read-only diff)
  - `npm run schema:diff:prod:sql` (emit SQL for review)
  - `npm run schema:check` (read-only column introspection)
- Environment variables:
  - `DATABASE_URL`: Postgres (primary)
  - `REPLICA_DATABASE_URL`: MySQL (read-only)
  - `PROD_DATABASE_URL` (optional override for `schema:check`)

Notes
- `outstanding_requests_queue.requirement_types` is stored as JSONB in production; Prisma maps it as `Json`.
- Extra columns in production (e.g., `agents.created_by`, `last_login_at`, `updated_by`) are intentionally unmapped; do not remove.

