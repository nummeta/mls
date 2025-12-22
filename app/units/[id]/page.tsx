import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LessonClient from "./LessonClient";
import PaperTestClient from "./PaperTestClient";

export default async function UnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. 単元データの取得（既存のクイズデータ取得なども維持しつつ、intro/outroを追加）
  const { data: unit } = await supabase
    .from("units")
    .select(`
      *,
      sections (
        subject_id
      ),
      quiz_types (
        id,
        topic,
        quizzes (
          id,
          question,
          choices (
            id,
            answer_text,
            is_correct,
            explanation
          )
        )
      )
    `)
    .eq("id", id)
    .single();

  if (!unit) return <div>Unit not found</div>;

  // 2. ★追加: 成績データの取得 (Intro/Outroの出し分けに必要)
  const { data: score } = await supabase
    .from("unit_scores")
    .select("*")
    .eq("unit_id", id)
    .eq("user_id", user.id)
    .single();

  const subjectId = (unit.sections as any)?.subject_id;

  // クライアントコンポーネントに渡すpropsをまとめる
  const commonProps = {
    unit,
    userId: user.id,
    score, // ★成績データも渡す
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mb-4">
        {/* subjectIdがあれば戻るリンクを表示 */}
        {subjectId && (
          <Link href={`/subjects/${subjectId}`} className="text-gray-500 hover:underline">
            ← 戻る
          </Link>
        )}
      </div>
      
      {/* タイプによって出し分け */}
      {unit.type === 'test' ? (
        // ★ scoreを追加で渡す
        <PaperTestClient {...commonProps} />
      ) : (
        // ★ scoreを追加で渡す
        <LessonClient {...commonProps} />
      )}
    </div>
  );
}