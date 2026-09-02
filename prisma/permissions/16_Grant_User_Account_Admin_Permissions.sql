USE [TrainingPlanManagementDB];
GO

/*
Account administration (phase 4 of docs/admin-and-audit-log-plan.md).

Until now the application only ever read dbo.user_account to sign people in, so it holds
column-level SELECT on eight columns and nothing else. Managing accounts in the app needs INSERT
and a narrow UPDATE, plus SELECT on the two columns the admin screen shows but login never needed.

Deliberately NOT granted:
  - DELETE. Accounts are disabled by setting status, never removed, so the audit trail and every
    created_by/updated_by reference pointing at them stays readable.
  - UPDATE on user_id and created_at. Identity and creation time are not editable.

dbo.role gains SELECT on role_name and description so the admin screen can present roles by name
rather than by code alone.
*/

IF USER_ID(N'training_plan_app') IS NULL
    THROW 53001, 'Database user training_plan_app was not found.', 1;
IF OBJECT_ID(N'dbo.user_account', N'U') IS NULL
    THROW 53002, 'Table dbo.user_account was not found.', 1;
GO

GRANT SELECT ON dbo.user_account (last_login_at) TO training_plan_app;
GRANT SELECT ON dbo.user_account (created_at) TO training_plan_app;
GO

GRANT INSERT ON dbo.user_account TO training_plan_app;
GO

GRANT UPDATE ON dbo.user_account (role_id) TO training_plan_app;
GRANT UPDATE ON dbo.user_account (company_id) TO training_plan_app;
GRANT UPDATE ON dbo.user_account (employee_id) TO training_plan_app;
GRANT UPDATE ON dbo.user_account (email) TO training_plan_app;
GRANT UPDATE ON dbo.user_account (status) TO training_plan_app;
GRANT UPDATE ON dbo.user_account (password_hash) TO training_plan_app;
GRANT UPDATE ON dbo.user_account (last_login_at) TO training_plan_app;
GO

DENY DELETE ON dbo.user_account TO training_plan_app;
GO

GRANT SELECT ON dbo.role (role_name) TO training_plan_app;
GRANT SELECT ON dbo.role (description) TO training_plan_app;
GO
