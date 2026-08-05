USE [TrainingPlanManagementDB];
GO

IF OBJECT_ID(N'dbo.evaluation_form_code_seq', N'SO') IS NULL
BEGIN
  DECLARE @next_evaluation_code BIGINT = (
    SELECT ISNULL(MAX(TRY_CONVERT(BIGINT, SUBSTRING(form_code, 5, 46))), 0) + 1
    FROM dbo.evaluation_form
    WHERE form_code LIKE N'EVA-[0-9]%'
  );
  DECLARE @create_sequence NVARCHAR(MAX) =
    N'CREATE SEQUENCE dbo.evaluation_form_code_seq AS BIGINT START WITH ' +
    CONVERT(NVARCHAR(30), @next_evaluation_code) +
    N' INCREMENT BY 1 MINVALUE 1 NO MAXVALUE NO CYCLE CACHE 20;';
  EXEC sys.sp_executesql @create_sequence;
END;
GO

GRANT UPDATE ON OBJECT::dbo.evaluation_form_code_seq TO [training_plan_app];
GO
