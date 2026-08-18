USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

-- Manual pre/post-test and evaluation form links pasted in Course Master & Standard.
-- These were previously UI-only (typed but never saved); this persists them so they
-- survive a reload and can back a downloadable QR code once a course is saved.
BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH(N'dbo.course', N'pre_test_link') IS NULL
  BEGIN
    ALTER TABLE dbo.course
      ADD pre_test_link NVARCHAR(2048) NULL;
  END;

  IF COL_LENGTH(N'dbo.course', N'post_test_link') IS NULL
  BEGIN
    ALTER TABLE dbo.course
      ADD post_test_link NVARCHAR(2048) NULL;
  END;

  IF COL_LENGTH(N'dbo.course', N'evaluation_link') IS NULL
  BEGIN
    ALTER TABLE dbo.course
      ADD evaluation_link NVARCHAR(2048) NULL;
  END;

  IF COL_LENGTH(N'dbo.course', N'evaluation_after_30day_link') IS NULL
  BEGIN
    ALTER TABLE dbo.course
      ADD evaluation_after_30day_link NVARCHAR(2048) NULL;
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
