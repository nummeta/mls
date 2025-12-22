"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

// (型定義などはそのまま)
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
  last_seen_at: string;
};

export default function TutorDashboard() {
  const supabase = createClient();
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [students, setStudents] = useState<StudentStatus[]>([]);
  const [myStatus, setMyStatus] = useState("offline");
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchRequests();
    fetchStudents();
    audioRef.current = new Audio("/alert.mp3");

    // 自分の初期ステータスを取得して反映
    const fetchMyStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('tutor_status').eq('id', user.id).single();
        if (data) setMyStatus(data.tutor_status);
      }
    };
    fetchMyStatus();

    const channelRequests = supabase
      .channel("help_requests_monitor")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "help_requests" },
        (payload: any) => {
          const newReq = payload.new as HelpRequest;
          setRequests((prev) => [...prev, newReq]);
          playSound();
          alert("生徒から質問リクエストが届きました！");
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "help_requests" },
        (payload: any) => {
          fetchRequests();
        }
      )
      .subscribe();

    const channelProfiles = supabase
      .channel("profiles_monitor")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => {
          fetchStudents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelRequests);
      supabase.removeChannel(channelProfiles);
    };
  }, []);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from("help_requests")
      .select("*, profiles(email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    
    if (data) setRequests(data as any);
  };

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "student");
    if (data) setStudents(data as any);
  };

  const playSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log("音声再生ブロック: クリックが必要です"));
    }
  };

  const toggleStatus = async (status: "available" | "busy" | "offline") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 即時反映
    setMyStatus(status);
    await supabase.from("profiles").update({ tutor_status: status }).eq("id", user.id);
  };

  const handleAccept = async (reqId: string) => {
    const meetUrl = prompt("ビデオ通話のURLを入力してください", "https://meet.google.com/xxx-xxxx-xxx");
    if (!meetUrl) return;

    await supabase
      .from("help_requests")
      .update({ status: "talking", meet_url: meetUrl })
      .eq("id", reqId);

    toggleStatus("busy");
    window.open(meetUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* ヘッダー & ステータス切り替え */}
        <div className="bg-white p-6 rounded-xl shadow-sm flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">👨‍🏫 講師ダッシュボード</h1>
          
          {/* ★修正: ボタンのデザインを見やすく変更 */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-full">
            <button 
              onClick={() => toggleStatus("available")}
              className={`px-6 py-2 rounded-full font-bold transition-all ${
                myStatus === 'available' 
                  ? 'bg-green-500 text-white shadow-md' 
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
              }`}
            >
              待機中 (Available)
            </button>
            <button 
              onClick={() => toggleStatus("busy")}
              className={`px-6 py-2 rounded-full font-bold transition-all ${
                myStatus === 'busy' 
                  ? 'bg-red-500 text-white shadow-md' 
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
              }`}
            >
              対応中 (Busy)
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
                  <button 
                    onClick={() => handleAccept(req.id)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow"
                  >
                    📞 通話を開始する
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 📚 生徒の学習状況一覧 */}
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📚 学習中の生徒</h2>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 text-gray-500 font-bold">生徒名</th>
                <th className="text-left p-3 text-gray-500 font-bold">現在のステータス</th>
                <th className="text-left p-3 text-gray-500 font-bold">最終アクティブ</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id} className="border-b last:border-0">
                  <td className="p-3 font-medium text-gray-900">{student.email}</td>
                  <td className="p-3">
                    {student.current_unit_id ? (
                      <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold">学習中</span>
                    ) : (
                      <span className="text-gray-400 bg-gray-100 px-2 py-1 rounded text-xs">オフライン</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-gray-500">
                    {new Date(student.last_seen_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={3} className="p-4 text-center text-gray-400">生徒データが見つかりません</td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}