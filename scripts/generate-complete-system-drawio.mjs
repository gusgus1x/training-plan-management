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

class SystemFlowchartBuilder {
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
      const style = branch.style || "rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#ffe4e6;strokeColor=#e11d48;fontColor=#881337;fontSize=11;fontStyle=0;";

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
    let out = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" agent="ATTG System" pages="${this.pages.length}">\n`;

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

const builder = new SystemFlowchartBuilder();

// ====================================================================================
// หมวดที่ 1: HRD Master Overview & เปรียบเทียบ
// ====================================================================================

// 01. HRD - Center vs Factory
builder.addStandardPage(
  "01. HRD - Center vs Factory",
  "HRD: เปรียบเทียบบทบาท Center vs Factory และภาพรวมระบบ",
  "ส่วนกลาง (Center) กำหนดมาตรฐานและงบรวม ➔ โรงงาน (Factory) ปรับใช้ในพื้นที่และส่งคนเข้าอบรม",
  [
    { type: "terminator", text: "เริ่มต้น (Start)" },
    {
      type: "process",
      text: "1. กำหนดบทบาทหน้าที่ของ HRD\n• HRD ส่วนกลาง (Center): ดูแลข้อมูลหลัก, สร้างคอร์สต้นแบบ, แผนประจำปีรวม, จัดสรรงบ\n• HRD โรงงาน (Factory): ดึงคอร์สมาใช้, สำรวจโควตาคนในโรงงาน, จัดรอบอบรม, เบิกจ่ายงบ",
      style: STYLES.slate,
      edgeColor: "#64748b"
    },
    {
      type: "decision",
      text: "ผู้ใช้งานสังกัด\nส่วนกลาง หรือ โรงงาน?",
      yesLabel: "HRD ส่วนกลาง (Center)"
    },
    {
      type: "process",
      text: "2. ส่วนกลางสร้างคอร์สต้นแบบและแผนรวม\nสร้างคอร์สมาตรฐาน ➔ ผูกข้อสอบกลาง ➔ จัดทำแผนฝึกอบรมประจำปี (OAP) และจัดสรรงบ",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "3. ส่งมอบคอร์สและโควตาให้โรงงาน\nเปิดให้แต่ละโรงงานดึงคอร์สไปใช้ และจัดสรรโควตาตามสายงาน",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "4. ปฏิบัติการจัดฝึกอบรมร่วมกัน\nโรงงานเปิดรอบอบรมรายเดือน ➔ พนักงานสมัคร ➔ จัดสอนจริง ➔ เช็คชื่อ ➔ ตรวจข้อสอบ",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "5. สรุปผลการอบรมและงบประมาณ\nตรวจสอบงบใช้จริง vs งบตามแผน, ตรวจสอบผู้ผ่านการอบรม, และออกใบประกาศนียบัตร",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    { type: "terminator", text: "สิ้นสุดกระบวนการ (End)" }
  ],
  [
    {
      fromItemIndex: 2, // Decision: Center หรือ Factory?
      text: "HRD โรงงาน (Factory):\nดึงคอร์สต้นแบบมาใช้ ➔ ใส่ชื่อโรงงานตนเอง ➔ สำรวจรายชื่อผู้เรียน ➔ เบิกจ่ายงบของโรงงาน",
      label: "HRD โรงงาน (Factory)",
      style: STYLES.blue,
      edgeColor: "#2563eb",
      width: 320
    }
  ]
);

// ====================================================================================
// หมวดที่ 2: Training Course Management
// ====================================================================================

// 02. Course - ภาพรวมการทำงาน
builder.addStandardPage(
  "02. Course - ภาพรวมการทำงาน",
  "การจัดการหลักสูตร: ภาพรวมการทำงานทั้งโมดูล",
  "ขั้นตอนสร้างคอร์ส: กำหนดข้อมูลคอร์ส ➔ ออกแบบข้อสอบ ➔ ออกแบบแบบประเมิน ➔ เปิดใช้งาน",
  [
    { type: "terminator", text: "เริ่มต้น (Start)" },
    {
      type: "process",
      text: "1. กำหนดรายละเอียดหลักสูตร (Course Master & Standard)\nตั้งรหัสคอร์ส, ชื่อคอร์ส, วัตถุประสงค์, ชั่วโมงอบรม, และกลุ่มพนักงานเป้าหมาย",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "2. ออกแบบชุดข้อสอบ (Assessment Management)\nสร้างข้อสอบก่อนเรียน (Pre-test) และหลังเรียน (Post-test) พร้อมกำหนดเกณฑ์คะแนนผ่าน",
      style: STYLES.rose,
      edgeColor: "#e11d48"
    },
    {
      type: "process",
      text: "3. ออกแบบแบบประเมิน (Evaluation Management)\nสร้างแบบประเมินความพึงพอใจทันทีหลังเรียน และแบบติดตามผลหลังผ่านไป 30 วัน",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "decision",
      text: "ทดลองทำข้อสอบและ\nแบบประเมินแล้ว ถูกต้องไหม?",
      yesLabel: "ถูกต้องสมบูรณ์"
    },
    {
      type: "process",
      text: "4. ผูกข้อสอบและแบบประเมินเข้ากับคอร์ส\nเชื่อมต่อแบบวัดผลเข้ากับหลักสูตร เพื่อให้ระบบตรวจคะแนนอัตโนมัติเมื่อพนักงานสอบ",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "5. บันทึกเปิดใช้งานหลักสูตร (Active)\nหลักสูตรพร้อมนำไปเปิดสอนและจัดลงในแผนการฝึกอบรม",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 4, // Decision: ทดสอบผ่านไหม?
      text: "พบจุดต้องแก้ไข:\nกลับไปปรับแก้คำถาม ตัวเลือก หรือเฉลยให้ถูกต้อง",
      label: "ต้องแก้ไข",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// 03. Course - Master & Standard
builder.addStandardPage(
  "03. Course - Master & Standard",
  "Course Master & Standard: การสร้างและกำหนดมาตรฐานคอร์ส",
  "กำหนดข้อมูลคอร์ส, เลือกคอร์สต่อเนื่องที่ต้องผ่านก่อน, กำหนดกลุ่มเป้าหมาย, และคำนวณงบต่อหัว",
  [
    { type: "terminator", text: "เริ่มสร้างหลักสูตร (Start)" },
    {
      type: "process",
      text: "1. เลือกวิธีสร้างคอร์ส\nส่วนกลางสร้างคอร์สแม่แบบ หรือโรงงานดึงคอร์สแม่แบบมาปรับใช้ (Copy Template)",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "2. กรอกข้อมูลพื้นฐานหลักสูตร\nรหัสคอร์ส, ชื่อไทย/อังกฤษ, วัตถุประสงค์, เนื้อหาที่สอน, และหมวดหมู่คอร์ส",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "3. กำหนดรูปแบบการสอนและชั่วโมงอบรม\nเลือก: ในห้องเรียน (Classroom), ออนไลน์ (Online), เวิร์กชอป, หรือฝึกหน้างาน (OJT)",
      style: STYLES.slate,
      edgeColor: "#64748b"
    },
    {
      type: "decision",
      text: "มีคอร์สต่อเนื่อง\nที่ต้องผ่านก่อนไหม?",
      yesLabel: "มีคอร์สต่อเนื่อง"
    },
    {
      type: "process",
      text: "4. เลือกคอร์สต่อเนื่อง (ถ้ามี)\nเลือกคอร์สที่ต้องสอบผ่านก่อน โดยระบบจะช่วยตรวจสอบป้องกันไม่ให้ตั้งเงื่อนไขวนลูป",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "process",
      text: "5. ระบุกลุ่มเป้าหมายผู้เข้าอบรม\nเลือกบริษัท (ATA, TEP, etc.), สายงาน, แผนก, ตำแหน่ง, และระดับพนักงาน (L1-L9)",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "6. ผูกข้อสอบและแบบประเมินผล\nเลือกข้อสอบ Pre/Post Test และแบบประเมินความพึงพอใจสำหรับคอร์สนี้",
      style: STYLES.rose,
      edgeColor: "#e11d48"
    },
    {
      type: "process",
      text: "7. คำนวณประมาณการงบประมาณ\nประเมินค่าวิทยากร, ค่าสถานที่, ค่าอาหาร และคำนวณต้นทุนเฉลี่ยต่อคน (Cost per Head)",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "process",
      text: "8. บันทึกเปิดใช้งานคอร์ส (Active)\nหลักสูตรพร้อมเปิดรับและนำไปจัดแผนอบรมประจำปี (OAP)",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "document",
      text: "ส่งออกโครงสร้างหลักสูตร (Course Outline Excel)\nเอกสารรายละเอียดคอร์สสำหรับแนบเรื่องขออนุมัติหรือยื่นราชการ"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 4, // Decision: มีคอร์สต่อเนื่องไหม?
      text: "ไม่มีคอร์สต่อเนื่อง:\nพนักงานทั่วไปตามกลุ่มเป้าหมายสามารถสมัครเรียนได้ทันที",
      label: "ไม่มี",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    }
  ]
);

// 04. Course - Assessment Flow
builder.addStandardPage(
  "04. Course - Assessment Flow",
  "การจัดการแบบทดสอบ: ออกแบบข้อสอบก่อนเรียนและหลังเรียน",
  "จัดการชุดข้อสอบ, คุมเวอร์ชัน, ออกแบบคำถาม 5 รูปแบบ, ตั้งเกณฑ์ผ่าน, และตรวจคะแนนอัตโนมัติ",
  [
    { type: "terminator", text: "เริ่มสร้างข้อสอบ (Start)" },
    {
      type: "process",
      text: "1. ตั้งชื่อชุดข้อสอบและจัดการเวอร์ชัน\nระบุชื่อชุดข้อสอบ, บริษัทที่ใช้, และบันทึกเวอร์ชัน (v1, v2) เมื่อมีการปรับปรุงข้อสอบ",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "2. กำหนดเกณฑ์ผ่านและเวลาทำข้อสอบ\nระบุเปอร์เซ็นต์คะแนนผ่าน (เช่น 70%, 80%), กำหนดเวลาสอบ (นาที), และคำชี้แจง",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "process",
      text: "3. ออกแบบข้อสอบ (รองรับ 5 รูปแบบ)\n• ช้อยส์เลือกตอบ 1 ข้อ / ช้อยส์เลือกได้หลายข้อ / ถูก-ผิด\n• ข้อเขียนสั้น-ยาว (ส่งอาจารย์ตรวจ) / ตารางจับคู่ประเมิน (Grid)",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "4. ทดลองทำข้อสอบจริงเพื่อตรวจความถูกต้อง\nทดสอบทำข้อสอบเสมือนจริง ตรวจสอบการจับเวลา และเช็คความถูกต้องของเฉลยทุกข้อ",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "decision",
      text: "ข้อสอบและเฉลย\nถูกต้องครบถ้วนไหม?",
      yesLabel: "ถูกต้องสมบูรณ์"
    },
    {
      type: "process",
      text: "5. บันทึกเปิดใช้งานข้อสอบ (Active)\nระบบจะล็อกข้อสอบ เพื่อไม่ให้แก้ไขเฉลยระหว่างที่มีการสอบจริง",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "6. ผูกกับคอร์ส พร้อมตรวจคะแนนอัตโนมัติ\nเมื่อพนักงานทำข้อสอบ ระบบจะตรวจและบันทึกคะแนนเข้าประวัติทันที",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 5, // Decision: ข้อสอบถูกต้องไหม?
      text: "พบข้อผิดพลาด:\nกลับไปแก้ไขโจทย์ ตัวเลือก หรือแต้มคะแนนให้ถูกต้อง",
      label: "ต้องแก้ไข",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// 05. Course - Evaluation Flow
builder.addStandardPage(
  "05. Course - Evaluation Flow",
  "การจัดการแบบประเมิน: ประเมินผลการอบรมและติดตามผล 30 วัน",
  "ออกแบบแบบประเมินความพึงพอใจ, ตั้งค่าเงื่อนไขข้ามหน้า, และส่งออกรายงานสรุปผล",
  [
    { type: "terminator", text: "เริ่มสร้างแบบประเมิน (Start)" },
    {
      type: "decision",
      text: "เลือกช่วงเวลา\nที่จะให้ทำแบบประเมิน?",
      yesLabel: "ทำทันทีหลังอบรมเสร็จ"
    },
    {
      type: "process",
      text: "1. ออกแบบข้อคำถามในแบบฟอร์ม\nให้คะแนนดาว 1-5, ช้อยส์เลือกตอบ, ตารางประเมินหัวข้อย่อย, และช่องเขียนข้อเสนอแนะ",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. แบ่งหน้าและตั้งเงื่อนไขข้ามหน้า (ถ้ามี)\nใส่ข้อความชี้แจง และตั้งค่าให้ข้ามไปยังหน้าที่ต้องการตามคำตอบที่ผู้เรียนเลือก",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "3. ทดลองตอบแบบประเมินจริง\nตรวจเช็คหน้าตาฟอร์ม การแบ่งหน้า และความถูกต้องของคำถาม",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "decision",
      text: "ฟอร์มประเมิน\nพร้อมเปิดใช้งานไหม?",
      yesLabel: "พร้อมเปิดใช้งาน"
    },
    {
      type: "process",
      text: "4. เปิดใช้งานแบบประเมิน และผูกเข้ากับรอบอบรม\nเปิดให้พนักงานที่เข้าอบรมทำแบบประเมินหลังเรียนจบ",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "5. ประมวลผลคะแนนความพึงพอใจ\nรวบรวมคำตอบ และคำนวณร้อยละความพึงพอใจภาพรวม",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "document",
      text: "ส่งออกรายงานสรุปผลประเมิน (Excel)\nรายงานสรุปคะแนนความพึงพอใจและข้อคิดเห็นสำหรับส่งผู้บริหาร",
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 1, // Decision: ช่วงเวลาประเมิน
      text: "ติดตามผลหลังอบรม 30-90 วัน:\nแบบประเมินวัดการนำความรู้ไปใช้จริงในการทำงาน (ประเมินโดยตนเองและหัวหน้างาน)",
      label: "ติดตามผล 30 วัน",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      fromItemIndex: 5, // Decision: พร้อมเปิดใช้ไหม?
      text: "ยังไม่พร้อม:\nบันทึกเป็นแบบร่าง (Draft) เพื่อรอตรวจทานหัวข้อคำถาม",
      label: "ยังไม่พร้อม",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// ====================================================================================
// หมวดที่ 3: Training Plan Management
// ====================================================================================

// 06. Plan - ภาพรวมการทำงาน
builder.addStandardPage(
  "06. Plan - ภาพรวมการทำงาน",
  "การจัดการแผนฝึกอบรม: ภาพรวมการทำงานทั้งโมดูล",
  "ขั้นตอนวางแผน: รับคำขอ ➔ สำรวจโควตา ➔ แผนประจำปี (OAP) ➔ แผนรายเดือน (Rolling) ➔ เปิดรับสมัคร",
  [
    { type: "terminator", text: "เริ่มต้น (Start)" },
    {
      type: "process",
      text: "1. รับคำขอฝึกอบรม (Request Training Need)\nรับเรื่องจากแผนก/พนักงานที่ต้องการอบรม และตรวจสอบความต้องการตามหลักสูตร",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. สำรวจและอนุมัติรายชื่อ (Training Accept Survey)\nดึงกลุ่มเป้าหมายตามมาตรฐานคอร์ส ตรวจสอบโควตา และอนุมัติรายชื่อผู้เข้าอบรม",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "3. จัดทำแผนประจำปี (Training OAP)\nวางแผนงบประมาณภาพรวมของกลุ่มบริษัท กำหนดไตรมาสและเดือนเป้าหมายที่จะจัด",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "process",
      text: "4. จัดทำแผนปฏิบัติการรายเดือน (Training Rolling)\nแตกแผนเป็นรุ่น (Batches) ระบุวันเวลา ห้องอบรม วิทยากร และจำนวนที่นั่ง",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "decision",
      text: "แผนรอบอบรมได้รับ\nการอนุมัติเรียบร้อยไหม?",
      yesLabel: "อนุมัติเรียบร้อย"
    },
    {
      type: "process",
      text: "5. เปิดรับสมัครในระบบ\nแสดงบนปฏิทิน และเปิดให้พนักงานกดสมัครเรียนผ่านเมนู Register Train",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "6. ส่งรอบอบรมเข้าสู่วันจัดจริง\nส่งมอบข้อมูลรอบอบรมเพื่อเตรียมพร้อมสำหรับการเช็คชื่อในวันเรียนจริง",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 5, // Decision: แผนอนุมัติเรียบร้อยไหม?
      text: "ยังไม่อนุมัติ / รอแก้ไข:\nบันทึกเป็นแบบร่าง (Draft) เพื่อรอปรับแก้วันเวลา ห้องอบรม หรือวิทยากร",
      label: "รอแก้ไข",
      style: STYLES.slate,
      edgeColor: "#64748b"
    }
  ]
);

// 07. Plan - Training OAP
builder.addStandardPage(
  "07. Plan - Training OAP",
  "Training OAP: แผนฝึกอบรมประจำปีกลุ่มบริษัท",
  "จัดทำแผนแม่บทประจำปี, คำนวณงบประมาณรวม, และส่งต่องบประมาณไปยังรอบอบรมอัตโนมัติ",
  [
    { type: "terminator", text: "เริ่มจัดทำแผนประจำปี (Start)" },
    {
      type: "process",
      text: "1. กำหนดปีงบประมาณและเลือกคอร์ส\nระบุปีปฏิทิน, เลือกคอร์สจากฐานข้อมูล, กำหนดไตรมาส (Q1-Q4) และเดือนเป้าหมายที่จะจัด",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "2. คำนวณงบประมาณรวมของหลักสูตร\nประเมินค่าวิทยากร, ค่าอาหาร, ค่าห้องอบรม, ค่าอุปกรณ์ และสรุปต้นทุนเฉลี่ยต่อคน",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "decision",
      text: "กำหนดให้จัดสำหรับ\nทุกบริษัท หรือเฉพาะโรงงาน?",
      yesLabel: "ทุกบริษัท (ส่วนกลางจัด)"
    },
    {
      type: "process",
      text: "3. ระบบอัปเดตข้อมูลงบประมาณไปยังรอบอบรมให้อัตโนมัติ\nส่งต่องบประมาณและวิทยากรที่ตั้งไว้ ไปยังรุ่นต่างๆ ในแผนรายเดือน (Rolling Plan)",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "4. บันทึกแผนประจำปี OAP เรียบร้อย\nพร้อมนำไปแตกเป็นรุ่นปฏิบัติการจริงในแผนรายเดือน (Rolling)",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 3, // Decision: ทุกบริษัทหรือเฉพาะโรงงาน?
      text: "เฉพาะโรงงาน:\nระบุโรงงานเป้าหมาย (เช่น ATA, TEP, ATFB) และตัดงบเฉพาะโรงงานนั้นๆ",
      label: "เฉพาะโรงงาน",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    }
  ]
);

// 08. Plan - Training Rolling
builder.addStandardPage(
  "08. Plan - Training Rolling",
  "Training Rolling: แผนปฏิบัติการรายเดือนและเปิดรอบอบรม",
  "แตกแผนเป็นรุ่น (Batch), กำหนดวันเวลา/ห้องอบรม, อนุมัติแผน, และเปิดรับสมัครผ่านระบบ",
  [
    { type: "terminator", text: "เริ่มจัดทำแผนรายเดือน (Start)" },
    {
      type: "process",
      text: "1. แตกแผนประจำปีเป็นรุ่นอบรม (Create Batches)\nแบ่งรอบอบรมเป็นรุ่น (Batch 1, 2, 3...) ระบุวันเริ่มและวันสิ้นสุด (รองรับคอร์สหลายวัน)",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. ระบุสถานที่, ที่นั่งรองรับ และวิทยากรจริง\nกำหนดห้องอบรม, จำนวนที่นั่ง (Capacity), วิทยากรผู้สอน, และแนบข้อสอบ/แบบประเมิน",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "decision",
      text: "ตรวจสอบและอนุมัติ\nแผนรอบอบรมนี้ไหม?",
      yesLabel: "อนุมัติแล้ว (Approved)"
    },
    {
      type: "process",
      text: "3. เปิดรับสมัครพนักงานผ่านระบบ (Published)\nแสดงรอบอบรมบนปฏิทิน และเปิดให้พนักงานกดสมัครเรียนผ่านเมนู Register Train",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "4. ส่งมอบรอบอบรมเข้าสู่วันจัดจริง\nส่งต่อรายชื่อและข้อมูลรอบอบรม เพื่อเตรียมเช็คชื่อในวันเรียนจริง",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 3, // Decision: อนุมัติแผนไหม?
      text: "ยังไม่อนุมัติ:\nบันทึกเป็นแบบร่าง (Draft) เพื่อรอเช็คคิววิทยากรหรือห้องว่าง",
      label: "ร่าง / รอตรวจ",
      style: STYLES.slate,
      edgeColor: "#64748b"
    }
  ]
);

// 09. Plan - Request Training Need
builder.addStandardPage(
  "09. Plan - Request Training Need",
  "Request Training Need: รับคำขอเปิดคอร์สจากแผนก",
  "รับคำขอจากแผนก ➔ ตรวจสอบคอร์ส/OAP ในระบบ ➔ นำคำขอไปจัดใส่ในรอบอบรมที่เปิดรับ",
  [
    { type: "terminator", text: "เริ่มรับคำขอ (Start)" },
    {
      type: "process",
      text: "1. รับคำขอฝึกอบรมจากแผนก/พนักงาน\nระบุคอร์สที่ต้องการอบรม และเหตุผลความจำเป็นในการพัฒนาทักษะ",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. HRD รวมกลุ่มคำขอในกล่องรับเรื่อง (Review Inbox)\nรวบรวมคำขอตามหลักสูตร เพื่อดูจำนวนคนที่ต้องการเรียนและเช็คสถานะคอร์สในระบบ",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "decision",
      text: "มีหลักสูตรนี้ใน\nฐานข้อมูลคอร์สหรือยัง?",
      yesLabel: "มีคอร์สอยู่แล้ว"
    },
    {
      type: "decision",
      text: "มีแผนประจำปี (OAP)\nของคอร์สนี้หรือยัง?",
      yesLabel: "มีแผน OAP แล้ว"
    },
    {
      type: "process",
      text: "3. นำคำขอไปจัดใส่ในรอบอบรมที่เปิดรับ\nนำรายชื่อผู้ยื่นคำขอไปบรรจุเข้าในรอบอบรม (Batch) ที่กำลังเปิดรับสมัครทันที",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 3, // Decision: มีคอร์สในระบบไหม?
      text: "ยังไม่มีคอร์สในระบบ:\nระบบจะพาไปสร้างคอร์สใหม่ก่อน ➔ แล้วพาไปสร้าง OAP และจัดรุ่นต่อ",
      label: "ยังไม่มีคอร์ส",
      style: STYLES.rose,
      edgeColor: "#dc2626",
      width: 320
    },
    {
      fromItemIndex: 4, // Decision: มี OAP ไหม?
      text: "มีคอร์สแล้วแต่ยังไม่มี OAP:\nระบบจะพาไปสร้างแผนประจำปี (OAP) ก่อน ➔ แล้วพากลับมาจัดรุ่นต่อ",
      label: "ยังไม่มี OAP",
      style: STYLES.amber,
      edgeColor: "#d97706",
      width: 320
    }
  ]
);

// 10. Plan - Training Accept Survey
builder.addStandardPage(
  "10. Plan - Training Accept Survey",
  "Training Accept Survey: สำรวจโควตาและอนุมัติผู้เข้าอบรม",
  "ดึงเกณฑ์กลุ่มเป้าหมาย ➔ ตรวจสอบประวัติการลงซ้ำ ➔ อนุมัติโควตาโรงงาน ➔ ส่งออกใบเช็คชื่อ",
  [
    { type: "terminator", text: "เริ่มสำรวจผู้เข้าอบรม (Start)" },
    {
      type: "process",
      text: "1. ดึงกลุ่มเป้าหมายตามมาตรฐานคอร์ส\nดึงเกณฑ์ระดับพนักงาน (เช่น L4 ขึ้นไป), ตำแหน่ง (หัวหน้าส่วนขึ้นไป), และแผนกที่เกี่ยวข้อง",
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
      text: "2. รวมรายชื่อผู้สมัครจากแต่ละโรงงาน\nแต่ละโรงงาน (ATA, TEP, ATFB, etc.) ส่งรายชื่อผู้ประสงค์เข้าอบรมตามโควตา",
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
      text: "3. บันทึกยืนยันรายชื่อผู้มีสิทธิ์เข้าอบรมจริง\nยืนยันรายชื่อผู้เข้าเรียนในรอบนั้น เพื่อส่งต่อให้ผู้สอนและเจ้าหน้าที่เช็คชื่อ",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "document",
      text: "ส่งออกใบเช็คชื่อผู้เข้าเรียน (Attendance Sheet Excel)\nเอกสารใบลงชื่ออย่างเป็นทางการสำหรับใช้เช็คชื่อในวันจัดอบรมจริง",
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 2, // Decision: เคยผ่านหรือยัง?
      text: "เคยผ่านคอร์สนี้แล้ว:\nแจ้งเตือนประวัติการอบรมซ้ำ เพื่อป้องกันการสูญเสียงบประมาณซ้ำซ้อน",
      label: "เคยผ่านแล้ว",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    },
    {
      fromItemIndex: 4, // Decision: อนุมัติตามโควตาไหม?
      text: "ไม่อนุมัติ / เกินโควตา:\nปรับสถานะเป็นรอคิว (Waitlist) หรือไม่อนุมัติ พร้อมแจ้งเหตุผลกลับ",
      label: "ไม่อนุมัติ/เกินโควตา",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// ====================================================================================
// หมวดที่ 4: Training Record Management
// ====================================================================================

// 11. Record - ภาพรวมการทำงาน
builder.addStandardPage(
  "11. Record - ภาพรวมการทำงาน",
  "การบันทึกผลการอบรม: ภาพรวมการทำงานทั้งโมดูล",
  "วันจัดจริง: เปิดห้องอบรม ➔ เช็คชื่อ ➔ ตรวจข้อสอบ ➔ รวมคะแนนตัดเกรด ➔ บันทึกประวัติ ➔ ออกใบเซอร์",
  [
    { type: "terminator", text: "เริ่มต้น (Start)" },
    {
      type: "process",
      text: "1. เปิดรอบจัดอบรมจริงในระบบ (Training Actual)\nดึงรอบอบรมจากแผนที่อนุมัติแล้ว และยืนยันสถานที่และวิทยากรผู้สอน",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. เช็คชื่อผู้เข้าเรียนและบันทึกเวลาจริง\nบันทึกสถานะ มาเรียน หรือ ขาดเรียน เพื่อนำไปคำนวณชั่วโมงอบรมตามกฎหมาย",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "3. บันทึกค่าใช้จ่ายจริงที่เกิดขึ้น\nกรอกค่าวิทยากร, อาหาร, ที่พัก, เดินทาง และคำนวณงบคงเหลือหรือยอดเกินงบ (Variance)",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "process",
      text: "4. ตรวจข้อสอบและรวมคะแนนประเมิน\nตรวจข้อสอบช้อยส์อัตโนมัติ + ส่งข้อเขียนให้อาจารย์ตรวจ ➔ รวมคะแนนและตัดเกรด",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "decision",
      text: "คะแนนสอบและเวลาเรียน\nผ่านเกณฑ์ที่กำหนดไหม?",
      yesLabel: "ผ่านเกณฑ์ (Pass)"
    },
    {
      type: "process",
      text: "5. บันทึกลงประวัติการอบรมของพนักงาน\nสะสมชั่วโมงอบรมตลอดอายุงานสำหรับยื่นกรมพัฒนาฝีมือแรงงาน",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "document",
      text: "ออกใบประกาศนียบัตรดิจิทัล (Certificate)\nจัดเก็บในระบบ ให้พนักงานเข้าไปดาวน์โหลดผ่านหน้าประวัติส่วนตัวได้ทันที",
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 5, // Decision: ผ่านเกณฑ์ไหม?
      text: "ไม่ผ่านเกณฑ์ (Fail):\nบันทึกสถานะไม่ผ่านในประวัติ ➔ รอจัดรอบสอบซ่อมหรืออบรมใหม่",
      label: "ไม่ผ่านเกณฑ์",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// 12. Record - Training Actual
builder.addStandardPage(
  "12. Record - Training Actual",
  "Training Actual: การจัดอบรมจริงและการบันทึกค่าใช้จ่าย",
  "เช็คชื่อผู้เข้าเรียน (มาเรียน/ขาดเรียน), บันทึกค่าใช้จ่ายจริง 6 หมวด, และคำนวณงบคงเหลือ/เกิน",
  [
    { type: "terminator", text: "เริ่มจัดอบรมรอบจริง (Start)" },
    {
      type: "process",
      text: "1. เปิดห้องจัดอบรมจริงในระบบ\nดึงข้อมูลรอบอบรมจากแผนที่อนุมัติแล้ว ➔ ยืนยันวิทยากรจริงและห้องอบรม",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. เช็คชื่อผู้เข้าเรียน (Attendance Tracking)\nเช็คชื่อผ่านระบบหรือใบลงชื่อ ➔ บันทึกสถานะ: มาเรียน (Present) หรือ ขาดเรียน (Absent)",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "3. บันทึกค่าใช้จ่ายจริงที่เกิดขึ้น (6 หมวด)\n• ค่าวิทยากร, ค่าเดินทาง, ค่าที่พัก\n• ค่าอาหารและเครื่องดื่ม, ค่าอุปกรณ์การสอน, ค่าเช่าห้องสัมมนา",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "decision",
      text: "ค่าใช้จ่ายที่ใช้จริง\nเป็นไปตามงบประมาณไหม?",
      yesLabel: "อยู่ในงบ / มีงบคงเหลือ"
    },
    {
      type: "process",
      text: "4. บันทึกยอดส่วนต่างงบประมาณ (Variance)\nคำนวณยอดเงินคงเหลือเพื่อส่งไปยังแดชบอร์ดงบประมาณของผู้บริหาร",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "5. ส่งต่อผลการเข้าเรียนไปตรวจคะแนน\nส่งรายชื่อผู้เข้าเรียนครบตามชั่วโมงเข้าสู่ขั้นตอนประมวลผลคะแนนสอบ",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 4, // Decision: ค่าใช้จ่ายตามงบไหม?
      text: "เกินงบประมาณ (Over Budget):\nบันทึกเหตุผลความจำเป็นในการใช้จ่ายเกินงบ เพื่อเสนอขออนุมัติเพิ่มเติม",
      label: "เกินงบ",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// 13. Record - Training Record
builder.addStandardPage(
  "13. Record - Training Record",
  "Training Record: การตรวจข้อสอบ, ประวัติ และใบเซอร์",
  "ตรวจข้อสอบช้อยส์/ข้อเขียน, ตัดเกรดผ่าน/ไม่ผ่าน, สะสมชั่วโมงตามกฎหมาย, และออกใบเซอร์ดิจิทัล",
  [
    { type: "terminator", text: "เริ่มประมวลผลคะแนน (Start)" },
    {
      type: "decision",
      text: "รูปแบบข้อสอบ\nที่ผู้เรียนส่งเข้ามา?",
      yesLabel: "ข้อสอบช้อยส์ (ปรนัย)"
    },
    {
      type: "process",
      text: "1. ระบบตรวจข้อสอบช้อยส์อัตโนมัติ\nตรวจคำตอบเทียบกับเฉลยในคลังข้อสอบและคิดคะแนนให้ทันที",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "2. รวมคะแนนสอบและผลประเมินความพึงพอใจ\nคำนวณคะแนนก่อนเรียน vs หลังเรียน (% พัฒนาการ) ➔ รวมคะแนนและตัดเกรด ผ่าน/ไม่ผ่าน",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "decision",
      text: "คะแนนและเวลาเรียน\nผ่านเกณฑ์ที่กำหนดไหม?",
      yesLabel: "ผ่านเกณฑ์ (Pass)"
    },
    {
      type: "process",
      text: "3. ปิดรับคำตอบและล็อกผลคะแนน\nล็อกการแก้ไขคะแนน เพื่อยืนยันความถูกต้องของผลการฝึกอบรมอย่างเป็นทางการ",
      style: STYLES.slate,
      edgeColor: "#64748b"
    },
    {
      type: "process",
      text: "4. บันทึกลงประวัติการอบรมพนักงาน\nสะสมชั่วโมงอบรมตลอดอายุงานเพื่อยื่นกรมพัฒนาฝีมือแรงงาน",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "document",
      text: "ออกใบประกาศนียบัตรดิจิทัล (Certificate)\nสร้างและจัดเก็บไฟล์ใบประกาศฯ ให้พนักงานดาวน์โหลดผ่านหน้าประวัติส่วนตัว",
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 1, // Decision: รูปแบบข้อสอบ
      text: "ข้อเขียน / อัตนัย:\nส่งเข้าหน้าจอให้อาจารย์ผู้สอนหรือผู้ประเมินตรวจและให้คะแนน",
      label: "ข้อเขียน (อัตนัย)",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      fromItemIndex: 4, // Decision: ผ่านเกณฑ์ไหม?
      text: "ไม่ผ่านเกณฑ์ (Fail):\nบันทึกสถานะไม่ผ่านในประวัติ ➔ รอจัดรอบสอบซ่อมหรืออบรมใหม่",
      label: "ไม่ผ่านเกณฑ์",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// ====================================================================================
// หมวดที่ 5: Report Management
// ====================================================================================

// 14. Report - ภาพรวมการทำงาน
builder.addStandardPage(
  "14. Report - ภาพรวมการทำงาน",
  "ระบบรายงาน: ภาพรวมการสรุปผลและรายงานผู้บริหาร",
  "รวบรวมข้อมูลการเงิน, การเข้าเรียน, และผลการอบรม ➔ แสดงผลบนแดชบอร์ด, ปฏิทิน, และส่งออก Excel",
  [
    { type: "terminator", text: "เริ่มต้น (Start)" },
    {
      type: "process",
      text: "1. ดึงข้อมูลจริงจากระบบการฝึกอบรม\nรวบรวมข้อมูลแผนอบรม, การลงทะเบียน, การเช็คชื่อ, และค่าใช้จ่ายจริงที่เกิดขึ้น",
      style: STYLES.slate,
      edgeColor: "#64748b"
    },
    {
      type: "process",
      text: "2. สรุปผลการเงินและงบประมาณ (Summary Dashboard)\nสรุปงบตามแผน vs ใช้จริง vs ยอดคงเหลือ และเปรียบเทียบงบส่วนกลาง vs งบโรงงาน",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "process",
      text: "3. แสดงปฏิทินตารางอบรมทั้งปี (Schedule Calendar)\nปฏิทินแยกสีตามบริษัท (ATA, TEP, etc.), แสดงคอร์สที่จัดหลายวัน, และดูที่นั่งว่าง",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "4. รายงานกิจกรรมพิเศษนอกแผน (New Activities Report)\nรวบรวมสถิติเวิร์กชอปด่วนและกิจกรรมเพื่อสังคม (CSR) ของทุกบริษัทในเครือ",
      style: STYLES.rose,
      edgeColor: "#e11d48"
    },
    {
      type: "document",
      text: "ชุดเอกสารรายงานทางการ (Excel Workbooks)\n• ใบเช็คชื่อผู้เข้าเรียน (Attendance Sheet)\n• โครงสร้างหลักสูตร (Course Outline)\n• สรุปผลการประเมินความพึงพอใจ (Evaluation Summary)"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ]
);

// 15. Report - Summary Dashboard
builder.addStandardPage(
  "15. Report - Summary Dashboard",
  "Summary Dashboard: แดชบอร์ดสรุปงบประมาณและตัวชี้วัด",
  "เปรียบเทียบงบตามแผน vs ใช้จริง, แยกงบส่วนกลาง vs โรงงาน, และดูอัตราเข้าเรียน/สอบผ่าน",
  [
    { type: "terminator", text: "เริ่มประมวลผลแดชบอร์ด (Start)" },
    {
      type: "process",
      text: "1. คำนวณสรุปผลการเงินและงบประมาณ\nงบประมาณตามแผน (Planned) vs ค่าใช้จ่ายจริง (Actual) vs ยอดเงินคงเหลือ/เกิน (Variance)",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "process",
      text: "2. แยกตามแหล่งที่มาของงบประมาณ\nแยกคอร์สที่ส่วนกลางสนับสนุนงบ และคอร์สที่แต่ละโรงงาน (ATA, TEP, etc.) จ่ายเอง",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "3. คำนวณตัวชี้วัดความสำเร็จของการอบรม (KPIs)\n• อัตราการเข้าเรียนจริง (% Attendance) จากยอดผู้สมัครทั้งหมด\n• อัตราการสอบผ่าน (% Pass Rate)\n• จำนวนชั่วโมงอบรมเฉลี่ยต่อคนต่อปี",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "decision",
      text: "ต้องการพิมพ์หรือ\nส่งออกรายงานเป็นไฟล์?",
      yesLabel: "ส่งออกไฟล์ Excel"
    },
    {
      type: "document",
      text: "สร้างไฟล์สรุปงบประมาณและ KPI (Excel Report)\nสำหรับพิมพ์หรือแนบนำเสนอผู้บริหารในการประชุมทบทวนผลงาน",
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 4, // Decision: ส่งออกไฟล์ไหม?
      text: "ดูบนหน้าจอระบบ:\nเปิดดูตัวเลข กราฟ และตารางสรุปผ่านหน้าแดชบอร์ดได้ทันที",
      label: "ดูบนหน้าจอ",
      style: STYLES.slate,
      edgeColor: "#64748b"
    }
  ]
);

// 16. Report - Schedule Calendar
builder.addStandardPage(
  "16. Report - Schedule Calendar",
  "Schedule Calendar: ปฏิทินตารางการฝึกอบรมตลอดทั้งปี",
  "แสดงปฏิทินแยกสีตามบริษัท, แสดงแถบยาวตามจำนวนวันที่จัดจริง, และดูจำนวนที่นั่งว่าง",
  [
    { type: "terminator", text: "เริ่มแสดงผลปฏิทิน (Start)" },
    {
      type: "process",
      text: "1. ดึงข้อมูลตารางอบรมจากแผนรายเดือน\nดึงเฉพาะรอบอบรมที่ได้รับการอนุมัติแล้ว พร้อมวันเริ่มและวันสิ้นสุด",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. แสดงแถบสีแยกตามบริษัทชัดเจน\n• ส่วนกลาง: สีกลาง / ATA: สีกรมท่า / TEP: สีฟ้า\n• ATFB: สีส้ม / NIC: สีม่วง / SATI: สีเขียว / SNF: สีชมพู",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "3. แสดงแถบปฏิทินตามจำนวนวันที่จัดจริง\nหากเป็นคอร์สที่จัดต่อเนื่องหลายวัน ระบบจะลากแถบยาวข้ามวันให้เห็นชัดเจน",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "4. แสดงสถานะและที่นั่งคงเหลือ [สมัครแล้ว / ที่นั่งทั้งหมด]\nแสดงว่าเปิดรับสมัครอยู่หรือเสร็จสิ้นแล้ว พร้อมระบุจำนวนที่นั่งที่ยังว่าง",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "decision",
      text: "ผู้ใช้คลิกเลือก\nดูรายละเอียดคอร์ส?",
      yesLabel: "คลิกดูข้อมูล"
    },
    {
      type: "process",
      text: "5. แสดงหน้าต่างรายละเอียดคอร์สอบรม\nดูวัน-เวลา, ห้องอบรม, วิทยากร, วัตถุประสงค์ และกดปุ่มลัดไปยังหน้าสมัครได้",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 5, // Decision: คลิกดูข้อมูลไหม?
      text: "ดูภาพรวมปฏิทิน:\nเลื่อนดูตารางเดือนอื่นๆ หรือสลับไปดูมุมมองทั้งปี",
      label: "ดูภาพรวม",
      style: STYLES.slate,
      edgeColor: "#64748b"
    }
  ]
);

// 17. Report - New Activities
builder.addStandardPage(
  "17. Report - New Activities",
  "New Activities: รายงานกิจกรรมและเวิร์กชอปพิเศษนอกแผน",
  "บันทึกกิจกรรมด่วน, ภาพถ่ายกิจกรรม, และรวบรวมสถิติเข้าสู่รายงานกิจกรรมใหม่",
  [
    { type: "terminator", text: "เริ่มบันทึกกิจกรรมพิเศษ (Start)" },
    {
      type: "process",
      text: "1. กรอกข้อมูลกิจกรรมใหม่นอกแผนประจำปี\nระบุชื่อกิจกรรม (ไทย/อังกฤษ), วันที่จัด, สถานที่, และบริษัทผู้จัด (ส่วนกลางหรือโรงงาน)",
      style: STYLES.rose,
      edgeColor: "#e11d48"
    },
    {
      type: "process",
      text: "2. ระบุประเภทกิจกรรมและงบประมาณ\nหมวดหมู่: ความปลอดภัย, งานเทคนิค, กิจกรรม CSR, หรือการบริหารจัดการ พร้อมงบประมาณ",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "3. ระบุกลุ่มเป้าหมายและบันทึกจำนวนคนเข้าร่วม\nระบุฝ่าย/แผนกเป้าหมาย และบันทึกจำนวนพนักงานที่เข้าร่วมกิจกรรมจริง",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "4. บันทึกผลที่ได้รับและอัปโหลดรูปภาพกิจกรรม\nสรุปผลสำเร็จของกิจกรรม อัปโหลดภาพถ่าย และแนบเอกสารใบลงชื่อเข้าสู่ระบบ",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "document",
      text: "ส่งออกรายงานสรุปกิจกรรมพิเศษ (New Activities Report)\nแสดงผลบนหน้าแรกของระบบ และใช้เป็นเอกสารสรุปผลงานส่งผู้บริหาร",
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ]
);

// ====================================================================================
// หมวดที่ 6: Master Data Management
// ====================================================================================

// 18. Master Data - ภาพรวม Flow
builder.addStandardPage(
  "18. Master Data - ภาพรวม Flow",
  "ข้อมูลหลักองค์กร: โครงสร้างบริษัท สายงาน และบุคลากร",
  "ฐานข้อมูลองค์กร 6 บริษัท, สายงาน Function Mapping, วิทยากร, สถาบัน, และข้อมูลพนักงาน",
  [
    { type: "terminator", text: "เริ่มต้น (Start)" },
    {
      type: "process",
      text: "1. โครงสร้างองค์กร (Organization Hierarchy)\n• บริษัทในเครือ: ATA, TEP, ATFB, NIC, SATI, SNF\n• สายงาน (Function) และการจับคู่สายงานข้ามบริษัท\n• แผนก ➔ ส่วนงาน ➔ ตำแหน่ง ➔ ระดับพนักงาน (L1 - L9)",
      style: STYLES.slate,
      edgeColor: "#64748b"
    },
    {
      type: "process",
      text: "2. ฐานข้อมูลวิทยากรผู้สอน (Instructors Master)\nประวัติวิทยากรภายในและภายนอก, ความเชี่ยวชาญ, และอัตราค่าตอบแทน",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "3. ฐานข้อมูลสถาบันฝึกอบรม (Institute Providers Master)\nรายชื่อสถาบันภายนอก, ข้อมูลผู้ติดต่อ, และหลักสูตรที่ให้บริการ",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "4. ฐานข้อมูลกลุ่มและประเภทหลักสูตร\nแบ่งกลุ่มงานเทคนิค, ความปลอดภัย, การจัดการ, ภาษา และข้อกำหนดทางกฎหมาย",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "5. ฐานข้อมูลพนักงาน (Employee Master Data)\nรหัสพนักงาน, ชื่อ-นามสกุลไทย/อังกฤษ, แผนก, ระดับตำแหน่ง, และอีเมล",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "process",
      text: "6. ให้บริการข้อมูลแก่ทุกโมดูลในระบบ\nส่งต่อข้อมูลหลักเพื่อใช้ตรวจสอบสิทธิ์, วางแผนอบรม, และออกรายงานสรุปผล",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ]
);

// ====================================================================================
// หมวดที่ 7: Employee Workspace (ฝั่งพนักงานครบวงจร)
// ====================================================================================

// 19. Employee - ภาพรวม Flow ทั้งหมด
builder.addStandardPage(
  "19. Employee - ภาพรวม Flow",
  "มุมมองพนักงาน: ภาพรวมการใช้งานและขั้นตอนการเรียนรู้",
  "เส้นทางพนักงาน: ดู Roadmap ➔ สมัครคอร์ส ➔ ดูปฏิทิน ➔ เข้าเรียนและทำข้อสอบ ➔ รับใบเซอร์",
  [
    { type: "terminator", text: "พนักงานเข้าสู่ระบบ (Start)" },
    {
      type: "process",
      text: "1. เข้าสู่หน้าหลักพนักงาน (User Dashboard)\nดูสถานะการอบรมของตนเอง, คอร์สที่กำลังเปิดรับสมัคร, และข่าวสารกิจกรรม",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. ดูแผนผังการเรียนรู้ (Training Roadmap)\nดูเส้นทางการพัฒนาตนเองตามตำแหน่งงาน และคอร์สที่จำเป็นต้องเรียนตามระดับ",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "decision",
      text: "ต้องการสมัครคอร์สในแผน\nหรือยื่นขอเปิดคอร์สใหม่?",
      yesLabel: "สมัครคอร์สในแผน (Register)"
    },
    {
      type: "process",
      text: "3. สมัครเรียนในระบบ (Register Train)\nเลือกคอร์สที่เปิดรับสมัคร เช็คคุณสมบัติของตนเอง และกดยืนยันการสมัคร",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "4. ดูวันเวลาและห้องอบรมในปฏิทิน (Calendar Training)\nตรวจสอบนัดหมายคอร์สที่ตนเองได้รับการอนุมัติ วันที่ เวลา และห้องสัมมนา",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "5. เข้าอบรมจริง ทำข้อสอบ และทำแบบประเมิน\nเข้าเรียนตามเวลา ➔ ทำข้อสอบก่อนเรียน ➔ ทำข้อสอบหลังเรียน ➔ ตอบแบบประเมิน",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "document",
      text: "ดูประวัติใน My Record & ดาวน์โหลดใบประกาศนียบัตร\nดูชั่วโมงอบรมสะสม, ดูผลคะแนนสอบ, และดาวน์โหลดใบ Certificate เก็บไว้",
    },
    {
      type: "process",
      text: "6. ติดตามข่าวสารใน New Activities\nดูภาพบรรยากาศกิจกรรมการอบรม และร่วมกิจกรรมเพื่อสังคม (CSR)",
      style: STYLES.rose,
      edgeColor: "#e11d48"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 3, // Decision: ในแผนหรือขอใหม่?
      text: "ยื่นขอเปิดคอร์สใหม่ (Request Need):\nเสนอหลักสูตรพิเศษที่ไม่มีในแผน และส่งเรื่องให้หัวหน้างานอนุมัติ",
      label: "ขอเปิดคอร์สใหม่ (Need)",
      style: STYLES.amber,
      edgeColor: "#d97706"
    }
  ]
);

// 20. Employee - Register Train
builder.addStandardPage(
  "20. Employee - Register Train",
  "การสมัครเข้าอบรม: ค้นหาคอร์สและลงทะเบียนผ่านระบบ",
  "ค้นหาคอร์สที่เปิดรับ, ตรวจสอบคุณสมบัติและคอร์สต่อเนื่อง, ยื่นสมัคร, และติดตามผลอนุมัติ",
  [
    { type: "terminator", text: "เริ่มการสมัครอบรม (Start)" },
    {
      type: "process",
      text: "1. เข้าเมนู Register Train (สมัครฝึกอบรม)\nดูรายการหลักสูตรที่กำลังเปิดรับสมัครจากแผนการอบรมรายเดือน",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. เลือกคอร์สและอ่านรายละเอียด\nดูวันที่อบรม, เวลา, สถานที่, วิทยากร, วัตถุประสงค์, และจำนวนที่นั่งคงเหลือ",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "decision",
      text: "คุณสมบัติตรงตามเกณฑ์\nและผ่านคอร์สต่อเนื่องแล้วไหม?",
      yesLabel: "ตรงตามเกณฑ์สมบูรณ์"
    },
    {
      type: "process",
      text: "3. กดยืนยันการสมัครเรียนในระบบ\nบันทึกการสมัคร และส่งชื่อเข้าสู่ขั้นตอนการจัดสรรโควตาของ HRD",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      type: "decision",
      text: "HRD ตรวจสอบและ\nอนุมัติการเข้าเรียนไหม?",
      yesLabel: "อนุมัติแล้ว (Approved)"
    },
    {
      type: "process",
      text: "4. ได้รับสิทธิ์เข้าอบรมเรียบร้อย\nสถานะเปลี่ยนเป็น Registered พร้อมแสดงนัดหมายในปฏิทิน Calendar Training",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 3, // Decision: คุณสมบัติตรงไหม?
      text: "ไม่ตรงตามเกณฑ์:\nระบบแจ้งเตือนเงื่อนไขที่ยังขาด (เช่น ต้องผ่านคอร์สต่อเนื่องตัวก่อนหน้า หรือระดับตำแหน่งยังไม่ถึง)",
      label: "ไม่ผ่านเกณฑ์",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    },
    {
      fromItemIndex: 5, // Decision: HRD อนุมัติไหม?
      text: "ที่นั่งเต็ม / ไม่อนุมัติ:\nระบบปรับสถานะเป็นรอคิว (Waitlist) หรือไม่อนุมัติ พร้อมแจ้งเหตุผล",
      label: "ที่นั่งเต็ม/ไม่อนุมัติ",
      style: STYLES.slate,
      edgeColor: "#64748b"
    }
  ]
);

// 21. Employee - Training Roadmap
builder.addStandardPage(
  "21. Employee - Training Roadmap",
  "แผนผังการเรียนรู้: ตรวจสอบเส้นทางพัฒนาตนเองตามตำแหน่ง",
  "ดูคอร์สที่ต้องเรียนตามระดับงาน, เช็คคอร์สที่ผ่านแล้ว, และขอยื่นอบรมทบทวน (กรณีคอร์สหมดอายุ)",
  [
    { type: "terminator", text: "เริ่มดู Roadmap (Start)" },
    {
      type: "process",
      text: "1. เข้าเมนู Training Roadmap\nระบบดึงตำแหน่งงาน (Position) และระดับ (Level) ของพนักงานมาแสดงแผนผังการเรียนรู้",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "2. เลือกดูคอร์สตามขอบเขตที่ต้องการ\nเลือกดูคอร์สทั้งหมด (ALL), คอร์สส่วนกลาง (CENTER), หรือคอร์สเฉพาะบริษัทตนเอง (COMPANY)",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "process",
      text: "3. ตรวจสอบสถานะของแต่ละคอร์ส\n• เรียนผ่านแล้ว (Completed) พร้อมวันที่จบ\n• เปิดรับสมัครอยู่ (Available)\n• ยังไม่เปิดสอน หรือติดคอร์สต่อเนื่องตัวก่อนหน้า (Locked)",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "decision",
      text: "มีคอร์สที่ผ่านแล้ว\nแต่หมดอายุตามกำหนดไหม?",
      yesLabel: "คอร์สหมดอายุแล้ว"
    },
    {
      type: "process",
      text: "4. ยื่นขออบรมทบทวนความรู้ (Request Refresher)\nกดส่งคำขออบรมทบทวนเพื่อต่ออายุการรับรองความสามารถในตำแหน่งงาน",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 4, // Decision: หมดอายุไหม?
      text: "ยังไม่หมดอายุ / ยังเรียนไม่ครบ:\nคลิกเลือกคอร์สที่เปิดรับสมัครอยู่ เพื่อไปยังหน้า Register Train สมัครเข้าเรียน",
      label: "ยังไม่หมดอายุ",
      style: STYLES.green,
      edgeColor: "#16a34a"
    }
  ]
);

// 22. Employee - Request Need
builder.addStandardPage(
  "22. Employee - Request Need",
  "การขอเปิดคอร์สใหม่: ยื่นความต้องการอบรมและส่งหัวหน้าอนุมัติ",
  "ยื่นขอหลักสูตรที่ไม่มีในแผน ➔ กรอกเหตุผลความจำเป็น ➔ เลือกหัวหน้าอนุมัติ ➔ ส่งให้ HRD พิจารณา",
  [
    { type: "terminator", text: "เริ่มยื่นคำขอ (Start)" },
    {
      type: "process",
      text: "1. เข้าเมนู Request Training Need\nกดสร้างคำขอใหม่เพื่อเสนอหลักสูตรที่ตนเองหรือทีมต้องการเรียนรู้เพิ่มเติม",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "decision",
      text: "มีชื่อคอร์สในระบบ\nหรือเป็นหัวข้อใหม่?",
      yesLabel: "มีในระบบ (เลือกจากรายการ)"
    },
    {
      type: "process",
      text: "2. กรอกเหตุผลความจำเป็นในการอบรม\nระบุปัญหาหน้างาน หรือประโยชน์ที่จะนำมาพัฒนางานในฝ่าย",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "3. เลือกหัวหน้างานผู้อนุมัติ (Select Approver)\nค้นหาชื่อหัวหน้างาน (ระดับหัวหน้าส่วนขึ้นไป) เพื่อส่งเรื่องขอความเห็นชอบ",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "decision",
      text: "หัวหน้างานพิจารณา\nอนุมัติคำขอหรือไม่?",
      yesLabel: "หัวหน้าอนุมัติแล้ว"
    },
    {
      type: "process",
      text: "4. คำขอส่งต่อไปยัง HRD เพื่อพิจารณา\nHRD พิจารณาบรรจุเข้าสู่แผนฝึกอบรมประจำปีหรือรอบอบรมรายเดือนต่อไป",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 2, // Decision: มีชื่อคอร์สไหม?
      text: "เป็นหัวข้อใหม่นอกระบบ:\nพิมพ์ระบุหัวข้อเรื่องและเนื้อหาที่ต้องการอบรมด้วยตนเอง",
      label: "เป็นหัวข้อใหม่",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      fromItemIndex: 5, // Decision: หัวหน้าอนุมัติไหม?
      text: "หัวหน้าไม่อนุมัติ:\nคำขอถูกปฏิเสธ พร้อมแจ้งเหตุผลกลับไปยังพนักงาน",
      label: "ไม่อนุมัติ",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// 23. Employee - My Record
builder.addStandardPage(
  "23. Employee - My Record",
  "ประวัติการอบรม: ดูชั่วโมงสะสม คะแนนสอบ และดาวน์โหลดใบเซอร์",
  "ตรวจสอบชั่วโมงอบรมสะสม, ดูคะแนนสอบ Pre/Post และคำแนะนำ, ทำแบบประเมินคงค้าง, และโหลดใบเซอร์",
  [
    { type: "terminator", text: "เริ่มดูประวัติ (Start)" },
    {
      type: "process",
      text: "1. เข้าเมนู My Record (ประวัติการฝึกอบรมของฉัน)\nดูสรุปภาพรวม: ชั่วโมงอบรมสะสมตามกฎหมาย, จำนวนคอร์สที่จบ, และผลการเรียน",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "2. ดูผลคะแนนสอบและคำแนะนำจากอาจารย์\nเปิดดูคะแนนสอบก่อนเรียนและหลังเรียน พร้อมอ่าน Feedback ข้อคิดเห็นจากผู้ตรวจ",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "decision",
      text: "มีแบบประเมินที่\nยังทำไม่เสร็จค้างอยู่ไหม?",
      yesLabel: "มีแบบประเมินคงค้าง"
    },
    {
      type: "process",
      text: "3. กดทำแบบประเมินให้เรียบร้อย\nทำแบบประเมินความพึงพอใจ หรือแบบประเมินติดตามผลหลังเรียนจบ 30 วัน",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "decision",
      text: "สอบผ่านและเวลาเรียน\nครบตามเกณฑ์หลักสูตร?",
      yesLabel: "ผ่านเกณฑ์สมบูรณ์"
    },
    {
      type: "document",
      text: "ดาวน์โหลดใบประกาศนียบัตรดิจิทัล (Certificate)\nกดดาวน์โหลดไฟล์ใบประกาศฯ ในรูปแบบ PDF หรือรูปภาพ เพื่อเก็บเป็นหลักฐานวิชาชีพ",
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 3, // Decision: มีแบบประเมินค้างไหม?
      text: "ไม่มีแบบประเมินค้าง:\nข้ามไปตรวจสอบสถานะการรับใบประกาศนียบัตรได้ทันที",
      label: "ทำครบแล้ว",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    {
      fromItemIndex: 5, // Decision: ผ่านเกณฑ์ไหม?
      text: "ไม่ผ่านเกณฑ์ (Failed):\nแสดงสถานะไม่ผ่าน และไม่สามารถดาวน์โหลดใบเซอร์ได้ ต้องรออบรมซ่อม",
      label: "ไม่ผ่านเกณฑ์",
      style: STYLES.rose,
      edgeColor: "#dc2626"
    }
  ]
);

// 24. Employee - Calendar Training
builder.addStandardPage(
  "24. Employee - Calendar Training",
  "ปฏิทินการอบรม: ตรวจสอบตารางเรียนและนัดหมายส่วนบุคคล",
  "ดูตารางอบรมทั้งปี, สังเกตแถบสีบริษัท, ดูคอร์สที่ตนเองได้รับอนุมัติ, และดูห้องอบรม",
  [
    { type: "terminator", text: "เริ่มดูปฏิทิน (Start)" },
    {
      type: "process",
      text: "1. เข้าเมนู Calendar Training (ปฏิทินการอบรม)\nเปิดดูปฏิทินตารางการฝึกอบรม ทั้งมุมมองรายเดือนและมุมมองทั้งปี",
      style: STYLES.cyan,
      edgeColor: "#0891b2"
    },
    {
      type: "process",
      text: "2. ดูคอร์สของบริษัทและคอร์สที่ตนเองสมัคร\nสังเกตแถบสีของบริษัทตนเอง และมองหาคอร์สที่มีป้ายกำกับว่าได้รับการอนุมัติแล้ว",
      style: STYLES.purple,
      edgeColor: "#7c3aed"
    },
    {
      type: "decision",
      text: "คลิกเลือกดูรายละเอียด\nคอร์สอบรมบนปฏิทิน?",
      yesLabel: "คลิกดูข้อมูล"
    },
    {
      type: "process",
      text: "3. แสดงรายละเอียดนัดหมายการอบรม\nดูวันเริ่ม-สิ้นสุด, เวลาเรียน, ห้องสัมมนา, แผนที่สถานที่, และชื่อวิทยากรผู้สอน",
      style: STYLES.blue,
      edgeColor: "#2563eb"
    },
    {
      type: "process",
      text: "4. เตรียมตัวเข้าอบรมตามกำหนดการ\nอ่านคำแนะนำการเตรียมตัว และเตรียมพร้อมสำหรับการเข้าเรียนในวันจริง",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 3, // Decision: คลิกดูข้อมูลไหม?
      text: "ดูภาพรวมตารางเวลา:\nเช็คคิวงานและวันว่างเพื่อวางแผนการทำงานประจำวัน",
      label: "ดูภาพรวม",
      style: STYLES.slate,
      edgeColor: "#64748b"
    }
  ]
);

// 25. Employee - New Activities
builder.addStandardPage(
  "25. Employee - New Activities",
  "กิจกรรมและข่าวสาร: ติดตามภาพกิจกรรมและเวิร์กชอปพิเศษ",
  "ติดตามข่าวการอบรม, ภาพกิจกรรมในเครือ, กิจกรรมเพื่อสังคม (CSR), และสมัครร่วมกิจกรรม",
  [
    { type: "terminator", text: "เริ่มดูกิจกรรม (Start)" },
    {
      type: "process",
      text: "1. เข้าเมนู New Activities (กิจกรรมและข่าวสาร)\nเปิดดูฟีดข่าวสารการฝึกอบรม กิจกรรมเวิร์กชอป และกิจกรรมเพื่อสังคม (CSR) ของทุกบริษัท",
      style: STYLES.rose,
      edgeColor: "#e11d48"
    },
    {
      type: "process",
      text: "2. เปิดดูอัลบั้มภาพกิจกรรมการอบรม\nดูภาพบรรยากาศการเรียนรู้และการฝึกทักษะของเพื่อนพนักงานในแต่ละโรงงาน",
      style: STYLES.amber,
      edgeColor: "#d97706"
    },
    {
      type: "decision",
      text: "มีกิจกรรมพิเศษที่\nกำลังเปิดรับสมัครเข้าร่วม?",
      yesLabel: "มีกิจกรรมเปิดรับ"
    },
    {
      type: "process",
      text: "3. สมัครเข้าร่วมกิจกรรมพิเศษนอกแผน\nกรอกข้อมูลยืนยันความประสงค์เข้าร่วมกิจกรรมเวิร์กชอปหรือกิจกรรม CSR",
      style: STYLES.green,
      edgeColor: "#16a34a"
    },
    { type: "terminator", text: "สิ้นสุด (End)" }
  ],
  [
    {
      fromItemIndex: 3, // Decision: มีกิจกรรมเปิดรับไหม?
      text: "ดูกิจกรรมที่ผ่านไปแล้ว:\nรับชมประมวลภาพความประทับใจและผลสรุปความสำเร็จของกิจกรรม",
      label: "รับชมข่าวสาร",
      style: STYLES.slate,
      edgeColor: "#64748b"
    }
  ]
);

const xmlOutput = builder.toXml();
const targetPath = path.resolve("d:/TrainingPlan/ATTG_HRD_Detailed_Flowcharts.drawio");
fs.writeFileSync(targetPath, xmlOutput, "utf-8");
console.log("Successfully generated plain language 25-page system flowcharts:", targetPath);
