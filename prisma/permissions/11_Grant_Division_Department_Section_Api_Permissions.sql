/*
TrainingPlanManagement — Division / Department / Section API least-privilege permissions.
Role enforcement remains in the API; CRUD is limited to dbo.division, dbo.department, dbo.section.
These tables and their backend CRUD modules (app/lib/{divisions,departments,sections}) already
existed from migration 18, but no grant file was ever added for training_plan_app — this closes
that gap, and is required before Course Standard's new division/department/section targeting
(migration 20) can read them.
*/
USE [TrainingPlanManagementDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 53101, 'Wrong database context.', 1;
IF DATABASE_PRINCIPAL_ID(N'training_plan_app') IS NULL
    THROW 53102, 'Database user training_plan_app was not found.', 1;
IF OBJECT_ID(N'dbo.division', N'U') IS NULL
    THROW 53103, 'Required table dbo.division was not found.', 1;
IF OBJECT_ID(N'dbo.department', N'U') IS NULL
    THROW 53104, 'Required table dbo.department was not found.', 1;
IF OBJECT_ID(N'dbo.section', N'U') IS NULL
    THROW 53105, 'Required table dbo.section was not found.', 1;
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.division TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.department TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.section TO [training_plan_app];
GO

SELECT OBJECT_NAME(major_id) AS object_name, permission_name, state_desc
FROM sys.database_permissions
WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(N'training_plan_app')
  AND major_id IN (OBJECT_ID(N'dbo.division'), OBJECT_ID(N'dbo.department'), OBJECT_ID(N'dbo.section'))
  AND permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE')
ORDER BY object_name, permission_name;
GO
