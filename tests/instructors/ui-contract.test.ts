import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Instructor Data UI contract", () => {
  it("uses the Instructor API and keeps HRD_FACTORY read-only", () => {
    const source = readFileSync(
      new URL(
        "../../app/components/center_factory/MasterDataManagement/modules/InstructorData.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain("listInstructors()");
    expect(source).toContain('user?.roleCode === "HRD_CENTER"');
    expect(source).not.toContain("readMasterCollection(");
    expect(source).not.toContain("writeMasterCollection(");
    expect(source).not.toContain("Log Date");
    expect(source).toContain("Instructor Code");
    expect(source).toContain("Organization");
    expect(source).toContain("Status");
    expect(source).toContain("const savingMode = formMode");
    expect(source).toContain("const [editingInstructorId, setEditingInstructorId]");
    expect(source).toContain("setEditingInstructorId(instructor.instructorId)");
    expect(source).toContain(
      'savingMode === "edit" ? editingInstructorId : null',
    );
    expect(source).toContain("await updateInstructor(targetInstructorId, input)");
    expect(source).toContain("Add Instructor - creates a new record");
    expect(source).toContain("Save Changes");
    expect(source).toContain(
      "Instructor code already exists. This form is in New mode; select the existing row and press Edit.",
    );
    expect(source).toContain("void listInstructors()");
    expect(source).toContain(".then((refreshed) => setRows(refreshed.items))");
    expect(source).toContain("const refresh = () =>");
    expect(source).toContain("onClick={refresh}");
  });

  it("loads ACTIVE Instructor options from the API in Training OAP", () => {
    const source = readFileSync(
      new URL(
        "../../app/components/center_factory/TrainingPlanManagement/modules/TrainingOAP.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain('listInstructors({ status: "ACTIVE" })');
    expect(source).not.toContain("TRAINING_MASTER_KEYS.instructors");
    expect(source).toContain('list="instructor-master-options"');
  });
});
