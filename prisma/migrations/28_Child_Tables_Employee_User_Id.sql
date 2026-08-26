USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Phase 20 Stage 2: give every table that points at an employee a second, parallel link that
-- uses the durable business key instead of the surrogate id.
--
-- Both links live side by side after this runs. Nothing reads the new column yet and nothing is
-- dropped, so the application behaves exactly as before and this migration can be reversed by
-- dropping the constraints and columns it adds.
--
-- The column is named employee_user_id, not user_id: dbo.user_account already has a user_id of
-- its own (its BigInt primary key) and reusing the name there would mean two unrelated keys
-- sharing one name in a single table.
--
-- Backfill and verification happen per table, and a table whose backfill leaves a gap THROWs
-- before its foreign key is added — a missing link must surface here, not as an orphan later.
BEGIN TRY
  BEGIN TRANSACTION;

  IF EXISTS (SELECT 1 FROM dbo.employee WHERE user_id IS NULL)
    THROW 50028, N'employee.user_id has NULL rows - migration 27 must run first.', 1;

  ---------------------------------------------------------------- training_enrollment
  IF COL_LENGTH(N'dbo.training_enrollment', N'employee_user_id') IS NULL
    ALTER TABLE dbo.training_enrollment ADD employee_user_id NVARCHAR(50) NULL;

  ---------------------------------------------------------------- training_need_request
  IF COL_LENGTH(N'dbo.training_need_request', N'employee_user_id') IS NULL
    ALTER TABLE dbo.training_need_request ADD employee_user_id NVARCHAR(50) NULL;

  ---------------------------------------------------------------- training_record_request
  IF COL_LENGTH(N'dbo.training_record_request', N'employee_user_id') IS NULL
    ALTER TABLE dbo.training_record_request ADD employee_user_id NVARCHAR(50) NULL;

  ---------------------------------------------------------------- training_certificate_file
  IF COL_LENGTH(N'dbo.training_certificate_file', N'employee_user_id') IS NULL
    ALTER TABLE dbo.training_certificate_file ADD employee_user_id NVARCHAR(50) NULL;

  ---------------------------------------------------------------- user_account
  IF COL_LENGTH(N'dbo.user_account', N'employee_user_id') IS NULL
    ALTER TABLE dbo.user_account ADD employee_user_id NVARCHAR(50) NULL;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

-- Separate batch: the columns above must exist before these statements are compiled.
BEGIN TRY
  BEGIN TRANSACTION;

  UPDATE t SET t.employee_user_id = e.user_id
  FROM dbo.training_enrollment AS t
  JOIN dbo.employee AS e ON e.employee_id = t.employee_id
  WHERE t.employee_user_id IS NULL;

  UPDATE t SET t.employee_user_id = e.user_id
  FROM dbo.training_need_request AS t
  JOIN dbo.employee AS e ON e.employee_id = t.employee_id
  WHERE t.employee_user_id IS NULL;

  UPDATE t SET t.employee_user_id = e.user_id
  FROM dbo.training_record_request AS t
  JOIN dbo.employee AS e ON e.employee_id = t.employee_id
  WHERE t.employee_user_id IS NULL;

  UPDATE t SET t.employee_user_id = e.user_id
  FROM dbo.training_certificate_file AS t
  JOIN dbo.employee AS e ON e.employee_id = t.employee_id
  WHERE t.employee_user_id IS NULL;

  UPDATE t SET t.employee_user_id = e.user_id
  FROM dbo.user_account AS t
  JOIN dbo.employee AS e ON e.employee_id = t.employee_id
  WHERE t.employee_user_id IS NULL;

  -- Every row that had an employee must now have that employee's user_id. A gap here means the
  -- join found no employee, which would become a silent orphan the moment the old column goes.
  IF EXISTS (SELECT 1 FROM dbo.training_enrollment WHERE employee_id IS NOT NULL AND employee_user_id IS NULL)
    THROW 50028, N'training_enrollment has rows whose employee could not be resolved.', 1;
  IF EXISTS (SELECT 1 FROM dbo.training_need_request WHERE employee_id IS NOT NULL AND employee_user_id IS NULL)
    THROW 50028, N'training_need_request has rows whose employee could not be resolved.', 1;
  IF EXISTS (SELECT 1 FROM dbo.training_record_request WHERE employee_id IS NOT NULL AND employee_user_id IS NULL)
    THROW 50028, N'training_record_request has rows whose employee could not be resolved.', 1;
  IF EXISTS (SELECT 1 FROM dbo.training_certificate_file WHERE employee_id IS NOT NULL AND employee_user_id IS NULL)
    THROW 50028, N'training_certificate_file has rows whose employee could not be resolved.', 1;
  IF EXISTS (SELECT 1 FROM dbo.user_account WHERE employee_id IS NOT NULL AND employee_user_id IS NULL)
    THROW 50028, N'user_account has rows whose employee could not be resolved.', 1;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

-- Only now, with every row verified, point the new columns at employee.user_id. SQL Server
-- accepts the unique index migration 27 left on that column as the referenced key.
BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'FK_training_enrollment_employee_user_id', N'F') IS NULL
    ALTER TABLE dbo.training_enrollment
      ADD CONSTRAINT FK_training_enrollment_employee_user_id
      FOREIGN KEY (employee_user_id) REFERENCES dbo.employee(user_id);

  IF OBJECT_ID(N'FK_training_need_request_employee_user_id', N'F') IS NULL
    ALTER TABLE dbo.training_need_request
      ADD CONSTRAINT FK_training_need_request_employee_user_id
      FOREIGN KEY (employee_user_id) REFERENCES dbo.employee(user_id);

  IF OBJECT_ID(N'FK_training_record_request_employee_user_id', N'F') IS NULL
    ALTER TABLE dbo.training_record_request
      ADD CONSTRAINT FK_training_record_request_employee_user_id
      FOREIGN KEY (employee_user_id) REFERENCES dbo.employee(user_id);

  IF OBJECT_ID(N'FK_training_certificate_file_employee_user_id', N'F') IS NULL
    ALTER TABLE dbo.training_certificate_file
      ADD CONSTRAINT FK_training_certificate_file_employee_user_id
      FOREIGN KEY (employee_user_id) REFERENCES dbo.employee(user_id);

  IF OBJECT_ID(N'FK_user_account_employee_user_id', N'F') IS NULL
    ALTER TABLE dbo.user_account
      ADD CONSTRAINT FK_user_account_employee_user_id
      FOREIGN KEY (employee_user_id) REFERENCES dbo.employee(user_id);

  -- Lookups by the new key follow the same access pattern the old employee_id indexes serve.
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_training_enrollment_employee_user_id' AND object_id = OBJECT_ID(N'dbo.training_enrollment'))
    CREATE INDEX IX_training_enrollment_employee_user_id ON dbo.training_enrollment(employee_user_id);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_training_need_request_employee_user_id' AND object_id = OBJECT_ID(N'dbo.training_need_request'))
    CREATE INDEX IX_training_need_request_employee_user_id ON dbo.training_need_request(employee_user_id);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_training_record_request_employee_user_id' AND object_id = OBJECT_ID(N'dbo.training_record_request'))
    CREATE INDEX IX_training_record_request_employee_user_id ON dbo.training_record_request(employee_user_id);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_training_certificate_file_employee_user_id' AND object_id = OBJECT_ID(N'dbo.training_certificate_file'))
    CREATE INDEX IX_training_certificate_file_employee_user_id ON dbo.training_certificate_file(employee_user_id);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_user_account_employee_user_id' AND object_id = OBJECT_ID(N'dbo.user_account'))
    CREATE INDEX IX_user_account_employee_user_id ON dbo.user_account(employee_user_id);

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
