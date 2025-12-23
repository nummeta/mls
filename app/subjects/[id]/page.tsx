import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

// --- 型定義 ---
type Unit = {
  id: string;
  name: string;
  type: string;
  sort_order: number;
  max_score: number;
  intro: string;
  message: string;
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

// 時間フォーマット
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

  // データ取得
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

  // --- ヘルパーコンポーネント: テストリストのレンダリング ---
  // isSectionLocked: セクション全体がロックされているか（基本未クリアの場合の応用など）
  const renderTestList = (units: Unit[], title: string, badgeColor: string, isSectionLocked: boolean = false) => {
    if (units.length === 0) return null;

    return (
      <div className="mb-6 last:mb-0">
        <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${isSectionLocked ? "text-gray-400" : "text-gray-500"}`}>
          <span className={`w-2 h-2 rounded-full ${isSectionLocked ? "bg-gray-300" : badgeColor}`}></span>
          {title}
        </h4>

        <div className="grid gap-3">
          {units.map((unit, index) => {
            const score = scoreMap.get(unit.id);
            const max = unit.max_score || 100;
            const raw = score?.raw_score || 0;
            const rate = raw / max; // 得点率 (0.0 ~ 1.0)
            
            const isCleared = rate >= 0.8; // 8割以上で合格
            const isAttempted = !!score;   // 受験済み

            // --- ロック判定ロジック ---
            let isLocked = false;
            let lockReason = "";

            if (isSectionLocked) {
              // セクション自体がロックされている（基本未クリアで応用を見ている場合）
              isLocked = true;
              lockReason = "基本問題を1つ以上合格（8割）すると解放されます";
            } else if (index > 0) {
              // セクション内シーケンスロック:
              // 1つ前のテストを「受験」していないと次は開かない
              const prevUnit = units[index - 1];
              const prevScore = scoreMap.get(prevUnit.id);
              
              if (!prevScore) {
                isLocked = true;
                lockReason = "前のセットを受験すると解放されます";
              }
            }

            // コンテンツ本体
            const content = (
              <div className={`
                relative rounded-xl p-5 border-2 transition-all duration-200
                flex justify-between items-center overflow-hidden
                ${isLocked 
                  ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-70 grayscale" // ロック時
                  : isCleared
                    ? "bg-green-50/30 border-green-200 hover:shadow-md" // クリア済み
                    : isAttempted
                      ? "bg-white border-orange-200 hover:shadow-md" // 受験済みだが未合格
                      : "bg-white border-dashed border-gray-300 hover:border-blue-300" // 未受験
                }
              `}>
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm
                    ${isLocked 
                      ? "bg-gray-200 text-gray-400" 
                      : isCleared 
                        ? "bg-white text-green-600" 
                        : "bg-gray-100 text-gray-400"
                    }
                  `}>
                    {isLocked ? "🔒" : isCleared ? "🏆" : "✍️"}
                  </div>
                  
                  <div>
                    <h4 className={`font-bold text-lg transition-colors ${isLocked ? "text-gray-500" : "text-gray-800"}`}>
                      {unit.name}
                    </h4>
                    
                    {isLocked ? (
                      <p className="text-xs text-gray-500 font-bold mt-1">
                        ※ {lockReason}
                      </p>
                    ) : isAttempted ? (
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded shadow-sm border
                          ${isCleared 
                            ? "bg-white border-green-100 text-green-600" 
                            : "bg-white border-orange-100 text-orange-600"
                          }
                        `}>
                          Score: {raw} / {max}
                        </span>
                        {score?.duration && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            ⏱️ {formatDuration(score.duration)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {unit.message || (isSectionLocked ? "ロックされています" : "挑戦しましょう")}
                      </p>
                    )}
                  </div>
                </div>

                {/* 右側のステータスバッジ */}
                {!isLocked && (
                  <div className="relative z-10">
                    {isAttempted ? (
                      <span className={`text-xs font-extrabold px-4 py-1.5 rounded-full border shadow-sm
                        ${isCleared
                          ? "bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200"
                          : "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200"
                        }
                      `}>
                        {isCleared ? "CLEARED ✨" : "RETRY 💪"}
                      </span>
                    ) : (
                      <span className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md group-hover:bg-blue-700 transition-colors">
                        挑戦する
                      </span>
                    )}
                  </div>
                )}
              </div>
            );

            if (isLocked) {
              return <div key={unit.id}>{content}</div>;
            }

            return (
              <Link key={unit.id} href={`/units/${unit.id}`} className="block group">
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-200 px-6 py-8 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm font-bold mb-2 inline-flex items-center gap-1 transition-colors">
            <span>←</span> 科目一覧に戻る
          </Link>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            {subject.name}
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {sortedSections.map((section) => {
          const sortedUnits = section.units.sort((a, b) => a.sort_order - b.sort_order);
          
          const inputUnits = sortedUnits.filter(u => u.type !== 'test');
          const allTestUnits = sortedUnits.filter(u => u.type === 'test');
          
          // 名前で基本・応用に振り分け
          const basicTests = allTestUnits.filter(u => !u.name.includes("応用"));
          const advancedTests = allTestUnits.filter(u => u.name.includes("応用"));

          // ★応用解放判定★
          // 基本テストのうち、1つでも8割以上取れているものがあれば応用を解放
          const hasPassedBasic = basicTests.length === 0 || basicTests.some(u => {
            const s = scoreMap.get(u.id);
            if (!s) return false;
            return (s.raw_score / (u.max_score || 100)) >= 0.8;
          });

          return (
            <div key={section.id} className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative">
              <div className="absolute -top-4 left-8 bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-md flex items-center gap-2">
                <span className="bg-white/20 px-2 rounded-full">Section {section.sort_order}</span>
                <span>{section.name}</span>
              </div>

              <div className="mt-4">
                {/* --- Input Units (動画) --- */}
                {inputUnits.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      Input Learning
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {inputUnits.map((unit) => {
                        const score = scoreMap.get(unit.id);
                        const isCompleted = score?.progress_rate === 1;

                        return (
                          <Link key={unit.id} href={`/units/${unit.id}`} className="block group">
                            <div className={`
                              relative bg-white rounded-xl p-4 border transition-all duration-200
                              hover:shadow-lg hover:-translate-y-0.5
                              ${isCompleted 
                                ? "border-l-4 border-l-green-400 border-gray-100 bg-gray-50/50" 
                                : "border-gray-200 hover:border-blue-300"
                              }
                            `}>
                              <div className="flex items-start gap-3">
                                <div className={`
                                  shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl transition-colors
                                  ${isCompleted ? "bg-green-100 text-green-600" : "bg-blue-50 text-blue-500 group-hover:bg-blue-100"}
                                `}>
                                  {isCompleted ? "✔" : "📺"}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <h4 className={`font-bold truncate pr-2 ${isCompleted ? "text-gray-600" : "text-gray-900 group-hover:text-blue-600"}`}>
                                    {unit.name}
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                    {unit.message || unit.intro || "動画を見て学習しましょう"}
                                  </p>
                                </div>
                                {!isCompleted && (
                                  <div className="self-center text-gray-200 group-hover:text-blue-400">▶</div>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* InputとOutputをつなぐ矢印 */}
                {(basicTests.length > 0 || advancedTests.length > 0) && (
                  <div className="flex justify-center -mt-4 mb-6">
                    <div className="bg-gray-50 text-gray-400 px-4 py-1 rounded-full text-xs font-bold border border-gray-200 flex flex-col items-center gap-0.5">
                      <span>▼</span>
                      <span>STEP UP</span>
                    </div>
                  </div>
                )}

                {/* --- Output Units (テスト) --- */}
                
                {/* 基本問題: ロックなし (セクションロックはfalse) */}
                {renderTestList(basicTests, "Basic Challenge (基本)", "bg-green-400", false)}
                
                {/* 応用問題: 基本問題クリア条件あり (hasPassedBasicがfalseならロック) */}
                {renderTestList(advancedTests, "Advanced Challenge (応用)", "bg-orange-400", !hasPassedBasic)}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}