'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

// ZoomCockpitコンポーネントを動的インポート (SSR無効化)
const ZoomCockpit = dynamic(() => import('@/components/ZoomCockpit'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-black text-white">
      Loading Zoom Module...
    </div>
  ),
})

function ZoomContent() {
  const searchParams = useSearchParams()
  
  // URLパラメータから情報を取得
  // 例: /zoom?id=123456789&pwd=abcde&name=山田太郎
  const meetingId = searchParams.get('id')
  const password = searchParams.get('pwd') || "" // パスワードがない場合は空文字
  const userName = searchParams.get('name') || "ゲスト生徒"

  // IDがない場合の表示
  if (!meetingId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
        <h1 className="text-2xl font-bold mb-4">ミーティングIDが必要です</h1>
        <p className="text-gray-400">URLに ?id=会議ID をつけてアクセスしてください。</p>
      </div>
    )
  }

  return (
    <ZoomCockpit 
      meetingNumber={meetingId}
      password={password}
      userName={userName} 
    />
  )
}

export default function ZoomPage() {
  return (
    <main className="w-full h-screen">
      {/* useSearchParamsを使うコンポーネントはSuspenseで囲むのがNext.jsの作法 */}
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <ZoomContent />
      </Suspense>
    </main>
  )
}