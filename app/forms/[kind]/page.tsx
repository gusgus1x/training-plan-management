import { notFound } from "next/navigation";
import FormGallery, { type FormKind } from "../../components/forms/FormGallery";

const KINDS: FormKind[] = ["assessment", "evaluation"];

/** `/forms/assessment` and `/forms/evaluation`. Anything else is not a kind of form. */
export default async function FormGalleryPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.includes(kind as FormKind)) notFound();
  return <FormGallery kind={kind as FormKind} />;
}
