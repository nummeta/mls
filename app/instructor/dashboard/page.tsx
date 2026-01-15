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

// ★対話チケット関連の型
type SupportTicket = {
    id: string;
    student_id: string;
    instructor_id: string | null;
    unit_ids: string[];
    status: string;
    created_at: string;
    assigned_at: string | null;
    profiles?: { name: string | null; email: string };
    unit_names?: string[];
};

// ★生徒ステータス型（tutorページと同様）
type StudentStatus = {
    id: string;
    email: string;
    name: string | null;
    current_unit_id: string;
    current_activity: string; // video, quiz, intro, outro
    current_unit_started_at: string;
    last_seen_at: string;
    units?: { name: string };
};

// ★本日の学習履歴型
type TodaySession = {
    id: string;
    unit_id: string;
    unit_name: string;
    unit_type: string; // 'input', 'throughput', 'test'
    duration_seconds: number | null;
    created_at: string;
    // Input単元用: クイズ結果
    quiz_correct?: number;
    quiz_total?: number;
    // Output単元用: テスト結果
    test_score?: number;
    test_max?: number;
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

    // ★対話チケット関連のステート
    const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
    const [activeTab, setActiveTab] = useState<'students' | 'tickets'>('students');
    const [myAssignedTicket, setMyAssignedTicket] = useState<SupportTicket | null>(null);
    const [isClaimingTicket, setIsClaimingTicket] = useState(false);
    const [evaluationNote, setEvaluationNote] = useState("");

    // ★生徒ステータス（tutorページと同様）
    const [students, setStudents] = useState<StudentStatus[]>([]);
    // ★本日の学習履歴（生徒IDごと）
    const [studentHistory, setStudentHistory] = useState<Record<string, TodaySession[]>>({});

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
        fetchStudents(); // ★生徒ステータス取得
        fetchTodayHistory(); // ★本日の学習履歴取得
        fetchSupportTickets();
        checkMyAssignedTicket();

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

        // ★リアルタイム監視: 対話チケット
        const channelTickets = supabase
            .channel("instructor_tickets")
            .on("postgres_changes",
                { event: "*", schema: "public", table: "support_tickets" },
                (payload) => {
                    console.log("📡 support_tickets changed:", payload.eventType);
                    if (payload.eventType === 'INSERT') {
                        playSound();
                    }
                    fetchSupportTickets();
                    checkMyAssignedTicket();
                }
            )
            .subscribe((status) => {
                console.log("Tickets channel status:", status);
            });

        // ★リアルタイム監視: 生徒プロファイル（学習状況更新）
        const channelProfiles = supabase
            .channel("instructor_profiles")
            .on("postgres_changes",
                { event: "UPDATE", schema: "public", table: "profiles" },
                (payload) => {
                    console.log("📡 profiles changed:", payload.eventType);
                    fetchStudents();
                }
            )
            .subscribe((status) => {
                console.log("Profiles channel status:", status);
            });

        // ★リアルタイム監視: 学習セッション（履歴更新）
        const channelUnitSessions = supabase
            .channel("instructor_unit_sessions")
            .on("postgres_changes",
                { event: "*", schema: "public", table: "sessions" },
                (payload) => {
                    console.log("📡 sessions changed:", payload.eventType);
                    fetchTodayHistory();
                }
            )
            .subscribe((status) => {
                console.log("Unit sessions channel status:", status);
            });

        // 10秒ごとにデータを再取得（バックアップ）
        const timer = setInterval(() => {
            setTick(t => t + 1);
            fetchSessions();
            fetchStudents();
            fetchTodayHistory();
            fetchSupportTickets();
        }, 10000);

        return () => {
            console.log("Cleaning up realtime subscriptions...");
            supabase.removeChannel(channelSessions);
            supabase.removeChannel(channelPlans);
            supabase.removeChannel(channelHelp);
            supabase.removeChannel(channelTickets);
            supabase.removeChannel(channelProfiles);
            supabase.removeChannel(channelUnitSessions);
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

    // ★生徒ステータス取得（tutorページと同様）
    const fetchStudents = async () => {
        const { data } = await supabase
            .from("profiles")
            .select(`*, units ( name )`)
            .eq("role", "student")
            .order("name", { ascending: true, nullsFirst: false }); // 名前順でソート（安定表示）

        if (data) setStudents(data as any);
    };

    // ★本日の学習履歴を取得
    const fetchTodayHistory = async () => {
        // 今日の0時
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        console.log("📚 Fetching today's history since:", today.toISOString());

        // 今日のセッション取得（duration_secondsは存在しない可能性があるのでstart/endで計算）
        const { data: todaySessions, error } = await supabase
            .from("sessions")
            .select(`
                id,
                unit_id,
                user_id,
                start_time,
                end_time,
                created_at,
                is_completed,
                units ( name, type, max_score )
            `)
            .gte("created_at", today.toISOString())
            .order("created_at", { ascending: true });

        console.log("📚 Today's sessions:", todaySessions?.length, "Error:", error);
        if (todaySessions) console.log("📚 Sessions data:", todaySessions);

        if (!todaySessions) return;

        // unit_scores も取得（テストの点数用）
        const { data: unitScores } = await supabase
            .from("unit_scores")
            .select("*")
            .gte("updated_at", today.toISOString());

        // quiz_attempts も取得 (クイズ正答率用)
        const { data: quizAttempts } = await supabase
            .from("quiz_attempts")
            .select("user_id, is_correct, session_id")
            .gte("attempted_at", today.toISOString());

        // 生徒IDごとにグループ化
        const historyMap: Record<string, TodaySession[]> = {};

        for (const session of todaySessions) {
            const studentId = (session as any).user_id;
            const unit = (session as any).units;
            if (!studentId || !unit) continue;

            // クイズ集計
            const sessionQuizzes = quizAttempts?.filter(q => q.session_id === session.id) || [];
            const quizTotal = sessionQuizzes.length;
            const quizCorrect = sessionQuizzes.filter(q => q.is_correct).length;

            // テストスコア
            const testScore = unitScores?.find(s => s.unit_id === session.unit_id && s.user_id === studentId);

            // 時間計算（start_timeとend_timeから）
            let durationSeconds: number | null = null;
            if ((session as any).start_time && (session as any).end_time) {
                const start = new Date((session as any).start_time).getTime();
                const end = new Date((session as any).end_time).getTime();
                durationSeconds = Math.floor((end - start) / 1000);
            }

            const entry: TodaySession = {
                id: session.id,
                unit_id: session.unit_id,
                unit_name: unit.name,
                unit_type: unit.type === 'test' ? 'output' : 'input',
                duration_seconds: durationSeconds,
                created_at: session.created_at || '',
                quiz_correct: quizTotal > 0 ? quizCorrect : undefined,
                quiz_total: quizTotal > 0 ? quizTotal : undefined,
                test_score: testScore?.raw_score,
                test_max: unit.max_score || 100,
            };

            if (!historyMap[studentId]) historyMap[studentId] = [];
            historyMap[studentId].push(entry);
        }

        setStudentHistory(historyMap);
    };

    // ★生徒の状態判定ヘルパー
    const getStudentState = (student: StudentStatus) => {
        if (!student.last_seen_at) return { status: 'offline', text: '未アクセス', bgClass: 'opacity-50 bg-gray-50' };

        const lastSeen = new Date(student.last_seen_at).getTime();
        const now = new Date().getTime();
        const diffMinutes = (now - lastSeen) / 1000 / 60;

        if (diffMinutes > 2) {
            return {
                status: 'offline',
                text: `オフライン`,
                bgClass: "opacity-50 bg-gray-50"
            };
        }

        let activityText = "学習中";
        if (student.current_activity === 'video') activityText = "📺 動画視聴中";
        else if (student.current_activity === 'quiz') activityText = "✍️ クイズ回答中";
        else if (student.current_activity === 'intro') activityText = "📖 導入確認中";
        else if (student.current_activity === 'outro') activityText = "🎉 完了画面";

        return {
            status: 'online',
            text: activityText,
            unitName: student.units?.name || "不明な単元",
            bgClass: "bg-green-50/30"
        };
    };

    const getDuration = (startedAt: string) => {
        if (!startedAt) return "-";
        const start = new Date(startedAt).getTime();
        const now = new Date().getTime();
        const diffMins = Math.floor((now - start) / 60000);
        if (diffMins < 0) return "0分";
        if (diffMins < 60) return `${diffMins}分`;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}時間${mins}分`;
    };

    // ★対話チケット取得
    const fetchSupportTickets = async () => {
        const { data } = await supabase
            .from("support_tickets")
            .select("*")
            .eq("status", "waiting")
            .order("created_at", { ascending: true });

        if (data) {
            // 各チケットのプロフィールと単元名を取得
            const ticketsWithDetails = await Promise.all(
                data.map(async (ticket: any) => {
                    const { data: profileData } = await supabase
                        .from("profiles")
                        .select("email, name")
                        .eq("id", ticket.student_id)
                        .single();

                    // 単元名を取得
                    const unitIds = ticket.unit_ids as string[];
                    let unitNames: string[] = [];
                    if (unitIds && unitIds.length > 0) {
                        const { data: units } = await supabase
                            .from("units")
                            .select("name")
                            .in("id", unitIds);
                        unitNames = units?.map((u: any) => u.name) || [];
                    }

                    return {
                        ...ticket,
                        profiles: profileData || { email: "不明", name: null },
                        unit_names: unitNames
                    } as SupportTicket;
                })
            );
            setSupportTickets(ticketsWithDetails);
        }
    };

    // ★自分が対応中のチケットをチェック（リロード対応）
    const checkMyAssignedTicket = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("support_tickets")
            .select("*")
            .eq("instructor_id", user.id)
            .eq("status", "assigned")
            .single();

        if (data) {
            // プロフィールと単元名を取得
            const { data: profileData } = await supabase
                .from("profiles")
                .select("email, name")
                .eq("id", data.student_id)
                .single();

            const unitIds = data.unit_ids as string[];
            let unitNames: string[] = [];
            if (unitIds && unitIds.length > 0) {
                const { data: units } = await supabase
                    .from("units")
                    .select("name")
                    .in("id", unitIds);
                unitNames = units?.map((u: any) => u.name) || [];
            }

            setMyAssignedTicket({
                ...data,
                profiles: profileData || { email: "不明", name: null },
                unit_names: unitNames
            } as SupportTicket);
            setActiveTab('tickets'); // 対応中ならチケットタブに固定
        } else {
            setMyAssignedTicket(null);
        }
    };

    // ★チケット挙手（対応する）
    const handleClaimTicket = async (ticketId: string) => {
        console.log("🎫 handleClaimTicket called:", ticketId);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error("No user logged in");
            return;
        }
        console.log("User:", user.id);

        setIsClaimingTicket(true);
        try {
            // チケットを更新
            const { data: updateResult, error: ticketError } = await supabase
                .from("support_tickets")
                .update({
                    instructor_id: user.id,
                    status: 'assigned',
                    assigned_at: new Date().toISOString()
                })
                .eq("id", ticketId)
                .eq("status", "waiting")
                .select();

            console.log("Ticket update result:", { updateResult, ticketError });

            if (ticketError) {
                console.error("Ticket update error:", ticketError);
                alert(`チケット更新エラー: ${ticketError.message}`);
                return;
            }

            if (!updateResult || updateResult.length === 0) {
                console.error("No ticket updated - maybe already claimed?");
                alert("チケットの更新に失敗しました（既に他の講師が対応中かもしれません）");
                await fetchSupportTickets();
                return;
            }

            // 講師ステータスを更新（instructorsテーブルに存在しない場合は無視）
            const { error: instructorError } = await supabase
                .from("instructors")
                .update({
                    status: 'busy',
                    updated_at: new Date().toISOString()
                })
                .eq("id", user.id);

            if (instructorError) {
                console.warn("Instructor status update warning:", instructorError);
                // instructorテーブルに存在しなくても続行
            }

            console.log("Calling fetchSupportTickets and checkMyAssignedTicket...");
            await fetchSupportTickets();
            await checkMyAssignedTicket();
            console.log("Done!");
        } catch (e) {
            console.error("Claim ticket error:", e);
            alert("チケットの取得に失敗しました");
        } finally {
            setIsClaimingTicket(false);
        }
    };

    // ★対話完了
    const handleCompleteTicket = async () => {
        if (!myAssignedTicket) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            // 対話債権を解消
            const unitIds = myAssignedTicket.unit_ids;
            for (const unitId of unitIds) {
                await supabase
                    .from("student_progress")
                    .update({ dialogue_cleared: true })
                    .eq("unit_id", unitId)
                    .eq("student_id", myAssignedTicket.student_id);
            }

            // チケットを完了に（評価メモも保存）
            await supabase
                .from("support_tickets")
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    evaluation_note: evaluationNote || null
                })
                .eq("id", myAssignedTicket.id);

            // 講師ステータスを戻す
            await supabase
                .from("instructors")
                .update({
                    status: 'idle',
                    updated_at: new Date().toISOString()
                })
                .eq("id", user.id);

            setMyAssignedTicket(null);
            setEvaluationNote("");
            await fetchSupportTickets();
        } catch (e) {
            console.error("Complete ticket error:", e);
            alert("完了処理に失敗しました");
        }
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
                        {supportTickets.length > 0 && (
                            <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                                🎫 対話待ち {supportTickets.length}件
                            </span>
                        )}
                    </div>
                </div>
                {/* ★タブナビゲーション */}
                <div className="max-w-7xl mx-auto px-6 pb-2 flex gap-2">
                    <button
                        onClick={() => !myAssignedTicket && setActiveTab('students')}
                        disabled={!!myAssignedTicket}
                        className={`px-4 py-2 rounded-t-lg font-bold transition ${activeTab === 'students'
                            ? 'bg-gray-100 text-indigo-600 border-b-2 border-indigo-600'
                            : 'text-gray-500 hover:text-gray-700'
                            } ${myAssignedTicket ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        👥 生徒モニタリング
                    </button>
                    <button
                        onClick={() => setActiveTab('tickets')}
                        className={`px-4 py-2 rounded-t-lg font-bold transition flex items-center gap-2 ${activeTab === 'tickets'
                            ? 'bg-gray-100 text-orange-600 border-b-2 border-orange-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        🎫 対話チケット
                        {(supportTickets.length > 0 || myAssignedTicket) && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${myAssignedTicket ? 'bg-green-500 text-white' : 'bg-orange-200 text-orange-800'
                                }`}>
                                {myAssignedTicket ? '対応中' : supportTickets.length}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
                {/* ★対話チケットタブ */}
                {activeTab === 'tickets' ? (
                    <div className="flex-1">
                        {/* 対応中のチケット */}
                        {myAssignedTicket ? (
                            <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
                                <div className="bg-green-50 rounded-lg p-4 mb-6">
                                    <span className="text-green-600 font-bold">✅ 対応中</span>
                                </div>

                                <div className="mb-6">
                                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                                        {myAssignedTicket.profiles?.name || myAssignedTicket.profiles?.email?.split('@')[0] || '不明'}
                                    </h3>
                                    <p className="text-sm text-gray-500">{myAssignedTicket.profiles?.email}</p>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                    <p className="text-sm font-bold text-gray-600 mb-2">📚 報告対象の単元:</p>
                                    <ul className="space-y-1">
                                        {myAssignedTicket.unit_names?.map((name, i) => (
                                            <li key={i} className="text-sm text-gray-700">• {name}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="mb-6">
                                    <label className="text-sm font-bold text-gray-600 mb-2 block">
                                        📝 評価メモ（任意）:
                                    </label>
                                    <textarea
                                        value={evaluationNote}
                                        onChange={(e) => setEvaluationNote(e.target.value)}
                                        placeholder="生徒の理解度や気づきをメモ..."
                                        className="w-full border-2 border-gray-300 rounded-lg p-3 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-white"
                                        rows={4}
                                    />
                                </div>

                                <button
                                    onClick={handleCompleteTicket}
                                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                                >
                                    ✅ 対話完了
                                </button>
                            </div>
                        ) : (
                            /* 待機チケット一覧 */
                            <div>
                                <h2 className="text-lg font-bold text-gray-800 mb-4">🎫 対話待ちチケット</h2>

                                {supportTickets.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <p className="text-4xl mb-4">🎫</p>
                                        <p>現在待機中のチケットはありません</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {supportTickets.map(ticket => (
                                            <div key={ticket.id} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className="font-bold text-gray-800">
                                                            {ticket.profiles?.name || ticket.profiles?.email?.split('@')[0] || '不明'}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mb-2">{ticket.profiles?.email}</p>
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {ticket.unit_names?.map((name, i) => (
                                                                <span key={i} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                                                    {name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <p className="text-xs text-gray-400">
                                                            {new Date(ticket.created_at).toLocaleTimeString()} に作成
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleClaimTicket(ticket.id)}
                                                        disabled={isClaimingTicket}
                                                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold transition disabled:opacity-50"
                                                    >
                                                        {isClaimingTicket ? '...' : '🙋 対応する'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* 生徒モニタリングタブ（既存） */
                    <>
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

                            {/* 生徒カード一覧（学習履歴含む） */}
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-gray-800">📚 生徒の状況</h2>

                                {students.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <p>生徒データが見つかりません</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {students.map(student => {
                                            const state = getStudentState(student);
                                            const isOnline = state.status === 'online';
                                            const history = studentHistory[student.id] || [];
                                            const formatMins = (sec: number | null) => sec ? `${Math.floor(sec / 60)}分` : '-';

                                            return (
                                                <div
                                                    key={student.id}
                                                    className={`bg-white rounded-xl p-4 border shadow-sm ${isOnline ? 'border-green-200' : 'border-gray-200 opacity-60'}`}
                                                >
                                                    {/* ヘッダー */}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            {isOnline && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
                                                            <span className="font-bold text-gray-800">
                                                                {student.name || student.email?.split('@')[0]}
                                                            </span>
                                                        </div>
                                                        <span className={`text-xs px-2 py-1 rounded font-bold ${isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {state.text}
                                                        </span>
                                                    </div>

                                                    {/* 現在の学習（オンライン時） */}
                                                    {isOnline && (
                                                        <div className="bg-blue-50 rounded-lg p-3 mb-3 text-sm">
                                                            <span className="text-blue-800 font-bold">📍 現在:</span>{' '}
                                                            <span className="text-blue-700">{(state as any).unitName}</span>
                                                            <span className="text-blue-500 ml-2">({getDuration(student.current_unit_started_at)})</span>
                                                        </div>
                                                    )}

                                                    {/* 本日の学習履歴 */}
                                                    {history.length > 0 ? (
                                                        <div className="space-y-2">
                                                            <p className="text-xs text-gray-500 font-bold">📋 今日の学習:</p>
                                                            {history.map((session, idx) => (
                                                                <div key={session.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${session.unit_type === 'output' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                                                            }`}>
                                                                            {session.unit_type === 'output' ? 'Output' : 'Input'}
                                                                        </span>
                                                                        <span className="text-gray-700 truncate max-w-[150px]">{session.unit_name}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                                                        <span>⏱ {formatMins(session.duration_seconds)}</span>
                                                                        {session.quiz_total !== undefined && (
                                                                            <span className="text-blue-600 font-bold">
                                                                                ✓ {session.quiz_correct}/{session.quiz_total}
                                                                            </span>
                                                                        )}
                                                                        {session.test_score !== undefined && (
                                                                            <span className="text-orange-600 font-bold">
                                                                                📝 {session.test_score}/{session.test_max}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-400 text-center py-2">今日の学習履歴なし</p>
                                                    )}
                                                </div>
                                            );
                                        })}
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
                    </>
                )}
            </div>
        </div>
    );
}

