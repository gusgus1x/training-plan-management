import { describe, expect, it } from "vitest";
import { sortIntoSections, type GalleryForm } from "../../app/components/forms/FormGallery";

/**
 * The gallery shows three sections, and which one a card lands in is the whole point of the screen:
 * what I still have to finish, what my side has published, and what everybody else's looks like.
 * The reader's own company is the only thing that decides it - never who typed the form.
 */

const form = (over: Partial<GalleryForm> & { id: string }): GalleryForm => ({
  name: `ฟอร์ม ${over.id}`,
  code: `F-${over.id}`,
  isDraft: false,
  statusLabel: "ACTIVE",
  companyCode: "CENTRAL",
  companyName: "ส่วนกลาง",
  questionCount: 3,
  updatedAt: null,
  canModify: true,
  createdBy: "1",
  ...over,
});

describe("the gallery's three sections", () => {
  const rows = [
    form({ id: "own-draft", companyCode: "ATA", isDraft: true, statusLabel: "DRAFT" }),
    form({ id: "own-live", companyCode: "ATA" }),
    form({ id: "their-draft", companyCode: "CENTRAL", isDraft: true, statusLabel: "DRAFT" }),
    form({ id: "their-live", companyCode: "CENTRAL" }),
  ];

  it("keeps somebody else's unfinished form out of my own new-forms section", () => {
    const sections = sortIntoSections(rows, "", "ATA");

    expect(sections.drafts.map((row) => row.id)).toEqual(["own-draft"]);
    expect(sections.mine.map((row) => row.id)).toEqual(["own-live"]);
  });

  it("files everything outside my company under its company, drafts included", () => {
    const sections = sortIntoSections(rows, "", "ATA");

    expect(sections.companies).toHaveLength(1);
    expect(sections.companies[0].code).toBe("CENTRAL");
    expect(sections.companies[0].rows.map((row) => row.id)).toEqual(["their-draft", "their-live"]);
  });

  it("reads a central form as the centre's own", () => {
    const sections = sortIntoSections(rows, "", "CENTRAL");

    expect(sections.drafts.map((row) => row.id)).toEqual(["their-draft"]);
    expect(sections.companies[0].code).toBe("ATA");
  });

  it("searches the name and the code, and leaves the sections otherwise alone", () => {
    const sections = sortIntoSections(rows, "F-own-live", "ATA");

    expect(sections.drafts).toHaveLength(0);
    expect(sections.mine.map((row) => row.id)).toEqual(["own-live"]);
  });
});
