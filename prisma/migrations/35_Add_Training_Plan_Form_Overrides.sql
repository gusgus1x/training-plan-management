/*
  35_Add_Training_Plan_Form_Overrides.sql

  Per-batch overrides for the four training forms.

  Until now the form a trainee gets was read straight off the course, so every batch of a course
  was locked to the same pre-test, post-test and evaluations. HRD needs to swap one for a single
  month's batch without touching the course everyone else uses.

  All four columns are NULLABLE and NULL means "use the course's". Nothing is backfilled: every
  existing batch keeps behaving exactly as it does today, and a batch only diverges once someone
  deliberately picks something else.

  (training_plan_oap already carries three similarly named columns. Those are a snapshot written at
  OAP creation that no read path consults - they are left untouched here rather than repurposed,
  because the batch, not the yearly plan, is what HRD reschedules month to month.)

  Safe to run more than once.
*/

IF COL_LENGTH('dbo.training_plan', 'pre_assessment_id') IS NULL
  ALTER TABLE dbo.training_plan ADD pre_assessment_id BIGINT NULL;
GO

IF COL_LENGTH('dbo.training_plan', 'post_assessment_id') IS NULL
  ALTER TABLE dbo.training_plan ADD post_assessment_id BIGINT NULL;
GO

IF COL_LENGTH('dbo.training_plan', 'evaluation_form_id') IS NULL
  ALTER TABLE dbo.training_plan ADD evaluation_form_id BIGINT NULL;
GO

IF COL_LENGTH('dbo.training_plan', 'evaluation_form_after_30day_id') IS NULL
  ALTER TABLE dbo.training_plan ADD evaluation_form_after_30day_id BIGINT NULL;
GO

/* NO ACTION on delete: an assessment or evaluation a batch points at must not be removable out
   from under it. The application already refuses to delete a form that is in use. */
IF OBJECT_ID('dbo.FK_training_plan_pre_assessment_id', 'F') IS NULL
  ALTER TABLE dbo.training_plan ADD CONSTRAINT FK_training_plan_pre_assessment_id
    FOREIGN KEY (pre_assessment_id) REFERENCES dbo.assessment (assessment_id);
GO

IF OBJECT_ID('dbo.FK_training_plan_post_assessment_id', 'F') IS NULL
  ALTER TABLE dbo.training_plan ADD CONSTRAINT FK_training_plan_post_assessment_id
    FOREIGN KEY (post_assessment_id) REFERENCES dbo.assessment (assessment_id);
GO

IF OBJECT_ID('dbo.FK_training_plan_evaluation_form_id', 'F') IS NULL
  ALTER TABLE dbo.training_plan ADD CONSTRAINT FK_training_plan_evaluation_form_id
    FOREIGN KEY (evaluation_form_id) REFERENCES dbo.evaluation_form (evaluation_form_id);
GO

IF OBJECT_ID('dbo.FK_training_plan_evaluation_form_after_30day_id', 'F') IS NULL
  ALTER TABLE dbo.training_plan ADD CONSTRAINT FK_training_plan_evaluation_form_after_30day_id
    FOREIGN KEY (evaluation_form_after_30day_id) REFERENCES dbo.evaluation_form (evaluation_form_id);
GO
