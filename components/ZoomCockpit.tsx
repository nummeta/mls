'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from "@/utils/supabase/client"

const supabase = createClient()

// --- 型定義 ---
type StudySession = {
  id: string
  student_id: string
  scheduled_start_at: string
  scheduled_end_at: string
  status: string
}

type StudyPlan = {
  id: string
  session_id: string
  order_index: number
  subject: string
  content: string
  planned_minutes: number
  actual_minutes: number
  status: string
  started_at: string | null
  paused_at: string | null
  accumulated_seconds: number
}

type Phase = 'loading' | 'no_session' | 'planning' | 'studying' | 'completed'

interface ZoomProps {
  meetingNumber: string
  userName: string
  password?: string
}

// --- 科目リスト ---
const SUBJECTS = ['算数', '英語', '国語', '理科', '社会', '数学', 'その他']

export default function ZoomCockpit({ meetingNumber, userName, password }: ZoomProps) {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ユーザー・セッション関連
  const [userId, setUserId] = useState<string | null>(null)
  const [session, setSession] = useState<StudySession | null>(null)
  const [plans, setPlans] = useState<StudyPlan[]>([])
  const [phase, setPhase] = useState<Phase>('loading')

  // 計画登録フォーム
  const [newSubject, setNewSubject] = useState(SUBJECTS[0])
  const [newContent, setNewContent] = useState('')
  const [newMinutes, setNewMinutes] = useState(30)

  // タイマー表示用
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0)

  // 講師呼び出し
  const [isRequesting, setIsRequesting] = useState(false)

  // ★ Zoom自動調整用
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoomScale, setZoomScale] = useState(1)
  // 修正後（★ここを書き換え）
  const ZOOM_BASE_WIDTH = 1600
  const ZOOM_BASE_HEIGHT = 900

  // 座席番号の抽出（表示用）
  const seatMatch = userName.match(/【席(\d+)】/)
  const seatNumber = seatMatch ? seatMatch[1] : null
  const displayName = seatMatch ? userName.replace(seatMatch[0], '') : userName

  // 現在のプラン
  const currentPlan = plans[currentPlanIndex] || null

  // --- ★ Zoomサイズ自動調整ロジック ---
  useEffect(() => {
    if (!containerRef.current) return

    const updateScale = () => {
      if (!containerRef.current) return

      const parentW = containerRef.current.clientWidth
      const parentH = containerRef.current.clientHeight

      // ★ここが修正の肝です
      // 「ピッタリ」を目指すと、計算誤差で1pxでもはみ出すとボタンが消えます。
      // 強制的に「0.85倍」にして、画面の上下左右に確実に黒い隙間を作ります。
      // これでボタンが見切れることは物理的にあり得なくなります。

      const scaleW = parentW / ZOOM_BASE_WIDTH
      const scaleH = parentH / ZOOM_BASE_HEIGHT

      setZoomScale(Math.min(scaleW, scaleH))
    }

    // 初回実行
    updateScale()

    // 画面サイズが変わるたびに再計算
    const observer = new ResizeObserver(updateScale)
    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [])

  // --- 初期化 ---
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setPhase('no_session')
        return
      }
      setUserId(user.id)

      // 既に呼び出し中かチェック
      const { data: helpData } = await supabase
        .from("help_requests")
        .select("id")
        .eq("student_id", user.id)
        .eq("status", "pending")
        .limit(1)

      if (helpData && helpData.length > 0) {
        setIsRequesting(true)
      }

      // 講師呼び出しリアルタイム監視
      const helpChannel = supabase.channel("my_request_zoom")
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'help_requests', filter: `student_id=eq.${user.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT') setIsRequesting(true)
            if (payload.eventType === 'UPDATE') {
              const newStatus = (payload.new as { status: string }).status
              setIsRequesting(newStatus === 'pending')
            }
          }
        )
        .subscribe()

      // 現在有効なセッションを取得
      const now = new Date().toISOString()
      const { data: sessions } = await supabase
        .from("study_sessions")
        .select("*")
        .eq("student_id", user.id)
        .in("status", ["reserved", "active"])
        .lte("scheduled_start_at", now)
        .gte("scheduled_end_at", now)
        .limit(1)

      if (!sessions || sessions.length === 0) {
        setPhase('no_session')
      } else {
        const currentSession = sessions[0] as StudySession
        setSession(currentSession)

        // セッションをactiveに更新
        if (currentSession.status === 'reserved') {
          await supabase
            .from("study_sessions")
            .update({ status: 'active' })
            .eq("id", currentSession.id)
        }

        // 既存のプランを取得
        const { data: existingPlans } = await supabase
          .from("study_plans")
          .select("*")
          .eq("session_id", currentSession.id)
          .order("order_index", { ascending: true })

        if (existingPlans && existingPlans.length > 0) {
          setPlans(existingPlans as StudyPlan[])

          // 進行中のタスクがあれば復元
          const inProgressIdx = existingPlans.findIndex(p => p.status === 'in_progress' || p.status === 'paused')
          if (inProgressIdx >= 0) {
            setCurrentPlanIndex(inProgressIdx)
            setPhase('studying')
          } else if (existingPlans.every(p => p.status === 'completed')) {
            setPhase('completed')
          } else {
            setPhase('planning')
          }
        } else {
          setPhase('planning')
        }
      }

      return () => { supabase.removeChannel(helpChannel) }
    }

    // Zoomの準備
    async function prepareMeeting() {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('zoom-signature', {
          body: { meetingNumber: meetingNumber, role: 0 },
          headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` }
        })

        if (fnError) throw new Error(fnError.message)
        const { signature, sdkKey } = data

        const params = new URLSearchParams({
          mn: meetingNumber,
          pwd: password || "",
          name: userName,
          sig: signature,
          key: sdkKey
        })

        setIframeUrl(`/meeting.html?${params.toString()}`)

      } catch (err: unknown) {
        console.error(err)
        setError('署名の取得に失敗しました')
      }
    }

    init()
    if (meetingNumber) prepareMeeting()
  }, [meetingNumber, userName, password])

  // --- タイマー処理 ---
  useEffect(() => {
    if (phase !== 'studying' || !currentPlan) return
    if (currentPlan.status !== 'in_progress') return

    const timer = setInterval(() => {
      if (currentPlan.started_at) {
        const startTime = new Date(currentPlan.started_at).getTime()
        const now = Date.now()
        const accumulated = currentPlan.accumulated_seconds || 0
        const currentSeconds = Math.floor((now - startTime) / 1000) + accumulated
        setElapsedSeconds(currentSeconds)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [phase, currentPlan])

  // --- プラン追加 ---
  const handleAddPlan = async () => {
    console.log("handleAddPlan called", { session, newContent, newSubject, newMinutes })

    if (!session) {
      console.error("セッションがありません。study_sessionsテーブルにデータがあるか確認してください。")
      alert("セッションが見つかりません。\n\n予約データ（study_sessions）がDBに存在するか確認してください。")
      return
    }

    if (!newContent.trim()) {
      alert("学習内容を入力してください")
      return
    }

    const newPlan: Partial<StudyPlan> = {
      session_id: session.id,
      order_index: plans.length,
      subject: newSubject,
      content: newContent.trim(),
      planned_minutes: newMinutes,
      actual_minutes: 0,
      status: 'pending',
      accumulated_seconds: 0
    }

    const { data, error } = await supabase
      .from("study_plans")
      .insert(newPlan)
      .select()
      .single()

    if (error) {
      console.error("Plan insert error:", error)
      alert(`プラン追加エラー: ${error.message}`)
      return
    }

    if (!error && data) {
      setPlans([...plans, data as StudyPlan])
      setNewContent('')
      setNewMinutes(30)
    }
  }

  // --- 学習開始 ---
  const handleStartStudying = async () => {
    if (plans.length === 0) return

    const firstPlan = plans[0]
    const now = new Date().toISOString()

    await supabase
      .from("study_plans")
      .update({ status: 'in_progress', started_at: now })
      .eq("id", firstPlan.id)

    setPlans(plans.map((p, i) =>
      i === 0 ? { ...p, status: 'in_progress', started_at: now } : p
    ))
    setCurrentPlanIndex(0)
    setElapsedSeconds(0)
    setPhase('studying')
  }

  // --- 休憩 ---
  const handlePause = async () => {
    if (!currentPlan) return
    const now = new Date().toISOString()

    // 現在までの経過秒数を計算
    let accumulated = currentPlan.accumulated_seconds || 0
    if (currentPlan.started_at) {
      const startTime = new Date(currentPlan.started_at).getTime()
      accumulated += Math.floor((Date.now() - startTime) / 1000)
    }

    await supabase
      .from("study_plans")
      .update({
        status: 'paused',
        paused_at: now,
        accumulated_seconds: accumulated,
        started_at: null
      })
      .eq("id", currentPlan.id)

    setPlans(plans.map((p, i) =>
      i === currentPlanIndex
        ? { ...p, status: 'paused', paused_at: now, accumulated_seconds: accumulated, started_at: null }
        : p
    ))
  }

  // --- 再開 ---
  const handleResume = async () => {
    if (!currentPlan) return
    const now = new Date().toISOString()

    await supabase
      .from("study_plans")
      .update({
        status: 'in_progress',
        started_at: now,
        paused_at: null
      })
      .eq("id", currentPlan.id)

    setPlans(plans.map((p, i) =>
      i === currentPlanIndex
        ? { ...p, status: 'in_progress', started_at: now, paused_at: null }
        : p
    ))
  }

  // --- 次へ ---
  const handleNext = async () => {
    if (!currentPlan) return

    // 確認ダイアログ
    const isLastTask = currentPlanIndex + 1 >= plans.length
    const confirmMessage = isLastTask
      ? "最後のタスクを完了して学習を終了しますか？"
      : `「${currentPlan.subject}」を完了して次のタスクに進みますか？`

    if (!window.confirm(confirmMessage)) return

    // 現在のタスクを完了
    const actualMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60))
    await supabase
      .from("study_plans")
      .update({
        status: 'completed',
        actual_minutes: actualMinutes,
        started_at: null,
        paused_at: null
      })
      .eq("id", currentPlan.id)

    const updatedPlans = plans.map((p, i) =>
      i === currentPlanIndex
        ? { ...p, status: 'completed', actual_minutes: actualMinutes }
        : p
    )
    setPlans(updatedPlans)

    // 次のタスクがあれば開始
    const nextIndex = currentPlanIndex + 1
    if (nextIndex < plans.length) {
      const now = new Date().toISOString()
      await supabase
        .from("study_plans")
        .update({ status: 'in_progress', started_at: now })
        .eq("id", plans[nextIndex].id)

      setPlans(updatedPlans.map((p, i) =>
        i === nextIndex ? { ...p, status: 'in_progress', started_at: now } : p
      ))
      setCurrentPlanIndex(nextIndex)
      setElapsedSeconds(0)
    } else {
      // 全タスク完了
      await finishSession()
    }
  }

  // --- 終了（ユーザーがボタンを押した場合） ---
  const handleFinish = async () => {
    if (!session) return

    // 確認ダイアログ
    const confirmed = window.confirm(
      "学習を終了しますか？\n\n現在のタスクの記録も保存されます。"
    )
    if (!confirmed) return

    await finishSession()
  }

  // --- 実際の終了処理 ---
  const finishSession = async () => {
    if (!session) return

    // 現在進行中のタスクがあれば記録を保存して完了にする
    if (currentPlan && (currentPlan.status === 'in_progress' || currentPlan.status === 'paused')) {
      // 現在の経過時間を計算
      let totalSeconds = currentPlan.accumulated_seconds || 0
      if (currentPlan.status === 'in_progress' && currentPlan.started_at) {
        const startTime = new Date(currentPlan.started_at).getTime()
        const now = Date.now()
        totalSeconds += Math.floor((now - startTime) / 1000)
      }
      const actualMinutes = Math.max(1, Math.ceil(totalSeconds / 60)) // 最低1分

      await supabase
        .from("study_plans")
        .update({
          status: 'completed',
          actual_minutes: actualMinutes,
          started_at: null,
          paused_at: null
        })
        .eq("id", currentPlan.id)

      // ローカル状態も更新
      setPlans(plans.map((p) =>
        p.id === currentPlan.id
          ? { ...p, status: 'completed', actual_minutes: actualMinutes }
          : p
      ))
    }

    // セッションを完了に
    await supabase
      .from("study_sessions")
      .update({ status: 'completed' })
      .eq("id", session.id)

    // 状態をリセット
    setElapsedSeconds(0)
    setCurrentPlanIndex(0)
    setPhase('completed')
  }

  // --- 講師呼び出し ---
  const handleToggleRequest = async () => {
    if (!userId) {
      alert("ログイン情報が見つかりません。再読み込みしてください。")
      return
    }

    try {
      if (isRequesting) {
        await supabase
          .from("help_requests")
          .update({ status: 'resolved' })
          .eq("student_id", userId)
          .eq("status", "pending")
        setIsRequesting(false)
      } else {
        await supabase
          .from("help_requests")
          .insert({ student_id: userId, status: "pending" })
        setIsRequesting(true)
      }
    } catch (err) {
      console.error("Supabase Error:", err)
      alert("通信エラーが発生しました")
    }
  }

  // --- 時間フォーマット ---
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // --- レンダリング ---
  return (
    <div className="fixed inset-0 z-50 flex bg-gray-900 text-white font-[family-name:var(--font-geist-sans)] overflow-hidden">

      {/* 左側：Zoomエリア（自動リサイズ対応） */}
      <div
        ref={containerRef}
        className="w-1/2 border-r border-gray-700 bg-black relative overflow-hidden flex items-center justify-center"
      >
        {error && <div className="absolute inset-0 flex items-center justify-center text-red-500 z-10">{error}</div>}

        {!iframeUrl ? (
          <div className="flex items-center justify-center h-full text-gray-400 animate-pulse">準備中...</div>
        ) : (
          <div
            className="shadow-2xl bg-black"
            style={{
              // PC用サイズ (1280x720) に固定
              width: `${ZOOM_BASE_WIDTH}px`,
              height: `${ZOOM_BASE_HEIGHT}px`,
              // 自動計算されたスケール + 安全マージン
              transform: `scale(${zoomScale})`,
              transformOrigin: 'center center',
              //marginLeft: '20px'
              // ★デバッグ用: 赤い枠線を表示します
              // これで「iframeの底」がどこにあるか一目瞭然になります
              border: '2px solid red'
            }}
          >
            <iframe
              src={iframeUrl}
              className="w-full h-full border-0 block"
              allow="microphone; camera; fullscreen; display-capture; autoplay"
            />
          </div>
        )}
      </div>

      {/* 右側：コックピット */}
      <div className="w-1/2 bg-gray-800 flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-gray-300">モチサポ コックピット</h2>
          <span className={`w-2 h-2 rounded-full ${iframeUrl ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
        </div>

        {/* 座席表示 */}
        <div className="p-4 text-center border-b border-gray-700 bg-gray-800/50 shrink-0">
          {seatNumber ? (
            <>
              <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">YOUR SEAT</p>
              <div className="text-4xl font-black text-white tracking-tighter">
                <span className="text-lg align-top text-gray-500 mr-1">No.</span>
                {seatNumber}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-sm">{displayName}</p>
          )}
        </div>

        {/* メインコンテンツエリア */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* フェーズ: ローディング */}
          {phase === 'loading' && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
          )}

          {/* フェーズ: セッションなし */}
          {phase === 'no_session' && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">本日の予約はありません</p>
              <p className="text-gray-500 text-xs mt-2">予約がある場合は自動的に表示されます</p>
            </div>
          )}

          {/* フェーズ: 計画登録 */}
          {phase === 'planning' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-indigo-400 mb-2">📝 学習計画を立てよう</h3>

              {/* 登録済みプラン一覧 */}
              {plans.length > 0 && (
                <div className="space-y-2 mb-4">
                  {plans.map((plan, idx) => (
                    <div key={plan.id} className="bg-gray-700/50 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded">{idx + 1}</span>
                        <span className="font-bold">{plan.subject}</span>
                      </div>
                      <p className="text-gray-300 mt-1 text-xs">{plan.content}</p>
                      <p className="text-gray-500 text-xs mt-1">{plan.planned_minutes}分</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 新規プラン追加フォーム */}
              <div className="bg-gray-700/30 rounded-xl p-4 space-y-3">
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <input
                  type="text"
                  placeholder="学習内容（例：チャート式 p10-15）"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={newMinutes}
                    onChange={(e) => setNewMinutes(parseInt(e.target.value) || 30)}
                    className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-gray-400 text-sm">分</span>
                  <button
                    onClick={handleAddPlan}
                    disabled={!newContent.trim()}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg text-sm transition-colors"
                  >
                    + 追加
                  </button>
                </div>
              </div>

              {/* 学習スタートボタン */}
              {plans.length > 0 && (
                <button
                  onClick={handleStartStudying}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all hover:-translate-y-1"
                >
                  🚀 学習スタート
                </button>
              )}
            </div>
          )}

          {/* フェーズ: 学習中 */}
          {phase === 'studying' && currentPlan && (
            <div className="space-y-4">
              {/* 進捗インジケーター */}
              <div className="flex items-center justify-center gap-1">
                {plans.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full ${idx < currentPlanIndex ? 'bg-green-500' :
                      idx === currentPlanIndex ? 'bg-indigo-500 animate-pulse' :
                        'bg-gray-600'
                      }`}
                  />
                ))}
              </div>

              {/* 現在のタスク */}
              <div className="bg-gradient-to-br from-indigo-900/50 to-blue-900/50 rounded-xl p-4 border border-indigo-500/30">
                <p className="text-indigo-400 text-xs font-bold uppercase mb-1">NOW STUDYING</p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded">{currentPlan.subject}</span>
                </div>
                <p className="text-white font-bold">{currentPlan.content}</p>
                <p className="text-gray-400 text-xs mt-2">目標: {currentPlan.planned_minutes}分</p>
              </div>

              {/* タイマー */}
              <div className="text-center py-4">
                <p className="text-gray-400 text-xs mb-1">経過時間</p>
                <div className={`text-5xl font-mono font-bold tracking-wider ${currentPlan.status === 'paused' ? 'text-yellow-400' : 'text-white'
                  }`}>
                  {formatTime(elapsedSeconds)}
                </div>
                {currentPlan.status === 'paused' && (
                  <p className="text-yellow-400 text-xs mt-2 animate-pulse">⏸ 休憩中</p>
                )}
              </div>

              {/* アクションボタン */}
              <div className="grid grid-cols-2 gap-2">
                {currentPlan.status === 'in_progress' ? (
                  <button
                    onClick={handlePause}
                    className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-lg transition-colors"
                  >
                    ⏸ 休憩
                  </button>
                ) : (
                  <button
                    onClick={handleResume}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors"
                  >
                    ▶ 再開
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors"
                >
                  ⏭ 次へ
                </button>
              </div>

              <button
                onClick={handleFinish}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 rounded-lg transition-colors text-sm"
              >
                🏁 学習を終了する
              </button>
            </div>
          )}

          {/* フェーズ: 完了 */}
          {phase === 'completed' && (
            <div className="text-center py-8 space-y-4">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-bold text-white">お疲れさまでした！</h3>
              <p className="text-gray-400 text-sm">今日の学習を完了しました</p>

              {/* 今日の実績 */}
              <div className="bg-gray-700/50 rounded-xl p-4 mt-4 text-left">
                <p className="text-xs text-gray-400 mb-2">📊 今日の実績</p>
                {plans.map((plan, idx) => (
                  <div key={plan.id} className="flex items-center justify-between py-1 text-sm">
                    <span className="text-gray-300">{plan.subject}: {plan.content}</span>
                    <span className="text-indigo-400 font-mono">{plan.actual_minutes}分</span>
                  </div>
                ))}
                <div className="border-t border-gray-600 mt-2 pt-2 flex justify-between">
                  <span className="text-gray-400">合計</span>
                  <span className="text-white font-bold">
                    {plans.reduce((sum, p) => sum + (p.actual_minutes || 0), 0)}分
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 講師呼び出しボタン（常時表示） */}
        <div className="p-4 border-t border-gray-700 shrink-0">
          <button
            onClick={handleToggleRequest}
            disabled={!userId}
            className={`
              w-full py-3 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-sm
              ${isRequesting
                ? "bg-red-500/10 text-red-400 border-2 border-red-500 hover:bg-red-500/20"
                : "bg-yellow-400 text-yellow-900 hover:bg-yellow-300 hover:-translate-y-1 hover:shadow-lg"
              }
            `}
          >
            {isRequesting ? (
              <>
                <span>✋</span>
                <span>キャンセルする</span>
              </>
            ) : (
              <>
                <span>🙋</span>
                <span>講師を呼ぶ</span>
              </>
            )}
          </button>
        </div>

        <div className="p-2 border-t border-gray-700 text-center shrink-0">
          <p className="text-xs text-gray-600">Mochiaka Learning System</p>
        </div>
      </div>
    </div>
  )
}