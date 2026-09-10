import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loginPageSource = readFileSync(
  new URL("../../app/components/LoginPage.tsx", import.meta.url),
  "utf8",
);
const widgetSource = readFileSync(
  new URL(
    "../../app/components/LoginActivitiesWidget/LoginActivitiesWidget.tsx",
    import.meta.url,
  ),
  "utf8",
);
const widgetStylesSource = readFileSync(
  new URL(
    "../../app/components/LoginActivitiesWidget/LoginActivitiesWidget.module.css",
    import.meta.url,
  ),
  "utf8",
);
const apiRouteSource = readFileSync(
  new URL("../../app/api/course-activities/route.ts", import.meta.url),
  "utf8",
);

describe("LoginActivitiesWidget contract", () => {
  it("integrates LoginActivitiesWidget into LoginPage within heroColumn", () => {
    expect(loginPageSource).toContain("LoginActivitiesWidget");
    expect(loginPageSource).toContain("className={styles.heroColumn}");
    expect(loginPageSource).toContain("<LoginActivitiesWidget />");
  });

  it("permits unauthenticated access to published dashboard activities", () => {
    expect(apiRouteSource).toContain("const isUnauthenticated = !session;");
    expect(apiRouteSource).toContain('status: isUnauthenticated ? "PUBLISHED"');
    expect(apiRouteSource).toContain("a.isVisibleOnDashboard !== false");
  });

  it("ensures widget is strictly read-only with no edit, delete, archive, or enroll buttons", () => {
    // Read-only modal contract
    expect(widgetSource).toContain("selectedActivity");
    expect(widgetSource).toContain("closeDetailModal");
    expect(widgetSource).toContain("modalCloseBtn");
    // Strictly no administrative or mutating actions
    expect(widgetSource).not.toContain("handleDelete");
    expect(widgetSource).not.toContain("handleEdit");
    expect(widgetSource).not.toContain("handleArchive");
    expect(widgetSource).not.toContain("handleEnroll");
    expect(widgetSource).not.toContain("สมัคร");
    expect(widgetSource).not.toContain("แก้ไข");
    expect(widgetSource).not.toContain("ลบ");
    expect(widgetSource).not.toContain("จัดเก็บ");
  });

  it("supports responsive layout and theme styling in CSS", () => {
    expect(widgetStylesSource).toContain(".container");
    expect(widgetStylesSource).toContain(".slideCard");
    expect(widgetStylesSource).toContain(".modalBackdrop");
    expect(widgetStylesSource).toContain(".modalDialog");
    expect(widgetStylesSource).toContain("@media (max-width: 640px)");
    expect(widgetStylesSource).toContain("var(--ui-30-primary)");
  });

  it("portals Detail Modal to document.body to prevent layout/stacking context clipping", () => {
    expect(widgetSource).toContain("createPortal");
    expect(widgetSource).toContain("document.body");
    expect(widgetStylesSource).toContain("z-index: 99999");
  });

  it("strictly enforces zero emojis across widget source and styles", () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    expect(emojiRegex.test(widgetSource)).toBe(false);
    expect(emojiRegex.test(widgetStylesSource)).toBe(false);
    expect(emojiRegex.test(loginPageSource)).toBe(false);
  });
});
