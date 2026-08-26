USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
GO

/*
Eleven employees arrived from the source system without an employee code. Their UserID was copied
into employee_code purely so the NOT NULL column had something in it, which left a value that reads
like a staff number but is not one.

Clearing it needs the column to accept "no code yet", and that is more than dropping NOT NULL:
UQ_employee_company_id_employee_code is a plain UNIQUE constraint, and SQL Server treats NULLs as
equal inside one, so it would still allow only a single unset employee per company. Five of the
eleven are at ATFB and four at TEP.

A filtered unique index solves it the same way migration 26 solved it for employee.user_id — rows
without a value are excluded from the uniqueness check entirely, while every real code stays unique
within its company.

NULL rather than '' or '-': it says "there is no code" instead of leaving a value that later reads
as one somebody forgot to fill in.
*/
BEGIN TRY
  BEGIN TRANSACTION;

  IF EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = N'UQ_employee_company_id_employee_code' AND parent_object_id = OBJECT_ID(N'dbo.employee')
  )
    ALTER TABLE dbo.employee DROP CONSTRAINT UQ_employee_company_id_employee_code;

  IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.employee') AND name = N'employee_code' AND is_nullable = 0
  )
    ALTER TABLE dbo.employee ALTER COLUMN employee_code NVARCHAR(50) NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_employee_company_employee_code' AND object_id = OBJECT_ID(N'dbo.employee')
  )
    CREATE UNIQUE INDEX UX_employee_company_employee_code
      ON dbo.employee(company_id, employee_code)
      WHERE employee_code IS NOT NULL;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

-- Clear only the placeholder codes, identified by all three signals at once: no separator, the
-- 8-character shape of a UserID, and a value equal to that employee's own user_id. A real code
-- cannot satisfy all three, so this cannot reach one by accident.
BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @cleared INT;

  UPDATE dbo.employee
  SET employee_code = NULL
  WHERE employee_code IS NOT NULL
    AND employee_code NOT LIKE '%-%'
    AND LEN(employee_code) = 8
    AND employee_code = user_id;

  SET @cleared = @@ROWCOUNT;

  IF @cleared > 11
    THROW 50030, N'More rows matched the placeholder shape than expected - rolled back for review.', 1;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
