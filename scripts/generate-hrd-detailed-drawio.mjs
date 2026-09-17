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

  addPage(name, width = 1400, height = 1000, buildFn) {
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
      let edgeStyle = style || "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#475569;";
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
      width,
      height,
      xml: elements.join("\n        ")
    });
  }

  toXml() {
    let out = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="ATTG HRD System" version="21.0.0" type="device">\n`;

    this.pages.forEach((page, idx) => {
      out += `  <diagram id="page_${idx + 1}" name="${escapeXml(page.name)}">\n`;
      out += `    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${page.width}" pageHeight="${page.height}" math="0" shadow="0">\n`;
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
  header: "text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=20;fontStyle=1;fontColor=#0f172a;",
  subHeader: "text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=13;fontColor=#475569;",
  laneBox: "swimlane;startSize=30;horizontal=1;fillColor=#f8fafc;strokeColor=#cbd5e1;fontColor=#1e293b;fontSize=14;fontStyle=1;rounded=1;arcSize=6;",
  
  blue: "rounded=1;whiteSpace=wrap;html=1;fillColor=#dbeafe;strokeColor=#2563eb;fontColor=#1e3a8a;fontSize=12;fontStyle=1;arcSize=10;",
  green: "rounded=1;whiteSpace=wrap;html=1;fillColor=#dcfce7;strokeColor=#16a34a;fontColor=#14532d;fontSize=12;fontStyle=1;arcSize=10;",
  amber: "rounded=1;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#d97706;fontColor=#78350f;fontSize=12;fontStyle=1;arcSize=10;",
  purple: "rounded=1;whiteSpace=wrap;html=1;fillColor=#ede9fe;strokeColor=#7c3aed;fontColor=#4c1d95;fontSize=12;fontStyle=1;arcSize=10;",
  rose: "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe4e6;strokeColor=#e11d48;fontColor=#881337;fontSize=12;fontStyle=1;arcSize=10;",
  cyan: "rounded=1;whiteSpace=wrap;html=1;fillColor=#cffafe;strokeColor=#0891b2;fontColor=#155e75;fontSize=12;fontStyle=1;arcSize=10;",
  slate: "rounded=1;whiteSpace=wrap;html=1;fillColor=#f1f5f9;strokeColor=#64748b;fontColor=#0f172a;fontSize=12;fontStyle=1;arcSize=10;",
  
  diamond: "rhombus;whiteSpace=wrap;html=1;fillColor=#fef9c3;strokeColor=#ca8a04;fontColor=#713f12;fontSize=11;fontStyle=1;",
  db: "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#e2e8f0;strokeColor=#475569;fontColor=#1e293b;fontSize=12;fontStyle=1;",
  
  edge: "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#475569;",
  edgeBlue: "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#2563eb;",
  edgeGreen: "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#16a34a;",
  edgeRed: "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#dc2626;",
  edgePurple: "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#7c3aed;"
};

const builder = new DrawioBuilder();

// ====================================================================
// PAGE 1: Course Master & Standard Flow (HRD Center vs Factory)
// ====================================================================
builder.addPage("1. Course Master & Standard", 1450, 1100, ({ addVertex, addEdge }) => {
  addVertex({ x: 350, y: 25, width: 750, height: 40, value: "HRD: Course Master & Standard Lifecycle Flow", style: STYLES.header });
  addVertex({ x: 350, y: 65, width: 750, height: 25, value: "กระบวนการสร้างและบริหารหลักสูตรมาตรฐาน (Center Template ➔ Factory Course ➔ Prerequisite & Target Group)", style: STYLES.subHeader });

  // Center Lane vs Factory Lane
  addVertex({ x: 50, y: 110, width: 620, height: 920, value: "HRD_CENTER (ส่วนกลาง / Master Standard)", style: STYLES.laneBox });
  addVertex({ x: 730, y: 110, width: 650, height: 920, value: "HRD_FACTORY (ฝ่ายโรงงาน: ATA, TEP, ATFB, etc.)", style: STYLES.laneBox });

  // Center path
  const cStart = addVertex({ x: 190, y: 170, width: 280, height: 55, value: "1. เริ่มสร้างคอร์สต้นแบบส่วนกลาง\n(Create Course Master Template)", style: STYLES.purple });
  const cMeta = addVertex({ x: 190, y: 260, width: 280, height: 75, value: "2. กำหนดข้อมูลพื้นฐานหลักสูตร\n• รหัสหลักสูตร, ชื่อคอร์ส (TH/EN)\n• วัตถุประสงค์ & เนื้อหา (Objective & Content)\n• หมวดหมู่: Course Type & Course Group", style: STYLES.purple });
  const cMethod = addVertex({ x: 190, y: 370, width: 280, height: 60, value: "3. กำหนดวิธีการและมาตรฐานการสอน\n• Methodology (Classroom / Online / OJT)\n• ชั่วโมงอบรม & ทักษะที่ได้รับ", style: STYLES.slate });
  const cPrereq = addVertex({ x: 190, y: 465, width: 280, height: 75, value: "4. กำหนดวิชาบังคับก่อน (Prerequisites)\n• ตรวจสอบ Cycle Detection Graph\n• ป้องกันการตั้งเงื่อนไขวนลูป", style: STYLES.amber });
  const cBind = addVertex({ x: 190, y: 575, width: 280, height: 75, value: "5. ผูกข้อสอบและแบบประเมินกลาง\n• Pre-test & Post-test\n• Evaluation ทันที & ติดตามผล 30 วัน", style: STYLES.rose });
  const cPublish = addVertex({ x: 190, y: 685, width: 280, height: 60, value: "6. เผยแพร่เป็น Center Template (Active)\nพร้อมให้แต่ละโรงงานนำไปใช้", style: STYLES.green });

  // Factory path
  const fChoose = addVertex({ x: 880, y: 170, width: 300, height: 65, value: "เลือกวิธีสร้างคอร์สของโรงงาน", style: STYLES.diamond });
  const fCreateNew = addVertex({ x: 1060, y: 270, width: 260, height: 60, value: "สร้างคอร์สเฉพาะของโรงงานเอง\n(Local Specific Course)", style: STYLES.blue });
  const fCopyCenter = addVertex({ x: 770, y: 270, width: 260, height: 60, value: "คัดลอกจาก Center Template\n(Copy Center Template to Factory)", style: STYLES.blue });

  const fCustomize = addVertex({ x: 880, y: 375, width: 300, height: 75, value: "ปรับแต่งรายละเอียดเฉพาะโรงงาน\n• ระบุ Company ID ของโรงงานตนเอง\n• ปรับชื่อ, ชั่วโมง, หรือวิทยากรท้องถิ่น", style: STYLES.blue });

  const fTarget = addVertex({ x: 880, y: 485, width: 300, height: 85, value: "กำหนดกลุ่มเป้าหมาย (Target Group & Org Hierarchy)\n• Company ➔ Function ➔ Department\n• Section ➔ Position ➔ Level Rank (L1-L9)", style: STYLES.cyan });

  const fBudget = addVertex({ x: 880, y: 605, width: 300, height: 70, value: "ประมาณการงบประมาณ (Budget Estimate)\n• ค่าวิทยากร, สถานที่, ค่าอาหาร/อุปกรณ์\n• คำนวณต้นทุนต่อหัว (Cost per Head)", style: STYLES.amber });

  const fSave = addVertex({ x: 880, y: 710, width: 300, height: 65, value: "บันทึกคอร์สพร้อมเปิดใช้งาน (Status: Active)\nพร้อมบรรจุลงในแผนการฝึกอบรม (Training Plan)", style: STYLES.green });

  const fExcel = addVertex({ x: 880, y: 815, width: 300, height: 60, value: "Export Course Outline (Excel Workbook)\nสำหรับส่งอนุมัติหรือแนบเอกสารราชการ", style: STYLES.slate });

  // Center Edges
  addEdge({ source: cStart, target: cMeta, style: STYLES.edgePurple });
  addEdge({ source: cMeta, target: cMethod, style: STYLES.edgePurple });
  addEdge({ source: cMethod, target: cPrereq, style: STYLES.edgePurple });
  addEdge({ source: cPrereq, target: cBind, style: STYLES.edgePurple });
  addEdge({ source: cBind, target: cPublish, style: STYLES.edgeGreen });

  // Cross link Center to Factory
  addEdge({ source: cPublish, target: fCopyCenter, value: "Center Template Hub", style: STYLES.edgePurple, exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 });

  // Factory Edges
  addEdge({ source: fChoose, target: fCopyCenter, value: "ใช้มาตรฐานกลาง", style: STYLES.edgeBlue });
  addEdge({ source: fChoose, target: fCreateNew, value: "สร้างใหม่ทั้งหมด", style: STYLES.edgeBlue });
  addEdge({ source: fCopyCenter, target: fCustomize, style: STYLES.edgeBlue });
  addEdge({ source: fCreateNew, target: fCustomize, style: STYLES.edgeBlue });
  addEdge({ source: fCustomize, target: fTarget, style: STYLES.edgeBlue });
  addEdge({ source: fTarget, target: fBudget, style: STYLES.edgeBlue });
  addEdge({ source: fBudget, target: fSave, style: STYLES.edgeGreen });
  addEdge({ source: fSave, target: fExcel, style: STYLES.edge });
});

// ====================================================================
// PAGE 2: Assessment Management (Pre/Post Test Engine)
// ====================================================================
builder.addPage("2. Assessment (Pre-Post Test)", 1450, 1100, ({ addVertex, addEdge }) => {
  addVertex({ x: 350, y: 25, width: 750, height: 40, value: "HRD: Assessment Management Flow (Pre / Post Test)", style: STYLES.header });
  addVertex({ x: 350, y: 65, width: 750, height: 25, value: "โครงสร้างการสร้างชุดข้อสอบ, ระบบ Versioning, การเลือกประเภทคำถาม และกำหนดเกณฑ์ผ่าน", style: STYLES.subHeader });

  // Series & Versioning box
  const s1 = addVertex({ x: 80, y: 130, width: 280, height: 75, value: "1. จัดการ Assessment Series\n• สร้างกลุ่มชุดข้อสอบหลัก\n• ผูกกับ Company หรือใช้ร่วมกันข้ามบริษัท", style: STYLES.purple });
  const s2 = addVertex({ x: 80, y: 245, width: 280, height: 80, value: "2. คุมเวอร์ชันข้อสอบ (Versioning)\n• สร้าง Version ใหม่ (v1, v2, ...)\n• ระบุ Version Note (บันทึกการปรับปรุง)\n• ไม่กระทบผลสอบของผู้ที่สอบเวอร์ชันเดิม", style: STYLES.blue });
  const s3 = addVertex({ x: 80, y: 365, width: 280, height: 75, value: "3. กำหนดเกณฑ์และกติกาการสอบ\n• Passing Score Percent (เช่น 70%, 80%)\n• Time Limit (นาที) หรือ ไม่จำกัดเวลา\n• Instructions (คำชี้แจงก่อนเริ่มสอบ)", style: STYLES.amber });

  // Question Designer
  const qHub = addVertex({ x: 460, y: 250, width: 220, height: 70, value: "Question Designer\n(คลังข้อสอบ & เครื่องมือออกแบบ)", style: STYLES.diamond });

  // 5 Question Types
  const qSingle = addVertex({ x: 780, y: 120, width: 290, height: 65, value: "SINGLE_CHOICE / TRUE_FALSE\n• ตัวเลือก 2 ตัวขึ้นไป, มีคำตอบถูก 1 ข้อ\n• กำหนดแต้มต่อข้อ (Option Score)", style: STYLES.cyan });
  const qMulti = addVertex({ x: 780, y: 205, width: 290, height: 65, value: "MULTIPLE_CHOICE\n• ตัวเลือกหลายข้อ ถูกได้หลายตัว\n• ให้คะแนนเมื่อเลือกถูกต้องครบถ้วน", style: STYLES.cyan });
  const qText = addVertex({ x: 780, y: 290, width: 290, height: 65, value: "SHORT_TEXT / LONG_TEXT (อัตนัย)\n• ข้อเขียนสั้น หรือบรรยายยาว\n• ส่งให้ Reviewer ตรวจและให้คะแนนภายหลัง", style: STYLES.rose });
  const qGrid = addVertex({ x: 780, y: 375, width: 290, height: 80, value: "GRID (Matrix Multi-Choice)\n• แถว (Rows) และ คอลัมน์ (Columns)\n• กำหนดเฉลยคอลัมน์ที่ถูกในแต่ละแถว\n• ให้แต้มแยกตามแถว (Option Score)", style: STYLES.purple });

  // Preview & Validate
  const preview = addVertex({ x: 1140, y: 230, width: 250, height: 80, value: "FormPreviewRunner (ทดสอบทำข้อสอบ)\n• ทดลองกดทำข้อสอบเสมือนจริง\n• ตรวจสอบการจับเวลาและการคิดคะแนน\n• เช็คความสมบูรณ์ของเฉลยทุกข้อ", style: STYLES.blue });

  // Status Lifecycle
  const statusDraft = addVertex({ x: 460, y: 510, width: 220, height: 60, value: "สถานะ: DRAFT\nกำลังออกแบบ/แก้ไขคำถามได้อิสระ", style: STYLES.slate });
  const statusActive = addVertex({ x: 780, y: 510, width: 250, height: 60, value: "สถานะ: ACTIVE\nเปิดให้หลักสูตรนำไปใช้สอบได้ (Lock โครงสร้าง)", style: STYLES.green });
  const statusInactive = addVertex({ x: 1120, y: 510, width: 230, height: 60, value: "สถานะ: INACTIVE\nยกเลิกการใช้งาน / ปิดรับการสอบ", style: STYLES.rose });

  // Connect into Course & Actual
  const courseBind = addVertex({ x: 620, y: 640, width: 360, height: 75, value: "นำไปผูกใน Course Master Workspace\n(เลือกเป็น Pre-test หรือ Post-test ของคอร์ส)", style: STYLES.purple });
  const autoGrading = addVertex({ x: 620, y: 755, width: 360, height: 75, value: "เมื่อพนักงานสอบ: ตรวจคะแนนอัตโนมัติ (Auto-Grading)\nและส่งผลไปยัง Evaluation Converter & Training Record", style: STYLES.green });

  addEdge({ source: s1, target: s2, style: STYLES.edgePurple });
  addEdge({ source: s2, target: s3, style: STYLES.edgePurple });
  addEdge({ source: s3, target: qHub, style: STYLES.edgeBlue });

  addEdge({ source: qHub, target: qSingle, style: STYLES.edge });
  addEdge({ source: qHub, target: qMulti, style: STYLES.edge });
  addEdge({ source: qHub, target: qText, style: STYLES.edge });
  addEdge({ source: qHub, target: qGrid, style: STYLES.edge });

  addEdge({ source: qSingle, target: preview, style: STYLES.edge });
  addEdge({ source: qMulti, target: preview, style: STYLES.edge });
  addEdge({ source: qText, target: preview, style: STYLES.edge });
  addEdge({ source: qGrid, target: preview, style: STYLES.edge });

  addEdge({ source: preview, target: statusDraft, style: STYLES.edge, exitX: 0.5, exitY: 1, entryX: 1, entryY: 0.5 });
  addEdge({ source: statusDraft, target: statusActive, value: "ยืนยันความถูกต้อง", style: STYLES.edgeGreen });
  addEdge({ source: statusActive, target: statusInactive, value: "เมื่อเลิกใช้", style: STYLES.edgeRed });

  addEdge({ source: statusActive, target: courseBind, style: STYLES.edgeGreen });
  addEdge({ source: courseBind, target: autoGrading, style: STYLES.edgeGreen });
});

// ====================================================================
// PAGE 3: Evaluation Management (Immediate & 30-Day Follow-up)
// ====================================================================
builder.addPage("3. Evaluation Forms", 1450, 1100, ({ addVertex, addEdge }) => {
  addVertex({ x: 350, y: 25, width: 750, height: 40, value: "HRD: Evaluation Management Flow", style: STYLES.header });
  addVertex({ x: 350, y: 65, width: 750, height: 25, value: "ระบบออกแบบแบบประเมินผลการอบรม (ทันทีหลังเรียน & ติดตามผล 30 วัน พร้อมระบบ Branching Logic)", style: STYLES.subHeader });

  // 2 Timings
  const timeBox = addVertex({ x: 100, y: 130, width: 300, height: 160, value: "กำหนดช่วงเวลาการประเมิน (Evaluation Timing)\n\n• After Training (ประเมินทันทีหลังอบรม)\n  วัดความพึงพอใจ, วิทยากร, เนื้อหา, สถานที่\n\n• 30-Day Follow-up (ติดตามผล 30-90 วัน)\n  วัดการนำไปประยุกต์ใช้จริง & การประเมินโดยหัวหน้า", style: STYLES.purple });

  const formDesign = addVertex({ x: 480, y: 180, width: 230, height: 65, value: "Form Structure Designer\n(จัดโครงสร้างแบบฟอร์ม)", style: STYLES.diamond });

  // Components of Evaluation Form
  const fRating = addVertex({ x: 790, y: 120, width: 280, height: 60, value: "RATING (ระดับ 1 - 5 ดาว)\nเกณฑ์คะแนนความพึงพอใจและคุณภาพ", style: STYLES.amber });
  const fChoice = addVertex({ x: 790, y: 195, width: 280, height: 60, value: "SINGLE_CHOICE / MULTIPLE_CHOICE\nตัวเลือกทั่วไป และการสำรวจข้อคิดเห็น", style: STYLES.cyan });
  const fGrid = addVertex({ x: 790, y: 270, width: 280, height: 60, value: "MULTIPLE_CHOICE_GRID / CHECKBOX_GRID\nตารางประเมินหัวข้อย่อยแบบชุด", style: STYLES.blue });
  const fText = addVertex({ x: 790, y: 345, width: 280, height: 60, value: "SHORT_TEXT / LONG_TEXT\nข้อเสนอแนะและสิ่งที่ต้องการให้พัฒนา", style: STYLES.rose });

  // Branching & Form Blocks
  const fBlock = addVertex({ x: 1140, y: 140, width: 250, height: 90, value: "Form Blocks (องค์ประกอบจัดหน้า)\n• SECTION_BREAK (แบ่งหน้า / หัวข้อใหม่)\n• TEXT_BLOCK (ข้อความชี้แจง / คำแนะนำ)", style: STYLES.slate });
  const fBranch = addVertex({ x: 1140, y: 260, width: 250, height: 90, value: "Branching Logic (Skip Logic)\n• กำหนด nextSection ในตัวเลือก\n• ข้ามไปยังหน้าหรือส่วนที่เกี่ยวข้องตามคำตอบ", style: STYLES.purple });

  // Lifecycle
  const pDraft = addVertex({ x: 480, y: 440, width: 230, height: 55, value: "สถานะ: DRAFT\nร่างแบบประเมินและทดสอบฟอร์ม", style: STYLES.slate });
  const pPub = addVertex({ x: 790, y: 440, width: 280, height: 55, value: "สถานะ: PUBLISHED\nเปิดใช้งานสำหรับรอบการอบรม", style: STYLES.green });
  const pInact = addVertex({ x: 1140, y: 440, width: 250, height: 55, value: "สถานะ: INACTIVE\nปิดการใช้งาน", style: STYLES.rose });

  // Conversion & Reporting
  const conv = addVertex({ x: 600, y: 550, width: 450, height: 75, value: "Evaluation Converter Engine\n• ประมวลผลคะแนนเฉลี่ย (Mean / Standard Deviation)\n• แปลงผลคะแนนความพึงพอใจเป็นร้อยละ (% Satisfied)\n• สรุปข้อคิดเห็นรายข้อ", style: STYLES.purple });

  const exportExcel = addVertex({ x: 600, y: 660, width: 450, height: 65, value: "Export Evaluation Summary (Excel Workbook)\nสร้างรายงานสรุปผลประเมินอัตโนมัติตาม Template", style: STYLES.green });

  addEdge({ source: timeBox, target: formDesign, style: STYLES.edgePurple });
  addEdge({ source: formDesign, target: fRating, style: STYLES.edge });
  addEdge({ source: formDesign, target: fChoice, style: STYLES.edge });
  addEdge({ source: formDesign, target: fGrid, style: STYLES.edge });
  addEdge({ source: formDesign, target: fText, style: STYLES.edge });

  addEdge({ source: fChoice, target: fBranch, style: STYLES.edgePurple });
  addEdge({ source: fRating, target: fBlock, style: STYLES.edge });

  addEdge({ source: formDesign, target: pDraft, style: STYLES.edge });
  addEdge({ source: pDraft, target: pPub, value: "Publish", style: STYLES.edgeGreen });
  addEdge({ source: pPub, target: pInact, value: "Deactivate", style: STYLES.edgeRed });

  addEdge({ source: pPub, target: conv, style: STYLES.edgeGreen });
  addEdge({ source: conv, target: exportExcel, style: STYLES.edgeGreen });
});

// ====================================================================
// PAGE 4: Course Binding & Validation Runner
// ====================================================================
builder.addPage("4. Binding & Preview Runner", 1450, 1000, ({ addVertex, addEdge }) => {
  addVertex({ x: 350, y: 25, width: 750, height: 40, value: "HRD: Course Binding & Form Preview Runner Flow", style: STYLES.header });
  addVertex({ x: 350, y: 65, width: 750, height: 25, value: "การผูกข้อสอบ/แบบประเมินเข้ากับคอร์ส (Internal ID vs External Link Mode) และระบบจำลองทำฟอร์ม", style: STYLES.subHeader });

  const cBox = addVertex({ x: 100, y: 150, width: 280, height: 80, value: "Course Master Workspace\n(เลือกคอร์สอบรมที่ต้องการตั้งค่า)", style: STYLES.purple });

  const bindSlot = addVertex({ x: 460, y: 150, width: 260, height: 80, value: "4 ช่องทางการผูกแบบวัดผล:\n1. Pre-test\n2. Post-test\n3. Evaluation (ทันที)\n4. Evaluation (30-Day)", style: STYLES.blue });

  const modeDecision = addVertex({ x: 800, y: 155, width: 200, height: 70, value: "เลือกโหมดการผูกฟอร์ม", style: STYLES.diamond });

  const modeInternal = addVertex({ x: 1080, y: 110, width: 300, height: 70, value: "Mode 1: Internal System ID\n• ดึงจากคลังข้อสอบ/แบบประเมินในระบบ\n• ตรวจคะแนนและบันทึกผลเข้าระบบอัตโนมัติ", style: STYLES.green });

  const modeExternal = addVertex({ x: 1080, y: 210, width: 300, height: 70, value: "Mode 2: External Link Mode (__link__)\n• ใส่ URL ภายนอก (Google Forms / MS Forms)\n• แสดงปุ่มเปิดลิงก์สำหรับผู้เรียน", style: STYLES.amber });

  const runner = addVertex({ x: 620, y: 320, width: 360, height: 80, value: "FormPreviewRunner (Interactive Simulation)\n• ตรวจสอบความถูกต้องของโหมดที่เลือก\n• จำลองข้อคำถาม, ตัวเลือก, ช้อยส์ และหน้ากระดาษ\n• ยืนยันก่อนเปิดใช้งานจริง", style: STYLES.cyan });

  const publishPlan = addVertex({ x: 620, y: 450, width: 360, height: 70, value: "พร้อมนำหลักสูตรไปบรรจุใน\nTraining Plan Management (OAP & Rolling Plan)", style: STYLES.green });

  addEdge({ source: cBox, target: bindSlot, style: STYLES.edgePurple });
  addEdge({ source: bindSlot, target: modeDecision, style: STYLES.edgeBlue });
  addEdge({ source: modeDecision, target: modeInternal, value: "ระบบภายใน", style: STYLES.edgeGreen });
  addEdge({ source: modeDecision, target: modeExternal, value: "ฟอร์มภายนอก", style: STYLES.edgeAmber || STYLES.edge });
  addEdge({ source: modeInternal, target: runner, style: STYLES.edgeGreen });
  addEdge({ source: modeExternal, target: runner, style: STYLES.edge });
  addEdge({ source: runner, target: publishPlan, style: STYLES.edgeGreen });
});

// ====================================================================
// PAGE 5: Training Plan Management
// ====================================================================
builder.addPage("5. Training Plan Management", 1450, 1100, ({ addVertex, addEdge }) => {
  addVertex({ x: 350, y: 25, width: 750, height: 40, value: "HRD: Training Plan Management Workflow", style: STYLES.header });
  addVertex({ x: 350, y: 65, width: 750, height: 25, value: "วงจรการวางแผน: Request Need ➔ Accept Survey ➔ Annual OAP ➔ Rolling Plan (Draft ➔ Published)", style: STYLES.subHeader });

  const p1 = addVertex({ x: 100, y: 150, width: 280, height: 75, value: "1. Request Training Need\n• แผนก/ฝ่ายยื่นขอหลักสูตรอบรม\n• ระบุกลุ่มเป้าหมาย และเหตุผลความจำเป็น", style: STYLES.blue });
  const p2 = addVertex({ x: 440, y: 150, width: 280, height: 75, value: "2. Need Consolidation & Review\n• HRD รวบรวมคำขอจากทุกแผนก\n• ตรวจสอบความซ้ำซ้อนกับ Course Master", style: STYLES.blue });
  const p3 = addVertex({ x: 780, y: 150, width: 280, height: 75, value: "3. Training Accept Survey\n• แบบสำรวจรับรองความต้องการ\n• ยืนยันจำนวนผู้เข้าอบรมจริง (Quota)", style: STYLES.purple });

  const p4 = addVertex({ x: 440, y: 290, width: 280, height: 85, value: "4. Training OAP (Overall Annual Plan)\n• จัดทำแผนประจำปีภาพรวมกลุ่มบริษัท\n• จัดสรรงบประมาณรวมข้ามบริษัท (ATA, TEP, etc.)\n• กำหนดจำนวนรุ่นและไตรมาสเป้าหมาย", style: STYLES.amber });

  const p5 = addVertex({ x: 780, y: 290, width: 280, height: 85, value: "5. Training Rolling Plan (แผนรายเดือน)\n• ปรับแผนปฏิบัติการตามสถานการณ์จริง\n• กำหนด วันที่, เวลา, ห้องอบรม, วิทยากร\n• สถานะ: DRAFT ➔ SUBMITTED ➔ APPROVED", style: STYLES.green });

  const p6 = addVertex({ x: 1120, y: 290, width: 260, height: 85, value: "6. Publish Plan\n• เผยแพร่ลง Schedule Calendar\n• เปิดระบบให้พนักงานลงทะเบียน (Register)\n• ล็อคที่นั่งตามโควตาที่กำหนด", style: STYLES.cyan });

  addEdge({ source: p1, target: p2, style: STYLES.edgeBlue });
  addEdge({ source: p2, target: p3, style: STYLES.edgeBlue });
  addEdge({ source: p3, target: p4, style: STYLES.edgePurple });
  addEdge({ source: p4, target: p5, style: STYLES.edgeGreen });
  addEdge({ source: p5, target: p6, style: STYLES.edgeGreen });
});

// ====================================================================
// PAGE 6: Training Record & Actual Execution
// ====================================================================
builder.addPage("6. Training Record & Execution", 1450, 1100, ({ addVertex, addEdge }) => {
  addVertex({ x: 350, y: 25, width: 750, height: 40, value: "HRD: Training Record & Execution Workflow", style: STYLES.header });
  addVertex({ x: 350, y: 65, width: 750, height: 25, value: "การจัดอบรมจริง, การเช็คชื่อ, การตรวจข้อสอบ, การแปลงผลคะแนน และการออกใบรับรอง", style: STYLES.subHeader });

  const r1 = addVertex({ x: 100, y: 150, width: 260, height: 75, value: "1. Training Actual\n• เปิดห้องอบรมรอบจริงตาม Rolling Plan\n• บันทึกวิทยากรจริง และค่าใช้จ่ายที่เกิดขึ้นจริง", style: STYLES.blue });
  const r2 = addVertex({ x: 420, y: 150, width: 260, height: 75, value: "2. Attendance Management\n• เช็คชื่อผู้เข้าเรียน (QR Code / ลงชื่อ)\n• Export ใบลงชื่อ Attendance Sheet (Excel)", style: STYLES.blue });

  const rGrading = addVertex({ x: 740, y: 155, width: 180, height: 65, value: "ประเภทข้อสอบ", style: STYLES.diamond });
  const rAuto = addVertex({ x: 980, y: 110, width: 260, height: 60, value: "Auto-Grading\nตรวจข้อสอบปรนัยทันทีโดยระบบ", style: STYLES.green });
  const rReviewer = addVertex({ x: 980, y: 200, width: 260, height: 70, value: "Reviewer Assignment & Scoring\nมอบหมายให้ผู้ตรวจตรวจข้อเขียน/อัตนัย", style: STYLES.amber });

  const rConv = addVertex({ x: 550, y: 310, width: 340, height: 75, value: "3. Evaluation Converter\n• รวบรวมคะแนน Pre-test, Post-test, Evaluation\n• ประมวลผลเกณฑ์ผ่าน (Pass / Fail Criteria)", style: STYLES.purple });

  const rRec = addVertex({ x: 550, y: 430, width: 340, height: 75, value: "4. Training Record (ประวัติรายบุคคล)\n• บันทึกชั่วโมงอบรมสะสมตามกฎหมาย\n• อัปเดตสถานะผ่านลงประวัติพนักงาน", style: STYLES.green });

  const rCert = addVertex({ x: 550, y: 550, width: 340, height: 75, value: "5. Certificate Upload & Storage\n• ออกใบประกาศนียบัตรดิจิทัล\n• จัดเก็บใน Certificate Storage ให้ดาวน์โหลด", style: STYLES.cyan });

  addEdge({ source: r1, target: r2, style: STYLES.edgeBlue });
  addEdge({ source: r2, target: rGrading, style: STYLES.edge });
  addEdge({ source: rGrading, target: rAuto, value: "ปรนัย", style: STYLES.edgeGreen });
  addEdge({ source: rGrading, target: rReviewer, value: "ข้อเขียน", style: STYLES.edgeAmber || STYLES.edge });
  addEdge({ source: rAuto, target: rConv, style: STYLES.edgeGreen });
  addEdge({ source: rReviewer, target: rConv, style: STYLES.edge });
  addEdge({ source: rConv, target: rRec, style: STYLES.edgeGreen });
  addEdge({ source: rRec, target: rCert, style: STYLES.edgeGreen });
});

// ====================================================================
// PAGE 7: Master Data & Report Management
// ====================================================================
builder.addPage("7. Master Data & Reports", 1450, 1000, ({ addVertex, addEdge }) => {
  addVertex({ x: 350, y: 25, width: 750, height: 40, value: "HRD: Master Data & Report Management", style: STYLES.header });
  addVertex({ x: 350, y: 65, width: 750, height: 25, value: "โครงสร้างข้อมูลหลักองค์กร และระบบรายงาน/วิเคราะห์ข้อมูลผู้บริหาร", style: STYLES.subHeader });

  // Master Data Box
  addVertex({ x: 80, y: 120, width: 450, height: 500, value: "Master Data Management", style: STYLES.laneBox });
  const m1 = addVertex({ x: 120, y: 180, width: 370, height: 70, value: "โครงสร้างองค์กร (Organization Hierarchy)\n• Company (ATA, TEP, ATFB, NIC, SATI, SNF)\n• Function (สายงาน) & Function Mapping\n• Department, Section, Position, Level Rank", style: STYLES.slate });
  const m2 = addVertex({ x: 120, y: 275, width: 370, height: 60, value: "ข้อมูลวิทยากร (Instructors)\n• วิทยากรภายใน (Internal) / ภายนอก (External)\n• ประวัติ, ความเชี่ยวชาญ, อัตราค่าตอบแทน", style: STYLES.purple });
  const m3 = addVertex({ x: 120, y: 355, width: 370, height: 60, value: "สถาบันฝึกอบรม (Institute Providers)\n• รายชื่อสถาบัน, ติดต่อ, หลักสูตรที่ให้บริการ", style: STYLES.purple });
  const m4 = addVertex({ x: 120, y: 435, width: 370, height: 60, value: "หมวดหมู่หลักสูตร (Course Types & Groups)\n• กลุ่มงานเทคนิค, บริหาร, ความปลอดภัย, กฎหมาย", style: STYLES.blue });
  const m5 = addVertex({ x: 120, y: 515, width: 370, height: 60, value: "ข้อมูลพนักงาน (Employee Master Data)\n• รหัส, คำนำหน้า (Backfill TH Title), อีเมล, สังกัด", style: STYLES.green });

  // Report Box
  addVertex({ x: 620, y: 120, width: 750, height: 500, value: "Report Management & Export Engines", style: STYLES.laneBox });
  const repCal = addVertex({ x: 660, y: 180, width: 320, height: 80, value: "Schedule Calendar\n• ปฏิทินแสดงตารางตลอดทั้งปี\n• แยกสีตามบริษัท (Company Color Coding)\n• รองรับคอร์สอบรมหลายวัน (Multi-day Event)", style: STYLES.cyan });
  const repSum = addVertex({ x: 1010, y: 180, width: 320, height: 80, value: "Summary Dashboard (KPI & Metrics)\n• ชั่วโมงอบรมเฉลี่ยต่อคนต่อปี\n• เปรียบเทียบงบประมาณตั้งต้น vs ใช้งานจริง\n• อัตราการเข้าอบรมและอัตราการสอบผ่าน", style: STYLES.amber });

  const repXls = addVertex({ x: 660, y: 290, width: 670, height: 95, value: "Excel Workbook Automation Engines\n• Attendance Sheet Workbook (เอกสารเช็คชื่อพร้อมฟอร์แมตทางการ)\n• Course Outline Workbook (โครงสร้างหลักสูตรและหัวข้อสอน)\n• Evaluation Summary Workbook (สรุปผลการประเมินความพึงพอใจ)", style: STYLES.green });

  const repAct = addVertex({ x: 660, y: 415, width: 320, height: 75, value: "New Activities Report\n• รายงานกิจกรรมและเวิร์กชอปใหม่\n• สรุปผลการเข้าร่วมกิจกรรมแบบ On-demand", style: STYLES.blue });

  const repExp = addVertex({ x: 1010, y: 415, width: 320, height: 75, value: "Training Expense & Result Report\n• รายงานค่าใช้จ่ายแยกตามแผนก/โรงงาน\n• รายงานผลสัมฤทธิ์ทางการเรียนรู้", style: STYLES.rose });
});

const xmlOutput = builder.toXml();
const targetPath = path.resolve("d:/TrainingPlan/ATTG_HRD_Detailed_Flowcharts.drawio");
fs.writeFileSync(targetPath, xmlOutput, "utf-8");
console.log("Successfully generated:", targetPath);
