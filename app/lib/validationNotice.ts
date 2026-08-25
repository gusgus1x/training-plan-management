export type MissingFieldsMessage = {
  title: string;
  message: string;
};

/**
 * Builds the standard bilingual "you have not filled in everything" text shown when a
 * save / submit / add action cannot run because required fields are empty.
 *
 * The text is written out in both languages here rather than going through
 * `ThaiUiLocalization`, which only rewrites text already rendered into the DOM and so
 * cannot reach a string assembled at call time.
 */
export const buildMissingFieldsMessage = (
  missingFields: string[],
): MissingFieldsMessage => {
  const fields = missingFields.map((field) => field.trim()).filter(Boolean);
  const count = fields.length;

  return {
    title: "ข้อมูลไม่ครบถ้วน / Incomplete information",
    message: [
      `คุณยังไม่ได้กรอกข้อมูล ${count} รายการ กรุณากรอกข้อมูลให้ครบตามที่กำหนด`,
      `You have ${count} required field${count === 1 ? "" : "s"} left. Please complete all required fields.`,
      "",
      ...fields.map((field) => `• ${field}`),
    ].join("\n"),
  };
};
