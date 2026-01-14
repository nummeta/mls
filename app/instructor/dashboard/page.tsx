"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

// --- 型定義 ---
type StudySession = {
    id: string;
    student_id: string;
    scheduled_start_at: string;
    scheduled_end_at: string;
    status: string;
    profiles?: { email: string; name: string | null };
};

type StudyPlan = {
    id: string;
    session_id: string;
    order_index: number;
    subject: string;
    content: string;
    planned_minutes: number;
    actual_minutes: number;
    status: string;
    started_at: string | null;
    accumulated_seconds: number;
};

type HelpRequest = {
    id: string;
    student_id: string;
    status: string;
    created_at: string;
};

type ObservationLog = {
    id: string;
    session_id: string;
    instructor_id: string;
    message: string;
    created_at: string;
    profiles?: { name: string | null; email: string };
};

export default function InstructorDashboard() {
    const supabase = createClient();
    const [sessions, setSessions] = useState<(StudySession & { plans: StudyPlan[] })[]>([]);
    const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
    const [selectedSession, setSelectedSession] = useState<(StudySession & { plans: StudyPlan[] }) | null>(null);
    const [currentLogId, setCurrentLogId] = useState<string | null>(null);
    const [logMessage, setLogMessage] = useState("");
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

    const [tick, setTick] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // クロージャ問題を回避するためのref
    const selectedSessionRef = useRef<(StudySession & { plans: StudyPlan[] }) | null>(null);
    const currentLogIdRef = useRef<string | null>(null);

    // stateが変わったらrefも更新
    useEffect(() => {
        selectedSessionRef.current = selectedSession;
    }, [selectedSession]);

    useEffect(() => {
        currentLogIdRef.current = currentLogId;
    }, [currentLogId]);

    // --- 初期化 & リアルタイム監視 ---
    useEffect(() => {
        audioRef.current = new Audio("/alert.mp3");

        fetchSessions();
        fetchHelpRequests();

        console.log("Setting up realtime subscriptions...");

        // リアルタイム監視: セッション
        const channelSessions = supabase
            .channel("instructor_sessions")
            .on("postgres_changes",
                { event: "*", schema: "public", table: "study_sessions" },
                (payload) => {
                    console.log("📡 study_sessions changed:", payload.eventType);
                    fetchSessions();
                }
            )
            .subscribe((status) => {
                console.log("Sessions channel status:", status);
            });

        // リアルタイム監視: プラン
        const channelPlans = supabase
            .channel("instructor_plans")
            .on("postgres_changes",
                { event: "*", schema: "public", table: "study_plans" },
                (payload) => {
                    console.log("📡 study_plans changed:", payload.eventType);
                    fetchSessions();
                }
            )
            .subscribe((status) => {
                console.log("Plans channel status:", status);
            });

        // リアルタイム監視: ヘルプリクエスト
        const channelHelp = supabase
            .channel("instructor_help")
            .on("postgres_changes",
                { event: "*", schema: "public", table: "help_requests" },
                (payload) => {
                    console.log("📡 help_requests changed:", payload.eventType);
                    if (payload.eventType === 'INSERT') {
                        playSound();
                    }
                    fetchHelpRequests();
                }
            )
            .subscribe((status) => {
                console.log("Help channel status:", status);
            });

        // 10秒ごとにデータを再取得（バックアップ）
        const timer = setInterval(() => {
            setTick(t => t + 1);
            fetchSessions(); // 定期的にリフレッシュ
        }, 10000);

        return () => {
            console.log("Cleaning up realtime subscriptions...");
            supabase.removeChannel(channelSessions);
            supabase.removeChannel(channelPlans);
            supabase.removeChannel(channelHelp);
            clearInterval(timer);
        };
    }, []);

    // 選択セッションが変わったらログを取得
    useEffect(() => {
        if (selectedSession) {
            loadSessionLog(selectedSession.id);
        } else {
            setLogMessage("");
            setCurrentLogId(null);
        }
    }, [selectedSession]);

    const fetchSessions = async () => {
        console.log("Fetching sessions...");

        // study_sessionsを取得（active + completed を表示）
        const { data, error } = await supabase
            .from("study_sessions")
            .select("*")
            .in("status", ["active", "completed"])
            .order("status", { ascending: true }) // activeが先に来る
            .order("scheduled_start_at", { ascending: true });

        console.log("Sessions query result:", { data, error });

        if (error) {
            console.error("Sessions fetch error:", error);
            alert(`セッション取得エラー: ${error.message}`);
            return;
        }

        if (data && data.length > 0) {
            console.log(`Found ${data.length} sessions (active + completed)`);

            // 各セッションのプロフィールとプランを取得
            const sessionsWithDetails = await Promise.all(
                data.map(async (session) => {
                    // プロフィールを取得（student_id = profiles.id）
                    const { data: profileData } = await supabase
                        .from("profiles")
                        .select("email, name")
                        .eq("id", session.student_id)
                        .single();

                    // プランを取得
                    const { data: plans } = await supabase
                        .from("study_plans")
                        .select("*")
                        .eq("session_id", session.id)
                        .order("order_index", { ascending: true });

                    return {
                        ...session,
                        profiles: profileData || { email: "不明", name: null },
                        plans: plans || []
                    } as StudySession & { plans: StudyPlan[] };
                })
            );
            setSessions(sessionsWithDetails);
        } else {
            console.log("No active sessions found");
            setSessions([]);
        }
    };

    const fetchHelpRequests = async () => {
        const { data } = await supabase
            .from("help_requests")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: true });

        if (data) setHelpRequests(data);
    };

    // セッションのログを読み込み（1セッション1ログ）
    const loadSessionLog = async (sessionId: string) => {
        const { data } = await supabase
            .from("observation_logs")
            .select("id, message")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (data) {
            setCurrentLogId(data.id);
            setLogMessage(data.message || "");
        } else {
            setCurrentLogId(null);
            setLogMessage("");
        }
        setSaveStatus('saved');
    };

    // 自動保存（デバウンス：1秒後に保存）
    const handleLogChange = (value: string) => {
        console.log("handleLogChange called, length:", value.length);
        setLogMessage(value);
        setSaveStatus('unsaved');

        // 既存のタイマーをクリア
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // 1秒後に保存
        saveTimeoutRef.current = setTimeout(() => {
            console.log("Timer fired, calling saveLog...");
            saveLog(value);
        }, 1000);
    };

    const saveLog = async (message: string) => {
        const session = selectedSessionRef.current;
        const logId = currentLogIdRef.current;

        console.log("saveLog called", { sessionId: session?.id, logId, messageLength: message.length });

        if (!session) {
            console.error("No selected session");
            setSaveStatus('unsaved');
            return;
        }

        setSaveStatus('saving');
        const { data: { user } } = await supabase.auth.getUser();
        console.log("User:", user?.id);

        if (!user) {
            console.error("No user logged in");
            setSaveStatus('unsaved');
            return;
        }

        try {
            if (logId) {
                // 既存ログを更新
                console.log("Updating existing log:", logId);
                const { data: updateData, error, count } = await supabase
                    .from("observation_logs")
                    .update({ message })
                    .eq("id", logId)
                    .select();

                console.log("Update result:", { data: updateData, error, count });

                if (error) {
                    console.error("Update error:", error);
                    alert(`ログ更新エラー: ${error.message}`);
                    setSaveStatus('unsaved');
                    return;
                }

                if (!updateData || updateData.length === 0) {
                    console.error("No rows updated - RLS policy may be blocking");
                    alert("更新が反映されませんでした。RLSポリシーを確認してください。");
                    setSaveStatus('unsaved');
                    return;
                }

                console.log("Log updated successfully, data:", updateData);
            } else {
                // 新規ログを作成
                console.log("Creating new log for session:", session.id);
                const { data, error } = await supabase
                    .from("observation_logs")
                    .insert({
                        session_id: session.id,
                        instructor_id: user.id,
                        message
                    })
                    .select("id")
                    .single();

                if (error) {
                    console.error("Insert error:", error);
                    alert(`ログ作成エラー: ${error.message}`);
                    setSaveStatus('unsaved');
                    return;
                }

                if (data) {
                    console.log("Log created with id:", data.id);
                    setCurrentLogId(data.id);
                    currentLogIdRef.current = data.id;
                }
            }
            setSaveStatus('saved');
        } catch (err) {
            console.error("Save error:", err);
            setSaveStatus('unsaved');
        }
    };

    const playSound = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(() => { });
        }
    };

    const handleResolveHelp = async (reqId: string) => {
        await supabase
            .from("help_requests")
            .update({ status: "resolved" })
            .eq("id", reqId);
        fetchHelpRequests();
    };

    // --- ヘルパー関数 ---
    const getElapsedTime = (plan: StudyPlan) => {
        if (plan.status === 'completed') {
            return `${plan.actual_minutes}分 ✓`;
        }
        if (plan.status !== 'in_progress' || !plan.started_at) {
            const acc = Math.floor((plan.accumulated_seconds || 0) / 60);
            return acc > 0 ? `${acc}分` : '-';
        }

        const startTime = new Date(plan.started_at).getTime();
        const now = Date.now();
        const accumulated = plan.accumulated_seconds || 0;
        const totalSeconds = Math.floor((now - startTime) / 1000) + accumulated;
        return `${Math.floor(totalSeconds / 60)}分`;
    };

    const getCurrentPlan = (plans: StudyPlan[]) => {
        return plans.find(p => p.status === 'in_progress' || p.status === 'paused');
    };

    const getStudentStatus = (session: StudySession & { plans: StudyPlan[] }) => {
        // セッション自体が完了している場合
        if (session.status === 'completed') {
            return { text: "終了", color: "bg-gray-400", isCompleted: true };
        }

        const current = getCurrentPlan(session.plans);
        if (!current) {
            if (session.plans.length === 0) return { text: "計画中", color: "bg-gray-500", isCompleted: false };
            if (session.plans.every(p => p.status === 'completed')) return { text: "完了", color: "bg-green-500", isCompleted: false };
            return { text: "計画中", color: "bg-gray-500", isCompleted: false };
        }
        if (current.status === 'paused') return { text: "休憩中", color: "bg-yellow-500", isCompleted: false };
        return { text: "学習中", color: "bg-green-500", isCompleted: false };
    };

    const isNeedingHelp = (studentId: string) => {
        return helpRequests.some(r => r.student_id === studentId);
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* ヘッダー */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-800">📊 講師モニタリング</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">
                            アクティブ生徒: <span className="font-bold text-indigo-600">{sessions.length}</span>名
                        </span>
                        {helpRequests.length > 0 && (
                            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                                🚨 呼び出し {helpRequests.length}件
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
                {/* 左側: 生徒カード一覧 */}
                <div className="flex-1">
                    {/* 呼び出しアラート */}
                    {helpRequests.length > 0 && (
                        <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4">
                            <h2 className="text-red-600 font-bold mb-3 flex items-center gap-2">
                                🚨 講師呼び出し中
                            </h2>
                            <div className="space-y-2">
                                {helpRequests.map(req => {
                                    const session = sessions.find(s => s.student_id === req.student_id);
                                    return (
                                        <div key={req.id} className="bg-white rounded-lg p-3 flex items-center justify-between shadow-sm">
                                            <div>
                                                <p className="font-bold">{session?.profiles?.name || session?.profiles?.email || "不明"}</p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(req.created_at).toLocaleTimeString()} に呼び出し
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleResolveHelp(req.id)}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
                                            >
                                                ✅ 対応完了
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 生徒カードグリッド */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sessions.map(session => {
                            const currentPlan = getCurrentPlan(session.plans);
                            const status = getStudentStatus(session);
                            const needsHelp = isNeedingHelp(session.student_id);

                            return (
                                <div
                                    key={session.id}
                                    onClick={() => setSelectedSession(session)}
                                    className={`
                    rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md hover:-translate-y-1
                    ${status.isCompleted ? 'bg-gray-100 opacity-60' : 'bg-white'}
                    ${needsHelp ? 'ring-2 ring-red-500 bg-red-50' : ''}
                    ${selectedSession?.id === session.id ? 'ring-2 ring-indigo-500' : ''}
                  `}
                                >
                                    {/* ヘッダー */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className={`font-bold ${status.isCompleted ? 'text-gray-500' : 'text-gray-800'}`}>
                                                {session.profiles?.name || session.profiles?.email?.split('@')[0] || "不明"}
                                            </p>
                                            <p className="text-xs text-gray-500">{session.profiles?.email}</p>
                                        </div>
                                        <span className={`${status.color} text-white text-xs px-2 py-1 rounded-full font-bold`}>
                                            {status.text}
                                        </span>
                                    </div>

                                    {/* 現在の学習内容 */}
                                    {currentPlan ? (
                                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded font-bold">
                                                    {currentPlan.subject}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700 truncate">{currentPlan.content}</p>
                                            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                                                <span>目標: {currentPlan.planned_minutes}分</span>
                                                <span className="font-mono font-bold text-indigo-600">
                                                    経過: {getElapsedTime(currentPlan)}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 rounded-lg p-3 mb-3 text-center text-gray-400 text-sm">
                                            {session.plans.length === 0 ? "計画登録中..." : "全タスク完了"}
                                        </div>
                                    )}

                                    {/* 進捗バー */}
                                    <div className="flex items-center gap-1">
                                        {session.plans.map((plan, idx) => (
                                            <div
                                                key={plan.id}
                                                className={`h-1.5 flex-1 rounded-full ${plan.status === 'completed' ? 'bg-green-500' :
                                                    plan.status === 'in_progress' ? 'bg-indigo-500 animate-pulse' :
                                                        plan.status === 'paused' ? 'bg-yellow-500' :
                                                            'bg-gray-200'
                                                    }`}
                                            />
                                        ))}
                                        {session.plans.length === 0 && (
                                            <div className="h-1.5 flex-1 rounded-full bg-gray-200" />
                                        )}
                                    </div>

                                    {/* 呼び出しインジケーター */}
                                    {needsHelp && (
                                        <div className="mt-3 text-center">
                                            <span className="text-red-500 text-sm font-bold animate-pulse">
                                                🙋 講師を呼んでいます
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {sessions.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-400">
                                <p className="text-4xl mb-4">📚</p>
                                <p>現在アクティブな生徒はいません</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 右側: 詳細パネル */}
                {selectedSession && (
                    <div className="w-96 bg-white rounded-xl shadow-lg p-6 sticky top-24 self-start max-h-[calc(100vh-120px)] overflow-y-auto">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">
                                    {selectedSession.profiles?.name || selectedSession.profiles?.email?.split('@')[0]}
                                </h2>
                                <p className="text-xs text-gray-500">{selectedSession.profiles?.email}</p>
                            </div>
                            <button
                                onClick={() => setSelectedSession(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        {/* 学習タイムライン */}
                        <div className="mb-6">
                            <h3 className="text-sm font-bold text-gray-600 mb-3">📋 今日の学習計画</h3>
                            <div className="space-y-2">
                                {selectedSession.plans.map((plan, idx) => (
                                    <div
                                        key={plan.id}
                                        className={`p-3 rounded-lg border ${plan.status === 'completed' ? 'bg-green-50 border-green-200' :
                                            plan.status === 'in_progress' ? 'bg-indigo-50 border-indigo-200' :
                                                plan.status === 'paused' ? 'bg-yellow-50 border-yellow-200' :
                                                    'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-400">{idx + 1}</span>
                                            <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">
                                                {plan.subject}
                                            </span>
                                            {plan.status === 'completed' && <span className="text-green-500">✓</span>}
                                            {plan.status === 'paused' && <span className="text-yellow-500">⏸</span>}
                                        </div>
                                        <p className="text-sm text-gray-700">{plan.content}</p>
                                        <div className="flex justify-between mt-2 text-xs text-gray-500">
                                            <span>予定: {plan.planned_minutes}分</span>
                                            <span className="font-bold">{getElapsedTime(plan)}</span>
                                        </div>
                                    </div>
                                ))}
                                {selectedSession.plans.length === 0 && (
                                    <p className="text-gray-400 text-sm text-center py-4">まだ計画が登録されていません</p>
                                )}
                            </div>
                        </div>

                        {/* 観察ログ入力（自動保存） */}
                        <div className="border-t border-gray-300 pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-gray-800">📝 観察ログ</h3>
                                <span className={`text-xs px-2 py-0.5 rounded ${saveStatus === 'saved' ? 'text-green-600 bg-green-50' : saveStatus === 'saving' ? 'text-yellow-600 bg-yellow-50' : 'text-gray-400 bg-gray-100'}`}>
                                    {saveStatus === 'saved' ? '✓ 保存済み' : saveStatus === 'saving' ? '保存中...' : '編集中'}
                                </span>
                            </div>
                            <textarea
                                value={logMessage}
                                onChange={(e) => handleLogChange(e.target.value)}
                                placeholder="観察メモを入力...（自動保存されます）"
                                className="w-full border-2 border-gray-300 rounded-lg p-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:border-indigo-500 bg-white"
                                rows={6}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
