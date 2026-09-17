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

class StraightDrawioBuilder {
  constructor() {
    this.pages = [];
  }

  addVerticalPage(name, title, subtitle, steps, sideBranches = [], pageWidth = 1450) {
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
    const boxWidth = 580;
    const boxHeight = 80;
    const gap = 140; // 140 - 80 = 60px clean vertical space for arrow, prevents any crowding or overlap
    const mainX = 320;

    const nodeIds = [];

    // Main vertical spine nodes
    steps.forEach((step, idx) => {
      const id = `node_step_${idx + 1}`;
      nodeIds.push(id);
      const y = startY + idx * gap;
      const val = escapeXml(step.text);
      const style = step.style || "rounded=1;whiteSpace=wrap;html=1;fillColor=#dbeafe;strokeColor=#2563eb;fontColor=#1e3a8a;fontSize=12;fontStyle=1;arcSize=10;";

      elements.push(
        `<mxCell id="${id}" value="${val}" style="${style}" vertex="1" parent="1">` +
        `<mxGeometry x="${mainX}" y="${y}" width="${boxWidth}" height="${boxHeight}" as="geometry" />` +
        `</mxCell>`
      );
    });

    // Main vertical straight edges: 100% straight vertical with explicit geometry
    for (let i = 0; i < steps.length - 1; i++) {
      const sourceId = nodeIds[i];
      const targetId = nodeIds[i + 1];
      const edgeId = `edge_spine_${i + 1}`;
      const edgeColor = steps[i].edgeColor || "#2563eb";
      // Explicit exit/entry coordinates and dx/dy=0 with straight routing
      const edgeStyle = `edgeStyle=straight;html=1;strokeWidth=2.5;strokeColor=${edgeColor};exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;rounded=0;endArrow=classic;endFill=1;endSize=7;`;

      elements.push(
        `<mxCell id="${edgeId}" value="" style="${edgeStyle}" edge="1" parent="1" source="${sourceId}" target="${targetId}">` +
        `<mxGeometry relative="1" as="geometry" />` +
        `</mxCell>`
      );
    }

    // Side branches: Placed with generous spacing (130px) to prevent any label or arrow overlap
    sideBranches.forEach((branch, bIdx) => {
      const sideId = `node_side_${bIdx + 1}`;
      const parentStepIndex = branch.fromStepIndex;
      const y = startY + parentStepIndex * gap;
      const sideX = mainX + boxWidth + 130; // 130px gap for label breathing room
      const sideWidth = branch.width || 300;
      const val = escapeXml(branch.text);
      const style = branch.style || "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe4e6;strokeColor=#e11d48;fontColor=#881337;fontSize=11;fontStyle=1;arcSize=10;";

      elements.push(
        `<mxCell id="${sideId}" value="${val}" style="${style}" vertex="1" parent="1">` +
        `<mxGeometry x="${sideX}" y="${y}" width="${sideWidth}" height="${boxHeight}" as="geometry" />` +
        `</mxCell>`
      );

      const sideEdgeId = `edge_side_${bIdx + 1}`;
      const sideEdgeColor = branch.edgeColor || "#dc2626";
      const sideEdgeVal = escapeXml(branch.label || "");
      // labelBackgroundColor=#ffffff ensures edge text never cuts through lines or boxes
      const sideEdgeStyle = `edgeStyle=straight;html=1;strokeWidth=2;strokeColor=${sideEdgeColor};exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;rounded=0;endArrow=classic;endFill=1;labelBackgroundColor=#ffffff;labelBorderColor=none;fontSize=11;fontStyle=1;fontColor=${sideEdgeColor};`;

      elements.push(
        `<mxCell id="${sideEdgeId}" value="${sideEdgeVal}" style="${sideEdgeStyle}" edge="1" parent="1" source="${nodeIds[parentStepIndex]}" target="${sideId}">` +
        `<mxGeometry relative="1" as="geometry" />` +
        `</mxCell>`
      );
    });

    const pageHeight = Math.max(1000, startY + steps.length * gap + 90);

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
  blue: "rounded=1;whiteSpace=wrap;html=1;fillColor=#dbeafe;strokeColor=#2563eb;fontColor=#1e3a8a;fontSize=12;fontStyle=1;arcSize=10;",
  green: "rounded=1;whiteSpace=wrap;html=1;fillColor=#dcfce7;strokeColor=#16a34a;fontColor=#14532d;fontSize=12;fontStyle=1;arcSize=10;",
  amber: "rounded=1;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#d97706;fontColor=#78350f;fontSize=12;fontStyle=1;arcSize=10;",
  purple: "rounded=1;whiteSpace=wrap;html=1;fillColor=#ede9fe;strokeColor=#7c3aed;fontColor=#4c1d95;fontSize=12;fontStyle=1;arcSize=10;",
  rose: "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe4e6;strokeColor=#e11d48;fontColor=#881337;fontSize=12;fontStyle=1;arcSize=10;",
  cyan: "rounded=1;whiteSpace=wrap;html=1;fillColor=#cffafe;strokeColor=#0891b2;fontColor=#155e75;fontSize=12;fontStyle=1;arcSize=10;",
  slate: "rounded=1;whiteSpace=wrap;html=1;fillColor=#f1f5f9;strokeColor=#64748b;fontColor=#0f172a;fontSize=12;fontStyle=1;arcSize=10;",
};

const builder = new StraightDrawioBuilder();

// ====================================================================
// PAGE 0: ภาพรวมโมดูลทั้งหมด (Linear Vertical Chain)
// ====================================================================
builder.addVerticalPage(
  "0. ภาพรวมโมดูลทั้งหมด (Overview)",
  "ATTG Training Plan Management - ภาพรวมสถาปัตยกรรมทุกโมดูล (ตรงแถวเดียว)",
  "ขั้นตอนการไหลของข้อมูลจากต้นน้ำสู่ปลายน้ำ (Master Data ➔ Course ➔ Plan ➔ Record ➔ Report & Activities)",
  [
    {
      text: "1. Master Data Management\n• ข้อมูลองค์กร (Company, Function, Dept, Section, Position, Level L1-L9)\n• ข้อมูลวิทยากร (Internal/External), สถาบันฝึกอบรม, และข้อมูลพนักงานกลาง",
      style: STYLES.slate,
      edgeColor: "#64748b"
    },
    {
      text: "2. Training Course Management\n• สร้าง Course Master & Standard (Center Template ➔ Factory Course)\n• กำหนด Prerequisite Graph, Target Group, ผูกข้อสอบ (Assessment) & แบบประเมิน",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "3. Training Plan Management\n• รับคำขอ (Request Need) ➔ สำรวจกลุ่มเป้าหมาย (Accept Survey)\n• จัดทำแผนประจำปี (Annual OAP) ➔ รันแผนรายเดือน (Rolling Plan) ➔ เปิดรับสมัคร",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "4. Training Record Management\n• จัดอบรมรอบจริง (Training Actual) ➔ เช็คชื่อผู้เข้าเรียน (Attendance QR/Sheet)\n• ตรวจข้อสอบ (Auto/Reviewer) ➔ ตัดเกรด (Converter) ➔ บันทึกชั่วโมง & ออกใบเซอร์",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      text: "5. Report Management & Export Engine\n• Summary Dashboard (Planned Budget vs Actual Spending vs Variance)\n• Schedule Calendar (ปฏิทินตลอดปีแยกสีตามบริษัท) ➔ ส่งออก Excel อัตโนมัติ",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      text: "6. New Activities Management\n• บันทึกกิจกรรม/เวิร์กชอปด่วนนอกแผนประจำปี (On-Demand Workshops)\n• เก็บภาพถ่ายหลักฐาน (Evidences) ➔ สรุปยอดผู้ร่วมกิจกรรมใน New Activities Report",
      style: STYLES.rose,
      edgeColor: "#e11d48"
    }
  ],
  [],
  1250
);

// ====================================================================
// PAGE 1: Course Master & Standard Flow (Vertical)
// ====================================================================
builder.addVerticalPage(
  "1. Course Master & Standard",
  "HRD: Course Master & Standard Lifecycle Flow (ตรงแถวเดียว)",
  "ขั้นตอนการสร้างและกำหนดมาตรฐานหลักสูตร ตั้งแต่ระดับ Center จนถึงโรงงานนำไปใช้",
  [
    {
      text: "1. เริ่มสร้างคอร์ส (Center Template หรือ Factory Local Course)\n• HRD_CENTER สร้างแม่แบบมาตรฐานกลาง หรือ HRD_FACTORY ดึงจาก Center (Copy Template)",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "2. กำหนดข้อมูลพื้นฐานหลักสูตร (Course Metadata)\n• รหัสคอร์ส (Code), ชื่อไทย/อังกฤษ, วัตถุประสงค์ (Objective), เนื้อหา (Content), หมวดหมู่",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "3. กำหนดวิธีการเรียนรู้และมาตรฐานการสอน (Methodology & Standards)\n• เลือกรูปแบบ: Classroom, Online, Workshop, OJT พร้อมระบุจำนวนชั่วโมงอบรม",
      style: STYLES.slate,
      edgeColor: "#64748b"
    },
    {
      text: "4. กำหนดวิชาบังคับก่อน (Prerequisites) & ตรวจสอบ Loop\n• เลือกวิชาที่ต้องผ่านก่อน ➔ ระบบรัน Cycle Detection ป้องกันการตั้งเงื่อนไขวนลูป",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      text: "5. กำหนดกลุ่มเป้าหมาย (Target Group & Org Mapping)\n• Company (ATA, TEP, etc.) ➔ Function ➔ Department ➔ Section ➔ Position ➔ Level (L1-L9)",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      text: "6. ผูกแบบทดสอบและแบบประเมิน (Assessment & Evaluation Binding)\n• เลือกระบุ Pre-test, Post-test, Evaluation ทันที และแบบติดตามผล 30 วัน",
      style: STYLES.rose,
      edgeColor: "#e11d48"
    },
    {
      text: "7. คำนวณประมาณการงบประมาณ (Budget Estimate)\n• คำนวณค่าวิทยากร, สถานที่, ค่าอาหาร/เครื่องดื่ม และต้นทุนเฉลี่ยต่อหัว (Cost per Head)",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      text: "8. บันทึกเปิดใช้งาน (Status: Active) & Export Course Outline\n• หลักสูตรพร้อมนำไปบรรจุในแผนฝึกอบรม ➔ ส่งออก Outline เป็น Excel สำหรับทำเรื่องขออนุมัติ",
      style: STYLES.green,
      edgeColor: "#16a34a"
    }
  ],
  [],
  1250
);

// ====================================================================
// PAGE 2: Assessment (Pre-Post Test) Flow (Vertical)
// ====================================================================
builder.addVerticalPage(
  "2. Assessment (Pre-Post Test)",
  "HRD: Assessment Management Flow (ตรงแถวเดียว)",
  "ขั้นตอนการสร้างชุดข้อสอบ, การคุมเวอร์ชัน, การออกแบบคำถาม และการตั้งเกณฑ์ผ่าน",
  [
    {
      text: "1. สร้าง Assessment Series (กลุ่มชุดข้อสอบ)\n• ตั้งชื่อ Series เช่น \"ข้อสอบมาตรฐานความปลอดภัยในการทำงาน\", กำหนด Company สังกัด",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "2. จัดการเวอร์ชันข้อสอบ (Versioning: v1, v2, ...)\n• ระบุ Version Note บันทึกการปรับปรุงข้อสอบ ➔ ปรับเวอร์ชันใหม่ได้โดยไม่กระทบผลสอบเดิม",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "3. ตั้งเกณฑ์คะแนนและเวลาสอบ (Passing Score & Time Limit)\n• กำหนด Passing Score Percent (เช่น 70%, 80%) ➔ กำหนดเวลาจำกัด (นาที) ➔ กรอกคำชี้แจง",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      text: "4. ออกแบบข้อสอบใน Question Designer (รองรับ 5 รูปแบบ)\n• Single Choice (ช้อยส์เดี่ยว), Multiple Choice (หลายตัวเลือก), True/False (ถูก/ผิด)\n• Short/Long Text (ข้อเขียนส่งให้ Reviewer ตรวจ), Grid Matrix (ตารางระบุเฉลยแยกแถว)",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      text: "5. ทดสอบทำข้อสอบผ่าน FormPreviewRunner\n• จำลองหน้าจอการทำข้อสอบเสมือนจริง ➔ ตรวจสอบตัวจับเวลาและเช็คความถูกต้องของเฉลย",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "6. เปลี่ยนสถานะเป็น ACTIVE (Lock โครงสร้างข้อสอบ)\n• ระบบจะทำการ Lock ข้อสอบเพื่อป้องกันการแก้ไขเฉลยขณะที่มีการใช้งานในการอบรม",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      text: "7. ผูกเข้ากับคอร์สอบรม & เชื่อมโยงเข้า Auto-Grading\n• ผูกเป็น Pre-test / Post-test ในคอร์ส ➔ เมื่อพนักงานสอบ ระบบจะตรวจและบันทึกคะแนนอัตโนมัติ",
      style: STYLES.green,
      edgeColor: "#16a34a"
    }
  ],
  [],
  1250
);

// ====================================================================
// PAGE 3: Evaluation Forms Flow (Vertical)
// ====================================================================
builder.addVerticalPage(
  "3. Evaluation Forms",
  "HRD: Evaluation Management Flow (ตรงแถวเดียว)",
  "ขั้นตอนการออกแบบแบบประเมินผลการอบรม (ทันที & ติดตามผล 30 วัน พร้อม Skip Logic)",
  [
    {
      text: "1. กำหนดช่วงเวลาการประเมิน (Evaluation Timing)\n• เลือก After Training (ประเมินทันทีหลังอบรม) หรือ 30-Day Follow-up (ติดตามผล 30-90 วัน)",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "2. ออกแบบโครงสร้างคำถาม (Form Structure Designer)\n• Rating (ระดับ 1-5 ดาว), ช้อยส์เดี่ยว/กลุ่ม, ตาราง Matrix Grid, และ Short/Long Text ข้อเสนอแนะ",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "3. กำหนด Form Blocks & Branching Logic (Skip Logic)\n• เพิ่ม Section Break (แบ่งส่วน) & Text Block (คำชี้แจง) ➔ ตั้งค่าข้ามหน้าตามตัวเลือกที่ตอบ",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      text: "4. ทดสอบฟอร์มและเปลี่ยนสถานะเป็น PUBLISHED\n• รัน FormPreviewRunner จำลองการกดตอบ ➔ ยืนยันความพร้อมและเปิดใช้งาน (Published)",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      text: "5. ผูกเข้ากับหลักสูตรใน Training Plan\n• แนบเป็นแบบประเมินทางการสำหรับรุ่นการอบรมใน Rolling Plan",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "6. ประมวลผลผลลัพธ์ผ่าน Evaluation Converter & Export Excel\n• รวบรวมคำตอบ ➔ คำนวณคะแนนเฉลี่ย (% ความพึงพอใจ) ➔ ส่งออก Evaluation Summary Excel",
      style: STYLES.green,
      edgeColor: "#16a34a"
    }
  ],
  [],
  1250
);

// ====================================================================
// PAGE 4: Plan - Request Need & Accept Survey (Vertical with Generous Side Margin)
// ====================================================================
builder.addVerticalPage(
  "4. Plan - Need & Survey",
  "Training Plan: Request Need & Accept Survey (ตรงแถวเดียว)",
  "ขั้นตอนรับคำขอจากแผนก ➔ ตรวจสอบ Course/OAP ➔ สำรวจพนักงานเป้าหมาย ➔ อนุมัติโควตา",
  [
    {
      text: "1. พนักงาน / แผนก ส่งคำขอฝึกอบรม (Request Training Need)\n• ระบุ Course Needed หรือหัวข้อที่ต้องการ พร้อมระบุ Request Reason เหตุผลความจำเป็น",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "2. HRD ตรวจสอบใน Review Inbox (รวมกลุ่มตามหลักสูตร)\n• ตรวจสอบความต้องการ (Course Demand Group) และเช็คสถานะการมีอยู่ของคอร์สในระบบ",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "3. เชื่อมต่อคำขอสมบูรณ์เข้ากับรอบอบรม (needRequestHandoff)\n• หากมีคอร์สและ OAP พร้อมแล้ว ระบบจะแนบคำขอพนักงานเข้ากับรุ่นใน Rolling Plan ทันที",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      text: "4. ดึงกลุ่มเป้าหมายจาก Course Standard ใน Training Accept Survey\n• ดึงเกณฑ์ Level Rank (เช่น L4 ขึ้นไป), ตำแหน่งบังคับ (Section Head+), และสังกัดที่เกี่ยวข้อง",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "5. ตรวจสอบประวัติการเคยอบรม (Prior History Check)\n• ตรวจสอบ Course Enrollment History เพื่อป้องกันพนักงานลงทะเบียนซ้ำซ้อนในคอร์สเดิม",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      text: "6. รวบรวมรายชื่อผู้สมัครจากโรงงาน (Factory Submissions)\n• แต่ละโรงงาน (ATA, TEP, ATFB, etc.) ส่งรายชื่อเข้ามาตามโควตาที่จัดสรร",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "7. HRD อนุมัติรายชื่อผู้เข้าอบรม (Status: APPROVED)\n• อนุมัติรายชื่อผู้มีสิทธิ์เข้าเรียนจริงในรอบนั้น เพื่อเตรียมส่งต่อไปยังวันจัดอบรม",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      text: "8. Export Attendance Sheet Template (Excel)\n• ส่งออกเอกสารลงทะเบียนล่วงหน้าสำหรับเตรียมพร้อมในวันจัดอบรมจริง",
      style: STYLES.slate,
      edgeColor: "#64748b"
    }
  ],
  [
    {
      fromStepIndex: 1, // at step 2 (review inbox)
      text: "กรณีคอร์สยังไม่พร้อมในระบบ:\n• ยังไม่มีคอร์ส ➔ ระบบพาไปสร้าง Course Master\n• มีคอร์สแต่ไม่มี OAP ➔ ระบบพาไปสร้าง OAP\n(แล้วระบบจะพากลับมาจัดรุ่นต่อพร้อมคำขอเดิม)",
      label: "เช็คสถานะ",
      style: STYLES.amber,
      edgeColor: "#d97706",
      width: 320
    },
    {
      fromStepIndex: 6, // at step 7 (approve)
      text: "ไม่อนุมัติ / เกินโควตา:\n• ปรับสถานะเป็น REJECTED หรือ WAITLIST\n• แจ้งเหตุผลกลับไปยังผู้ยื่นและโรงงาน",
      label: "เกินโควตา",
      style: STYLES.rose,
      edgeColor: "#dc2626",
      width: 300
    }
  ],
  1450
);

// ====================================================================
// PAGE 5: Plan - Annual OAP & Rolling Plan (Vertical)
// ====================================================================
builder.addVerticalPage(
  "5. Plan - OAP & Rolling",
  "Training Plan: Annual OAP & Rolling Plan (ตรงแถวเดียว)",
  "ขั้นตอนจัดทำแผนงบประมาณประจำปี และการแตกแผนเป็นรุ่นปฏิบัติการรายเดือน",
  [
    {
      text: "1. จัดทำแผนฝึกอบรมประจำปี (Training OAP Setup)\n• ระบุปีปฏิทิน (Calendar Year) ➔ เลือกคอร์สจาก Course Master ➔ กำหนดไตรมาส Q1-Q4 และเดือนเป้าหมาย",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "2. คำนวณและจัดสรรงบประมาณรวม (Budget Estimate Calculation)\n• ค่าวิทยากร (Internal/External), อาหาร/เครื่องดื่ม, สถานที่, วัสดุ ➔ คำนวณต้นทุนต่อหัว (Cost per Head)",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      text: "3. กำหนดขอบเขตบริษัท & ส่งต่อการเปลี่ยนแปลง (Cascade Updates)\n• ระบุ All Companies หรือเฉพาะโรงงาน ➔ ระบบ Cascade การแก้ไขงบ/วิทยากรลงสู่ Rolling Plan อัตโนมัติ",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      text: "4. แตกแผนเป็นรุ่นปฏิบัติการใน Training Rolling (Create Batches)\n• แบ่งรอบอบรมเป็นรุ่น (Batch 1, 2, 3...) ➔ ระบุ วันเริ่มและวันสิ้นสุด (รองรับ Multi-day Training)",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "5. กำหนดสถานที่, จำนวนที่นั่ง และวิทยากรผู้สอน\n• ระบุห้องอบรม (Training Room), ที่นั่งรองรับ (Capacity), วิทยากรจริง, และแนบข้อสอบ/แบบประเมิน",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "6. อนุมัติสถานะแผนการอบรม (DRAFT ➔ SUBMITTED ➔ APPROVED)\n• ผ่านการตรวจสอบความพร้อมและได้รับการอนุมัติจากผู้มีอำนาจ",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "7. เผยแพร่แผน (Status: PUBLISHED) & สร้าง QR Code รับสมัคร\n• แสดงบน Schedule Calendar และ Dashboard ➔ สร้าง QR Code สำหรับให้พนักงานสแกนสมัครเข้าเรียน",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      text: "8. ส่งรอบอบรมเข้าสู่ Training Actual สำหรับวันจัดจริง\n• พร้อมสำหรับการเช็คชื่อและบันทึกค่าใช้จ่ายจริงในโมดูล Training Record Management",
      style: STYLES.green,
      edgeColor: "#16a34a"
    }
  ],
  [],
  1250
);

// ====================================================================
// PAGE 6: Record - Actual & History (Vertical)
// ====================================================================
builder.addVerticalPage(
  "6. Record - Actual & History",
  "Training Record: Training Actual & Record (ตรงแถวเดียว)",
  "ขั้นตอนจัดอบรมจริง ➔ เช็คชื่อ ➔ บันทึกค่าใช้จ่าย ➔ ตรวจข้อสอบ ➔ บันทึกประวัติสะสม & ออกใบเซอร์",
  [
    {
      text: "1. เปิดรอบจัดอบรมจริงใน Training Actual\n• ดึงข้อมูลรอบอบรมจาก Rolling Plan สถานะ Published ➔ ยืนยันวิทยากรและห้องอบรมจริง",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "2. เช็คชื่อผู้เข้าเรียน (Attendance Tracking)\n• สแกน QR Code หรือ เช็คชื่อผ่าน Attendance Sheet ➔ บันทึก Present (เข้าเรียน) / Absent (ขาด)",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      text: "3. บันทึกค่าใช้จ่ายจริงที่เกิดขึ้น (Actual Expenses & Variance)\n• กรอกค่าใช้จ่ายจริง: ค่าวิทยากร, เดินทาง, ที่พัก, อาหาร, วัสดุ ➔ ระบบคำนวณ Variance งบคงเหลือ/เกิน",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      text: "4. ระบบตรวจข้อสอบ (Grading Engine: Auto & Reviewer)\n• ข้อสอบปรนัยตรวจคะแนนทันที (Auto-Grading) / ข้อเขียนอัตนัยส่งเข้า Reviewer Assignment Panel",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "5. ประมวลผลคะแนนผ่าน Evaluation Converter & ตัดเกรด Pass/Fail\n• รวมคะแนน Pre vs Post (% พัฒนาการ) ➔ รวมผลประเมินความพึงพอใจ ➔ ตัดเกรดผ่านตาม Passing Score",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "6. ปิดรอบการสอบและการประเมิน (Set Stage Closed)\n• ล็อคการแก้ไขคะแนน เพื่อยืนยันความถูกต้องของผลการฝึกอบรมอย่างเป็นทางการ",
      style: STYLES.slate,
      edgeColor: "#64748b"
    },
    {
      text: "7. บันทึกลง Training Record (ประวัติรายบุคคลตลอดอายุงาน)\n• สะสมชั่วโมงอบรมตามกฎหมายกรมพัฒนาฝีมือแรงงาน ➔ ปกป้องข้อมูลส่วนบุคคล (Masked National ID PDPA)",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      text: "8. ออกใบประกาศนียบัตรดิจิทัล (Certificate Upload & Storage)\n• สร้างและอัปโหลดใบเซอร์สำหรับผู้ที่ Pass ➔ จัดเก็บในระบบให้พนักงานดาวน์โหลดผ่าน My Records",
      style: STYLES.green,
      edgeColor: "#16a34a"
    }
  ],
  [],
  1250
);

// ====================================================================
// PAGE 7: Report - Dashboard & Calendar (Vertical)
// ====================================================================
builder.addVerticalPage(
  "7. Report - Dashboard & Calendar",
  "Report Management: Summary Dashboard & Schedule Calendar (ตรงแถวเดียว)",
  "ขั้นตอนสรุปผลการเงิน/งบประมาณสำหรับผู้บริหาร และระบบปฏิทินแสดงตารางอบรมทั้งปี",
  [
    {
      text: "1. สรุปข้อมูลงบประมาณใน Summary Dashboard (buildFinanceSummary)\n• ดึงข้อมูลเปรียบเทียบ: Planned Budget (งบตามแผน) vs Actual Spending (ใช้จริง) vs Variance (คงเหลือ/เกิน)",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      text: "2. จำแนกประเภทแหล่งเงินทุน (Center vs Factory Funding)\n• สรุปยอดหลักสูตรที่ Center สนับสนุนงบประมาณ และหลักสูตรที่แต่ละโรงงาน (ATA, TEP, etc.) เบิกจ่ายเอง",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "3. คำนวณ KPI การอบรม (Attendance & Pass Rate Metrics)\n• คำนวณยอดรวม Enrolled vs Attended, อัตราเข้าเรียน (% Attendance), อัตราสอบผ่าน (% Pass Rate), ชั่วโมงสะสม",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      text: "4. นำข้อมูลรอบอบรมไปแสดงบน Schedule Calendar\n• แสดงปฏิทินการฝึกอบรมแบบ Interactive ทั้งมุมมองรายเดือน (Monthly Grid) และมุมมองทั้งปี",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      text: "5. แสดงแถบสีแยกตามบริษัทชัดเจน (Company Color Coding)\n• ALL: สีกลาง / ATA: สีกรมท่า / TEP: สีฟ้า / ATFB: สีส้ม / NIC: สีม่วง / SATI: สีเขียว / SNF: สีชมพู",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "6. คำนวณช่วงวันคอร์สอบรมต่อเนื่อง (Multi-Day Course Calculation)\n• ฟังก์ชัน getPlanDaysCount คำนวณวันต่อเนื่องและแสดงแถบลากยาวตามจำนวนวันอบรมจริง",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "7. แสดงสถานะและจำนวนที่นั่งคงเหลือ [Enrolled / Capacity]\n• ป้ายสถานะ (Published / Completed) พร้อมจำนวนที่นั่งว่าง ➔ คลิกดูรายละเอียดหรือเปิดหน้าสมัครได้ทันที",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      text: "8. ส่งออกรายงาน Excel Workbook อัตโนมัติ\n• Attendance Sheet, Course Outline, และ Evaluation Summary สำหรับส่งผู้บริหารและหน่วยงานราชการ",
      style: STYLES.slate,
      edgeColor: "#64748b"
    }
  ],
  [],
  1250
);

// ====================================================================
// PAGE 8: Report - New Activities (Vertical)
// ====================================================================
builder.addVerticalPage(
  "8. Report - New Activities",
  "Report Management: New Activities & Ad-hoc Workshops (ตรงแถวเดียว)",
  "ขั้นตอนการบันทึกกิจกรรมฝึกอบรมพิเศษนอกแผนประจำปี, รูปภาพหลักฐาน และออกรายงาน",
  [
    {
      text: "1. สร้างกิจกรรมใหม่นอกแผนประจำปี (ActivityFormModal)\n• กรอกชื่อกิจกรรมพิเศษหรือเวิร์กชอปด่วน (Activity Name TH/EN) ➔ ระบุวันที่จัด และสถานที่ (Venue/Room)",
      style: STYLES.rose,
      edgeColor: "#e11d48"
    },
    {
      text: "2. ระบุบริษัทผู้จัดและประเภทกิจกรรม\n• กำหนดบริษัทผู้จัด: CENTER หรือระบุโรงงาน (ATA, TEP, etc.) ➔ หมวดหมู่ (Safety, Technical, CSR) ➔ งบประมาณ",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      text: "3. กำหนดกลุ่มเป้าหมายและบันทึกยอดผู้เข้าร่วม\n• ระบุฝ่าย/แผนกเป้าหมาย ➔ บันทึกจำนวนผู้เข้าร่วมกิจกรรมจริง (Actual Attendees Count)",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      text: "4. บันทึกผลสัมฤทธิ์และอัปโหลดหลักฐาน (Activity Photo Gallery)\n• บันทึกสรุปผลที่ได้รับ ➔ อัปโหลดภาพถ่ายกิจกรรมและไฟล์เอกสารใบลงชื่อเข้าสู่ระบบ",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      text: "5. ออกรายงาน New Activities Report & นำเสนอผู้บริหาร\n• รวบรวมสถิติกิจกรรมพิเศษแสดงบน Dashboard หน้าแรกของระบบ ➔ ส่งออกรายงานสรุปกิจกรรม",
      style: STYLES.green,
      edgeColor: "#16a34a"
    }
  ],
  [],
  1250
);

const xmlOutput = builder.toXml();
const targetPath = path.resolve("d:/TrainingPlan/ATTG_HRD_Detailed_Flowcharts.drawio");
fs.writeFileSync(targetPath, xmlOutput, "utf-8");
console.log("Successfully generated clean straight vertical flowcharts:", targetPath);
