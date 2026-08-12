import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Course Master and Course Standard workspace", () => {
  it("registers one combined Training Course module", () => {
    const modulesSource = readSource(
      "app/components/center_factory/TrainingCourseManagement/modules/index.ts",
    );

    expect(modulesSource).toContain("courseMasterWorkspaceModule");
    expect(modulesSource).not.toContain("courseStandardModule");
  });

  it("creates Course Master and Course Standard in one workflow", () => {
    const workspaceSource = readSource(
      "app/components/center_factory/TrainingCourseManagement/modules/CourseMasterWorkspace.tsx",
    );

    expect(workspaceSource).not.toContain('role="tablist"');
    expect(workspaceSource).toContain("return <CourseMaster />");
    expect(workspaceSource).not.toContain("function CourseStandard");
    expect(workspaceSource).toContain(
      "บันทึกหลักสูตรและมาตรฐาน / Save Course & Standard",
    );
    expect(workspaceSource).toContain("standardFunctionCode");
    expect(workspaceSource).toContain("selectedPositions");
    expect(workspaceSource).toContain("selectedLevels");
    expect(workspaceSource).toContain("await updateCourse(selectedCourseId, input)");
    expect(workspaceSource).toContain("await createCourse(input)");
    expect(workspaceSource).not.toContain("Course Standard Records");
    expect(workspaceSource).toContain("Classification");
    expect(workspaceSource).toContain("Course Standard");
    expect(workspaceSource).toContain('lifeCycleMonth: ""');
    expect(workspaceSource).toContain("validityMonths: form.lifeCycleMonth ? Number(form.lifeCycleMonth) : null");
    expect(workspaceSource).toContain('min="0"');
    expect(workspaceSource).toContain('placeholder="Enter 0 for no course expiration"');
    expect(workspaceSource).not.toContain("Number of months before the course should be reviewed.");
    expect(workspaceSource).toContain('<h2 translate="no">{courseMasterModule.title}</h2>');
    expect(workspaceSource).toContain('<option key={type} value={type} translate="no">{type}</option>');
    expect(workspaceSource).toContain('<option key={option.code} value={option.code} translate="no">');
    expect(workspaceSource).toContain('<strong translate="no">{course.courseType}</strong>');
    expect(workspaceSource).toContain('translate={courseStandard ? "no" : undefined}');
    expect(workspaceSource).toContain("courseStandard.positions.length");
    expect(workspaceSource).toContain("courseStandard.levels.length");
    expect(workspaceSource).not.toContain("combinedColumnCount");
  });

  it("orders Course Group, Course Code, Thai name, then English name", () => {
    const workspaceSource = readSource(
      "app/components/center_factory/TrainingCourseManagement/modules/CourseMasterWorkspace.tsx",
    );
    const groupIndex = workspaceSource.indexOf("Course Group <b>");
    const codeIndex = workspaceSource.indexOf("Course Code <b>");
    const courseTypeIndex = workspaceSource.indexOf("Course Type <b>");
    const lifeCycleIndex = workspaceSource.indexOf("Life Cycle (Month)");
    const thaiNameIndex = workspaceSource.indexOf("Course Name (TH) <b>");
    const englishNameIndex = workspaceSource.indexOf("Course Name (EN) <b>");

    expect(groupIndex).toBeGreaterThan(-1);
    expect(groupIndex).toBeLessThan(codeIndex);
    expect(codeIndex).toBeLessThan(thaiNameIndex);
    expect(codeIndex).toBeLessThan(courseTypeIndex);
    expect(courseTypeIndex).toBeLessThan(lifeCycleIndex);
    expect(lifeCycleIndex).toBeLessThan(thaiNameIndex);
    expect(thaiNameIndex).toBeLessThan(englishNameIndex);
  });

  it("keeps both implementations in the same source file", () => {
    const moduleDirectory = join(
      process.cwd(),
      "app/components/center_factory/TrainingCourseManagement/modules",
    );

    expect(existsSync(join(moduleDirectory, "CourseMaster.tsx"))).toBe(false);
    expect(existsSync(join(moduleDirectory, "CourseStandard.tsx"))).toBe(false);
  });

  it("shows selected Course Standard positions and levels in green", () => {
    const workspaceSource = readSource(
      "app/components/center_factory/TrainingCourseManagement/modules/CourseMasterWorkspace.tsx",
    );
    const stylesSource = readSource(
      "app/components/center_factory/TrainingCourseManagement/modules/CourseMasterWorkspace.module.css",
    );

    expect(workspaceSource).toContain("styles.standard_checkItemSelected");
    expect(stylesSource).toContain(".standard_checkItemSelected");
    expect(stylesSource).toContain("background: #eaf8ef");
    expect(stylesSource).toContain("accent-color: #168a47");
    expect(workspaceSource).toContain('className={styles.standard_checkMark}');
    expect(workspaceSource).toContain('? "✓" : ""');
    expect(stylesSource).toContain("color: #168a47");
  });

  it("locks courses already used by OAP or Rolling plans", () => {
    const workspaceSource = readSource(
      "app/components/center_factory/TrainingCourseManagement/modules/CourseMasterWorkspace.tsx",
    );

    expect(workspaceSource).toContain("listOapPlans");
    expect(workspaceSource).toContain("loadWorkflowRollingPlans");
    expect(workspaceSource).toContain("usedCourseCodes");
    expect(workspaceSource).toContain("isSelectedCourseLocked");
    expect(workspaceSource).toContain("disabled={!selectedCourse || isSelectedCourseLocked}");
    expect(workspaceSource).toContain("disabled={usedCourseCodes.has(course.courseCode)}");
  });
});
