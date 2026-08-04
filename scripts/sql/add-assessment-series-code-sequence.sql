USE [TrainingPlanManagementDB];
GO

IF OBJECT_ID(N'dbo.assessment_series_code_seq', N'SO') IS NULL
BEGIN
  DECLARE @next_assessment_code BIGINT = (
    SELECT ISNULL(MAX(TRY_CONVERT(BIGINT, SUBSTRING(series_code, 5, 46))), 0) + 1
    FROM dbo.assessment_series
    WHERE series_code LIKE N'ASM-[0-9]%'
  );
  DECLARE @create_sequence NVARCHAR(MAX) =
    N'CREATE SEQUENCE dbo.assessment_series_code_seq AS BIGINT START WITH ' +
    CONVERT(NVARCHAR(30), @next_assessment_code) +
    N' INCREMENT BY 1 MINVALUE 1 NO MAXVALUE NO CYCLE CACHE 20;';
  EXEC sys.sp_executesql @create_sequence;
END;
GO

GRANT UPDATE ON OBJECT::dbo.assessment_series_code_seq TO [training_plan_app];
GO
