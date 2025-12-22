import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

// 型定義に message を追加
type Unit = {
  id: string;
  name: string;
  type: string;
  sort_order: number;
  max_score: number;
  intro: string;
  message: string; // ★追加
};

type Section = {
  id: string;
  name: string;
  sort_order: number;
  units: Unit[];
};

type SubjectData = {
  id: string;
  name: string;
  sections: Section[];
};

const formatDuration = (seconds: number) => {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ★クエリに message を追加
  const { data: rawSubject } = await supabase
    .from("subjects")
    .select(`
      *,
      sections (
        *,
        units (
          *,
          message
        )
      )
    `)
    .eq("id", id)
    .single();

  const subject = rawSubject as unknown as SubjectData;

  const { data: myScores } = await supabase
    .from("unit_scores")
    .select("*")
    .eq("user_id", user.id);

  const scoreMap = new Map(myScores?.map((s) => [s.unit_id, s]));

  if (!subject) return <div>Subject not found</div>;

  const sortedSections = subject.sections.sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-6 py-8 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm font-bold mb-2 inline-block">
            ← 科目一覧に戻る
          </Link>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            {subject.name}
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-12">
        {sortedSections.map((section) => {
          const sortedUnits = section.units.sort((a, b) => a.sort_order - b.sort_order);

          return (
            <div key={section.id}>
              <div className="flex items-center gap-3 mb-6">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-sm">
                  {section.sort_order}
                </span>
                <h2 className="text-xl font-bold text-gray-800">
                  {section.name}
                </h2>
              </div>

              <div className="grid gap-4">
                {sortedUnits.map((unit) => {
                  const score = scoreMap.get(unit.id);
                  const isCompleted = score?.progress_rate === 1;
                  const isTest = unit.type === 'test';

                  return (
                    <Link key={unit.id} href={`/units/${unit.id}`} className="block group">
                      <div className={`
                        bg-white rounded-xl p-5 border-2 transition-all duration-200
                        hover:border-blue-400 hover:shadow-md relative overflow-hidden
                        ${isCompleted ? "border-green-100 bg-green-50/30" : "border-gray-100"}
                      `}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className={`
                              w-10 h-10 rounded-lg flex items-center justify-center text-xl
                              ${isTest ? "bg-orange-100 text-orange-600" : "bg-blue-50 text-blue-500"}
                            `}>
                              {isTest ? "✍️" : "📺"}
                            </div>
                            
                            <div>
                              <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                {unit.name}
                              </h3>
                              {isTest && isCompleted ? (
                                <div className="flex gap-3 text-xs font-bold mt-1">
                                  <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                    得点: {score?.raw_score} / {unit.max_score || 100}
                                  </span>
                                  {score?.duration && (
                                    <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                                      ⏱️ {formatDuration(score.duration)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                                  {/* ★ここを修正: intro から message (ポイント) に変更 */}
                                  {unit.message || unit.intro || (isTest ? "確認テストに挑戦しよう" : "動画を見て学習しよう")}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* 右側のバッジ表示部分はそのまま */}
                          <div>
                            {isCompleted ? (
                              isTest ? (
                                <span className={`text-xs font-extrabold px-3 py-1 rounded-full border
                                  ${(score?.raw_score || 0) >= (unit.max_score || 100) * 0.8 
                                    ? "bg-green-100 text-green-700 border-green-200"
                                    : "bg-orange-100 text-orange-700 border-orange-200"
                                  }
                                `}>
                                  {(() => {
                                    const p = (score?.raw_score || 0) / (unit.max_score || 100);
                                    if (p === 1) return "PERFECT! 🏆";
                                    if (p >= 0.8) return "EXCELLENT ✨";
                                    if (p >= 0.6) return "PASSED 👍";
                                    return "RETRY 💪";
                                  })()}
                                </span>
                              ) : (
                                <div className="flex items-center gap-1 text-green-600 font-bold text-xs bg-green-100 px-3 py-1 rounded-full">
                                  <span>✔</span>
                                  <span>DONE</span>
                                </div>
                              )
                            ) : (
                              <span className="text-gray-300 group-hover:text-blue-400">▶</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}