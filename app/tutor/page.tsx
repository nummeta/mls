"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

// --- 型定義 ---
type HelpRequest = {
  id: string;
  student_id: string;
  status: string;
  created_at: string;
  profiles?: { email: string };
};

type StudentStatus = {
  id: string;
  email: string;
  current_unit_id: string;
  current_activity: string; // 何をしているか (video, quiz...)
  current_unit_started_at: string; // その単元の開始時刻
  last_seen_at: string; // 最終生存確認
  units?: { name: string }; // 結合された単元情報
};

export default function TutorDashboard() {
  const supabase = createClient();
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [students, setStudents] = useState<StudentStatus[]>([]);
  const [myStatus, setMyStatus] = useState("offline");
  
  // 画面の時間を進めるためのカウンタ (10秒ごとに更新)
  const [tick, setTick] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchRequests();
    fetchStudents();
    audioRef.current = new Audio("/alert.mp3");

    // 自分の初期ステータス
    const fetchMyStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('tutor_status').eq('id', user.id).single();
        if (data) setMyStatus(data.tutor_status);
      }
    };
    fetchMyStatus();

    // --- リアルタイム監視 ---

    // 1. リクエスト監視
    const channelRequests = supabase
      .channel("tutor_dashboard_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "help_requests" },
        (payload) => {
          // INSERT(新規)時のみ音を鳴らす
          if (payload.eventType === 'INSERT') {
            playSound();
            alert("🔔 生徒から質問リクエストが届きました！");
          }
          // ステータス変更(生徒がキャンセルした場合など)もあるので常に最新を取得
          fetchRequests();
        }
      )
      .subscribe();

    // 2. 生徒の学習状況監視
    const channelProfiles = supabase
      .channel("tutor_dashboard_profiles")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => {
          fetchStudents();
        }
      )
      .subscribe();

    // 3. 経過時間表示用のタイマー (10秒ごとに再レンダリング)
    const timer = setInterval(() => setTick(t => t + 1), 10000);

    return () => {
      supabase.removeChannel(channelRequests);
      supabase.removeChannel(channelProfiles);
      clearInterval(timer);
    };
  }, []);

  const fetchRequests = async () => {
    // pending (未解決) のみ取得
    const { data } = await supabase
      .from("help_requests")
      .select("*, profiles(email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    
    if (data) setRequests(data as any);
  };

  const fetchStudents = async () => {
    // 生徒一覧 + 現在の単元名を取得
    const { data } = await supabase
      .from("profiles")
      .select(`
        *,
        units ( name )
      `)
      .eq("role", "student")
      .order("last_seen_at", { ascending: false }); // 最近アクセスした順
    
    if (data) setStudents(data as any);
  };

  const playSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  const toggleStatus = async (status: "available" | "busy" | "offline") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyStatus(status);
    await supabase.from("profiles").update({ tutor_status: status }).eq("id", user.id);
  };

  // ★修正: ビデオ通話URL入力などは廃止し、完了ステータスに変更するだけにする
  const handleResolve = async (reqId: string) => {
    if (!confirm("このリクエストを「対応済み」にしますか？")) return;

    await supabase
      .from("help_requests")
      .update({ status: "resolved" })
      .eq("id", reqId);
    
    // fetchRequestsはリアルタイムリスナー経由または次回更新で反映されますが、念のため即時呼ぶ
    fetchRequests();
  };

  // --- ヘルパー関数: 経過時間の計算 ---
  const getDuration = (startedAt: string) => {
    if (!startedAt) return "-";
    const start = new Date(startedAt).getTime();
    const now = new Date().getTime();
    const diffMins = Math.floor((now - start) / 60000); // 分換算
    
    if (diffMins < 0) return "0分";
    if (diffMins < 60) return `${diffMins}分`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}時間${mins}分`;
  };

  // --- ヘルパー関数: 生徒の状態判定 ---
  const getStudentState = (student: StudentStatus) => {
    if (!student.last_seen_at) return { status: 'offline', text: '未アクセス' };

    const lastSeen = new Date(student.last_seen_at).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - lastSeen) / 1000 / 60;

    // 2分以上更新（ハートビート）がなければオフラインとみなす
    if (diffMinutes > 2) {
      return { 
        status: 'offline', 
        text: `オフライン (${Math.floor(diffMinutes)}分前)`,
        bgClass: "opacity-50 bg-gray-50"
      };
    }

    // オンラインの場合、activityの内容で表示を変える
    let activityText = "学習中";
    if (student.current_activity === 'video') activityText = "📺 動画視聴中";
    else if (student.current_activity === 'quiz') activityText = "✍️ クイズ回答中";
    else if (student.current_activity === 'intro') activityText = "📖 導入確認中";
    else if (student.current_activity === 'outro') activityText = "🎉 完了画面";

    return { 
      status: 'online', 
      text: activityText, 
      unitName: student.units?.name || "不明な単元",
      duration: getDuration(student.current_unit_started_at),
      bgClass: "bg-green-50/30"
    };
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* ヘッダー & ステータス切り替え */}
        <div className="bg-white p-6 rounded-xl shadow-sm flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">👨‍🏫 講師ダッシュボード</h1>
          
          <div className="flex gap-2 bg-gray-100 p-1 rounded-full">
            <button 
              onClick={() => toggleStatus("available")}
              className={`px-6 py-2 rounded-full font-bold transition-all ${
                myStatus === 'available' 
                  ? 'bg-green-500 text-white shadow-md' 
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
              }`}
            >
              待機中
            </button>
            <button 
              onClick={() => toggleStatus("busy")}
              className={`px-6 py-2 rounded-full font-bold transition-all ${
                myStatus === 'busy' 
                  ? 'bg-red-500 text-white shadow-md' 
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
              }`}
            >
              対応中
            </button>
          </div>
        </div>

        {/* 🚨 質問リクエスト一覧 */}
        <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-orange-100">
          <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
            🚨 質問リクエスト ({requests.length})
          </h2>
          {requests.length === 0 ? (
            <p className="text-gray-400">現在リクエストはありません</p>
          ) : (
            <div className="space-y-4">
              {requests.map(req => (
                <div key={req.id} className="bg-orange-50 p-4 rounded-lg border border-orange-200 flex justify-between items-center animate-pulse">
                  <div>
                    <p className="font-bold text-lg">{req.profiles?.email || "不明な生徒"}</p>
                    <p className="text-sm text-gray-500">{new Date(req.created_at).toLocaleTimeString()} - 呼び出し</p>
                  </div>
                  {/* シンプルな完了ボタンに変更 */}
                  <button 
                    onClick={() => handleResolve(req.id)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow"
                  >
                    ✅ 対応完了にする
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 📚 学習中の生徒一覧 (詳細版) */}
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📚 生徒の状況 (リアルタイム)</h2>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 text-gray-500 font-bold">生徒名</th>
                <th className="text-left p-3 text-gray-500 font-bold">状態</th>
                <th className="text-left p-3 text-gray-500 font-bold">学習中の内容</th>
                <th className="text-left p-3 text-gray-500 font-bold">経過時間</th>
                <th className="text-left p-3 text-gray-500 font-bold">最終更新</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map(student => {
                const state = getStudentState(student);
                const isOnline = state.status === 'online';

                return (
                  <tr key={student.id} className={state.bgClass}>
                    <td className="p-3 font-medium text-gray-900">
                      {student.email}
                      {isOnline && <span className="ml-2 w-2 h-2 inline-block bg-green-500 rounded-full animate-pulse"></span>}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {state.text}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-700">
                      {isOnline ? state.unitName : "-"}
                    </td>
                    <td className="p-3 text-sm font-mono text-gray-700">
                      {isOnline ? state.duration : "-"}
                    </td>
                    <td className="p-3 text-sm text-gray-500">
                      {new Date(student.last_seen_at).toLocaleTimeString()}
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-gray-400">生徒データが見つかりません</td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}