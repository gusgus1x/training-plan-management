import EmployeeWorkspace from "../../components/employee/EmployeeWorkspace";

/** /employee/<module>[/<tab>]: each employee screen with its own address, like HRD's sections. */
export default async function EmployeePage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  return <EmployeeWorkspace module={slug[0] ?? null} sub={slug[1] ?? null} />;
}
