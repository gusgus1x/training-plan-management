USE [TrainingPlanManagementDB];
GO

/*
Phase 20 Stage 3 — column-level GRANTs for the employee_user_id links added in migration 28.

dbo.employee uses column-level GRANTs (05_Grant_Employee_Api_Permissions.sql), so a new column
there is invisible to training_plan_app until it is named explicitly — that is why migration 25's
user_id needed 14_Grant_Employee_UserId_Api_Permissions.sql of its own. The five child tables are
granted at table level, so their new column is already covered; the SELECT/UPDATE below are
written anyway so this file states the whole permission surface of the change in one place, and
they are harmless where a table-level grant already implies them.

A missing grant does not fail a build or a type check. It fails at runtime, as a permission error
on whichever request happens to touch the column first.

Run after: prisma/migrations/28_Child_Tables_Employee_User_Id.sql
*/

IF USER_ID(N'training_plan_app') IS NULL
    THROW 52901, 'Database user training_plan_app was not found.', 1;

IF COL_LENGTH(N'dbo.training_enrollment', N'employee_user_id') IS NULL
    THROW 52902, 'Required column dbo.training_enrollment.employee_user_id was not found - run migration 28 first.', 1;
GO

-- employee.user_id is now read as a business key, not merely stored.
GRANT SELECT ON dbo.employee (user_id) TO training_plan_app;
GRANT UPDATE ON dbo.employee (user_id) TO training_plan_app;
GO

GRANT SELECT, UPDATE ON dbo.training_enrollment (employee_user_id) TO training_plan_app;
GRANT SELECT, UPDATE ON dbo.training_need_request (employee_user_id) TO training_plan_app;
GRANT SELECT, UPDATE ON dbo.training_record_request (employee_user_id) TO training_plan_app;
GRANT SELECT, UPDATE ON dbo.training_certificate_file (employee_user_id) TO training_plan_app;
GRANT SELECT, UPDATE ON dbo.user_account (employee_user_id) TO training_plan_app;
GO
