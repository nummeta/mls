import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import Image from "next/image";

// 科目ごとのデザイン定義
const getSubjectTheme = (name: string) => {
  if (name.includes("数学") || name.includes("算数")) {
    return { 
      gradient: "from-[#0099D9] to-[#00609C]", 
      icon: "📐", 
    };
  }
  if (name.includes("英語")) {
    return { 
      gradient: "from-[#E60033] to-[#E64B6B]", 
      icon: "Ab", 
    };
  }
  if (name.includes("理科") || name.includes("物理") || name.includes("化学") || name.includes("生物")) {
    return { 
      gradient: "from-emerald-500 to-teal-600", 
      icon: "🧪", 
    };
  }
  if (name.includes("社会") || name.includes("歴史") || name.includes("地理")) {
    return { 
      gradient: "from-[#F39800] to-[#F8B62D]", 
      icon: "🌍", 
    };
  }
  return { 
    gradient: "from-slate-500 to-slate-600", 
    icon: "📚", 
  };
};

export default async function Home() {
  const supabase = await createClient();
  
  // 科目データの取得
  const { data: subjects } = await supabase
    .from("subjects")
    .select("*, sections(count)")
    .order("sort_order", { ascending: true });

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-geist-sans)]">
      
      {/* --- ヘッダー (高さをh-16に圧縮) --- */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* ロゴ表示の修正: Imageのstyleで直接サイズを指定し、確実に表示させる */}
          {/* <Link href="/" className="block">
            <Image 
              src="/logo.png" 
              alt="モチアカ式" 
              width={180} 
              height={45}
              style={{ width: 'auto', height: '40px' }} // 高さを固定し、幅は自動
              priority
            />
          </Link> */}
        </div>
      </header>

      {/* --- ヒーローセクション（paddingを大幅に縮小） --- */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-6 md:py-8 text-center">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">
            モチアカ式<span className="text-[#0099D9]">ラーニングシステム</span>
          </h1>
          <p className="text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">
            今日も学習を始めましょう。
            下のリストから科目を選んで、学習メニューへ進んでください。
          </p>
        </div>
      </div>

      {/* --- メインコンテンツ --- */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        
        {/* セクションタイトル */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-6 bg-[#E60033] rounded-full"></div>
          <h2 className="text-lg font-bold text-gray-800">
            科目一覧
          </h2>
        </div>

        {/* 科目グリッド */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects?.map((subject) => {
            const theme = getSubjectTheme(subject.name);
            const sectionCount = (subject.sections as any)?.[0]?.count || 0;

            return (
              <Link 
                href={`/subjects/${subject.id}`} 
                key={subject.id}
                className="group block h-full"
              >
                <div className={`
                  bg-white rounded-2xl overflow-hidden 
                  border border-gray-100
                  shadow-sm hover:shadow-xl hover:-translate-y-1 
                  transition-all duration-300 h-full flex flex-col relative
                `}>
                  
                  {/* カードヘッダー（グラデーション）: アイコンを内包する */}
                  <div className={`h-24 bg-gradient-to-r ${theme.gradient} relative overflow-hidden flex items-end p-4`}>
                    {/* 装飾用: 薄い白のサークル */}
                    <div className="absolute -top-4 -right-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
                    
                    {/* アイコン（白箱入り）: グラデーションの上に配置 */}
                    <div className="w-14 h-14 bg-white rounded-xl shadow-md flex items-center justify-center text-3xl relative z-10">
                      {theme.icon}
                    </div>
                  </div>

                  {/* カードボディ */}
                  <div className="pt-4 pb-6 px-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold text-gray-800 group-hover:text-[#0099D9] transition-colors">
                          {subject.name}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-400 font-bold tracking-wide uppercase">
                        {sectionCount} Sections Included
                      </p>
                    </div>

                    {/* 「進む」アクションボタン */}
                    <div className="mt-6 flex justify-end items-center gap-2 text-sm font-bold text-gray-400 group-hover:text-[#0099D9] transition-colors">
                      <span>学習を始める</span>
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center
                        bg-gray-100 group-hover:bg-[#0099D9] group-hover:text-white
                        transition-all duration-300
                      `}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* データがない場合 */}
        {subjects?.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <div className="text-5xl mb-4">🌱</div>
            <p className="text-gray-500 text-lg font-bold">科目がまだありません</p>
            <p className="text-sm text-gray-400 mt-2">管理画面から科目を追加してください</p>
          </div>
        )}
      </main>
    </div>
  );
}