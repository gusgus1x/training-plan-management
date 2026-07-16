import { argon2id, hash, verify } from "argon2";

export const ARGON2ID_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

export const hashPassword = (plaintext: string) =>
  hash(plaintext, ARGON2ID_OPTIONS);

export const verifyPassword = async (passwordHash: string, plaintext: string) => {
  try {
    return await verify(passwordHash, plaintext);
  } catch {
    return false;
  }
};
