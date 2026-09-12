import { notFound } from "next/navigation";
import FormBuilder from "../../../components/forms/FormBuilder";
import type { FormKind } from "../../../components/forms/formDraft";

const KINDS: FormKind[] = ["assessment", "evaluation"];

/** `/forms/assessment/new` to start one, `/forms/assessment/123` to carry on with one. */
export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ kind: string; formId: string }>;
}) {
  const { kind, formId } = await params;
  if (!KINDS.includes(kind as FormKind)) notFound();
  return <FormBuilder kind={kind as FormKind} formId={formId} />;
}
