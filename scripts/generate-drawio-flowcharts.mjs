import fs from "fs";
import path from "path";

function escapeXml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

class DrawioBuilder {
  constructor() {
    this.pages = [];
  }

  addPage(name, buildFn) {
    const elements = [];
    let idCounter = 2;

    const addVertex = ({ x, y, width, height, value, style }) => {
      const id = `node_${idCounter++}`;
      const escapedVal = escapeXml(value);
      elements.push(
        `<mxCell id="${id}" value="${escapedVal}" style="${style}" vertex="1" parent="1">` +
        `<mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" />` +
        `</mxCell>`
      );
      return id;
    };

    const addEdge = ({ source, target, value = "", style = "", exitX, exitY, entryX, entryY }) => {
      const id = `edge_${idCounter++}`;
      const escapedVal = escapeXml(value);
      let edgeStyle = style || "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#64748b;";
      if (exitX !== undefined) edgeStyle += `exitX=${exitX};exitY=${exitY};`;
      if (entryX !== undefined) edgeStyle += `entryX=${entryX};entryY=${entryY};`;

      elements.push(
        `<mxCell id="${id}" value="${escapedVal}" style="${edgeStyle}" edge="1" parent="1" source="${source}" target="${target}">` +
        `<mxGeometry relative="1" as="geometry" />` +
        `</mxCell>`
      );
      return id;
    };

    buildFn({ addVertex, addEdge });

    this.pages.push({
      name,
      xml: elements.join("\n        ")
    });
  }

  toXml() {
    let out = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="ATTG System" version="21.0.0" type="device">\n`;

    this.pages.forEach((page, idx) => {
      out += `  <diagram id="page_${idx + 1}" name="${escapeXml(page.name)}">\n`;
      out += `    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="900" math="0" shadow="0">\n`;
      out += `      <root>\n`;
      out += `        <mxCell id="0" />\n`;
      out += `        <mxCell id="1" parent="0" />\n`;
      out += `        ${page.xml}\n`;
      out += `      </root>\n`;
      out += `    </mxGraphModel>\n`;
      out += `  </diagram>\n`;
    });

    out += `</mxfile>\n`;
    return out;
  }
}

const STYLES = {
  header: "text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=18;fontStyle=1;fontColor=#0f172a;",
  blue: "rounded=1;whiteSpace=wrap;html=1;fillColor=#dbeafe;strokeColor=#2563eb;fontColor=#1e3a8a;fontSize=12;fontStyle=1;arcSize=14;",
  green: "rounded=1;whiteSpace=wrap;html=1;fillColor=#dcfce7;strokeColor=#16a34a;fontColor=#14532d;fontSize=12;fontStyle=1;arcSize=14;",
  amber: "rounded=1;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#d97706;fontColor=#78350f;fontSize=12;fontStyle=1;arcSize=14;",
  purple: "rounded=1;whiteSpace=wrap;html=1;fillColor=#ede9fe;strokeColor=#7c3aed;fontColor=#4c1d95;fontSize=12;fontStyle=1;arcSize=14;",
  rose: "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe4e6;strokeColor=#e11d48;fontColor=#881337;fontSize=12;fontStyle=1;arcSize=14;",
  cyan: "rounded=1;whiteSpace=wrap;html=1;fillColor=#cffafe;strokeColor=#0891b2;fontColor=#155e75;fontSize=12;fontStyle=1;arcSize=14;",
  slate: "rounded=1;whiteSpace=wrap;html=1;fillColor=#f1f5f9;strokeColor=#64748b;fontColor=#0f172a;fontSize=12;fontStyle=1;arcSize=14;",
  diamond: "rhombus;whiteSpace=wrap;html=1;fillColor=#fef9c3;strokeColor=#ca8a04;fontColor=#713f12;fontSize=11;fontStyle=1;",
  db: "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#e2e8f0;strokeColor=#475569;fontColor=#1e293b;fontSize=12;fontStyle=1;",
  edge: "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#475569;",
  edgeGreen: "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#16a34a;",
  edgeRed: "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#dc2626;"
};

const builder = new DrawioBuilder();

// ----------------------------------------------------
// PAGE 1: System Overview
// ----------------------------------------------------
builder.addPage("1. System Overview", ({ addVertex, addEdge }) => {
  addVertex({ x: 300, y: 30, width: 600, height: 40, value: "ATTG Training Plan Management - ภาพรวมระบบทั้งหมด", style: STYLES.header });

  const nMaster = addVertex({ x: 100, y: 120, width: 200, height: 70, value: "Master Data Management\n(องค์กร, บริษัท, พนักงาน, วิทยากร)", style: STYLES.slate });
  const nPlan = addVertex({ x: 370, y: 120, width: 200, height: 70, value: "1. Training Plan Management\n(Need -> Survey -> OAP -> Rolling)", style: STYLES.blue });
  const nCourse = addVertex({ x: 640, y: 120, width: 200, height: 70, value: "2. Course & Assessment Setup\n(Course Master, Pre/Post Test, Form)", style: STYLES.purple });
  const nLearn = addVertex({ x: 910, y: 120, width: 200, height: 70, value: "3. Employee Participation\n(ลงทะเบียน, เช็คชื่อ, ทำข้อสอบ/ประเมิน)", style: STYLES.amber });

  const nRecord = addVertex({ x: 370, y: 280, width: 200, height: 70, value: "4. Training Record Management\n(ตรวจข้อสอบ, ประมวลผลคะแนน, My Records)", style: STYLES.green });
  const nCert = addVertex({ x: 640, y: 280, width: 200, height: 70, value: "5. Certificate & Storage\n(ออกใบประกาศนียบัตร, คลังใบรับรอง)", style: STYLES.cyan });
  const nReport = addVertex({ x: 910, y: 280, width: 200, height: 70, value: "6. Reports & Export Engine\n(Dashboard, ปฏิทิน, Excel Export)", style: STYLES.rose });

  const nAdmin = addVertex({ x: 100, y: 280, width: 200, height: 70, value: "Admin & Security Governance\n(User Accounts, RBAC, Audit, PDPA)", style: STYLES.slate });

  addEdge({ source: nMaster, target: nPlan, style: STYLES.edge });
  addEdge({ source: nPlan, target: nCourse, style: STYLES.edge });
  addEdge({ source: nCourse, target: nLearn, style: STYLES.edge });
  addEdge({ source: nLearn, target: nRecord, style: STYLES.edge });
  addEdge({ source: nRecord, target: nCert, style: STYLES.edge });
  addEdge({ source: nRecord, target: nReport, style: STYLES.edge });
  addEdge({ source: nAdmin, target: nMaster, style: STYLES.edge });
});

// ----------------------------------------------------
// PAGE 2: Training Plan Management
// ----------------------------------------------------
builder.addPage("2. Training Plan", ({ addVertex, addEdge }) => {
  addVertex({ x: 300, y: 30, width: 600, height: 40, value: "โมดูลที่ 1: การจัดการแผนฝึกอบรม (Training Plan Management)", style: STYLES.header });

  const step1 = addVertex({ x: 500, y: 100, width: 240, height: 60, value: "1. แผนก/โรงงาน ส่งคำขอฝึกอบรม\n(Request Training Need)", style: STYLES.blue });
  const step2 = addVertex({ x: 500, y: 200, width: 240, height: 60, value: "2. HRD สำรวจและตรวจสอบคำขอ\n(Training Accept Survey)", style: STYLES.blue });
  const decision = addVertex({ x: 530, y: 300, width: 180, height: 70, value: "อนุมัติบรรจุในแผน?", style: STYLES.diamond });
  const reject = addVertex({ x: 800, y: 305, width: 180, height: 60, value: "ปฏิเสธ / ส่งกลับแก้ไข", style: STYLES.rose });
  const step3 = addVertex({ x: 500, y: 410, width: 240, height: 60, value: "3. จัดทำแผนฝึกอบรมประจำปี\n(Training OAP: Overall Annual Plan)", style: STYLES.green });
  const step4 = addVertex({ x: 500, y: 510, width: 240, height: 60, value: "4. ปรับแผนตามไตรมาส/รายเดือน\n(Training Rolling Plan)", style: STYLES.amber });
  const step5 = addVertex({ x: 500, y: 610, width: 240, height: 60, value: "5. กำหนดห้องอบรม, วิทยากร & งบประมาณ", style: STYLES.slate });
  const step6 = addVertex({ x: 500, y: 710, width: 240, height: 60, value: "6. เปิดรับสมัคร (Publish Plan)\nแสดงผลบนปฏิทินและ Dashboard", style: STYLES.purple });

  addEdge({ source: step1, target: step2, style: STYLES.edge });
  addEdge({ source: step2, target: decision, style: STYLES.edge });
  addEdge({ source: decision, target: reject, value: "ไม่อนุมัติ", style: STYLES.edgeRed });
  addEdge({ source: decision, target: step3, value: "อนุมัติ", style: STYLES.edgeGreen });
  addEdge({ source: step3, target: step4, style: STYLES.edge });
  addEdge({ source: step4, target: step5, style: STYLES.edge });
  addEdge({ source: step5, target: step6, style: STYLES.edge });
});

// ----------------------------------------------------
// PAGE 3: Course & Assessment
// ----------------------------------------------------
builder.addPage("3. Course & Assessment", ({ addVertex, addEdge }) => {
  addVertex({ x: 300, y: 30, width: 600, height: 40, value: "โมดูลที่ 2: จัดการหลักสูตรและแบบทดสอบ (Course & Assessment)", style: STYLES.header });

  const course = addVertex({ x: 480, y: 100, width: 260, height: 70, value: "Course Master Workspace\n(รหัสคอร์ส, วัตถุประสงค์, กลุ่มเป้าหมาย, ชั่วโมง)", style: STYLES.purple });
  const branch = addVertex({ x: 520, y: 210, width: 180, height: 60, value: "สร้างแบบวัดผล", style: STYLES.diamond });

  const assess = addVertex({ x: 250, y: 310, width: 250, height: 70, value: "Assessment Management\n(Pre-test & Post-test)", style: STYLES.rose });
  const assessTypes = addVertex({ x: 250, y: 420, width: 250, height: 80, value: "กำหนดประเภทข้อสอบ:\n• ช้อยส์ (Single/Multi-choice)\n• ข้อเขียน (Text/Essay)\n• ตารางประเมิน (Grid Matrix)", style: STYLES.slate });
  const assessRules = addVertex({ x: 250, y: 540, width: 250, height: 70, value: "กำหนดเกณฑ์ผ่าน (Passing Score %)\nและเวลาจำกัด (Time Limit)", style: STYLES.amber });

  const evalMgmt = addVertex({ x: 720, y: 310, width: 250, height: 70, value: "Evaluation Management\n(แบบประเมินความพึงพอใจการอบรม)", style: STYLES.cyan });
  const evalQuestions = addVertex({ x: 720, y: 420, width: 250, height: 80, value: "สร้างคำถามประเมิน:\n• ด้านเนื้อหา / ด้านวิทยากร\n• สถานที่ / การนำไปประยุกต์ใช้", style: STYLES.slate });

  const preview = addVertex({ x: 480, y: 660, width: 260, height: 60, value: "Form Preview Runner\n(ทดลองทำฟอร์ม & ตรวจสอบการทำงาน)", style: STYLES.blue });
  const linkCourse = addVertex({ x: 480, y: 760, width: 260, height: 60, value: "ผูกข้อสอบและแบบประเมินเข้ากับคอร์สอบรม", style: STYLES.green });

  addEdge({ source: course, target: branch, style: STYLES.edge });
  addEdge({ source: branch, target: assess, value: "ข้อสอบ", style: STYLES.edge });
  addEdge({ source: branch, target: evalMgmt, value: "แบบประเมิน", style: STYLES.edge });
  addEdge({ source: assess, target: assessTypes, style: STYLES.edge });
  addEdge({ source: assessTypes, target: assessRules, style: STYLES.edge });
  addEdge({ source: evalMgmt, target: evalQuestions, style: STYLES.edge });
  addEdge({ source: assessRules, target: preview, style: STYLES.edge });
  addEdge({ source: evalQuestions, target: preview, style: STYLES.edge });
  addEdge({ source: preview, target: linkCourse, style: STYLES.edgeGreen });
});

// ----------------------------------------------------
// PAGE 4: Employee Learning Journey
// ----------------------------------------------------
builder.addPage("4. Employee Journey", ({ addVertex, addEdge }) => {
  addVertex({ x: 300, y: 30, width: 600, height: 40, value: "โมดูลที่ 3: กระบวนการสำหรับพนักงาน (Employee Learning Journey)", style: STYLES.header });

  const login = addVertex({ x: 500, y: 90, width: 220, height: 50, value: "พนักงาน Login เข้าสู่ระบบ", style: STYLES.slate });
  const choice = addVertex({ x: 520, y: 170, width: 180, height: 60, value: "เลือกเส้นทางอบรม", style: STYLES.diamond });

  const regCourse = addVertex({ x: 330, y: 260, width: 220, height: 60, value: "ดูตารางอบรม & สมัครเรียน\n(Register Training Module)", style: STYLES.blue });
  const reqNeed = addVertex({ x: 670, y: 260, width: 220, height: 60, value: "ยื่นคำขออบรมเพิ่มเติม\n(Request Training Module)", style: STYLES.amber });

  const pretest = addVertex({ x: 500, y: 360, width: 220, height: 60, value: "ทำแบบทดสอบก่อนเรียน\n(Pre-test Assessment)", style: STYLES.rose });
  const attend = addVertex({ x: 500, y: 450, width: 220, height: 60, value: "เข้าอบรมตามกำหนด\n(เช็คชื่อ Attendance QR / Sheet)", style: STYLES.blue });
  const posttest = addVertex({ x: 500, y: 540, width: 220, height: 60, value: "ทำแบบทดสอบหลังเรียน\n(Post-test Assessment)", style: STYLES.rose });
  const evaluation = addVertex({ x: 500, y: 630, width: 220, height: 60, value: "ทำแบบประเมินผลการอบรม\n(Evaluation Survey)", style: STYLES.cyan });

  const passDecision = addVertex({ x: 520, y: 720, width: 180, height: 60, value: "ผ่านเกณฑ์คะแนน & เวลาเรียน?", style: STYLES.diamond });
  const cert = addVertex({ x: 330, y: 810, width: 220, height: 60, value: "ได้รับใบประกาศนียบัตร (Certificate)\nและบันทึกลง My Records (Pass)", style: STYLES.green });
  const fail = addVertex({ x: 670, y: 810, width: 220, height: 60, value: "บันทึกผล Failed\n(รอสอบซ่อม / อบรมซ้ำ)", style: STYLES.rose });

  addEdge({ source: login, target: choice, style: STYLES.edge });
  addEdge({ source: choice, target: regCourse, value: "คอร์สในแผน", style: STYLES.edge });
  addEdge({ source: choice, target: reqNeed, value: "ขอเพิ่ม", style: STYLES.edge });
  addEdge({ source: regCourse, target: pretest, style: STYLES.edge });
  addEdge({ source: reqNeed, target: regCourse, value: "เมื่ออนุมัติ", style: STYLES.edge });
  addEdge({ source: pretest, target: attend, style: STYLES.edge });
  addEdge({ source: attend, target: posttest, style: STYLES.edge });
  addEdge({ source: posttest, target: evaluation, style: STYLES.edge });
  addEdge({ source: evaluation, target: passDecision, style: STYLES.edge });
  addEdge({ source: passDecision, target: cert, value: "ผ่าน", style: STYLES.edgeGreen });
  addEdge({ source: passDecision, target: fail, value: "ไม่ผ่าน", style: STYLES.edgeRed });
});

// ----------------------------------------------------
// PAGE 5: Training Record & Actual
// ----------------------------------------------------
builder.addPage("5. Training Record & Actual", ({ addVertex, addEdge }) => {
  addVertex({ x: 300, y: 30, width: 600, height: 40, value: "โมดูลที่ 4: การบันทึกผลและจัดอบรมจริง (Training Record Management)", style: STYLES.header });

  const startActual = addVertex({ x: 480, y: 100, width: 260, height: 60, value: "เริ่มจัดรอบอบรมจริง (Training Actual)\nบันทึก วันที่, เวลา, วิทยากร, รายชื่อ", style: STYLES.blue });
  const attendance = addVertex({ x: 480, y: 200, width: 260, height: 60, value: "เช็คชื่อผู้เข้าเรียน (Attendance Check)\nExport ใบลงชื่อ Excel", style: STYLES.blue });

  const grading = addVertex({ x: 510, y: 300, width: 200, height: 60, value: "ประเภทข้อสอบที่ส่งเข้ามา", style: STYLES.diamond });
  const autoGrade = addVertex({ x: 260, y: 390, width: 240, height: 60, value: "Auto-Grading\n(ตรวจข้อสอบปรนัยทันทีโดยระบบ)", style: STYLES.green });
  const manualGrade = addVertex({ x: 720, y: 390, width: 240, height: 60, value: "Submission Review Page\n(วิทยากร/HR ตรวจข้อเขียนและให้คะแนน)", style: STYLES.amber });

  const converter = addVertex({ x: 480, y: 500, width: 260, height: 60, value: "Evaluation Converter & Summary\n(ประมวลผลคะแนนและตัดเกรดผ่าน/ไม่ผ่าน)", style: STYLES.purple });
  const updateRecord = addVertex({ x: 480, y: 600, width: 260, height: 60, value: "อัปเดตประวัติการฝึกอบรม (Training Record)\nบันทึกรายบุคคลและฐานข้อมูลกลาง", style: STYLES.green });
  const uploadCert = addVertex({ x: 480, y: 700, width: 260, height: 60, value: "Certificate Upload & Storage\n(ออกและอัปโหลดไฟล์ใบประกาศฯ)", style: STYLES.cyan });

  addEdge({ source: startActual, target: attendance, style: STYLES.edge });
  addEdge({ source: attendance, target: grading, style: STYLES.edge });
  addEdge({ source: grading, target: autoGrade, value: "ปรนัย", style: STYLES.edgeGreen });
  addEdge({ source: grading, target: manualGrade, value: "ข้อเขียน/อัตนัย", style: STYLES.edge });
  addEdge({ source: autoGrade, target: converter, style: STYLES.edgeGreen });
  addEdge({ source: manualGrade, target: converter, style: STYLES.edge });
  addEdge({ source: converter, target: updateRecord, style: STYLES.edge });
  addEdge({ source: updateRecord, target: uploadCert, style: STYLES.edgeGreen });
});

// ----------------------------------------------------
// PAGE 6: Admin & Governance
// ----------------------------------------------------
builder.addPage("6. Admin & Security", ({ addVertex, addEdge }) => {
  addVertex({ x: 300, y: 30, width: 600, height: 40, value: "โมดูลที่ 5: การดูแลระบบและความปลอดภัย (Admin & Governance)", style: STYLES.header });

  const adminLogin = addVertex({ x: 480, y: 90, width: 260, height: 50, value: "Admin เข้าสู่ Admin Dashboard", style: STYLES.slate });

  const uac = addVertex({ x: 120, y: 200, width: 240, height: 70, value: "User Account Management\n• สร้าง / ระงับ / แก้ไขบัญชี\n• รีเซ็ตรหัสผ่าน (Argon2 Hash)", style: STYLES.blue });
  const rbac = addVertex({ x: 120, y: 320, width: 240, height: 70, value: "Role-Based Access Control\n• EMPLOYEE\n• HRD_FACTORY / HRD_CENTER\n• ADMIN", style: STYLES.purple });

  const audit = addVertex({ x: 480, y: 200, width: 260, height: 70, value: "Audit Logs & Activity Tracking\n• บันทึกทุก Action ในระบบ\n• ค้นหาและตรวจสอบย้อนหลัง", style: STYLES.rose });
  const activeSess = addVertex({ x: 480, y: 320, width: 260, height: 70, value: "Active Users & Heartbeat\n• ตรวจสอบผู้ใช้ออนไลน์แบบ Realtime\n• ติดตาม Session หมดอายุ", style: STYLES.amber });

  const pdpa = addVertex({ x: 840, y: 200, width: 240, height: 70, value: "Data Security (PDPA)\n• เข้ารหัสบัตรประชาชน (AES)\n• HMAC Key Versioning & Rotation", style: STYLES.cyan });
  const purge = addVertex({ x: 840, y: 320, width: 240, height: 70, value: "Maintenance & Purge\n• System Stats การทำงานของเซิร์ฟเวอร์\n• ล้างประวัติ Log เก่าตามรอบเวลา", style: STYLES.slate });

  addEdge({ source: adminLogin, target: uac, style: STYLES.edge });
  addEdge({ source: adminLogin, target: audit, style: STYLES.edge });
  addEdge({ source: adminLogin, target: pdpa, style: STYLES.edge });
  addEdge({ source: uac, target: rbac, style: STYLES.edge });
  addEdge({ source: audit, target: activeSess, style: STYLES.edge });
  addEdge({ source: pdpa, target: purge, style: STYLES.edge });
});

// ----------------------------------------------------
// PAGE 7: Reports & Export Engine
// ----------------------------------------------------
builder.addPage("7. Reports & Exports", ({ addVertex, addEdge }) => {
  addVertex({ x: 300, y: 30, width: 600, height: 40, value: "โมดูลที่ 6: รายงานและการส่งออกข้อมูล (Reports & Export Engines)", style: STYLES.header });

  const dbSource = addVertex({ x: 500, y: 90, width: 220, height: 70, value: "MSSQL Database\n(ตารางแผน, การลงทะเบียน, ผลคะแนน, งบ)", style: STYLES.db });
  const engine = addVertex({ x: 500, y: 210, width: 220, height: 60, value: "Report & Export Services\n(Data Processing & Aggregation)", style: STYLES.blue });

  const calReport = addVertex({ x: 150, y: 340, width: 240, height: 70, value: "Schedule Calendar\n(ปฏิทินตารางอบรมทั้งปี แยกสีตามบริษัท\nATA, TEP, ATFB, NIC, SATI, SNF)", style: STYLES.cyan });
  const sumReport = addVertex({ x: 490, y: 340, width: 240, height: 70, value: "Summary Dashboard\n• จำนวนชั่วโมงอบรมเฉลี่ย\n• ค่าใช้จ่ายและการใช้งบประมาณ\n• สถิติจำนวนผู้ผ่านการอบรม", style: STYLES.amber });
  const xlsReport = addVertex({ x: 830, y: 340, width: 240, height: 70, value: "Excel Workbook Exporter\n• Attendance Sheet (ใบเช็คชื่อ)\n• Course Outline (โครงสร้างคอร์ส)\n• Evaluation Summary (สรุปผลประเมิน)", style: STYLES.green });

  addEdge({ source: dbSource, target: engine, style: STYLES.edge });
  addEdge({ source: engine, target: calReport, style: STYLES.edge });
  addEdge({ source: engine, target: sumReport, style: STYLES.edge });
  addEdge({ source: engine, target: xlsReport, style: STYLES.edgeGreen });
});

const xmlOutput = builder.toXml();
const targetPath = path.resolve("d:/TrainingPlan/ATTG_Training_Plan_Flowcharts.drawio");
fs.writeFileSync(targetPath, xmlOutput, "utf-8");
console.log("Successfully generated:", targetPath);
