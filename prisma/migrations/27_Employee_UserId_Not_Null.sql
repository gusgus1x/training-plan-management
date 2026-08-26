USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Phase 20 Stage 1: promote employee.user_id from "backfilled where possible" to the durable
-- business key the training tables will hang off.
--
-- Migration 26 left the column nullable and used a filtered unique index because 30 dev/mock
-- employees had no source UserID. Those rows have since been deleted, so every one of the
-- remaining employees carries a real UserID and the exception the filter existed for is gone.
--
-- The guards below re-verify that on the server this runs against rather than trusting the
-- check that was run when this file was written: a NULL, a blank, or a duplicate anywhere means
-- the ALTER would either fail mid-way or silently accept a key that cannot identify a person.
-- Better to stop with a clear message than to half-apply.
BEGIN TRY
  BEGIN TRANSACTION;

  IF EXISTS (SELECT 1 FROM dbo.employee WHERE user_id IS NULL)
    THROW 50027, N'employee.user_id still has NULL rows - backfill them before running this migration.', 1;

  IF EXISTS (SELECT 1 FROM dbo.employee WHERE LTRIM(RTRIM(user_id)) = N'')
    THROW 50027, N'employee.user_id has blank rows - a blank cannot identify an employee.', 1;

  IF EXISTS (
    SELECT 1 FROM dbo.employee GROUP BY user_id HAVING COUNT(*) > 1
  )
    THROW 50027, N'employee.user_id has duplicate values - resolve them before enforcing uniqueness.', 1;

  -- The filtered index has to go first: it sits on the column being altered.
  IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_employee_user_id' AND object_id = OBJECT_ID(N'dbo.employee')
  )
  BEGIN
    DROP INDEX UX_employee_user_id ON dbo.employee;
  END;

  IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.employee') AND name = N'user_id' AND is_nullable = 1
  )
  BEGIN
    ALTER TABLE dbo.employee
      ALTER COLUMN user_id NVARCHAR(50) NOT NULL;
  END;

  -- Recreate it unfiltered. With NOT NULL in force the filter has nothing left to exclude, and an
  -- unfiltered unique index is what a foreign key from the child tables can reference later.
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_employee_user_id' AND object_id = OBJECT_ID(N'dbo.employee')
  )
  BEGIN
    CREATE UNIQUE INDEX UX_employee_user_id
      ON dbo.employee(user_id);
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
