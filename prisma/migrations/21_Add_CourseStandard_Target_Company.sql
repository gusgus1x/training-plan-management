/*
TrainingPlanManagement
Migration 21: Add Course Standard target-company checklist

A course standard can already target a Function/Division/Department/Section (single-select
each, migration 16 and 20) and a checklist of Positions/Levels (base schema). This adds one
more checklist dimension: which of the company(ies) this course's standard targets, independent
of course_standard.company_id (which means "which company owns/authored this standard
document," an unrelated visibility/ownership concept used throughout the app).

Structurally a mirror of course_standard_target_position: its own identity PK, cascade-deletes
with its parent course_standard_course row, unique per (standard_course_id, company_id) pair.
*/
USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.course_standard_target_company', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.course_standard_target_company
    (
      target_company_id  BIGINT IDENTITY(1,1) NOT NULL,
      standard_course_id BIGINT NOT NULL,
      company_id         BIGINT NOT NULL,

      CONSTRAINT PK_course_standard_target_company PRIMARY KEY CLUSTERED (target_company_id),
      CONSTRAINT UQ_standard_course_target_company UNIQUE (standard_course_id, company_id)
    );
  END;

  IF OBJECT_ID(N'dbo.FK_course_standard_target_company_standard_course_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.course_standard_target_company WITH CHECK
      ADD CONSTRAINT FK_course_standard_target_company_standard_course_id
      FOREIGN KEY (standard_course_id) REFERENCES dbo.course_standard_course (standard_course_id)
      ON DELETE CASCADE;
  END;

  IF OBJECT_ID(N'dbo.FK_course_standard_target_company_company_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.course_standard_target_company WITH CHECK
      ADD CONSTRAINT FK_course_standard_target_company_company_id
      FOREIGN KEY (company_id) REFERENCES dbo.company (company_id);
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
