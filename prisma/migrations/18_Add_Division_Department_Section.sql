USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.division', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.division
    (
      division_id      BIGINT IDENTITY(1,1) NOT NULL,
      division_code    NVARCHAR(30) NOT NULL,
      division_name_th NVARCHAR(255) NOT NULL,
      division_name_en NVARCHAR(255) NULL,
      status           NVARCHAR(20) NOT NULL,

      CONSTRAINT PK_division PRIMARY KEY CLUSTERED (division_id),
      CONSTRAINT UQ_division_division_code UNIQUE (division_code)
    );
  END;

  IF OBJECT_ID(N'dbo.department', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.department
    (
      department_id      BIGINT IDENTITY(1,1) NOT NULL,
      department_code    NVARCHAR(30) NOT NULL,
      department_name_th NVARCHAR(255) NOT NULL,
      department_name_en NVARCHAR(255) NULL,
      status              NVARCHAR(20) NOT NULL,

      CONSTRAINT PK_department PRIMARY KEY CLUSTERED (department_id),
      CONSTRAINT UQ_department_department_code UNIQUE (department_code)
    );
  END;

  IF OBJECT_ID(N'dbo.section', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.section
    (
      section_id      BIGINT IDENTITY(1,1) NOT NULL,
      section_code    NVARCHAR(30) NOT NULL,
      section_name_th NVARCHAR(255) NOT NULL,
      section_name_en NVARCHAR(255) NULL,
      status          NVARCHAR(20) NOT NULL,

      CONSTRAINT PK_section PRIMARY KEY CLUSTERED (section_id),
      CONSTRAINT UQ_section_section_code UNIQUE (section_code)
    );
  END;

  IF COL_LENGTH(N'dbo.employee', N'division_id') IS NULL
  BEGIN
    ALTER TABLE dbo.employee ADD division_id BIGINT NULL;
  END;

  IF COL_LENGTH(N'dbo.employee', N'department_id') IS NULL
  BEGIN
    ALTER TABLE dbo.employee ADD department_id BIGINT NULL;
  END;

  IF COL_LENGTH(N'dbo.employee', N'section_id') IS NULL
  BEGIN
    ALTER TABLE dbo.employee ADD section_id BIGINT NULL;
  END;

  IF OBJECT_ID(N'dbo.FK_employee_division_division_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.employee WITH CHECK
      ADD CONSTRAINT FK_employee_division_division_id
      FOREIGN KEY (division_id) REFERENCES dbo.division (division_id);
  END;

  IF OBJECT_ID(N'dbo.FK_employee_department_department_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.employee WITH CHECK
      ADD CONSTRAINT FK_employee_department_department_id
      FOREIGN KEY (department_id) REFERENCES dbo.department (department_id);
  END;

  IF OBJECT_ID(N'dbo.FK_employee_section_section_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.employee WITH CHECK
      ADD CONSTRAINT FK_employee_section_section_id
      FOREIGN KEY (section_id) REFERENCES dbo.section (section_id);
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_employee_division_id' AND object_id = OBJECT_ID(N'dbo.employee'))
  BEGIN
    CREATE INDEX IX_employee_division_id ON dbo.employee (division_id);
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_employee_department_id' AND object_id = OBJECT_ID(N'dbo.employee'))
  BEGIN
    CREATE INDEX IX_employee_department_id ON dbo.employee (department_id);
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_employee_section_id' AND object_id = OBJECT_ID(N'dbo.employee'))
  BEGIN
    CREATE INDEX IX_employee_section_id ON dbo.employee (section_id);
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
