"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

type Student = {
  id: string;
  email: string; // 名前カラムがあれば名前に変更
};

export default function ReportFilter({ 
  students, 
  currentUserId,
  isTutor 
}: { 
  students: Student[], 
  currentUserId: string,
  isTutor: boolean 
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URLパラメータから初期値を取得、なければデフォルト値
  const initialStudentId = searchParams.get("studentId") || (isTutor ? (students[0]?.id || "") : currentUserId);
  
  // デフォルト期間: 今月
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const initialFrom = searchParams.get("from") || firstDay.toISOString().split('T')[0];
  const initialTo = searchParams.get("to") || lastDay.toISOString().split('T')[0];

  const [studentId, setStudentId] = useState(initialStudentId);
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);

  // 変更があったらURLを更新して再検索
  const handleApply = () => {
    const params = new URLSearchParams();
    params.set("studentId", studentId);
    params.set("from", fromDate);
    params.set("to", toDate);
    router.push(`/report?${params.toString()}`);
  };

  // 期間プリセット
  const setMonth = (offset: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    
    setFromDate(start.toISOString().split('T')[0]);
    setToDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 print:hidden">
      <div className="flex flex-wrap items-end gap-4">
        
        {/* 生徒選択 (講師のみ表示) */}
        {isTutor && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500">対象生徒</label>
            <select 
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.email}</option>
              ))}
            </select>
          </div>
        )}

        {/* 期間選択 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-500">期間 (開始)</label>
          <input 
            type="date" 
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="pb-2 text-gray-400">～</div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-500">期間 (終了)</label>
          <input 
            type="date" 
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* プリセットボタン */}
        <div className="flex gap-2 pb-1">
          <button onClick={() => setMonth(-1)} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded text-gray-600 font-bold">先月</button>
          <button onClick={() => setMonth(0)} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded text-gray-600 font-bold">今月</button>
        </div>

        {/* 適用ボタン */}
        <button 
          onClick={handleApply}
          className="ml-auto bg-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm text-sm"
        >
          表示更新
        </button>
      </div>
    </div>
  );
}