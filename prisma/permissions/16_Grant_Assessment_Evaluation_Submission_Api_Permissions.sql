/*
TrainingPlanManagement — Assessment/Evaluation submission API least-privilege permissions.

Nothing in prisma/permissions/ has ever granted training_plan_app anything on the
assessment/evaluation tables. The Assessment.tsx / EvaluationManagement.tsx screens work today only
because training_plan_app currently holds db_owner (flagged elsewhere as something to remove) --
once that is revoked, every read and write below fails with a permission error, not a compile error.

Scope, matching the "employee takes a form" feature:
  - Full CRUD on the two submission tables and their answer tables (the employee's own attempt).
  - SELECT only on the question/choice/option tables (read the form; nothing ever writes them here --
    Assessment.tsx/EvaluationManagement.tsx own that write path separately).
  - Full CRUD on training_plan_assessment_setting (the HRD open/close switch for PRE_TEST/POST_TEST;
    see CK_RC2_training_plan_assessment_setting_assessment_stage_enum -- it accepts only those two
    values, confirmed live 2026-09-01, which is why evaluation forms have no close switch here).
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
IF OBJECT_ID(N'dbo.assessment_submission', N'U') IS NULL
    THROW 52903, 'Required table dbo.assessment_submission was not found.', 1;
IF OBJECT_ID(N'dbo.assessment_answer', N'U') IS NULL
    THROW 52904, 'Required table dbo.assessment_answer was not found.', 1;
IF OBJECT_ID(N'dbo.evaluation_submission', N'U') IS NULL
    THROW 52905, 'Required table dbo.evaluation_submission was not found.', 1;
IF OBJECT_ID(N'dbo.evaluation_answer', N'U') IS NULL
    THROW 52906, 'Required table dbo.evaluation_answer was not found.', 1;
IF OBJECT_ID(N'dbo.training_plan_assessment_setting', N'U') IS NULL
    THROW 52907, 'Required table dbo.training_plan_assessment_setting was not found.', 1;
IF OBJECT_ID(N'dbo.assessment_question', N'U') IS NULL
    THROW 52908, 'Required table dbo.assessment_question was not found.', 1;
IF OBJECT_ID(N'dbo.assessment_choice', N'U') IS NULL
    THROW 52909, 'Required table dbo.assessment_choice was not found.', 1;
IF OBJECT_ID(N'dbo.evaluation_question', N'U') IS NULL
    THROW 52910, 'Required table dbo.evaluation_question was not found.', 1;
IF OBJECT_ID(N'dbo.evaluation_option', N'U') IS NULL
    THROW 52911, 'Required table dbo.evaluation_option was not found.', 1;
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.assessment_submission TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.assessment_answer TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.evaluation_submission TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.evaluation_answer TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.training_plan_assessment_setting TO [training_plan_app];
GO

GRANT SELECT ON OBJECT::dbo.assessment_question TO [training_plan_app];
GRANT SELECT ON OBJECT::dbo.assessment_choice TO [training_plan_app];
GRANT SELECT ON OBJECT::dbo.evaluation_question TO [training_plan_app];
GRANT SELECT ON OBJECT::dbo.evaluation_option TO [training_plan_app];
GO

SELECT OBJECT_NAME(major_id) AS object_name, permission_name, state_desc
FROM sys.database_permissions
WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(N'training_plan_app')
  AND major_id IN (
      OBJECT_ID(N'dbo.assessment_submission'), OBJECT_ID(N'dbo.assessment_answer'),
      OBJECT_ID(N'dbo.evaluation_submission'), OBJECT_ID(N'dbo.evaluation_answer'),
      OBJECT_ID(N'dbo.training_plan_assessment_setting'),
      OBJECT_ID(N'dbo.assessment_question'), OBJECT_ID(N'dbo.assessment_choice'),
      OBJECT_ID(N'dbo.evaluation_question'), OBJECT_ID(N'dbo.evaluation_option')
  )
  AND permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE')
ORDER BY object_name, permission_name;
GO
