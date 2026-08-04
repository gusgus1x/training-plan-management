USE [TrainingPlanManagementDB];
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.assessment_series TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.assessment TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.assessment_question TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.assessment_choice TO [training_plan_app];

-- Read-only dependencies used to lock versions once referenced or submitted.
GRANT SELECT ON dbo.course TO [training_plan_app];
GRANT SELECT ON dbo.training_plan_oap TO [training_plan_app];
GRANT SELECT ON dbo.assessment_submission TO [training_plan_app];
GRANT UPDATE ON OBJECT::dbo.assessment_series_code_seq TO [training_plan_app];
GO
