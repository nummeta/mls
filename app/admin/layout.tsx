import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // 1. ログインチェック
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. 権限チェック (profilesテーブルを見る)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // もし role が 'admin' じゃなかったら、トップページへ追い返す
  if (profile?.role !== "admin") {
    redirect("/");
  }

  // 管理者の場合のみ、ここから下の表示を許可
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* 管理画面専用サイドバー */}
      <aside className="w-64 bg-gray-900 text-white min-h-screen p-6 hidden md:block">
        <h2 className="text-xl font-bold mb-8 tracking-wider">
          ADMIN PAGE
        </h2>
        <nav className="space-y-4">
          <Link href="/admin" className="block py-2 px-4 hover:bg-gray-800 rounded transition">
            🏠 ダッシュボード
          </Link>
          <div className="pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-2 px-4">コンテンツ管理</p>
            <Link href="/admin/subjects" className="block py-2 px-4 hover:bg-gray-800 rounded transition">
              📚 科目・章の管理
            </Link>
            <Link href="/admin/units" className="block py-2 px-4 hover:bg-gray-800 rounded transition">
              📝 単元・テスト管理
            </Link>
          </div>
          <div className="pt-4 border-t border-gray-700">
            <Link href="/" className="block py-2 px-4 hover:bg-gray-800 rounded transition text-gray-400">
              ← アプリに戻る
            </Link>
          </div>
        </nav>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}