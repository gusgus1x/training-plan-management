/*
  33_Backfill_Assessment_Publication_Status.sql

  No schema change - data only.

  assessment_submission.publication_status has existed since the original schema with a default of
  'UNPUBLISHED', but no code ever read or wrote it, so every row submitted before the release-grades
  feature sits at 'UNPUBLISHED'. The employee-facing projections now withhold the score of any
  unpublished submission, which would retroactively hide scores people have already been shown.

  This marks everything already graded before the feature existed as released. Rows still waiting on
  a human to grade a written answer are left alone - those are exactly the ones the new HRD
  "ประกาศผลให้พนักงาน" button is for.

  Safe to run more than once.
*/

UPDATE dbo.assessment_submission
SET    publication_status = 'PUBLISHED'
WHERE  publication_status <> 'PUBLISHED'
  AND  grading_status = 'REVIEWED'
  AND  submitted_at IS NOT NULL;
GO
