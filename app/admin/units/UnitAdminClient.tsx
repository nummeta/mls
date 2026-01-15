"use client";

import { useState, useRef, useEffect } from "react";
import { createUnit, deleteUnit, updateUnit } from "./actions";

// 型定義
type Unit = {
  id: string;
  name: string;
  type: string;
  sort_order: number;
  message?: string; // ポイント
  intro?: string;   // 冒頭
  outro?: string;   // 結び
};
type Section = { id: string; title?: string; name?: string; sort_order: number; units: Unit[] };
type Subject = { id: string; name: string; sort_order: number; sections: Section[] };

export default function UnitAdminClient({ subjects }: { subjects: Subject[] }) {
  const safeSubjects = subjects || [];

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(safeSubjects[0]?.id || "");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // 入力ステート
  const [inputName, setInputName] = useState("");
  const [inputType, setInputType] = useState("lecture");
  const [inputMessage, setInputMessage] = useState("");
  const [inputIntro, setInputIntro] = useState("");
  const [inputOutro, setInputOutro] = useState("");

  const activeSubject = safeSubjects.find(s => s.id === selectedSubjectId);
  const activeSections = activeSubject?.sections?.sort((a, b) => a.sort_order - b.sort_order) || [];

  // 編集モード切り替え
  useEffect(() => {
    if (editingUnit) {
      setInputName(editingUnit.name);
      setInputType(editingUnit.type);
      setInputMessage(editingUnit.message || "");
      setInputIntro(editingUnit.intro || "");
      setInputOutro(editingUnit.outro || "");
    } else {
      setInputName("");
      setInputType("lecture");
      setInputMessage("");
      setInputIntro("");
      setInputOutro("");
    }
  }, [editingUnit]);

  const handleDelete = async (id: string) => {
    if (!confirm("本当に削除しますか？")) return;
    try {
      await deleteUnit(id);
      if (editingUnit?.id === id) setEditingUnit(null);
    } catch (e) {
      alert("削除に失敗しました");
    }
  };

  const handleEditClick = (unit: Unit) => {
    setEditingUnit(unit);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      {/* 1. 場所選択エリア */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-gray-800 font-bold mb-4">どこに追加・編集しますか？</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">科目</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setSelectedSectionId("");
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
              disabled={!!editingUnit}
            >
              {safeSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              {safeSubjects.length === 0 && <option value="">科目がありません</option>}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">章</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
              disabled={!activeSections.length || !!editingUnit}
            >
              <option value="">章を選択してください</option>
              {activeSections.map(s => (
                <option key={s.id} value={s.id}>{s.name || s.title || "名称未設定"}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. フォームエリア */}
      {selectedSectionId && (
        <div className={`p-6 rounded-xl border animate-fade-in transition-colors
          ${editingUnit ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-100"}
        `}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`font-bold ${editingUnit ? "text-yellow-800" : "text-blue-800"}`}>
              {editingUnit ? "✏️ コンテンツを編集" : "✨ 新規コンテンツを追加"}
            </h2>
            {editingUnit && (
              <button
                onClick={() => setEditingUnit(null)}
                className="text-sm text-gray-500 hover:text-gray-800 underline"
              >
                キャンセルして新規作成に戻る
              </button>
            )}
          </div>

          <form
            ref={formRef}
            action={async (formData) => {
              setIsUploading(true);
              try {
                formData.append("section_id", selectedSectionId);
                if (editingUnit) {
                  formData.append("id", editingUnit.id);
                  await updateUnit(formData);
                  setEditingUnit(null);
                  alert("更新しました！");
                } else {
                  await createUnit(formData);
                  alert("追加しました！");
                }
                formRef.current?.reset();
                setInputName("");
                setInputMessage("");
                setInputIntro("");
                setInputOutro("");
              } catch (e: any) {
                alert(e.message || "エラーが発生しました");
              } finally {
                setIsUploading(false);
              }
            }}
            className="space-y-6"
          >
            {/* 基本情報 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">単元名</label>
                <input
                  name="name"
                  type="text"
                  required
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">タイプ</label>
                  <select
                    name="type"
                    value={inputType}
                    onChange={(e) => setInputType(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="lecture">📺 動画講義</option>
                    <option value="test">✍️ 確認テスト</option>
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-sm font-bold text-gray-700 mb-1">並び順</label>
                  <input
                    name="sort_order"
                    type="number"
                    defaultValue={editingUnit?.sort_order || 10}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* メッセージ設定エリア */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
              <h3 className="text-sm font-bold text-gray-500 border-b pb-2 mb-2">メッセージ設定</h3>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  💡 学習のポイント (Message)
                  <span className="text-xs font-normal text-gray-400 ml-2">一覧や概要欄に表示</span>
                </label>
                <textarea
                  name="message"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                  placeholder="例: 三平方の定理の基本をマスターしよう！"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    🏁 冒頭の挨拶 (Intro)
                    <span className="text-xs font-normal text-gray-400 ml-2">開始時に表示</span>
                  </label>
                  <textarea
                    name="intro"
                    value={inputIntro}
                    onChange={(e) => setInputIntro(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    rows={3}
                    placeholder="例: 今日は直角三角形の秘密に迫ります。"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    🎉 結びの挨拶 (Outro)
                    <span className="text-xs font-normal text-gray-400 ml-2">完了時に表示</span>
                  </label>
                  <textarea
                    name="outro"
                    value={inputOutro}
                    onChange={(e) => setInputOutro(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    rows={3}
                    placeholder="例: お疲れ様でした！次は練習問題です。"
                  />
                </div>
              </div>
            </div>

            {/* ファイル - タイプによって表示を変更 */}
            {inputType === 'test' ? (
              /* テスト単元: 問題PDF + 解答PDF */
              <div className="bg-white p-4 rounded border border-dashed border-gray-400 space-y-4">
                <p className="text-sm font-bold text-gray-700">
                  📄 テスト用ファイル {editingUnit ? "(変更する場合のみアップロード)" : ""}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-1">
                      📝 問題PDF
                    </label>
                    <input type="file" name="question_file" accept=".pdf" className="w-full text-gray-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-1">
                      ✅ 解答PDF
                    </label>
                    <input type="file" name="answer_file" accept=".pdf" className="w-full text-gray-700" />
                  </div>
                </div>
              </div>
            ) : (
              /* 動画講義: 動画mp4 */
              <div className="bg-white p-4 rounded border border-dashed border-gray-400">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  🎬 動画ファイル {editingUnit ? "(変更する場合のみアップロード)" : "(mp4)"}
                </label>
                <input type="file" name="file" accept=".mp4" className="w-full text-gray-700" />
              </div>
            )}

            <button
              type="submit"
              disabled={isUploading}
              className={`w-full py-3 rounded-lg font-bold text-white shadow transition
                ${isUploading ? "bg-gray-400 cursor-wait" :
                  editingUnit ? "bg-yellow-600 hover:bg-yellow-700" : "bg-blue-600 hover:bg-blue-700"}
              `}
            >
              {isUploading ? "処理中... (閉じないでください)" :
                editingUnit ? "変更を保存する" : "この内容で追加する"}
            </button>
          </form>
        </div>
      )}

      {/* 3. リスト */}
      {selectedSectionId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h3 className="font-bold text-gray-700">登録済みコンテンツ一覧</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="bg-white divide-y divide-gray-200">
              {activeSections.find(s => s.id === selectedSectionId)?.units
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((unit) => (
                  <tr key={unit.id} className={`hover:bg-gray-50 ${editingUnit?.id === unit.id ? "bg-yellow-50" : ""}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 w-10">
                      {unit.type === 'test' ? '✍️' : '📺'}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                      <div>{unit.name}</div>
                      <div className="text-xs text-gray-400 font-normal mt-1 truncate max-w-xs">
                        {unit.message || unit.intro || "メッセージなし"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">

                      {/* ★追加: 動画講義の場合のみ「クイズ入稿」リンクを表示 */}
                      {unit.type !== 'test' && (
                        <a
                          href={`/admin/units/${unit.id}/quizzes`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition mr-2"
                        >
                          ❓ クイズ入稿
                        </a>
                      )}

                      <button
                        onClick={() => handleEditClick(unit)}
                        className="text-yellow-600 hover:text-yellow-900 bg-yellow-50 px-3 py-1 rounded hover:bg-yellow-100 transition"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(unit.id)}
                        className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded hover:bg-red-100 transition"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}

              {activeSections.find(s => s.id === selectedSectionId)?.units.length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-gray-400">まだコンテンツがありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}