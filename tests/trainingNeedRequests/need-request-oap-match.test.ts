import { describe, expect, it } from "vitest";
import {
  courseLabel,
  demandKey,
  matchCourseForRequest,
  matchOapForRequests,
  planningTarget,
} from "../../app/components/center_factory/TrainingPlanManagement/modules/needRequestHandoff";
import type { NeedRequestRecord } from "../../app/lib/trainingNeedRequests/types";

const request = (requestedCourseName: string, id = "7") => ({ id, requestedCourseName }) as NeedRequestRecord;

const plan = (id: string, courseCode: string, courseNameTh: string, status = "Planned") => ({
  id,
  status,
  course: { courseCode, courseNameTh, courseNameEn: "" },
});

describe("finding the OAP plan a training need request is asking for", () => {
  const plans = [
    plan("1", "SY-000002", "การใช้งาน Excel เบื้องต้น"),
    plan("2", "SY-000009", "ความปลอดภัยในการทำงาน"),
    plan("3", "SY-000002", "การใช้งาน Excel เบื้องต้น", "Cancel"),
  ];

  it("matches the code the refresher request carries, ignoring cancelled plans", () => {
    expect(matchOapForRequests([request("[SY-000002] การใช้งาน Excel เบื้องต้น (ขออบรมทบทวน / Refresher)")], plans)?.id).toBe("1");
  });

  it("falls back to the course name when the employee typed the topic themselves", () => {
    expect(matchOapForRequests([request("ความปลอดภัยในการทำงาน")], plans)?.id).toBe("2");
    expect(matchOapForRequests([request("อยากอบรมความปลอดภัยในการทำงาน")], plans)?.id).toBe("2");
  });

  it("leaves the choice to HRD when nothing matches, rather than guessing a course", () => {
    expect(matchOapForRequests([request("หลักสูตรที่ยังไม่มีในแผน")], plans)).toBeNull();
    // Too short to mean anything: matching on it would pull in any course containing those letters.
    expect(matchOapForRequests([request("(ทบทวน)")], plans)).toBeNull();
  });

  it("uses the first request that names a course when a group was sent over", () => {
    expect(matchOapForRequests([request("อบรมทั่วไป"), request("[SY-000009] ความปลอดภัย")], plans)?.id).toBe("2");
  });
});

describe("where HRD has to go before these requests can become a batch", () => {
  const courses = [
    { id: "c1", courseCode: "SY-000002", courseNameTh: "การใช้งาน Excel เบื้องต้น", courseNameEn: "" },
    { id: "c2", courseCode: "SY-000009", courseNameTh: "ความปลอดภัยในการทำงาน", courseNameEn: "Safety at work" },
  ];
  const plans = [plan("1", "SY-000002", "การใช้งาน Excel เบื้องต้น")];

  it("finds the course by the code the request carries, then by the name typed", () => {
    expect(matchCourseForRequest("[SY-000009] ความปลอดภัย", courses)?.id).toBe("c2");
    expect(matchCourseForRequest("ขออบรม Safety at work", courses)?.id).toBe("c2");
    expect(matchCourseForRequest("หัวข้อที่ยังไม่มี", courses)).toBeNull();
  });

  it("goes straight to Rolling when the course already has an OAP plan", () => {
    const target = planningTarget([request("[SY-000002] การใช้งาน Excel เบื้องต้น")], plans, courses);
    expect(target.kind).toBe("rolling");
    expect(target.url).toBe("/training-plan/training-rolling?needRequestIds=7");
  });

  it("stops at OAP when the course exists but has no plan, carrying the course and the requests", () => {
    const target = planningTarget([request("[SY-000009] ความปลอดภัยในการทำงาน")], plans, courses);
    expect(target.kind).toBe("oap");
    expect(target.url).toBe("/training-plan/training-oap?needRequestIds=7&courseId=c2");
  });

  it("starts at Course Master when the course itself does not exist yet", () => {
    const target = planningTarget([request("การบำรุงรักษาเครื่องจักร", "9")], plans, courses);
    expect(target.kind).toBe("course");
    expect(target.courseName).toBe("การบำรุงรักษาเครื่องจักร");
    expect(target.url).toContain("/training-course/course-master-standard?newCourseName=");
    expect(target.url).toContain("needRequestIds=9");
  });
});


describe("naming and grouping the course a request asks for", () => {
  const picked = {
    courseId: "12",
    courseNameSnapshot: "การใช้งาน Excel เบื้องต้น",
    requestedCourseName: "[SY-000002] การใช้งาน Excel เบื้องต้น (ขออบรมทบทวน / Refresher)",
  } as NeedRequestRecord;
  const typed = { courseId: null, courseNameSnapshot: null, requestedCourseName: "อยากอบรม Excel" } as NeedRequestRecord;

  it("shows the course's own name, not the employee's wording with its code and tail", () => {
    expect(courseLabel(picked)).toBe("การใช้งาน Excel เบื้องต้น");
    expect(courseLabel(typed)).toBe("อยากอบรม Excel");
  });

  it("groups by the course, so the same course typed two ways still counts once", () => {
    const sameCourseOtherWording = { ...picked, requestedCourseName: "excel ทบทวน" } as NeedRequestRecord;
    expect(demandKey(sameCourseOtherWording)).toBe(demandKey(picked));
    expect(demandKey(typed)).not.toBe(demandKey(picked));
  });
});
