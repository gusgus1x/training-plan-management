/*
  38_Add_Grid_Questions.sql

  Multiple choice grid and checkbox grid, matching Google Forms.

  A grid has two axes. Rows and columns are both stored as ordinary option/choice rows of the same
  question, told apart by the new `axis` column ('ROW' or 'COLUMN'; NULL on every existing row, so
  a normal question is unchanged). Reusing the option tables keeps ordering, the unique constraint
  per question, and the whole read path exactly as they are.

  An answer then has to say WHICH ROW it belongs to, which the answer tables could not express -
  they held only (question, choice). Hence row_option_id / row_choice_id.

  SCORING (assessments only - evaluations are never scored):
  Google Forms assigns points PER ROW of a grid, with its own correct column(s) per row. So:
    - a ROW choice carries that row's point value in the existing option_score column
    - a ROW choice carries its answer key in correct_columns: the choice_order values of the
      correct columns, comma separated ("2" for a multiple choice grid, "1,3" for a checkbox grid)
    - assessment_question.question_score stays the SUM of the row points

  That last line is the important one: every existing denominator loop sums question_score per
  question, so keeping it in sync means submitAssessment, gradeSubmission and
  readAssessmentReviewForEmployee need no change to their totals at all.

  correct_columns holds ORDER values rather than ids for the same reason next_section does: both
  repositories delete and recreate every question, option and choice row on save, so an id-based
  reference would dangle the moment anyone re-saves the form. Order is stable by construction.

  Existing CHECK constraints read from sys.check_constraints before writing this file
  (scripts/check-form-block-columns.mjs prints them). Only the two question_type enums move;
  CK_RC2_assessment_choice_option_score is already ([option_score]>=(0)), which row points satisfy.

  Safe to run more than once.
*/

-- ------------------------------------------------------------------ axes

IF COL_LENGTH('dbo.evaluation_option', 'axis') IS NULL
  ALTER TABLE dbo.evaluation_option ADD axis NVARCHAR(10) NULL;
GO

IF COL_LENGTH('dbo.assessment_choice', 'axis') IS NULL
  ALTER TABLE dbo.assessment_choice ADD axis VARCHAR(10) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = 'CK_evaluation_option_axis'
                 AND parent_object_id = OBJECT_ID(N'dbo.evaluation_option'))
  ALTER TABLE dbo.evaluation_option WITH CHECK
    ADD CONSTRAINT CK_evaluation_option_axis
    CHECK (axis IS NULL OR axis IN (N'ROW', N'COLUMN'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = 'CK_RC2_assessment_choice_axis'
                 AND parent_object_id = OBJECT_ID(N'dbo.assessment_choice'))
  ALTER TABLE dbo.assessment_choice WITH CHECK
    ADD CONSTRAINT CK_RC2_assessment_choice_axis
    CHECK (axis IS NULL OR axis IN ('ROW', 'COLUMN'));
GO

-- --------------------------------------------------- per-row answer key

IF COL_LENGTH('dbo.assessment_choice', 'correct_columns') IS NULL
  ALTER TABLE dbo.assessment_choice ADD correct_columns VARCHAR(200) NULL;
GO

-- ------------------------------------------------- which row an answer is for

IF COL_LENGTH('dbo.evaluation_answer', 'row_option_id') IS NULL
  ALTER TABLE dbo.evaluation_answer ADD row_option_id BIGINT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_evaluation_answer_row_option_id')
  ALTER TABLE dbo.evaluation_answer WITH CHECK
    ADD CONSTRAINT FK_evaluation_answer_row_option_id
    FOREIGN KEY (row_option_id) REFERENCES dbo.evaluation_option (evaluation_option_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_evaluation_answer_row_option_id'
                 AND object_id = OBJECT_ID(N'dbo.evaluation_answer'))
  CREATE INDEX IX_evaluation_answer_row_option_id
    ON dbo.evaluation_answer (row_option_id);
GO

IF COL_LENGTH('dbo.assessment_answer', 'row_choice_id') IS NULL
  ALTER TABLE dbo.assessment_answer ADD row_choice_id BIGINT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_RC2_assessment_answer_row_choice_id')
  ALTER TABLE dbo.assessment_answer WITH CHECK
    ADD CONSTRAINT FK_RC2_assessment_answer_row_choice_id
    FOREIGN KEY (row_choice_id) REFERENCES dbo.assessment_choice (choice_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_assessment_answer_row_choice_id'
                 AND object_id = OBJECT_ID(N'dbo.assessment_answer'))
  CREATE INDEX IX_assessment_answer_row_choice_id
    ON dbo.assessment_answer (row_choice_id);
GO

-- --------------------------------------------------------- type enums

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CK_RC2_evaluation_question_question_type_enum'
             AND parent_object_id = OBJECT_ID(N'dbo.evaluation_question'))
  ALTER TABLE dbo.evaluation_question DROP CONSTRAINT CK_RC2_evaluation_question_question_type_enum;
GO

ALTER TABLE dbo.evaluation_question WITH CHECK
  ADD CONSTRAINT CK_RC2_evaluation_question_question_type_enum
  CHECK (question_type IN (N'RATING', N'SINGLE_CHOICE', N'MULTIPLE_CHOICE',
                           N'SHORT_TEXT', N'LONG_TEXT',
                           N'SECTION_BREAK', N'TEXT_BLOCK',
                           N'MULTIPLE_CHOICE_GRID', N'CHECKBOX_GRID'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CK_RC2_assessment_question_question_type_enum'
             AND parent_object_id = OBJECT_ID(N'dbo.assessment_question'))
  ALTER TABLE dbo.assessment_question DROP CONSTRAINT CK_RC2_assessment_question_question_type_enum;
GO

ALTER TABLE dbo.assessment_question WITH CHECK
  ADD CONSTRAINT CK_RC2_assessment_question_question_type_enum
  CHECK (question_type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_ANSWER', 'TRUE_FALSE',
                           'SECTION_BREAK', 'TEXT_BLOCK',
                           'MULTIPLE_CHOICE_GRID', 'CHECKBOX_GRID'));
GO
