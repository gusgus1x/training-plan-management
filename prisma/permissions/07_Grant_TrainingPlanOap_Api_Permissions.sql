/*
TrainingPlanManagement — Training OAP Plan API least-privilege permissions.
Role enforcement remains in the API; CRUD is limited to dbo.training_plan_oap.
06_Grant_Instructor_Api_Permissions.sql already granted SELECT on this table
(read-only, for the instructor-delete guard); this file adds the write grants
the OAP Plan API itself needs.
*/
USE [TrainingPlanManagementDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 52701, 'Wrong database context.', 1;
IF DATABASE_PRINCIPAL_ID(N'training_plan_app') IS NULL
    THROW 52702, 'Database user training_plan_app was not found.', 1;
IF OBJECT_ID(N'dbo.training_plan_oap', N'U') IS NULL
    THROW 52703, 'Required table dbo.training_plan_oap was not found.', 1;
GO

GRANT SELECT, INSERT, UPDATE, DELETE
ON OBJECT::dbo.training_plan_oap
TO [training_plan_app];
GO

SELECT OBJECT_NAME(major_id) AS object_name, permission_name, state_desc
FROM sys.database_permissions
WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(N'training_plan_app')
  AND major_id = OBJECT_ID(N'dbo.training_plan_oap')
  AND permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE')
ORDER BY permission_name;
GO
