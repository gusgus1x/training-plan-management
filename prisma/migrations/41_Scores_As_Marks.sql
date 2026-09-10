/*
  41_Scores_As_Marks.sql

  Stops storing percentages. Every stored score becomes the MARK, the way Google Forms stores a
  quiz response: points per answer, points for the submission, and no percentage anywhere. A
  percentage is worked out where it is shown, and where the pass mark is judged.

  WHY

  `assessment_submission.score` held `awarded * 100 / possible`. Both halves of that division were
  already on disk - the marks in assessment_answer.score_awarded, the totals in
  assessment_question.question_score - so the column threw away two facts to keep one derived one.
  Every screen inherited it: the runner said "score 100%", and the Training Result box showed 100
  for a test out of 3.

  A stored assessment cannot change once anybody has answered it (assessmentService.update and
  .delete both refuse when isUsed, which counts course links, plan links and submissions), so the
  denominator behind an old submission is stable and this conversion is exact, not a guess.

  THE RENAMED COLUMNS

  Migration 40 added pre_score_max / post_score_max on the theory that the denominator had to be
  snapshotted. It does not: for an in-system form it is a join away and cannot move. What genuinely
  has no denominator anywhere is a test this system cannot see - an external link, or a mark HRD
  typed by hand. So the columns keep their type and become exactly that, and say so in their name:
  pre_link_score_max / post_link_score_max. They were added empty, so nothing is rewritten here.

  The rename itself lives in migration 42. It cannot sit here: the CHECK constraints from migration
  40 name these columns, and SQL Server refuses sp_rename on a column with an enforced dependency
  (error 15336). Splitting them also keeps this file safe to re-run after that failure - which is
  how the split came about.

  RUNNING THIS TWICE WOULD MULTIPLY EVERY SCORE BY ITS TOTAL AGAIN.

  So it guards on two things, either of which proves the conversion has already happened: the
  extended property it sets at the end, and the renamed columns migration 42 leaves behind.
*/

IF COL_LENGTH('dbo.training_result', 'pre_link_score_max') IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM sys.extended_properties
     WHERE major_id = OBJECT_ID(N'dbo.training_result')
       AND minor_id = 0
       AND name = N'scores_are_marks'
   )
BEGIN
  -- The marks each form is out of, summed the way the grader sums them: sections and text blocks
  -- are not answerable and carry no marks, so counting them would inflate every denominator.
  WITH assessment_total AS (
    SELECT q.assessment_id, SUM(q.question_score) AS total_score
    FROM dbo.assessment_question AS q
    WHERE q.question_type NOT IN (N'SECTION_BREAK', N'TEXT_BLOCK')
    GROUP BY q.assessment_id
  )
  UPDATE s
    SET s.score = s.score * t.total_score / 100
    FROM dbo.assessment_submission AS s
    JOIN assessment_total AS t ON t.assessment_id = s.assessment_id
    WHERE s.score IS NOT NULL AND t.total_score > 0;

  -- training_result carried a copy of that same percentage, and names the submission it came from.
  WITH assessment_total AS (
    SELECT q.assessment_id, SUM(q.question_score) AS total_score
    FROM dbo.assessment_question AS q
    WHERE q.question_type NOT IN (N'SECTION_BREAK', N'TEXT_BLOCK')
    GROUP BY q.assessment_id
  )
  UPDATE r
    SET r.pre_score = r.pre_score * t.total_score / 100
    FROM dbo.training_result AS r
    JOIN dbo.assessment_submission AS s ON s.submission_id = r.official_pre_submission_id
    JOIN assessment_total AS t ON t.assessment_id = s.assessment_id
    WHERE r.pre_score IS NOT NULL AND t.total_score > 0;

  WITH assessment_total AS (
    SELECT q.assessment_id, SUM(q.question_score) AS total_score
    FROM dbo.assessment_question AS q
    WHERE q.question_type NOT IN (N'SECTION_BREAK', N'TEXT_BLOCK')
    GROUP BY q.assessment_id
  )
  UPDATE r
    SET r.post_score = r.post_score * t.total_score / 100
    FROM dbo.training_result AS r
    JOIN dbo.assessment_submission AS s ON s.submission_id = r.official_post_submission_id
    JOIN assessment_total AS t ON t.assessment_id = s.assessment_id
    WHERE r.post_score IS NOT NULL AND t.total_score > 0;

  -- A result with no official submission is a mark somebody typed for a test this system cannot
  -- see. There is nothing to convert it against, so it is left exactly as it was and the screen
  -- asks for its full marks.

  -- Migration 40's writer snapshotted the form's total onto rows that came from an in-system test.
  -- After the rename that column means "the full marks of a test this system cannot see", and a
  -- form's own total sitting in it is simply the wrong fact in the wrong place. Cleared for exactly
  -- the rows that name a submission, which are the rows whose denominator is a join away.
  UPDATE dbo.training_result
    SET pre_score_max = NULL
    WHERE official_pre_submission_id IS NOT NULL AND pre_score_max IS NOT NULL;

  UPDATE dbo.training_result
    SET post_score_max = NULL
    WHERE official_post_submission_id IS NOT NULL AND post_score_max IS NOT NULL;

  -- The record that this ran. Read back by the guard above, so a second run cannot convert twice
  -- even if migration 42 never gets as far as renaming the columns.
  EXEC sys.sp_addextendedproperty
    @name = N'scores_are_marks', @value = N'41',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'training_result';
END
GO
