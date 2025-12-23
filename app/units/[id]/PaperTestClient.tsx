"use client";

import { useState, useEffect, useRef } from "react";
import { startSession, saveTestResult } from "./actions";
import { createClient } from "@/utils/supabase/client";

type Unit = {
  id: string;
  name: string;
  answer_url: string | null;
  intro?: string;
  outro?: string;
  max_score?: number;
};

type Score = {
  raw_score: number;
  duration: number;
  is_completed: boolean;
};

// 時間表示用のヘルパー関数 (秒 -> mm:ss)
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function PaperTestClient({ 
  unit, 
  userId, 
  score 
}: { 
  unit: Unit; 
  userId: string; 
  score: Score | null;
}) {
  const supabase = createClient();
  const maxScore = unit.max_score || 100;
  
  // ステータス管理
  const [status, setStatus] = useState<'intro' | 'testing' | 'grading' | 'completed'>(
    (!!score?.is_completed || (score?.raw_score !== undefined && score?.raw_score !== null)) 
      ? 'completed' 
      : 'intro'
  );

  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0); 
  const [displayScore, setDisplayScore] = useState<number>(score?.raw_score || 0);
  const [inputScore, setInputScore] = useState<string>("");
  const [isRequesting, setIsRequesting] = useState(false);

  // --- 1. 講師呼び出し・リクエスト機能 (LessonClientと同様) ---
  useEffect(() => {
    const checkRequest = async () => {
      const { data } = await supabase
        .from("help_requests")
        .select("id")
        .eq("student_id", userId)
        .eq("status", "pending")
        .limit(1);
      
        setIsRequesting(!!data && data.length > 0);
    };
    checkRequest();
    
    const channel = supabase.channel("test_request_status")
      .on('postgres_changes', { event: '*', schema: 'public', table: 'help_requests', filter: `student_id=eq.${userId}` }, 
        () => checkRequest()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleToggleRequest = async () => {
    if (isRequesting) {
      await supabase.from("help_requests").update({ status: 'resolved' }).eq("student_id", userId).eq("status", "pending");
      setIsRequesting(false);
      alert("リクエストを取り下げました");
    } else {
      await supabase.from("help_requests").insert({ student_id: userId, status: "pending" });
      setIsRequesting(true);
      alert("講師を呼び出しました。");
    }
  };

  // --- 2. プロフィール更新ロジック (ここが重要！) ---
  
  // A. 初期化（ページを開いた時）
  useEffect(() => {
    const initProfile = async () => {
      if (!unit.id) return;
      await supabase.from("profiles").update({
        current_unit_id: unit.id,
        current_unit_started_at: new Date().toISOString(),
        current_activity: 'test_intro', // 最初は説明画面
        last_seen_at: new Date().toISOString(),
      }).eq("id", userId);
    };
    initProfile();
  }, [unit.id, userId]);

  // B. ステータス変更時の更新 & ハートビート
  useEffect(() => {
    const updateStatus = async () => {
      // 講師側に表示するアクティビティ名をわかりやすく変換
      let activityName = 'test_intro';
      if (status === 'testing') activityName = 'test_solving'; // 解答中
      if (status === 'grading') activityName = 'test_grading'; // 採点中
      if (status === 'completed') activityName = 'test_done';  // 完了

      await supabase.from("profiles").update({
        current_unit_id: unit.id,
        current_activity: activityName,
        last_seen_at: new Date().toISOString(),
      }).eq("id", userId);
    };

    updateStatus(); // ステータスが変わったら即送信

    // テスト中は画面を見つめている時間が長いので、定期的に生存報告を送る
    const interval = setInterval(updateStatus, 30000); 
    return () => clearInterval(interval);
  }, [status, unit.id, userId]);


  // --- 3. タイマー機能 ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'testing') {
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

  // --- アクション ---

  const handleStart = async () => {
    try {
      await startSession(unit.id, userId);
      const now = Date.now();
      setStartTime(now);
      setElapsedSeconds(0);
      setStatus('testing');
    } catch (e) {
      console.error(e);
      alert("開始エラー");
    }
  };

  const handleStopTest = () => {
    if(!confirm("テストを終了して答え合わせに進みますか？")) return;
    setStatus('grading');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const scoreVal = parseInt(inputScore, 10);

    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > maxScore) {
      alert(`0から${maxScore}の間で点数を入力してください`);
      return;
    }

    if (!confirm(`${scoreVal}点で登録してよろしいですか？`)) return;

    try {
      await saveTestResult(unit.id, userId, scoreVal, elapsedSeconds);
      setDisplayScore(scoreVal);
      setStatus('completed');
    } catch (err) {
      console.error(err);
      alert("保存失敗");
    }
  };

  const handleRetry = () => {
    setStatus('intro');
    setInputScore("");
    setElapsedSeconds(0);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      
      {/* 講師呼び出しボタン (右上) */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={handleToggleRequest}
          className={`px-4 py-2 rounded-full font-bold shadow-sm text-sm transition ${
            isRequesting 
              ? "bg-red-100 text-red-600 border border-red-300 hover:bg-red-200"
              : "bg-yellow-100 text-yellow-800 border border-yellow-300 hover:bg-yellow-200"
          }`}
        >
          {isRequesting ? "✋ 呼び出し中 (キャンセル)" : "🙋 講師を呼ぶ"}
        </button>
      </div>

      <div className="p-6 border-b border-gray-100 flex justify-between items-center pr-40"> {/* pr-40でボタンと被らないように */}
        <h1 className="text-2xl font-extrabold text-gray-900">{unit.name}</h1>
        {status === 'completed' && (
          <div className="text-right">
            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold block mb-1">
              COMPLETED
            </span>
          </div>
        )}
      </div>

      <div className="p-6">
        
        {/* State 1: Intro (開始前) */}
        {status === 'intro' && (
          <div className="text-center py-10 space-y-6">
            <div className="text-6xl mb-4">✍️</div>
            <h2 className="text-xl font-bold text-gray-800">確認テストを始める</h2>
            <p className="text-gray-600 max-w-lg mx-auto leading-relaxed whitespace-pre-wrap">
              {unit.intro || "準備ができたらスタートボタンを押してください。\nタイマーが作動します。"}
            </p>
            <button 
              onClick={handleStart}
              className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700 transition transform hover:-translate-y-0.5"
            >
              テスト開始 (タイマー作動)
            </button>
          </div>
        )}

        {/* State 2: Testing (試験中) */}
        {status === 'testing' && (
          <div className="text-center py-16 space-y-8 animate-fade-in">
            <h2 className="text-lg font-bold text-gray-500">試験中...</h2>
            
            <div className="text-7xl font-mono font-bold text-blue-600 tabular-nums">
              {formatTime(elapsedSeconds)}
            </div>
            
            <p className="text-sm text-gray-400">
              問題を解き終わったら終了ボタンを押してください。<br/>
              解説が表示され、採点へ進みます。
            </p>

            <button 
              onClick={handleStopTest}
              className="bg-red-500 text-white px-10 py-4 rounded-full font-bold text-lg shadow-lg hover:bg-red-600 transition"
            >
              解答終了・答え合わせへ
            </button>
          </div>
        )}

        {/* State 3: Grading (採点中) */}
        {status === 'grading' && (
          <div className="space-y-8 animate-fade-in">
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex justify-between items-center">
               <span className="font-bold text-blue-900">⏱️ 所要時間: {formatTime(elapsedSeconds)}</span>
               <span className="text-sm text-blue-700">解説を見て自己採点してください</span>
            </div>

            {unit.answer_url ? (
              <div className="bg-gray-100 rounded-xl p-4 h-[60vh] border border-gray-200">
                <iframe 
                  src={unit.answer_url} 
                  className="w-full h-full rounded bg-white shadow-sm"
                  title="Answer PDF"
                />
              </div>
            ) : (
              <div className="p-10 text-center bg-gray-100 rounded text-gray-500">
                解答PDFが見つかりません
              </div>
            )}

            <div className="bg-white p-6 rounded-xl border-2 border-blue-100 text-center shadow-lg">
              <h3 className="font-bold text-lg text-gray-800 mb-2">採点結果を入力</h3>
              <p className="text-sm text-gray-500 mb-6">
                満点: {maxScore}点
              </p>
              
              <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={maxScore}
                    value={inputScore}
                    onChange={(e) => setInputScore(e.target.value)}
                    placeholder="0"
                    className="w-32 text-center text-3xl font-bold p-3 rounded-lg border-2 border-blue-200 focus:border-blue-500 outline-none"
                    required
                    autoFocus
                  />
                  <span className="text-2xl font-bold text-blue-800">/ {maxScore}</span>
                </div>
                
                <button 
                  type="submit"
                  className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition shadow-sm w-full md:w-auto"
                >
                  結果を登録して完了
                </button>
              </form>
            </div>
          </div>
        )}

        {/* State 4: Completed (完了) */}
        {status === 'completed' && (
          <div className="text-center py-10 space-y-6 animate-fade-in">
            <div className="text-6xl mb-4">
              {displayScore >= maxScore * 0.8 ? "🏆" : displayScore >= maxScore * 0.6 ? "👍" : "💪"}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">採点完了！</h2>
            
            <div className="text-4xl font-extrabold text-blue-600 my-4">
              {displayScore} <span className="text-xl text-gray-400 font-normal">/ {maxScore}</span>
            </div>

            <p className="text-gray-600 max-w-lg mx-auto leading-relaxed whitespace-pre-wrap">
              {unit.outro || "お疲れ様でした！結果は保存されました。"}
            </p>
            
            <div className="flex justify-center gap-4 pt-4">
              <button 
                onClick={handleRetry}
                className="bg-white border-2 border-blue-600 text-blue-600 px-6 py-2 rounded-full font-bold hover:bg-blue-50 transition"
              >
                再挑戦する
              </button>
              <button disabled className="bg-gray-100 text-gray-400 px-6 py-2 rounded-full font-bold cursor-default">
                保存済み
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}