"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 1. 作成処理
export async function createUnit(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const sectionId = formData.get("section_id") as string;
  const type = formData.get("type") as string;
  const file = formData.get("file") as File;
  const sortOrder = parseInt(formData.get("sort_order") as string) || 10;
  
  // ★3つのメッセージを取得
  const message = formData.get("message") as string;
  const intro = formData.get("intro") as string;
  const outro = formData.get("outro") as string;

  if (!name || !sectionId) throw new Error("必須項目が足りません");

  let videoUrl = null;
  let answerUrl = null;

  if (file && file.size > 0) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const bucketName = file.type.includes("pdf") ? "documents" : "videos";
    
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file);

    if (uploadError) throw new Error("アップロード失敗: " + uploadError.message);

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    if (bucketName === "videos") {
      videoUrl = publicUrl;
    } else {
      answerUrl = publicUrl;
    }
  }

  const { error } = await supabase.from("units").insert({
    name,
    section_id: sectionId,
    type,
    sort_order: sortOrder,
    message, // ★追加
    intro,   // ★追加
    outro,   // ★追加
    video_url: videoUrl,
    answer_url: answerUrl,
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
  const file = formData.get("file") as File;

  // ★3つのメッセージを取得
  const message = formData.get("message") as string;
  const intro = formData.get("intro") as string;
  const outro = formData.get("outro") as string;

  if (!id || !name) throw new Error("必須項目が足りません");

  const updates: any = {
    name,
    type,
    sort_order: sortOrder,
    message, // ★追加
    intro,   // ★追加
    outro,   // ★追加
    max_score: type === "test" ? 100 : null,
  };

  if (file && file.size > 0) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const bucketName = file.type.includes("pdf") ? "documents" : "videos";

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file);

    if (uploadError) throw new Error("ファイル更新失敗: " + uploadError.message);

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    if (bucketName === "videos") {
      updates.video_url = publicUrl;
      updates.answer_url = null;
    } else {
      updates.answer_url = publicUrl;
      updates.video_url = null;
    }
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