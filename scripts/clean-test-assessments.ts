import { getPrismaClient } from "../app/lib/database/prisma";

const prisma = getPrismaClient();

async function main() {
  console.log("🧹 Cleaning test assessments (PRE-000001 & POST-000001)...");

  const preSeries = await prisma.assessment_series.findFirst({
    where: { series_code: "PRE-000001" },
    select: { assessment_series_id: true },
  });

  if (preSeries) {
    await prisma.assessment_series.delete({
      where: { assessment_series_id: preSeries.assessment_series_id },
    });
    console.log("🗑️ Deleted test assessment PRE-000001 successfully.");
  }

  const postSeries = await prisma.assessment_series.findFirst({
    where: { series_code: "POST-000001" },
    select: { assessment_series_id: true },
  });

  if (postSeries) {
    await prisma.assessment_series.delete({
      where: { assessment_series_id: postSeries.assessment_series_id },
    });
    console.log("🗑️ Deleted test assessment POST-000001 successfully.");
  }

  console.log("✨ Test assessment cleanup complete.");
}

main()
  .catch((e) => {
    console.error("❌ Error cleaning test assessments:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
