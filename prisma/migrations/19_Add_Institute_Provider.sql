/*
TrainingPlanManagement
Migration 19: Add Institute / Provider master data

Adds dbo.institute_provider (name + code master table, mirrors dbo.position's shape)
and links dbo.training_plan_oap to it via a new nullable provider_id FK, following the
same "FK id + point-in-time text snapshot" convention already used for instructor_id /
instructor_name_text on the same table. The existing free-text provider_name column is
renamed to provider_name_text to make that snapshot role explicit.

No data backfill: no production rows exist yet in provider_name.
*/
USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.institute_provider', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.institute_provider
    (
      institute_provider_id   BIGINT IDENTITY(1,1) NOT NULL,
      institute_provider_code NVARCHAR(30) NOT NULL,
      institute_provider_name NVARCHAR(255) NOT NULL,
      status                  NVARCHAR(20) NOT NULL,

      CONSTRAINT PK_institute_provider PRIMARY KEY CLUSTERED (institute_provider_id),
      CONSTRAINT UQ_institute_provider_institute_provider_code UNIQUE (institute_provider_code)
    );
  END;

  -- Rename the free-text column to make its "point-in-time snapshot" role explicit,
  -- matching instructor_id / instructor_name_text on the same table.
  IF COL_LENGTH(N'dbo.training_plan_oap', N'provider_name') IS NOT NULL
     AND COL_LENGTH(N'dbo.training_plan_oap', N'provider_name_text') IS NULL
  BEGIN
    EXEC sp_rename N'dbo.training_plan_oap.provider_name', N'provider_name_text', N'COLUMN';
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'provider_id') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap ADD provider_id BIGINT NULL;
  END;

  IF OBJECT_ID(N'dbo.FK_training_plan_oap_institute_provider_provider_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap WITH CHECK
      ADD CONSTRAINT FK_training_plan_oap_institute_provider_provider_id
      FOREIGN KEY (provider_id) REFERENCES dbo.institute_provider (institute_provider_id);
  END;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_training_plan_oap_provider_id'
      AND object_id = OBJECT_ID(N'dbo.training_plan_oap')
  )
  BEGIN
    CREATE INDEX IX_training_plan_oap_provider_id ON dbo.training_plan_oap (provider_id);
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
