export type AttendanceSheetCourse = {
  code: string;
  title: string;
  date: string;
  batch?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  ownerCompany: string;
};

export type AttendanceSheetParticipant = {
  id: string;
  name: string;
  company: string;
  department: string;
  position: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const displayValue = (value: unknown) => {
  const text = String(value ?? "").trim();
  return escapeHtml(text || "-");
};

const getParticipantName = (participant: AttendanceSheetParticipant) => {
  if (participant.firstName || participant.lastName) {
    return {
      prefix: participant.prefix || "-",
      firstName: participant.firstName || participant.name,
      lastName: participant.lastName || "-",
    };
  }

  const nameParts = participant.name.trim().split(/\s+/);
  return {
    prefix: participant.prefix || "-",
    firstName: nameParts[0] || participant.name,
    lastName: nameParts.slice(1).join(" ") || "-",
  };
};

export const getAttendanceSheetFileName = (
  course: Pick<AttendanceSheetCourse, "code" | "date" | "batch">,
) => {
  const fileIdentity = [course.code, course.date, course.batch || "session"]
    .join("_")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `attendance_${fileIdentity || "training-session"}.xls`;
};

export const buildAttendanceSheetHtml = (
  course: AttendanceSheetCourse,
  participants: AttendanceSheetParticipant[],
) => {
  const trainingTime =
    course.startTime || course.endTime
      ? `${course.startTime || "-"} - ${course.endTime || "-"}`
      : "-";
  const participantRows = participants
    .map((participant, index) => {
      const name = getParticipantName(participant);

      return `
        <tr class="participant-row">
          <td class="center">${index + 1}</td>
          <td>${displayValue(participant.id)}</td>
          <td>${displayValue(name.prefix)}</td>
          <td>${displayValue(name.firstName)}</td>
          <td>${displayValue(name.lastName)}</td>
          <td>${displayValue(participant.company)}</td>
          <td>${displayValue(participant.department)}</td>
          <td>${displayValue(participant.position)}</td>
          <td class="check-cell"></td>
          <td class="check-cell"></td>
          <td class="signature-cell"></td>
          <td class="remark-cell"></td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>Training Attendance &amp; Signature Sheet</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body {
      margin: 0;
      color: #172033;
      font-family: "Noto Sans Thai", Tahoma, Arial, sans-serif;
      font-size: 10pt;
    }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td, th { border: 1px solid #28313f; padding: 5px 6px; vertical-align: middle; }
    .title {
      border: 0;
      font-size: 17pt;
      font-weight: 700;
      padding: 5px 0 10px;
      text-align: center;
    }
    .meta-label { width: 11%; background: #eef2f6; font-weight: 700; }
    .meta-value { width: 39%; }
    .spacer td { height: 8px; border: 0; padding: 0; }
    thead th {
      background: #dce6f1;
      font-size: 9pt;
      font-weight: 700;
      text-align: center;
      white-space: normal;
    }
    .participant-row { height: 36px; }
    .center, .check-cell { text-align: center; }
    .check-cell, .signature-cell, .remark-cell { background: #fff; }
    .summary td { background: #f7f8fa; font-weight: 700; height: 28px; }
    .sign-off td { border: 0; height: 58px; padding-top: 24px; text-align: center; }
    .document-note { border: 0; color: #4b5563; font-size: 8.5pt; padding-top: 8px; }
  </style>
</head>
<body>
  <table>
    <colgroup>
      <col style="width:4%">
      <col style="width:9%">
      <col style="width:6%">
      <col style="width:9%">
      <col style="width:10%">
      <col style="width:7%">
      <col style="width:10%">
      <col style="width:10%">
      <col style="width:5%">
      <col style="width:5%">
      <col style="width:13%">
      <col style="width:12%">
    </colgroup>
    <tr>
      <td class="title" colspan="12">ใบตรวจสอบการเข้าอบรม / Training Attendance &amp; Signature Sheet</td>
    </tr>
    <tr>
      <td class="meta-label" colspan="2">หลักสูตร / Course</td>
      <td class="meta-value" colspan="4">${displayValue(course.title)}</td>
      <td class="meta-label" colspan="2">รหัส / Code</td>
      <td class="meta-value" colspan="4">${displayValue(course.code)}</td>
    </tr>
    <tr>
      <td class="meta-label" colspan="2">วันที่ / Date</td>
      <td class="meta-value" colspan="4">${displayValue(course.date)}</td>
      <td class="meta-label" colspan="2">รุ่น / Batch</td>
      <td class="meta-value" colspan="4">${displayValue(course.batch)}</td>
    </tr>
    <tr>
      <td class="meta-label" colspan="2">เวลา / Time</td>
      <td class="meta-value" colspan="4">${displayValue(trainingTime)}</td>
      <td class="meta-label" colspan="2">สถานที่ / Location</td>
      <td class="meta-value" colspan="4">${displayValue(course.location)}</td>
    </tr>
    <tr>
      <td class="meta-label" colspan="2">ผู้รับผิดชอบ / Owner</td>
      <td class="meta-value" colspan="10">${displayValue(course.ownerCompany)}</td>
    </tr>
    <tr class="spacer"><td colspan="12"></td></tr>
    <thead>
      <tr>
        <th>ลำดับ<br>No.</th>
        <th>รหัสพนักงาน<br>Employee ID</th>
        <th>คำนำหน้า<br>Prefix</th>
        <th>ชื่อ<br>First name</th>
        <th>นามสกุล<br>Last name</th>
        <th>บริษัท<br>Company</th>
        <th>หน่วยงาน<br>Department</th>
        <th>ตำแหน่ง<br>Position</th>
        <th>มาอบรม<br>Attend</th>
        <th>ไม่มา<br>Absent</th>
        <th>ลายเซ็น<br>Signature</th>
        <th>หมายเหตุ<br>Remark</th>
      </tr>
    </thead>
    <tbody>
      ${participantRows}
      <tr class="summary">
        <td colspan="8">รวมรายชื่อ / Total participants</td>
        <td colspan="4">${participants.length} คน / people</td>
      </tr>
      <tr class="sign-off">
        <td colspan="4">ผู้จัดทำ / Prepared by ______________________________</td>
        <td colspan="4">ผู้ตรวจสอบ / Verified by ___________________________</td>
        <td colspan="4">วันที่ / Date ______________________________</td>
      </tr>
      <tr>
        <td class="document-note" colspan="12">
          เอกสารนี้ใช้ยืนยันการเข้าอบรมจริง กรุณาทำเครื่องหมายสถานะและลงลายมือชื่อในวันอบรม
          / Mark attendance status and sign this sheet on the training date.
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
};
