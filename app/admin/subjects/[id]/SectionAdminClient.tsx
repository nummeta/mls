"use client";

import { useRef } from "react";
import { createSection, deleteSection } from "./actions";

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

  const handleDelete = async (id: string) => {
    if (!confirm("本当に削除しますか？\n含まれる単元も消える可能性があります。")) return;
    try {
      await deleteSection(id, subject.id);
    } catch (e) {
      alert("削除できませんでした");
    }
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

      {/* 1. 新規追加フォーム */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-4">✨ 新しい章を追加</h2>
        
        <form 
          ref={formRef}
          action={async (formData) => {
            await createSection(formData);
            formRef.current?.reset();
          }}
          className="flex flex-col md:flex-row gap-4 items-end"
        >
          <input type="hidden" name="subject_id" value={subject.id} />

          <div className="flex-1 w-full">
            <label className="block text-sm font-bold text-gray-700 mb-1">章の名前</label>
            <input 
              name="name" 
              type="text" 
              placeholder="例: 数と式, 二次関数" 
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="w-full md:w-32">
            <label className="block text-sm font-bold text-gray-700 mb-1">並び順</label>
            <input 
              name="sort_order" 
              type="number" 
              defaultValue={10} 
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button 
            type="submit" 
            className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition"
          >
            追加
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
              <tr key={section.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {section.sort_order}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  {section.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(section.units as any)?.[0]?.count || 0} 単元
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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