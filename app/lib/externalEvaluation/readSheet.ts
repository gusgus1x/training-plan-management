import { readXlsxEntries } from "../xlsxTemplate";

/**
 * The first worksheet of an uploaded response file, as rows of plain strings.
 *
 * Google Forms hands out .csv (or .xlsx through Sheets); Microsoft Forms only .xlsx. Both are read
 * here with no spreadsheet library: an .xlsx is a zip of XML, and the zip reader the report
 * export already uses opens it. Numbers stay as their stored text - an Excel date arrives as its
 * serial ("46241.66875") and the converter decides what a column means.
 */
export const readResponseSheet = (fileName: string, data: Buffer): string[][] => {
  if (/\.xlsx$/i.test(fileName)) return readXlsxRows(data);
  if (/\.csv$/i.test(fileName)) return parseCsv(data.toString("utf8").replace(/^﻿/, ""));
  throw new Error("รองรับเฉพาะไฟล์ .xlsx หรือ .csv");
};

const decodeXml = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Every <t> inside an element joined: shared strings with formatting are split into runs. */
const textOf = (xml: string) => decodeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => match[1]).join(""));

const columnIndex = (letters: string) => [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;

const readXlsxRows = (data: Buffer): string[][] => {
  let entries;
  try {
    entries = readXlsxEntries(data);
  } catch {
    throw new Error("เปิดไฟล์ Excel ไม่ได้ ไฟล์อาจเสียหรือไม่ใช่ .xlsx");
  }
  const read = (name: string) => entries.find((entry) => entry.name === name)?.data.toString("utf8") ?? null;

  const workbook = read("xl/workbook.xml");
  const relationships = read("xl/_rels/workbook.xml.rels");
  const firstSheetId = workbook?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const target = firstSheetId
    ? relationships?.match(new RegExp(`<Relationship\\b[^>]*\\bId="${firstSheetId}"[^>]*\\bTarget="([^"]+)"`))?.[1]
      ?? relationships?.match(new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${firstSheetId}"`))?.[1]
    : undefined;
  const sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target}`) : "xl/worksheets/sheet1.xml";
  const sheet = read(sheetPath);
  if (!sheet) throw new Error("ไม่พบชีตข้อมูลในไฟล์ Excel");

  const shared = [...(read("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => textOf(match[1]));

  return [...sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
    const cells: string[] = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1];
      const inner = cell[2] ?? "";
      const reference = attributes.match(/\br="([A-Z]+)\d+"/)?.[1];
      const index = reference ? columnIndex(reference) : cells.length;
      const type = attributes.match(/\bt="(\w+)"/)?.[1];
      const raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const value =
        type === "s" ? shared[Number(raw)] ?? ""
          : type === "inlineStr" ? textOf(inner)
            : raw === undefined ? ""
              : decodeXml(raw);
      while (cells.length < index) cells.push("");
      cells[index] = value;
    }
    return cells;
  });
};

/** RFC 4180: quoted cells may hold commas, doubled quotes and line breaks - Google's written
 *  answers regularly do. */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
};
