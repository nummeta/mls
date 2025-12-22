"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function TutorCallButton() {
  const supabase = createClient();
  const [tutorStatus, setTutorStatus] = useState<"available" | "busy" | "offline">("offline");
  const [myRequestId, setMyRequestId] = useState<string | null>(null);
  const [meetUrl, setMeetUrl] = useState<string | null>(null);
  
  // ★追加: 自分のロールを確認するため
  const [isTutor, setIsTutor] = useState(false);

  useEffect(() => {
    const init = async () => {
      // 1. 自分が講師かどうかチェック
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role === 'tutor') {
          setIsTutor(true);
          return; // 講師ならこれ以降の処理（監視など）は不要
        }
      }
      
      // 2. 講師のステータス監視
      checkTutorStatus();
      
      const channel1 = supabase.channel("tutor_status_sub")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, 
          (payload) => {
            // 変更があったユーザーが講師ならステータス更新
            if (payload.new.role === 'tutor') {
              setTutorStatus(payload.new.tutor_status);
            }
          }
        ).subscribe();

      // 3. 自分のリクエスト監視
      const channel2 = supabase.channel("my_request_sub")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "help_requests" }, 
          (payload) => {
            if (payload.new.id === myRequestId && payload.new.status === 'talking') {
              setMeetUrl(payload.new.meet_url);
              alert("講師が入室しました！通話に参加してください。");
              window.open(payload.new.meet_url, "_blank");
            }
          }
        ).subscribe();

      return () => {
        supabase.removeChannel(channel1);
        supabase.removeChannel(channel2);
      };
    };

    init();
  }, [myRequestId]);

  const checkTutorStatus = async () => {
    // 最初の1人の講師のステータスを取得（簡易実装）
    const { data } = await supabase.from("profiles").select("tutor_status").eq("role", "tutor").limit(1).single();
    if (data) setTutorStatus(data.tutor_status as any);
  };

  const handleRequestHelp = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (tutorStatus !== 'available') {
      alert("現在講師は取り込み中かオフラインです。");
      return;
    }

    const { data, error } = await supabase.from("help_requests").insert({
      student_id: user.id,
      status: "pending"
    }).select().single();

    if (!error && data) {
      setMyRequestId(data.id);
      alert("講師を呼び出しました。そのままお待ちください...");
    }
  };

  // ★講師なら何も表示しない
  if (isTutor) return null;

  if (meetUrl) {
    return (
      <a href={meetUrl} target="_blank" className="fixed bottom-6 right-6 bg-green-600 text-white p-4 rounded-full shadow-lg font-bold animate-bounce z-50">
        📞 通話に参加する
      </a>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
      <div className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow transition-colors duration-300
        ${tutorStatus === 'available' ? 'bg-green-500' : tutorStatus === 'busy' ? 'bg-red-500' : 'bg-gray-400'}
      `}>
        {tutorStatus === 'available' ? '講師待機中' : tutorStatus === 'busy' ? '講師対応中' : '講師オフライン'}
      </div>

      <button 
        onClick={handleRequestHelp}
        disabled={tutorStatus !== 'available' || !!myRequestId}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-all
          ${!!myRequestId ? "bg-yellow-400 animate-pulse cursor-wait" : 
            tutorStatus === 'available' ? "bg-blue-600 hover:bg-blue-700 text-white hover:scale-105" : "bg-gray-300 text-gray-500 cursor-not-allowed"}
        `}
      >
        {!!myRequestId ? "⏳" : "✋"}
      </button>
    </div>
  );
}