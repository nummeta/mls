"use client";

import { useState, useMemo, useEffect } from "react";
import { startSession, completeSession, saveAttempt } from "./actions";
import { createClient } from "@/utils/supabase/client";
import Latex from "react-latex-next";
import "katex/dist/katex.min.css";

// --- 型定義 ---
type Choice = {
  id: string;
  answer_text: string;
  is_correct: boolean;
  explanation: string;
};
type Quiz = {
  id: string;
  question: string;
  choices: Choice[];
};
type QuizType = {
  id: string;
  topic: string;
  quizzes: Quiz[];
};
type Unit = {
  id: string;
  name: string;
  video_url: string | null;
  intro?: string;
  outro?: string;
  quiz_types?: QuizType[];
};
type Score = {
  progress_rate: number;
  is_completed: boolean;
};
type QuizWithMeta = Quiz & { typeId: string; typeTopic: string };

export default function LessonClient({ 
  unit, 
  userId, 
  score 
}: { 
  unit: Unit; 
  userId: string; 
  score: Score | null;
}) {
  const supabase = createClient();
  const isAlreadyCompleted = !!score?.is_completed || (score?.progress_rate === 1);

  const [step, setStep] = useState<'intro' | 'video' | 'quiz' | 'outro'>('intro');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // ★修正: エラーログを出力するように強化
  useEffect(() => {
    const updateStatus = async () => {
      console.log("Updating status...", unit.id);
      
      const { error } = await supabase.from("profiles").update({
        current_unit_id: unit.id,
        last_seen_at: new Date().toISOString(),
      }).eq("id", userId);

      if (error) {
        console.error("ステータス更新エラー:", error);
        // 開発中のみアラートを出す（原因特定のため）
        // alert(`ステータス更新エラー: ${error.message}`); 
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 60000);
    return () => clearInterval(interval);
  }, [unit.id, userId]);

  // --- クイズロジック (変更なし) ---
  const allPoolQuizzes = useMemo(() => {
    const list: QuizWithMeta[] = [];
    unit.quiz_types?.forEach(qt => {
      qt.quizzes.forEach(q => {
        list.push({ ...q, typeId: qt.id, typeTopic: qt.topic });
      });
    });
    return list;
  }, [unit]);

  const [quizQueue, setQuizQueue] = useState<QuizWithMeta[]>(() => {
    const initialSet: QuizWithMeta[] = [];
    unit.quiz_types?.forEach(qt => {
      if (qt.quizzes.length > 0) {
        initialSet.push({ ...qt.quizzes[0], typeId: qt.id, typeTopic: qt.topic });
      }
    });
    return initialSet;
  });

  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isQuizAdded, setIsQuizAdded] = useState(false);
  
  const currentQuiz = quizQueue[currentQuizIndex];

  const handleStart = async () => {
    try {
      const session = await startSession(unit.id, userId);
      setCurrentSessionId(session.id);
      setStep('video'); 
    } catch (e) {
      console.error(e);
      alert("セッション開始エラー");
      setStep('video'); 
    }
  };

  const handleVideoEnd = () => {
    if (quizQueue.length > 0) {
      setStep('quiz');
      setCurrentQuizIndex(0);
      resetQuizState();
    } else {
      handleComplete();
    }
  };

  const resetQuizState = () => {
    setSelectedChoiceId(null);
    setShowExplanation(false);
    setIsQuizAdded(false);
  };

  const handleAnswer = async (choice: Choice) => {
    if (showExplanation || !currentQuiz) return;

    setSelectedChoiceId(choice.id);
    setShowExplanation(true);

    if (!choice.is_correct) {
      let candidates = allPoolQuizzes.filter(q => 
        q.typeId === currentQuiz.typeId && 
        !quizQueue.some(queued => queued.id === q.id) 
      );
      if (candidates.length === 0) {
        candidates = allPoolQuizzes.filter(q => q.typeId === currentQuiz.typeId);
      }
      if (candidates.length > 0) {
        const nextQuiz = candidates[Math.floor(Math.random() * candidates.length)];
        setQuizQueue(prev => [...prev, nextQuiz]);
        setIsQuizAdded(true);
      }
    }

    if (currentSessionId) {
      await saveAttempt(
        currentSessionId, 
        userId, 
        currentQuiz.id, 
        choice.id, 
        choice.is_correct, 
        unit.id, 
        0, 0 
      );
    }
  };

  const handleNextQuiz = () => {
    if (currentQuizIndex < quizQueue.length - 1) {
      setCurrentQuizIndex(prev => prev + 1);
      resetQuizState();
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (currentSessionId) {
      await completeSession(currentSessionId);
    }
    setStep('outro');
  };

  const handleRetry = () => {
    setStep('intro');
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h1 className="text-2xl font-extrabold text-gray-900">{unit.name}</h1>
        {isAlreadyCompleted && (
          <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">
            COMPLETED
          </span>
        )}
      </div>

      <div className="p-6">
        
        {/* Intro */}
        {step === 'intro' && (
          <div className="text-center py-10 space-y-6">
            <div className="text-6xl mb-4">📺</div>
            <h2 className="text-xl font-bold text-gray-800">学習を始めましょう</h2>
            <p className="text-gray-600 max-w-lg mx-auto leading-relaxed whitespace-pre-wrap">
              <Latex>{unit.intro || "準備はいいですか？"}</Latex>
            </p>
            <button 
              onClick={handleStart}
              className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700 transition transform hover:-translate-y-0.5"
            >
              学習スタート
            </button>
          </div>
        )}

        {/* Video */}
        {step === 'video' && (
          <div className="space-y-6 animate-fade-in">
            {unit.video_url ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
                <video 
                  src={unit.video_url} 
                  controls 
                  className="w-full h-full"
                  onEnded={handleVideoEnd} 
                />
              </div>
            ) : (
              <div className="p-10 text-center bg-gray-100 rounded text-gray-500">
                動画なし
              </div>
            )}
            
            <div className="text-center">
              <button 
                onClick={handleVideoEnd}
                className="text-gray-400 text-sm underline hover:text-gray-600"
              >
                スキップしてクイズへ
              </button>
            </div>
          </div>
        )}

        {/* Quiz */}
        {step === 'quiz' && currentQuiz && (
          <div className="animate-fade-in max-w-2xl mx-auto">
            <div className="mb-4 flex justify-between items-center text-sm text-gray-500 font-bold">
              <span>理解度チェック: Q{currentQuizIndex + 1} / {quizQueue.length}</span>
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 mb-6 p-4 bg-gray-50 rounded-lg">
              <Latex>{currentQuiz.question}</Latex>
            </h3>

            <div className="space-y-3">
              {currentQuiz.choices.map((choice) => {
                let btnClass = "w-full p-4 rounded-lg border-2 text-left transition relative ";
                
                if (selectedChoiceId === choice.id) {
                  btnClass += choice.is_correct 
                    ? "border-green-500 bg-green-100 text-green-900 font-bold" 
                    : "border-red-500 bg-red-100 text-red-900 font-bold";     
                } else if (showExplanation && choice.is_correct) {
                  btnClass += "border-green-500 bg-green-50 text-green-900"; 
                } else {
                  btnClass += "border-gray-200 text-gray-900 hover:border-blue-400 hover:bg-blue-50"; 
                }

                return (
                  <button
                    key={choice.id}
                    onClick={() => handleAnswer(choice)}
                    disabled={showExplanation}
                    className={btnClass}
                  >
                    <div className="pr-8">
                      <Latex>{choice.answer_text}</Latex>
                    </div>

                    {showExplanation && choice.is_correct && (
                      <span className="absolute right-4 top-4 text-green-600 font-bold">◎</span>
                    )}
                    {selectedChoiceId === choice.id && !choice.is_correct && (
                      <span className="absolute right-4 top-4 text-red-600 font-bold">✕</span>
                    )}
                  </button>
                );
              })}
            </div>

            {showExplanation && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 animate-slide-up">
                <p className="font-bold text-blue-900 mb-2">
                  {selectedChoiceId && currentQuiz.choices.find(c => c.id === selectedChoiceId)?.is_correct 
                    ? "正解！" 
                    : "残念..."}
                </p>
                <div className="text-blue-800 text-sm mb-4">
                  <Latex>{currentQuiz.choices.find(c => c.is_correct)?.explanation || "解説はありません"}</Latex>
                </div>
                
                {selectedChoiceId && !currentQuiz.choices.find(c => c.id === selectedChoiceId)?.is_correct && isQuizAdded && (
                   <p className="text-xs text-red-500 font-bold mb-4">
                     ※ 理解を深めるため、同じトピックから問題を追加しました。
                   </p>
                )}

                <button
                  onClick={handleNextQuiz}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
                >
                  {currentQuizIndex < quizQueue.length - 1 ? "次の問題へ" : "結果を見る"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Outro */}
        {step === 'outro' && (
          <div className="text-center py-10 space-y-6 animate-fade-in">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900">学習完了！</h2>
            <p className="text-gray-600 max-w-lg mx-auto leading-relaxed whitespace-pre-wrap">
              <Latex>{unit.outro || "お疲れ様でした！"}</Latex>
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <button 
                onClick={handleRetry}
                className="bg-white border-2 border-blue-600 text-blue-600 px-6 py-2 rounded-full font-bold hover:bg-blue-50 transition"
              >
                最初から復習する
              </button>
              <button disabled className="bg-gray-100 text-gray-400 px-6 py-2 rounded-full font-bold cursor-default">
                完了済み
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}