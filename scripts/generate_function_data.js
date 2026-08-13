import fs from 'fs';

const content = fs.readFileSync('C:\\Users\\trainee\\Desktop\\FuntionData.csv', 'utf8');
const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
const headerLine = lines[lines.length - 1];
const dataLines = lines.slice(0, lines.length - 1);

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i+1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

const headers = parseCSVLine(headerLine);
const compIdToCode = {
  '1290': 'ATA',
  '0450': 'TEP',
  '1510': 'ATFB',
  '0420': 'NIC',
  '1120': 'SATI',
  '0430': 'SNF',
};

const records = dataLines.map((l, idx) => {
  const cols = parseCSVLine(l);
  const row = {};
  headers.forEach((h, i) => {
    row[h] = cols[i] || '';
  });
  const compCode = compIdToCode[row.Comp_ID] || '';
  return {
    id: `func-${String(idx + 1).padStart(4, '0')}`,
    functionCode: `FNC${String(idx + 1).padStart(4, '0')}`,
    compCode,
    compId: row.Comp_ID,
    compNameTh: row.Comp_Name_TH,
    functionNameTh: row.Funtion_TH,
    functionNameEn: row.Funtion_EN,
    divisionTh: row.Division_TH,
    divisionEn: row.Division_EN,
    departmentTh: row.Department_TH,
    departmentEn: row.Department_EN,
    sectionTh: row.Section_TH,
    sectionEn: row.Section_EN,
  };
});

fs.writeFileSync('d:\\trainingplan\\training-plan-management\\app\\components\\center_factory\\MasterDataManagement\\modules\\defaultFunctionRows.data.ts', `import type { FunctionRecord } from "./FunctionData";

export const defaultFunctionRows: FunctionRecord[] = ${JSON.stringify(records, null, 2)};
`);

console.log('Successfully wrote defaultFunctionRows.data.ts with', records.length, 'records');
