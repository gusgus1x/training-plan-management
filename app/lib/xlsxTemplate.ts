import { deflateRawSync, inflateRawSync } from "node:zlib";

export type XlsxEntry = {
  name: string;
  data: Buffer;
  compressionMethod: number;
  modifiedTime: number;
  modifiedDate: number;
  externalAttributes: number;
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (data: Buffer) => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const findEndOfCentralDirectory = (archive: Buffer) => {
  const minimumOffset = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Invalid Excel template: ZIP directory was not found.");
};

export const readXlsxEntries = (archive: Buffer): XlsxEntry[] => {
  const endOffset = findEndOfCentralDirectory(archive);
  const entryCount = archive.readUInt16LE(endOffset + 10);
  let centralOffset = archive.readUInt32LE(endOffset + 16);
  const entries: XlsxEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error("Invalid Excel template: malformed ZIP directory.");
    }
    const flags = archive.readUInt16LE(centralOffset + 8);
    const compressionMethod = archive.readUInt16LE(centralOffset + 10);
    const modifiedTime = archive.readUInt16LE(centralOffset + 12);
    const modifiedDate = archive.readUInt16LE(centralOffset + 14);
    const compressedSize = archive.readUInt32LE(centralOffset + 20);
    const fileNameLength = archive.readUInt16LE(centralOffset + 28);
    const extraLength = archive.readUInt16LE(centralOffset + 30);
    const commentLength = archive.readUInt16LE(centralOffset + 32);
    const externalAttributes = archive.readUInt32LE(centralOffset + 38);
    const localHeaderOffset = archive.readUInt32LE(centralOffset + 42);
    const nameStart = centralOffset + 46;
    const fileNameBuffer = archive.subarray(nameStart, nameStart + fileNameLength);
    const name = fileNameBuffer.toString((flags & 0x0800) !== 0 ? "utf8" : "utf8");

    if (archive.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid Excel template: local entry ${name} was not found.`);
    }
    const localNameLength = archive.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = archive.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = archive.subarray(dataStart, dataStart + compressedSize);
    const data =
      compressionMethod === 0
        ? Buffer.from(compressedData)
        : compressionMethod === 8
          ? inflateRawSync(compressedData)
          : null;
    if (!data) throw new Error(`Unsupported ZIP compression method ${compressionMethod}.`);
    entries.push({
      name,
      data,
      compressionMethod,
      modifiedTime,
      modifiedDate,
      externalAttributes,
    });
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
};

export const writeXlsxEntries = (entries: XlsxEntry[]) => {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressedData =
      entry.compressionMethod === 0
        ? entry.data
        : deflateRawSync(entry.data, { level: 6 });
    const checksum = crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(entry.compressionMethod, 8);
    localHeader.writeUInt16LE(entry.modifiedTime, 10);
    localHeader.writeUInt16LE(entry.modifiedDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localParts.push(localHeader, name, compressedData);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(entry.compressionMethod, 10);
    centralHeader.writeUInt16LE(entry.modifiedTime, 12);
    centralHeader.writeUInt16LE(entry.modifiedDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressedData.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(entry.externalAttributes, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);
    localOffset += localHeader.length + name.length + compressedData.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, endRecord]);
};

export const escapeXlsxXml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const setXlsxInlineCell = (
  worksheetXml: string,
  reference: string,
  value: unknown,
  styleOverride?: string,
) => {
  const cellPattern = new RegExp(
    `<c\\b([^>]*\\br=["']${reference}["'][^>]*)>([\\s\\S]*?)<\\/c>`,
  );
  const selfClosingPattern = new RegExp(
    `<c\\b([^>]*\\br=["']${reference}["'][^>]*)\\/>`,
  );
  const match = worksheetXml.match(selfClosingPattern) ?? worksheetXml.match(cellPattern);
  if (!match) throw new Error(`Invalid Excel template: cell ${reference} was not found.`);
  const style =
    styleOverride ?? match[1].match(/\bs=["']([^"']+)["']/)?.[1];
  const replacement = `<c r="${reference}"${style ? ` s="${style}"` : ""} t="inlineStr"><is><t xml:space="preserve">${escapeXlsxXml(value)}</t></is></c>`;
  return worksheetXml.replace(match[0], replacement);
};

export const readXlsxEntry = (workbook: Buffer, entryName: string) => {
  const entry = readXlsxEntries(workbook).find((item) => item.name === entryName);
  if (!entry) throw new Error(`Excel entry ${entryName} was not found.`);
  return entry.data;
};
