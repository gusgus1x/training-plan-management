USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
GO

/*
dbo.role carries two CHECK constraints on role_code, both created with the original V6 schema and
neither present in this repository: CK_RC2_role_role_code_enum and CK_role_role_code. They pin
role_code to the three roles that existed then, so seeding ADMIN fails with Msg 547.

This replaces both with a single constraint listing the four codes that app/lib/auth/types.ts now
declares in ROLE_CODES. Only EMPLOYEE, HRD_FACTORY and HRD_CENTER exist in the table today, so the
new constraint is created WITH CHECK and validates the existing rows as it is added — if any other
code were present this migration would fail loudly rather than silently dropping a guard.

Keep this list and ROLE_CODES in step: adding a role in TypeScript without adding it here fails at
the database, and adding it here without TypeScript leaves it unusable at login.
*/
BEGIN TRY
  BEGIN TRANSACTION;

  IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_RC2_role_role_code_enum'
      AND parent_object_id = OBJECT_ID(N'dbo.role')
  )
    ALTER TABLE dbo.role DROP CONSTRAINT CK_RC2_role_role_code_enum;

  IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_role_role_code'
      AND parent_object_id = OBJECT_ID(N'dbo.role')
  )
    ALTER TABLE dbo.role DROP CONSTRAINT CK_role_role_code;

  IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_role_role_code_enum'
      AND parent_object_id = OBJECT_ID(N'dbo.role')
  )
    ALTER TABLE dbo.role WITH CHECK
      ADD CONSTRAINT CK_role_role_code_enum CHECK
        (role_code IN (N'EMPLOYEE', N'HRD_FACTORY', N'HRD_CENTER', N'ADMIN'));

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO

SELECT name, is_disabled, is_not_trusted
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID(N'dbo.role');
GO
