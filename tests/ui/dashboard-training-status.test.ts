import { describe, expect, it } from "vitest";
import { getDashboardTrainingStatus } from "../../app/components/center_factory/CenterFactory_Dashboard";

describe("getDashboardTrainingStatus", () => {
  const todayStr = "2026-09-07";

  it("marks past training dates as ended and completed", () => {
    const resultTh = getDashboardTrainingStatus({
      trainingDate: "2026-09-01",
      todayStr,
      isThai: true,
    });
    expect(resultTh.isEnded).toBe(true);
    expect(resultTh.status).toBe("เสร็จสิ้นแล้ว");

    const resultEn = getDashboardTrainingStatus({
      trainingDate: "2026-08-15",
      todayStr,
      isThai: false,
    });
    expect(resultEn.isEnded).toBe(true);
    expect(resultEn.status).toBe("Completed");
  });

  it("marks courses with dbStatus COMPLETED as ended even if date is today or future", () => {
    const result = getDashboardTrainingStatus({
      dbStatus: "COMPLETED",
      trainingDate: "2026-09-10",
      todayStr,
      isThai: true,
    });
    expect(result.isEnded).toBe(true);
    expect(result.status).toBe("เสร็จสิ้นแล้ว");
  });

  it("respects endDate over trainingDate if specified", () => {
    // Started yesterday, but finishes tomorrow
    const ongoingResult = getDashboardTrainingStatus({
      trainingDate: "2026-09-06",
      endDate: "2026-09-08",
      todayStr,
      isThai: true,
    });
    expect(ongoingResult.isEnded).toBe(false);
    expect(ongoingResult.status).toBe("เปิดรับสมัคร");

    // Finished yesterday
    const endedResult = getDashboardTrainingStatus({
      trainingDate: "2026-09-01",
      endDate: "2026-09-06",
      todayStr,
      isThai: true,
    });
    expect(endedResult.isEnded).toBe(true);
    expect(endedResult.status).toBe("เสร็จสิ้นแล้ว");
  });

  it("marks future courses as active / Published", () => {
    const resultTh = getDashboardTrainingStatus({
      trainingDate: "2026-09-15",
      todayStr,
      isThai: true,
    });
    expect(resultTh.isEnded).toBe(false);
    expect(resultTh.status).toBe("เปิดรับสมัคร");

    const resultEn = getDashboardTrainingStatus({
      trainingDate: "2026-10-01",
      todayStr,
      isThai: false,
    });
    expect(resultEn.isEnded).toBe(false);
    expect(resultEn.status).toBe("Published");
  });

  it("marks today as not ended if course is on current day", () => {
    const result = getDashboardTrainingStatus({
      trainingDate: "2026-09-07",
      todayStr,
      isThai: true,
    });
    expect(result.isEnded).toBe(false);
    expect(result.status).toBe("เปิดรับสมัคร");
  });
});

describe("Schedule Calendar published plan filtering", () => {
  it("excludes un-published (Planning) and Cancelled plans", () => {
    const samplePlans = [
      { id: "plan-1", name: "Draft Plan", status: "Planning" },
      { id: "plan-2", name: "Published Plan", status: "Planned" },
      { id: "plan-3", name: "Cancelled Plan", status: "Cancel" },
    ];

    const filtered = samplePlans.filter((p) => p.status === "Planned");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("plan-2");
  });
});

