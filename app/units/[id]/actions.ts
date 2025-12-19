"use server";

import { createClient } from "@/utils/supabase/server";

// 1. 学習開始
export async function startSession(unitId: string, _userId: string) { 
  // ※ _userId は使いません（クライアントからの申告は無視して、サーバー側で検証する）
  const supabase = await createClient();
  
  // ★重要：サーバー側でユーザーIDを再取得
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインしてください");

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id, // ★本物のIDを使う
      unit_id: unitId,
      start_time: new Date().toISOString(),
      is_completed: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// 2. クイズ回答の保存
export async function saveAttempt(
  sessionId: string,
  _userId: string, // 無視
  quizId: string,
  choiceId: string,
  isCorrect: boolean,
  unitId: string,
  clearedTypeCount: number,
  totalTypeCount: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインしてください");

  // A. 回答履歴
  await supabase.from("quiz_attempts").insert({
    session_id: sessionId,
    user_id: user.id, // ★本物のID
    quiz_id: quizId,
    choice_id: choiceId,
    is_correct: isCorrect,
    attempted_at: new Date().toISOString(),
  });

  // B. スコア更新
  const progressRate = totalTypeCount > 0 ? clearedTypeCount / totalTypeCount : 0;

  await supabase.from("unit_scores").upsert({
    user_id: user.id, // ★本物のID
    unit_id: unitId,
    correct_count: clearedTypeCount,
    total_quiz_types: totalTypeCount,
    progress_rate: progressRate,
    last_updated: new Date().toISOString(),
  }, { onConflict: "user_id, unit_id" });
}

// 3. 動画レッスンの完了（★ここを修正）
export async function completeSession(sessionId: string) {
  const supabase = await createClient();
  const now = new Date(); // 終了時刻

  // まず開始時間を取得して、経過時間を計算する
  const { data: session } = await supabase
    .from("sessions")
    .select("start_time")
    .eq("id", sessionId)
    .single();

  let duration = 0;
  if (session?.start_time) {
    const startTime = new Date(session.start_time);
    // ミリ秒を秒に変換（端数は切り捨て）
    duration = Math.floor((now.getTime() - startTime.getTime()) / 1000);
  }

  // 終了時間と計算したdurationを保存
  const { error } = await supabase
    .from("sessions")
    .update({
      is_completed: true,
      end_time: now.toISOString(),
      duration: duration, // ★追加
    })
    .eq("id", sessionId);
    
  if (error) console.error("Session completion failed:", error);
}

// 4. ペーパーテストの結果保存（★ここを修正）
export async function saveTestResult(
  unitId: string,
  userId: string,
  score: number,
  duration: number
) {
  const supabase = await createClient();
  const now = new Date();

  // 1. セッションを作成して即完了にする
  // ★ここで duration も一緒に保存する
  const { error: sessionError } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      unit_id: unitId,
      start_time: new Date(now.getTime() - duration * 1000).toISOString(), // 開始時間を逆算して入れる（分析用）
      end_time: now.toISOString(),
      duration: duration, // ★保存
      is_completed: true,
    });

  if (sessionError) throw new Error(sessionError.message);

  // 2. スコア保存
  const { error: scoreError } = await supabase
    .from("unit_scores")
    .upsert({
      user_id: userId,
      unit_id: unitId,
      raw_score: score,
      duration: duration,
      progress_rate: 1,
      last_updated: now.toISOString(),
    }, { onConflict: "user_id, unit_id" });

  if (scoreError) throw new Error(scoreError.message);
}