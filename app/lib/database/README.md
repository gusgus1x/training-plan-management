# SQL Server and Prisma foundation

Runtime credentials must be supplied through environment variables and must
belong to the `training_plan_app` least-privilege application account.

Copy the keys from `.env.example` into a local environment file and provide the
credential values outside source control. Do not use `sa`, a `sysadmin` account,
or a hardcoded connection string.

## Runtime data access

- New business repositories use the server-only Prisma Client from
  `app/lib/database/prisma.ts`.
- Multi-write workflows use `runInTransaction` from
  `app/lib/database/transaction.ts`.
- Repository operations use `withDatabaseErrorMapping` before errors reach an
  API response.
- Authentication and the database health endpoint still use the existing
  `mssql` pool during the transition. Do not introduce another connection
  provider.

Run `npm run prisma:generate` after `prisma/schema.prisma` changes. The generated
client is intentionally excluded from Git.

## Protected APIs

Business route handlers should be wrapped with `createProtectedRoute`. The
wrapper verifies and revalidates the server session, enforces an optional role
allow-list, refreshes the signed cookie, and applies private cache headers.
Company and employee ownership checks must still be performed for the specific
record inside the route/service.

Never accept `role_id`, `company_id`, or `employee_id` from the request as the
source of authorization scope.

## Verification

The Phase 1 health route is `GET /api/health/database`. It executes only:

```sql
SELECT 1 AS ok
```

The response exposes only whether the database is reachable. Connection details
and raw driver errors are never returned.

The optional read-only Prisma integration test can be run in PowerShell with:

```powershell
$env:RUN_DATABASE_TESTS="1"
npm test -- tests/foundation/prisma-integration.test.ts
```
