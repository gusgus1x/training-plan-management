USE [TrainingPlanManagementDB];
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.course_type TO [training_plan_app];
  GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.course_group TO [training_plan_app];
  GRANT SELECT ON dbo.course TO [training_plan_app];

  DECLARE @created_by BIGINT = (
    SELECT TOP (1) ua.user_id
    FROM dbo.user_account AS ua
    INNER JOIN dbo.role AS r ON r.role_id = ua.role_id
    WHERE r.role_code = 'HRD_CENTER'
      AND r.status = 'ACTIVE'
      AND ua.status = 'ACTIVE'
    ORDER BY ua.user_id
  );

  IF @created_by IS NULL
    THROW 51000, 'An active HRD_CENTER account is required before seeding course classification masters.', 1;

  DECLARE @course_types TABLE (code VARCHAR(30), name NVARCHAR(150));
  INSERT INTO @course_types (code, name) VALUES
    ('ATA-TC', N'ATA-TC'),
    ('IN-HOUSE', N'IN-HOUSE'),
    ('PUBLIC', N'PUBLIC'),
    ('OJT', N'OJT');

  INSERT INTO dbo.course_type (
    course_type_code, course_type_name, course_type_name_normalized,
    description, status, has_been_used, created_by, created_at
  )
  SELECT source.code, source.name, LOWER(LTRIM(RTRIM(source.name))),
         NULL, 'ACTIVE', 0, @created_by, SYSUTCDATETIME()
  FROM @course_types AS source
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.course_type AS target
    WHERE target.course_type_code = source.code
       OR target.course_type_name_normalized = LOWER(LTRIM(RTRIM(source.name)))
  );

  DECLARE @course_groups TABLE (code CHAR(2), name NVARCHAR(255));
  INSERT INTO @course_groups (code, name) VALUES
    ('QT', N'Quality'), ('ST', N'Safety'), ('CT', N'Casting'),
    ('MG', N'Management'), ('DQ', N'Die Quenching'), ('PT', N'Promotion'),
    ('MT', N'Maintenance'), ('PD', N'Production'), ('AL', N'AL Prod.'),
    ('SY', N'System'), ('MC', N'Machining'), ('SP', N'Special'),
    ('CO', N'Cost'), ('MR', N'Moral'), ('OT', N'Other');

  INSERT INTO dbo.course_group (
    course_group_code, course_group_name, course_group_name_normalized,
    last_course_number, status, created_by, created_at
  )
  SELECT source.code, source.name, LOWER(LTRIM(RTRIM(source.name))),
         0, 'ACTIVE', @created_by, SYSUTCDATETIME()
  FROM @course_groups AS source
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.course_group AS target
    WHERE target.course_group_code = source.code
       OR target.course_group_name_normalized = LOWER(LTRIM(RTRIM(source.name)))
  );

  COMMIT TRANSACTION;

  SELECT 'course_type' AS master_name, COUNT(*) AS record_count FROM dbo.course_type
  UNION ALL
  SELECT 'course_group', COUNT(*) FROM dbo.course_group;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
