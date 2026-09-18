import {
  COMPANY_LETTERHEADS,
  resolveCompanyLetterhead,
  type CompanyLetterheadCode,
  type CompanyLetterheadInfo,
} from "./companyLetterheadConfig";
import {
  calculateWorkDuration,
  formatThaiDateFull,
  formatThaiDateShort,
} from "./recordDocumentFormatters";

export type EmployeeDocumentProfile = {
  employeeCode: string;
  nameTh: string;
  nameEn?: string;
  positionName: string;
  sectionName?: string;
  departmentName?: string;
  divisionName?: string;
  workday?: string | Date | null;
  birthday?: string | Date | null;
  companyCode: string;
};

export type CourseRecordItem = {
  id?: string;
  courseCode: string;
  courseTitle: string;
  startDate?: string | Date | null;
  completedDate?: string | Date | null;
  provider?: string;
  instructor?: string;
  hours?: number;
  score?: number | null;
  scoreMax?: number | null;
  result?: string;
};

export type ApprovalDocumentInfo = {
  requestNo?: string;
  approvedBy?: string;
  approvedAt?: string | null;
};

const escapeHtml = (val?: string | number | null): string => {
  if (val === undefined || val === null) return "-";
  return String(val)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
};

/**
 * Generate full HTML/CSS document formatted exactly like ตัวอย่าง.pdf
 */
export const generateRecordHtml = (
  employee: EmployeeDocumentProfile,
  records: CourseRecordItem[],
  targetCompanyCode?: string,
  approvalInfo?: ApprovalDocumentInfo,
): string => {
  const company: CompanyLetterheadInfo = resolveCompanyLetterhead(
    targetCompanyCode || employee.companyCode,
  );

  const workDuration = calculateWorkDuration(employee.workday);
  const formattedWorkday = formatThaiDateFull(employee.workday);

  const divisionOrDept =
    employee.departmentName || employee.divisionName || "-";
  const sectionText = employee.sectionName || "-";

  const rowsHtml = records
    .map((rec, index) => {
      const start = formatThaiDateShort(rec.startDate || rec.completedDate);
      const end = formatThaiDateShort(rec.completedDate || rec.startDate);
      const instructorOrProvider = rec.instructor || rec.provider || "-";

      return `
        <tr>
          <td class="col-num">${index + 1}</td>
          <td class="col-date">${escapeHtml(start)}</td>
          <td class="col-date">${escapeHtml(end)}</td>
          <td class="col-title">${escapeHtml(rec.courseTitle)}</td>
          <td class="col-inst">${escapeHtml(instructorOrProvider)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ประวัติการฝึกอบรม - ${escapeHtml(employee.nameTh)} (${escapeHtml(employee.employeeCode)})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 16mm 14mm 16mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: "Sarabun", "TH Sarabun New", "Angsana New", Tahoma, sans-serif;
      color: #111827;
      margin: 0;
      padding: 16px;
      background-color: #ffffff;
      font-size: 13px;
      line-height: 1.35;
    }

    .document-page {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      background: #ffffff;
      position: relative;
    }

    /* HEADER */
    .company-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1e293b;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .company-logo {
      max-height: 48px;
      max-width: 150px;
      object-fit: contain;
    }

    .company-title-block {
      text-align: right;
    }

    .company-name-th {
      font-size: 15px;
      font-weight: bold;
      color: #0f172a;
      margin: 0;
    }

    .company-name-en {
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      letter-spacing: 0.5px;
      margin: 2px 0 0 0;
    }

    /* DOC TITLE */
    .doc-title {
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      margin: 10px 0 14px 0;
      letter-spacing: 0.5px;
    }

    /* EMPLOYEE METADATA GRID */
    .employee-grid {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 5px 20px;
      margin-bottom: 12px;
      font-size: 13px;
    }

    .meta-row {
      display: flex;
      align-items: baseline;
    }

    .meta-label {
      width: 105px;
      font-weight: 600;
      color: #334155;
      flex-shrink: 0;
    }

    .meta-value {
      flex: 1;
      color: #0f172a;
    }

    .summary-lead {
      font-size: 13px;
      margin: 10px 0 8px 0;
      font-weight: 500;
    }

    .summary-count {
      font-weight: bold;
      margin: 0 4px;
    }

    /* COURSE HISTORY TABLE */
    table.course-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12px;
    }

    table.course-table th,
    table.course-table td {
      border: 1px solid #475569;
      padding: 5px 6px;
      vertical-align: top;
    }

    table.course-table th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: bold;
      text-align: center;
    }

    .col-num {
      width: 7%;
      text-align: center;
    }

    .col-date {
      width: 13%;
      text-align: center;
      white-space: nowrap;
    }

    .col-title {
      width: 44%;
      text-align: left;
    }

    .col-inst {
      width: 23%;
      text-align: left;
    }

    /* FOOTER */
    .company-footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #94a3b8;
      font-size: 10.5px;
      color: #475569;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .footer-left {
      max-width: 80%;
      line-height: 1.4;
    }

    .footer-right {
      text-align: right;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }

    /* APPROVAL BADGE STAMP (IF APPROVED) */
    .approval-stamp {
      display: inline-block;
      margin-top: 6px;
      padding: 4px 10px;
      border: 1px dashed #059669;
      border-radius: 4px;
      font-size: 11px;
      color: #059669;
      background-color: #ecfdf5;
    }

    /* ACTION BAR FOR SCREEN VIEW */
    .screen-action-bar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 100;
    }

    .screen-action-btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .screen-action-btn:hover {
      background: #1d4ed8;
    }

    @media print {
      body {
        padding: 0;
        background: transparent;
      }
      .screen-action-bar {
        display: none !important;
      }
      .document-page {
        max-width: 100%;
      }
      tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>

  <!-- Screen View Print Button (hidden when printed) -->
  <div class="screen-action-bar">
    <div>
      <strong>ตัวอย่างเอกสารประวัติการฝึกอบรม (${escapeHtml(company.code)})</strong>
      <span style="font-size: 12px; margin-left: 8px; opacity: 0.85;">
        ${escapeHtml(employee.nameTh)} • ${records.length} หลักสูตร
      </span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="screen-action-btn" onclick="window.print()">
        🖨️ พิมพ์ / บันทึกเป็น PDF (Print or Save PDF)
      </button>
    </div>
  </div>

  <div class="document-page">
    <!-- HEADER -->
    <div class="company-header">
      <div class="logo-container">
        <img src="${company.logoUrl}" alt="${escapeHtml(company.nameEn)}" class="company-logo" />
      </div>
      <div class="company-title-block">
        <h1 class="company-name-th">${escapeHtml(company.nameTh)}</h1>
        <h2 class="company-name-en">${escapeHtml(company.nameEn)}</h2>
      </div>
    </div>

    <!-- TITLE -->
    <div class="doc-title">ประวัติการฝึกอบรม</div>

    <!-- EMPLOYEE INFO -->
    <div class="employee-grid">
      <div>
        <div class="meta-row">
          <span class="meta-label">รหัสพนักงาน</span>
          <span class="meta-value">${escapeHtml(employee.employeeCode)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">ชื่อ-นามสกุล</span>
          <span class="meta-value">${escapeHtml(employee.nameTh)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">แผนก</span>
          <span class="meta-value">${escapeHtml(sectionText)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">ฝ่าย/สำนักงาน</span>
          <span class="meta-value">${escapeHtml(divisionOrDept)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">วันเข้างาน</span>
          <span class="meta-value">${escapeHtml(formattedWorkday)}</span>
        </div>
      </div>

      <div>
        <div class="meta-row">
          <span class="meta-label">ตำแหน่ง</span>
          <span class="meta-value">${escapeHtml(employee.positionName)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">ส่วน/ฝ่าย</span>
          <span class="meta-value">${escapeHtml(divisionOrDept)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">อายุงาน</span>
          <span class="meta-value">${escapeHtml(workDuration)}</span>
        </div>
        ${
          approvalInfo?.requestNo
            ? `
          <div style="margin-top: 6px;">
            <div class="approval-stamp">
              อนุมัติโดย: ${escapeHtml(approvalInfo.approvedBy || "Section Head")}<br/>
              เลขที่คำขอ: ${escapeHtml(approvalInfo.requestNo)}
            </div>
          </div>
        `
            : ""
        }
      </div>
    </div>

    <!-- SUMMARY -->
    <div class="summary-lead">
      ได้เข้ารับการฝึกอบรมในหลักสูตรต่างๆ รวมทั้งสิ้น <span class="summary-count">${records.length}</span> หลักสูตร ดังนี้
    </div>

    <!-- TABLE -->
    <table class="course-table">
      <thead>
        <tr>
          <th class="col-num">ลำดับที่</th>
          <th class="col-date">วันที่เริ่ม</th>
          <th class="col-date">วันที่สิ้นสุด</th>
          <th class="col-title">หลักสูตร</th>
          <th class="col-inst">วิทยากร</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- FOOTER -->
    <div class="company-footer">
      <div class="footer-left">
        <div>${escapeHtml(company.addressTh)}</div>
        <div style="font-size: 9.5px; margin-top: 1px;">${escapeHtml(company.addressEn)}</div>
        <div style="margin-top: 2px;">
          โทรศัพท์: ${escapeHtml(company.tel)} | โทรสาร: ${escapeHtml(company.fax)}
          ${company.standardNote ? ` | ${escapeHtml(company.standardNote)}` : ""}
        </div>
      </div>
      <div class="footer-right">
        <span>Page 1 of 1</span>
      </div>
    </div>
  </div>

</body>
</html>`;
};
