"use client";

import { useState, useRef } from "react";
import { createUnit, deleteUnit } from "./actions";

// 型定義
// Sectionのタイトルは DBのカラム名変更の経緯を考慮して name と title 両方許容するようにしています
type Unit = { id: string; name: string; type: string; sort_order: number };
type Section = { id: string; title?: string; name?: string; sort_order: number; units: Unit[] };
type Subject = { id: string; name: string; sort_order: number; sections: Section[] };

export default function UnitAdminClient({ subjects }: { subjects: Subject[] }) {
  // ★重要修正: subjects が null や undefined だった場合に空配列として扱う
  // これで .find エラーや .map エラーを完全に防ぎます
  const safeSubjects = subjects || [];

  // 初期値設定: safeSubjects を使う
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(safeSubjects[0]?.id || "");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 選択中の科目データを取得 (safeSubjects から探す)
  const activeSubject = safeSubjects.find(s => s.id === selectedSubjectId);
  
  // 選択中の科目に含まれる章リスト
  // activeSubject が undefined の場合や、sections が null の場合も考慮して [] にフォールバック
  const activeSections = activeSubject?.sections?.sort((a, b) => a.sort_order - b.sort_order) || [];

  // 削除ハンドラ
  const handleDelete = async (id: string) => {
    if(!confirm("本当に削除しますか？")) return;
    try {
      await deleteUnit(id);
    } catch (e) {
      alert("削除に失敗しました");
    }
  };

  return (
    <div className="space-y-8">
      
      {/* 1. 場所選択エリア */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-gray-800 font-bold mb-4">どこに追加しますか？</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* 科目選択 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">科目</label>
            <select 
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setSelectedSectionId(""); // 科目が変わったら章選択をリセット
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
            >
              {safeSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              {safeSubjects.length === 0 && <option value="">科目がありません</option>}
            </select>
          </div>

          {/* 章選択 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">章</label>
            <select 
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
              disabled={!activeSections.length}
            >
              <option value="">章を選択してください</option>
              {activeSections.map(s => (
                // DBのカラム名が title か name かどちらでも対応できるように OR を使用
                <option key={s.id} value={s.id}>{s.name || s.title || "名称未設定"}</option>
              ))}
            </select>
            {activeSubject && activeSections.length === 0 && (
              <p className="text-xs text-red-500 mt-1">※ この科目にはまだ章がありません。先に章を作成してください。</p>
            )}
          </div>
        </div>
      </div>

      {/* 2. 追加フォーム（章が選択されたら表示） */}
      {selectedSectionId && (
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 animate-fade-in">
          <h2 className="text-blue-800 font-bold mb-4">✨ 新規コンテンツを追加</h2>
          
          <form 
            ref={formRef}
            action={async (formData) => {
              setIsUploading(true);
              try {
                await createUnit(formData);
                formRef.current?.reset();
                alert("追加しました！");
              } catch(e: any) {
                alert(e.message || "エラーが発生しました");
              } finally {
                setIsUploading(false);
              }
            }}
            className="space-y-4"
          >
            {/* 隠しフィールド: どの章に追加するか */}
            <input type="hidden" name="section_id" value={selectedSectionId} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">単元名</label>
                <input 
                  name="name" 
                  type="text" 
                  required 
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="例: 平方根の計算" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">タイプ</label>
                <select name="type" className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="lecture">📺 動画講義</option>
                  <option value="test">✍️ 確認テスト</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">説明文</label>
              <textarea 
                name="description" 
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                rows={2} 
                placeholder="生徒へのメッセージなど" 
              />
            </div>

            <div className="bg-white p-4 rounded border border-dashed border-gray-400">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                ファイルアップロード (動画mp4 または 解答PDF)
              </label>
              <input type="file" name="file" accept=".mp4,.pdf" className="w-full text-gray-700" />
              <p className="text-xs text-gray-400 mt-1">
                ※ 動画なら「動画講義」、PDFなら「確認テストの解答」として自動処理されます。
              </p>
            </div>

            <button 
              type="submit" 
              disabled={isUploading}
              className={`w-full py-3 rounded-lg font-bold text-white shadow transition
                ${isUploading ? "bg-gray-400 cursor-wait" : "bg-blue-600 hover:bg-blue-700"}
              `}
            >
              {isUploading ? "アップロード中... (閉じないでください)" : "この内容で追加する"}
            </button>
          </form>
        </div>
      )}

      {/* 3. 登録済みリスト（選択中の章のものだけ表示） */}
      {selectedSectionId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h3 className="font-bold text-gray-700">登録済みコンテンツ一覧</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="bg-white divide-y divide-gray-200">
              {/* activeSections から現在選択中の章を探し、その中の units を表示 */}
              {activeSections.find(s => s.id === selectedSectionId)?.units
                .sort((a,b) => a.sort_order - b.sort_order)
                .map((unit) => (
                <tr key={unit.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 w-10">
                    {unit.type === 'test' ? '✍️' : '📺'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {unit.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleDelete(unit.id)} 
                      className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded hover:bg-red-100 transition"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
              
              {/* コンテンツが何もない場合の表示 */}
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