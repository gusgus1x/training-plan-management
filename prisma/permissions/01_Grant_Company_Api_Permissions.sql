/*
TrainingPlanManagement — Company API least-privilege permissions

Run with an approved database administrator account.
This grants CRUD only on dbo.company. It does not grant db_datawriter or db_owner.
*/

USE [TrainingPlanManagementDB];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 52001, 'Wrong database context.', 1;

IF DATABASE_PRINCIPAL_ID(N'training_plan_app') IS NULL
    THROW 52002, 'Database user training_plan_app was not found.', 1;

IF OBJECT_ID(N'dbo.company', N'U') IS NULL
    THROW 52003, 'Required table dbo.company was not found.', 1;
GO

GRANT SELECT, INSERT, UPDATE, DELETE
ON OBJECT::dbo.company
TO [training_plan_app];
GO

SELECT
    USER_NAME(dp.grantee_principal_id) AS grantee,
    dp.state_desc,
    dp.permission_name,
    OBJECT_SCHEMA_NAME(dp.major_id) AS schema_name,
    OBJECT_NAME(dp.major_id) AS object_name
FROM sys.database_permissions AS dp
WHERE dp.grantee_principal_id = DATABASE_PRINCIPAL_ID(N'training_plan_app')
  AND dp.major_id = OBJECT_ID(N'dbo.company')
  AND dp.permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE')
ORDER BY dp.permission_name;
GO
