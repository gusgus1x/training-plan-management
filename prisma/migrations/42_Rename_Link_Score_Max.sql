/*
  42_Rename_Link_Score_Max.sql

  Renames training_result.pre_score_max / post_score_max to pre_link_score_max /
  post_link_score_max, the second half of migration 41.

  WHY IT IS A SEPARATE FILE

  sp_rename refuses a column that a CHECK constraint names: "cannot be renamed because the object
  participates in enforced dependencies" (error 15336). The constraints from migration 40 do
  exactly that, so they are dropped first and recreated afterwards under names that match. Keeping
  this apart from 41 also means a failure here cannot make 41's one-way conversion run twice.

  WHY THE NAME CHANGED

  Migration 40 added these columns believing the marks a score is out of had to be snapshotted. For
  an in-system form they do not: the assessment behind official_*_submission_id owns them and
  cannot change once anybody has answered. What has no denominator anywhere is a test this system
  cannot see, so the columns now say only that.

  Safe to run more than once.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_training_result_pre_score_max_positive')
  ALTER TABLE dbo.training_result DROP CONSTRAINT CK_training_result_pre_score_max_positive;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_training_result_post_score_max_positive')
  ALTER TABLE dbo.training_result DROP CONSTRAINT CK_training_result_post_score_max_positive;
GO

IF COL_LENGTH('dbo.training_result', 'pre_score_max') IS NOT NULL
   AND COL_LENGTH('dbo.training_result', 'pre_link_score_max') IS NULL
  EXEC sp_rename N'dbo.training_result.pre_score_max', N'pre_link_score_max', N'COLUMN';
GO

IF COL_LENGTH('dbo.training_result', 'post_score_max') IS NOT NULL
   AND COL_LENGTH('dbo.training_result', 'post_link_score_max') IS NULL
  EXEC sp_rename N'dbo.training_result.post_score_max', N'post_link_score_max', N'COLUMN';
GO

-- A zero denominator has no percentage to compute, so it is refused rather than divided by.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = 'CK_training_result_pre_link_score_max_positive')
  ALTER TABLE dbo.training_result WITH CHECK
    ADD CONSTRAINT CK_training_result_pre_link_score_max_positive
    CHECK (pre_link_score_max IS NULL OR pre_link_score_max > 0);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = 'CK_training_result_post_link_score_max_positive')
  ALTER TABLE dbo.training_result WITH CHECK
    ADD CONSTRAINT CK_training_result_post_link_score_max_positive
    CHECK (post_link_score_max IS NULL OR post_link_score_max > 0);
GO
