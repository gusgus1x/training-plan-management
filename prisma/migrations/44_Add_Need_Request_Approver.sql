/*
  44_Add_Need_Request_Approver.sql

  A training need request now goes to the requester's section head before it reaches HRD. The
  employee picks that head when submitting; the head approves or rejects on the Request Training
  page; only an approved request is handed to HRD, who still makes the final call.

  WHY COLUMNS AND NOT A TABLE

  One request has exactly one approver, chosen when the request is created and never more than one
  at a time. training_evaluation_reviewer is a separate table because the assignment is made later
  and replaced; here a table would only add a join to every read of the request.

  status IS UNTOUCHED

  CK_RC2_training_need_request_status_enum keeps its four values. "Waiting for the head" and
  "waiting for HRD" are both status PENDING, told apart by approver_decision. A head's rejection
  sets status REJECTED with the head's note as rejection_reason, so every screen that already reads
  REJECTED keeps working.

  NULL approver_user_id MEANS "SENT BEFORE THIS STEP EXISTED"

  Requests created before this migration have no approver. HRD handles them exactly as before.
  Nothing backfills a guess: this system holds no reporting line to guess from.

  Safe to run more than once.
*/

IF COL_LENGTH('dbo.training_need_request', 'approver_user_id') IS NULL
  ALTER TABLE dbo.training_need_request ADD approver_user_id NVARCHAR(50) NULL;
GO

IF COL_LENGTH('dbo.training_need_request', 'approver_decision') IS NULL
  ALTER TABLE dbo.training_need_request ADD approver_decision NVARCHAR(20) NULL;
GO

IF COL_LENGTH('dbo.training_need_request', 'approver_decided_at') IS NULL
  ALTER TABLE dbo.training_need_request ADD approver_decided_at DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.training_need_request', 'approver_note') IS NULL
  ALTER TABLE dbo.training_need_request ADD approver_note NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.training_need_request', 'approver_opened_at') IS NULL
  ALTER TABLE dbo.training_need_request ADD approver_opened_at DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
               WHERE name = 'FK_training_need_request_approver_user_id')
  ALTER TABLE dbo.training_need_request WITH CHECK
    ADD CONSTRAINT FK_training_need_request_approver_user_id
    FOREIGN KEY (approver_user_id) REFERENCES dbo.employee (user_id);
GO

-- A decision without a moment it was made, or a moment without a decision, is a half-written row.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = 'CK_training_need_request_approver_decision')
  ALTER TABLE dbo.training_need_request WITH CHECK
    ADD CONSTRAINT CK_training_need_request_approver_decision
    CHECK (
      (approver_decision IS NULL AND approver_decided_at IS NULL)
      OR (approver_decision IN (N'APPROVED', N'REJECTED') AND approver_decided_at IS NOT NULL AND approver_user_id IS NOT NULL)
    );
GO

-- The head's own list ("requests waiting for me") is the read that runs most often.
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_training_need_request_approver_user_id'
                 AND object_id = OBJECT_ID(N'dbo.training_need_request'))
  CREATE INDEX IX_training_need_request_approver_user_id
    ON dbo.training_need_request (approver_user_id);
GO
