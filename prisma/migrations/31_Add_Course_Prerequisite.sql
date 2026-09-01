/*
TrainingPlanManagement
Migration 31: Add course prerequisites (continuation courses)

A course can now require other courses to be completed first: "course A must be finished before
course B can be registered for". One row is one condition, read as "course_id can only be
registered once prerequisite_course_id has been completed".

Kept out of dbo.course deliberately. A course may require several others, and a single column
would force a delimited string - unqueryable, unconstrained by a foreign key, and silently left
holding ids of courses that were later deleted. This mirrors course_standard_target_company
(migration 21): a join table with its own identity PK and a unique pair.

The two foreign keys are asymmetric on purpose. SQL Server refuses more than one cascade path
into the same table (error 1785), so only the owning side cascades; rows pointing AT a deleted
course are cleared by app/lib/courses/repository.ts delete() before the course row goes.

What is deliberately not stored:
  - no sequence: every prerequisite must be met, there is no order between them
  - no transitive closure: A->B->C does not record "C requires A", because B was unreachable
    without A anyway, and a stored copy would drift when the conditions are edited
  - no "is a continuation course" flag: that is answered by whether any row exists here
*/
USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.course_prerequisite', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.course_prerequisite
    (
      course_prerequisite_id BIGINT IDENTITY(1,1) NOT NULL,
      -- The course that carries the condition: the one an employee is trying to register for.
      course_id              BIGINT NOT NULL,
      -- The course that must be completed first.
      prerequisite_course_id BIGINT NOT NULL,
      created_at             DATETIME2 NOT NULL
        CONSTRAINT DF_course_prerequisite_created_at DEFAULT (sysdatetime()),

      CONSTRAINT PK_course_prerequisite PRIMARY KEY CLUSTERED (course_prerequisite_id),
      -- The same condition twice would list the course twice on screen.
      CONSTRAINT UQ_course_prerequisite UNIQUE (course_id, prerequisite_course_id),
      -- A course requiring itself can never be registered for by anyone.
      CONSTRAINT CK_course_prerequisite_not_self CHECK (course_id <> prerequisite_course_id)
    );
  END;

  IF OBJECT_ID(N'dbo.FK_course_prerequisite_course_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.course_prerequisite WITH CHECK
      ADD CONSTRAINT FK_course_prerequisite_course_id
      FOREIGN KEY (course_id) REFERENCES dbo.course (course_id)
      ON DELETE CASCADE;
  END;

  -- NO ACTION, not CASCADE: SQL Server allows only one cascade path into dbo.course. Deleting a
  -- course that other courses depend on is handled in the repository's delete transaction.
  IF OBJECT_ID(N'dbo.FK_course_prerequisite_prerequisite_course_id', N'F') IS NULL
  BEGIN
    ALTER TABLE dbo.course_prerequisite WITH CHECK
      ADD CONSTRAINT FK_course_prerequisite_prerequisite_course_id
      FOREIGN KEY (prerequisite_course_id) REFERENCES dbo.course (course_id);
  END;

  -- Deleting a course asks "which courses depend on this one?", which reads the second column.
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_course_prerequisite_prerequisite_course_id'
      AND object_id = OBJECT_ID(N'dbo.course_prerequisite')
  )
  BEGIN
    CREATE INDEX IX_course_prerequisite_prerequisite_course_id
      ON dbo.course_prerequisite (prerequisite_course_id);
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
