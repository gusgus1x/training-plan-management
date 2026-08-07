USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH(N'dbo.course_standard_course', N'function_id') IS NULL
  BEGIN
    ALTER TABLE dbo.course_standard_course
      ADD function_id BIGINT NULL;
  END;

  IF OBJECT_ID(N'dbo.FK_course_standard_course_function_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.course_standard_course WITH CHECK
      ADD CONSTRAINT FK_course_standard_course_function_id
      FOREIGN KEY (function_id) REFERENCES dbo.organization_function (function_id);
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
