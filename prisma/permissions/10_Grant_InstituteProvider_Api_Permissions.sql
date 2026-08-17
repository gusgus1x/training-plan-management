/*
TrainingPlanManagement — Institute/Provider API least-privilege permissions.
Role enforcement remains in the API; CRUD is limited to dbo.institute_provider.
SELECT/INSERT/UPDATE/DELETE on dbo.training_plan_oap was already granted by
06_Grant_Instructor_Api_Permissions.sql / 07_Grant_TrainingPlanOap_Api_Permissions.sql;
this file only verifies that table exists (needed by the delete-deactivate guard) and
does not re-grant it.
*/
USE [TrainingPlanManagementDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 52901, 'Wrong database context.', 1;
IF DATABASE_PRINCIPAL_ID(N'training_plan_app') IS NULL
    THROW 52902, 'Database user training_plan_app was not found.', 1;
IF OBJECT_ID(N'dbo.institute_provider', N'U') IS NULL
    THROW 52903, 'Required table dbo.institute_provider was not found.', 1;
IF OBJECT_ID(N'dbo.training_plan_oap', N'U') IS NULL
    THROW 52904, 'Required table dbo.training_plan_oap was not found.', 1;
GO

GRANT SELECT, INSERT, UPDATE, DELETE
ON OBJECT::dbo.institute_provider
TO [training_plan_app];
GO

SELECT permission_name, state_desc
FROM sys.database_permissions
WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(N'training_plan_app')
  AND major_id = OBJECT_ID(N'dbo.institute_provider')
  AND permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE')
ORDER BY permission_name;
GO
