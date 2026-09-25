/*
TrainingPlanManagement
Migration 50: Add instructor contact, education, university, organization details to OAP and Rolling plans

1. Add instructor details to training_plan_oap:
   - instructor_telephone NVARCHAR(50) NULL
   - instructor_email NVARCHAR(255) NULL
   - instructor_education NVARCHAR(500) NULL
   - instructor_organization NVARCHAR(255) NULL
   - instructor_university NVARCHAR(255) NULL

2. Add instructor and provider details to training_plan (Rolling sessions):
   - instructor_id BIGINT NULL (FK -> instructor)
   - instructor_name_text NVARCHAR(255) NULL
   - instructor_telephone NVARCHAR(50) NULL
   - instructor_email NVARCHAR(255) NULL
   - instructor_education NVARCHAR(500) NULL
   - instructor_organization NVARCHAR(255) NULL
   - instructor_university NVARCHAR(255) NULL
   - provider_id BIGINT NULL (FK -> institute_provider)
   - provider_name_text NVARCHAR(255) NULL
*/
USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  -- 1. Add instructor details to training_plan_oap
  IF COL_LENGTH(N'dbo.training_plan_oap', N'instructor_telephone') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD instructor_telephone NVARCHAR(50) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'instructor_email') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD instructor_email NVARCHAR(255) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'instructor_education') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD instructor_education NVARCHAR(500) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'instructor_organization') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD instructor_organization NVARCHAR(255) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'instructor_university') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD instructor_university NVARCHAR(255) NULL;
  END;

  -- 2. Add instructor and provider details to training_plan (Rolling)
  IF COL_LENGTH(N'dbo.training_plan', N'instructor_id') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan
      ADD instructor_id BIGINT NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan', N'instructor_name_text') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan
      ADD instructor_name_text NVARCHAR(255) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan', N'instructor_telephone') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan
      ADD instructor_telephone NVARCHAR(50) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan', N'instructor_email') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan
      ADD instructor_email NVARCHAR(255) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan', N'instructor_education') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan
      ADD instructor_education NVARCHAR(500) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan', N'instructor_organization') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan
      ADD instructor_organization NVARCHAR(255) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan', N'instructor_university') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan
      ADD instructor_university NVARCHAR(255) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan', N'provider_id') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan
      ADD provider_id BIGINT NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan', N'provider_name_text') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan
      ADD provider_name_text NVARCHAR(255) NULL;
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  -- Foreign Key for training_plan.instructor_id
  IF OBJECT_ID(N'dbo.FK_training_plan_instructor_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan WITH CHECK
      ADD CONSTRAINT FK_training_plan_instructor_id
      FOREIGN KEY (instructor_id) REFERENCES dbo.instructor (instructor_id);
  END;

  -- Foreign Key for training_plan.provider_id
  IF OBJECT_ID(N'dbo.FK_training_plan_provider_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan WITH CHECK
      ADD CONSTRAINT FK_training_plan_provider_id
      FOREIGN KEY (provider_id) REFERENCES dbo.institute_provider (institute_provider_id);
  END;

  -- Index on instructor_id
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_training_plan_instructor_id' AND object_id = OBJECT_ID(N'dbo.training_plan')
  )
  BEGIN
    CREATE INDEX IX_training_plan_instructor_id
      ON dbo.training_plan (instructor_id);
  END;

  -- Index on provider_id
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_training_plan_provider_id' AND object_id = OBJECT_ID(N'dbo.training_plan')
  )
  BEGIN
    CREATE INDEX IX_training_plan_provider_id
      ON dbo.training_plan (provider_id);
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
