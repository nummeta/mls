"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 1. 科目の追加
export async function createSubject(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const sortOrder = parseInt(formData.get("sort_order") as string) || 0;

  if (!name) return;

  const { error } = await supabase
    .from("subjects")
    .insert({
      name,
      sort_order: sortOrder
    });

  if (error) {
    console.error("Error creating subject:", error);
    throw new Error("科目の作成に失敗しました");
  }

  // 画面を更新
  revalidatePath("/admin/subjects");
}

// 2. 科目の削除
export async function deleteSubject(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting subject:", error);
    throw new Error("科目の削除に失敗しました");
  }

  revalidatePath("/admin/subjects");
}

// 2. 科目の更新
export async function updateSubject(formData: FormData) {
    const supabase = await createClient();
  
    const id = formData.get("id") as string; // 更新するID
    const name = formData.get("name") as string;
    const sortOrder = parseInt(formData.get("sort_order") as string) || 0;
  
    if (!id || !name) return;
  
    const { error } = await supabase
      .from("subjects")
      .update({
        name,
        sort_order: sortOrder,
      })
      .eq("id", id);
  
    if (error) {
      console.error("Error updating subject:", error);
      throw new Error("科目の更新に失敗しました");
    }
  
    revalidatePath("/admin/subjects");
  }