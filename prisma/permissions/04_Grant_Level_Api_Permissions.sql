/*
Least-privilege permissions for the Level API.
*/

USE [TrainingPlanManagementDB];
GO

IF USER_ID(N'training_plan_app') IS NULL
    THROW 52700, 'Database user training_plan_app was not found.', 1;

GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.employee_level
TO training_plan_app;
GO
