import { describe, expect, it, vi } from "vitest";
import { createOapPlanRepository } from "../../app/lib/trainingOap/repository";
import { parseCreateOapPlan, parseOapPlanListFilters, parseUpdateOapPlan } from "../../app/lib/trainingOap/validation";

describe("OAP Plan Year", () => {
  it("parses planYear correctly in parseOapPlanListFilters", () => {
    const paramsWithPlanYear = new URLSearchParams({ planYear: "2026", status: "Planned" });
    const filters = parseOapPlanListFilters(paramsWithPlanYear);
    expect(filters.planYear).toBe(2026);
    expect(filters.status).toBe("Planned");

    const paramsWithYear = new URLSearchParams({ year: "2027" });
    const filtersYear = parseOapPlanListFilters(paramsWithYear);
    expect(filtersYear.planYear).toBe(2027);

    const paramsEmpty = new URLSearchParams();
    const filtersEmpty = parseOapPlanListFilters(paramsEmpty);
    expect(filtersEmpty.planYear).toBeNull();
  });

  it("parses planYear in parseCreateOapPlan and parseUpdateOapPlan", () => {
    const createInput = parseCreateOapPlan({
      courseId: "101",
      planYear: 2026,
      participants: 25,
      hours: 6,
      budget: "50000",
    });
    expect(createInput.planYear).toBe(2026);
    expect(createInput.participants).toBe(25);

    const updateInput = parseUpdateOapPlan({
      planYear: 2027,
    });
    expect(updateInput.planYear).toBe(2027);
  });

  it("filters by plan_year in repository.list", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const client = {
      training_plan_oap: { findMany },
      course: {},
    };
    const repository = createOapPlanRepository(client as never);

    await repository.list({ search: null, status: null, planYear: 2026 }, null);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ plan_year: 2026 }],
        },
      }),
    );
  });

  it("maps plan_year to planYear in repository output", async () => {
    const mockRow = {
      oap_plan_id: BigInt(10),
      plan_year: 2026,
      company_id: null,
      planned_duration_hours: 6,
      default_participant_count: 20,
      total_planned_budget: 15000,
      budget_instructor: 5000,
      budget_traveling: 2000,
      budget_seminar_room: 3000,
      budget_accommodation: 2000,
      budget_material: 1500,
      budget_food_beverage: 1500,
      instructor_name_text: "Dr. Somchai",
      provider_id: null,
      provider_name_text: "Training Institute",
      created_by: BigInt(1),
      status: "OPEN",
      course: {
        course_id: BigInt(100),
        course_code: "CRS-001",
        course_name: "Course 1",
        course_name_en: "Course 1 EN",
        objective: "Objective",
        learning_content: "Content",
        target_group: "Engineers",
        methodology: "Workshop",
        pre_assessment_id: null,
        post_assessment_id: null,
        evaluation_form_id: null,
        evaluation_form_after_30day_id: null,
        validity_months: 12,
        description: "Remark",
        status: "ACTIVE",
        company_id: null,
        created_by: BigInt(1),
        created_at: new Date(),
        updated_at: new Date(),
        course_type: { course_type_name: "Technical" },
        course_group: { course_group_name: "Engineering" },
      },
      instructor: null,
      institute_provider: null,
      company: null,
    };

    const findMany = vi.fn().mockResolvedValue([mockRow]);
    const client = {
      training_plan_oap: { findMany },
      course: {},
    };
    const repository = createOapPlanRepository(client as never);

    const plans = await repository.list({ search: null, status: null, planYear: 2026 }, null);

    expect(plans).toHaveLength(1);
    expect(plans[0].planYear).toBe(2026);
    expect(plans[0].id).toBe("10");
    expect(plans[0].trainer).toBe("Dr. Somchai");
  });
});
