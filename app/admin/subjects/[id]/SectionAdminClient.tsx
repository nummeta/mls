"use client";

import { useRef, useState, useEffect } from "react";
import { createSection, deleteSection, updateSection } from "./actions";

type Section = {
  id: string;
  name: string;
  sort_order: number;
  units: { count: number }[];
};

type Subject = {
  id: string;
  name: string;
  sections: Section[];
};

export default function SectionAdminClient({ subject }: { subject: Subject }) {
  const formRef = useRef<HTMLFormElement>(null);

  // ★編集中のデータを保持するステート
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  
  // フォーム入力値のステート
  const [inputName, setInputName] = useState("");
  const [inputSortOrder, setInputSortOrder] = useState(10);

  // 編集モード切り替え時にフォームに入力する
  useEffect(() => {
    if (editingSection) {
      setInputName(editingSection.name);
      setInputSortOrder(editingSection.sort_order);
    } else {
      setInputName("");
      setInputSortOrder(10);
    }
  }, [editingSection]);

  const handleDelete = async (id: string) => {
    if (!confirm("本当に削除しますか？\n含まれる単元も消える可能性があります。")) return;
    try {
      await deleteSection(id, subject.id);
      if (editingSection?.id === id) setEditingSection(null);
    } catch (e) {
      alert("削除できませんでした");
    }
  };

  const handleEditClick = (section: Section) => {
    setEditingSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      {/* 戻るリンク */}
      <a href="/admin/subjects" className="text-gray-500 hover:text-gray-900 text-sm font-bold inline-block">
        ← 科目一覧に戻る
      </a>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          「{subject.name}」の章管理
        </h1>
      </div>

      {/* 1. フォーム (新規・編集兼用) */}
      <div className={`p-6 rounded-xl shadow-sm border transition-colors
        ${editingSection ? "bg-yellow-50 border-yellow-200" : "bg-white border-gray-200"}
      `}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-lg font-bold ${editingSection ? "text-yellow-800" : "text-gray-800"}`}>
            {editingSection ? "✏️ 章を編集" : "✨ 新しい章を追加"}
          </h2>
          {editingSection && (
            <button 
              onClick={() => setEditingSection(null)}
              className="text-sm text-gray-500 hover:text-gray-800 underline"
            >
              キャンセルして新規作成に戻る
            </button>
          )}
        </div>
        
        <form 
          ref={formRef}
          action={async (formData) => {
            // 共通パラメータ
            formData.append("subject_id", subject.id);

            if (editingSection) {
              // 編集モード
              formData.append("id", editingSection.id);
              await updateSection(formData);
              setEditingSection(null);
              alert("更新しました！");
            } else {
              // 新規モード
              await createSection(formData);
              alert("追加しました！");
            }
            // フォームリセット
            setInputName("");
            setInputSortOrder(10);
          }}
          className="flex flex-col md:flex-row gap-4 items-end"
        >
          <div className="flex-1 w-full">
            <label className="block text-sm font-bold text-gray-700 mb-1">章の名前</label>
            <input 
              name="name" 
              type="text" 
              placeholder="例: 数と式, 二次関数" 
              required
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="w-full md:w-32">
            <label className="block text-sm font-bold text-gray-700 mb-1">並び順</label>
            <input 
              name="sort_order" 
              type="number" 
              value={inputSortOrder}
              onChange={(e) => setInputSortOrder(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button 
            type="submit" 
            className={`w-full md:w-auto px-6 py-2 rounded font-bold text-white transition
              ${editingSection ? "bg-yellow-600 hover:bg-yellow-700" : "bg-blue-600 hover:bg-blue-700"}
            `}
          >
            {editingSection ? "更新する" : "追加"}
          </button>
        </form>
      </div>

      {/* 2. リスト表示 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Units</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subject.sections
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((section) => (
              <tr key={section.id} className={`hover:bg-gray-50 ${editingSection?.id === section.id ? "bg-yellow-50" : ""}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {section.sort_order}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  {section.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(section.units as any)?.[0]?.count || 0} 単元
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleEditClick(section)}
                    className="text-yellow-600 hover:text-yellow-900 bg-yellow-50 px-3 py-1 rounded hover:bg-yellow-100 transition"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(section.id)}
                    className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded hover:bg-red-100 transition"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {subject.sections.length === 0 && (
              <tr><td colSpan={4} className="p-10 text-center text-gray-400">章がまだありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}