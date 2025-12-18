"use client";

import { useState, useEffect } from "react";
import "katex/dist/katex.min.css";
import LaTeX from "react-latex-next";
import { startSession, saveAttempt, completeSession } from "./actions"; // さっき作った関数
import { createClient } from "@supabase/supabase-js"; // Auth取得用

type Props = {
  unit: any;
  userId: string; // ★親からIDをもらうように変更
};

// 状態管理用の型定義
type LearningState = "idle" | "watching" | "testing" | "completed";

export default function LessonClient({ unit, userId }: Props) { // propsにuserIdを追加

  // ステータス管理
  const [status, setStatus] = useState<LearningState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // クイズロジック管理
  const [quizQueue, setQuizQueue] = useState<any[]>([]); // 出題待ちリスト
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [clearedTypeIds, setClearedTypeIds] = useState<Set<string>>(new Set()); // クリア済みのQuizType
  
  // UI表示管理
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

  // ■ 1. 学習開始ボタン
  const handleStart = async () => {
    if (!userId) return alert("ログインが必要です");
    
    // クイズキューの初期化（各タイプから1問ずつランダムにピックアップ）
    const initialQueue: any[] = [];
    unit.quiz_types.forEach((qt: any) => {
      if (qt.quizzes.length > 0) {
        // シャッフルして1つ選ぶ
        const randomQuiz = qt.quizzes[Math.floor(Math.random() * qt.quizzes.length)];
        // クイズオブジェクトに「親のタイプID」を埋め込んでおく（判定で使うため）
        initialQueue.push({ ...randomQuiz, _typeId: qt.id });
      }
    });

    setQuizQueue(initialQueue);
    
    // DBにセッション作成
    try {
      const session = await startSession(unit.id, userId);
      setSessionId(session.id);
      setStatus("watching"); // 動画モードへ
    } catch (e) {
      console.error(e);
      alert("開始できませんでした");
    }
  };

  // ■ 2. 動画完了ボタン
  const handleVideoComplete = () => {
    setStatus("testing"); // テストモードへ
  };

  // ■ 3. 回答クリック時の処理
  const handleAnswer = async (choice: any) => {
    if (selectedChoiceId || !userId || !sessionId) return; // 連打防止
    setSelectedChoiceId(choice.id);

    const currentQuiz = quizQueue[currentQuizIndex];
    const isCorrect = choice.is_correct;
    const typeId = currentQuiz._typeId;

    // A. 正解の場合
    if (isCorrect) {
      // このタイプをクリア済みに登録
      const newCleared = new Set(clearedTypeIds);
      newCleared.add(typeId);
      setClearedTypeIds(newCleared);
    } 
    // B. 不正解の場合（おかわり追加）
    else {
      // 同じタイプの問題リストを取得
      const typeData = unit.quiz_types.find((qt: any) => qt.id === typeId);
      if (typeData) {
        // 「まだキューに入っていない」または「ランダム」な問題を探す
        // 今回は簡易的に「ランダムに1問選んで最後尾に追加」します
        const retryQuiz = typeData.quizzes[Math.floor(Math.random() * typeData.quizzes.length)];
        
        // ReactのState更新（キューの最後に追加）
        setQuizQueue((prev) => [...prev, { ...retryQuiz, _typeId: typeId }]);
      }
    }

    // C. DBに保存（非同期で裏で実行）
    // クリア済みの数（今回正解なら+1した状態）を送る
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

  // ■ 4. 「次へ」ボタン
  const handleNext = async () => {
    setSelectedChoiceId(null); // 選択状態リセット

    // まだ問題があるか？
    if (currentQuizIndex < quizQueue.length - 1) {
      setCurrentQuizIndex((prev) => prev + 1);
    } else {
      // 全問終了！
      // もし全タイプクリアしてなければ（理論上はないはずだが）、ここでチェックも可能
      if (sessionId) await completeSession(sessionId);
      setStatus("completed");
    }
  };

  // --- 表示用データ ---
  const currentQuiz = quizQueue[currentQuizIndex];

  // --- JSX (画面描画) ---
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

  if (status === "watching") {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="relative bg-black aspect-video">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${unit.video_id || 'M5QY2_8704o'}`} // DBに動画IDがあればそれを使う
            title="Video"
            allowFullScreen
            className="absolute inset-0"
          />
        </div>
        <div className="p-6 text-right">
          <button
            onClick={handleVideoComplete}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 shadow"
          >
            動画を見終わったのでテストへ進む
          </button>
        </div>
      </div>
    );
  }

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

  // --- status === "testing" ---
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 text-gray-900">
      {/* 進捗バー */}
      <div className="mb-6 flex justify-between text-sm text-gray-500">
        <span>問 {currentQuizIndex + 1} / {quizQueue.length}</span>
        <span>クリア済みタイプ: {clearedTypeIds.size} / {unit.quiz_types.length}</span>
      </div>

      {/* 問題文 */}
      <div className="mb-8">
         <h2 className="text-xl font-bold mb-4">
           <LaTeX>{currentQuiz.question}</LaTeX>
         </h2>
      </div>

      {/* 選択肢 */}
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

      {/* 不正解時のおかわり通知 */}
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