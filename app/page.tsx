import { createClient } from "@/utils/supabase/server";
import Link from "next/link";

// 科目ごとのデザイン定義
const getSubjectTheme = (name: string) => {
  if (name.includes("数学")) {
    return { color: "bg-blue-50 text-blue-600", border: "border-blue-100", icon: "📐", gradient: "from-blue-500 to-cyan-400" };
  }
  if (name.includes("英語")) {
    return { color: "bg-pink-50 text-pink-600", border: "border-pink-100", icon: "Ab", gradient: "from-pink-500 to-rose-400" };
  }
  if (name.includes("理科") || name.includes("物理") || name.includes("化学")) {
    return { color: "bg-green-50 text-green-600", border: "border-green-100", icon: "🧪", gradient: "from-emerald-400 to-green-500" };
  }
  if (name.includes("社会") || name.includes("歴史")) {
    return { color: "bg-yellow-50 text-yellow-600", border: "border-yellow-100", icon: "🌍", gradient: "from-amber-400 to-orange-400" };
  }
  return { color: "bg-gray-50 text-gray-600", border: "border-gray-100", icon: "📚", gradient: "from-gray-400 to-slate-500" };
};

export default async function Home() {
  const supabase = await createClient();
  
  // データの取得
  const { data: subjects } = await supabase
    .from("subjects")
    .select("*, sections(count)")
    .order("sort_order", { ascending: true });

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-geist-sans)]">
      
      {/* ヒーローヘッダー */}
      <div className="bg-white border-b border-gray-100 pb-12 pt-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
            今日も学習を始めよう 🚀
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl">
            自分のペースで少しずつ進めましょう。まずは科目を選んでください。
          </p>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-600 rounded-full inline-block"></span>
          科目一覧
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects?.map((subject) => {
            const theme = getSubjectTheme(subject.name);
            const sectionCount = (subject.sections as any)?.[0]?.count || 0;

            return (
              // 修正: Linkタグで全体を包む（block h-full で領域確保）
              <Link 
                href={`/subjects/${subject.id}`} 
                key={subject.id}
                className="block group h-full"
              >
                <div className={`
                  bg-white rounded-2xl p-6 
                  border ${theme.border} 
                  shadow-sm group-hover:shadow-xl group-hover:-translate-y-1 
                  transition-all duration-300 ease-in-out
                  flex flex-col justify-between h-full
                `}>
                  
                  {/* カード上部 */}
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      {/* アイコン */}
                      <div className={`
                        w-14 h-14 rounded-2xl flex items-center justify-center text-3xl
                        ${theme.color} shadow-inner
                      `}>
                        {theme.icon}
                      </div>
                      
                      {/* バッジ */}
                      <span className="bg-gray-100 text-gray-500 text-xs font-bold px-3 py-1 rounded-full">
                        {sectionCount} Chapters
                      </span>
                    </div>

                    <h3 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                      {subject.name}
                    </h3>
                    
                    <p className="text-sm text-gray-400">
                      クリックして学習メニューを開く
                    </p>
                  </div>

                  {/* カード下部（進む矢印） */}
                  <div className="mt-6 flex justify-end">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      bg-gradient-to-r ${theme.gradient} text-white
                      opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0
                      transition-all duration-300 shadow-lg
                    `}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {subjects?.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <p className="text-gray-400 text-lg">科目がまだ登録されていません 🌱</p>
            <p className="text-sm text-gray-300 mt-2">管理画面からデータを追加してください</p>
          </div>
        )}
      </div>
    </div>
  );
}