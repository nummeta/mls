"use client";

import { useState } from "react";
import { generateWeeklyReport } from "./actions"; // Step3で作ったファイルをインポート

export default function GenerateButton({ 
  userId, 
  fromDate, 
  toDate 
}: { 
  userId: string, 
  fromDate: string, 
  toDate: string 
}) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!confirm(`${fromDate} 〜 ${toDate} の期間でレポートを生成しますか？`)) return;
    
    setLoading(true);
    try {
      await generateWeeklyReport(userId, fromDate, toDate);
      alert("レポートを生成しました！ページを更新してください。");
      window.location.reload(); // 簡易的にリロードしてリストを更新
    } catch (e) {
      console.error(e);
      alert("生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleGenerate}
      disabled={loading}
      className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-purple-700 disabled:opacity-50 transition flex items-center gap-2 text-sm"
    >
      {loading ? "AI生成中..." : "✨ AI週間レポートを生成"}
    </button>
  );
}