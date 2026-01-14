'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

// ★クライアント側でSupabaseを使うための初期化
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function StudyRoomLobby() {
  const router = useRouter()
  const [name, setName] = useState<string>('')
  const [seatNumber, setSeatNumber] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  const ZOOM_ID = "89543328317"
  const ZOOM_PASS = "077067"

  useEffect(() => {
    // 1. 座席番号の決定（ランダム）
    const randomSeat = Math.floor(Math.random() * 20) + 1
    setSeatNumber(randomSeat)

    // 2. ログインユーザー情報の取得
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // メタデータから名前を取得（なければメールアドレスの@より前を使う）
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'ゲスト'
        setName(fullName)
      } else {
        // 未ログインならログイン画面へ飛ばす等の処理（今回はとりあえずゲスト）
        setName('ゲスト')
      }
      setIsCheckingAuth(false)
    }

    fetchUser()
  }, [])

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return

    setIsLoading(true)

    const params = new URLSearchParams({
      id: ZOOM_ID,
      pwd: ZOOM_PASS,
      // 名前は自動取得したものを使う
      name: `【席${seatNumber}】${name}`
    })

    router.push(`/zoom?${params.toString()}`)
  }

  // ユーザー情報取得中はローディング表示
  if (isCheckingAuth) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">読み込み中...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">

        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-6 text-center text-white">
          <h1 className="text-2xl font-bold">オンライン自習室</h1>
          <p className="text-indigo-100 text-sm mt-1">Camera ON Study Room</p>
        </div>

        {/* コンテンツ */}
        <div className="p-8">

          {/* 座席案内 */}
          <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-6 mb-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-200 opacity-20 rounded-full -mr-10 -mt-10"></div>
            <p className="text-indigo-500 text-xs font-bold uppercase tracking-wider mb-2">ASSIGNED SEAT</p>
            <div className="text-5xl font-black text-indigo-600 tracking-tight">No.{seatNumber}</div>
            <p className="text-xs text-gray-500 mt-3 font-medium">
              あなたの座席は <span className="text-indigo-600 font-bold">{seatNumber}番</span> です
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-6">

            {/* ★修正: 入力欄を削除し、表示のみに変更 */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-xs text-gray-400 font-bold mb-1">入室するユーザー名</p>
              <p className="text-lg font-bold text-gray-800">{name} さん</p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !name}
              className={`
                w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform duration-200
                ${isLoading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-xl'
                }
              `}
            >
              {isLoading ? '接続しています...' : '自習室に入室する'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400 leading-relaxed">
              ※ Zoomの画面が開いたら「許可」を押してください。<br />
              ※ 最初はマイクがオフの状態で入室します。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}