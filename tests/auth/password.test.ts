import { describe, expect, it } from "vitest";
import {
  ARGON2ID_OPTIONS,
  hashPassword,
  verifyPassword,
} from "../../app/lib/auth/password";

describe("password service", () => {
  it("creates an Argon2id PHC string with the approved parameters", async () => {
    const passwordHash = await hashPassword("test-only-password");

    expect(passwordHash).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[^$]+\$[^$]+$/,
    );
    expect(ARGON2ID_OPTIONS).toMatchObject({
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
      hashLength: 32,
    });
    await expect(
      verifyPassword(passwordHash, "test-only-password"),
    ).resolves.toBe(true);
  });

  it("rejects a wrong password and malformed hash", async () => {
    const passwordHash = await hashPassword("correct-password");

    await expect(verifyPassword(passwordHash, "wrong-password")).resolves.toBe(
      false,
    );
    await expect(
      verifyPassword("not-a-password-hash", "correct-password"),
    ).resolves.toBe(false);
  });
});

