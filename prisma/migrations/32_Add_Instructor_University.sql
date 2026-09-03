/*
TrainingPlanManagement
Migration 32: Add university to instructor

Adds optional university (NVARCHAR(255)) to dbo.instructor.
*/
USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH(N'dbo.instructor', N'university') IS NULL
  BEGIN
    ALTER TABLE dbo.instructor
      ADD university NVARCHAR(255) NULL;
  END;

  COMMIT TRANSACTION;
  PRINT 'Migration 32 completed successfully.';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
