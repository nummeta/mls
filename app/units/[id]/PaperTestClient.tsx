"use client";

import { useState, useEffect } from "react";
import { startSession, saveTestResult } from "./actions";

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
  const maxScore = unit.max_score || 100;
  
  // ステータス管理: 'intro' | 'testing' | 'grading' | 'completed'
  // 完了済みなら最初から 'completed' にする
  const [status, setStatus] = useState<'intro' | 'testing' | 'grading' | 'completed'>(
    (!!score?.is_completed || (score?.raw_score !== undefined && score?.raw_score !== null)) 
      ? 'completed' 
      : 'intro'
  );

  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // 画面表示用タイマー
  const [displayScore, setDisplayScore] = useState<number>(score?.raw_score || 0);
  const [inputScore, setInputScore] = useState<string>("");

  // タイマー機能
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'testing') {
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

  // 1. テスト開始
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

  // 2. テスト終了（採点モードへ移行）
  const handleStopTest = () => {
    if(!confirm("テストを終了して答え合わせに進みますか？")) return;
    setStatus('grading');
  };

  // 3. 点数登録
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const scoreVal = parseInt(inputScore, 10);

    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > maxScore) {
      alert(`0から${maxScore}の間で点数を入力してください`);
      return;
    }

    if (!confirm(`${scoreVal}点で登録してよろしいですか？`)) return;

    // 実際の経過時間 (startTimeが基準)
    // ※ grading中に時間が進まないように、testing終了時点の時間を保持しても良いですが、
    // ここでは簡易的に「開始〜採点完了」までの時間を記録するか、
    // あるいは handleStopTest で時間を止めるロジックにするのが正確です。
    // 今回は「タイマーが止まった時点の時間」＝ elapsedSeconds を使用します。
    
    try {
      await saveTestResult(unit.id, userId, scoreVal, elapsedSeconds);
      setDisplayScore(scoreVal);
      setStatus('completed');
    } catch (err) {
      console.error(err);
      alert("保存失敗");
    }
  };

  // 再挑戦
  const handleRetry = () => {
    setStatus('intro');
    setInputScore("");
    setElapsedSeconds(0);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h1 className="text-2xl font-extrabold text-gray-900">{unit.name}</h1>
        {status === 'completed' && (
          <div className="text-right">
            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold block mb-1">
              COMPLETED
            </span>
            <span className="text-xs text-gray-500 font-bold">
              前回: {score?.raw_score} / {maxScore}
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

        {/* State 2: Testing (試験中・タイマーのみ表示) */}
        {status === 'testing' && (
          <div className="text-center py-16 space-y-8 animate-fade-in">
            <h2 className="text-lg font-bold text-gray-500">試験中...</h2>
            
            {/* タイマー表示 */}
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

        {/* State 3: Grading (採点中・PDF表示 & 入力) */}
        {status === 'grading' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* 結果入力フォーム (先に目に入るように上部または下部へ。今回はPDFを見ながらなので下部推奨だが、スクロール考慮して上にも案内) */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex justify-between items-center">
               <span className="font-bold text-blue-900">⏱️ 所要時間: {formatTime(elapsedSeconds)}</span>
               <span className="text-sm text-blue-700">解説を見て自己採点してください</span>
            </div>

            {/* PDFエリア */}
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

            {/* 点数入力エリア */}
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

        {/* State 4: Completed (完了画面) */}
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