"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 章の追加
export async function createSection(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const sortOrder = parseInt(formData.get("sort_order") as string) || 10;
  const subjectId = formData.get("subject_id") as string;

  if (!name || !subjectId) return;

  const { error } = await supabase
    .from("sections")
    .insert({
      name, // ※もしDBが title ならここを title に変えてください
      sort_order: sortOrder,
      subject_id: subjectId,
    });

  if (error) throw new Error("章の作成に失敗しました: " + error.message);

  revalidatePath(`/admin/subjects/${subjectId}`);
}

// 章の削除
export async function deleteSection(id: string, subjectId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("sections")
    .delete()
    .eq("id", id);

  if (error) throw new Error("章の削除に失敗しました");

  revalidatePath(`/admin/subjects/${subjectId}`);
}

// 3. 章の更新
export async function updateSection(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const sortOrder = parseInt(formData.get("sort_order") as string) || 0;
  const subjectId = formData.get("subject_id") as string; // リダイレクト用に必要

  if (!id || !name) return;

  const { error } = await supabase
    .from("sections")
    .update({
      name,
      sort_order: sortOrder,
    })
    .eq("id", id);

  if (error) {
    throw new Error("章の更新に失敗しました: " + error.message);
  }

  revalidatePath(`/admin/subjects/${subjectId}`);
}