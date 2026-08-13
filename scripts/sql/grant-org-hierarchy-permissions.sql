USE [TrainingPlanManagementDB];
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.division TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.department TO [training_plan_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.section TO [training_plan_app];

-- New employee columns from migration 18 need their own column-level grant;
-- existing column-level grants on dbo.employee do not automatically cover new columns.
GRANT SELECT, UPDATE ON dbo.employee (division_id, department_id, section_id) TO [training_plan_app];
GO
