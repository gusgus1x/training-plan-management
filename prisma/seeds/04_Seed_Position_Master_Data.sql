/*
TrainingPlanManagement — approved Position mock data.

Preserves position_id 1 and 2 and therefore all employee foreign keys:
- DEV_HRD_OFFICER -> OFFICE
- DEV_OPERATOR -> OP
*/
USE [TrainingPlanManagementDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 52601, 'Wrong database context.', 1;
IF OBJECT_ID(N'dbo.position', N'U') IS NULL
    THROW 52602, 'Required table dbo.position was not found.', 1;
GO

DECLARE @Positions TABLE
(
    position_code NVARCHAR(30) NOT NULL PRIMARY KEY,
    position_name_th NVARCHAR(255) NOT NULL,
    position_name_en NVARCHAR(255) NULL,
    status NVARCHAR(20) NOT NULL
);

INSERT INTO @Positions
    (position_code, position_name_th, position_name_en, status)
VALUES
    (N'MGR', N'ผู้จัดการ++', N'Manager++', N'ACTIVE'),
    (N'SH', N'ผู้จัดการแผนก', N'Section Head', N'ACTIVE'),
    (N'ENG', N'วิศวกร', N'Engineer', N'ACTIVE'),
    (N'FM', N'โฟร์แมน', N'Foreman', N'ACTIVE'),
    (N'LD', N'ลีดเดอร์', N'Leader', N'ACTIVE'),
    (N'OP', N'พนักงานปฏิบัติการ', N'Operator', N'ACTIVE'),
    (N'OFFICE', N'เจ้าหน้าที่', N'Supervisor', N'ACTIVE'),
    (N'STAFF', N'พนักงานปฏิบัติการ', N'Staff', N'ACTIVE');

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM dbo.position WHERE position_code = N'DEV_HRD_OFFICER')
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.position WHERE position_code = N'OFFICE')
            THROW 52603, 'Both DEV_HRD_OFFICER and OFFICE exist.', 1;
        UPDATE dbo.position
        SET position_code=N'OFFICE',
            position_name_th=N'เจ้าหน้าที่',
            position_name_en=N'Supervisor',
            status=N'ACTIVE'
        WHERE position_code=N'DEV_HRD_OFFICER';
    END;

    IF EXISTS (SELECT 1 FROM dbo.position WHERE position_code = N'DEV_OPERATOR')
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.position WHERE position_code = N'OP')
            THROW 52604, 'Both DEV_OPERATOR and OP exist.', 1;
        UPDATE dbo.position
        SET position_code=N'OP',
            position_name_th=N'พนักงานปฏิบัติการ',
            position_name_en=N'Operator',
            status=N'ACTIVE'
        WHERE position_code=N'DEV_OPERATOR';
    END;

    UPDATE target
    SET target.position_name_th=source.position_name_th,
        target.position_name_en=source.position_name_en,
        target.status=source.status
    FROM dbo.position AS target
    INNER JOIN @Positions AS source
        ON source.position_code=target.position_code;

    INSERT INTO dbo.position
        (position_code, position_name_th, position_name_en, status)
    SELECT source.position_code,
           source.position_name_th,
           source.position_name_en,
           source.status
    FROM @Positions AS source
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM dbo.position AS target WITH (UPDLOCK, HOLDLOCK)
        WHERE target.position_code=source.position_code
    );

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

SELECT position_id, position_code, position_name_th, position_name_en, status
FROM dbo.position
WHERE position_code IN
    (N'MGR',N'SH',N'ENG',N'FM',N'LD',N'OP',N'OFFICE',N'STAFF')
ORDER BY position_id;
GO
