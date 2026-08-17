/*
TrainingPlanManagement
Migration 20: Add Division / Department / Section targeting to Course Standard

Mirrors migration 16 (function_id): adds nullable division_id/department_id/section_id
scalar FK columns to dbo.course_standard_course, so a course standard can independently
target a Function, Division, Department, and/or Section (NULL at any level = "All").
*/
USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH(N'dbo.course_standard_course', N'division_id') IS NULL
  BEGIN
    ALTER TABLE dbo.course_standard_course ADD division_id BIGINT NULL;
  END;

  IF COL_LENGTH(N'dbo.course_standard_course', N'department_id') IS NULL
  BEGIN
    ALTER TABLE dbo.course_standard_course ADD department_id BIGINT NULL;
  END;

  IF COL_LENGTH(N'dbo.course_standard_course', N'section_id') IS NULL
  BEGIN
    ALTER TABLE dbo.course_standard_course ADD section_id BIGINT NULL;
  END;

  IF OBJECT_ID(N'dbo.FK_course_standard_course_division_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.course_standard_course WITH CHECK
      ADD CONSTRAINT FK_course_standard_course_division_id
      FOREIGN KEY (division_id) REFERENCES dbo.division (division_id);
  END;

  IF OBJECT_ID(N'dbo.FK_course_standard_course_department_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.course_standard_course WITH CHECK
      ADD CONSTRAINT FK_course_standard_course_department_id
      FOREIGN KEY (department_id) REFERENCES dbo.department (department_id);
  END;

  IF OBJECT_ID(N'dbo.FK_course_standard_course_section_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.course_standard_course WITH CHECK
      ADD CONSTRAINT FK_course_standard_course_section_id
      FOREIGN KEY (section_id) REFERENCES dbo.section (section_id);
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
