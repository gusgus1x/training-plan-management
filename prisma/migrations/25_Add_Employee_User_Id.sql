USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

-- Phase 1 of preserving the source system's stable UserID on employee (nullable for now).
-- employee_code has already been overwritten from UserID to EmpID for most employees by
-- scripts/update-employee-code-to-empid.mjs, and EmpID itself isn't recoverable from exported
-- .rpt files (always masked). UserID is the one identifier that survives and doesn't change at
-- the source, so it's kept here going forward as a future stable join key / business key.
-- NOT NULL + UNIQUE are deliberately deferred to a later migration until real backfill coverage
-- against the live source is known (see scripts/backfill-employee-user-id.mjs).
BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH(N'dbo.employee', N'user_id') IS NULL
  BEGIN
    ALTER TABLE dbo.employee
      ADD user_id NVARCHAR(50) NULL;
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
