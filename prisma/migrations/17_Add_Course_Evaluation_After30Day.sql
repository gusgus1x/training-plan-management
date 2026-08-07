USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH(N'dbo.course', N'evaluation_form_after_30day_id') IS NULL
  BEGIN
    ALTER TABLE dbo.course
      ADD evaluation_form_after_30day_id BIGINT NULL;
  END;

  IF OBJECT_ID(N'dbo.FK_course_evaluation_form_after_30day_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.course WITH CHECK
      ADD CONSTRAINT FK_course_evaluation_form_after_30day_id
      FOREIGN KEY (evaluation_form_after_30day_id) REFERENCES dbo.evaluation_form (evaluation_form_id);
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
