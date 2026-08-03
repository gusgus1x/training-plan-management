/*
TrainingPlanManagement — approved FNC0001-FNC0017 central functions

Idempotent behavior:
- Preserve function_id 1 by converting DEV_HR to FNC0004.
- Preserve function_id 2 by converting DEV_PRODUCTION to FNC0010.
- Preserve all existing foreign-key references and company mappings.
- Update approved codes and insert only missing codes.
*/

USE [TrainingPlanManagementDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 52301, 'Wrong database context.', 1;

IF OBJECT_ID(N'dbo.organization_function', N'U') IS NULL
    THROW 52302, 'Required table dbo.organization_function was not found.', 1;
GO

DECLARE @Functions TABLE
(
    function_code NVARCHAR(30) NOT NULL PRIMARY KEY,
    function_name_th NVARCHAR(255) NOT NULL,
    function_name_en NVARCHAR(255) NULL,
    status NVARCHAR(20) NOT NULL
);

INSERT INTO @Functions
    (function_code, function_name_th, function_name_en, status)
VALUES
    (N'FNC0001', N'การขาย', NULL, N'ACTIVE'),
    (N'FNC0002', N'วางแผนการขาย', N'Sale Planing', N'ACTIVE'),
    (N'FNC0003', N'บัญชีและการเงิน', N'Account and Financial', N'ACTIVE'),
    (N'FNC0004', N'ทรัพยากรมนุษย์', N'Human Resource', N'ACTIVE'),
    (N'FNC0005', N'ธุรการ', NULL, N'ACTIVE'),
    (N'FNC0006', N'ล่ามและเลขานุการ', NULL, N'ACTIVE'),
    (N'FNC0007', N'จัดซื้อ', N'Purchase', N'ACTIVE'),
    (N'FNC0008', N'เทคโนโลยีสารสนเทศ', N'IT Promotion', N'ACTIVE'),
    (N'FNC0009', N'คลังสินค้า', NULL, N'ACTIVE'),
    (N'FNC0010', N'ผลิต', N'Production', N'ACTIVE'),
    (N'FNC0011', N'วางแผนการผลิต', N'Production Planing', N'ACTIVE'),
    (N'FNC0012', N'วิศวกรรมและซ่อมบำรุง', N'Engineering and Maintenance', N'ACTIVE'),
    (N'FNC0013', N'คุณภาพ', N'Quality', N'ACTIVE'),
    (N'FNC0014', N'ความปลอดภัยและสิ่งแวดล้อม', N'Safety and Environment', N'ACTIVE'),
    (N'FNC0015', N'วิศวกรรมโครงการ', N'Project Engineering', N'ACTIVE'),
    (N'FNC0016', N'สำนักงานกรรมการผู้จัดการ', N'President Office', N'ACTIVE'),
    (N'FNC0017', N'อื่นๆ', N'Other', N'ACTIVE');

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS
    (
        SELECT 1 FROM dbo.organization_function
        WHERE function_code = N'DEV_HR'
    )
    BEGIN
        IF EXISTS
        (
            SELECT 1 FROM dbo.organization_function
            WHERE function_code = N'FNC0004'
        )
            THROW 52303, 'Both DEV_HR and FNC0004 exist; manual reconciliation is required.', 1;

        UPDATE dbo.organization_function
        SET
            function_code = N'FNC0004',
            function_name_th = N'ทรัพยากรมนุษย์',
            function_name_en = N'Human Resource',
            status = N'ACTIVE'
        WHERE function_code = N'DEV_HR';
    END;

    IF EXISTS
    (
        SELECT 1 FROM dbo.organization_function
        WHERE function_code = N'DEV_PRODUCTION'
    )
    BEGIN
        IF EXISTS
        (
            SELECT 1 FROM dbo.organization_function
            WHERE function_code = N'FNC0010'
        )
            THROW 52304, 'Both DEV_PRODUCTION and FNC0010 exist; manual reconciliation is required.', 1;

        UPDATE dbo.organization_function
        SET
            function_code = N'FNC0010',
            function_name_th = N'ผลิต',
            function_name_en = N'Production',
            status = N'ACTIVE'
        WHERE function_code = N'DEV_PRODUCTION';
    END;

    UPDATE target
    SET
        target.function_name_th = source.function_name_th,
        target.function_name_en = source.function_name_en,
        target.status = source.status
    FROM dbo.organization_function AS target
    INNER JOIN @Functions AS source
        ON source.function_code = target.function_code;

    INSERT INTO dbo.organization_function
        (function_code, function_name_th, function_name_en, status)
    SELECT
        source.function_code,
        source.function_name_th,
        source.function_name_en,
        source.status
    FROM @Functions AS source
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM dbo.organization_function AS target WITH (UPDLOCK, HOLDLOCK)
        WHERE target.function_code = source.function_code
    );

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

SELECT
    function_id,
    function_code,
    function_name_th,
    function_name_en,
    status
FROM dbo.organization_function
WHERE function_code LIKE N'FNC00%'
ORDER BY function_code;
GO
