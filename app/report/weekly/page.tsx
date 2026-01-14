import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

// A4サイズ設定用のCSSクラス
const A4_PAGE_CLASS = "w-[210mm] min-h-[297mm] mx-auto bg-white shadow-2xl p-8 md:p-12 print:shadow-none print:w-full print:p-0 text-gray-800";

export default async function WeeklyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const reportId = params.id;
  const supabase = await createClient();
  
  // IDがない場合は戻す
  if (!reportId) {
    return <div className="p-10 text-center">レポートIDが指定されていません</div>;
  }

  // --- データ取得 ---
  // 明示的に .single() を使い、エラーがあれば catch する構成に変更
  const { data: report, error } = await supabase
    .from("weekly_reports")
    .select("*, profiles(email)") // ←ここが失敗している可能性あり
    .eq("id", reportId)
    .single();

  // --- エラー表示 (画面が真っ黒になるのを防ぐ) ---
  if (error) {
    console.error("❌ レポート取得エラー:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-lg">
          <h1 className="text-red-600 font-bold text-xl mb-4">データ取得エラー</h1>
          <p className="text-gray-700 mb-4">レポートを表示できませんでした。</p>
          <div className="bg-gray-100 p-4 rounded text-xs font-mono text-red-500 overflow-auto">
            {JSON.stringify(error, null, 2)}
          </div>
          <p className="text-gray-500 text-xs mt-4">
            ※ ヒント: "Could not find relationship" と出る場合は、SQL Editorで `NOTIFY pgrst, 'reload schema';` を実行してください。
          </p>
        </div>
      </div>
    );
  }

  if (!report) {
    return <div className="p-10 text-center">レポートが見つかりません (ID: {reportId})</div>;
  }

  // 取得したプロフィール情報（型安全のためキャスト推奨だが簡易的にanyでアクセス）
  const profileEmail = (report.profiles as any)?.email || "不明なユーザー";

  return (
    <div className="min-h-screen bg-gray-100 py-10 print:bg-white print:py-0">
      
      {/* 印刷指示バー (画面のみ) */}
      <div className="max-w-[210mm] mx-auto mb-6 flex justify-end print:hidden px-4 md:px-0">
        <div className="text-right">
           {/* ※注意: onClickを使うため、本来はクライアントコンポーネント化推奨ですが、ここでは簡易実装 */}
           <p className="text-xs text-gray-500 mb-1">ブラウザの印刷機能(Ctrl+P)をご利用ください</p>
        </div>
      </div>

      {/* A4用紙本体 */}
      <div className={A4_PAGE_CLASS}>
        
        {/* ヘッダー */}
        <header className="border-b-4 border-blue-600 pb-4 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight">WEEKLY LEARNING REPORT</h1>
            <p className="text-sm text-gray-500 font-bold mt-1">モチアカ式ラーニングシステム 週次学習報告書</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 font-bold">生徒名: {profileEmail}</p>
            <p className="text-lg font-bold">{report.start_date} 〜 {report.end_date}</p>
          </div>
        </header>

        {/* 2カラムレイアウト */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
          
          {/* 左カラム: 学習概要 */}
          <div className="space-y-6">
            
            {/* 1. 学習内容サマリ */}
            <section className="bg-blue-50 p-5 rounded-lg border border-blue-100">
              <h2 className="text-blue-800 font-bold text-lg mb-2 flex items-center gap-2">
                <span>📚</span> 今週の学習内容
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {report.learning_summary || "データなし"}
              </p>
            </section>

            {/* 2. 習得状況 */}
            <section className="bg-orange-50 p-5 rounded-lg border border-orange-100">
              <h2 className="text-orange-800 font-bold text-lg mb-2 flex items-center gap-2">
                <span>📊</span> 習得状況・スコア分析
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {report.mastery_summary || "データなし"}
              </p>
            </section>

             {/* 3. 弱点分析 */}
             <section className="bg-red-50 p-5 rounded-lg border border-red-100 flex-grow">
              <h2 className="text-red-800 font-bold text-lg mb-2 flex items-center gap-2">
                <span>🔍</span> 答案分析・弱点ポイント
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {report.weakness_analysis || "データなし"}
              </p>
            </section>

          </div>

          {/* 右カラム: 口頭試問 & コメント */}
          <div className="flex flex-col h-full space-y-6">
            
            {/* 4. 口頭試問シート */}
            <section className="border-2 border-gray-800 rounded-xl p-6 flex-grow flex flex-col min-h-[400px]">
              <div className="border-b-2 border-gray-200 pb-3 mb-4">
                <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                  <span>🗣️</span> 口頭試問チェックシート
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  以下の質問に対して、生徒自身が言葉で説明できるか確認してください。
                </p>
              </div>

              <div className="flex-grow space-y-6">
                {report.oral_exam_questions ? (
                  report.oral_exam_questions.split('\n').map((q: string, i: number) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="space-y-2 w-full">
                        <p className="font-bold text-sm">{q.replace(/^\d+\.\s*/, '')}</p>
                        <div className="flex gap-4 mt-1">
                           <div className="flex items-center gap-1">
                             <div className="w-4 h-4 border border-gray-400 rounded-full"></div>
                             <span className="text-xs text-gray-400">説明できた</span>
                           </div>
                           <div className="flex items-center gap-1">
                             <div className="w-4 h-4 border border-gray-400 rounded-full"></div>
                             <span className="text-xs text-gray-400">要復習</span>
                           </div>
                        </div>
                        <div className="h-px bg-gray-200 w-full mt-2 border-dashed"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm">口頭試問データがありません</p>
                )}
              </div>
            </section>

            {/* 5. 担任コメント欄 */}
            <section className="h-40 border-2 border-dashed border-gray-300 rounded-xl p-4 relative">
              <span className="absolute top-0 left-4 -translate-y-1/2 bg-white px-2 text-sm font-bold text-gray-400">
                担任コメント / 面談メモ
              </span>
              <div className="h-full w-full flex items-end justify-end">
                <span className="text-xs text-gray-300">モチアカ式ラーニングシステム</span>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}