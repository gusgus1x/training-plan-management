/*
TrainingPlanManagement — Company Division/Department/Section mapping API least-privilege
permissions. Role enforcement remains in the API; CRUD is limited to the three mapping tables
added in migration 22.
*/
USE [TrainingPlanManagementDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 53201, 'Wrong database context.', 1;
IF DATABASE_PRINCIPAL_ID(N'training_plan_app') IS NULL
    THROW 53202, 'Database user training_plan_app was not found.', 1;
IF OBJECT_ID(N'dbo.company_division_mapping', N'U') IS NULL
    THROW 53203, 'Required table dbo.company_division_mapping was not found.', 1;
IF OBJECT_ID(N'dbo.company_department_mapping', N'U') IS NULL
    THROW 53204, 'Required table dbo.company_department_mapping was not found.', 1;
IF OBJECT_ID(N'dbo.company_section_mapping', N'U') IS NULL
    THROW 53205, 'Required table dbo.company_section_mapping was not found.', 1;
GO

GRANT SELECT, INSERT, UPDATE, DELETE
ON OBJECT::dbo.company_division_mapping
TO [training_plan_app];
GO

GRANT SELECT, INSERT, UPDATE, DELETE
ON OBJECT::dbo.company_department_mapping
TO [training_plan_app];
GO

GRANT SELECT, INSERT, UPDATE, DELETE
ON OBJECT::dbo.company_section_mapping
TO [training_plan_app];
GO

SELECT major_id, permission_name, state_desc
FROM sys.database_permissions
WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(N'training_plan_app')
  AND major_id IN (
    OBJECT_ID(N'dbo.company_division_mapping'),
    OBJECT_ID(N'dbo.company_department_mapping'),
    OBJECT_ID(N'dbo.company_section_mapping')
  )
  AND permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE')
ORDER BY major_id, permission_name;
GO
