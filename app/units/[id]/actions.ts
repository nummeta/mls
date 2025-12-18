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

// 3. 完了処理
export async function completeSession(sessionId: string) {
  const supabase = await createClient();
  // 念の為ログインチェック
  const { error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error("Auth Error");

  await supabase
    .from("sessions")
    .update({
      is_completed: true,
      end_time: new Date().toISOString(),
    })
    .eq("id", sessionId);
}