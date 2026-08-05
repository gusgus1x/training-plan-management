USE [TrainingPlanManagementDB];
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.evaluation_form TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.evaluation_question TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.evaluation_option TO [training_plan_app];

GRANT SELECT ON dbo.course TO [training_plan_app];
GRANT SELECT ON dbo.training_plan_oap TO [training_plan_app];
GRANT SELECT ON dbo.evaluation_submission TO [training_plan_app];
GRANT UPDATE ON OBJECT::dbo.evaluation_form_code_seq TO [training_plan_app];
GO
