/*
TrainingPlanManagement — Position API least-privilege permissions.
Role enforcement remains in the API; CRUD is limited to dbo.position.
*/
USE [TrainingPlanManagementDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 52501, 'Wrong database context.', 1;
IF DATABASE_PRINCIPAL_ID(N'training_plan_app') IS NULL
    THROW 52502, 'Database user training_plan_app was not found.', 1;
IF OBJECT_ID(N'dbo.position', N'U') IS NULL
    THROW 52503, 'Required table dbo.position was not found.', 1;
GO

GRANT SELECT, INSERT, UPDATE, DELETE
ON OBJECT::dbo.position
TO [training_plan_app];
GO

SELECT permission_name, state_desc
FROM sys.database_permissions
WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(N'training_plan_app')
  AND major_id = OBJECT_ID(N'dbo.position')
  AND permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE')
ORDER BY permission_name;
GO
