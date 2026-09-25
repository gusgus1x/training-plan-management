import { describe, expect, it, vi } from "vitest";
import { createOapPlanRepository } from "../../app/lib/trainingOap/repository";

describe("OAP Target Standard Persistence in DB", () => {
  it("creates OAP plan with target positions, levels, companies, and org scope stored in relational tables/fields", async () => {
    const mockCourse = {
      course_id: BigInt(100),
      course_code: "CRS-SAFETY",
      course_name: "Safety Level 1",
      course_name_en: "Safety Level 1 EN",
      objective: "Basic Safety Rules",
      target_group: "All factory workers",
      pre_assessment_id: null,
      post_assessment_id: null,
      evaluation_form_id: null,
      evaluation_form_after_30day_id: null,
      company_id: null,
      course_standard_course: [
        {
          function_id: BigInt(5),
          division_id: BigInt(6),
          department_id: BigInt(7),
          section_id: BigInt(8),
          course_standard: { standard_year: 2026 },
          organization_function: { function_name_th: "การผลิต", function_name_en: "Production" },
          division: { division_name_th: "ฝ่ายผลิต", division_name_en: "Mfg Division" },
          department: { department_name_th: "แผนกความปลอดภัย", department_name_en: "Safety Dept" },
          section: { section_name_th: "ส่วนงาน 1", section_name_en: "Sec 1" },
          course_standard_target_position: [
            { position_id: BigInt(101), position: { position_name_en: "Safety Officer", position_name_th: "จนท.ความปลอดภัย", position_code: "SAF-01" } },
            { position_id: BigInt(102), position: { position_name_en: "Junior Tech", position_name_th: "ช่างเทคนิค", position_code: "TECH-01" } },
          ],
          course_standard_target_level: [
            { level_id: BigInt(201), employee_level: { level_code: "L1", level_code_en: "L1", level_key: "L1" } },
            { level_id: BigInt(202), employee_level: { level_code: "L2", level_code_en: "L2", level_key: "L2" } },
          ],
          course_standard_target_company: [
            { company_id: BigInt(301), company: { company_code: "HMT" } },
          ],
        },
      ],
      course_type: { course_type_name: "Safety" },
      course_group: { course_group_name: "Mandatory" },
      created_by: BigInt(1),
      created_at: new Date(),
    };

    let createArgs: unknown = null;
    const create = vi.fn().mockImplementation((args) => {
      createArgs = args;
      return Promise.resolve({
        oap_plan_id: BigInt(99),
        plan_year: 2026,
        course_name_snapshot: mockCourse.course_name,
        course_description_snapshot: mockCourse.objective,
        default_participant_count: 30,
        planned_duration_hours: 6,
        total_planned_budget: "10000",
        budget_instructor: null,
        budget_traveling: null,
        budget_seminar_room: null,
        budget_accommodation: null,
        budget_material: null,
        budget_food_beverage: null,
        instructor_name_text: null,
        provider_name_text: null,
        status: "OPEN",
        company_id: null,
        created_by: BigInt(1),
        created_at: new Date(),
        function_id: BigInt(5),
        division_id: BigInt(6),
        department_id: BigInt(7),
        section_id: BigInt(8),
        target_group_snapshot: "All factory workers",
        organization_function: { function_name_th: "การผลิต", function_name_en: "Production" },
        division: { division_name_th: "ฝ่ายผลิต", division_name_en: "Mfg Division" },
        department: { department_name_th: "แผนกความปลอดภัย", department_name_en: "Safety Dept" },
        section: { section_name_th: "ส่วนงาน 1", section_name_en: "Sec 1" },
        training_plan_oap_target_position: [
          { position: { position_name_en: "Safety Officer", position_name_th: "จนท.ความปลอดภัย", position_code: "SAF-01" } },
          { position: { position_name_en: "Junior Tech", position_name_th: "ช่างเทคนิค", position_code: "TECH-01" } },
        ],
        training_plan_oap_target_level: [
          { employee_level: { level_code: "L1", level_code_en: "L1", level_key: "L1" } },
          { employee_level: { level_code: "L2", level_code_en: "L2", level_key: "L2" } },
        ],
        training_plan_oap_target_company: [
          { company: { company_code: "HMT" } },
        ],
        course: mockCourse,
        instructor: null,
        institute_provider: null,
        company: null,
      });
    });

    const client = {
      course: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(mockCourse),
      },
      training_plan_oap: {
        findMany: vi.fn().mockResolvedValue([]),
        create,
      },
    };

    const repository = createOapPlanRepository(client as never);

    const result = await repository.create(
      {
        courseId: "100",
        planYear: 2026,
        participants: 30,
        hours: 6,
        budget: "10000",
        budgetInstructor: "",
        budgetTraveling: "",
        budgetSeminarRoom: "",
        budgetAccommodation: "",
        budgetMaterial: "",
        budgetFoodBeverage: "",
        trainerName: "",
        instructorId: null,
        providerName: "",
        providerId: null,
        status: "Planned",
      },
      "1",
      null,
    );

    // Verify created relational payload
    const data = (createArgs as { data: Record<string, unknown> }).data;
    expect(data.function_id).toBe(BigInt(5));
    expect(data.division_id).toBe(BigInt(6));
    expect(data.department_id).toBe(BigInt(7));
    expect(data.section_id).toBe(BigInt(8));
    expect(data.target_group_snapshot).toBe("Safety Officer, Junior Tech (L1, L2)");
    expect(data.training_plan_oap_target_position).toEqual({
      create: [{ position_id: BigInt(101) }, { position_id: BigInt(102) }],
    });
    expect(data.training_plan_oap_target_level).toEqual({
      create: [{ level_id: BigInt(201) }, { level_id: BigInt(202) }],
    });
    expect(data.training_plan_oap_target_company).toEqual({
      create: [{ company_id: BigInt(301) }],
    });

    // Verify mapped output
    expect(result.targetSnapshot?.targetPositions).toEqual(["Safety Officer", "Junior Tech"]);
    expect(result.targetSnapshot?.targetLevels).toEqual(["L1", "L2"]);
    expect(result.targetSnapshot?.targetCompanies).toEqual(["HMT"]);
    expect(result.targetSnapshot?.orgScope?.functionName).toBe("การผลิต");
    expect(result.course.targetPositions).toEqual(["Safety Officer", "Junior Tech"]);
  });

  it("reads directly from database target tables for existing OAP plans even if course standard changes later", async () => {
    // Stored OAP in DB has positions ["Safety Officer"], but course standard was modified later to ["Different Position"]
    const mockRow = {
      oap_plan_id: BigInt(10),
      plan_year: 2026,
      company_id: null,
      course_name_snapshot: "Safety Level 1",
      course_description_snapshot: "Objective text",
      planned_duration_hours: 6,
      default_participant_count: 20,
      total_planned_budget: "10000",
      budget_instructor: null,
      budget_traveling: null,
      budget_seminar_room: null,
      budget_accommodation: null,
      budget_material: null,
      budget_food_beverage: null,
      instructor_name_text: null,
      provider_id: null,
      provider_name_text: null,
      created_by: BigInt(1),
      status: "OPEN",
      function_id: BigInt(5),
      division_id: BigInt(6),
      department_id: BigInt(7),
      section_id: BigInt(8),
      target_group_snapshot: "Saved Target Group",
      organization_function: { function_name_th: "ฝ่ายบริหาร", function_name_en: "Admin" },
      division: { division_name_th: "ฝ่ายบุคคล", division_name_en: "HR Division" },
      department: { department_name_th: "แผนกฝึกอบรม", department_name_en: "Training Dept" },
      section: { section_name_th: "ส่วนงานหลัก", section_name_en: "Main Sec" },
      training_plan_oap_target_position: [
        { position: { position_name_en: "Safety Officer", position_name_th: "จนท.ความปลอดภัย", position_code: "SAF-01" } },
      ],
      training_plan_oap_target_level: [
        { employee_level: { level_code: "L1", level_code_en: "L1", level_key: "L1" } },
      ],
      training_plan_oap_target_company: [
        { company: { company_code: "HMT" } },
      ],
      course: {
        course_id: BigInt(100),
        course_code: "CRS-001",
        course_name: "Safety Level 1",
        course_name_en: "Safety Level 1 EN",
        objective: "Course master modified objective",
        learning_content: "Content",
        target_group: "Course master modified target group",
        methodology: "Workshop",
        pre_assessment_id: null,
        post_assessment_id: null,
        evaluation_form_id: null,
        evaluation_form_after_30day_id: null,
        validity_months: 12,
        description: "",
        status: "ACTIVE",
        company_id: null,
        created_by: BigInt(1),
        created_at: new Date(),
        updated_at: new Date(),
        course_type: { course_type_name: "Safety" },
        course_group: { course_group_name: "Mandatory" },
      },
      instructor: null,
      institute_provider: null,
      company: null,
    };

    const client = {
      training_plan_oap: {
        findMany: vi.fn().mockResolvedValue([mockRow]),
      },
      course: {},
    };

    const repository = createOapPlanRepository(client as never);
    const plans = await repository.list({ search: null, status: null, planYear: 2026 }, null);

    expect(plans).toHaveLength(1);
    const plan = plans[0];

    // Targets must come from the stored OAP relational data, not the course master!
    expect(plan.targetSnapshot?.targetPositions).toEqual(["Safety Officer"]);
    expect(plan.targetSnapshot?.targetLevels).toEqual(["L1"]);
    expect(plan.targetSnapshot?.targetCompanies).toEqual(["HMT"]);
    expect(plan.targetSnapshot?.targetGroup).toBe("Saved Target Group");
    expect(plan.targetSnapshot?.orgScope?.department).toBe("แผนกฝึกอบรม");
    expect(plan.course.targetPositions).toEqual(["Safety Officer"]);
  });
});
