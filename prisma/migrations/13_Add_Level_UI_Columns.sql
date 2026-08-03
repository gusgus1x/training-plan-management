/*
TrainingPlanManagement
Migration 13: Add Level UI columns

Approved additions to dbo.employee_level:
- level_code_th
- level_code_en
- level_key
- remark

Run once with an administrator account. Do not run as training_plan_app.
*/

USE [TrainingPlanManagementDB];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 51300, 'Wrong database context.', 1;

IF OBJECT_ID(N'dbo.employee_level', N'U') IS NULL
    THROW 51301, 'Required table dbo.employee_level was not found.', 1;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH(N'dbo.employee_level', N'level_code_th') IS NULL
        ALTER TABLE dbo.employee_level ADD level_code_th NVARCHAR(30) NULL;

    IF COL_LENGTH(N'dbo.employee_level', N'level_code_en') IS NULL
        ALTER TABLE dbo.employee_level ADD level_code_en NVARCHAR(30) NULL;

    IF COL_LENGTH(N'dbo.employee_level', N'level_key') IS NULL
        ALTER TABLE dbo.employee_level ADD level_key NVARCHAR(30) NULL;

    IF COL_LENGTH(N'dbo.employee_level', N'remark') IS NULL
        ALTER TABLE dbo.employee_level ADD remark NVARCHAR(500) NULL;

    EXEC sys.sp_executesql N'
        UPDATE dbo.employee_level
        SET level_code_th = COALESCE(level_code_th, level_code),
            level_code_en = COALESCE(level_code_en, level_code),
            level_key = COALESCE(level_key, level_code);

        IF EXISTS (
            SELECT 1
            FROM dbo.employee_level
            WHERE level_code_th IS NULL
               OR level_code_en IS NULL
               OR level_key IS NULL
        )
            THROW 51302, ''Level UI columns could not be backfilled.'', 1;

        ALTER TABLE dbo.employee_level
            ALTER COLUMN level_code_th NVARCHAR(30) NOT NULL;
        ALTER TABLE dbo.employee_level
            ALTER COLUMN level_code_en NVARCHAR(30) NOT NULL;
        ALTER TABLE dbo.employee_level
            ALTER COLUMN level_key NVARCHAR(30) NOT NULL;
    ';

    IF NOT EXISTS (
        SELECT 1
        FROM sys.key_constraints
        WHERE parent_object_id = OBJECT_ID(N'dbo.employee_level')
          AND name = N'UQ_employee_level_level_key'
    )
        ALTER TABLE dbo.employee_level
        ADD CONSTRAINT UQ_employee_level_level_key UNIQUE (level_key);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

IF COL_LENGTH(N'dbo.employee_level', N'level_code_th') IS NULL
   OR COL_LENGTH(N'dbo.employee_level', N'level_code_en') IS NULL
   OR COL_LENGTH(N'dbo.employee_level', N'level_key') IS NULL
   OR COL_LENGTH(N'dbo.employee_level', N'remark') IS NULL
    THROW 51303, 'Migration 13 verification failed.', 1;

PRINT 'Migration 13 completed: Level UI columns added and verified.';
GO
