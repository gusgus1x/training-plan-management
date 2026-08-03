/*
TrainingPlanManagement — remove the approved development-only Function mappings.

The application now uses the shared FNC0001-FNC0017 catalog directly.
This script does not delete companies, functions, employees, or requests.
*/

USE [TrainingPlanManagementDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 52401, 'Wrong database context.', 1;

IF OBJECT_ID(N'dbo.company_function_mapping', N'U') IS NULL
    THROW 52402, 'Required table dbo.company_function_mapping was not found.', 1;
GO

DECLARE @ApprovedCodes TABLE
(
    plant_function_code NVARCHAR(50) NOT NULL PRIMARY KEY
);

INSERT INTO @ApprovedCodes (plant_function_code)
VALUES
    (N'ATA-HRD-DEV'),
    (N'ATA-PROD-DEV'),
    (N'TEP-HRD-DEV'),
    (N'TEP-PROD-DEV'),
    (N'ATFB-HRD-DEV'),
    (N'ATFB-PROD-DEV'),
    (N'NIC-HRD-DEV'),
    (N'NIC-PROD-DEV'),
    (N'SATI-HRD-DEV'),
    (N'SATI-PROD-DEV'),
    (N'SNF-HRD-DEV'),
    (N'SNF-PROD-DEV');

BEGIN TRY
    BEGIN TRANSACTION;

    DELETE mapping
    FROM dbo.company_function_mapping AS mapping
    INNER JOIN @ApprovedCodes AS approved
        ON approved.plant_function_code = mapping.plant_function_code;

    DECLARE @DeletedRows INT = @@ROWCOUNT;

    COMMIT TRANSACTION;

    SELECT @DeletedRows AS deleted_mapping_rows;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

SELECT COUNT(*) AS remaining_mapping_rows
FROM dbo.company_function_mapping;
GO
