# SQL Server foundation

The application uses a server-only `mssql` connection pool. Runtime credentials
must be supplied through environment variables and must belong to a
least-privilege application account.

Copy the keys from `.env.example` into a local environment file and provide the
credential values outside source control. Do not use `sa`, a `sysadmin` account,
or a hardcoded connection string.

The Phase 1 health route is `GET /api/health/database`. It executes only:

```sql
SELECT 1 AS ok
```

The response exposes only whether the database is reachable. Connection details
and raw driver errors are never returned.
