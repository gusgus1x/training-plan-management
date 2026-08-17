import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_PASSWORD_MAX_LENGTH,
  DEVELOPMENT_PASSWORD_MIN_LENGTH,
  DEVELOPMENT_PASSWORD_VALIDATION_MESSAGE,
  validateDevelopmentPassword,
} from "../../scripts/seed-development-account.mjs";

describe("development account seed contract", () => {
  it("accepts development passwords from 12 characters including 64 characters", () => {
    const minimumPassword = "a".repeat(12);
    const sixtyFourCharacterPassword = "b".repeat(64);

    expect(DEVELOPMENT_PASSWORD_MIN_LENGTH).toBe(12);
    expect(DEVELOPMENT_PASSWORD_MAX_LENGTH).toBeGreaterThanOrEqual(64);
    expect(() =>
      validateDevelopmentPassword(minimumPassword, minimumPassword),
    ).not.toThrow();
    expect(() =>
      validateDevelopmentPassword(
        sixtyFourCharacterPassword,
        sixtyFourCharacterPassword,
      ),
    ).not.toThrow();
  });

  it("rejects passwords shorter than 12 characters and mismatched confirmation", () => {
    expect(() =>
      validateDevelopmentPassword("a".repeat(11), "a".repeat(11)),
    ).toThrow(DEVELOPMENT_PASSWORD_VALIDATION_MESSAGE);
    expect(() =>
      validateDevelopmentPassword("a".repeat(12), "b".repeat(12)),
    ).toThrow(DEVELOPMENT_PASSWORD_VALIDATION_MESSAGE);
    expect(DEVELOPMENT_PASSWORD_VALIDATION_MESSAGE).toBe(
      "Development account password must be 12 to 1024 characters and match confirmation.",
    );
  });
});
