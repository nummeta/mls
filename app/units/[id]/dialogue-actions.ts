"use server";

import { createClient } from "@/utils/supabase/server";

// ===========================================
// 型定義
// ===========================================

export type DialogueAction = 'prompt_dialogue' | 'proceed_next';

export interface UnitCompletionResult {
    action: DialogueAction;
    pendingUnitIds: string[];  // 対話債権のある単元ID
    pendingUnitNames: string[]; // 対話債権のある単元名
}

export interface TicketCreateResult {
    ticketId: string;
    status: 'waiting';
}

export interface TicketAssignResult {
    success: boolean;
    roomName?: string;
}

// ===========================================
// 1. 単元完了時のフロー制御
// ===========================================

/**
 * 単元完了時に呼び出される。対話フローを制御する。
 * 
 * ロジック:
 * 1. 対話ポイントの単元の場合、student_progressに記録
 * 2. 対話債権（dialogue_cleared: false）をチェック
 * 3. 講師の空き状況を確認
 * 4. 結果に応じて 'prompt_dialogue' または 'proceed_next' を返す
 */
export async function handleUnitCompletion(
    unitId: string
): Promise<UnitCompletionResult> {
    const supabase = await createClient();

    // ユーザー認証
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("ログインしてください");

    // 1. 単元情報を取得
    const { data: unit } = await supabase
        .from("units")
        .select("id, name, is_dialogue_checkpoint")
        .eq("id", unitId)
        .single();

    if (!unit) throw new Error("単元が見つかりません");

    // 2. 対話ポイントの場合のみ student_progress に記録
    if (unit.is_dialogue_checkpoint) {
        await supabase.from("student_progress").upsert({
            unit_id: unitId,
            student_id: user.id,
            status: 'completed',
            dialogue_cleared: false,
            completed_at: new Date().toISOString(),
        }, { onConflict: "unit_id, student_id" });
    }

    // 3. 対話債権をチェック（dialogue_cleared: false の対話ポイント単元）
    const { data: pendingProgress } = await supabase
        .from("student_progress")
        .select(`
      unit_id,
      units!inner (
        id,
        name,
        is_dialogue_checkpoint
      )
    `)
        .eq("student_id", user.id)
        .eq("dialogue_cleared", false);

    // 対話ポイントのみフィルタ
    const pendingDialogues = (pendingProgress || []).filter(
        (p: any) => p.units?.is_dialogue_checkpoint === true
    );

    // 債権がなければそのまま次へ
    if (pendingDialogues.length === 0) {
        return {
            action: 'proceed_next',
            pendingUnitIds: [],
            pendingUnitNames: [],
        };
    }

    // 4. オポチュニティ判定（講師の空き状況確認）
    const { data: idleInstructors } = await supabase
        .from("instructors")
        .select("id")
        .eq("status", "idle");

    const { data: waitingTickets } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("status", "waiting");

    const idleCount = idleInstructors?.length || 0;
    const waitingCount = waitingTickets?.length || 0;

    // 判定: 講師に余裕があれば対話を促す
    // ルール: 空き講師がいて、待ちチケット数より多い
    const hasOpportunity = idleCount > waitingCount;

    const pendingUnitIds = pendingDialogues.map((p: any) => p.unit_id);
    const pendingUnitNames = pendingDialogues.map((p: any) => p.units?.name || "");

    if (hasOpportunity) {
        return {
            action: 'prompt_dialogue',
            pendingUnitIds,
            pendingUnitNames,
        };
    } else {
        // サイレントスキップ: 対話債権を残したまま次へ
        return {
            action: 'proceed_next',
            pendingUnitIds,
            pendingUnitNames,
        };
    }
}

// ===========================================
// 2. チケット作成
// ===========================================

/**
 * 生徒が「挑戦する」を選択した時に呼び出される。
 * 対話リクエストチケットを作成する。
 */
export async function createSupportTicket(
    unitIds: string[]
): Promise<TicketCreateResult> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("ログインしてください");

    // 既存の待機中チケットがあればエラー
    const { data: existingTicket } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("student_id", user.id)
        .eq("status", "waiting")
        .single();

    if (existingTicket) {
        throw new Error("既に待機中のチケットがあります");
    }

    // チケット作成
    const { data, error } = await supabase
        .from("support_tickets")
        .insert({
            student_id: user.id,
            unit_ids: unitIds,
            status: 'waiting',
        })
        .select("id")
        .single();

    if (error || !data) throw new Error("チケット作成に失敗しました");

    return {
        ticketId: data.id,
        status: 'waiting',
    };
}

// ===========================================
// 3. チケットマッチング（講師による挙手）
// ===========================================

/**
 * 講師が「対応する」を押した時に呼び出される。
 */
export async function claimTicket(
    ticketId: string
): Promise<TicketAssignResult> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("ログインしてください");

    // 講師情報を取得
    const { data: instructor } = await supabase
        .from("instructors")
        .select("id, assigned_room_name, status")
        .eq("id", user.id)
        .single();

    if (!instructor) throw new Error("講師として登録されていません");
    if (instructor.status !== 'idle') throw new Error("現在対応可能な状態ではありません");

    // チケットが待機中か確認
    const { data: ticket } = await supabase
        .from("support_tickets")
        .select("id, status")
        .eq("id", ticketId)
        .single();

    if (!ticket) throw new Error("チケットが見つかりません");
    if (ticket.status !== 'waiting') throw new Error("このチケットは既に対応中です");

    // トランザクション的に更新
    // 1. チケットを assigned に
    const { error: ticketError } = await supabase
        .from("support_tickets")
        .update({
            instructor_id: user.id,
            status: 'assigned',
            assigned_at: new Date().toISOString(),
        })
        .eq("id", ticketId)
        .eq("status", "waiting"); // 楽観的ロック

    if (ticketError) throw new Error("チケットの更新に失敗しました");

    // 2. 講師ステータスを busy に
    await supabase
        .from("instructors")
        .update({
            status: 'busy',
            updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

    return {
        success: true,
        roomName: instructor.assigned_room_name,
    };
}

// ===========================================
// 4. 対話完了処理
// ===========================================

/**
 * 講師が評価フォームを送信して「完了」した時に呼び出される。
 */
export async function completeTicket(
    ticketId: string
): Promise<{ success: boolean }> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("ログインしてください");

    // チケット情報を取得
    const { data: ticket } = await supabase
        .from("support_tickets")
        .select("id, student_id, unit_ids, status, instructor_id")
        .eq("id", ticketId)
        .single();

    if (!ticket) throw new Error("チケットが見つかりません");
    if (ticket.status !== 'assigned') throw new Error("このチケットは対応中ではありません");
    if (ticket.instructor_id !== user.id) throw new Error("このチケットの担当ではありません");

    // 1. 対話債権を解消（dialogue_cleared = true）
    const unitIds = ticket.unit_ids as string[];
    for (const unitId of unitIds) {
        await supabase
            .from("student_progress")
            .update({ dialogue_cleared: true })
            .eq("unit_id", unitId)
            .eq("student_id", ticket.student_id);
    }

    // 2. チケットを completed に
    await supabase
        .from("support_tickets")
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
        })
        .eq("id", ticketId);

    // 3. 講師ステータスを idle に戻す
    await supabase
        .from("instructors")
        .update({
            status: 'idle',
            updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

    return { success: true };
}

// ===========================================
// 5. チケットキャンセル
// ===========================================

/**
 * 生徒がチケットをキャンセルする
 */
export async function cancelTicket(
    ticketId: string
): Promise<{ success: boolean }> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("ログインしてください");

    const { error } = await supabase
        .from("support_tickets")
        .update({ status: 'cancelled' })
        .eq("id", ticketId)
        .eq("student_id", user.id)
        .eq("status", "waiting");

    if (error) throw new Error("キャンセルに失敗しました");

    return { success: true };
}

// ===========================================
// 6. 生徒の現在のチケット取得
// ===========================================

export async function getMyActiveTicket() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
        .from("support_tickets")
        .select(`
      id,
      status,
      created_at,
      assigned_at,
      instructor_id,
      instructors (
        assigned_room_name
      )
    `)
        .eq("student_id", user.id)
        .in("status", ['waiting', 'assigned'])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    return data;
}
