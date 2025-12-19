"use client";

import { useRef } from "react";
import { createSubject, deleteSubject } from "./actions";

type Subject = {
  id: string;
  name: string;
  sort_order: number;
  sections?: { count: number }[]; // 章の数（カウント用）
};

export default function SubjectAdminClient({ subjects }: { subjects: Subject[] }) {
  const formRef = useRef<HTMLFormElement>(null);

  // 削除ハンドラ
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`科目「${name}」を本当に削除しますか？\n含まれる章や単元も消える可能性があります。`)) return;
    
    try {
      await deleteSubject(id);
    } catch (e) {
      alert("削除できませんでした");
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. 新規追加フォーム */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-4">✨ 新しい科目を追加</h2>
        
        <form 
          ref={formRef}
          action={async (formData) => {
            await createSubject(formData);
            formRef.current?.reset(); // 送信後にフォームを空にする
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
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
            />
          </div>

          <div className="w-full md:w-32">
            <label className="block text-sm font-bold text-gray-700 mb-1">並び順</label>
            <input 
              name="sort_order" 
              type="number" 
              defaultValue={1} 
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
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
              <tr key={subject.id} className="hover:bg-gray-50">
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
                  {/* countは配列で返ってくるので安全に取得 */}
                  {(subject.sections as any)?.[0]?.count || 0} 章
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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