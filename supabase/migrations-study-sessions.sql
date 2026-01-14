-- ============================================
-- モチサポ機能拡張 データベースマイグレーション
-- 作成日: 2026-01-05
-- ============================================

-- 1. 学習セッション（予約データに基づく親データ）
-- 外部の予約システムと連携し、「誰が・いつ」学習するかを管理
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) NOT NULL,
  scheduled_start_at TIMESTAMPTZ NOT NULL,
  scheduled_end_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved', 'active', 'completed', 'absent')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 学習計画（生徒が登録するタスク）
-- 1つのセッション内で複数のタスクを行う
CREATE TABLE IF NOT EXISTS study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES study_sessions(id) ON DELETE CASCADE NOT NULL,
  order_index INT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  planned_minutes INT NOT NULL,
  actual_minutes INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'paused', 'completed')),
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  accumulated_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 観察ログ（講師が記入するメモ）
CREATE TABLE IF NOT EXISTS observation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES study_sessions(id) ON DELETE CASCADE NOT NULL,
  instructor_id UUID REFERENCES auth.users(id) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- インデックス
-- ============================================
CREATE INDEX IF NOT EXISTS idx_study_sessions_student_id ON study_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_status ON study_sessions(status);
CREATE INDEX IF NOT EXISTS idx_study_sessions_scheduled ON study_sessions(scheduled_start_at, scheduled_end_at);
CREATE INDEX IF NOT EXISTS idx_study_plans_session_id ON study_plans(session_id);
CREATE INDEX IF NOT EXISTS idx_observation_logs_session_id ON observation_logs(session_id);

-- ============================================
-- Row Level Security (RLS) ポリシー
-- ============================================

-- study_sessions
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- 生徒は自分のセッションのみ閲覧・更新可能
CREATE POLICY "Students can view own sessions"
  ON study_sessions FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can update own sessions"
  ON study_sessions FOR UPDATE
  USING (auth.uid() = student_id);

-- 講師は全セッションを閲覧可能
CREATE POLICY "Instructors can view all sessions"
  ON study_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('tutor', 'admin')
    )
  );

-- study_plans
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

-- 生徒は自分のセッションに紐づく計画のみ操作可能
CREATE POLICY "Students can manage own plans"
  ON study_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM study_sessions
      WHERE study_sessions.id = study_plans.session_id
      AND study_sessions.student_id = auth.uid()
    )
  );

-- 講師は全計画を閲覧可能
CREATE POLICY "Instructors can view all plans"
  ON study_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('tutor', 'admin')
    )
  );

-- observation_logs
ALTER TABLE observation_logs ENABLE ROW LEVEL SECURITY;

-- 講師は自分のログを作成・閲覧可能
CREATE POLICY "Instructors can create logs"
  ON observation_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('tutor', 'admin')
    )
  );

CREATE POLICY "Instructors can view all logs"
  ON observation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('tutor', 'admin')
    )
  );

-- 生徒は自分セッションのログのみ閲覧可能
CREATE POLICY "Students can view own session logs"
  ON observation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM study_sessions
      WHERE study_sessions.id = observation_logs.session_id
      AND study_sessions.student_id = auth.uid()
    )
  );

-- ============================================
-- Realtime有効化
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE study_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE study_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE observation_logs;
