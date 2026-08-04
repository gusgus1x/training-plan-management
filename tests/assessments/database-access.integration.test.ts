import { config as loadEnvironment } from "dotenv";
import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { createListAssessmentsHandler } from "../../app/api/training-course/assessments/route";
import { createSessionToken } from "../../app/lib/auth/session";

const run = process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

run("creates, reads, updates, and deletes an Assessment through the least-privilege app login", async () => {
  loadEnvironment({ path: ".env.local", quiet: true });
  const [{ createAssessmentRepository }, { getPrismaClient, resetPrismaClient }] = await Promise.all([
    import("../../app/lib/assessments/repository"),
    import("../../app/lib/database/prisma"),
  ]);
  const prisma = getPrismaClient();
  const account = await prisma.user_account.findFirst({
    where: { status: "ACTIVE", role: { role_code: "HRD_CENTER", status: "ACTIVE" } },
    select: { user_id: true },
  });
  expect(account).not.toBeNull();
  if (!account) return;

  const repository = createAssessmentRepository();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-12);
  let created: Awaited<ReturnType<typeof repository.create>> | null = null;
  let second: Awaited<ReturnType<typeof repository.create>> | null = null;
  try {
    created = await repository.create({
      scope: "CENTRAL",
      companyId: null,
      seriesCode: "IGNORED",
      seriesName: `Assessment permission test ${suffix}`,
      purpose: "GENERAL",
      versionNote: "Temporary integration test",
      instructions: null,
      passingScorePercent: "80.00",
      timeLimitMinutes: null,
      status: "DRAFT",
      questions: [{
        questionText: "Temporary integration question",
        questionType: "SINGLE_CHOICE",
        questionScore: "1.00",
        isRequired: true,
        choices: [
          { choiceText: "Correct", isCorrect: true, optionScore: "1.00" },
          { choiceText: "Incorrect", isCorrect: false, optionScore: "0.00" },
        ],
      }],
    }, null, account.user_id.toString());

    expect(await repository.findById(created.assessmentId)).toMatchObject({
      assessmentId: created.assessmentId,
      seriesCode: created.seriesCode,
      questions: [{ choices: [{ choiceText: "Correct" }, { choiceText: "Incorrect" }] }],
    });
    expect(created.seriesCode).toMatch(/^ASM-\d{3,}$/);

    second = await repository.create({
      scope: "CENTRAL",
      companyId: null,
      seriesCode: "ALSO-IGNORED",
      seriesName: `Assessment sequence test ${suffix}`,
      purpose: "GENERAL",
      versionNote: null,
      instructions: null,
      passingScorePercent: "80.00",
      timeLimitMinutes: null,
      status: "DRAFT",
      questions: [],
    }, null, account.user_id.toString());
    const firstNumber = Number(created.seriesCode.slice(4));
    const secondNumber = Number(second.seriesCode.slice(4));
    expect(secondNumber).toBe(firstNumber + 1);

    const listResponse = await createListAssessmentsHandler()(
      new NextRequest("http://localhost/api/training-course/assessments?page=1&pageSize=100", {
        headers: { cookie: `tpm_session=${createSessionToken(account.user_id.toString())}` },
      }),
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json() as { data?: { items?: Array<{ assessmentId: string }> } };
    expect(listBody.data?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ assessmentId: created.assessmentId }),
      expect.objectContaining({ assessmentId: second.assessmentId }),
    ]));

    const updated = await repository.update(created, {
      scope: "CENTRAL",
      companyId: null,
      seriesCode: created.seriesCode,
      seriesName: created.seriesName,
      purpose: "GENERAL",
      versionNote: "Updated integration test",
      instructions: null,
      passingScorePercent: "75.00",
      timeLimitMinutes: null,
      status: "DRAFT",
      questions: [{
        questionText: "Updated temporary integration question",
        questionType: "TRUE_FALSE",
        questionScore: "2.00",
        isRequired: true,
        choices: [
          { choiceText: "True", isCorrect: true, optionScore: "2.00" },
          { choiceText: "False", isCorrect: false, optionScore: "0.00" },
        ],
      }],
    }, null, account.user_id.toString());
    expect(updated.passingScorePercent).toBe("75.00");
    expect(updated.questions[0]).toMatchObject({ questionType: "TRUE_FALSE" });
    expect(updated.questions[0]?.choices[0]).toMatchObject({ choiceText: "True" });

    await repository.delete(second);
    second = null;
    await repository.delete(updated);
    created = null;
  } finally {
    if (created) await repository.delete(created).catch(() => undefined);
    if (second) await repository.delete(second).catch(() => undefined);
    await resetPrismaClient();
  }
}, 30_000);
