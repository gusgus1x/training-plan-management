USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH(N'dbo.evaluation_form', N'timing') IS NULL
  BEGIN
    ALTER TABLE dbo.evaluation_form
      ADD timing NVARCHAR(30) NOT NULL
        CONSTRAINT DF_evaluation_form_timing DEFAULT N'AFTER_TRAINING';
  END;

  IF COL_LENGTH(N'dbo.evaluation_form', N'respondent_type') IS NULL
  BEGIN
    ALTER TABLE dbo.evaluation_form
      ADD respondent_type NVARCHAR(20) NOT NULL
        CONSTRAINT DF_evaluation_form_respondent_type DEFAULT N'EMPLOYEE';
  END;

  IF COL_LENGTH(N'dbo.evaluation_form', N'is_anonymous') IS NULL
  BEGIN
    ALTER TABLE dbo.evaluation_form
      ADD is_anonymous BIT NOT NULL
        CONSTRAINT DF_evaluation_form_is_anonymous DEFAULT 1;
  END;

  IF COL_LENGTH(N'dbo.evaluation_question', N'section_name') IS NULL
  BEGIN
    ALTER TABLE dbo.evaluation_question
      ADD section_name NVARCHAR(150) NULL;
  END;

  IF OBJECT_ID(N'dbo.CK_evaluation_form_timing', N'C') IS NULL
  BEGIN
    EXEC sys.sp_executesql N'
      ALTER TABLE dbo.evaluation_form WITH CHECK
        ADD CONSTRAINT CK_evaluation_form_timing
        CHECK (timing IN (N''AFTER_TRAINING'', N''FOLLOW_UP_30_DAYS''));';
  END;

  IF OBJECT_ID(N'dbo.CK_evaluation_form_respondent_type', N'C') IS NULL
  BEGIN
    EXEC sys.sp_executesql N'
      ALTER TABLE dbo.evaluation_form WITH CHECK
        ADD CONSTRAINT CK_evaluation_form_respondent_type
        CHECK (respondent_type IN (N''EMPLOYEE'', N''MANAGER''));';
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
