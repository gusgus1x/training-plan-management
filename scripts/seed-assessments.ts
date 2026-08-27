import { getPrismaClient } from "../app/lib/database/prisma";

const prisma = getPrismaClient();

async function main() {
  console.log("🌱 Seeding Pre Test & Post Test sample assessments with Choice & Text questions...");

  const createdBy = BigInt(1);

  // 1. Create Pre Test (PRE-000001)
  const existingPre = await prisma.assessment_series.findFirst({
    where: { series_code: "PRE-000001" },
  });

  if (!existingPre) {
    const preSeries = await prisma.assessment_series.create({
      data: {
        company_id: null, // Central scope
        series_code: "PRE-000001",
        series_name: "Pre Test แบบทดสอบความรู้พื้นฐานความปลอดภัย",
        series_name_normalized: "pre test แบบทดสอบความรู้พื้นฐานความปลอดภัย",
        purpose: "PRE_TEST",
        last_version_no: 1,
        created_by: createdBy,
        created_at: new Date(),
      },
    });

    await prisma.assessment.create({
      data: {
        assessment_series_id: preSeries.assessment_series_id,
        version_no: 1,
        version_note: "Initial version",
        instructions: "กรุณาอ่านโจทย์และตอบคำถามทุกข้อก่อนเริ่มการอบรมหลักสูตรความปลอดภัย",
        passing_score_percent: 80.00,
        time_limit_minutes: 30,
        status: "ACTIVE",
        created_by: createdBy,
        created_at: new Date(),
        assessment_question: {
          create: [
            {
              question_order: 1,
              question_text: "ข้อใดคืออุปกรณ์ป้องกันอันตรายส่วนบุคคล (PPE) ที่จำเป็นต้องสวมใส่เมื่อเข้าพื้นที่ปฏิบัติงานปั๊มและกลึงโลหะ?",
              question_type: "SINGLE_CHOICE",
              question_score: 1.00,
              is_required: true,
              assessment_choice: {
                create: [
                  { choice_order: 1, choice_text: "หมวกนิรภัย (Hard Hat) และรองเท้าเซฟตี้ (Safety Shoes)", is_correct: true, option_score: 1.00 },
                  { choice_order: 2, choice_text: "รองเท้าผ้าใบและหมวกแก๊ปธรรมดา", is_correct: false, option_score: 0.00 },
                  { choice_order: 3, choice_text: "ถุงมือผ้าธรรมดาและรองเท้าแตะ", is_correct: false, option_score: 0.00 },
                  { choice_order: 4, choice_text: "แว่นตากันแดดและเสื้อแขนยาว", is_correct: false, option_score: 0.00 },
                ],
              },
            },
            {
              question_order: 2,
              question_text: "จงอธิบายขั้นตอนการระงับเหตุฉุกเฉินเบื้องต้นเมื่อพบสารเคมีรั่วไหลในพื้นที่ปฏิบัติงาน (บรรยายสั้น)",
              question_type: "SHORT_ANSWER",
              question_score: 2.00,
              is_required: true,
            },
          ],
        },
      },
    });
    console.log("✅ Created Pre Test (PRE-000001) successfully!");
  } else {
    console.log("ℹ️ Pre Test (PRE-000001) already exists in database.");
  }

  // 2. Create Post Test (POST-000001)
  const existingPost = await prisma.assessment_series.findFirst({
    where: { series_code: "POST-000001" },
  });

  if (!existingPost) {
    const postSeries = await prisma.assessment_series.create({
      data: {
        company_id: null, // Central scope
        series_code: "POST-000001",
        series_name: "Post Test แบบทดสอบประเมินผลการอบรมความปลอดภัย",
        series_name_normalized: "post test แบบทดสอบประเมินผลการอบรมความปลอดภัย",
        purpose: "POST_TEST",
        last_version_no: 1,
        created_by: createdBy,
        created_at: new Date(),
      },
    });

    await prisma.assessment.create({
      data: {
        assessment_series_id: postSeries.assessment_series_id,
        version_no: 1,
        version_note: "Initial version",
        instructions: "ทำแบบทดสอบเพื่อประเมินความรู้หลังผ่านการอบรม ต้องได้คะแนนไม่ต่ำกว่า 80% จึงจะผ่านเกณฑ์",
        passing_score_percent: 80.00,
        time_limit_minutes: 45,
        status: "ACTIVE",
        created_by: createdBy,
        created_at: new Date(),
        assessment_question: {
          create: [
            {
              question_order: 1,
              question_text: "หลักการ 5ส ในสถานที่ทำงาน ข้อใดหมายถึงการจัดวางสิ่งของให้เป็นระเบียบเรียบร้อย สะดวกในการหยิบใช้งาน?",
              question_type: "SINGLE_CHOICE",
              question_score: 1.00,
              is_required: true,
              assessment_choice: {
                create: [
                  { choice_order: 1, choice_text: "สะสาง (Seiri)", is_correct: false, option_score: 0.00 },
                  { choice_order: 2, choice_text: "สะดวก (Seiton)", is_correct: true, option_score: 1.00 },
                  { choice_order: 3, choice_text: "สะอาด (Seiso)", is_correct: false, option_score: 0.00 },
                  { choice_order: 4, choice_text: "สร้างนิสัย (Shitsuke)", is_correct: false, option_score: 0.00 },
                ],
              },
            },
            {
              question_order: 2,
              question_text: "จงระบุมาตรการในการป้องกันอุบัติเหตุจากการทำงานกับเครื่องจักรอย่างน้อย 3 ข้อ",
              question_type: "SHORT_ANSWER",
              question_score: 2.00,
              is_required: true,
            },
          ],
        },
      },
    });
    console.log("✅ Created Post Test (POST-000001) successfully!");
  } else {
    console.log("ℹ️ Post Test (POST-000001) already exists in database.");
  }
}

main()
  .catch((e) => {
    console.error("❌ Error seeding assessments:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
