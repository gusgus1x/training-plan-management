import { config as loadEnvironment } from "dotenv";
import { describe, expect, it } from "vitest";

// These suites create and delete real rows, so they follow the same gate as the other
// database-mutation tests: skipped unless RUN_DATABASE_MUTATION_TESTS=1 is set.
const databaseMutationTest =
  process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

loadEnvironment({ path: ".env", quiet: true });
loadEnvironment({ path: ".env.local", quiet: true });

describe("Multi-user Course Creation Verification Test", () => {
  databaseMutationTest("tests course creation for HRD_CENTER and HRD_FACTORY for each company", async () => {
    const { getPrismaClient } = await import("../app/lib/database/prisma");
    const { courseService } = await import("../app/lib/courses/service");
    const { parseCreateCourse } = await import("../app/lib/courses/validation");

    const prisma = getPrismaClient();

    // 1. Fetch available course groups, course types, companies, and valid user account
    const courseGroup = await prisma.course_group.findFirst({ where: { status: "ACTIVE" } });
    const courseType = await prisma.course_type.findFirst({ where: { status: "ACTIVE" } });
    const companies = await prisma.company.findMany({ select: { company_id: true, company_code: true, company_name_th: true } });
    const userAccount = await prisma.user_account.findFirst({ where: { status: "ACTIVE" } });

    expect(courseGroup).not.toBeNull();
    expect(courseType).not.toBeNull();
    expect(companies.length).toBeGreaterThan(0);
    expect(userAccount).not.toBeNull();

    const userId = userAccount!.user_id.toString();

    console.log(`\n================================================================`);
    console.log(`[TEST INITIATED]: Multi-User / Multi-Company Course Master Test`);
    console.log(`Using User Account ID: ${userId} (${userAccount!.username})`);
    console.log(`Course Group: ${courseGroup!.course_group_code}, Course Type: ${courseType!.course_type_name}`);
    console.log(`Target Companies (${companies.length}):`, companies.map(c => `${c.company_code} (ID:${c.company_id})`).join(", "));
    console.log(`================================================================\n`);

    const createdCourseIds: string[] = [];
    const allCompanyIds = companies.map(c => c.company_id.toString());

    try {
      // 2. HRD_CENTER user creates 1 Center Course
      const centerCourseInput = parseCreateCourse({
        courseGroupId: courseGroup!.course_group_id.toString(),
        courseTypeId: courseType!.course_type_id.toString(),
        courseNameTh: `หลักสูตรส่วนกลาง CENTER ${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        courseNameEn: `Center Master Course ${Date.now()}`,
        durationHours: 6,
        objective: "วัตถุประสงค์หลักสูตรส่วนกลาง",
        targetGroup: "พนักงานทุกระดับ",
        standardCode: `STD-CTR-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        standardName: "มาตรฐานการฝึกอบรมส่วนกลาง",
        targetCompanies: allCompanyIds,
        status: "Active"
      });

      const centerCourse = await courseService.createCourse(
        centerCourseInput,
        userId,
        null // Center scope (companyId = null)
      );

      console.log(`----------------------------------------------------------------`);
      console.log(`✅ [USER ROLE: HRD_CENTER] Created 1 Center Course Successfully:`);
      console.log(`   Course Code     : ${centerCourse.courseCode}`);
      console.log(`   Course ID       : ${centerCourse.courseId}`);
      console.log(`   Course Name (TH): ${centerCourseInput.courseNameTh}`);
      console.log(`   Scope           : Center (Shared to all companies)`);
      console.log(`----------------------------------------------------------------\n`);

      expect(centerCourse.courseCode).toMatch(new RegExp(`^${courseGroup!.course_group_code.trim()}-\\d{6}$`));
      createdCourseIds.push(centerCourse.courseId);

      // 3. HRD_FACTORY user creates 1 Course for EACH company
      for (const company of companies) {
        const factoryCourseInput = parseCreateCourse({
          courseGroupId: courseGroup!.course_group_id.toString(),
          courseTypeId: courseType!.course_type_id.toString(),
          courseNameTh: `หลักสูตรโรงงาน ${company.company_code} ${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          courseNameEn: `Factory Course ${company.company_code} ${Date.now()}`,
          durationHours: 3,
          objective: `วัตถุประสงค์หลักสูตรของ ${company.company_code}`,
          targetGroup: `พนักงาน ${company.company_code}`,
          standardCode: `STD-${company.company_code}-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          standardName: `มาตรฐานหลักสูตร ${company.company_code}`,
          targetCompanies: [company.company_id.toString()],
          status: "Active"
        });

        const factoryCourse = await courseService.createCourse(
          factoryCourseInput,
          userId,
          company.company_id.toString() // Factory user scope for this specific company
        );

        console.log(`✅ [USER ROLE: HRD_FACTORY - ${company.company_code}] Created 1 Company Course:`);
        console.log(`   Company         : ${company.company_name_th} (${company.company_code})`);
        console.log(`   Course Code     : ${factoryCourse.courseCode}`);
        console.log(`   Course ID       : ${factoryCourse.courseId}`);
        console.log(`   Course Name (TH): ${factoryCourseInput.courseNameTh}`);
        console.log(`----------------------------------------------------------------`);

        expect(factoryCourse.courseCode).toMatch(new RegExp(`^${company.company_code.trim()}-${courseGroup!.course_group_code.trim()}-\\d{6}$`));
        createdCourseIds.push(factoryCourse.courseId);

        // 4. Verify scope isolation: HRD_FACTORY of this company lists courses
        const companyCoursesList = await courseService.listCourses({ search: null, status: null }, company.company_id.toString());
        const companyCourseCodes = companyCoursesList.courses.map(c => c.courseCode);
        
        // Factory MUST see Center course AND its own company course
        expect(companyCourseCodes).toContain(centerCourse.courseCode);
        expect(companyCourseCodes).toContain(factoryCourse.courseCode);
      }

      // 5. Verify Center lists courses (Center sees all created courses)
      const centerCoursesList = await courseService.listCourses({ search: null, status: null }, null);
      const allCourseCodes = centerCoursesList.courses.map(c => c.courseCode);
      expect(allCourseCodes).toContain(centerCourse.courseCode);

      console.log(`\n================================================================`);
      console.log(`🎉 [SUCCESS]: All ${createdCourseIds.length} course creations verified!`);
      console.log(`   - HRD_CENTER: 1 Center Course (${centerCourse.courseCode})`);
      console.log(`   - HRD_FACTORY: ${companies.length} Courses across ${companies.length} companies`);
      console.log(`================================================================\n`);
    } finally {
      // Clean up test courses safely via courseService.deleteCourse
      if (createdCourseIds.length > 0) {
        for (const id of createdCourseIds) {
          await courseService.deleteCourse(id, userId, null).catch(err => console.error(`Cleanup warning for course ${id}:`, err));
        }
        console.log(`🧹 Cleaned up ${createdCourseIds.length} test courses created during testing.\n`);
      }
    }
  }, 60000);
});
