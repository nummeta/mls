"use client";

import { useState, useRef, useEffect } from "react";
import { createSubject, deleteSubject, updateSubject } from "./actions";

type Subject = {
  id: string;
  name: string;
  sort_order: number;
  sections?: { count: number }[];
};

export default function SubjectAdminClient({ subjects }: { subjects: Subject[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  
  // ★編集中のデータを保持するステート (nullなら新規作成モード)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // フォームの入力値を管理するステート (編集ボタンを押した時に反映させるため)
  const [inputName, setInputName] = useState("");
  const [inputSortOrder, setInputSortOrder] = useState(10);

  // 編集モードが切り替わったらフォームの中身を変える
  useEffect(() => {
    if (editingSubject) {
      setInputName(editingSubject.name);
      setInputSortOrder(editingSubject.sort_order);
    } else {
      setInputName("");
      setInputSortOrder(10);
    }
  }, [editingSubject]);

  // 削除ハンドラ
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`科目「${name}」を本当に削除しますか？\n含まれる章や単元も消える可能性があります。`)) return;
    try {
      await deleteSubject(id);
      // もし編集中のやつを消したら、編集モードも解除
      if (editingSubject?.id === id) setEditingSubject(null);
    } catch (e) {
      alert("削除できませんでした");
    }
  };

  // 編集ボタンを押した時の処理
  const handleEditClick = (subject: Subject) => {
    setEditingSubject(subject);
    // 画面の一番上（フォーム）へスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      {/* 1. フォーム (新規・編集兼用) */}
      <div className={`p-6 rounded-xl shadow-sm border transition-colors
        ${editingSubject ? "bg-yellow-50 border-yellow-200" : "bg-white border-gray-200"}
      `}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-lg font-bold ${editingSubject ? "text-yellow-800" : "text-gray-800"}`}>
            {editingSubject ? "✏️ 科目を編集" : "✨ 新しい科目を追加"}
          </h2>
          {editingSubject && (
            <button 
              onClick={() => setEditingSubject(null)}
              className="text-sm text-gray-500 hover:text-gray-800 underline"
            >
              キャンセルして新規作成に戻る
            </button>
          )}
        </div>
        
        <form 
          ref={formRef}
          action={async (formData) => {
            if (editingSubject) {
              // 編集モード: updateを呼ぶ
              formData.append("id", editingSubject.id);
              await updateSubject(formData);
              setEditingSubject(null); // 完了したら新規モードに戻す
              alert("更新しました！");
            } else {
              // 新規モード: createを呼ぶ
              await createSubject(formData);
              alert("追加しました！");
            }
            // フォームのリセット
            setInputName("");
            setInputSortOrder(10);
          }}
          className="flex flex-col md:flex-row gap-4 items-end"
        >
          <div className="flex-1 w-full">
            <label className="block text-sm font-bold text-gray-700 mb-1">科目名</label>
            <input 
              name="name" 
              type="text" 
              placeholder="例: 数学I, 英文法" 
              required
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
            />
          </div>

          <div className="w-full md:w-32">
            <label className="block text-sm font-bold text-gray-700 mb-1">並び順</label>
            <input 
              name="sort_order" 
              type="number" 
              value={inputSortOrder}
              onChange={(e) => setInputSortOrder(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
            />
          </div>

          <button 
            type="submit" 
            className={`w-full md:w-auto px-6 py-2 rounded font-bold text-white transition
              ${editingSubject ? "bg-yellow-600 hover:bg-yellow-700" : "bg-blue-600 hover:bg-blue-700"}
            `}
          >
            {editingSubject ? "更新する" : "追加"}
          </button>
        </form>
      </div>

      {/* 2. 科目一覧リスト */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapters</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subjects.map((subject) => (
              <tr key={subject.id} className={`hover:bg-gray-50 ${editingSubject?.id === subject.id ? "bg-yellow-50" : ""}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {subject.sort_order}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  <a href={`/admin/subjects/${subject.id}`} className="text-blue-600 hover:underline flex items-center gap-2">
                    {subject.name}
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">章の管理へ →</span>
                  </a>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(subject.sections as any)?.[0]?.count || 0} 章
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  {/* ★編集ボタンを追加 */}
                  <button
                    onClick={() => handleEditClick(subject)}
                    className="text-yellow-600 hover:text-yellow-900 bg-yellow-50 px-3 py-1 rounded hover:bg-yellow-100 transition"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(subject.id, subject.name)}
                    className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded hover:bg-red-100 transition"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            
            {subjects.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-gray-400">
                  科目がまだ登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}