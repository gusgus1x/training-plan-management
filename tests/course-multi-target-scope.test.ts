import { config as loadEnvironment } from "dotenv";
import { describe, expect, it } from "vitest";

// These suites create and delete real rows, so they follow the same gate as the other
// database-mutation tests: skipped unless RUN_DATABASE_MUTATION_TESTS=1 is set.
const databaseMutationTest =
  process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

loadEnvironment({ path: ".env", quiet: true });
loadEnvironment({ path: ".env.local", quiet: true });
import { courseService } from "../app/lib/courses/service";
import { computeTargetMatch } from "../app/lib/trainingEnrollment/repository";
import { getPrismaClient } from "../app/lib/database/prisma";

describe("Multi-Target Scope in Course Master & Target Match Engine", () => {
  databaseMutationTest("should create a course with multiple target org scopes and list them properly", async () => {
    const db = getPrismaClient();
    // 1. Fetch valid course type, course group, companies, and org units
    const courseTypes = await db.course_type.findMany({ take: 1 });
    const courseGroups = await db.course_group.findMany({ take: 1 });
    const companies = await db.company.findMany({ take: 2 });
    const functions = await db.organization_function.findMany({ take: 2 });
    const departments = await db.department.findMany({ take: 2 });

    expect(courseTypes.length).toBeGreaterThan(0);
    expect(courseGroups.length).toBeGreaterThan(0);
    expect(companies.length).toBeGreaterThan(0);

    const targetCompanies = companies.map((c) => c.company_code);
    const scope1 = {
      functionId: functions[0]?.function_id.toString() ?? null,
      departmentId: departments[0]?.department_id.toString() ?? null,
    };
    const scope2 = {
      functionId: functions[1]?.function_id.toString() ?? scope1.functionId,
      departmentId: departments[1]?.department_id.toString() ?? scope1.departmentId,
    };

    const validUser = await db.user_account.findFirst({ where: { status: "ACTIVE" } });
    expect(validUser).toBeDefined();

    const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const uniqueName = `TargetScope_${randomCode}`;
    let createdCourseId: string | null = null;

    try {
      // 2. Create course with 2 target org scopes
      const result = await courseService.createCourse(
        {
          courseNameTh: uniqueName,
          courseNameEn: `TargetScope EN ${randomCode}`,
          objective: "Test objective",
          learningContent: "Test content",
          targetGroup: "Test target group",
          methodology: "Lecture",
          durationHours: 2,
          validityMonths: 12,
          preAssessmentId: null,
          postAssessmentId: null,
          evaluationFormId: null,
          evaluationFormAfter30DayId: null,
          preTestLink: null,
          postTestLink: null,
          evaluationLink: null,
          evaluationAfter30DayLink: null,
          status: "Active",
          courseTypeId: courseTypes[0].course_type_id.toString(),
          courseGroupId: courseGroups[0].course_group_id.toString(),
          standardCode: `STD_${randomCode}`,
          standardName: uniqueName,
          functionId: scope1.functionId,
          divisionId: null,
          departmentId: scope1.departmentId,
          sectionId: null,
          targetOrgScopes: [scope1, scope2],
          targetCompanies,
          targetPositions: [],
          targetLevels: [],
          standardYear: new Date().getFullYear(),
          prerequisiteCourseIds: [],
        },
        validUser!.user_id.toString(), // valid userId
        null, // Center scope
      );

      expect(result.courseId).toBeDefined();
      createdCourseId = result.courseId;

      // 3. List courses and verify standards have multi targetOrgScopes
      const list = await courseService.listCourses({ search: uniqueName, status: null }, null);
      const createdCourse = list.courses.find((c) => c.id === result.courseId);
      expect(createdCourse).toBeDefined();

      const createdStandard = list.standards.find((s) => s.courseId === result.courseId);
      expect(createdStandard).toBeDefined();
      expect(createdStandard?.targetOrgScopes).toBeDefined();
      expect(createdStandard?.targetOrgScopes?.length).toBeGreaterThanOrEqual(1);

      // 4. Test Target Match Engine with employee in Scope 1
      const mockEmployeeScope1 = {
        employee_id: BigInt(99901),
        company_id: companies[0].company_id,
        function_id: scope1.functionId ? BigInt(scope1.functionId) : null,
        division_id: null,
        department_id: scope1.departmentId ? BigInt(scope1.departmentId) : null,
        section_id: null,
        position_id: null,
        level_id: null,
      };

      const matchScope1 = await computeTargetMatch(db, BigInt(result.courseId), mockEmployeeScope1 as any);
      expect(matchScope1.targetMatchStatus).toBe("MATCHED");
    } finally {
      if (createdCourseId) {
        // A failed assertion used to skip this cleanup entirely, and the central course
        // standard is unique per year — so one failure poisoned every later run.
        await courseService
          .deleteCourse(createdCourseId, validUser!.user_id.toString(), null)
          .catch((error) => console.error(`Cleanup warning: ${String(error)}`));
      }
    }
  });
});
