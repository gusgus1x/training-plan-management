/*
TrainingPlanManagement — Enrollment & Attendance API least-privilege permissions.
Role enforcement remains in the API; CRUD is limited to dbo.training_enrollment
and dbo.attendance. training_plan_app currently has SELECT only on
training_enrollment and no grant at all on attendance.
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
IF OBJECT_ID(N'dbo.training_enrollment', N'U') IS NULL
    THROW 52903, 'Required table dbo.training_enrollment was not found.', 1;
IF OBJECT_ID(N'dbo.attendance', N'U') IS NULL
    THROW 52904, 'Required table dbo.attendance was not found.', 1;
GO

GRANT SELECT, INSERT, UPDATE, DELETE
ON OBJECT::dbo.training_enrollment
TO [training_plan_app];
GO

GRANT SELECT, INSERT, UPDATE, DELETE
ON OBJECT::dbo.attendance
TO [training_plan_app];
GO

SELECT OBJECT_NAME(major_id) AS object_name, permission_name, state_desc
FROM sys.database_permissions
WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(N'training_plan_app')
  AND major_id IN (OBJECT_ID(N'dbo.training_enrollment'), OBJECT_ID(N'dbo.attendance'))
  AND permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE')
ORDER BY object_name, permission_name;
GO
