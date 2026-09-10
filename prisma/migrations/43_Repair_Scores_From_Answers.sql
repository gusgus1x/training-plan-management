/*
  43_Repair_Scores_From_Answers.sql

  Rebuilds every stored score from the marks awarded per answer.

  WHY

  Migration 41's conversion is one-way: it multiplies each score by the paper's total and divides by
  100. Its first version guarded on a column name that its own failing rename never changed, so
  running the file again re-ran the conversion. Three runs multiplied every score by
  (total / 100) three times over. With a paper out of 3, a full score of 100 became 3, then 0.09,
  then 0.0027.

  WHY THIS IS A REBUILD AND NOT A DIVISION

  Dividing back would need the number of times the conversion ran, which nothing on disk records -
  a guess dressed as arithmetic. `assessment_answer.score_awarded` was never touched by any of it,
  and it is the same numerator the grader summed: one row per selected choice with the question's
  whole award on the first, and each graded short answer carrying its own. Summing it reproduces
  the mark exactly, however many times anything ran.

  WHAT IT CANNOT PUT BACK

  A pre/post score HRD had typed over the system's own on an in-system course. That correction was
  converted along with everything else and is not separable from the official mark, so the official
  mark wins here. A score for a course with no in-system form was never converted at all - those
  rows are not touched by this file.

  Safe to run more than once: rebuilding from the same answers gives the same marks.
*/

WITH awarded AS (
  SELECT a.submission_id, SUM(ISNULL(a.score_awarded, 0)) AS marks
  FROM dbo.assessment_answer AS a
  GROUP BY a.submission_id
)
UPDATE s
  SET s.score = ISNULL(w.marks, 0)
  FROM dbo.assessment_submission AS s
  LEFT JOIN awarded AS w ON w.submission_id = s.submission_id
  -- A submission still waiting on a human carries no score at all, and must keep carrying none:
  -- "not graded yet" and "scored nothing" are different claims.
  WHERE s.score IS NOT NULL;
GO

UPDATE r
  SET r.pre_score = s.score
  FROM dbo.training_result AS r
  JOIN dbo.assessment_submission AS s ON s.submission_id = r.official_pre_submission_id
  WHERE r.pre_score IS NOT NULL AND s.score IS NOT NULL;
GO

UPDATE r
  SET r.post_score = s.score
  FROM dbo.training_result AS r
  JOIN dbo.assessment_submission AS s ON s.submission_id = r.official_post_submission_id
  WHERE r.post_score IS NOT NULL AND s.score IS NOT NULL;
GO
