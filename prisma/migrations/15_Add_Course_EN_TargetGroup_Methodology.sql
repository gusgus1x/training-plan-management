USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH(N'dbo.course', N'course_name_en') IS NULL
  BEGIN
    ALTER TABLE dbo.course
      ADD course_name_en NVARCHAR(255) NULL;
  END;

  IF COL_LENGTH(N'dbo.course', N'target_group') IS NULL
  BEGIN
    ALTER TABLE dbo.course
      ADD target_group NVARCHAR(MAX) NULL;
  END;

  IF COL_LENGTH(N'dbo.course', N'methodology') IS NULL
  BEGIN
    ALTER TABLE dbo.course
      ADD methodology NVARCHAR(MAX) NULL;
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
