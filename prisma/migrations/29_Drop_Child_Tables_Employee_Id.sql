USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
GO

/*
Phase 20 Stage 8: retire the surrogate employee link from the five child tables.

This is the irreversible step. What it removes is the second, redundant path to the same
employee — not history: each child row keeps employee_user_id, dbo.employee keeps BOTH
employee_id and user_id, so "which employee_id did this row point at" stays answerable through
the employee row. Nothing here touches dbo.employee, and its primary key is untouched.

The guards below re-derive the safety check on the server this runs against. A single row whose
two links disagree, or which has no durable link at all, aborts the whole thing before a column
is dropped.
*/
BEGIN TRY
  BEGIN TRANSACTION;

  IF EXISTS (
    SELECT 1 FROM dbo.training_enrollment AS t
    LEFT JOIN dbo.employee AS e ON e.employee_id = t.employee_id
    WHERE t.employee_id IS NOT NULL AND (t.employee_user_id IS NULL OR t.employee_user_id <> e.user_id)
  )
    THROW 50029, N'training_enrollment: the two employee links disagree - do not drop.', 1;

  IF EXISTS (
    SELECT 1 FROM dbo.training_need_request AS t
    LEFT JOIN dbo.employee AS e ON e.employee_id = t.employee_id
    WHERE t.employee_id IS NOT NULL AND (t.employee_user_id IS NULL OR t.employee_user_id <> e.user_id)
  )
    THROW 50029, N'training_need_request: the two employee links disagree - do not drop.', 1;

  IF EXISTS (
    SELECT 1 FROM dbo.training_record_request AS t
    LEFT JOIN dbo.employee AS e ON e.employee_id = t.employee_id
    WHERE t.employee_id IS NOT NULL AND (t.employee_user_id IS NULL OR t.employee_user_id <> e.user_id)
  )
    THROW 50029, N'training_record_request: the two employee links disagree - do not drop.', 1;

  IF EXISTS (
    SELECT 1 FROM dbo.training_certificate_file AS t
    LEFT JOIN dbo.employee AS e ON e.employee_id = t.employee_id
    WHERE t.employee_id IS NOT NULL AND (t.employee_user_id IS NULL OR t.employee_user_id <> e.user_id)
  )
    THROW 50029, N'training_certificate_file: the two employee links disagree - do not drop.', 1;

  IF EXISTS (
    SELECT 1 FROM dbo.user_account AS t
    LEFT JOIN dbo.employee AS e ON e.employee_id = t.employee_id
    WHERE t.employee_id IS NOT NULL AND (t.employee_user_id IS NULL OR t.employee_user_id <> e.user_id)
  )
    THROW 50029, N'user_account: the two employee links disagree - do not drop.', 1;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

-- Where the old link was mandatory, the new one takes over that duty. Where it was optional
-- (a certificate file, an account not yet tied to a person) the new one stays optional.
--
-- SQL Server refuses ALTER COLUMN while an index or a foreign key depends on the column, so the
-- foreign key and index added in migration 28 come off first and go straight back on after.
BEGIN TRY
  BEGIN TRANSACTION;

  IF EXISTS (SELECT 1 FROM dbo.training_enrollment WHERE employee_user_id IS NULL)
    THROW 50029, N'training_enrollment has rows with no durable employee link.', 1;
  IF EXISTS (SELECT 1 FROM dbo.training_need_request WHERE employee_user_id IS NULL)
    THROW 50029, N'training_need_request has rows with no durable employee link.', 1;
  IF EXISTS (SELECT 1 FROM dbo.training_record_request WHERE employee_user_id IS NULL)
    THROW 50029, N'training_record_request has rows with no durable employee link.', 1;

  ALTER TABLE dbo.training_enrollment DROP CONSTRAINT FK_training_enrollment_employee_user_id;
  ALTER TABLE dbo.training_need_request DROP CONSTRAINT FK_training_need_request_employee_user_id;
  ALTER TABLE dbo.training_record_request DROP CONSTRAINT FK_training_record_request_employee_user_id;

  DROP INDEX IX_training_enrollment_employee_user_id ON dbo.training_enrollment;
  DROP INDEX IX_training_need_request_employee_user_id ON dbo.training_need_request;
  DROP INDEX IX_training_record_request_employee_user_id ON dbo.training_record_request;

  ALTER TABLE dbo.training_enrollment ALTER COLUMN employee_user_id NVARCHAR(50) NOT NULL;
  ALTER TABLE dbo.training_need_request ALTER COLUMN employee_user_id NVARCHAR(50) NOT NULL;
  ALTER TABLE dbo.training_record_request ALTER COLUMN employee_user_id NVARCHAR(50) NOT NULL;

  ALTER TABLE dbo.training_enrollment
    ADD CONSTRAINT FK_training_enrollment_employee_user_id
    FOREIGN KEY (employee_user_id) REFERENCES dbo.employee(user_id);
  ALTER TABLE dbo.training_need_request
    ADD CONSTRAINT FK_training_need_request_employee_user_id
    FOREIGN KEY (employee_user_id) REFERENCES dbo.employee(user_id);
  ALTER TABLE dbo.training_record_request
    ADD CONSTRAINT FK_training_record_request_employee_user_id
    FOREIGN KEY (employee_user_id) REFERENCES dbo.employee(user_id);

  CREATE INDEX IX_training_enrollment_employee_user_id ON dbo.training_enrollment(employee_user_id);
  CREATE INDEX IX_training_need_request_employee_user_id ON dbo.training_need_request(employee_user_id);
  CREATE INDEX IX_training_record_request_employee_user_id ON dbo.training_record_request(employee_user_id);

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

-- "One enrolment per person per plan" has to be re-expressed against the surviving key before
-- the old constraint goes, or the rule lapses for as long as both are absent.
BEGIN TRY
  BEGIN TRANSACTION;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_training_enrollment_plan_employee_user' AND object_id = OBJECT_ID(N'dbo.training_enrollment')
  )
    CREATE UNIQUE INDEX UQ_training_enrollment_plan_employee_user
      ON dbo.training_enrollment(plan_id, employee_user_id);

  -- It was created as a UNIQUE KEY constraint, not a bare index, so it only comes off through
  -- ALTER TABLE — DROP INDEX is refused outright.
  IF EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = N'UQ_training_enrollment_plan_employee' AND parent_object_id = OBJECT_ID(N'dbo.training_enrollment')
  )
    ALTER TABLE dbo.training_enrollment DROP CONSTRAINT UQ_training_enrollment_plan_employee;
  ELSE IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_training_enrollment_plan_employee' AND object_id = OBJECT_ID(N'dbo.training_enrollment')
  )
    DROP INDEX UQ_training_enrollment_plan_employee ON dbo.training_enrollment;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

-- Foreign keys and indexes first; a column cannot be dropped while either references it.
BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @sql NVARCHAR(MAX) = N'';

  SELECT @sql = @sql + N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name)
                     + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';' + CHAR(10)
  FROM sys.foreign_keys AS fk
  JOIN sys.tables AS t ON t.object_id = fk.parent_object_id
  JOIN sys.foreign_key_columns AS fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns AS c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE c.name = N'employee_id'
    AND t.name IN (N'training_enrollment', N'training_need_request', N'training_record_request',
                   N'training_certificate_file', N'user_account');

  SELECT @sql = @sql + N'DROP INDEX ' + QUOTENAME(i.name) + N' ON '
                     + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name) + N';' + CHAR(10)
  FROM sys.indexes AS i
  JOIN sys.tables AS t ON t.object_id = i.object_id
  JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
  JOIN sys.columns AS c ON c.object_id = i.object_id AND c.column_id = ic.column_id
  WHERE c.name = N'employee_id'
    AND i.is_primary_key = 0
    AND t.name IN (N'training_enrollment', N'training_need_request', N'training_record_request',
                   N'training_certificate_file', N'user_account');

  IF @sql <> N'' EXEC sp_executesql @sql;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH(N'dbo.training_enrollment', N'employee_id') IS NOT NULL
    ALTER TABLE dbo.training_enrollment DROP COLUMN employee_id;
  IF COL_LENGTH(N'dbo.training_need_request', N'employee_id') IS NOT NULL
    ALTER TABLE dbo.training_need_request DROP COLUMN employee_id;
  IF COL_LENGTH(N'dbo.training_record_request', N'employee_id') IS NOT NULL
    ALTER TABLE dbo.training_record_request DROP COLUMN employee_id;
  IF COL_LENGTH(N'dbo.training_certificate_file', N'employee_id') IS NOT NULL
    ALTER TABLE dbo.training_certificate_file DROP COLUMN employee_id;
  IF COL_LENGTH(N'dbo.user_account', N'employee_id') IS NOT NULL
    ALTER TABLE dbo.user_account DROP COLUMN employee_id;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
