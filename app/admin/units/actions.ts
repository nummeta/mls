"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 1. 作成処理
export async function createUnit(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const sectionId = formData.get("section_id") as string;
  const type = formData.get("type") as string;
  const file = formData.get("file") as File; // 動画用
  const questionFile = formData.get("question_file") as File; // ★問題PDF
  const answerFile = formData.get("answer_file") as File; // ★解答PDF
  const sortOrder = parseInt(formData.get("sort_order") as string) || 10;

  // ★3つのメッセージを取得
  const message = formData.get("message") as string;
  const intro = formData.get("intro") as string;
  const outro = formData.get("outro") as string;

  if (!name || !sectionId) throw new Error("必須項目が足りません");

  let videoUrl = null;
  let answerUrl = null;
  let questionPdfUrl = null;

  // 動画ファイル処理
  if (file && file.size > 0) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(fileName, file);
    if (uploadError) throw new Error("動画アップロード失敗: " + uploadError.message);
    const { data: { publicUrl } } = supabase.storage.from("videos").getPublicUrl(fileName);
    videoUrl = publicUrl;
  }

  // ★問題PDF処理
  if (questionFile && questionFile.size > 0) {
    const fileName = `question_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, questionFile);
    if (uploadError) throw new Error("問題PDFアップロード失敗: " + uploadError.message);
    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(fileName);
    questionPdfUrl = publicUrl;
  }

  // ★解答PDF処理
  if (answerFile && answerFile.size > 0) {
    const fileName = `answer_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, answerFile);
    if (uploadError) throw new Error("解答PDFアップロード失敗: " + uploadError.message);
    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(fileName);
    answerUrl = publicUrl;
  }

  const { error } = await supabase.from("units").insert({
    name,
    section_id: sectionId,
    type,
    sort_order: sortOrder,
    message,
    intro,
    outro,
    video_url: videoUrl,
    answer_url: answerUrl,
    question_pdf_url: questionPdfUrl, // ★追加
    max_score: type === "test" ? 100 : null,
  });

  if (error) {
    console.error(error);
    throw new Error("登録に失敗しました");
  }

  revalidatePath("/admin/units");
}

// 2. 更新処理
export async function updateUnit(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const sortOrder = parseInt(formData.get("sort_order") as string) || 10;
  const file = formData.get("file") as File; // 動画用
  const questionFile = formData.get("question_file") as File; // ★問題PDF
  const answerFile = formData.get("answer_file") as File; // ★解答PDF

  // ★3つのメッセージを取得
  const message = formData.get("message") as string;
  const intro = formData.get("intro") as string;
  const outro = formData.get("outro") as string;

  if (!id || !name) throw new Error("必須項目が足りません");

  const updates: any = {
    name,
    type,
    sort_order: sortOrder,
    message,
    intro,
    outro,
    max_score: type === "test" ? 100 : null,
  };

  // 動画ファイル処理
  if (file && file.size > 0) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(fileName, file);
    if (uploadError) throw new Error("動画更新失敗: " + uploadError.message);
    const { data: { publicUrl } } = supabase.storage.from("videos").getPublicUrl(fileName);
    updates.video_url = publicUrl;
  }

  // ★問題PDF処理
  if (questionFile && questionFile.size > 0) {
    const fileName = `question_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, questionFile);
    if (uploadError) throw new Error("問題PDF更新失敗: " + uploadError.message);
    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(fileName);
    updates.question_pdf_url = publicUrl;
  }

  // ★解答PDF処理
  if (answerFile && answerFile.size > 0) {
    const fileName = `answer_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, answerFile);
    if (uploadError) throw new Error("解答PDF更新失敗: " + uploadError.message);
    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(fileName);
    updates.answer_url = publicUrl;
  }

  const { error } = await supabase
    .from("units").update(updates).eq("id", id);

  if (error) throw new Error("更新に失敗しました: " + error.message);

  revalidatePath("/admin/units");
}

export async function deleteUnit(id: string) {
  const supabase = await createClient();
  await supabase.from("units").delete().eq("id", id);
  revalidatePath("/admin/units");
}