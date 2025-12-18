import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation"; // リダイレクト用
import LessonClient from "./LessonClient";
import Link from "next/link";

export default async function UnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // ★ここが重要：ログイン中のユーザー情報を取得
  const { data: { user } } = await supabase.auth.getUser();

  // もしログインしていなければ、ログイン画面に飛ばす
  if (!user) {
    redirect("/login");
  }

  // 1. データ取得（Unit + Section + QuizTypes...）
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

  const subjectId = (unit.sections as any)?.subject_id;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mb-4">
        <Link href={`/subjects/${subjectId}`} className="text-gray-500 hover:underline">
          ← 戻る
        </Link>
      </div>
      
      {/* ★ログイン済みの user.id を渡す */}
      <LessonClient unit={unit} userId={user.id} />
    </div>
  );
}