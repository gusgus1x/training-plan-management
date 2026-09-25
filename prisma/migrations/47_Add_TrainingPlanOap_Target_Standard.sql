/*
TrainingPlanManagement
Migration 47: Add Training Plan OAP target standard fields and child tables

Stores the exact target positions, levels, companies, and organizational scope
directly on each OAP plan at creation time, disconnecting saved plans from
subsequent edits in Course Master.
*/
USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  -- 1. Add Org Scope and Target Group columns to training_plan_oap
  IF COL_LENGTH(N'dbo.training_plan_oap', N'function_id') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD function_id BIGINT NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'division_id') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD division_id BIGINT NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'department_id') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD department_id BIGINT NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'section_id') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD section_id BIGINT NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'target_group_snapshot') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD target_group_snapshot NVARCHAR(500) NULL;
  END;

  -- Add Foreign Keys for Org Scope columns
  IF OBJECT_ID(N'dbo.FK_training_plan_oap_function_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap WITH CHECK
      ADD CONSTRAINT FK_training_plan_oap_function_id
      FOREIGN KEY (function_id) REFERENCES dbo.organization_function (function_id);
  END;

  IF OBJECT_ID(N'dbo.FK_training_plan_oap_division_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap WITH CHECK
      ADD CONSTRAINT FK_training_plan_oap_division_id
      FOREIGN KEY (division_id) REFERENCES dbo.division (division_id);
  END;

  IF OBJECT_ID(N'dbo.FK_training_plan_oap_department_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap WITH CHECK
      ADD CONSTRAINT FK_training_plan_oap_department_id
      FOREIGN KEY (department_id) REFERENCES dbo.department (department_id);
  END;

  IF OBJECT_ID(N'dbo.FK_training_plan_oap_section_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap WITH CHECK
      ADD CONSTRAINT FK_training_plan_oap_section_id
      FOREIGN KEY (section_id) REFERENCES dbo.section (section_id);
  END;

  -- 2. Create Target Position Child Table
  IF OBJECT_ID(N'dbo.training_plan_oap_target_position', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.training_plan_oap_target_position
    (
      target_position_id BIGINT IDENTITY(1,1) NOT NULL,
      oap_plan_id        BIGINT NOT NULL,
      position_id        BIGINT NOT NULL,

      CONSTRAINT PK_training_plan_oap_target_position PRIMARY KEY CLUSTERED (target_position_id),
      CONSTRAINT UQ_oap_plan_target_position UNIQUE (oap_plan_id, position_id)
    );
  END;

  IF OBJECT_ID(N'dbo.FK_training_plan_oap_target_position_oap_plan_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap_target_position WITH CHECK
      ADD CONSTRAINT FK_training_plan_oap_target_position_oap_plan_id
      FOREIGN KEY (oap_plan_id) REFERENCES dbo.training_plan_oap (oap_plan_id)
      ON DELETE CASCADE;
  END;

  IF OBJECT_ID(N'dbo.FK_training_plan_oap_target_position_position_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap_target_position WITH CHECK
      ADD CONSTRAINT FK_training_plan_oap_target_position_position_id
      FOREIGN KEY (position_id) REFERENCES dbo.position (position_id);
  END;

  -- 3. Create Target Level Child Table
  IF OBJECT_ID(N'dbo.training_plan_oap_target_level', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.training_plan_oap_target_level
    (
      target_level_id    BIGINT IDENTITY(1,1) NOT NULL,
      oap_plan_id        BIGINT NOT NULL,
      level_id           BIGINT NOT NULL,

      CONSTRAINT PK_training_plan_oap_target_level PRIMARY KEY CLUSTERED (target_level_id),
      CONSTRAINT UQ_oap_plan_target_level UNIQUE (oap_plan_id, level_id)
    );
  END;

  IF OBJECT_ID(N'dbo.FK_training_plan_oap_target_level_oap_plan_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap_target_level WITH CHECK
      ADD CONSTRAINT FK_training_plan_oap_target_level_oap_plan_id
      FOREIGN KEY (oap_plan_id) REFERENCES dbo.training_plan_oap (oap_plan_id)
      ON DELETE CASCADE;
  END;

  IF OBJECT_ID(N'dbo.FK_training_plan_oap_target_level_level_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap_target_level WITH CHECK
      ADD CONSTRAINT FK_training_plan_oap_target_level_level_id
      FOREIGN KEY (level_id) REFERENCES dbo.employee_level (level_id);
  END;

  -- 4. Create Target Company Child Table
  IF OBJECT_ID(N'dbo.training_plan_oap_target_company', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.training_plan_oap_target_company
    (
      target_company_id  BIGINT IDENTITY(1,1) NOT NULL,
      oap_plan_id        BIGINT NOT NULL,
      company_id         BIGINT NOT NULL,

      CONSTRAINT PK_training_plan_oap_target_company PRIMARY KEY CLUSTERED (target_company_id),
      CONSTRAINT UQ_oap_plan_target_company UNIQUE (oap_plan_id, company_id)
    );
  END;

  IF OBJECT_ID(N'dbo.FK_training_plan_oap_target_company_oap_plan_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap_target_company WITH CHECK
      ADD CONSTRAINT FK_training_plan_oap_target_company_oap_plan_id
      FOREIGN KEY (oap_plan_id) REFERENCES dbo.training_plan_oap (oap_plan_id)
      ON DELETE CASCADE;
  END;

  IF OBJECT_ID(N'dbo.FK_training_plan_oap_target_company_company_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap_target_company WITH CHECK
      ADD CONSTRAINT FK_training_plan_oap_target_company_company_id
      FOREIGN KEY (company_id) REFERENCES dbo.company (company_id);
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
