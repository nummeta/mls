import { createClient } from "@/utils/supabase/server";
import SubjectAdminClient from "./SubjectAdminClient";

export default async function AdminSubjectsPage() {
  const supabase = await createClient();

  // 科目一覧を取得（ついでに、その中にいくつの章(sections)があるかもカウント）
  const { data: subjects, error } = await supabase
    .from("subjects")
    .select("*, sections(count)")
    .order("sort_order", { ascending: true });

  if (error) {
    return <div>Error loading subjects</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📚 科目管理</h1>
      <SubjectAdminClient subjects={subjects as any} />
    </div>
  );
}