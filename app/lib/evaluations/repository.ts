import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type { AuthenticatedPrincipal } from "../auth/types";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type { EvaluationListFilters, EvaluationRecord, EvaluationWriteInput } from "./types";

const detailSelect = {
  evaluation_form_id: true,
  company_id: true,
  form_code: true,
  form_name: true,
  description: true,
  timing: true,
  respondent_type: true,
  is_anonymous: true,
  status: true,
  created_at: true,
  updated_at: true,
  company: { select: { company_code: true, company_name_th: true } },
  evaluation_question: {
    orderBy: { question_order: "asc" as const },
    select: {
      evaluation_question_id: true,
      question_order: true,
      question_text: true,
      question_type: true,
      section_name: true,
      is_required: true,
      evaluation_option: {
        orderBy: { option_order: "asc" as const },
        select: {
          evaluation_option_id: true,
          option_order: true,
          option_text: true,
          option_value: true,
        },
      },
    },
  },
} satisfies Prisma.evaluation_formSelect;

type DetailRow = Prisma.evaluation_formGetPayload<{ select: typeof detailSelect }>;
type StoredEvaluation = Omit<EvaluationRecord, "canModify" | "canDuplicate">;
type DatabaseClient = Pick<
  PrismaClient,
  "evaluation_form" | "evaluation_question" | "course" | "training_plan_oap" | "evaluation_submission" | "$transaction"
>;

const map = (row: DetailRow, isUsed: boolean): StoredEvaluation => ({
  evaluationFormId: row.evaluation_form_id.toString(),
  companyId: row.company_id?.toString() ?? null,
  companyCode: row.company?.company_code ?? null,
  companyName: row.company?.company_name_th ?? null,
  scope: row.company_id === null ? "CENTRAL" : "COMPANY",
  formCode: row.form_code,
  formName: row.form_name,
  description: row.description,
  timing: row.timing as EvaluationRecord["timing"],
  respondentType: row.respondent_type as EvaluationRecord["respondentType"],
  isAnonymous: row.is_anonymous,
  status: row.status as EvaluationRecord["status"],
  questions: row.evaluation_question.map((question) => ({
    evaluationQuestionId: question.evaluation_question_id.toString(),
    questionOrder: question.question_order,
    questionText: question.question_text,
    questionType: question.question_type as EvaluationRecord["questions"][number]["questionType"],
    sectionName: question.section_name,
    isRequired: question.is_required,
    options: question.evaluation_option.map((option) => ({
      evaluationOptionId: option.evaluation_option_id.toString(),
      optionOrder: option.option_order,
      optionText: option.option_text,
      optionValue: option.option_value?.toFixed(2) ?? null,
    })),
  })),
  isUsed,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at?.toISOString() ?? null,
});

const questionCreates = (input: EvaluationWriteInput) => input.questions.map((question, questionIndex) => ({
  question_order: questionIndex + 1,
  question_text: question.questionText,
  question_type: question.questionType,
  section_name: question.sectionName,
  is_required: question.isRequired,
  evaluation_option: {
    create: question.options.map((option, optionIndex) => ({
      option_order: optionIndex + 1,
      option_text: option.optionText,
      option_value: option.optionValue === null ? null : new Prisma.Decimal(option.optionValue),
    })),
  },
}));

const computeDefaultEvaluationCode = async (
  transaction: Prisma.TransactionClient,
  timing: string,
  companyId: bigint | null,
) => {
  const timingTag = timing === "AFTER_TRAINING" ? "EVL-AFTER" : timing === "FOLLOW_UP_30_DAYS" ? "EVL-30DAY" : "EVA";
  let prefix = timingTag;
  if (companyId) {
    const comp = await transaction.company.findUnique({
      where: { company_id: companyId },
      select: { company_code: true },
    });
    if (comp?.company_code) prefix = `${comp.company_code}-${timingTag}`;
  }
  const rows = await transaction.evaluation_form.findMany({
    where: { form_code: { startsWith: prefix } },
    select: { form_code: true },
  });
  let maxSeq = 0;
  for (const row of rows) {
    const match = row.form_code.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  }
  return `${prefix}-${String(maxSeq + 1).padStart(6, "0")}`;
};

export type EvaluationRepository = ReturnType<typeof createEvaluationRepository>;

export const createEvaluationRepository = (client?: DatabaseClient) => {
  const db = () => client ?? getPrismaClient();

  const isUsed = async (evaluationFormId: string) => {
    const id = BigInt(evaluationFormId);
    const [courseCount, oapCount, submissionCount] = await Promise.all([
      db().course.count({ where: { evaluation_form_id: id } }),
      db().training_plan_oap.count({ where: { evaluation_form_id: id } }),
      db().evaluation_submission.count({ where: { evaluation_form_id: id } }),
    ]);
    return courseCount + oapCount + submissionCount > 0;
  };

  const findDetail = async (evaluationFormId: string) => {
    const row = await db().evaluation_form.findUnique({
      where: { evaluation_form_id: BigInt(evaluationFormId) },
      select: detailSelect,
    });
    return row ? map(row, await isUsed(evaluationFormId)) : null;
  };

  return {
    async list(filters: EvaluationListFilters, principal: AuthenticatedPrincipal) {
      const constraints: Prisma.evaluation_formWhereInput[] = [];
      if (principal.role === "HRD_FACTORY") {
        constraints.push({ OR: [{ company_id: null }, { company_id: BigInt(principal.companyId!) }] });
      }
      if (filters.search) {
        constraints.push({ OR: [
          { form_code: { contains: filters.search } },
          { form_name: { contains: filters.search } },
          { company: { company_code: { contains: filters.search } } },
          { description: { contains: filters.search } },
        ] });
      }
      const where: Prisma.evaluation_formWhereInput = {
        ...(constraints.length ? { AND: constraints } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.timing ? { timing: filters.timing } : {}),
        ...(filters.respondentType ? { respondent_type: filters.respondentType } : {}),
      };
      return withDatabaseErrorMapping(async () => {
        const [rows, totalItems] = await Promise.all([
          db().evaluation_form.findMany({
            where,
            select: detailSelect,
            orderBy: { form_code: "asc" },
            skip: filters.skip,
            take: filters.take,
          }),
          db().evaluation_form.count({ where }),
        ]);
        const items = await Promise.all(rows.map(async (row) => map(row, await isUsed(row.evaluation_form_id.toString()))));
        return { items, totalItems };
      });
    },

    findById(evaluationFormId: string) {
      return withDatabaseErrorMapping(() => findDetail(evaluationFormId));
    },

    async create(input: EvaluationWriteInput, companyId: string | null, userId: string) {
      return withDatabaseErrorMapping(async () => {
        const created = await db().$transaction(async (transaction) => {
          const rawCode = input.formCode?.trim();
          const formCodeValue = rawCode && rawCode.toUpperCase() !== "AUTO"
            ? rawCode
            : await computeDefaultEvaluationCode(transaction, input.timing, companyId ? BigInt(companyId) : null);
          return transaction.evaluation_form.create({
            data: {
              company_id: companyId ? BigInt(companyId) : null,
              form_code: formCodeValue,
              form_name: input.formName,
              description: input.description,
              timing: input.timing,
              respondent_type: input.respondentType,
              is_anonymous: input.isAnonymous,
              status: input.status,
              created_by: BigInt(userId),
              created_at: new Date(),
              evaluation_question: { create: questionCreates(input) },
            },
            select: detailSelect,
          });
        });
        return map(created, false);
      });
    },

    /** Touches nothing but the status column, so it stays safe on a form already in use. */
    async setStatus(evaluationFormId: string, status: EvaluationRecord["status"]) {
      return withDatabaseErrorMapping(async () => {
        await db().evaluation_form.update({
          where: { evaluation_form_id: BigInt(evaluationFormId) },
          data: { status },
        });
        return findDetail(evaluationFormId);
      });
    },

    async update(current: StoredEvaluation, input: EvaluationWriteInput, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const updated = await db().$transaction(async (transaction) => {
          await transaction.evaluation_question.deleteMany({ where: { evaluation_form_id: BigInt(current.evaluationFormId) } });
          return transaction.evaluation_form.update({
            where: { evaluation_form_id: BigInt(current.evaluationFormId) },
            data: {
              company_id: companyId ? BigInt(companyId) : null,
              ...(input.formCode ? { form_code: input.formCode } : {}),
              form_name: input.formName,
              description: input.description,
              timing: input.timing,
              respondent_type: input.respondentType,
              is_anonymous: input.isAnonymous,
              status: input.status,
              updated_at: new Date(),
              evaluation_question: { create: questionCreates(input) },
            },
            select: detailSelect,
          });
        });
        return map(updated, false);
      });
    },

    async delete(current: StoredEvaluation) {
      return withDatabaseErrorMapping(async () => {
        await db().evaluation_form.delete({ where: { evaluation_form_id: BigInt(current.evaluationFormId) } });
        return current;
      });
    },
  };
};

export const evaluationRepository = createEvaluationRepository();
