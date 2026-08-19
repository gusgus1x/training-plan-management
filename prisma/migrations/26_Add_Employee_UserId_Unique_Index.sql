USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Enforce uniqueness on employee.user_id now, without requiring NOT NULL yet: the 30 dev/mock
-- employees (seeded test accounts, see "result employee nationalID is notnull.rpt") have no real
-- source UserID and are deliberately left NULL for now. A plain UNIQUE constraint would reject
-- this (SQL Server only allows a single NULL per UNIQUE constraint) — a filtered unique index
-- sidesteps that by excluding NULL rows from the uniqueness check entirely, so any number of
-- employees can stay NULL while every non-NULL user_id is guaranteed unique.
BEGIN TRY
  BEGIN TRANSACTION;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_employee_user_id' AND object_id = OBJECT_ID(N'dbo.employee')
  )
  BEGIN
    CREATE UNIQUE INDEX UX_employee_user_id
      ON dbo.employee(user_id)
      WHERE user_id IS NOT NULL;
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
