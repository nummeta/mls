import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LessonClient from "./LessonClient";
import PaperTestClient from "./PaperTestClient"; // ★追加

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
      
      {/* ★タイプによって出し分け */}
      {unit.type === 'test' ? (
        <PaperTestClient unit={unit} userId={user.id} />
      ) : (
        <LessonClient unit={unit} userId={user.id} />
      )}
    </div>
  );
}