/*
TrainingPlanManagement — ADMIN role (see docs/admin-and-audit-log-plan.md)

The system administrator is deliberately a different person from HRD Center: it manages user
accounts, roles and the audit log, and does no HRD business work. It is not granted access to any
existing endpoint here — every route lists its own allowedRoles, so a brand new role code is
refused everywhere until it is named explicitly. That default is the point.

Idempotent: inserts the row only when the role_code is absent, and leaves an existing row's
role_id untouched so user_account.role_id references keep working.
*/

USE [TrainingPlanManagementDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 52801, 'Wrong database context.', 1;

IF OBJECT_ID(N'dbo.role', N'U') IS NULL
    THROW 52802, 'Table dbo.role was not found.', 1;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM dbo.role WHERE role_code = N'ADMIN')
    BEGIN
        INSERT INTO dbo.role (role_code, role_name, description, status)
        VALUES (
            N'ADMIN',
            N'System Administrator',
            N'Manages user accounts, role assignment and the audit log. No access to training data and no National ID reveal.',
            N'ACTIVE'
        );
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.role WHERE role_code = N'ADMIN' AND status = N'ACTIVE')
        THROW 52803, 'ADMIN role seed verification failed.', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

SELECT role_id, role_code, role_name, status
FROM dbo.role
ORDER BY role_id;
GO
