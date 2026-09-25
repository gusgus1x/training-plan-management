/*
TrainingPlanManagement
Migration 48: Update Training Plan Batch and Round Unique Constraint

Allows multiple rounds (batch_name) within the same batch (batch_no)
for an OAP plan, supporting the new Batch & Round management workflow.
*/
USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  -- 1. Drop existing unique constraint on (oap_plan_id, batch_no) if exists
  IF EXISTS (
    SELECT 1 FROM sys.key_constraints 
    WHERE name = N'UQ_training_plan_oap_batch_no' 
      AND parent_object_id = OBJECT_ID(N'dbo.training_plan')
  )
  BEGIN
    ALTER TABLE dbo.training_plan
      DROP CONSTRAINT UQ_training_plan_oap_batch_no;
  END;

  IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = N'UQ_training_plan_oap_batch_no' 
      AND object_id = OBJECT_ID(N'dbo.training_plan')
  )
  BEGIN
    DROP INDEX UQ_training_plan_oap_batch_no ON dbo.training_plan;
  END;

  -- 2. Ensure batch_name is NOT NULL or create composite unique index on (oap_plan_id, batch_no, batch_name)
  -- Since batch_name can be nullable in older records, we create a unique index where batch_name is included
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = N'UQ_training_plan_oap_batch_round' 
      AND object_id = OBJECT_ID(N'dbo.training_plan')
  )
  BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_training_plan_oap_batch_round
      ON dbo.training_plan (oap_plan_id, batch_no, batch_name)
      WHERE batch_name IS NOT NULL;
  END;

  COMMIT TRANSACTION;
  PRINT 'Migration 48 applied successfully: UQ_training_plan_oap_batch_no updated to allow multiple rounds per batch.';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
