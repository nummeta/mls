import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link"; // ★追加
import PrintButton from "./PrintButton";
import ReportFilter from "./ReportFilter";
import GenerateButton from "./GenerateButton"; // ★追加

// 時間フォーマット関数
const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}時間 ${m}分`;
  return `${m}分`;
};

// 日付フォーマット
const formatDate = (dateString: string) => {
  const d = new Date(dateString);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // --- 1. 権限チェックとターゲット設定 ---
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isTutor = myProfile?.role === 'admin' || myProfile?.role === 'tutor';

  let studentsList: { id: string; email: string }[] = [];
  if (isTutor) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("role", "student")
      .order("email");
    if (data) studentsList = data as any;
  }

  // --- 2. 検索条件の確定 ---
  const params = await searchParams;
  
  let targetUserId = user.id;
  if (isTutor) {
    if (typeof params.studentId === 'string') {
      targetUserId = params.studentId;
    } else if (studentsList.length > 0) {
      targetUserId = studentsList[0].id;
    }
  }

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1); 
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0); 

  const fromDateStr = typeof params.from === 'string' ? params.from : firstDay.toISOString().split('T')[0];
  const toDateStr = typeof params.to === 'string' ? params.to : lastDay.toISOString().split('T')[0];

  const fromDate = new Date(fromDateStr);
  const toDate = new Date(toDateStr);
  toDate.setHours(23, 59, 59, 999);

  // --- 3. データ取得 ---
  
  // A. 学習セッション
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", targetUserId)
    .gte("start_time", fromDate.toISOString())
    .lte("start_time", toDate.toISOString())
    .order("start_time", { ascending: true });

  // B. テスト成績
  const { data: scores } = await supabase
    .from("unit_scores")
    .select(`
      *,
      units (
        name,
        max_score,
        type,
        sections (
          subjects (
            name
          )
        )
      )
    `)
    .eq("user_id", targetUserId)
    .gte("last_updated", fromDate.toISOString())
    .lte("last_updated", toDate.toISOString())
    .order("last_updated", { ascending: false });

  // ★追加 C. 生成済みの週次レポート一覧
  const { data: weeklyReports } = await supabase
    .from("weekly_reports")
    .select("id, start_date, end_date, created_at")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false });

  const { data: targetProfile } = await supabase.from("profiles").select("email").eq("id", targetUserId).single();
  const targetName = targetProfile?.email || "不明なユーザー";

  // --- データ加工 ---
  const totalDuration = sessions?.reduce((acc, curr) => acc + (curr.duration || 0), 0) || 0;
  const clearedCount = scores?.filter(s => s.progress_rate === 1).length || 0;

  const dayList: string[] = [];
  const loopDate = new Date(fromDate);
  while (loopDate <= toDate) {
    dayList.push(loopDate.toISOString().split('T')[0]);
    loopDate.setDate(loopDate.getDate() + 1);
  }

  const graphData = dayList.map(dateStr => {
    const daySessions = sessions?.filter(s => s.start_time.startsWith(dateStr)) || [];
    const dayTotal = daySessions.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    return {
      date: dateStr,
      label: formatDate(dateStr),
      seconds: dayTotal,
      heightRate: Math.min((dayTotal / 10800) * 100, 100) 
    };
  });

  return (
    <div className="min-h-screen bg-gray-100 py-10 print:bg-white print:py-0">
      
      {/* フィルターUI & 生成ボタン */}
      <div className="max-w-4xl mx-auto mb-6 print:hidden">
        <ReportFilter 
          students={studentsList} 
          currentUserId={user.id} 
          isTutor={isTutor} 
        />
        
        {/* ★追加: 講師の場合のみ生成ボタンを表示 */}
        {isTutor && (
          <div className="flex justify-end mb-4">
             <GenerateButton 
               userId={targetUserId} 
               fromDate={fromDateStr} 
               toDate={toDateStr} 
             />
          </div>
        )}
      </div>

      {/* メインレポートエリア */}
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-xl overflow-hidden print:shadow-none print:w-full print:max-w-none mb-10">
        
        {/* ヘッダー */}
        <div className="bg-[#0099D9] text-white p-8 print:bg-white print:text-black print:border-b-2 print:border-gray-800">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-blue-100 font-bold tracking-widest text-sm mb-1 print:text-gray-500">LEARNING REPORT</p>
              <h1 className="text-3xl font-extrabold">学習進捗レポート</h1>
              <p className="mt-2 text-sm opacity-90 print:text-black">生徒: <span className="font-bold text-lg">{targetName}</span> 殿</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold opacity-80">対象期間</p>
              <p className="text-xl font-bold">{formatDate(fromDateStr)} - {formatDate(toDateStr)}</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-10">

          {/* 1. サマリー */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-center print:border-gray-200">
              <h3 className="text-gray-500 font-bold text-sm mb-2">総学習時間</h3>
              <p className="text-4xl font-extrabold text-[#0099D9]">
                {formatDuration(totalDuration)}
              </p>
            </div>
            <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 text-center print:border-gray-200">
              <h3 className="text-gray-500 font-bold text-sm mb-2">クリアした単元数</h3>
              <p className="text-4xl font-extrabold text-[#F39800]">
                {clearedCount} <span className="text-lg text-gray-400 font-bold">Units</span>
              </p>
            </div>
          </div>

          {/* 2. グラフ */}
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
              📊 学習時間の推移
            </h2>
            <div className="overflow-x-auto pb-4">
              <div className="h-48 flex items-end gap-2 px-2 min-w-full" style={{ width: `${Math.max(100, graphData.length * 4)}%` }}>
                {graphData.map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group min-w-[30px]">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-gray-800 text-white px-2 py-1 rounded absolute -mt-8 pointer-events-none z-10 whitespace-nowrap">
                      {day.label}: {formatDuration(day.seconds)}
                    </div>
                    <div 
                      className="w-full bg-blue-500 rounded-t-md print:bg-gray-400"
                      style={{ height: `${day.heightRate > 0 ? Math.max(day.heightRate, 5) : 0}%` }}
                    ></div>
                    <span className="text-[10px] text-gray-500 font-bold truncate w-full text-center">{day.label.split('/')[1]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. 学習詳細 */}
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
              ✍️ 取り組んだ単元と成績
            </h2>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3">実施日</th>
                    <th className="px-6 py-3">科目・単元</th>
                    <th className="px-6 py-3">タイプ</th>
                    <th className="px-6 py-3 text-right">結果</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scores?.map((score) => {
                    const unit = score.units as any;
                    const subjectName = unit?.sections?.subjects?.name || "その他";
                    const isPassed = (score.raw_score || 0) >= (unit.max_score || 100) * 0.8;

                    return (
                      <tr key={score.unit_id + score.last_updated} className="bg-white hover:bg-gray-50 break-inside-avoid">
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {formatDate(score.last_updated)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-gray-400 font-bold mb-0.5">{subjectName}</div>
                          <div className="font-bold text-gray-800">{unit.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          {unit.type === 'test' ? (
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">テスト</span>
                          ) : (
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">動画</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {unit.type === 'test' ? (
                            <div>
                              <span className={`text-lg font-extrabold ${isPassed ? "text-green-600" : "text-orange-500"}`}>
                                {score.raw_score}
                              </span>
                              <span className="text-gray-400 text-xs"> / {unit.max_score || 100}</span>
                            </div>
                          ) : (
                            <span className="text-green-600 font-bold text-xs">完了</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {scores?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                        この期間の記録はありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </div>

      {/* ★追加: 生成済みAIレポート一覧 */}
      {weeklyReports && weeklyReports.length > 0 && (
        <div className="max-w-4xl mx-auto mt-10 print:hidden">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            📂 生成済みの週間AIレポート (A4印刷用)
          </h2>
          <div className="grid gap-3">
            {weeklyReports.map((report) => (
              <Link 
                key={report.id} 
                href={`/report/weekly?id=${report.id}`}
                className="block bg-white border border-gray-200 p-4 rounded-lg hover:shadow-md hover:border-blue-300 transition flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-gray-800">
                    {formatDate(report.start_date)} 〜 {formatDate(report.end_date)} のレポート
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    生成日: {new Date(report.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-blue-600 text-sm font-bold">
                  詳細を見る →
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 印刷ボタン */}
      <div className="max-w-4xl mx-auto mt-6 text-right print:hidden px-6 pb-20">
        <PrintButton />
      </div>

    </div>
  );
}