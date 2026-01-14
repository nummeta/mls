"use client"; // ★これが重要！これでクライアント機能が使えるようになります

export default function PrintButton() {
  return (
    <button 
      onClick={() => window.print()}
      className="bg-gray-800 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-gray-700 transition flex items-center gap-2 ml-auto"
    >
      🖨️ レポートを印刷 / PDF保存
    </button>
  );
}