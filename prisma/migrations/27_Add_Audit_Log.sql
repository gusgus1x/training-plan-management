USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
GO

/*
Append-only audit trail (see docs/admin-and-audit-log-plan.md).

Deliberately holds NO foreign keys. The whole point of this table is to survive the rows it
describes: cascadeDeleteTrainingPlans wipes 11 child tables in one transaction, and the
created_by/updated_by stamps on those rows disappear with them. actor_username and entity_label
are snapshots taken at write time so a log line still reads correctly after the account or the
course it names has been deleted.

retain_until is computed by the writer rather than derived at purge time, so the retention rule
(2 years for deletes/PII/admin actions, 90 days for auth events) lives in one place and the purge
job stays a single DELETE ... WHERE retain_until < today.

INSERT/SELECT are granted to training_plan_app in prisma/permissions/15_*.sql; UPDATE and DELETE
are withheld on purpose so the application cannot rewrite its own history.
*/
BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.audit_log', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.audit_log
    (
      audit_log_id   BIGINT          IDENTITY(1, 1) NOT NULL,
      occurred_at    DATETIME2(3)    NOT NULL CONSTRAINT DF_audit_log_occurred_at DEFAULT SYSUTCDATETIME(),
      category       NVARCHAR(20)    NOT NULL,
      action         NVARCHAR(60)    NOT NULL,
      actor_user_id  BIGINT          NULL,
      actor_username NVARCHAR(100)   NULL,
      actor_role     NVARCHAR(30)    NULL,
      entity_type    NVARCHAR(60)    NULL,
      entity_id      NVARCHAR(50)    NULL,
      entity_label   NVARCHAR(255)   NULL,
      detail         NVARCHAR(MAX)   NULL,
      ip_address     NVARCHAR(45)    NULL,
      user_agent     NVARCHAR(400)   NULL,
      retain_until   DATE            NOT NULL,
      CONSTRAINT PK_audit_log PRIMARY KEY CLUSTERED (audit_log_id),
      CONSTRAINT CK_audit_log_category CHECK
        (category IN (N'AUTH', N'PII', N'DELETE', N'ACCOUNT', N'EXPORT'))
    );

    -- Newest-first listing is the default view in the admin log screen.
    CREATE INDEX IX_audit_log_occurred_at ON dbo.audit_log (occurred_at DESC);
    CREATE INDEX IX_audit_log_category_occurred_at ON dbo.audit_log (category, occurred_at DESC);
    CREATE INDEX IX_audit_log_actor_user_id ON dbo.audit_log (actor_user_id);
    -- Drives the retention purge.
    CREATE INDEX IX_audit_log_retain_until ON dbo.audit_log (retain_until);
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
