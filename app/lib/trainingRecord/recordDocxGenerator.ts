import fs from "fs";
import path from "path";
import cp from "child_process";
import os from "os";
import {
  type CompanyLetterheadCode,
  resolveCompanyLetterhead,
} from "./companyLetterheadConfig";
import {
  formatThaiDateFull,
  formatThaiDateShort,
  calculateWorkDuration,
} from "./recordDocumentFormatters";

export interface EmployeeDocumentData {
  employeeId?: string | null;
  name?: string | null;
  position?: string | null;
  department?: string | null;
  division?: string | null;
  section?: string | null;
  workStartDate?: string | Date | null;
  companyCode?: string | null;
}

export interface CourseDocumentItem {
  seqNo: number;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  courseTitle: string;
  instructor?: string | null;
}

export interface GenerateDocxOptions {
  companyCode?: CompanyLetterheadCode | string | null;
  employee?: EmployeeDocumentData | null;
  courses?: CourseDocumentItem[] | null;
  isTest?: boolean;
  isMultiPage?: boolean;
}

/**
 * Sample employee data directly modeled after ตัวอย่าง.pdf
 */
export const SAMPLE_EMPLOYEE_DATA: EmployeeDocumentData = {
  employeeId: "1290-000063",
  name: "นริศสา ศิลปะพิบูรย์",
  position: "ผู้จัดการบริหารทั่วไป",
  department: "-",
  division: "ฝ่ายฝึกอบรม",
  section: "ฝ่ายฝึกอบรม",
  workStartDate: "1982-04-16",
  companyCode: "ATA",
};

/**
 * Sample courses (short test)
 */
export const SAMPLE_COURSES_DATA: CourseDocumentItem[] = [
  {
    seqNo: 1,
    startDate: "1992-07-18",
    endDate: "1992-07-18",
    courseTitle: "ระบบคุณภาพ ISO 9000",
    instructor: "สนง.บค.ก/คฟ.",
  },
  {
    seqNo: 2,
    startDate: "1994-06-14",
    endDate: "1994-11-12",
    courseTitle: "MDP",
    instructor: "สนง.บค.ก/คฟ.",
  },
  {
    seqNo: 3,
    startDate: "1996-03-20",
    endDate: "1996-03-22",
    courseTitle: "การบริหารจัดการยุคใหม่และการพัฒนาภาวะผู้นำ",
    instructor: "สถาบันเพิ่มผลผลิตแห่งชาติ",
  },
];

/**
 * Complete multi-page sample course data (43 courses directly modeled after ตัวอย่าง.pdf)
 * Used to demonstrate and verify pagination across multiple pages in Word (.docx)
 */
export const SAMPLE_MULTIPAGE_COURSES_DATA: CourseDocumentItem[] = [
  { seqNo: 1, startDate: "1992-07-18", endDate: "1992-07-18", courseTitle: "ระบบคุณภาพ ISO 9000", instructor: "สนง.บค.ก/คฟ." },
  { seqNo: 2, startDate: "1994-06-14", endDate: "1994-11-12", courseTitle: "MDP", instructor: "สนง.บค.ก/คฟ." },
  { seqNo: 3, startDate: "1994-07-18", endDate: "1994-07-21", courseTitle: "Problem Solving", instructor: "สนง.บค.ก/คฟ." },
  { seqNo: 4, startDate: "1994-11-14", endDate: "1994-11-14", courseTitle: "MDS", instructor: "ศ.อซ." },
  { seqNo: 5, startDate: "1996-08-05", endDate: "1996-08-05", courseTitle: "The Managerial Grid", instructor: "-" },
  { seqNo: 6, startDate: "1996-09-18", endDate: "1996-09-18", courseTitle: "การรายงานเพื่อการจัดการ", instructor: "ฝ่ายการเงิน บปซ." },
  { seqNo: 7, startDate: "1997-01-10", endDate: "1997-01-12", courseTitle: "AMS", instructor: "สนง.บค.ก" },
  { seqNo: 8, startDate: "1997-01-29", endDate: "1997-02-13", courseTitle: "Excel For Window", instructor: "Siam Computer" },
  { seqNo: 9, startDate: "1997-01-30", endDate: "1997-01-30", courseTitle: "Information Technology Update", instructor: "-" },
  { seqNo: 10, startDate: "1997-03-03", endDate: "1997-03-03", courseTitle: "TQC Overview", instructor: "สถาบันเพิ่มผลผลิตแห่งชาติ" },
  { seqNo: 11, startDate: "1997-03-21", endDate: "1997-03-21", courseTitle: "ความรู้เกี่ยวกับ ISO/IEC Guide 25", instructor: "-" },
  { seqNo: 12, startDate: "1997-08-14", endDate: "1997-08-14", courseTitle: "แรงงานสัมพันธ์สำหรับพนักงานจัดการ", instructor: "ศูนย์อบรมกลุ่มซิเมนต์" },
  { seqNo: 13, startDate: "1997-08-25", endDate: "1997-08-26", courseTitle: "QS 9000", instructor: "เทคโนโลยีวัสดุแห่งประเทศไทย" },
  { seqNo: 14, startDate: "1997-11-28", endDate: "1997-11-28", courseTitle: "SMC", instructor: "-" },
  { seqNo: 15, startDate: "1998-04-03", endDate: "1998-04-03", courseTitle: "Interpretation QS - 9000", instructor: "-" },
  { seqNo: 16, startDate: "1998-10-10", endDate: "1998-10-20", courseTitle: "จป.บริหาร", instructor: "SCG" },
  { seqNo: 17, startDate: "2000-01-24", endDate: "2000-01-25", courseTitle: "TPS", instructor: "-" },
  { seqNo: 18, startDate: "2001-05-08", endDate: "2001-05-08", courseTitle: "SAP For Manager", instructor: "-" },
  { seqNo: 19, startDate: "2001-08-18", endDate: "2001-08-18", courseTitle: "Cost Control Structure", instructor: "-" },
  { seqNo: 20, startDate: "2002-07-24", endDate: "2002-07-24", courseTitle: "การชี้แจงประเด็นปัญหาสิ่งแวดล้อม", instructor: "-" },
  { seqNo: 21, startDate: "2002-10-04", endDate: "2002-10-04", courseTitle: "ความรู้เบื้องต้นเกี่ยวกับระบบการจัดการสิ่งแวดล้อม", instructor: "-" },
  { seqNo: 22, startDate: "2005-08-04", endDate: "2005-08-04", courseTitle: "ISO/TS 16949:2002 Overview For Top Management", instructor: "-" },
  { seqNo: 23, startDate: "2005-08-09", endDate: "2005-08-09", courseTitle: "ATAS", instructor: "-" },
  { seqNo: 24, startDate: "2006-05-08", endDate: "2006-05-08", courseTitle: "Sand Control (Green Sand Molding Quality)", instructor: "-" },
  { seqNo: 25, startDate: "2006-10-04", endDate: "2006-10-06", courseTitle: "Toyota Cost & Quality Management", instructor: "Toyota Acadamy" },
  { seqNo: 26, startDate: "2006-12-09", endDate: "2006-12-09", courseTitle: "Occupational Health And Safety Assessment Sereis1", instructor: "-" },
  { seqNo: 27, startDate: "2008-08-25", endDate: "2008-08-26", courseTitle: "คณะกรรมการความปลอดภัยในการทำงาน (คปอ.)", instructor: "SHAWPAT" },
  { seqNo: 28, startDate: "2011-09-15", endDate: "2011-09-15", courseTitle: "Cross Cultural - รุ่น 2", instructor: "SCG" },
  { seqNo: 29, startDate: "2012-11-01", endDate: "2012-11-01", courseTitle: "Leadership Development for Management - รุ่น 2", instructor: "SCG" },
  { seqNo: 30, startDate: "2013-02-05", endDate: "2013-02-06", courseTitle: "HRD Master Plan", instructor: "SCG" },
  { seqNo: 31, startDate: "2013-03-17", endDate: "2013-03-17", courseTitle: "LDM", instructor: "SCG" },
  { seqNo: 32, startDate: "2013-05-29", endDate: "2013-05-29", courseTitle: "Safety Awareness", instructor: "Safety Team" },
  { seqNo: 33, startDate: "2014-08-07", endDate: "2014-08-07", courseTitle: "Coaching For Success", instructor: "SCG" },
  { seqNo: 34, startDate: "2016-10-04", endDate: "2016-10-04", courseTitle: "How to utilize view point for find out hazardous situation", instructor: "MGR. WORANUNT AMORNVECHAYAKUL" },
  { seqNo: 35, startDate: "2016-10-19", endDate: "2016-10-19", courseTitle: "Green Sand Seminar", instructor: "K.Ittiphol Udomsilp" },
  { seqNo: 36, startDate: "2017-07-14", endDate: "2017-07-14", courseTitle: "Financial for saary man", instructor: "คุณนิตินัย สุนทรเภสัช" },
  { seqNo: 37, startDate: "2017-08-23", endDate: "2017-08-23", courseTitle: "Train The Trainer", instructor: "ดร. กุสุมา เทพรักษ์" },
  { seqNo: 38, startDate: "2017-12-14", endDate: "2017-12-14", courseTitle: "การควบคุมและตรวจสอบคุณภาพสำหรับงานหล่อโลหะ", instructor: "สมาคมอุตสาหกรรมหล่อโลหะไทย" },
  { seqNo: 39, startDate: "2018-01-30", endDate: "2018-01-30", courseTitle: "(BSL) Basic life support", instructor: "พล.ต.ต.นพ.โสภณ กฤษณะรังสรรค์" },
  { seqNo: 40, startDate: "2018-01-30", endDate: "2018-01-30", courseTitle: "CPR", instructor: "พล.ต.ต. นพ.โสภณ กฤษณะรังสรรค์" },
  { seqNo: 41, startDate: "2018-05-04", endDate: "2018-05-05", courseTitle: "Team Building", instructor: "ATTG's Facilitator" },
  { seqNo: 42, startDate: "2018-08-07", endDate: "2018-08-08", courseTitle: "Train The Trainer (Level Up)", instructor: "อ.นพรัตน์ ขำพลับ" },
  { seqNo: 43, startDate: "2018-08-15", endDate: "2018-08-15", courseTitle: "SDC (Safety Driving for Car)", instructor: "อ.ประเสริฐ อ.วันชัย อ.วีระพงษ์ อ.เสถียร" },
];

const escapeXml = (str?: string | number | null): string => {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

export const DEFAULT_COMPANY_USABLE_WIDTHS: Record<CompanyLetterheadCode, number> = {
  ATA: 10915,
  ATFB: 9497,
  NIC: 10440,
  SATI: 9027,
  SNF: 9611,
  TEP: 10402,
};

/**
 * Extracts printable/usable width in dxa from sectPr xml
 */
export const extractPageUsableWidth = (sectPrXml: string, fallbackWidth: number = 9027): number => {
  if (!sectPrXml) return fallbackWidth;
  const wMatch = sectPrXml.match(/<w:pgSz[^>]*w:w="(\d+)"/);
  const leftMatch = sectPrXml.match(/<w:pgMar[^>]*w:left="(\d+)"/);
  const rightMatch = sectPrXml.match(/<w:pgMar[^>]*w:right="(\d+)"/);

  if (wMatch && leftMatch && rightMatch) {
    const totalW = parseInt(wMatch[1], 10);
    const leftMar = parseInt(leftMatch[1], 10);
    const rightMar = parseInt(rightMatch[1], 10);
    const calculated = totalW - leftMar - rightMar;
    if (calculated > 5000 && calculated < 15000) {
      return calculated;
    }
  }

  return fallbackWidth;
};

/**
 * Generates OpenXML for a single page containing:
 * 1. Title: ประวัติการฝึกอบรม
 * 2. Employee Metadata Table (2 columns, borderless, centered)
 * 3. Summary Paragraph (ได้เข้ารับการฝึกอบรมในหลักสูตรต่างๆ รวมทั้งสิ้น X หลักสูตร ดังนี้)
 * 4. Courses Table for the specified page slice
 */
const buildSinglePageXml = (
  employee: EmployeeDocumentData,
  coursesSlice: CourseDocumentItem[],
  totalCourseCount: number,
  tableWidth: number,
  metaCol1: number,
  metaCol2: number,
  c1: number,
  c2: number,
  c3: number,
  c4: number,
  c5: number,
): string => {
  const empId = escapeXml(employee.employeeId || "-");
  const empName = escapeXml(employee.name || "-");
  const department = escapeXml(employee.department || "-");
  const division = escapeXml(employee.division || "-");
  const position = escapeXml(employee.position || "-");
  const section = escapeXml(employee.section || employee.division || "-");
  const workStartDateThai = escapeXml(formatThaiDateFull(employee.workStartDate));
  const workDuration = escapeXml(calculateWorkDuration(employee.workStartDate));

  let coursesRowsXml = "";
  coursesSlice.forEach((item, index) => {
    const seq = escapeXml(item.seqNo || index + 1);
    const startThai = escapeXml(formatThaiDateShort(item.startDate));
    const endThai = escapeXml(formatThaiDateShort(item.endDate));
    const title = escapeXml(item.courseTitle || "-");
    const rawInst = (item.instructor || "").trim();
    const inst = escapeXml(rawInst || "-");
    const instAlign = inst === "-" ? "center" : "left";

    coursesRowsXml += `
    <w:tr>
        <w:trPr><w:cantSplit/></w:trPr>
        <w:tc>
            <w:tcPr><w:tcW w:w="${c1}" w:type="dxa"/><w:vAlign w:val="center"/><w:noWrap/></w:tcPr>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>${seq}</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc>
            <w:tcPr><w:tcW w:w="${c2}" w:type="dxa"/><w:vAlign w:val="center"/><w:noWrap/></w:tcPr>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>${startThai}</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc>
            <w:tcPr><w:tcW w:w="${c3}" w:type="dxa"/><w:vAlign w:val="center"/><w:noWrap/></w:tcPr>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>${endThai}</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc>
            <w:tcPr><w:tcW w:w="${c4}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t xml:space="preserve">${title}</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc>
            <w:tcPr><w:tcW w:w="${c5}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="${instAlign}"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t xml:space="preserve">${inst}</w:t></w:r>
            </w:p>
        </w:tc>
    </w:tr>`;
  });

  return `
<!-- Title: ประวัติการฝึกอบรม (17pt bold centered) -->
<w:p>
    <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="30"/>
        <w:rPr>
            <w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/>
            <w:b/>
            <w:sz w:val="34"/>
            <w:szCs w:val="34"/>
        </w:rPr>
    </w:pPr>
    <w:r>
        <w:rPr>
            <w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/>
            <w:b/>
            <w:sz w:val="34"/>
            <w:szCs w:val="34"/>
        </w:rPr>
        <w:t>ประวัติการฝึกอบรม</w:t>
    </w:r>
</w:p>

<!-- Employee Metadata Table (2 columns, borderless, centered, 15pt) -->
<w:tbl>
    <w:tblPr>
        <w:tblW w:w="${tableWidth}" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
            <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
            <w:insideH w:val="none"/><w:insideV w:val="none"/>
        </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>
        <w:gridCol w:w="${metaCol1}"/>
        <w:gridCol w:w="${metaCol2}"/>
    </w:tblGrid>
    <w:tr>
        <!-- Left Column -->
        <w:tc>
            <w:tcPr><w:tcW w:w="${metaCol1}" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t xml:space="preserve">รหัสพนักงาน  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>${empId}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t xml:space="preserve">ชื่อ-นามสกุล  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>${empName}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t xml:space="preserve">แผนก  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>${department}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t xml:space="preserve">ฝ่าย/สำนักงาน  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>${division}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t xml:space="preserve">วันเข้างาน  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>${workStartDateThai}</w:t></w:r>
            </w:p>
        </w:tc>
        <!-- Right Column -->
        <w:tc>
            <w:tcPr><w:tcW w:w="${metaCol2}" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t xml:space="preserve">ตำแหน่ง  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>${position}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t xml:space="preserve">ส่วน/ฝ่าย  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>${section}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t xml:space="preserve">อายุงาน  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>${workDuration}</w:t></w:r>
            </w:p>
        </w:tc>
    </w:tr>
</w:tbl>

<!-- Summary Paragraph (15pt) -->
<w:p>
    <w:pPr>
        <w:spacing w:before="15" w:after="15"/>
        <w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>
    </w:pPr>
    <w:r>
        <w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>
        <w:t xml:space="preserve">ได้เข้ารับการฝึกอบรมในหลักสูตรต่างๆ รวมทั้งสิ้น  </w:t>
    </w:r>
    <w:r>
        <w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>
        <w:t>${totalCourseCount}</w:t>
    </w:r>
    <w:r>
        <w:rPr><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>
        <w:t xml:space="preserve">  หลักสูตร ดังนี้</w:t>
    </w:r>
</w:p>

<!-- Courses Table matching ตัวอย่าง.pdf (15pt) -->
<w:tbl>
    <w:tblPr>
        <w:tblW w:w="${tableWidth}" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblCellMar>
            <w:top w:w="30" w:type="dxa"/>
            <w:bottom w:w="30" w:type="dxa"/>
            <w:left w:w="100" w:type="dxa"/>
            <w:right w:w="100" w:type="dxa"/>
        </w:tblCellMar>
        <w:tblBorders>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="333333"/>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="333333"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="333333"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="333333"/>
            <w:insideH w:val="single" w:sz="6" w:space="0" w:color="333333"/>
            <w:insideV w:val="single" w:sz="6" w:space="0" w:color="333333"/>
        </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>
        <w:gridCol w:w="${c1}"/>
        <w:gridCol w:w="${c2}"/>
        <w:gridCol w:w="${c3}"/>
        <w:gridCol w:w="${c4}"/>
        <w:gridCol w:w="${c5}"/>
    </w:tblGrid>
    <!-- Header Row (15pt bold) -->
    <w:tr>
        <w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="${c1}" w:type="dxa"/><w:vAlign w:val="center"/><w:noWrap/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>ลำดับที่</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc><w:tcPr><w:tcW w:w="${c2}" w:type="dxa"/><w:vAlign w:val="center"/><w:noWrap/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>วันที่เริ่ม</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc><w:tcPr><w:tcW w:w="${c3}" w:type="dxa"/><w:vAlign w:val="center"/><w:noWrap/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>วันที่สิ้นสุด</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc><w:tcPr><w:tcW w:w="${c4}" w:type="dxa"/><w:vAlign w:val="center"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>หลักสูตร</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc><w:tcPr><w:tcW w:w="${c5}" w:type="dxa"/><w:vAlign w:val="center"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="Angsana New" w:hAnsi="Angsana New" w:cs="Angsana New"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr><w:t>วิทยากร</w:t></w:r>
            </w:p>
        </w:tc>
    </w:tr>
    ${coursesRowsXml}
</w:tbl>
`;
};

/**
 * Generates OpenXML Body representing the layout of ตัวอย่าง.pdf.
 * When courses span multiple pages (> 20 courses per page), each page contains:
 * 1. Title (ประวัติการฝึกอบรม)
 * 2. Employee Metadata Table
 * 3. Summary sentence (รวมทั้งสิ้น X หลักสูตร)
 * 4. Course table slice for that page
 * Exactly matching ตัวอย่าง.pdf where every page carries the employee info.
 */
export const buildDocxBodyXml = (
  employee: EmployeeDocumentData,
  courses: CourseDocumentItem[],
  tableWidth: number = 9027,
): string => {
  const courseCount = courses.length;

  // Metadata table column widths (54% / 46%)
  const metaCol1 = Math.round(tableWidth * 0.54);
  const metaCol2 = tableWidth - metaCol1;

  // Course table column widths:
  // c1 (ลำดับที่): 5% - strictly single number, noWrap
  // c2 (วันที่เริ่ม): 14% - wide room for short Thai date e.g. 10 ส.ค. 69, noWrap
  // c3 (วันที่สิ้นสุด): 14% - wide room for short Thai date e.g. 10 ส.ค. 69, noWrap
  // c5 (วิทยากร): 33% - generous width (~3,000+ dxa) so full names and titles sit on 1 line
  // c4 (หลักสูตร): 34% (remaining) - balanced course title
  const c1 = Math.round(tableWidth * 0.05);
  const c2 = Math.round(tableWidth * 0.14);
  const c3 = Math.round(tableWidth * 0.14);
  const c5 = Math.round(tableWidth * 0.33);
  const c4 = tableWidth - c1 - c2 - c3 - c5;

  const COURSES_PER_PAGE = 20;
  const pageChunks: CourseDocumentItem[][] = [];

  if (courses.length === 0) {
    pageChunks.push([]);
  } else {
    for (let i = 0; i < courses.length; i += COURSES_PER_PAGE) {
      pageChunks.push(courses.slice(i, i + COURSES_PER_PAGE));
    }
  }

  const pagesXml = pageChunks.map((chunk) =>
    buildSinglePageXml(
      employee,
      chunk,
      courseCount,
      tableWidth,
      metaCol1,
      metaCol2,
      c1,
      c2,
      c3,
      c4,
      c5,
    ),
  );

  const pageBreakXml =
    '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
  return pagesXml.join(pageBreakXml);
};

/**
 * Builds the complete word/document.xml string with namespace attributes and sectPr
 */
export const buildFullDocumentXml = (bodyXml: string, sectPrXml: string): string => {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" ' +
    'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' +
    'xmlns:v="urn:schemas-microsoft-com:vml" ' +
    'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:w10="urn:schemas-microsoft-com:office:word" ' +
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ' +
    'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" ' +
    'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ' +
    'xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" ' +
    'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" ' +
    'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" ' +
    'mc:Ignorable="w14 w15 wp14">\n' +
    `<w:body>${bodyXml}${sectPrXml}</w:body></w:document>`
  );
};

/**
 * Generates an official Training Record Microsoft Word (.docx) document
 * by cloning the selected company's template and inserting the formatted body.
 * Returns a Buffer containing the .docx file.
 */
export const generateTrainingRecordDocx = async (
  options: GenerateDocxOptions,
): Promise<{ buffer: Buffer; fileName: string; companyCode: CompanyLetterheadCode }> => {
  const companyInfo = resolveCompanyLetterhead(options.companyCode);
  const companyCode = companyInfo.code;
  const isMulti = options.isMultiPage ?? false;

  // Resolve employee and courses data
  const employee: EmployeeDocumentData = options.employee
    ? {
        companyCode: options.employee.companyCode || companyCode,
        ...options.employee,
      }
    : (options.isTest || isMulti)
    ? { ...SAMPLE_EMPLOYEE_DATA, companyCode }
    : { companyCode };

  const courses: CourseDocumentItem[] = isMulti
    ? SAMPLE_MULTIPAGE_COURSES_DATA
    : options.isTest
    ? SAMPLE_COURSES_DATA
    : (options.courses ?? []);

  // Locate company Word template
  const templatePath = path.join(
    process.cwd(),
    "app",
    "Word",
    companyInfo.templateFileName,
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `Word template not found for company ${companyCode} at: ${templatePath}`,
    );
  }

  // Create temporary files for the generation process
  const tempId = `docx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const tempDocxPath = path.join(os.tmpdir(), `${tempId}.docx`);
  const tempXmlPath = path.join(os.tmpdir(), `${tempId}_document.xml`);

  try {
    // 1. Copy template to temp docx
    fs.copyFileSync(templatePath, tempDocxPath);

    // 2. Extract sectPr from template
    const extractCmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::Open('${tempDocxPath.replace(/\\/g, "\\\\")}', [System.IO.Compression.ZipArchiveMode]::Read); $entry = $zip.GetEntry('word/document.xml'); $stream = $entry.Open(); $reader = New-Object System.IO.StreamReader($stream); $xml = $reader.ReadToEnd(); $reader.Close(); $stream.Close(); $zip.Dispose(); if ($xml -match '(<w:sectPr[\\s\\S]*?</w:sectPr>)') { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::Write($matches[1]) }"`;

    let sectPr = "";
    try {
      sectPr = cp.execSync(extractCmd, { encoding: "utf8" }).trim();
    } catch {
      sectPr = "";
    }

    const fallbackWidth = DEFAULT_COMPANY_USABLE_WIDTHS[companyCode] || 9027;
    const usableWidth = extractPageUsableWidth(sectPr, fallbackWidth);

    // 3. Build new OpenXML body
    const bodyXml = buildDocxBodyXml(employee, courses, usableWidth);
    const fullXml = buildFullDocumentXml(bodyXml, sectPr);

    fs.writeFileSync(tempXmlPath, fullXml, "utf8");

    // 4. Update word/document.xml in the zip package
    const updateCmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::Open('${tempDocxPath.replace(/\\/g, "\\\\")}', [System.IO.Compression.ZipArchiveMode]::Update); $entry = $zip.GetEntry('word/document.xml'); if ($entry) { $entry.Delete() }; [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, '${tempXmlPath.replace(/\\/g, "\\\\")}', 'word/document.xml'); $zip.Dispose()"`;

    cp.execSync(updateCmd, { encoding: "utf8" });

    // 5. Read generated docx buffer
    const buffer = fs.readFileSync(tempDocxPath);

    const rawName = (employee.name || "").trim() || (employee.employeeId || "").trim() || "User";
    const cleanUserName = rawName
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const fileName = isMulti
      ? `ประวัติการฝึกอบรม_ตัวอย่างหลายหน้า_43หลักสูตร.docx`
      : `ประวัติการฝึกอบรม_${cleanUserName}.docx`;

    return {
      buffer,
      fileName,
      companyCode,
    };
  } finally {
    // Cleanup temporary files
    try {
      if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath);
    } catch {
      // ignore cleanup error
    }
    try {
      if (fs.existsSync(tempXmlPath)) fs.unlinkSync(tempXmlPath);
    } catch {
      // ignore cleanup error
    }
  }
};
