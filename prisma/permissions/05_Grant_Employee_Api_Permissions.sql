USE [TrainingPlanManagementDB];
GO
IF USER_ID(N'training_plan_app') IS NULL
    THROW 52800, 'Database user training_plan_app was not found.', 1;

GRANT SELECT ON dbo.employee
(
 employee_id, company_id, function_id, position_id, level_id, employee_code,
 national_id_hash, national_id_encrypted, national_id_key_version,
 birth_date, title_th, title_en, first_name_th, last_name_th, first_name_en,
 last_name_en, telephone, email, hire_date, employment_status, national_id_last4
) TO training_plan_app;
GRANT INSERT, DELETE ON OBJECT::dbo.employee TO training_plan_app;
GRANT UPDATE ON dbo.employee
(
 company_id, function_id, position_id, level_id, employee_code,
 national_id_hash, national_id_encrypted, national_id_last4,
 national_id_key_version, birth_date, title_th, title_en, first_name_th,
 last_name_th, first_name_en, last_name_en, telephone, email, hire_date,
 employment_status
) TO training_plan_app;

GRANT SELECT ON OBJECT::dbo.training_enrollment TO training_plan_app;
GRANT SELECT ON OBJECT::dbo.training_plan TO training_plan_app;
GO
