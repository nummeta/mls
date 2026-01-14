"use server";

import { createClient } from "@/utils/supabase/server";

// ... (既存のimportとgenerateWeeklyReportはそのまま)

import { headers } from "next/headers"; // 追加

// 2. アップロード用URLの発行
export async function createUploadUrl(userId: string) {
  const supabase = await createClient();
  
  // ランダムなトークンを生成 (簡易的にUUIDを使用)
  const token = crypto.randomUUID();
  
  // 有効期限 (例: 24時間後)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  // DBに保存
  const { error } = await supabase.from("upload_requests").insert({
    token: token,
    user_id: userId,
    status: 'pending',
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error("Token creation failed:", error);
    throw new Error("アップロードリクエストの作成に失敗しました");
  }

  // 現在のドメインを取得してURLを組み立てる
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  
  const url = `${protocol}://${host}/upload/${token}`;
  
  return url;
}

export async function generateWeeklyReport(userId: string, fromDate: string, toDate: string) {
  console.log("🚀 レポート生成を開始します:", { userId, fromDate, toDate });
  
  const supabase = await createClient();

  // 1. 学習データの収集
  const { data: scores, error: scoresError } = await supabase
    .from("unit_scores")
    .select("*, units(*)")
    .eq("user_id", userId)
    .gte("last_updated", fromDate);

  if (scoresError) {
    console.error("❌ スコア取得エラー:", scoresError);
    throw new Error("学習データの取得に失敗しました");
  }

  // 2. アップロード画像の収集
  const { data: uploads, error: uploadsError } = await supabase
    .from("upload_requests")
    .select("image_path")
    .eq("user_id", userId)
    .eq("status", "uploaded")
    .gte("created_at", fromDate);
    
  if (uploadsError) {
    console.error("❌ 画像取得エラー:", uploadsError);
  }

  // 本来はここでAIにデータを投げますが、現在はダミーデータを生成します
  console.log(`📊 集計結果: スコア${scores?.length}件, 画像${uploads?.length}件`);

  const result = {
    learning_summary: `期間中（${fromDate}〜${toDate}）、合計${scores?.length || 0}個の単元に取り組みました。特に動画視聴によるインプットが進んでいます。`,
    mastery_summary: "基本問題の正答率は概ね良好ですが、応用問題でのケアレスミスが散見されます。引き続き反復練習が必要です。",
    weakness_analysis: "提出された答案画像を確認したところ、途中式の記述が省略されがちです。論理の飛躍がないよう丁寧に書く指導を行いました。",
    oral_exam_questions: "1. 今回間違えた問題で、最初に立てた式とその理由を説明してください。\n2. 答えが合わないと気づいた時、どのように見直しをしましたか？\n3. この公式が使える条件は何ですか？"
  };

  // 3. レポートの保存
  const { data, error: insertError } = await supabase.from("weekly_reports").insert({
    user_id: userId,
    start_date: fromDate,
    end_date: toDate,
    ...result
  })
  .select();

  if (insertError) {
    console.error("❌ レポート保存エラー:", insertError);
    throw new Error("レポートの保存に失敗しました: " + insertError.message);
  }

  console.log("✅ レポート生成成功:", data);
}