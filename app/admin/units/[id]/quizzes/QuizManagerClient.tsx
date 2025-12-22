"use client";

import { useState } from "react";
import { importQuizData, deleteQuizType } from "./actions";
import Latex from "react-latex-next";
import "katex/dist/katex.min.css";

type Choice = { id: string; answer_text: string; is_correct: boolean; explanation: string };
type Quiz = { id: string; question: string; choices: Choice[] };
type QuizType = { id: string; topic: string; quizzes: Quiz[] };

export default function QuizManagerClient({ 
  unitId, 
  unitName, 
  quizTypes 
}: { 
  unitId: string; 
  unitName: string; 
  quizTypes: QuizType[] 
}) {
  const [jsonInput, setJsonInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // プレースホルダー（入力例）
  const placeholder = `[
  {
    "topic": "二次関数の平行移動",
    "quizzes": [
      {
        "question": "関数 $y=x^2$ をx軸方向に2平行移動したグラフの式は？",
        "choices": [
          { "answer_text": "$y=(x-2)^2$", "is_correct": true, "explanation": "xの代わりにx-2を代入します" },
          { "answer_text": "$y=(x+2)^2$", "is_correct": false, "explanation": "それは-2移動した場合です" }
        ]
      }
    ]
  }
]`;

  const handleImport = async () => {
    if (!jsonInput.trim()) return;
    if (!confirm("入力されたJSONデータを取り込みますか？")) return;
    
    setIsUploading(true);
    try {
      await importQuizData(unitId, jsonInput);
      alert("登録完了しました！");
      setJsonInput(""); // 入力欄をクリア
    } catch (e: any) {
      alert("エラー: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このトピックと含まれる問題を全て削除しますか？")) return;
    try {
      await deleteQuizType(id, unitId);
    } catch (e) {
      alert("削除失敗");
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* ナビゲーション */}
      <div className="flex items-center gap-4">
        <a href="/admin/units" className="text-gray-500 hover:text-gray-900 font-bold text-sm">
          ← 単元管理に戻る
        </a>
      </div>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800">
          「{unitName}」のクイズ管理
        </h1>
        <p className="text-gray-500 text-sm mt-1">
           動画学習後に表示される理解度チェッククイズを管理します。
        </p>
      </div>

      {/* 1. 一括登録エリア */}
      <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-sm">
        <h2 className="text-lg font-bold text-blue-900 mb-2">📥 JSONデータ一括登録</h2>
        <p className="text-sm text-gray-600 mb-4">
          以下の形式でJSONデータを貼り付けてください。Latex記法（$x^2$など）も使用可能です。
        </p>
        
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={placeholder}
          className="w-full h-80 font-mono text-sm p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-inner text-gray-900 bg-gray-50"
        />
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleImport}
            disabled={isUploading || !jsonInput}
            className={`px-8 py-3 rounded-lg font-bold text-white transition shadow
              ${isUploading || !jsonInput ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}
            `}
          >
            {isUploading ? "インポート中..." : "データを登録する"}
          </button>
        </div>
      </div>

      {/* 2. 登録済みデータ一覧 */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          登録済みトピック一覧
          <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {quizTypes.length}件
          </span>
        </h2>
        
        {quizTypes.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
            登録されたクイズデータはありません
          </div>
        )}

        {quizTypes.map((qt) => (
          <div key={qt.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* トピックヘッダー */}
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Quiz Type (Topic)</span>
                <h3 className="text-lg font-bold text-gray-800">{qt.topic}</h3>
              </div>
              <button 
                onClick={() => handleDelete(qt.id)}
                className="text-sm text-red-600 hover:text-red-900 bg-white border border-red-200 px-4 py-2 rounded hover:bg-red-50 transition"
              >
                削除
              </button>
            </div>

            {/* 問題リスト */}
            <div className="divide-y divide-gray-100">
              {qt.quizzes.map((q, i) => (
                <div key={q.id} className="p-6">
                  <div className="flex gap-3 mb-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                      Q{i+1}
                    </span>
                    <div className="text-gray-900 font-medium pt-1">
                      <Latex>{q.question}</Latex>
                    </div>
                  </div>

                  <div className="pl-11 space-y-2">
                    {q.choices.map((c) => (
                      <div key={c.id} className={`text-sm p-3 rounded border ${c.is_correct ? "bg-green-50 border-green-200" : "bg-white border-gray-100"}`}>
                        <div className="flex items-start gap-2">
                          <span className={`font-bold ${c.is_correct ? "text-green-600" : "text-gray-300"}`}>
                            {c.is_correct ? "正解" : "不正解"}
                          </span>
                          <div className="text-gray-700">
                             <Latex>{c.answer_text}</Latex>
                          </div>
                        </div>
                        {c.explanation && (
                          <div className="mt-2 text-gray-500 text-xs pl-10 border-l-2 border-gray-200 ml-1">
                             💡 解説: <Latex>{c.explanation}</Latex>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {qt.quizzes.length === 0 && (
                <div className="p-6 text-gray-400 text-sm italic">問題が登録されていません</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}