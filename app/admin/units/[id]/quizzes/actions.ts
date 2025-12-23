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

export async function updateQuiz(
  quizId: string, 
  question: string, 
  choices: { id?: string; answer_text: string; is_correct: boolean; explanation: string }[]
) {
  const supabase = await createClient();

  // 1. 問題文の更新 (変更なし)
  const { error: quizError } = await supabase
    .from("quizzes")
    .update({ question })
    .eq("id", quizId);

  if (quizError) throw new Error("問題文の更新に失敗: " + quizError.message);

  // 2. 選択肢の削除処理 (変更なし)
  const { data: existingChoices } = await supabase
    .from("choices")
    .select("id")
    .eq("quiz_id", quizId);

  if (existingChoices) {
    const existingIds = existingChoices.map(c => c.id);
    const keepingIds = choices.filter(c => c.id).map(c => c.id as string);
    const idsToDelete = existingIds.filter(id => !keepingIds.includes(id));

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("choices")
        .delete()
        .in("id", idsToDelete);
      
      if (deleteError) throw new Error("選択肢の削除に失敗: " + deleteError.message);
    }
  }

  // ★修正: 「更新用」と「新規用」に配列を分ける
  // これにより、新規データに null な id が混入するのを防ぎます
  
  // A. 更新用データ (IDを持っているもの)
  const choicesToUpdate = choices
    .filter(c => c.id) // IDがあるものだけ
    .map(c => ({
      id: c.id, 
      quiz_id: quizId,
      answer_text: c.answer_text,
      is_correct: c.is_correct,
      explanation: c.explanation || ""
    }));

  // B. 新規作成用データ (IDを持っていないもの)
  const choicesToInsert = choices
    .filter(c => !c.id) // IDがないものだけ
    .map(c => ({
      // ここには絶対に id プロパティを含めない
      quiz_id: quizId,
      answer_text: c.answer_text,
      is_correct: c.is_correct,
      explanation: c.explanation || ""
    }));

  // 3. 実行

  // 更新実行 (upsert)
  if (choicesToUpdate.length > 0) {
    const { error: updateError } = await supabase
      .from("choices")
      .upsert(choicesToUpdate);
    
    if (updateError) throw new Error("選択肢の更新に失敗: " + updateError.message);
  }

  // 新規登録実行 (insert)
  if (choicesToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("choices")
      .insert(choicesToInsert);
    
    if (insertError) throw new Error("選択肢の追加に失敗: " + insertError.message);
  }

  revalidatePath("/admin/units");
}

// ★追加: クイズ単体の削除
export async function deleteQuiz(quizId: string) {
  const supabase = await createClient();

  // 1. 関連する回答履歴(quiz_attempts)を先に削除
  // (これをしないと、外部キー制約で削除がブロックされる可能性があります)
  
  // まず削除対象の選択肢IDリストを取得
  const { data: choices } = await supabase
    .from("choices")
    .select("id")
    .eq("quiz_id", quizId);

  if (choices && choices.length > 0) {
    const choiceIds = choices.map(c => c.id);
    // 履歴削除
    const { error: attemptError } = await supabase
      .from("quiz_attempts")
      .delete()
      .in("choice_id", choiceIds);
      
    if (attemptError) console.error("履歴削除エラー(無視可):", attemptError);
  }

  // 2. クイズ本体の削除
  // (choicesテーブルもCASCADE設定されていれば自動で消えますが、手動で消えるようにDB設定任せにします)
  const { error } = await supabase
    .from("quizzes")
    .delete()
    .eq("id", quizId);

  if (error) throw new Error("クイズ削除失敗: " + error.message);

  revalidatePath("/admin/units");
}