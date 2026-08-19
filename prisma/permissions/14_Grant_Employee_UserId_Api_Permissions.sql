USE [TrainingPlanManagementDB];
GO

/*
dbo.employee uses column-level GRANTs (05_Grant_Employee_Api_Permissions.sql), not a blanket
table-level grant — so the user_id column added in migration 25 was never covered and needs its
own explicit grant, same as every other column on this table.
*/

IF USER_ID(N'training_plan_app') IS NULL
    THROW 52801, 'Database user training_plan_app was not found.', 1;
IF COL_LENGTH(N'dbo.employee', N'user_id') IS NULL
    THROW 52802, 'Required column dbo.employee.user_id was not found.', 1;
GO

GRANT SELECT ON dbo.employee (user_id) TO training_plan_app;
GRANT UPDATE ON dbo.employee (user_id) TO training_plan_app;
GO
