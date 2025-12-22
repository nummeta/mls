"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// インポートデータの型定義
type ImportData = {
  topic: string;
  quizzes: {
    question: string;
    choices: {
      answer_text: string;
      is_correct: boolean;
      explanation?: string;
    }[];
  }[];
}[];

// クイズデータの一括登録
export async function importQuizData(unitId: string, jsonString: string) {
  const supabase = await createClient();
  let data: ImportData;

  // JSONパースチェック
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    throw new Error("JSONの形式が正しくありません。カンマや括弧を確認してください。");
  }

  if (!Array.isArray(data)) throw new Error("データは配列（[...]）形式である必要があります。");

  // ループ処理で登録（データ量が多い場合はバッチ処理推奨ですが、今回は順次処理で実装）
  for (const qt of data) {
    // 1. QuizType (Topic) 作成
    const { data: typeData, error: typeError } = await supabase
      .from("quiz_types")
      .insert({ unit_id: unitId, topic: qt.topic })
      .select()
      .single();

    if (typeError) throw new Error(`トピック作成エラー: ${typeError.message}`);

    for (const q of qt.quizzes) {
      // 2. Quiz (Question) 作成
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .insert({ quiz_type_id: typeData.id, question: q.question })
        .select()
        .single();

      if (quizError) throw new Error(`問題作成エラー: ${quizError.message}`);

      // 3. Choices (Answers) 作成
      const choicesToInsert = q.choices.map((c) => ({
        quiz_id: quizData.id,
        answer_text: c.answer_text,
        is_correct: c.is_correct,
        explanation: c.explanation || "", // 解説がない場合は空文字
      }));

      const { error: choiceError } = await supabase
        .from("choices")
        .insert(choicesToInsert);

      if (choiceError) throw new Error(`選択肢作成エラー: ${choiceError.message}`);
    }
  }

  revalidatePath(`/admin/units/${unitId}/quizzes`);
}

// クイズタイプごとの削除
export async function deleteQuizType(id: string, unitId: string) {
  const supabase = await createClient();
  
  // カスケード削除がDB側で設定されていれば親(quiz_types)を消すだけで全部消えます
  const { error } = await supabase.from("quiz_types").delete().eq("id", id);
  
  if (error) throw new Error("削除失敗: " + error.message);
  revalidatePath(`/admin/units/${unitId}/quizzes`);
}