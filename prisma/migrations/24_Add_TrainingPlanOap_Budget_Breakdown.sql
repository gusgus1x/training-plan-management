USE [TrainingPlanManagementDB];
GO

SET XACT_ABORT ON;
GO

-- Splits Training OAP's single Budget field into 6 categories (Instructor, Traveling,
-- Seminar Room, Accommodation, Material, Food & Beverage). total_planned_budget is kept
-- as-is (the UI computes and sends the sum), these columns store the per-category
-- breakdown so it survives a reload and can be edited later.
BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'budget_instructor') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD budget_instructor DECIMAL(14, 2) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'budget_traveling') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD budget_traveling DECIMAL(14, 2) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'budget_seminar_room') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD budget_seminar_room DECIMAL(14, 2) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'budget_accommodation') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD budget_accommodation DECIMAL(14, 2) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'budget_material') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD budget_material DECIMAL(14, 2) NULL;
  END;

  IF COL_LENGTH(N'dbo.training_plan_oap', N'budget_food_beverage') IS NULL
  BEGIN
    ALTER TABLE dbo.training_plan_oap
      ADD budget_food_beverage DECIMAL(14, 2) NULL;
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
