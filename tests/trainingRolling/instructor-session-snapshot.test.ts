import { describe, expect, it } from "vitest";
import { parseCreateOapPlan, parseUpdateOapPlan } from "../../app/lib/trainingOap/validation";
import { parseCreateRollingPlan, parseUpdateRollingPlan } from "../../app/lib/trainingRolling/validation";

describe("Instructor Snapshot & Session Override Validation", () => {
  describe("Training OAP Plan Validation", () => {
    it("parses instructor snapshot contact details in create input", () => {
      const parsed = parseCreateOapPlan({
        courseId: "101",
        planYear: 2026,
        participants: 30,
        hours: 6,
        budget: "15,000",
        trainerName: "Dr. Somchai Sukkasem",
        instructorId: "55",
        instructorTelephone: "081-234-5678",
        instructorEmail: "somchai@univ.ac.th",
        instructorEducation: "Ph.D. Computer Science",
        instructorOrganization: "Faculty of Engineering",
        instructorUniversity: "Chulalongkorn University",
        providerName: "Thai Training Institute",
        providerId: "12",
        status: "Planned",
      });

      expect(parsed.trainerName).toBe("Dr. Somchai Sukkasem");
      expect(parsed.instructorId).toBe("55");
      expect(parsed.instructorTelephone).toBe("081-234-5678");
      expect(parsed.instructorEmail).toBe("somchai@univ.ac.th");
      expect(parsed.instructorEducation).toBe("Ph.D. Computer Science");
      expect(parsed.instructorOrganization).toBe("Faculty of Engineering");
      expect(parsed.instructorUniversity).toBe("Chulalongkorn University");
      expect(parsed.providerName).toBe("Thai Training Institute");
      expect(parsed.providerId).toBe("12");
    });

    it("parses partial instructor details in update input", () => {
      const parsed = parseUpdateOapPlan({
        instructorTelephone: "089-999-8888",
        instructorEmail: "updated@example.com",
        instructorUniversity: "Kasetsart University",
      });

      expect(parsed.instructorTelephone).toBe("089-999-8888");
      expect(parsed.instructorEmail).toBe("updated@example.com");
      expect(parsed.instructorUniversity).toBe("Kasetsart University");
      expect(parsed.instructorEducation).toBeUndefined();
    });
  });

  describe("Training Rolling Plan Session Validation", () => {
    it("parses session-specific instructor and provider overrides in create input", () => {
      const parsed = parseCreateRollingPlan({
        oapPlanId: "500",
        batchNo: 1,
        batchName: "รอบที่ 1",
        venue: "Meeting Room 1",
        trainingDate: "2026-11-01",
        startTime: "09:00",
        endTime: "16:00",
        instructorId: "99",
        trainerName: "Special Guest Lecturer",
        instructorTelephone: "082-111-2222",
        instructorEmail: "guest@external.org",
        instructorEducation: "Master of Arts",
        instructorOrganization: "External Expert Network",
        instructorUniversity: "Thammasat University",
        providerId: "77",
        providerName: "Pro Skills Academy",
      });

      expect(parsed.instructorId).toBe("99");
      expect(parsed.trainerName).toBe("Special Guest Lecturer");
      expect(parsed.instructorTelephone).toBe("082-111-2222");
      expect(parsed.instructorEmail).toBe("guest@external.org");
      expect(parsed.instructorEducation).toBe("Master of Arts");
      expect(parsed.instructorOrganization).toBe("External Expert Network");
      expect(parsed.instructorUniversity).toBe("Thammasat University");
      expect(parsed.providerId).toBe("77");
      expect(parsed.providerName).toBe("Pro Skills Academy");
    });

    it("parses session-specific instructor update with null clearing", () => {
      const parsed = parseUpdateRollingPlan({
        instructorId: "",
        trainerName: "Custom Instructor Name",
        instructorTelephone: "090-000-0000",
      });

      expect(parsed.instructorId).toBeNull();
      expect(parsed.trainerName).toBe("Custom Instructor Name");
      expect(parsed.instructorTelephone).toBe("090-000-0000");
    });
  });
});
