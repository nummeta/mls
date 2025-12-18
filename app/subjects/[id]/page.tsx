import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation"; // 追加

export default async function SubjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // ★変更点: 本物のログインユーザーを取得
  const { data: { user } } = await supabase.auth.getUser();

  // ログインしていなければログイン画面へ飛ばす（門番）
  if (!user) {
    redirect("/login");
  }
  // 1. 科目(Subject)の情報を取る
  const { data: subject } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", id)
    .single();

  // 2. 章(Section)と、その中の単元(Unit)を取る
  const { data: sections } = await supabase
    .from("sections")
    .select(`
      *,
      units (
        id,
        name,
        sort_order
      )
    `)
    .eq("subject_id", id)
    .order("sort_order", { ascending: true });

  // 3. 【追加】このユーザーの「単元成績」を全部取ってくる
  // ※ progress_rate が 1 (100%) のものだけ取得すれば「完了」とみなせます
  const { data: myScores } = await supabase
  .from("unit_scores")
  .select("unit_id, progress_rate")
  .eq("user_id", user.id);

  // 4. 成績データを「検索しやすい形」に変換する
  // 例: { "単元ID_A": true, "単元ID_B": false }
  const completedUnitIds = new Set(
    myScores
      ?.filter((score) => score.progress_rate === 1) // 100%完了のものだけ
      .map((score) => score.unit_id)
  );

  // データの並び替え（Unitをsort_order順に）
  sections?.forEach((section) => {
    section.units.sort((a: any, b: any) => a.sort_order - b.sort_order);
  });

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-gray-500 hover:text-gray-900 mb-6 inline-flex items-center text-sm font-bold"
        >
          ← 科目一覧に戻る
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-8 border-b pb-4">
          {subject?.name}
        </h1>

        <div className="space-y-8">
          {sections?.map((section) => (
            <div
              key={section.id}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
            >
              <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                  Chapter {section.sort_order + 1}
                </span>
                {section.name}
              </h2>

              <ul className="space-y-3">
                {section.units.map((unit: any) => {
                  // この単元が完了しているかチェック
                  const isCompleted = completedUnitIds.has(unit.id);

                  return (
                    <li key={unit.id}>
                      <Link
                        href={`/units/${unit.id}`}
                        className={`
                          block p-4 rounded-lg border transition-all flex justify-between items-center group
                          ${
                            isCompleted
                              ? "bg-green-50 border-green-200 hover:bg-green-100"
                              : "bg-gray-50 border-gray-100 hover:bg-white hover:border-blue-300 hover:shadow-md"
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          {/* アイコンの出し分け */}
                          {isCompleted ? (
                            <div className="bg-green-500 text-white p-1 rounded-full">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          ) : (
                            <div className="bg-gray-200 text-gray-400 p-1 rounded-full group-hover:bg-blue-500 group-hover:text-white transition-colors">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          )}
                          
                          <span
                            className={`font-medium ${
                              isCompleted ? "text-green-800" : "text-gray-700"
                            }`}
                          >
                            {unit.name}
                          </span>
                        </div>

                        {isCompleted && (
                          <span className="text-xs font-bold text-green-600 bg-white px-2 py-1 rounded border border-green-200">
                            COMPLETED
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
                {section.units.length === 0 && (
                  <li className="text-gray-400 text-sm pl-2">
                    単元がまだありません
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}