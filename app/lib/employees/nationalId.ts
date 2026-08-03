import { createCipheriv, createDecipheriv, createHmac } from "node:crypto";
import { ApiError } from "../api/errors";

const FORMAT_VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const invalid = () =>
  new ApiError({
    code: "INVALID_NATIONAL_ID",
    message: "National ID must be a valid 13-digit Thai National ID",
    status: 400,
  });

export const isValidThaiNationalId = (value: string) => {
  if (!/^\d{13}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const sum = digits.slice(0, 12).reduce(
    (total, digit, index) => total + digit * (13 - index),
    0,
  );
  return ((11 - (sum % 11)) % 10) === digits[12];
};

type NationalIdEnvironment = Record<string, string | undefined>;

const key = (name: string, environment: NationalIdEnvironment) => {
  const encoded = environment[name]?.trim();
  const decoded = encoded ? Buffer.from(encoded, "base64") : Buffer.alloc(0);
  if (decoded.length !== 32) {
    throw new Error(`${name} must be a base64-encoded 32-byte key`);
  }
  return decoded;
};

export const protectNationalId = (
  nationalId: string,
  environment: NationalIdEnvironment = process.env,
) => {
  if (!isValidThaiNationalId(nationalId)) throw invalid();
  const version = Number(environment.NATIONAL_ID_ACTIVE_KEY_VERSION);
  if (!Number.isInteger(version) || version < 1 || version > 32767) {
    throw new Error("NATIONAL_ID_ACTIVE_KEY_VERSION must be a positive small integer");
  }
  const hmacKey = key("NATIONAL_ID_HMAC_KEY", environment);
  const encryptionKey = key(`NATIONAL_ID_ENCRYPTION_KEY_V${version}`, environment);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(nationalId, "utf8"), cipher.final()]);
  const encrypted = Buffer.concat([
    Buffer.from([FORMAT_VERSION]),
    Buffer.from(iv),
    cipher.getAuthTag(),
    ciphertext,
  ]);
  return {
    hash: createHmac("sha256", hmacKey).update(nationalId).digest("hex"),
    encrypted,
    last4: nationalId.slice(-4),
    keyVersion: version,
  };
};

export const revealNationalId = (
  encrypted: Uint8Array,
  keyVersion: number,
  environment: NationalIdEnvironment = process.env,
) => {
  const value = Buffer.from(encrypted);
  if (value.length <= 1 + IV_LENGTH + TAG_LENGTH || value[0] !== FORMAT_VERSION) {
    throw new Error("Unsupported National ID encryption payload");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(`NATIONAL_ID_ENCRYPTION_KEY_V${keyVersion}`, environment),
    value.subarray(1, 1 + IV_LENGTH),
  );
  decipher.setAuthTag(value.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH));
  const nationalId = Buffer.concat([
    decipher.update(value.subarray(1 + IV_LENGTH + TAG_LENGTH)),
    decipher.final(),
  ]).toString("utf8");
  if (!isValidThaiNationalId(nationalId)) throw new Error("Decrypted National ID is invalid");
  return nationalId;
};

export const maskNationalId = (last4: string | null) =>
  last4 ? `*********${last4}` : null;
