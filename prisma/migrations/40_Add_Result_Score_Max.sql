/*
  40_Add_Result_Score_Max.sql

  Records the full marks a pre/post score was measured against, so the Training Result screen can
  show "8" instead of "80".

  WHY pre_score STAYS A PERCENTAGE

  The pass/fail verdict is decided against assessment.passing_score_percent, so a percentage can be
  compared without knowing anything else about the form. A raw mark cannot: two courses out of 10
  and out of 100 both store "8", and a form that gains a question later makes every stored mark
  before it mean something different. So the stored score keeps its meaning and this column adds
  the missing half - the denominator that turns it back into the mark HRD actually typed.

  NULL MEANS "FULL MARKS UNKNOWN"

  Every row written before this migration has one, and so does any score HRD typed for a test this
  system cannot see. Those rows keep reading as a percentage, which is what they have always been.
  Nothing backfills a guess: inventing a denominator would silently restate somebody's mark on a
  record the employee downloads as evidence.

  Safe to run more than once.
*/

IF COL_LENGTH('dbo.training_result', 'pre_score_max') IS NULL
  ALTER TABLE dbo.training_result ADD pre_score_max DECIMAL(10, 2) NULL;
GO

IF COL_LENGTH('dbo.training_result', 'post_score_max') IS NULL
  ALTER TABLE dbo.training_result ADD post_score_max DECIMAL(10, 2) NULL;
GO

-- A zero denominator has no percentage to compute, so it is refused rather than divided by.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = 'CK_training_result_pre_score_max_positive')
  ALTER TABLE dbo.training_result WITH CHECK
    ADD CONSTRAINT CK_training_result_pre_score_max_positive
    CHECK (pre_score_max IS NULL OR pre_score_max > 0);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = 'CK_training_result_post_score_max_positive')
  ALTER TABLE dbo.training_result WITH CHECK
    ADD CONSTRAINT CK_training_result_post_score_max_positive
    CHECK (post_score_max IS NULL OR post_score_max > 0);
GO
