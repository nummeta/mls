-- ============================================
-- 学習フロー制御 & 対話セッション データベースマイグレーション
-- 作成日: 2026-01-14
-- ============================================

-- ============================================
-- A. units テーブル拡張
-- ============================================
-- 「対話ポイント」フラグを追加（既存データはfalse）
ALTER TABLE units ADD COLUMN IF NOT EXISTS 
  is_dialogue_checkpoint BOOLEAN DEFAULT false;

COMMENT ON COLUMN units.is_dialogue_checkpoint IS '対話ポイント: trueの場合、講師との対話（スループット確認）を推奨する単元';

-- ============================================
-- B. student_progress（生徒進捗）
-- ============================================
-- 対話ポイントの単元のみレコード作成（対話債権管理）
CREATE TABLE IF NOT EXISTS student_progress (
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'in_progress')),
  dialogue_cleared BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (unit_id, student_id)
);

COMMENT ON TABLE student_progress IS '生徒の単元進捗（対話ポイントのみ記録）';
COMMENT ON COLUMN student_progress.dialogue_cleared IS '対話完了フラグ: falseの場合は「対話債権」として保留中';

-- ============================================
-- C. instructors（講師マスタ）
-- ============================================
CREATE TABLE IF NOT EXISTS instructors (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_room_name TEXT NOT NULL,
  status TEXT DEFAULT 'offline' CHECK (status IN ('idle', 'busy', 'offline')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE instructors IS '講師マスタ: Zoomブレイクアウトルーム割り当て管理';
COMMENT ON COLUMN instructors.assigned_room_name IS 'Zoom内で待機するブレイクアウトルーム名（例: "佐藤ルーム"）';
COMMENT ON COLUMN instructors.status IS 'idle=空き, busy=対応中, offline=オフライン';

-- ============================================
-- D. support_tickets（対話リクエストチケット）
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL,
  unit_ids JSONB NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'assigned', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE support_tickets IS '対話リクエストチケット: 生徒からの対話依頼を管理';
COMMENT ON COLUMN support_tickets.unit_ids IS '今回報告する対象の単元IDリスト（JSONB配列）';
COMMENT ON COLUMN support_tickets.instructor_id IS '担当講師（決まるまではnull）';

-- 評価メモカラムを追加（既存テーブルがあれば）
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS evaluation_note TEXT;
COMMENT ON COLUMN support_tickets.evaluation_note IS '講師による評価メモ（任意）';

-- ============================================
-- インデックス
-- ============================================
CREATE INDEX IF NOT EXISTS idx_student_progress_student_id 
  ON student_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_dialogue_cleared 
  ON student_progress(dialogue_cleared) WHERE dialogue_cleared = false;

CREATE INDEX IF NOT EXISTS idx_instructors_status 
  ON instructors(status);

CREATE INDEX IF NOT EXISTS idx_support_tickets_student_id 
  ON support_tickets(student_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status 
  ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_instructor_id 
  ON support_tickets(instructor_id);

-- ============================================
-- Row Level Security (RLS) ポリシー
-- ============================================

-- student_progress
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;

-- 生徒は自分の進捗のみ閲覧・作成可能
CREATE POLICY "Students can view own progress"
  ON student_progress FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own progress"
  ON student_progress FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own progress"
  ON student_progress FOR UPDATE
  USING (auth.uid() = student_id);

-- 講師・管理者は全進捗を閲覧可能
CREATE POLICY "Instructors can view all progress"
  ON student_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('tutor', 'admin')
    )
  );

-- instructors
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;

-- 講師は自分のステータスを更新可能
CREATE POLICY "Instructors can update own status"
  ON instructors FOR UPDATE
  USING (auth.uid() = id);

-- 全員が講師一覧を閲覧可能（ステータス確認のため）
CREATE POLICY "Anyone can view instructors"
  ON instructors FOR SELECT
  USING (true);

-- 管理者のみ講師を追加可能
CREATE POLICY "Admins can manage instructors"
  ON instructors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- support_tickets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- 生徒は自分のチケットのみ閲覧・作成可能
CREATE POLICY "Students can view own tickets"
  ON support_tickets FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can cancel own tickets"
  ON support_tickets FOR UPDATE
  USING (auth.uid() = student_id AND status = 'waiting');

-- 講師・管理者は全チケットを閲覧・更新可能
CREATE POLICY "Instructors can view all tickets"
  ON support_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('tutor', 'admin')
    )
  );

CREATE POLICY "Instructors can update tickets"
  ON support_tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('tutor', 'admin')
    )
  );

-- ============================================
-- Realtime有効化
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE student_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE instructors;
ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
