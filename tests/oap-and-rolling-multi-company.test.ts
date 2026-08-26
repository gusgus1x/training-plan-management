import { config as loadEnvironment } from "dotenv";
import { describe, expect, it } from "vitest";

// These suites create and delete real rows, so they follow the same gate as the other
// database-mutation tests: skipped unless RUN_DATABASE_MUTATION_TESTS=1 is set.
const databaseMutationTest =
  process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

loadEnvironment({ path: ".env", quiet: true });
loadEnvironment({ path: ".env.local", quiet: true });

describe("OAP Plan & Rolling Plan Multi-User Verification Test", () => {
  databaseMutationTest("tests OAP Plan and Rolling Plan creation for HRD_CENTER and HRD_FACTORY for each company", async () => {
    const { getPrismaClient } = await import("../app/lib/database/prisma");
    const { courseService } = await import("../app/lib/courses/service");
    const { parseCreateCourse } = await import("../app/lib/courses/validation");
    const { oapPlanService } = await import("../app/lib/trainingOap/service");
    const { parseCreateOapPlan } = await import("../app/lib/trainingOap/validation");
    const { rollingPlanService } = await import("../app/lib/trainingRolling/service");
    const { parseCreateRollingPlan } = await import("../app/lib/trainingRolling/validation");

    const prisma = getPrismaClient();

    // 1. Fetch prerequisite data (Course group, course type, companies, valid user)
    const courseGroup = await prisma.course_group.findFirst({ where: { status: "ACTIVE" } });
    const courseType = await prisma.course_type.findFirst({ where: { status: "ACTIVE" } });
    const companies = await prisma.company.findMany({ select: { company_id: true, company_code: true, company_name_th: true } });
    const userAccount = await prisma.user_account.findFirst({ where: { status: "ACTIVE" } });

    expect(courseGroup).not.toBeNull();
    expect(courseType).not.toBeNull();
    expect(companies.length).toBeGreaterThan(0);
    expect(userAccount).not.toBeNull();

    const userId = userAccount!.user_id.toString();
    const allCompanyIds = companies.map(c => c.company_id.toString());

    console.log(`\n================================================================`);
    console.log(`[TEST INITIATED]: Multi-User OAP Plan & Rolling Plan Lifecycle Test`);
    console.log(`User Account: ID ${userId} (${userAccount!.username})`);
    console.log(`Target Companies (${companies.length}):`, companies.map(c => `${c.company_code} (ID:${c.company_id})`).join(", "));
    console.log(`================================================================\n`);

    const createdCourseIds: string[] = [];
    const createdOapPlanIds: string[] = [];
    const createdRollingPlanIds: string[] = [];

    try {
      // -----------------------------------------------------------------------
      // STEP 1: HRD_CENTER Creates Center Course -> OAP Plan -> Rolling Plan
      // -----------------------------------------------------------------------
      const centerRandom = Math.random().toString(36).substring(2, 10).toUpperCase();
      const centerCourseInput = parseCreateCourse({
        courseGroupId: courseGroup!.course_group_id.toString(),
        courseTypeId: courseType!.course_type_id.toString(),
        courseNameTh: `CenterOapTh_${centerRandom}`,
        courseNameEn: `CenterOapEn_${centerRandom}`,
        durationHours: 6,
        objective: "วัตถุประสงค์หลักสูตร OAP ส่วนกลาง",
        targetGroup: "พนักงานส่วนกลาง",
        standardCode: `STD_CTR_${centerRandom}`,
        standardName: `StdCtr_${centerRandom}`,
        targetCompanies: allCompanyIds,
        status: "Active"
      });
      const centerCourse = await courseService.createCourse(centerCourseInput, userId, null);
      createdCourseIds.push(centerCourse.courseId);

      // Create Center OAP Plan
      const centerOapInput = parseCreateOapPlan({
        courseId: centerCourse.courseId,
        planYear: 2026,
        participants: 30,
        hours: 6,
        budget: "50000",
        budgetInstructor: "20000",
        budgetMaterial: "10000",
        status: "Planned"
      });
      const centerOapPlan = await oapPlanService.createOapPlan(centerOapInput, userId, null);
      createdOapPlanIds.push(centerOapPlan.id);

      // Create Center Rolling Plan
      const centerRollingInput = parseCreateRollingPlan({
        oapPlanId: centerOapPlan.id,
        batchName: "B01",
        venue: "ห้องประชุมใหญ่ Center",
        trainingDate: "2026-10-15",
        endDate: "2026-10-15",
        startTime: "09:00",
        endTime: "16:00",
        status: "Planned"
      });
      const centerRollingPlan = await rollingPlanService.createRollingPlan(centerRollingInput, userId, null);
      createdRollingPlanIds.push(centerRollingPlan.id);

      console.log(`\n----------------------------------------------------------------`);
      console.log(`✅ [HRD_CENTER] Created OAP Plan:`);
      console.log(`   OAP Plan ID : ${centerOapPlan.id}`);
      console.log(`   Course Code : ${centerCourse.courseCode}`);
      console.log(`   Company     : All Companies (Center Scope)`);
      console.log(`✅ [HRD_CENTER] Created Rolling Plan:`);
      console.log(`   Rolling Code : ${centerRollingPlan.planCode}`);
      console.log(`   Rolling ID   : ${centerRollingPlan.id}`);
      console.log(`   Batch Name        : ${centerRollingPlan.batchName}`);
      console.log(`----------------------------------------------------------------\n`);

      expect(centerOapPlan.id).toBeDefined();
      expect(centerRollingPlan.planCode).toBeDefined();

      // -----------------------------------------------------------------------
      // STEP 2: HRD_FACTORY Creates Factory Course -> OAP Plan -> Rolling Plan per Company
      // -----------------------------------------------------------------------
      for (const company of companies) {
        const companyId = company.company_id.toString();
        const factoryRandom = Math.random().toString(36).substring(2, 10).toUpperCase();

        // 2a. Create Factory Course
        const factoryCourseInput = parseCreateCourse({
          courseGroupId: courseGroup!.course_group_id.toString(),
          courseTypeId: courseType!.course_type_id.toString(),
          courseNameTh: `FacOapTh_${company.company_code}_${factoryRandom}`,
          courseNameEn: `FacOapEn_${company.company_code}_${factoryRandom}`,
          durationHours: 4,
          objective: `วัตถุประสงค์ OAP ของ ${company.company_code}`,
          targetGroup: `พนักงาน ${company.company_code}`,
          standardCode: `STD_${company.company_code}_${factoryRandom}`,
          standardName: `StdFac_${company.company_code}_${factoryRandom}`,
          targetCompanies: [companyId],
          status: "Active"
        });
        const factoryCourse = await courseService.createCourse(factoryCourseInput, userId, companyId);
        createdCourseIds.push(factoryCourse.courseId);

        // 2b. Create Factory OAP Plan
        const factoryOapInput = parseCreateOapPlan({
          courseId: factoryCourse.courseId,
          planYear: 2026,
          participants: 25,
          hours: 4,
          budget: "35000",
          budgetInstructor: "15000",
          status: "Planned"
        });
        const factoryOapPlan = await oapPlanService.createOapPlan(factoryOapInput, userId, companyId);
        createdOapPlanIds.push(factoryOapPlan.id);

        console.log(`----------------------------------------------------------------`);
        console.log(`✅ [HRD_FACTORY - ${company.company_code}] Created OAP Plan:`);
        console.log(`   OAP Plan ID : ${factoryOapPlan.id}`);
        console.log(`   Course Code : ${factoryCourse.courseCode}`);
        console.log(`   Company     : ${company.company_name_th} (${factoryOapPlan.ownerCompany})`);

        // 2c. Create Factory Rolling Plan
        const factoryRollingInput = parseCreateRollingPlan({
          oapPlanId: factoryOapPlan.id,
          batchName: `รุ่นที่ 1 (${company.company_code})`,
          venue: `ห้องอบรมโรงงาน ${company.company_code}`,
          trainingDate: "2026-10-10",
          endDate: "2026-10-10",
          startTime: "08:30",
          endTime: "15:30",
          status: "Planned"
        });
        const factoryRollingPlan = await rollingPlanService.createRollingPlan(factoryRollingInput, userId, companyId);
        createdRollingPlanIds.push(factoryRollingPlan.id);

        console.log(`✅ [HRD_FACTORY - ${company.company_code}] Created Rolling Plan:`);
        console.log(`   Rolling Code : ${factoryRollingPlan.planCode}`);
        console.log(`   Rolling ID   : ${factoryRollingPlan.id}`);
        console.log(`   Venue        : ${factoryRollingPlan.venue}`);
        console.log(`----------------------------------------------------------------`);

        expect(factoryOapPlan.id).toBeDefined();
        expect(factoryRollingPlan.planCode).toBeDefined();

        // -----------------------------------------------------------------------
        // STEP 3: Verify Listing & Scope Isolation
        // -----------------------------------------------------------------------
        // Factory lists OAP plans for its company
        const factoryOapList = await oapPlanService.listOapPlans({ search: null, status: null }, companyId);
        const factoryOapIds = factoryOapList.map(p => p.id);
        expect(factoryOapIds).toContain(centerOapPlan.id);
        expect(factoryOapIds).toContain(factoryOapPlan.id);

        // Factory lists Rolling plans for its company
        const factoryRollingList = await rollingPlanService.listRollingPlans({ search: null, status: null, oapPlanId: null }, companyId);
        const factoryRollingCodes = factoryRollingList.map(p => p.planCode);
        expect(factoryRollingCodes).toContain(centerRollingPlan.planCode);
        expect(factoryRollingCodes).toContain(factoryRollingPlan.planCode);
      }

      // Center lists all OAP & Rolling plans
      const centerOapList = await oapPlanService.listOapPlans({ search: null, status: null }, null);
      const centerRollingList = await rollingPlanService.listRollingPlans({ search: null, status: null, oapPlanId: null }, null);
      expect(centerOapList.map(p => p.id)).toContain(centerOapPlan.id);
      expect(centerRollingList.map(p => p.planCode)).toContain(centerRollingPlan.planCode);

      console.log(`\n================================================================`);
      console.log(`🎉 [SUCCESS]: All OAP & Rolling Plan creations verified!`);
      console.log(`   - Total OAP Plans Created    : ${createdOapPlanIds.length} (1 Center + ${companies.length} Companies)`);
      console.log(`   - Total Rolling Plans Created: ${createdRollingPlanIds.length} (1 Center + ${companies.length} Companies)`);
      console.log(`================================================================\n`);
    } finally {
      // -----------------------------------------------------------------------
      // STEP 4: Cleanup (Delete Rolling Plans -> OAP Plans -> Courses)
      // -----------------------------------------------------------------------
      for (const planId of createdRollingPlanIds) {
        await rollingPlanService.deleteRollingPlan(planId, null).catch(err => console.error(`Rolling cleanup error ${planId}:`, err));
      }
      for (const oapId of createdOapPlanIds) {
        await oapPlanService.deleteOapPlan(oapId).catch(err => console.error(`OAP cleanup error ${oapId}:`, err));
      }
      for (const courseId of createdCourseIds) {
        await courseService.deleteCourse(courseId, userId, null).catch(err => console.error(`Course cleanup error ${courseId}:`, err));
      }
      console.log(`🧹 Cleaned up ${createdRollingPlanIds.length} Rolling Plans, ${createdOapPlanIds.length} OAP Plans, and ${createdCourseIds.length} Courses.\n`);
    }
  }, 90000);
});
