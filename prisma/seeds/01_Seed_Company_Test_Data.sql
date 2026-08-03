/*
TrainingPlanManagement — approved company test data

Idempotent behavior:
- Preserve existing company_id values and foreign keys.
- Update the six approved company codes when they already exist.
- Insert a code only when it is missing.
*/

USE [TrainingPlanManagementDB];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 52101, 'Wrong database context.', 1;

IF OBJECT_ID(N'dbo.company', N'U') IS NULL
    THROW 52102, 'Required table dbo.company was not found.', 1;
GO

DECLARE @Companies TABLE
(
    company_code NVARCHAR(30) NOT NULL PRIMARY KEY,
    company_name_th NVARCHAR(255) NOT NULL,
    company_name_en NVARCHAR(255) NULL,
    remark NVARCHAR(500) NULL,
    status NVARCHAR(20) NOT NULL
);

INSERT INTO @Companies
(
    company_code,
    company_name_th,
    company_name_en,
    remark,
    status
)
VALUES
    (N'ATA',  N'บริษัท ไอซิน ทาคาโอกะ เอเชีย จำกัด',               N'Aisin Takaoka Asia Co., Ltd.',                 NULL, N'ACTIVE'),
    (N'TEP',  N'บริษัท ไทย เอ็นจิเนียริ่ง โปรดักส์ จำกัด',          N'Thai Engineering Products Co., Ltd.',          NULL, N'ACTIVE'),
    (N'ATFB', N'บริษัท ไอซิน ทาคาโอกะ ฟาวดรี บางปะกง จำกัด',       N'Aisin Takaoka Foundry Bangpakong Co., Ltd.',   NULL, N'ACTIVE'),
    (N'NIC',  N'บริษัท เดอะ นวโลหะ อินดัสตรี จำกัด',                N'The Nawaloha Industry Co., Ltd.',               NULL, N'ACTIVE'),
    (N'SATI', N'บริษัท สยาม เอที อินดัสทรี จำกัด',                   N'Siam AT Industry Co., Ltd.',                    NULL, N'ACTIVE'),
    (N'SNF',  N'บริษัท เดอะ สยาม นวโลหะ ฟาวน์ดรี จำกัด',           N'The Siam Nawaloha Foundry Co., Ltd.',           NULL, N'ACTIVE');

BEGIN TRY
    BEGIN TRANSACTION;

    UPDATE target
    SET
        target.company_name_th = source.company_name_th,
        target.company_name_en = source.company_name_en,
        target.remark = source.remark,
        target.status = source.status
    FROM dbo.company AS target
    INNER JOIN @Companies AS source
        ON source.company_code = target.company_code;

    INSERT INTO dbo.company
    (
        company_code,
        company_name_th,
        company_name_en,
        remark,
        status
    )
    SELECT
        source.company_code,
        source.company_name_th,
        source.company_name_en,
        source.remark,
        source.status
    FROM @Companies AS source
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM dbo.company AS target WITH (UPDLOCK, HOLDLOCK)
        WHERE target.company_code = source.company_code
    );

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
GO

SELECT
    company_id,
    company_code,
    company_name_th,
    company_name_en,
    remark,
    status
FROM dbo.company
WHERE company_code IN (N'ATA', N'TEP', N'ATFB', N'NIC', N'SATI', N'SNF')
ORDER BY company_id;
GO
