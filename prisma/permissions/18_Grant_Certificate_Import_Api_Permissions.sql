/*
TrainingPlanManagement — Certificate Import API least-privilege permissions.

V6.2 Migration 12 (12_Add_Certificate_Import_Tables.sql) created certificate_import_batch and
training_certificate_file but deliberately withheld write permissions, closing with:
  "Do NOT grant INSERT/UPDATE/DELETE to training_plan_app yet unless the Certificate Import API
   is ready and approved."
That API is now built (app/lib/certificates/*, app/api/.../certificates/*). This script is that
approval.

Before it, training_plan_app held exactly one grant on either table -- the column-level
  GRANT SELECT, UPDATE ON dbo.training_certificate_file (employee_user_id)
from 15_Grant_Employee_User_Id_Link_Permissions.sql, added for the employee_id -> user_id
migration. A column-level grant does not permit INSERT.

Scope:
  - Full CRUD on both tables. INSERT/UPDATE are the upload and confirm paths; DELETE is needed by
    two flows: discarding a draft batch, and the plan cascade-delete in app/lib/trainingPlanCascade.ts
    (certificate rows must be removed before the batch they point at, since
    training_certificate_file.certificate_import_batch_id is NOT NULL).
  - Nothing else. The API reads training_plan / training_enrollment / training_result / employee
    through grants that already exist.

WHEN THE GRANT IS SKIPPED
SQL Server refuses "grant to sa, dbo, entity owner, information_schema, sys, or yourself". If
training_plan_app is dbo, owns these tables, or is the account running this script, the GRANT is
both impossible and unnecessary -- such a principal already has full rights. This script detects
that, says so, and exits cleanly rather than failing halfway. Re-run it after a DBA strips
db_owner / ownership, which is when the grants start to matter.

Safe to run more than once.
*/
USE [TrainingPlanManagementDB];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 53001, 'Wrong database context.', 1;
IF DATABASE_PRINCIPAL_ID(N'training_plan_app') IS NULL
    THROW 53002, 'Database user training_plan_app was not found.', 1;
IF OBJECT_ID(N'dbo.certificate_import_batch', N'U') IS NULL
    THROW 53003, 'Required table dbo.certificate_import_batch was not found. Run V6.2 Migration 12 first.', 1;
IF OBJECT_ID(N'dbo.training_certificate_file', N'U') IS NULL
    THROW 53004, 'Required table dbo.training_certificate_file was not found. Run V6.2 Migration 12 first.', 1;
GO

DECLARE @grantee sysname = N'training_plan_app';
DECLARE @granteeId int = DATABASE_PRINCIPAL_ID(@grantee);
DECLARE @skipReason nvarchar(300) = NULL;

IF @granteeId = 1 OR @grantee = N'dbo'
    SET @skipReason = N'training_plan_app IS dbo in this database.';
ELSE IF USER_NAME() = @grantee
    SET @skipReason = N'this script is being run AS training_plan_app; SQL Server will not let a principal grant to itself. Reconnect as an admin (Windows Authentication / sa) and run it again.';
ELSE IF EXISTS (
        SELECT 1
        FROM sys.objects AS o
        WHERE o.name IN (N'certificate_import_batch', N'training_certificate_file')
          AND o.principal_id = @granteeId)
    SET @skipReason = N'training_plan_app owns these tables, so it already holds every permission on them.';
ELSE IF EXISTS (
        SELECT 1
        FROM sys.database_role_members AS m
        JOIN sys.database_principals AS r ON r.principal_id = m.role_principal_id
        WHERE m.member_principal_id = @granteeId AND r.name = N'db_owner')
    SET @skipReason = N'training_plan_app is a member of db_owner, so these grants add nothing today. Re-run this script once that role is removed.';

IF @skipReason IS NOT NULL
BEGIN
    PRINT '------------------------------------------------------------';
    PRINT 'SKIPPED: ' + @skipReason;
    PRINT 'The certificate feature will still work: the account already has full rights.';
    PRINT 'No permission was changed.';
    PRINT '------------------------------------------------------------';
END
ELSE
BEGIN
    EXEC sys.sp_executesql N'
        GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.certificate_import_batch TO [training_plan_app];
        GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.training_certificate_file TO [training_plan_app];';
    PRINT 'Granted SELECT/INSERT/UPDATE/DELETE on both certificate tables to training_plan_app.';
END
GO

SELECT OBJECT_NAME(major_id) AS object_name, permission_name, state_desc
FROM sys.database_permissions
WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(N'training_plan_app')
  AND major_id IN (
      OBJECT_ID(N'dbo.certificate_import_batch'),
      OBJECT_ID(N'dbo.training_certificate_file')
  )
  AND permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE')
ORDER BY object_name, permission_name;
GO
