import { createClient } from "@/utils/supabase/server";
import QuizManagerClient from "./QuizManagerClient";

export default async function QuizManagerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 単元名取得
  const { data: unit } = await supabase.from("units").select("name").eq("id", id).single();

  if (!unit) return <div className="p-8">Unit not found</div>;

  // クイズデータ全取得 (Topic -> Quiz -> Choice)
  const { data: quizTypes } = await supabase
    .from("quiz_types")
    .select(`
      id, 
      topic, 
      quizzes (
        id, 
        question, 
        choices (
          id, answer_text, is_correct, explanation
        )
      )
    `)
    .eq("unit_id", id)
    .order("created_at", { ascending: true }); // 作成順

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <QuizManagerClient 
        unitId={id} 
        unitName={unit.name} 
        quizTypes={quizTypes as any || []} 
      />
    </div>
  );
}