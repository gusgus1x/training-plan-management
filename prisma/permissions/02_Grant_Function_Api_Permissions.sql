/*
TrainingPlanManagement — Function API least-privilege permissions

CRUD is granted only on the central function and company mapping tables.
Role and company scope remain enforced by the server session in the API.
*/

USE [TrainingPlanManagementDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 52201, 'Wrong database context.', 1;

IF DATABASE_PRINCIPAL_ID(N'training_plan_app') IS NULL
    THROW 52202, 'Database user training_plan_app was not found.', 1;

IF OBJECT_ID(N'dbo.organization_function', N'U') IS NULL
    OR OBJECT_ID(N'dbo.company_function_mapping', N'U') IS NULL
    THROW 52203, 'Required Function tables were not found.', 1;
GO

GRANT SELECT, INSERT, UPDATE, DELETE
ON OBJECT::dbo.organization_function
TO [training_plan_app];

GRANT SELECT, INSERT, UPDATE, DELETE
ON OBJECT::dbo.company_function_mapping
TO [training_plan_app];
GO

SELECT
    OBJECT_NAME(dp.major_id) AS object_name,
    dp.permission_name,
    dp.state_desc
FROM sys.database_permissions AS dp
WHERE dp.grantee_principal_id = DATABASE_PRINCIPAL_ID(N'training_plan_app')
  AND dp.major_id IN
  (
      OBJECT_ID(N'dbo.organization_function'),
      OBJECT_ID(N'dbo.company_function_mapping')
  )
  AND dp.permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE')
ORDER BY object_name, permission_name;
GO
