/*
  36_Add_Training_Plan_Form_Links.sql

  The link half of the per-batch form override added in migration 35.

  A course can point a stage at an external form (a Google Form, say) instead of an in-system one,
  and a batch needs the same choice: one month's session may use a link even though the course uses
  an in-system assessment, or the other way round.

  All four columns are NULLABLE. A batch that sets neither the id (migration 35) nor the link for a
  stage still follows its course exactly as before; nothing is backfilled.

  Widths match dbo.course's own link columns so a link copied from a course cannot be truncated.

  Safe to run more than once.
*/

IF COL_LENGTH('dbo.training_plan', 'pre_test_link') IS NULL
  ALTER TABLE dbo.training_plan ADD pre_test_link NVARCHAR(2048) NULL;
GO

IF COL_LENGTH('dbo.training_plan', 'post_test_link') IS NULL
  ALTER TABLE dbo.training_plan ADD post_test_link NVARCHAR(2048) NULL;
GO

IF COL_LENGTH('dbo.training_plan', 'evaluation_link') IS NULL
  ALTER TABLE dbo.training_plan ADD evaluation_link NVARCHAR(2048) NULL;
GO

IF COL_LENGTH('dbo.training_plan', 'evaluation_after_30day_link') IS NULL
  ALTER TABLE dbo.training_plan ADD evaluation_after_30day_link NVARCHAR(2048) NULL;
GO
