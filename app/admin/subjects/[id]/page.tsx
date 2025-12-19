import { createClient } from "@/utils/supabase/server";
import SectionAdminClient from "./SectionAdminClient";

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 指定された科目と、それに紐づく章を取得
  const { data: subject, error } = await supabase
    .from("subjects")
    .select(`
      id,
      name,
      sections (
        id,
        name,
        sort_order,
        units (count)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !subject) {
    return <div>科目の読み込みエラー</div>;
  }

  // もし前回の修正で列名を変更し忘れている場合は
  // sections ( id, title, ... ) に戻してください
  // 現在は 'name' で統一されている前提です

  return (
    <div className="max-w-4xl">
      <SectionAdminClient subject={subject as any} />
    </div>
  );
}