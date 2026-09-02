USE [TrainingPlanManagementDB];
GO

/*
audit_log is append-only by grant, not by application code: training_plan_app gets INSERT and
SELECT and nothing else. Without UPDATE or DELETE the application physically cannot rewrite or
erase its own audit trail, which is the property that makes the log worth trusting.

Consequence to keep in mind: scripts/purge-audit-log.mjs therefore cannot run under the app
login. The retention purge must run under a separate database account (SQL Server Agent job or a
manual run). That is intended, not an oversight.

Table-level grants are used here rather than the column-level style applied to dbo.employee,
because every column in this table is written and read together and none of it is PII belonging
to an employee record.
*/

IF USER_ID(N'training_plan_app') IS NULL
    THROW 52901, 'Database user training_plan_app was not found.', 1;
IF OBJECT_ID(N'dbo.audit_log', N'U') IS NULL
    THROW 52902, 'Run Migration 27 before the audit log grant.', 1;
GO

GRANT SELECT ON dbo.audit_log TO training_plan_app;
GRANT INSERT ON dbo.audit_log TO training_plan_app;
GO

-- Belt and braces: an explicit DENY survives the account later being added to a broader role.
DENY UPDATE ON dbo.audit_log TO training_plan_app;
DENY DELETE ON dbo.audit_log TO training_plan_app;
GO
