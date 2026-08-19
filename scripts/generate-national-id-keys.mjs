import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const path = ".env";
let content = readFileSync(path, "utf8");
const additions = [];
if (!/^NATIONAL_ID_HMAC_KEY=/m.test(content))
  additions.push(`NATIONAL_ID_HMAC_KEY=${randomBytes(32).toString("base64")}`);
if (!/^NATIONAL_ID_ACTIVE_KEY_VERSION=/m.test(content))
  additions.push("NATIONAL_ID_ACTIVE_KEY_VERSION=1");
if (!/^NATIONAL_ID_ENCRYPTION_KEY_V1=/m.test(content))
  additions.push(`NATIONAL_ID_ENCRYPTION_KEY_V1=${randomBytes(32).toString("base64")}`);
if (additions.length) {
  content = `${content.trimEnd()}\n${additions.join("\n")}\n`;
  writeFileSync(path, content, { encoding: "utf8", mode: 0o600 });
}
process.stdout.write(`National ID key configuration ready (${additions.length} added).\n`);
