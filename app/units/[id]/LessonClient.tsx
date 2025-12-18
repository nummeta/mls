"use client";

import { useState } from "react";
import "katex/dist/katex.min.css";
import LaTeX from "react-latex-next";
import { startSession, saveAttempt, completeSession } from "./actions";

type Props = {
  unit: any;     // Supabaseから取得した単元データ
  userId: string; // ログインユーザーのID
};

export default function LessonClient({ unit, userId }: Props) {
  // ステータス管理: 待機中 -> 動画視聴中 -> テスト中 -> 完了
  const [status, setStatus] = useState<"idle" | "watching" | "testing" | "completed">("idle");
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [quizQueue, setQuizQueue] = useState<any[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [clearedTypeIds, setClearedTypeIds] = useState<Set<string>>(new Set());
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

  // ■ 1. 学習開始ボタン
  const handleStart = async () => {
    if (!userId) return alert("ログインエラー: IDが見つかりません");

    // クイズキューの初期化（各タイプから1問ずつランダムに選出）
    const initialQueue: any[] = [];
    unit.quiz_types.forEach((qt: any) => {
      if (qt.quizzes.length > 0) {
        const randomQuiz = qt.quizzes[Math.floor(Math.random() * qt.quizzes.length)];
        // _typeId を持たせておくことで、後で「おかわり」を作る時に使える
        initialQueue.push({ ...randomQuiz, _typeId: qt.id });
      }
    });
    setQuizQueue(initialQueue);

    try {
      // サーバーアクション: セッション作成
      const session = await startSession(unit.id, userId);
      setSessionId(session.id);
      setStatus("watching");
    } catch (e) {
      console.error(e);
      alert("開始できませんでした");
    }
  };

  // ■ 2. 動画完了時（再生終了 or スキップボタン）
  const handleVideoComplete = () => {
    setStatus("testing");
  };

  // ■ 3. 回答を選択した時
  const handleAnswer = async (choice: any) => {
    if (selectedChoiceId || !sessionId) return; // 二重回答防止
    setSelectedChoiceId(choice.id);

    const currentQuiz = quizQueue[currentQuizIndex];
    const isCorrect = choice.is_correct;
    const typeId = currentQuiz._typeId;

    if (isCorrect) {
      // 正解ならクリアリストに追加
      const newCleared = new Set(clearedTypeIds);
      newCleared.add(typeId);
      setClearedTypeIds(newCleared);
    } else {
      // 不正解なら「おかわり」を追加（類題ロードロジック）
      const typeData = unit.quiz_types.find((qt: any) => qt.id === typeId);
      if (typeData) {
        // 同じタイプからランダムに1問選んでキューの末尾に追加
        const retryQuiz = typeData.quizzes[Math.floor(Math.random() * typeData.quizzes.length)];
        setQuizQueue((prev) => [...prev, { ...retryQuiz, _typeId: typeId }]);
      }
    }

    // サーバーアクション: 回答保存
    const currentClearedCount = isCorrect ? clearedTypeIds.size + 1 : clearedTypeIds.size;
    
    await saveAttempt(
      sessionId,
      userId,
      currentQuiz.id,
      choice.id,
      isCorrect,
      unit.id,
      currentClearedCount,
      unit.quiz_types.length
    );
  };

  // ■ 4. 次の問題へ
  const handleNext = async () => {
    setSelectedChoiceId(null);
    if (currentQuizIndex < quizQueue.length - 1) {
      setCurrentQuizIndex((prev) => prev + 1);
    } else {
      // 全問終了時
      if (sessionId) await completeSession(sessionId);
      setStatus("completed");
    }
  };

  // --- 表示部分 (JSX) ---

  // 1. 待機画面
  if (status === "idle") {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-12 text-center">
        <h1 className="text-3xl font-bold mb-4">{unit.name}</h1>
        <p className="text-gray-600 mb-8">{unit.intro || "学習を始めましょう！"}</p>
        <button 
          onClick={handleStart}
          className="bg-blue-600 text-white px-10 py-4 rounded-full text-xl font-bold hover:bg-blue-700 shadow-xl transition transform hover:scale-105"
        >
          学習を開始する
        </button>
      </div>
    );
  }

  // 2. 動画視聴画面（Supabase Storage対応版）
  if (status === "watching") {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="relative bg-black aspect-video flex items-center justify-center">
          {/* Native Video Player */}
          {unit.video_url ? (
            <video
              src={unit.video_url}
              controls               // 再生コントローラーを表示
              autoPlay               // 自動再生
              className="w-full h-full"
              onEnded={handleVideoComplete} // 再生終了したら自動でクイズへ
              controlsList="nodownload"     // ダウンロードボタンを隠す（簡易保護）
              playsInline                   // スマホで全画面強制しない
            >
              <p className="text-white">お使いのブラウザは動画再生に対応していません。</p>
            </video>
          ) : (
            <div className="text-white text-center">
              <p className="text-xl font-bold">動画が見つかりません</p>
              <p className="text-sm opacity-80 mt-2">管理画面でvideo_urlを設定してください</p>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-gray-50 flex justify-end items-center border-t">
          <p className="text-sm text-gray-500 mr-4">
            ※ 再生が終わると自動でクイズに進みます
          </p>
          <button
            onClick={handleVideoComplete}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-300 transition"
          >
            スキップしてテストへ
          </button>
        </div>
      </div>
    );
  }

  // 3. 完了画面
  if (status === "completed") {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-12 text-center animate-fade-in">
        <h1 className="text-4xl font-bold text-green-600 mb-4">🎉 学習完了！</h1>
        <p className="text-gray-700 text-lg mb-8">
          お疲れ様でした。この単元の学習は完了です。<br/>
          すべてのクイズタイプをマスターしました！
        </p>
        <a href="/" className="text-blue-600 hover:underline font-bold">
          科目一覧に戻る
        </a>
      </div>
    );
  }

  // 4. クイズ画面（ここから下は変更なし）
  const currentQuiz = quizQueue[currentQuizIndex];
  
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 text-gray-900">
      <div className="mb-6 flex justify-between text-sm text-gray-500">
        <span>問 {currentQuizIndex + 1} / {quizQueue.length}</span>
        <span>クリア済みタイプ: {clearedTypeIds.size} / {unit.quiz_types.length}</span>
      </div>

      <div className="mb-8">
         <h2 className="text-xl font-bold mb-4">
           {/* 数式対応 */}
           <LaTeX>{currentQuiz.question}</LaTeX>
         </h2>
      </div>

      <div className="space-y-4">
        {currentQuiz.choices.map((choice: any) => {
          const isSelected = selectedChoiceId === choice.id;
          const isCorrect = choice.is_correct;
          const isAnswered = !!selectedChoiceId;

          let containerClass = "border-2 p-4 rounded-lg text-left transition-all w-full block ";
          let showExplanation = false;

          if (!isAnswered) {
             containerClass += "border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer";
          } else {
             if (isCorrect) {
               containerClass += "bg-green-50 border-green-500 text-green-900";
               showExplanation = true;
             } else if (isSelected) {
               containerClass += "bg-red-50 border-red-500 text-red-900";
               showExplanation = true;
             } else {
               containerClass += "border-gray-100 text-gray-400 opacity-50";
             }
          }

          return (
            <button
              key={choice.id}
              onClick={() => handleAnswer(choice)}
              disabled={isAnswered}
              className={containerClass}
            >
              <div className="flex justify-between items-center">
                 <span className="font-bold text-lg"><LaTeX>{choice.answer_text}</LaTeX></span>
                 {isAnswered && isCorrect && <span className="text-green-600 font-bold">◎ 正解</span>}
                 {isAnswered && isSelected && !isCorrect && <span className="text-red-600 font-bold">× 不正解</span>}
              </div>
              
              {showExplanation && (
                <div className="mt-2 pt-2 border-t border-black/10 text-sm">
                  <span className="font-bold">解説: </span>
                  <LaTeX>{choice.explanation || "解説なし"}</LaTeX>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedChoiceId && (
        <div className="mt-8 text-center animate-fade-in">
          {(() => {
             const choice = currentQuiz.choices.find((c: any) => c.id === selectedChoiceId);
             if (choice && !choice.is_correct) {
               return (
                 <p className="text-red-600 font-bold mb-4 bg-red-50 inline-block px-4 py-2 rounded">
                   ⚠️ 不正解！同じタイプの問題が追加されました。
                 </p>
               );
             }
             return (
                <p className="text-green-600 font-bold mb-4">
                   ✨ ナイス！このタイプはクリアです。
                </p>
             );
          })()}
          
          <div className="mt-4">
            <button
              onClick={handleNext}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg"
            >
              次の問題へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}