/*
  39_Add_Evaluation_Reviewer.sql

  Lets HRD hand one trainee's evaluation to that trainee's supervisor, and lets the supervisor
  answer the same form the trainee answers.

  WHY A SEPARATE TABLE RATHER THAN A PRE-CREATED SUBMISSION ROW

  The obvious shortcut - create the evaluation_submission row up front and treat it as the
  assignment - cannot express a course whose evaluation is an external link. That course has no
  evaluation_form_id at all, and evaluation_submission.evaluation_form_id is NOT NULL. So the
  assignment (who was asked) is stored apart from the answer (what they said), and works the same
  for both FORM and LINK courses.

  ONE SUPERVISOR PER TRAINEE, MANY TRAINEES PER SUPERVISOR

  enrollment_id is the primary key, so the database itself refuses a second supervisor for the same
  trainee on the same course - the app never has to enforce that rule and so can never forget to.
  The other direction needs no rule at all: reviewer_user_id simply repeats across rows, which is
  the normal case, since a course's attendees often share one section head.

  opened_at IS NOT A COMPLETION RECORD

  It is the first time the supervisor opened the form or followed the link. For a LINK course it is
  the only signal that will ever exist - this system cannot see what happens on someone else's form.
  Nothing may present it as "done".

  respondent_user_id ON evaluation_submission

  The supervisor answers the SAME form as the trainee, so both need a row for one
  (evaluation_form_id, enrollment_id) pair, which the existing unique key forbids. The new column
  carries the answering employee's user_id and the unique key widens to include it.

  The column is added NULL, backfilled, and only then made NOT NULL. Leaving it nullable was the
  first attempt and does not work: Prisma refuses findUnique on a compound key containing a
  nullable column, so every existing lookup would have had to become a findFirst. It is also worse
  data - "NULL means the enrollment owner" is a rule every future reader has to know, while a real
  user_id simply says who answered. The backfill is exact rather than a guess: before this
  migration only the enrollment's own employee could submit, which loadOwnedEnrollment enforced.

  Safe to run more than once.
*/

-- --------------------------------------------------------- assignment

IF OBJECT_ID(N'dbo.training_evaluation_reviewer', N'U') IS NULL
  CREATE TABLE dbo.training_evaluation_reviewer (
    enrollment_id    BIGINT        NOT NULL,
    reviewer_user_id NVARCHAR(50)  NOT NULL,
    assigned_by      BIGINT        NOT NULL,
    assigned_at      DATETIME2     NOT NULL
      CONSTRAINT DF_training_evaluation_reviewer_assigned_at DEFAULT (SYSDATETIME()),
    opened_at        DATETIME2     NULL,
    CONSTRAINT PK_training_evaluation_reviewer PRIMARY KEY (enrollment_id),
    CONSTRAINT FK_training_evaluation_reviewer_enrollment_id
      FOREIGN KEY (enrollment_id) REFERENCES dbo.training_enrollment (enrollment_id),
    CONSTRAINT FK_training_evaluation_reviewer_reviewer_user_id
      FOREIGN KEY (reviewer_user_id) REFERENCES dbo.employee (user_id),
    CONSTRAINT FK_training_evaluation_reviewer_assigned_by
      FOREIGN KEY (assigned_by) REFERENCES dbo.user_account (user_id)
  );
GO

-- The supervisor's own screen lists every trainee assigned to them, so this is the read path that
-- runs most often. Without it that list is a table scan.
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_training_evaluation_reviewer_reviewer_user_id'
                 AND object_id = OBJECT_ID(N'dbo.training_evaluation_reviewer'))
  CREATE INDEX IX_training_evaluation_reviewer_reviewer_user_id
    ON dbo.training_evaluation_reviewer (reviewer_user_id);
GO

-- ------------------------------------------------------- who answered

IF COL_LENGTH('dbo.evaluation_submission', 'respondent_user_id') IS NULL
  ALTER TABLE dbo.evaluation_submission ADD respondent_user_id NVARCHAR(50) NULL;
GO

UPDATE s
  SET s.respondent_user_id = e.employee_user_id
  FROM dbo.evaluation_submission AS s
  JOIN dbo.training_enrollment AS e ON e.enrollment_id = s.enrollment_id
  WHERE s.respondent_user_id IS NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID(N'dbo.evaluation_submission')
             AND name = 'respondent_user_id'
             AND is_nullable = 1)
  ALTER TABLE dbo.evaluation_submission ALTER COLUMN respondent_user_id NVARCHAR(50) NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
               WHERE name = 'FK_evaluation_submission_respondent_user_id')
  ALTER TABLE dbo.evaluation_submission WITH CHECK
    ADD CONSTRAINT FK_evaluation_submission_respondent_user_id
    FOREIGN KEY (respondent_user_id) REFERENCES dbo.employee (user_id);
GO

-- The old key may exist as a unique CONSTRAINT or as a plain unique INDEX depending on how it was
-- first created, and the two are dropped by different statements. Handle both, then recreate.
IF EXISTS (SELECT 1 FROM sys.key_constraints
           WHERE name = 'UQ_evaluation_submission_evaluation_form_id_enrollment_id'
             AND parent_object_id = OBJECT_ID(N'dbo.evaluation_submission'))
  ALTER TABLE dbo.evaluation_submission
    DROP CONSTRAINT UQ_evaluation_submission_evaluation_form_id_enrollment_id;
GO

IF EXISTS (SELECT 1 FROM sys.indexes
           WHERE name = 'UQ_evaluation_submission_evaluation_form_id_enrollment_id'
             AND object_id = OBJECT_ID(N'dbo.evaluation_submission'))
  DROP INDEX UQ_evaluation_submission_evaluation_form_id_enrollment_id
    ON dbo.evaluation_submission;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'UQ_evaluation_submission_form_enrollment_respondent'
                 AND object_id = OBJECT_ID(N'dbo.evaluation_submission'))
  CREATE UNIQUE INDEX UQ_evaluation_submission_form_enrollment_respondent
    ON dbo.evaluation_submission (evaluation_form_id, enrollment_id, respondent_user_id);
GO
