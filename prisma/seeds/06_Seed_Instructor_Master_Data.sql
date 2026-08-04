/*
TrainingPlanManagement — approved Instructor mock data.
Seeds only the first Instructor shown in the mock UI.
*/
USE [TrainingPlanManagementDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 52801, 'Wrong database context.', 1;
IF OBJECT_ID(N'dbo.instructor', N'U') IS NULL
    THROW 52802, 'Required table dbo.instructor was not found.', 1;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM dbo.instructor WHERE instructor_code = N'INS0001')
    BEGIN
        UPDATE dbo.instructor
        SET first_name = N'Somchai',
            last_name = N'Prasert',
            telephone = N'081-234-5678',
            email = NULL,
            education = N'M.B.A. Human Resource Management',
            organization_name = NULL,
            status = N'ACTIVE'
        WHERE instructor_code = N'INS0001';
    END
    ELSE
    BEGIN
        INSERT INTO dbo.instructor
            (instructor_code, first_name, last_name, telephone, email,
             education, organization_name, status)
        VALUES
            (N'INS0001', N'Somchai', N'Prasert', N'081-234-5678', NULL,
             N'M.B.A. Human Resource Management', NULL, N'ACTIVE');
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

SELECT instructor_id, instructor_code, first_name, last_name, telephone,
       email, education, organization_name, status
FROM dbo.instructor
WHERE instructor_code = N'INS0001';
GO
