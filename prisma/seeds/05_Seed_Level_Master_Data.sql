/*
Approved Level mock data from the frontend.

Preserves referenced IDs:
- level_id 1: DEV_STAFF -> S1
- level_id 2: DEV_OPERATOR -> O1
*/

USE [TrainingPlanManagementDB];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF COL_LENGTH(N'dbo.employee_level', N'level_key') IS NULL
    THROW 52710, 'Run Migration 13 before the Level seed.', 1;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @LevelSeed TABLE
    (
        level_code NVARCHAR(30) NOT NULL PRIMARY KEY,
        level_code_th NVARCHAR(30) NOT NULL,
        level_code_en NVARCHAR(30) NOT NULL,
        level_name_th NVARCHAR(255) NOT NULL,
        level_name_en NVARCHAR(255) NULL,
        pl NVARCHAR(30) NULL,
        level_key NVARCHAR(30) NOT NULL UNIQUE,
        remark NVARCHAR(500) NULL,
        status NVARCHAR(20) NOT NULL
    );

    INSERT INTO @LevelSeed
    (
        level_code, level_code_th, level_code_en, level_name_th,
        level_name_en, pl, level_key, remark, status
    )
    VALUES
        (N'M4', N'จ', N'M', N'จัดการ4', N'Management4', N'4', N'จ4', NULL, N'ACTIVE'),
        (N'M3', N'จ', N'M', N'จัดการ3', N'Management3', N'3', N'จ3', NULL, N'ACTIVE'),
        (N'M2', N'จ', N'M', N'จัดการ2', N'Management2', N'2', N'จ2', NULL, N'ACTIVE'),
        (N'M1', N'จ', N'M', N'จัดการ1', N'Management1', N'1', N'จ1', NULL, N'ACTIVE'),
        (N'S4', N'บ', N'S', N'บังคับบัญชา4', N'Supervisor4', N'4', N'บ4', NULL, N'ACTIVE'),
        (N'S3', N'บ', N'S', N'บังคับบัญชา3', N'Supervisor3', N'3', N'บ3', NULL, N'ACTIVE'),
        (N'S2', N'บ', N'S', N'บังคับบัญชา2', N'Supervisor2', N'2', N'บ2', NULL, N'ACTIVE'),
        (N'S1', N'บ', N'S', N'บังคับบัญชา1', N'Supervisor1', N'1', N'บ1', NULL, N'ACTIVE'),
        (N'O5', N'ป', N'O', N'ปฏิบัติการ5', N'Operator5', N'5', N'ป5', NULL, N'ACTIVE'),
        (N'O4', N'ป', N'O', N'ปฏิบัติการ4', N'Operator4', N'4', N'ป4', NULL, N'ACTIVE'),
        (N'O3', N'ป', N'O', N'ปฏิบัติการ3', N'Operator3', N'3', N'ป3', NULL, N'ACTIVE'),
        (N'O2', N'ป', N'O', N'ปฏิบัติการ2', N'Operator2', N'2', N'ป2', NULL, N'ACTIVE'),
        (N'O1', N'ป', N'O', N'ปฏิบัติการ1', N'Operator1', N'1', N'ป1', NULL, N'ACTIVE');

    IF EXISTS (SELECT 1 FROM dbo.employee_level WHERE level_id = 1)
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.employee_level WHERE level_code=N'S1' AND level_id<>1)
            THROW 52711, 'S1 is already assigned to another level_id.', 1;

        UPDATE dbo.employee_level
        SET level_code=N'S1', level_code_th=N'บ', level_code_en=N'S',
            level_name_th=N'บังคับบัญชา1', level_name_en=N'Supervisor1',
            pl=N'1', level_key=N'บ1', remark=NULL, status=N'ACTIVE'
        WHERE level_id=1;
    END;

    IF EXISTS (SELECT 1 FROM dbo.employee_level WHERE level_id = 2)
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.employee_level WHERE level_code=N'O1' AND level_id<>2)
            THROW 52712, 'O1 is already assigned to another level_id.', 1;

        UPDATE dbo.employee_level
        SET level_code=N'O1', level_code_th=N'ป', level_code_en=N'O',
            level_name_th=N'ปฏิบัติการ1', level_name_en=N'Operator1',
            pl=N'1', level_key=N'ป1', remark=NULL, status=N'ACTIVE'
        WHERE level_id=2;
    END;

    UPDATE target
    SET target.level_code_th=source.level_code_th,
        target.level_code_en=source.level_code_en,
        target.level_name_th=source.level_name_th,
        target.level_name_en=source.level_name_en,
        target.pl=source.pl,
        target.level_key=source.level_key,
        target.remark=source.remark,
        target.status=source.status
    FROM dbo.employee_level target
    JOIN @LevelSeed source ON source.level_code=target.level_code;

    INSERT INTO dbo.employee_level
    (
        level_code, level_code_th, level_code_en, level_name_th,
        level_name_en, pl, level_key, remark, status
    )
    SELECT source.level_code, source.level_code_th, source.level_code_en,
           source.level_name_th, source.level_name_en, source.pl,
           source.level_key, source.remark, source.status
    FROM @LevelSeed source
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.employee_level target
        WHERE target.level_code=source.level_code
    );

    DELETE target
    FROM dbo.employee_level target
    WHERE target.level_code NOT IN (SELECT level_code FROM @LevelSeed)
      AND NOT EXISTS (SELECT 1 FROM dbo.employee e WHERE e.level_id=target.level_id)
      AND NOT EXISTS (
          SELECT 1 FROM dbo.course_standard_target_level cs
          WHERE cs.level_id=target.level_id
      )
      AND NOT EXISTS (
          SELECT 1 FROM dbo.training_enrollment te
          WHERE te.level_id_snapshot=target.level_id
      );

    IF (SELECT COUNT(*) FROM dbo.employee_level WHERE level_code IN (
        N'M4',N'M3',N'M2',N'M1',N'S4',N'S3',N'S2',N'S1',
        N'O5',N'O4',N'O3',N'O2',N'O1'
    )) <> 13
        THROW 52713, 'Level seed verification failed.', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

SELECT level_id, level_code, level_code_th, level_code_en,
       level_name_th, level_name_en, pl, level_key, remark, status
FROM dbo.employee_level
ORDER BY level_id;
GO
