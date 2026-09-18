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
 * Sample courses directly modeled after ตัวอย่าง.pdf
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

const escapeXml = (str?: string | number | null): string => {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

/**
 * Generates OpenXML Body representing the layout of ตัวอย่าง.pdf
 */
export const buildDocxBodyXml = (
  employee: EmployeeDocumentData,
  courses: CourseDocumentItem[],
): string => {
  const empId = escapeXml(employee.employeeId || "-");
  const empName = escapeXml(employee.name || "-");
  const department = escapeXml(employee.department || "-");
  const division = escapeXml(employee.division || "-");
  const position = escapeXml(employee.position || "-");
  const section = escapeXml(employee.section || employee.division || "-");
  const workStartDateThai = escapeXml(formatThaiDateFull(employee.workStartDate));
  const workDuration = escapeXml(calculateWorkDuration(employee.workStartDate));
  const courseCount = courses.length;

  let coursesRowsXml = "";
  courses.forEach((item, index) => {
    const seq = escapeXml(item.seqNo || index + 1);
    const startThai = escapeXml(formatThaiDateShort(item.startDate));
    const endThai = escapeXml(formatThaiDateShort(item.endDate));
    const title = escapeXml(item.courseTitle || "-");
    const inst = escapeXml(item.instructor || "-");

    coursesRowsXml += `
    <w:tr>
        <w:tc>
            <w:tcPr><w:tcW w:w="900" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>${seq}</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc>
            <w:tcPr><w:tcW w:w="1600" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>${startThai}</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc>
            <w:tcPr><w:tcW w:w="1600" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>${endThai}</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc>
            <w:tcPr><w:tcW w:w="4200" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>${title}</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc>
            <w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>${inst}</w:t></w:r>
            </w:p>
        </w:tc>
    </w:tr>`;
  });

  return `
<!-- Title: ประวัติการฝึกอบรม (18pt bold centered) -->
<w:p>
    <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="120" w:after="240"/>
        <w:rPr>
            <w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/>
            <w:b/>
            <w:sz w:val="36"/>
            <w:szCs w:val="36"/>
        </w:rPr>
    </w:pPr>
    <w:r>
        <w:rPr>
            <w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/>
            <w:b/>
            <w:sz w:val="36"/>
            <w:szCs w:val="36"/>
        </w:rPr>
        <w:t>ประวัติการฝึกอบรม</w:t>
    </w:r>
</w:p>

<!-- Employee Metadata Table (2 columns, borderless) -->
<w:tbl>
    <w:tblPr>
        <w:tblW w:w="10800" w:type="dxa"/>
        <w:tblBorders>
            <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
            <w:insideH w:val="none"/><w:insideV w:val="none"/>
        </w:tblBorders>
    </w:tblPr>
    <w:tr>
        <!-- Left Column -->
        <w:tc>
            <w:tcPr><w:tcW w:w="5800" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="60"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">รหัสพนักงาน  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${empId}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:spacing w:after="60"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">ชื่อ-นามสกุล  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${empName}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:spacing w:after="60"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">แผนก  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${department}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:spacing w:after="60"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">ฝ่าย/สำนักงาน  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${division}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:spacing w:after="60"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">วันเข้างาน  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${workStartDateThai}</w:t></w:r>
            </w:p>
        </w:tc>
        <!-- Right Column -->
        <w:tc>
            <w:tcPr><w:tcW w:w="5000" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:spacing w:after="60"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">ตำแหน่ง  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${position}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:spacing w:after="60"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">ส่วน/ฝ่าย  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${section}</w:t></w:r>
            </w:p>
            <w:p><w:pPr><w:spacing w:after="60"/><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">อายุงาน  </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${workDuration}</w:t></w:r>
            </w:p>
        </w:tc>
    </w:tr>
</w:tbl>

<!-- Summary Paragraph -->
<w:p>
    <w:pPr>
        <w:spacing w:before="120" w:after="120"/>
        <w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>
    </w:pPr>
    <w:r>
        <w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>
        <w:t xml:space="preserve">ได้เข้ารับการฝึกอบรมในหลักสูตรต่างๆ รวมทั้งสิ้น  </w:t>
    </w:r>
    <w:r>
        <w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>
        <w:t>${courseCount}</w:t>
    </w:r>
    <w:r>
        <w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>
        <w:t xml:space="preserve">  หลักสูตร ดังนี้</w:t>
    </w:r>
</w:p>

<!-- Courses Table matching ตัวอย่าง.pdf -->
<w:tbl>
    <w:tblPr>
        <w:tblW w:w="10800" w:type="dxa"/>
        <w:tblBorders>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="333333"/>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="333333"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="333333"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="333333"/>
            <w:insideH w:val="single" w:sz="6" w:space="0" w:color="333333"/>
            <w:insideV w:val="single" w:sz="6" w:space="0" w:color="333333"/>
        </w:tblBorders>
    </w:tblPr>
    <!-- Header Row -->
    <w:tr>
        <w:trPr><w:tblHeader/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="900" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>ลำดับที่</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1600" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>วันที่เริ่ม</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1600" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>วันที่สิ้นสุด</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc><w:tcPr><w:tcW w:w="4200" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>
            <w:p><w:pPr><w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>หลักสูตร</w:t></w:r>
            </w:p>
        </w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:pPr>
                <w:r><w:rPr><w:b/><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>วิทยากร</w:t></w:r>
            </w:p>
        </w:tc>
    </w:tr>
    ${coursesRowsXml}
</w:tbl>
`;
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

  // Resolve employee and courses data
  const employee: EmployeeDocumentData = options.isTest
    ? { ...SAMPLE_EMPLOYEE_DATA, companyCode }
    : {
        ...SAMPLE_EMPLOYEE_DATA,
        ...(options.employee || {}),
        companyCode: options.employee?.companyCode || companyCode,
      };

  const courses: CourseDocumentItem[] =
    options.courses && options.courses.length > 0
      ? options.courses
      : SAMPLE_COURSES_DATA;

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

    // 3. Build new OpenXML body
    const bodyXml = buildDocxBodyXml(employee, courses);
    const fullXml = buildFullDocumentXml(bodyXml, sectPr);

    fs.writeFileSync(tempXmlPath, fullXml, "utf8");

    // 4. Update word/document.xml in the zip package
    const updateCmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::Open('${tempDocxPath.replace(/\\/g, "\\\\")}', [System.IO.Compression.ZipArchiveMode]::Update); $entry = $zip.GetEntry('word/document.xml'); if ($entry) { $entry.Delete() }; [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, '${tempXmlPath.replace(/\\/g, "\\\\")}', 'word/document.xml'); $zip.Dispose()"`;

    cp.execSync(updateCmd, { encoding: "utf8" });

    // 5. Read generated docx buffer
    const buffer = fs.readFileSync(tempDocxPath);

    const safeEmpId = (employee.employeeId || "test").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `ประวัติการฝึกอบรม_${companyCode}_${safeEmpId}.docx`;

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
