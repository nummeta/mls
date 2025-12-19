import { createClient } from "@/utils/supabase/server";
import UnitAdminClient from "./UnitAdminClient";

export default async function AdminUnitsPage() {
  const supabase = await createClient();

  // 科目 > 章 > 単元 の順で全データを取得
  const { data: subjects } = await supabase
    .from("subjects")
    .select(`
      id, 
      name, 
      sort_order,
      sections (
        id, 
        name,
        sort_order,
        units (
          id, name, type, sort_order
        )
      )
    `)
    .order("sort_order", { ascending: true });

  // ※注意: sectionsのsort_orderでの並び替えはクライアント側で行います

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📝 単元・コンテンツ管理</h1>
      {/* データをクライアントコンポーネントに渡す */}
      <UnitAdminClient subjects={subjects as any} />
    </div>
  );
}