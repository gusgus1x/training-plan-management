/*
  37_Add_Form_Sections_And_Text_Blocks.sql

  Google-Forms-style page breaks and text blocks for evaluations and assessments.

  Both are stored as ordinary rows in the existing question tables, with two new question_type
  values SECTION_BREAK and TEXT_BLOCK, so they interleave with real questions using question_order
  and its existing unique constraint per form. Google Forms models a form the same way: one flat
  ordered item list where a section break is just an item.

  question_description holds a text block's body, and doubles as a section's sub-caption.

  next_section holds a 1-based SECTION ORDINAL, never an id. Both repositories delete and recreate
  every question row on save, so ids are regenerated and an id-based branch target would dangle the
  moment anyone re-saves the form. Section 1 is everything before the first SECTION_BREAK.

  All new columns are NULLABLE and nothing is backfilled; an existing form is unchanged.

  FOUR existing CHECK constraints have to move, all read from sys.check_constraints before this file
  was written (scripts/check-form-block-columns.mjs prints them):

    assessment_question.CK_RC2_assessment_question_question_type_enum
      ([question_type]='TRUE_FALSE' OR [question_type]='SINGLE_CHOICE'
       OR [question_type]='SHORT_ANSWER' OR [question_type]='MULTIPLE_CHOICE')

    assessment_question.CK_RC2_assessment_question_score
      ([question_score]>(0))
      -- strictly positive, so a zero-score block row would be REJECTED outright. Relaxed below to
      -- allow exactly zero, and only for the two block types.

    evaluation_question.CK_evaluation_question_question_type
    evaluation_question.CK_RC2_evaluation_question_question_type_enum
      Two constraints asserting the identical five-value set, one from the original schema and one
      from the RC2 pass. Both are dropped and only the RC2-named one is recreated; keeping a second
      copy just means the next person has to widen the enum in two places.

  Safe to run more than once.
*/

-- ---------------------------------------------------------------- new columns

IF COL_LENGTH('dbo.evaluation_question', 'question_description') IS NULL
  ALTER TABLE dbo.evaluation_question ADD question_description NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.evaluation_question', 'next_section') IS NULL
  ALTER TABLE dbo.evaluation_question ADD next_section INT NULL;
GO

IF COL_LENGTH('dbo.evaluation_option', 'next_section') IS NULL
  ALTER TABLE dbo.evaluation_option ADD next_section INT NULL;
GO

IF COL_LENGTH('dbo.assessment_question', 'question_description') IS NULL
  ALTER TABLE dbo.assessment_question ADD question_description NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.assessment_question', 'next_section') IS NULL
  ALTER TABLE dbo.assessment_question ADD next_section INT NULL;
GO

IF COL_LENGTH('dbo.assessment_choice', 'next_section') IS NULL
  ALTER TABLE dbo.assessment_choice ADD next_section INT NULL;
GO

-- ------------------------------------------------- evaluation_question enum

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CK_evaluation_question_question_type'
             AND parent_object_id = OBJECT_ID(N'dbo.evaluation_question'))
  ALTER TABLE dbo.evaluation_question DROP CONSTRAINT CK_evaluation_question_question_type;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CK_RC2_evaluation_question_question_type_enum'
             AND parent_object_id = OBJECT_ID(N'dbo.evaluation_question'))
  ALTER TABLE dbo.evaluation_question DROP CONSTRAINT CK_RC2_evaluation_question_question_type_enum;
GO

ALTER TABLE dbo.evaluation_question WITH CHECK
  ADD CONSTRAINT CK_RC2_evaluation_question_question_type_enum
  CHECK (question_type IN (N'RATING', N'SINGLE_CHOICE', N'MULTIPLE_CHOICE',
                           N'SHORT_TEXT', N'LONG_TEXT',
                           N'SECTION_BREAK', N'TEXT_BLOCK'));
GO

-- ------------------------------------------------- assessment_question enum

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CK_RC2_assessment_question_question_type_enum'
             AND parent_object_id = OBJECT_ID(N'dbo.assessment_question'))
  ALTER TABLE dbo.assessment_question DROP CONSTRAINT CK_RC2_assessment_question_question_type_enum;
GO

ALTER TABLE dbo.assessment_question WITH CHECK
  ADD CONSTRAINT CK_RC2_assessment_question_question_type_enum
  CHECK (question_type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_ANSWER', 'TRUE_FALSE',
                           'SECTION_BREAK', 'TEXT_BLOCK'));
GO

-- ------------------------------------- assessment_question score, blocks only

-- A block carries no marks, so it needs question_score = 0, which the original
-- strictly-positive constraint forbids. Widened to "positive, unless it is a block".
IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CK_RC2_assessment_question_score'
             AND parent_object_id = OBJECT_ID(N'dbo.assessment_question'))
  ALTER TABLE dbo.assessment_question DROP CONSTRAINT CK_RC2_assessment_question_score;
GO

ALTER TABLE dbo.assessment_question WITH CHECK
  ADD CONSTRAINT CK_RC2_assessment_question_score
  CHECK (question_score > 0
         OR question_type IN ('SECTION_BREAK', 'TEXT_BLOCK'));
GO

-- The other half: a block must never carry marks. Together with the rule above this makes a
-- scoring block impossible at the storage layer, not just in the three TypeScript grading loops.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = 'CK_RC2_assessment_question_block_score_zero'
                 AND parent_object_id = OBJECT_ID(N'dbo.assessment_question'))
  ALTER TABLE dbo.assessment_question WITH CHECK
    ADD CONSTRAINT CK_RC2_assessment_question_block_score_zero
    CHECK (question_type NOT IN ('SECTION_BREAK', 'TEXT_BLOCK')
           OR question_score = 0);
GO
