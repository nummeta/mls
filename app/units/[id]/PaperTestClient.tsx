"use client";

import { useState, useEffect } from "react";
import { saveTestResult } from "./actions";

type Props = {
  unit: any;
  userId: string;
};

export default function PaperTestClient({ unit, userId }: Props) {
  // ステータス管理: 待機 -> テスト中 -> 自己採点中 -> 完了
  const [status, setStatus] = useState<"idle" | "running" | "grading" | "completed">("idle");
  
  // タイマー用
  const [seconds, setSeconds] = useState(0);
  const [finalDuration, setFinalDuration] = useState(0); // 確定した所要時間
  
  // スコア入力用
  const [scoreInput, setScoreInput] = useState<number>(0);

  // タイマー機能（runningの時だけ動く）
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "running") {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  // 秒数を MM:SS 形式に変換する関数
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // テスト開始
  const handleStart = () => {
    setStatus("running");
  };

  // テスト終了（時間を確定させて採点画面へ）
  const handleFinish = () => {
    if (confirm("テストを終了して、採点画面へ進みますか？")) {
      setFinalDuration(seconds); // 時間を記録
      setStatus("grading");      // ステータス変更
    }
  };

  // 結果送信（サーバーへ保存）
  const handleSubmitScore = async () => {
    if (!confirm(`正解数は「${scoreInput}問」でよろしいですか？`)) return;
    
    try {
      // DBへ保存（unit_id, user_id, 点数, かかった秒数）
      await saveTestResult(unit.id, userId, scoreInput, finalDuration);
      setStatus("completed");
    } catch (e) {
      alert("保存に失敗しました");
      console.error(e);
    }
  };

  // ---------------------------------------------------------
  // 1. 待機画面 (Instructions)
  // ---------------------------------------------------------
  if (status === "idle") {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-10 text-center">
        <span className="bg-orange-100 text-orange-600 font-bold px-3 py-1 rounded-full text-sm mb-4 inline-block">
          確認テスト
        </span>
        <h1 className="text-3xl font-bold mb-6 text-gray-800">{unit.name}</h1>
        
        <div className="bg-gray-50 p-6 rounded-lg text-left mb-8 space-y-3 border border-gray-200">
          <p className="font-bold text-gray-700">準備するもの：</p>
          <ul className="list-disc list-inside text-gray-600 ml-4 space-y-1">
            <li>配布されたプリント（またはノート）</li>
            <li>筆記用具（鉛筆、消しゴム）</li>
            <li><span className="text-red-500 font-bold">赤ペン</span>（採点用）</li>
          </ul>
        </div>

        <p className="mb-8 text-gray-600">
          準備ができたらボタンを押してください。<br/>
          自動的にタイマーがスタートします。
        </p>

        <button 
          onClick={handleStart}
          className="bg-orange-500 text-white px-12 py-4 rounded-full text-xl font-bold hover:bg-orange-600 shadow-lg transform transition hover:scale-105"
        >
          よーい、スタート！ ⏱️
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 2. テスト実施中 (Running / Timer)
  // ---------------------------------------------------------
  if (status === "running") {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-16 text-center">
        <h2 className="text-gray-500 font-bold mb-2">経過時間</h2>
        
        <div className="text-8xl font-mono font-bold text-gray-800 mb-12 tracking-wider">
          {formatTime(seconds)}
        </div>
        
        <p className="text-gray-600 mb-8 animate-pulse">
          集中して解きましょう... ✍️
        </p>

        <button 
          onClick={handleFinish}
          className="bg-red-500 text-white px-10 py-3 rounded-lg font-bold hover:bg-red-600 shadow-lg transition transform hover:scale-105"
        >
          解き終わった！
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 3. 採点画面 (Grading / PDF View)
  // ---------------------------------------------------------
  if (status === "grading") {
    return (
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        {/* ヘッダーエリア */}
        <div className="bg-blue-600 p-6 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">おつかれさまでした！</h2>
          <p className="opacity-90 mb-1">
             かかった時間: <span className="font-bold text-xl ml-2">{formatTime(finalDuration)}</span>
          </p>
          <p className="text-sm text-blue-100">赤ペンを持って、自己採点をしましょう。</p>
        </div>

        <div className="p-6 md:p-8">
          {/* アドバイスエリア */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 text-sm md:text-base">
            <h3 className="font-bold text-yellow-800 mb-2">💡 採点のポイント</h3>
            <ul className="list-disc list-inside text-yellow-700 space-y-1">
              <li>消しゴムで消さないこと！間違えた跡を残すのが大事です。</li>
              <li>間違えた問題には、なぜ間違えたか「自分なりのコメント」を書き込もう。</li>
              <li>漢字のトメ・ハネもしっかりチェックしよう。</li>
            </ul>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* 左側：模範解答エリア（PDF/画像対応） */}
            <div>
              <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">模範解答</h3>
              
              <div className="border border-gray-200 rounded-lg bg-gray-50 h-[60vh] overflow-hidden relative">
                {unit.answer_url ? (
                  <>
                    {/* PDFの場合 */}
                    {unit.answer_url.toLowerCase().endsWith(".pdf") ? (
                      <object
                        data={unit.answer_url}
                        type="application/pdf"
                        className="w-full h-full"
                      >
                        {/* PDF非対応環境用 */}
                        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                          <p className="mb-4 text-gray-500 text-sm">
                            プレビューを表示できませんでした。<br/>
                            ファイルをダウンロードして確認してください。
                          </p>
                          <a 
                            href={unit.answer_url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 text-sm"
                          >
                            PDFを開く
                          </a>
                        </div>
                      </object>
                    ) : (
                      /* 画像の場合 */
                      <div className="h-full overflow-auto flex items-start justify-center p-2">
                         <img src={unit.answer_url} alt="模範解答" className="max-w-full h-auto shadow-sm" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-400">解答が登録されていません</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                ※見にくい場合は拡大するか、ファイルをダウンロードしてください
              </p>
            </div>

            {/* 右側：点数入力エリア */}
            <div className="flex flex-col justify-center bg-gray-50 p-6 rounded-xl border border-gray-100">
              <label className="block text-gray-700 font-bold mb-4 text-center">
                正解数は何問でしたか？
              </label>
              
              <div className="flex items-end justify-center gap-3 mb-8">
                <input
                  type="number"
                  min="0"
                  max={unit.max_score}
                  value={scoreInput}
                  onChange={(e) => setScoreInput(Number(e.target.value))}
                  className="w-32 text-5xl font-bold text-center bg-white border-b-4 border-blue-500 focus:border-blue-700 focus:outline-none py-2 rounded-t text-blue-900"
                />
                <span className="text-2xl text-gray-500 mb-2 font-bold">
                  / {unit.max_score || 100} 問
                </span>
              </div>

              <button
                onClick={handleSubmitScore}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg transition transform active:scale-95"
              >
                採点完了・結果を保存
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 4. 完了画面 (Completed)
  // ---------------------------------------------------------
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-12 text-center animate-fade-in">
      <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl shadow-sm">
        ✅
      </div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">記録しました！</h2>
      
      <div className="bg-gray-50 rounded-xl p-6 mb-8 border border-gray-100 inline-block w-full max-w-sm">
        <div className="flex justify-between mb-2 border-b border-gray-200 pb-2">
            <span className="text-gray-500">正解数</span>
            <span className="text-xl font-bold text-blue-600">{scoreInput} 問</span>
        </div>
        <div className="flex justify-between">
            <span className="text-gray-500">かかった時間</span>
            <span className="text-xl font-bold text-gray-700">{formatTime(finalDuration)}</span>
        </div>
      </div>
      
      <div>
        <a href="/" className="text-gray-500 hover:text-blue-600 font-bold underline transition">
          科目一覧に戻る
        </a>
      </div>
    </div>
  );
}