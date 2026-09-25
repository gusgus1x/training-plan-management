/*
TrainingPlanManagement
Migration 48: Link company courses to the Center course they were copied from

- course.copied_from_center_course_id: the Center course (company_id IS NULL) a company
  course was created from via "Copy details from Center Course template". NULL for courses
  a company wrote itself and always NULL for Center courses. This column is the real link;
  the course_code only mirrors it for people reading the code.
- course.course_code widens VARCHAR(20) -> VARCHAR(30). A copied course's code is
  <company>-<group>-<center seq>-<company seq> (e.g. ATA-OT-000001-000002), which is
  already 21 characters for a 4-letter company code such as ATFB.
- training_need_request.course_code_snapshot widens with it, since it copies course_code.

Existing course codes are not changed.
*/
USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  -- 1. Link column
  IF COL_LENGTH(N'dbo.course', N'copied_from_center_course_id') IS NULL
  BEGIN
    ALTER TABLE dbo.course
      ADD copied_from_center_course_id BIGINT NULL;
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

  IF OBJECT_ID(N'dbo.FK_course_copied_from_center_course_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.course WITH CHECK
      ADD CONSTRAINT FK_course_copied_from_center_course_id
      FOREIGN KEY (copied_from_center_course_id) REFERENCES dbo.course (course_id);
  END;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_course_copied_from_center_course_id' AND object_id = OBJECT_ID(N'dbo.course')
  )
  BEGIN
    CREATE INDEX IX_course_copied_from_center_course_id
      ON dbo.course (copied_from_center_course_id);
  END;

  -- 2. Widen course.course_code (the unique index must be dropped around the ALTER)
  IF COL_LENGTH(N'dbo.course', N'course_code') < 30
  BEGIN
    IF EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'UX_RC2_course_course_code' AND object_id = OBJECT_ID(N'dbo.course')
    )
      DROP INDEX UX_RC2_course_course_code ON dbo.course;

    ALTER TABLE dbo.course
      ALTER COLUMN course_code VARCHAR(30) NOT NULL;

    CREATE UNIQUE INDEX UX_RC2_course_course_code
      ON dbo.course (course_code);
  END;

  -- 3. Widen the snapshot that copies course_code
  IF COL_LENGTH(N'dbo.training_need_request', N'course_code_snapshot') < 30
  BEGIN
    ALTER TABLE dbo.training_need_request
      ALTER COLUMN course_code_snapshot VARCHAR(30) NULL;
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
