/*
TrainingPlanManagement
Migration 22: Add company-level mapping for Division/Department/Section

company_function_mapping already lets each company record its own local name/code for a
canonical Function (e.g. plant calls it "PLT-SL", the shared catalog calls it "Sales"). This
extends the exact same pattern to Division/Department/Section, since companies name these
differently too. Three structural clones of company_function_mapping, one per level.
*/
USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.company_division_mapping', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.company_division_mapping
    (
      division_mapping_id BIGINT IDENTITY(1,1) NOT NULL,
      company_id           BIGINT NOT NULL,
      plant_division_code  NVARCHAR(50) NOT NULL,
      plant_division_name  NVARCHAR(255) NOT NULL,
      division_id           BIGINT NOT NULL,
      status                NVARCHAR(20) NOT NULL,

      CONSTRAINT PK_company_division_mapping PRIMARY KEY CLUSTERED (division_mapping_id),
      CONSTRAINT UQ_company_division_mapping_company_id_plant_division_code UNIQUE (company_id, plant_division_code)
    );
  END;

  IF OBJECT_ID(N'dbo.FK_company_division_mapping_company_company_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.company_division_mapping WITH CHECK
      ADD CONSTRAINT FK_company_division_mapping_company_company_id
      FOREIGN KEY (company_id) REFERENCES dbo.company (company_id);
  END;

  IF OBJECT_ID(N'dbo.FK_company_division_mapping_division_division_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.company_division_mapping WITH CHECK
      ADD CONSTRAINT FK_company_division_mapping_division_division_id
      FOREIGN KEY (division_id) REFERENCES dbo.division (division_id);
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_company_division_mapping_division_id' AND object_id = OBJECT_ID(N'dbo.company_division_mapping'))
  BEGIN
    CREATE INDEX IX_company_division_mapping_division_id ON dbo.company_division_mapping (division_id);
  END;

  IF OBJECT_ID(N'dbo.company_department_mapping', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.company_department_mapping
    (
      department_mapping_id BIGINT IDENTITY(1,1) NOT NULL,
      company_id             BIGINT NOT NULL,
      plant_department_code  NVARCHAR(50) NOT NULL,
      plant_department_name  NVARCHAR(255) NOT NULL,
      department_id           BIGINT NOT NULL,
      status                  NVARCHAR(20) NOT NULL,

      CONSTRAINT PK_company_department_mapping PRIMARY KEY CLUSTERED (department_mapping_id),
      CONSTRAINT UQ_company_department_mapping_company_id_plant_department_code UNIQUE (company_id, plant_department_code)
    );
  END;

  IF OBJECT_ID(N'dbo.FK_company_department_mapping_company_company_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.company_department_mapping WITH CHECK
      ADD CONSTRAINT FK_company_department_mapping_company_company_id
      FOREIGN KEY (company_id) REFERENCES dbo.company (company_id);
  END;

  IF OBJECT_ID(N'dbo.FK_company_department_mapping_department_department_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.company_department_mapping WITH CHECK
      ADD CONSTRAINT FK_company_department_mapping_department_department_id
      FOREIGN KEY (department_id) REFERENCES dbo.department (department_id);
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_company_department_mapping_department_id' AND object_id = OBJECT_ID(N'dbo.company_department_mapping'))
  BEGIN
    CREATE INDEX IX_company_department_mapping_department_id ON dbo.company_department_mapping (department_id);
  END;

  IF OBJECT_ID(N'dbo.company_section_mapping', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.company_section_mapping
    (
      section_mapping_id BIGINT IDENTITY(1,1) NOT NULL,
      company_id          BIGINT NOT NULL,
      plant_section_code  NVARCHAR(50) NOT NULL,
      plant_section_name  NVARCHAR(255) NOT NULL,
      section_id           BIGINT NOT NULL,
      status               NVARCHAR(20) NOT NULL,

      CONSTRAINT PK_company_section_mapping PRIMARY KEY CLUSTERED (section_mapping_id),
      CONSTRAINT UQ_company_section_mapping_company_id_plant_section_code UNIQUE (company_id, plant_section_code)
    );
  END;

  IF OBJECT_ID(N'dbo.FK_company_section_mapping_company_company_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.company_section_mapping WITH CHECK
      ADD CONSTRAINT FK_company_section_mapping_company_company_id
      FOREIGN KEY (company_id) REFERENCES dbo.company (company_id);
  END;

  IF OBJECT_ID(N'dbo.FK_company_section_mapping_section_section_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.company_section_mapping WITH CHECK
      ADD CONSTRAINT FK_company_section_mapping_section_section_id
      FOREIGN KEY (section_id) REFERENCES dbo.section (section_id);
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_company_section_mapping_section_id' AND object_id = OBJECT_ID(N'dbo.company_section_mapping'))
  BEGIN
    CREATE INDEX IX_company_section_mapping_section_id ON dbo.company_section_mapping (section_id);
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
