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

class StandardFlowchartBuilder {
  constructor() {
    this.pages = [];
  }

  addStandardPage(name, title, subtitle, items, sideBranches = [], pageWidth = 1450) {
    const elements = [];
    let idCounter = 2;

    // Header Title
    elements.push(
      `<mxCell id="node_${idCounter++}" value="${escapeXml(title)}" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=20;fontStyle=1;fontColor=#0f172a;" vertex="1" parent="1">` +
      `<mxGeometry x="250" y="25" width="760" height="40" as="geometry" />` +
      `</mxCell>`
    );

    // Subtitle
    elements.push(
      `<mxCell id="node_${idCounter++}" value="${escapeXml(subtitle)}" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=13;fontColor=#475569;" vertex="1" parent="1">` +
      `<mxGeometry x="250" y="65" width="760" height="25" as="geometry" />` +
      `</mxCell>`
    );

    const startY = 120;
    const processWidth = 480;
    const mainCenterX = 350 + processWidth / 2; // = 590
    let currentY = startY;

    const nodeIds = [];
    const nodeCoords = [];

    // Place each main spine item
    items.forEach((item, idx) => {
      const id = `node_main_${idx + 1}`;
      nodeIds.push(id);

      let w = processWidth;
      let h = 75;
      let shapeStyle = "";

      if (item.type === "terminator") {
        w = 220;
        h = 45;
        shapeStyle = "rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#0f172a;fontColor=#ffffff;fontSize=12;fontStyle=1;";
      } else if (item.type === "decision") {
        w = 260;
        h = 90;
        shapeStyle = "rhombus;whiteSpace=wrap;html=1;fillColor=#fef9c3;strokeColor=#ca8a04;fontColor=#713f12;fontSize=12;fontStyle=1;";
      } else if (item.type === "document") {
        w = 380;
        h = 75;
        shapeStyle = "shape=document;whiteSpace=wrap;html=1;boundedLbl=1;size=0.18;fillColor=#f1f5f9;strokeColor=#475569;fontColor=#0f172a;fontSize=12;fontStyle=1;";
      } else {
        // process
        w = processWidth;
        h = item.height || 75;
        shapeStyle = item.style || "rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#dbeafe;strokeColor=#2563eb;fontColor=#1e3a8a;fontSize=12;fontStyle=0;";
      }

      const x = mainCenterX - w / 2;
      const y = currentY;
      nodeCoords.push({ x, y, w, h, type: item.type });

      elements.push(
        `<mxCell id="${id}" value="${escapeXml(item.text)}" style="${shapeStyle}" vertex="1" parent="1">` +
        `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />` +
        `</mxCell>`
      );

      // Advance Y with 55px gap
      currentY += h + 55;
    });

    // Connect main spine with straight vertical arrows
    for (let i = 0; i < items.length - 1; i++) {
      const sourceId = nodeIds[i];
      const targetId = nodeIds[i + 1];
      const edgeId = `edge_spine_${i + 1}`;
      const sourceItem = items[i];

      let edgeColor = sourceItem.edgeColor || "#2563eb";
      let edgeLabel = "";
      if (sourceItem.type === "decision") {
        edgeLabel = sourceItem.yesLabel || "ใช่ / ผ่าน";
        edgeColor = "#16a34a";
      }

      const edgeStyle = `edgeStyle=straight;html=1;strokeWidth=2.5;strokeColor=${edgeColor};exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;rounded=0;endArrow=classic;endFill=1;endSize=7;labelBackgroundColor=#ffffff;labelBorderColor=none;fontSize=11;fontStyle=1;fontColor=${edgeColor};`;

      elements.push(
        `<mxCell id="${edgeId}" value="${escapeXml(edgeLabel)}" style="${edgeStyle}" edge="1" parent="1" source="${sourceId}" target="${targetId}">` +
        `<mxGeometry relative="1" as="geometry" />` +
        `</mxCell>`
      );
    }

    // Side branches (for decisions: No / Reject / Alternate)
    sideBranches.forEach((branch, bIdx) => {
      const sideId = `node_side_${bIdx + 1}`;
      const parentIdx = branch.fromItemIndex;
      const parentCoord = nodeCoords[parentIdx];
      const sideY = parentCoord.y + (parentCoord.h - 75) / 2;
      const sideX = 350 + processWidth + 120; // 120px to the right
      const sideWidth = branch.width || 280;
      const sideHeight = branch.height || 75;
      const val = escapeXml(branch.text);
      const style = branch.style || "rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#ffe4e6;strokeColor=#e11d48;fontColor=#881337;fontSize=11;fontStyle=1;";

      elements.push(
        `<mxCell id="${sideId}" value="${val}" style="${style}" vertex="1" parent="1">` +
        `<mxGeometry x="${sideX}" y="${sideY}" width="${sideWidth}" height="${sideHeight}" as="geometry" />` +
        `</mxCell>`
      );

      const sideEdgeId = `edge_side_${bIdx + 1}`;
      const sideEdgeColor = branch.edgeColor || "#dc2626";
      const sideEdgeVal = escapeXml(branch.label || "ไม่ใช่ / ไม่ผ่าน");
      const sideEdgeStyle = `edgeStyle=straight;html=1;strokeWidth=2;strokeColor=${sideEdgeColor};exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;rounded=0;endArrow=classic;endFill=1;labelBackgroundColor=#ffffff;labelBorderColor=none;fontSize=11;fontStyle=1;fontColor=${sideEdgeColor};`;

      elements.push(
        `<mxCell id="${sideEdgeId}" value="${sideEdgeVal}" style="${sideEdgeStyle}" edge="1" parent="1" source="${nodeIds[parentIdx]}" target="${sideId}">` +
        `<mxGeometry relative="1" as="geometry" />` +
        `</mxCell>`
      );
    });

    const pageHeight = Math.max(1000, currentY + 60);

    this.pages.push({
      name,
      width: pageWidth,
      height: pageHeight,
      xml: elements.join("\n        ")
    });
  }

  toXml() {
    let out = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" agent="ATTG HRD System" pages="${this.pages.length}">\n`;

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
  blue: "rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#dbeafe;strokeColor=#2563eb;fontColor=#1e3a8a;fontSize=12;fontStyle=0;",
  green: "rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#dcfce7;strokeColor=#16a34a;fontColor=#14532d;fontSize=12;fontStyle=0;",
  amber: "rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#d97706;fontColor=#78350f;fontSize=12;fontStyle=0;",
  purple: "rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#ede9fe;strokeColor=#7c3aed;fontColor=#4c1d95;fontSize=12;fontStyle=0;",
  rose: "rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#ffe4e6;strokeColor=#e11d48;fontColor=#881337;fontSize=12;fontStyle=0;",
  cyan: "rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#cffafe;strokeColor=#0891b2;fontColor=#155e75;fontSize=12;fontStyle=0;",
  slate: "rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#f1f5f9;strokeColor=#64748b;fontColor=#0f172a;fontSize=12;fontStyle=0;",
};

const builder = new StandardFlowchartBuilder();

// ====================================================================
// PAGE 0: ภาพรวมโมดูลทั้งหมด (Standard Flowchart with Terminator & Decisions)
// ====================================================================
builder.addStandardPage(
  "0. ภาพรวมโมดูลทั้งหมด (Overview)",
  "ATTG Training Plan Management - ผังภาพรวมระบบตามมาตรฐานสากล",
  "สัญลักษณ์มาตรฐาน: Terminator (เริ่ม/จบ) ➔ Process (สี่เหลี่ยม) ➔ Decision (ข้าวหลามตัด) ➔ Document",
  [
    { type: "terminator", text: "เริ่มต้น (Start)" },
    {
      type: "process",
      text: "1. Master Data Management\nกำหนดโครงสร้างองค์กร (Company, Function, Dept, Level L1-L9) และวิทยากร",
      style: STYLES.slate,
      edgeColor: "#64748b"
    },
    {
      type: "process",
      text: "2. Training Course Management\nสร้าง Course Master & Standard, ผูกข้อสอบ (Pre/Post Test) และแบบประเมินผล",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "decision",
      text: "หลักสูตรพร้อม\nเปิดใช้งานหรือไม่?",
      yesLabel: "พร้อม (Active)"
    },
    {
      type: "process",
      text: "3. Training Plan Management\nรวบรวมคำขอ (Need) ➔ สำรวจเป้าหมาย (Survey) ➔ จัดทำแผนประจำปี (OAP) & แผนรายเดือน (Rolling)",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "4. Training Record Management\nเปิดห้องอบรมจริง (Training Actual) ➔ เช็คชื่อ ➔ ตรวจข้อสอบ (Auto/Reviewer) ➔ ตัดเกรด",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "decision",
      text: "พนักงานผ่านเกณฑ์\n(Passing Criteria)?",
      yesLabel: "ผ่าน (Pass)"
    },
    {
      type: "document",
      text: "ออกใบประกาศนียบัตรดิจิทัล (Certificate Storage)\nและบันทึกประวัติชั่วโมงอบรมสะสมตามกฎหมาย"
    },
    {
      type: "process",
      text: "5. Report Management & New Activities\nสรุปงบประมาณ (Summary Dashboard) ➔ ปฏิทินทั้งปี (Schedule Calendar) ➔ กิจกรรมพิเศษ",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    { type: "terminator", text: "สิ้นสุดกระบวนการ (End)" }
  ],
  [
    {
      fromItemIndex: 3, // Decision: หลักสูตรพร้อมหรือไม่?
      text: "ยังไม่พร้อม (Draft):\nปรับแก้เนื้อหา, วัตถุประสงค์ หรือชุดข้อสอบให้สมบูรณ์",
      label: "ร่าง / ไม่พร้อม",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    },
    {
      fromItemIndex: 6, // Decision: ผ่านเกณฑ์หรือไม่?
      text: "ไม่ผ่าน (Fail):\nบันทึกสถานะ Failed / รอจัดรอบสอบซ่อมตามเงื่อนไข",
      label: "ไม่ผ่าน",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// ====================================================================
// PAGE 1: Course Master & Standard Flow (Standard)
// ====================================================================
builder.addStandardPage(
  "1. Course Master & Standard",
  "HRD: Course Master & Standard Lifecycle (ผังมาตรฐาน)",
  "สัญลักษณ์: Terminator ➔ Process ➔ Decision (ตรวจสอบ Prerequisite Loop) ➔ Document (Course Outline)",
  [
    { type: "terminator", text: "เริ่มสร้างหลักสูตร (Start)" },
    {
      type: "process",
      text: "1. เลือกประเภทการสร้างคอร์ส\nHRD_CENTER สร้างแม่แบบกลาง (Center Template) หรือ HRD_FACTORY ดึงจาก Center (Copy Template)",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "2. กำหนดข้อมูลพื้นฐานหลักสูตร (Course Metadata)\nรหัสคอร์ส, ชื่อไทย/อังกฤษ, วัตถุประสงค์, เนื้อหาหลักสูตร, หมวดหมู่ (Course Type & Group)",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "3. กำหนดวิธีการสอนและมาตรฐาน (Methodology)\nClassroom, Online, Workshop, OJT พร้อมระบุชั่วโมงอบรมและทักษะที่ได้รับ",
      style: STYLES.slate,
      edgeColor: "#64748b"
    },
    {
      type: "decision",
      text: "มีวิชาบังคับก่อน\n(Prerequisites)?",
      yesLabel: "มีวิชาบังคับ"
    },
    {
      type: "process",
      text: "4. ตรวจสอบ Prerequisite Cycle Detection\nระบบวิเคราะห์ Graph ป้องกันการตั้งเงื่อนไขวนลูปไม่สิ้นสุด",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "process",
      text: "5. กำหนดกลุ่มเป้าหมาย (Target Group Mapping)\nโครงสร้างองค์กร: Company ➔ Function ➔ Department ➔ Section ➔ Position ➔ Level L1-L9",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "6. ผูกแบบทดสอบและแบบประเมิน (Assessment & Evaluation Binding)\nระบุ Pre-test, Post-test, Evaluation ทันที และติดตามผลหลัง 30 วัน",
      style: STYLES.rose,
      edgeColor: "#e11d48"
    },
    {
      type: "process",
      text: "7. คำนวณประมาณการงบประมาณ (Budget Estimate)\nคำนวณค่าวิทยากร, สถานที่, อาหาร, วัสดุ และต้นทุนเฉลี่ยต่อหัว (Cost per Head)",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "process",
      text: "8. บันทึกเปิดใช้งานหลักสูตร (Status: ACTIVE)\nหลักสูตรพร้อมนำไปบรรจุลงในแผนการฝึกอบรมประจำปี (Training OAP)",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "document",
      text: "ส่งออก Course Outline Workbook (Excel)\nเอกสารโครงสร้างหลักสูตรและมาตรฐานการอบรมสำหรับส่งอนุมัติ"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 4, // Decision: มีวิชาบังคับก่อน?
      text: "ไม่มีวิชาบังคับก่อน:\nข้ามไปกำหนดกลุ่มเป้าหมายผู้เรียนได้ทันที",
      label: "ไม่มี",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    }
  ]
);

// ====================================================================
// PAGE 2: Assessment (Pre-Post Test) Flow (Standard)
// ====================================================================
builder.addStandardPage(
  "2. Assessment (Pre-Post Test)",
  "HRD: Assessment Management Flow (ผังมาตรฐาน)",
  "สัญลักษณ์: Terminator ➔ Series & Versioning ➔ Question Designer ➔ Decision (ผ่านเกณฑ์ตรวจสอบ) ➔ Active",
  [
    { type: "terminator", text: "เริ่มสร้างแบบทดสอบ (Start)" },
    {
      type: "process",
      text: "1. สร้าง Assessment Series & Versioning\nตั้งชื่อชุดข้อสอบหลัก, ผูก Company, และระบุ Version (v1, v2) พร้อม Version Note",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "2. กำหนดเกณฑ์และเวลาสอบ (Passing Score & Time Limit)\nPassing Score Percent (เช่น 70%, 80%), เวลาสอบ (นาที), และคำชี้แจง Instructions",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "process",
      text: "3. ออกแบบข้อสอบใน Question Designer (5 รูปแบบ)\n• Single Choice / True-False / Multiple Choice\n• Short-Long Text (อัตนัยส่งตรวจ) / Grid Matrix (ตารางหลายมิติ)",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "4. ทดสอบทำข้อสอบเสมือนจริงผ่าน FormPreviewRunner\nตรวจสอบตัวจับเวลา, การคำนวณคะแนน และเช็คความถูกต้องของเฉลยทุกข้อ",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "decision",
      text: "ข้อสอบและเฉลย\nถูกต้องครบถ้วน?",
      yesLabel: "ถูกต้องสมบูรณ์"
    },
    {
      type: "process",
      text: "5. ปรับสถานะเป็น ACTIVE (Lock โครงสร้างข้อสอบ)\nล็อกโครงสร้างข้อสอบเพื่อป้องกันการแก้ไขเฉลยขณะที่มีการนำไปใช้สอบจริง",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "6. ผูกเข้ากับคอร์ส & พร้อมตรวจคะแนนอัตโนมัติ (Auto-Grading)\nเชื่อมต่อผลคะแนนเข้ากับ Evaluation Converter และ Training Record",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 5, // Decision: ถูกต้องครบถ้วน?
      text: "ยังไม่สมบูรณ์:\nกลับไปแก้ไขคำถาม ตัวเลือก หรือเฉลยใน Question Designer",
      label: "ต้องแก้ไข",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// ====================================================================
// PAGE 3: Evaluation Forms Flow (Standard)
// ====================================================================
builder.addStandardPage(
  "3. Evaluation Forms",
  "HRD: Evaluation Management Flow (ผังมาตรฐาน)",
  "สัญลักษณ์: Terminator ➔ Decision (Timing) ➔ Designer ➔ Decision (ผ่านเกณฑ์) ➔ Document (Summary Excel)",
  [
    { type: "terminator", text: "เริ่มสร้างแบบประเมิน (Start)" },
    {
      type: "decision",
      text: "กำหนดช่วงเวลา\nการประเมิน (Timing)?",
      yesLabel: "After Training (ทันที)"
    },
    {
      type: "process",
      text: "1. ออกแบบโครงสร้างคำถาม (Form Structure Designer)\nRating 1-5 ดาว, Single/Multi Choice, Grid ตารางประเมิน, และ Text ข้อเสนอแนะ",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. กำหนด Form Blocks & Branching Logic (Skip Logic)\nเพิ่ม Section Break, Text Block, และเงื่อนไขการข้ามหน้าตามตัวเลือกที่ผู้เรียนตอบ",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "3. ทดสอบการตอบผ่าน FormPreviewRunner\nจำลองหน้าจอผู้ใช้งาน ตรวจสอบการข้ามหน้าและความสมบูรณ์ของฟอร์ม",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "decision",
      text: "ฟอร์มประเมิน\nพร้อมเผยแพร่?",
      yesLabel: "พร้อม (Publish)"
    },
    {
      type: "process",
      text: "4. ปรับสถานะเป็น PUBLISHED & แนบเข้ากับ Training Plan\nเปิดใช้งานสำหรับรอบการฝึกอบรมใน Rolling Plan",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "5. ประมวลผลคะแนนผ่าน Evaluation Converter\nคำนวณคะแนนเฉลี่ย และร้อยละความพึงพอใจ (% Satisfied)",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "document",
      text: "ส่งออก Evaluation Summary Report (Excel Workbook)\nรายงานสรุปผลการประเมินความพึงพอใจและข้อเสนอแนะภาพรวม"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 1, // Decision: Timing
      text: "30-Day Follow-up:\nแบบประเมินติดตามผลหลังอบรม 30-90 วัน (วัดพฤติกรรมและการนำไปใช้จริง)",
      label: "30-Day Follow-up",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      fromItemIndex: 5, // Decision: พร้อมเผยแพร่?
      text: "ยังไม่พร้อม:\nบันทึกเป็น DRAFT เพื่อรอการตรวจทานหัวข้อประเมิน",
      label: "ยังไม่พร้อม",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// ====================================================================
// PAGE 4: Plan - Request Need & Accept Survey (Standard)
// ====================================================================
builder.addStandardPage(
  "4. Plan - Need & Survey",
  "Training Plan: Request Need & Accept Survey (ผังมาตรฐาน)",
  "สัญลักษณ์: Terminator ➔ Process ➔ Decision (ตรวจ Course/OAP/Duplication/Approval) ➔ Document (Attendance Sheet)",
  [
    { type: "terminator", text: "เริ่มรวบรวมความต้องการ (Start)" },
    {
      type: "process",
      text: "1. แผนกยื่นคำขอฝึกอบรม (Request Training Need)\nระบุ Course Needed และ Request Reason เหตุผลความจำเป็นในการฝึกอบรม",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. HRD รวมกลุ่มคำขอใน Review Inbox\nวิเคราะห์ความต้องการตามหลักสูตร (Course Demand Group) เพื่อตรวจสอบความพร้อม",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "decision",
      text: "หลักสูตรและ OAP\nมีในระบบแล้วหรือไม่?",
      yesLabel: "มีครบสมบูรณ์"
    },
    {
      type: "process",
      text: "3. ส่งต่อคำขอเข้าสู่รุ่นใน Rolling Plan (needRequestHandoff)\nแนบรายชื่อผู้ยื่นคำขอเข้ากับรุ่นที่กำลังจะเปิดรับสมัครทันที",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "4. ดึงกลุ่มเป้าหมายจาก Course Standard ใน Accept Survey\nดึงเกณฑ์ Level Rank (เช่น L4 ขึ้นไป), ตำแหน่ง (Section Head+), และสังกัดที่เกี่ยวข้อง",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "decision",
      text: "พนักงานเคยผ่าน\nคอร์สนี้แล้วหรือไม่?",
      yesLabel: "ยังไม่เคยผ่าน"
    },
    {
      type: "process",
      text: "5. รวบรวมรายชื่อผู้สมัครจากแต่ละโรงงาน (Factory Submissions)\nแต่ละโรงงาน (ATA, TEP, ATFB, etc.) ส่งรายชื่อเข้ามาตามโควตาที่จัดสรร",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "decision",
      text: "HRD พิจารณาอนุมัติ\nตามโควตารอบอบรม?",
      yesLabel: "อนุมัติ (Approved)"
    },
    {
      type: "process",
      text: "6. ยืนยันรายชื่อผู้มีสิทธิ์เข้าอบรมจริง\nบรรจุรายชื่อเข้าสู่รอบการอบรมเพื่อเตรียมเช็คชื่อในวันจัดจริง",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "document",
      text: "ส่งออก Attendance Sheet Template (Excel)\nเอกสารใบลงชื่อและเช็คชื่ออย่างเป็นทางการสำหรับใช้ในวันอบรม"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 3, // Decision: Course & OAP
      text: "ยังไม่มีในระบบ:\n• ไม่มีคอร์ส ➔ พาไปสร้าง Course Master\n• ไม่มี OAP ➔ พาไปสร้าง OAP\n(แล้วพากลับมาจัดรุ่นต่อพร้อมคำขอเดิม)",
      label: "ยังไม่มีคอร์ส/OAP",
      style: STYLES.amber,
      edgeColor: "#d97706",
      width: 320
    },
    {
      fromItemIndex: 6, // Decision: เคยผ่านคอร์สนี้หรือไม่?
      text: "เคยผ่านแล้ว (Duplicate):\nแจ้งเตือนประวัติการเคยอบรมซ้ำ เพื่อป้องกันการสูญเสียงบประมาณ",
      label: "เคยผ่านแล้ว",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    },
    {
      fromItemIndex: 8, // Decision: HRD อนุมัติ?
      text: "ไม่อนุมัติ / เกินโควตา:\nปรับสถานะเป็น REJECTED หรือ WAITLIST พร้อมแจ้งเหตุผลกลับ",
      label: "ไม่อนุมัติ/เกินโควตา",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// ====================================================================
// PAGE 5: Plan - Annual OAP & Rolling Plan (Standard)
// ====================================================================
builder.addStandardPage(
  "5. Plan - OAP & Rolling",
  "Training Plan: Annual OAP & Rolling Plan (ผังมาตรฐาน)",
  "สัญลักษณ์: Terminator ➔ Process ➔ Decision (อนุมัติแผน) ➔ QR Code ➔ Handover to Actual",
  [
    { type: "terminator", text: "เริ่มจัดทำแผนฝึกอบรม (Start)" },
    {
      type: "process",
      text: "1. จัดทำแผนฝึกอบรมประจำปี (Training OAP Setup)\nระบุปีปฏิทิน, เลือกคอร์สจาก Course Master, กำหนดไตรมาส Q1-Q4 และเดือนเป้าหมาย",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "2. คำนวณและจัดสรรงบประมาณรวม (Budget Estimate)\nคำนวณค่าวิทยากร, อาหาร, สถานที่, วัสดุ และสรุปต้นทุนเฉลี่ยต่อหัว (Cost per Head)",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "process",
      text: "3. กำหนดขอบเขตบริษัท & Cascade แผนอัตโนมัติ\nระบุ All Companies หรือเฉพาะโรงงาน ➔ ระบบ Cascade การแก้ไขงบ/วิทยากรลง Rolling อัตโนมัติ",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "4. แตกแผนเป็นรุ่นปฏิบัติการใน Training Rolling (Create Batches)\nแบ่งรอบอบรมเป็นรุ่น (Batch 1, 2, 3...) ➔ ระบุ วันเริ่ม-สิ้นสุด (รองรับ Multi-day Training)",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "5. กำหนดสถานที่, จำนวนที่นั่ง (Capacity) และวิทยากร\nระบุห้องอบรม, จำนวนที่นั่งรองรับ, วิทยากรผู้สอน, และแนบชุดข้อสอบ/แบบประเมินสำหรับรุ่นนี้",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "decision",
      text: "ตรวจสอบและอนุมัติ\nแผนการอบรม?",
      yesLabel: "อนุมัติ (Approved)"
    },
    {
      type: "process",
      text: "6. เผยแพร่แผน (Status: PUBLISHED) & สร้าง QR Code รับสมัคร\nแสดงบน Schedule Calendar และ Dashboard ➔ สร้าง QR Code สำหรับให้พนักงานสแกนสมัคร",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "7. ส่งมอบรอบอบรมเข้าสู่ Training Actual\nพร้อมสำหรับการเช็คชื่อและบันทึกค่าใช้จ่ายจริงในโมดูล Training Record Management",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 6, // Decision: อนุมัติแผน?
      text: "ยังไม่อนุมัติ / รอแก้ไข:\nบันทึกเป็น DRAFT หรือ SUBMITTED เพื่อรอปรับปรุงข้อมูลห้องหรือวิทยากร",
      label: "รอแก้ไข (Draft)",
      style: STYLES.slate,
      edgeColor: "#64748b"
    }
  ]
);

// ====================================================================
// PAGE 6: Record - Actual & History (Standard)
// ====================================================================
builder.addStandardPage(
  "6. Record - Actual & History",
  "Training Record: Training Actual & Record (ผังมาตรฐาน)",
  "สัญลักษณ์: Terminator ➔ Process ➔ Decision (ตรวจข้อสอบ) ➔ Decision (Pass Criteria) ➔ Document (Certificate)",
  [
    { type: "terminator", text: "เริ่มวันจัดฝึกอบรมจริง (Start)" },
    {
      type: "process",
      text: "1. เปิดรอบจัดอบรมจริงใน Training Actual\nดึงข้อมูลรอบอบรมจาก Rolling Plan สถานะ Published ➔ ยืนยันวิทยากรจริงและห้องอบรม",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. เช็คชื่อผู้เข้าเรียน (Attendance Tracking)\nสแกน QR Code หรือ เช็คชื่อผ่าน Attendance Sheet ➔ บันทึก Present (เข้าเรียน) / Absent (ขาด)",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "3. บันทึกค่าใช้จ่ายจริงที่เกิดขึ้น (Actual Expenses & Variance)\nกรอกค่าวิทยากรจริง, ค่าเดินทาง, ที่พัก, อาหาร, อุปกรณ์ ➔ ระบบคำนวณ Variance งบคงเหลือ/เกิน",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "decision",
      text: "ประเภทข้อสอบ\nที่ผู้เรียนส่งเข้ามา?",
      yesLabel: "ข้อสอบปรนัย (Objective)"
    },
    {
      type: "process",
      text: "4. ระบบตรวจข้อสอบอัตโนมัติ (Auto-Grading)\nตรวจคำตอบเทียบกับเฉลยใน Question Bank และคิดคะแนนทันที",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "5. ประมวลผลคะแนนผ่าน Evaluation Converter\nคำนวณคะแนน Pre vs Post (% พัฒนาการ) ➔ รวมผลประเมินความพึงพอใจ ➔ ตัดเกรด Pass/Fail",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "decision",
      text: "คะแนนและเวลาเรียน\nผ่านเกณฑ์ที่กำหนด?",
      yesLabel: "ผ่านเกณฑ์ (Pass)"
    },
    {
      type: "process",
      text: "6. ปิดรอบการสอบ (Set Stage Closed) & อัปเดตประวัติ Training Record\nสะสมชั่วโมงอบรมตามกฎหมายกรมพัฒนาฝีมือแรงงาน พร้อมปกป้องข้อมูล (Masked ID PDPA)",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "document",
      text: "ออกใบประกาศนียบัตรดิจิทัล (Certificate Upload & Storage)\nจัดเก็บในระบบคลังใบรับรอง ให้พนักงานดาวน์โหลดได้จากหน้า My Records"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 4, // Decision: ประเภทข้อสอบ
      text: "ข้อสอบอัตนัย / ข้อเขียน:\nส่งเข้า Reviewer Assignment Panel ให้วิทยากร/ผู้ประเมินตรวจและให้คะแนน",
      label: "อัตนัย (Subjective)",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      fromItemIndex: 7, // Decision: ผ่านเกณฑ์หรือไม่?
      text: "ไม่ผ่านเกณฑ์ (Fail):\nบันทึกสถานะ Failed ในประวัติ ➔ รอจัดรอบสอบซ่อมหรืออบรมซ้ำตามระเบียบบริษัท",
      label: "ไม่ผ่านเกณฑ์ (Fail)",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// ====================================================================
// PAGE 7: Report - Dashboard & Calendar (Standard)
// ====================================================================
builder.addStandardPage(
  "7. Report - Dashboard & Calendar",
  "Report Management: Dashboard & Schedule Calendar (ผังมาตรฐาน)",
  "สัญลักษณ์: Terminator ➔ Process ➔ Decision (ส่งออกรายงาน) ➔ Document (Excel Workbooks)",
  [
    { type: "terminator", text: "เริ่มกระบวนการรายงานผล (Start)" },
    {
      type: "process",
      text: "1. รวบรวมข้อมูลงบประมาณใน Summary Dashboard (buildFinanceSummary)\nดึงข้อมูลเปรียบเทียบ: Planned Budget vs Actual Spending vs Variance (คงเหลือ/เกิน)",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "process",
      text: "2. จำแนกประเภทแหล่งเงินทุน (Center vs Factory Funding)\nสรุปยอดหลักสูตรที่ Center สนับสนุนงบ และหลักสูตรที่แต่ละโรงงาน (ATA, TEP, etc.) เบิกจ่ายเอง",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "3. คำนวณ KPI การอบรม (Attendance & Pass Rate Metrics)\nคำนวณยอดรวม Enrolled vs Attended, อัตราเข้าเรียน (% Attendance), อัตราสอบผ่าน (% Pass Rate)",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "4. นำข้อมูลรอบอบรมไปเรนเดอร์ใน Schedule Calendar\nแสดงปฏิทินการฝึกอบรมแบบ Interactive ทั้งมุมมองรายเดือน (Monthly Grid) และมุมมองทั้งปี",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "5. แสดงแถบสีแยกตามบริษัท & คำนวณ Multi-Day Course Span\nแถบสีบริษัท (ATA, TEP, etc.) ➔ ฟังก์ชัน getPlanDaysCount แสดงแถบลากยาวตามจำนวนวันจัดจริง",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "decision",
      text: "ต้องการส่งออกเอกสาร\nรายงานทางการ (Export)?",
      yesLabel: "ส่งออกไฟล์ Excel"
    },
    {
      type: "document",
      text: "สร้างไฟล์รายงาน Excel Workbook อัตโนมัติ\n• Attendance Sheet Workbook\n• Course Outline Workbook\n• Evaluation Summary Workbook"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 6, // Decision: ต้องการส่งออกรายงานหรือไม่?
      text: "ไม่ส่งออกไฟล์:\nดูและวิเคราะห์ข้อมูลผ่านหน้าจอ Interactive Dashboard บนระบบ",
      label: "ดูบนหน้าจอ",
      style: STYLES.slate,
      edgeColor: "#64748b"
    }
  ]
);

// ====================================================================
// PAGE 8: Report - New Activities (Standard)
// ====================================================================
builder.addStandardPage(
  "8. Report - New Activities",
  "Report Management: New Activities & Workshops (ผังมาตรฐาน)",
  "สัญลักษณ์: Terminator ➔ Process ➔ Document (New Activities Report)",
  [
    { type: "terminator", text: "เริ่มบันทึกกิจกรรมพิเศษนอกแผน (Start)" },
    {
      type: "process",
      text: "1. สร้างกิจกรรมใหม่นอกแผนประจำปี (ActivityFormModal)\nกรอกชื่อกิจกรรมพิเศษหรือเวิร์กชอปด่วน (Activity Name TH/EN) ➔ ระบุวันที่จัด และสถานที่",
      style: STYLES.rose,
      edgeColor: "#e11d48"
    },
    {
      type: "process",
      text: "2. ระบุบริษัทผู้จัดและประเภทกิจกรรม\nกำหนดบริษัทผู้จัด: CENTER หรือระบุโรงงาน (ATA, TEP, etc.) ➔ หมวดหมู่ ➔ ประมาณการงบประมาณ",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "3. กำหนดกลุ่มเป้าหมายและบันทึกยอดผู้เข้าร่วมจริง\nระบุฝ่าย/แผนกเป้าหมาย ➔ บันทึกจำนวนผู้เข้าร่วมกิจกรรมจริง (Actual Attendees Count)",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "4. บันทึกผลสัมฤทธิ์และอัปโหลดหลักฐาน (Activity Photo Gallery)\nบันทึกสรุปผลที่ได้รับ ➔ อัปโหลดภาพถ่ายกิจกรรมและไฟล์เอกสารใบลงชื่อเข้าสู่ระบบ",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "document",
      text: "ส่งออก New Activities Report & นำเสนอผู้บริหาร\nรวบรวมสถิติกิจกรรมพิเศษแสดงบน Dashboard และรายงานสรุปสำหรับผู้บริหาร"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  []
);

const xmlOutput = builder.toXml();
const targetPath = path.resolve("d:/TrainingPlan/ATTG_HRD_Detailed_Flowcharts.drawio");
fs.writeFileSync(targetPath, xmlOutput, "utf-8");
console.log("Successfully generated standard-compliant flowcharts:", targetPath);
