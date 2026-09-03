import type { AuthenticatedPrincipal } from "../auth/types";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  AssessmentListFilters,
  AssessmentPurpose,
  AssessmentRecord,
  AssessmentWriteInput,
} from "./types";

const detailSelect = {
  assessment_id: true,
  assessment_code: true,
  version_no: true,
  version_note: true,
  instructions: true,
  passing_score_percent: true,
  time_limit_minutes: true,
  status: true,
  created_at: true,
  updated_at: true,
  assessment_series: {
    select: {
      assessment_series_id: true,
      company_id: true,
      series_code: true,
      series_name: true,
      purpose: true,
      company: { select: { company_code: true, company_name_th: true } },
    },
  },
  assessment_question: {
    orderBy: { question_order: "asc" as const },
    select: {
      question_id: true,
      question_order: true,
      question_text: true,
      question_type: true,
      question_score: true,
      is_required: true,
      assessment_choice: {
        orderBy: { choice_order: "asc" as const },
        select: {
          choice_id: true,
          choice_order: true,
          choice_text: true,
          is_correct: true,
          option_score: true,
        },
      },
    },
  },
} satisfies Prisma.assessmentSelect;

type DetailRow = Prisma.assessmentGetPayload<{ select: typeof detailSelect }>;
type DatabaseClient = Pick<
  PrismaClient,
  | "assessment"
  | "assessment_series"
  | "assessment_question"
  | "course"
  | "training_plan_oap"
  | "assessment_submission"
  | "$transaction"
>;

export const normalizeAssessmentName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const questionCreates = (input: AssessmentWriteInput) =>
  input.questions.map((question, questionIndex) => ({
    question_order: questionIndex + 1,
    question_text: question.questionText,
    question_type: question.questionType,
    question_score: new Prisma.Decimal(question.questionScore),
    is_required: question.isRequired,
    assessment_choice: {
      create: question.choices.map((choice, choiceIndex) => ({
        choice_order: choiceIndex + 1,
        choice_text: choice.choiceText,
        is_correct: choice.isCorrect,
        option_score: new Prisma.Decimal(choice.optionScore),
      })),
    },
  }));

type StoredAssessmentRecord = Omit<AssessmentRecord, "canModify" | "canCreateVersion">;

const map = (row: DetailRow, isUsed: boolean): StoredAssessmentRecord => ({
  assessmentId: row.assessment_id.toString(),
  assessmentSeriesId: row.assessment_series.assessment_series_id.toString(),
  companyId: row.assessment_series.company_id?.toString() ?? null,
  companyCode: row.assessment_series.company?.company_code ?? null,
  companyName: row.assessment_series.company?.company_name_th ?? null,
  scope: row.assessment_series.company_id === null ? "CENTRAL" : "COMPANY",
  seriesCode: row.assessment_code || row.assessment_series.series_code,
  seriesName: row.assessment_series.series_name,
  purpose: row.assessment_series.purpose as AssessmentRecord["purpose"],
  versionNo: row.version_no,
  versionNote: row.version_note,
  instructions: row.instructions,
  passingScorePercent: row.passing_score_percent.toFixed(2),
  timeLimitMinutes: row.time_limit_minutes,
  status: row.status as AssessmentRecord["status"],
  questions: row.assessment_question.map((question) => ({
    questionId: question.question_id.toString(),
    questionOrder: question.question_order,
    questionText: question.question_text,
    questionType: question.question_type as AssessmentRecord["questions"][number]["questionType"],
    questionScore: question.question_score.toFixed(2),
    isRequired: question.is_required,
    choices: question.assessment_choice.map((choice) => ({
      choiceId: choice.choice_id.toString(),
      choiceOrder: choice.choice_order,
      choiceText: choice.choice_text,
      isCorrect: choice.is_correct,
      optionScore: choice.option_score.toFixed(2),
    })),
  })),
  isUsed,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at?.toISOString() ?? null,
});

const computeDefaultAssessmentCode = async (
  transaction: Prisma.TransactionClient,
  purpose: AssessmentPurpose,
  companyId: bigint | null,
) => {
  const purposeTag = purpose === "PRE_TEST" ? "PRE" : purpose === "POST_TEST" ? "POST" : "ASM";
  let prefix = purposeTag;
  if (companyId) {
    const comp = await transaction.company.findUnique({
      where: { company_id: companyId },
      select: { company_code: true },
    });
    if (comp?.company_code) prefix = `${comp.company_code}-${purposeTag}`;
  }
  const rows = await transaction.assessment_series.findMany({
    where: { series_code: { startsWith: prefix } },
    select: { series_code: true },
  });
  let maxSeq = 0;
  for (const row of rows) {
    const match = row.series_code.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  }
  return `${prefix}-${String(maxSeq + 1).padStart(6, "0")}`;
};

export type AssessmentRepository = ReturnType<typeof createAssessmentRepository>;

export const createAssessmentRepository = (client?: DatabaseClient) => {
  const db = () => client ?? getPrismaClient();

  const isUsed = async (assessmentId: string) => {
    const id = BigInt(assessmentId);
    const [courseCount, oapCount, submissionCount] = await Promise.all([
      db().course.count({ where: { OR: [{ pre_assessment_id: id }, { post_assessment_id: id }] } }),
      db().training_plan_oap.count({ where: { OR: [{ pre_assessment_id: id }, { post_assessment_id: id }] } }),
      db().assessment_submission.count({ where: { assessment_id: id } }),
    ]);
    return courseCount + oapCount + submissionCount > 0;
  };

  const findDetail = async (assessmentId: string) => {
    const row = await db().assessment.findUnique({
      where: { assessment_id: BigInt(assessmentId) },
      select: detailSelect,
    });
    return row ? map(row, await isUsed(assessmentId)) : null;
  };

  return {
    async list(filters: AssessmentListFilters, principalOrCompanyId: AuthenticatedPrincipal | string | null | Record<string, unknown>) {
      const constraints: Prisma.assessment_seriesWhereInput[] = [];
      const isPrincipal = typeof principalOrCompanyId === "object" && principalOrCompanyId !== null && "role" in principalOrCompanyId;
      const role = isPrincipal ? (principalOrCompanyId as AuthenticatedPrincipal).role : null;
      const companyId = isPrincipal
        ? (principalOrCompanyId as AuthenticatedPrincipal).companyId
        : typeof principalOrCompanyId === "object" && principalOrCompanyId !== null && "companyId" in principalOrCompanyId
          ? (principalOrCompanyId as any).companyId
          : typeof principalOrCompanyId === "string"
            ? principalOrCompanyId
            : null;

      if (role === "HRD_FACTORY") {
        constraints.push({ OR: [{ company_id: null }, { company_id: companyId ? BigInt(companyId) : null }] });
      } else if (companyId) {
        constraints.push({ company_id: BigInt(companyId) });
      }

      if (filters.search) {
        constraints.push({
          OR: [
            { series_code: { contains: filters.search } },
            { series_name: { contains: filters.search } },
            { company: { company_code: { contains: filters.search } } },
          ],
        });
      }

      const where: Prisma.assessment_seriesWhereInput = {
        ...(constraints.length ? { AND: constraints } : {}),
        ...(filters.purpose ? { purpose: filters.purpose } : {}),
      };

      return withDatabaseErrorMapping(async () => {
        const seriesRows = await db().assessment_series.findMany({
          where,
          select: {
            assessment: { orderBy: { version_no: "desc" }, take: 1, select: detailSelect },
          },
          orderBy: { series_code: "asc" },
        });

        const latestRows = seriesRows.flatMap((series) => series.assessment);
        const filteredRows = filters.status
          ? latestRows.filter((row) => row.status === filters.status)
          : latestRows;
        const totalItems = filteredRows.length;
        const rows = filteredRows.slice(filters.skip, filters.skip + filters.take);

        const items = await Promise.all(rows.map(async (row) => map(row, await isUsed(row.assessment_id.toString()))));
        return { items, totalItems };
      });
    },

    findById(assessmentId: string) {
      return withDatabaseErrorMapping(() => findDetail(assessmentId));
    },

    async findConflict(seriesCode: string, normalizedName: string, excludeSeriesId?: string) {
      return withDatabaseErrorMapping(() => db().assessment_series.findFirst({
        where: {
          OR: [{ series_code: seriesCode }, { series_name_normalized: normalizedName }],
          ...(excludeSeriesId ? { NOT: { assessment_series_id: BigInt(excludeSeriesId) } } : {}),
        },
        select: { assessment_series_id: true },
      }));
    },

    async create(input: AssessmentWriteInput, companyId: string | null, userId: string) {
      return withDatabaseErrorMapping(async () => {
        const created = await db().$transaction(async (transaction) => {
          const rawCode = input.seriesCode.trim();
          const seriesCodeValue = rawCode && rawCode.toUpperCase() !== "AUTO"
            ? rawCode
            : await computeDefaultAssessmentCode(transaction, input.purpose, companyId ? BigInt(companyId) : null);
          const series = await transaction.assessment_series.create({
            data: {
              company_id: companyId ? BigInt(companyId) : null,
              series_code: seriesCodeValue,
              series_name: input.seriesName,
              series_name_normalized: normalizeAssessmentName(input.seriesName),
              purpose: input.purpose,
              last_version_no: 1,
              created_by: BigInt(userId),
              created_at: new Date(),
            },
            select: { assessment_series_id: true },
          });
          return transaction.assessment.create({
            data: {
              assessment_series_id: series.assessment_series_id,
              assessment_code: seriesCodeValue,
              version_no: 1,
              version_note: input.versionNote,
              instructions: input.instructions,
              passing_score_percent: new Prisma.Decimal(input.passingScorePercent),
              time_limit_minutes: input.timeLimitMinutes,
              status: input.status,
              created_by: BigInt(userId),
              created_at: new Date(),
              assessment_question: { create: questionCreates(input) },
            },
            select: detailSelect,
          });
        });
        return map(created, false);
      });
    },

    /** Touches nothing but the status column, so it stays safe on an assessment already in use. */
    async setStatus(assessmentId: string, status: AssessmentRecord["status"], userId: string) {
      return withDatabaseErrorMapping(async () => {
        await db().assessment.update({
          where: { assessment_id: BigInt(assessmentId) },
          data: { status, updated_by: BigInt(userId), updated_at: new Date() },
        });
        return findDetail(assessmentId);
      });
    },

    async update(current: StoredAssessmentRecord, input: AssessmentWriteInput, companyId: string | null, userId: string) {
      return withDatabaseErrorMapping(async () => {
        const updated = await db().$transaction(async (transaction) => {
          await transaction.assessment_question.deleteMany({ where: { assessment_id: BigInt(current.assessmentId) } });
          await transaction.assessment_series.update({
            where: { assessment_series_id: BigInt(current.assessmentSeriesId) },
            data: {
              company_id: companyId ? BigInt(companyId) : null,
              series_code: input.seriesCode,
              series_name: input.seriesName,
              series_name_normalized: normalizeAssessmentName(input.seriesName),
              purpose: input.purpose,
              updated_by: BigInt(userId),
              updated_at: new Date(),
            },
          });
          return transaction.assessment.update({
            where: { assessment_id: BigInt(current.assessmentId) },
            data: {
              assessment_code: input.seriesCode,
              version_note: input.versionNote,
              instructions: input.instructions,
              passing_score_percent: new Prisma.Decimal(input.passingScorePercent),
              time_limit_minutes: input.timeLimitMinutes,
              status: input.status,
              updated_by: BigInt(userId),
              updated_at: new Date(),
              assessment_question: { create: questionCreates(input) },
            },
            select: detailSelect,
          });
        });
        return map(updated, false);
      });
    },

    async createVersion(current: StoredAssessmentRecord, input: AssessmentWriteInput, userId: string) {
      return withDatabaseErrorMapping(async () => {
        const created = await db().$transaction(async (transaction) => {
          const series = await transaction.assessment_series.update({
            where: { assessment_series_id: BigInt(current.assessmentSeriesId) },
            data: { last_version_no: { increment: 1 }, updated_by: BigInt(userId), updated_at: new Date() },
            select: { last_version_no: true },
          });
          return transaction.assessment.create({
            data: {
              assessment_series_id: BigInt(current.assessmentSeriesId),
              assessment_code: input.seriesCode,
              version_no: series.last_version_no,
              version_note: input.versionNote,
              instructions: input.instructions,
              passing_score_percent: new Prisma.Decimal(input.passingScorePercent),
              time_limit_minutes: input.timeLimitMinutes,
              status: "DRAFT",
              created_by: BigInt(userId),
              created_at: new Date(),
              assessment_question: { create: questionCreates(input) },
            },
            select: detailSelect,
          });
        });
        return map(created, false);
      });
    },

    async isLatest(assessmentSeriesId: string, assessmentId: string) {
      const latest = await db().assessment.findFirst({
        where: { assessment_series_id: BigInt(assessmentSeriesId) },
        orderBy: { version_no: "desc" },
        select: { assessment_id: true },
      });
      return latest?.assessment_id === BigInt(assessmentId);
    },

    async delete(current: StoredAssessmentRecord) {
      return withDatabaseErrorMapping(async () => {
        await db().$transaction(async (transaction) => {
          await transaction.assessment.delete({ where: { assessment_id: BigInt(current.assessmentId) } });
          const remaining = await transaction.assessment.count({ where: { assessment_series_id: BigInt(current.assessmentSeriesId) } });
          if (!remaining) await transaction.assessment_series.delete({ where: { assessment_series_id: BigInt(current.assessmentSeriesId) } });
        });
        return current;
      });
    },
  };
};

export const assessmentRepository = createAssessmentRepository();
