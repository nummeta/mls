"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function createUnit(formData: FormData) {
  const supabase = await createClient();

  // フォームからデータを取り出す
  const name = formData.get("name") as string;
  const sectionId = formData.get("section_id") as string;
  const type = formData.get("type") as string; // 'lecture' or 'test'
  const file = formData.get("file") as File;   // アップロードされたファイル
  const sortOrder = parseInt(formData.get("sort_order") as string) || 10;
  const description = formData.get("description") as string;

  if (!name || !sectionId) throw new Error("必須項目が足りません");

  let videoUrl = null;
  let answerUrl = null;

  // ファイルがアップロードされている場合の処理
  if (file && file.size > 0) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`; // 重複しないファイル名を作る

    // PDFなら 'documents' バケットへ、それ以外（動画）なら 'videos' バケットへ
    const bucketName = file.type.includes("pdf") ? "documents" : "videos";
    
    // 1. Storageにアップロード
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file);

    if (uploadError) throw new Error("アップロード失敗: " + uploadError.message);

    // 2. 公開URLを取得
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    // 3. URLを変数に入れる
    if (bucketName === "videos") {
      videoUrl = publicUrl;
    } else {
      answerUrl = publicUrl; // テストの場合は模範解答PDFとして扱う
    }
  }

  // DBに登録
  const { error } = await supabase.from("units").insert({
    name,
    section_id: sectionId,
    type,
    sort_order: sortOrder,
    intro: description,
    video_url: videoUrl,   // 動画ならここにURLが入る
    answer_url: answerUrl, // PDFならここにURLが入る
    max_score: type === "test" ? 100 : null, // テストならとりあえず100点満点
  });

  if (error) {
    console.error(error);
    throw new Error("登録に失敗しました");
  }

  revalidatePath("/admin/units");
}

// 削除機能
export async function deleteUnit(id: string) {
  const supabase = await createClient();
  await supabase.from("units").delete().eq("id", id);
  revalidatePath("/admin/units");
}