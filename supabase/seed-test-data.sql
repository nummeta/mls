-- ============================================
-- モチサポ機能テスト用 ダミーデータ
-- 実行前に YOUR_USER_ID を実際のユーザーIDに置き換えてください
-- ============================================

-- 1. テスト用ユーザーIDを取得するクエリ（まずこれを実行してIDを確認）
-- SELECT id, email FROM auth.users LIMIT 5;

-- ============================================
-- 以下、YOUR_USER_ID を実際のIDに置き換えてから実行
-- ============================================

-- 2. 今日の学習セッションを作成（現在時刻を含む時間帯）
INSERT INTO study_sessions (student_id, scheduled_start_at, scheduled_end_at, status)
VALUES 
  -- アクティブなセッション（テスト用ユーザー）
  ('YOUR_USER_ID'::uuid, 
   NOW() - INTERVAL '30 minutes',  -- 30分前から
   NOW() + INTERVAL '2 hours',     -- 2時間後まで
   'reserved'  -- reservedにしておくとZoomCockpitでactiveに変わる
  );

-- 3. 学習計画のサンプル（オプション：すでに計画がある状態をテストする場合）
-- セッションIDを取得してから実行
/*
INSERT INTO study_plans (session_id, order_index, subject, content, planned_minutes, status)
SELECT 
  id as session_id,
  0 as order_index,
  '数学' as subject,
  'チャート式 p10-15' as content,
  30 as planned_minutes,
  'pending' as status
FROM study_sessions 
WHERE student_id = 'YOUR_USER_ID'::uuid
AND status IN ('reserved', 'active')
LIMIT 1;
*/

-- ============================================
-- 複数の生徒をシミュレートする場合（講師画面テスト用）
-- 既存の複数ユーザーがいる場合に使用
-- ============================================

/*
-- 全生徒にダミーセッションを作成
INSERT INTO study_sessions (student_id, scheduled_start_at, scheduled_end_at, status)
SELECT 
  id as student_id,
  NOW() - INTERVAL '30 minutes',
  NOW() + INTERVAL '2 hours',
  'active'
FROM profiles 
WHERE role = 'student'
LIMIT 5;

-- 各セッションにダミープランを追加
INSERT INTO study_plans (session_id, order_index, subject, content, planned_minutes, status, started_at)
SELECT 
  ss.id as session_id,
  0 as order_index,
  (ARRAY['数学', '英語', '国語', '理科', '社会'])[floor(random() * 5 + 1)] as subject,
  'テスト学習内容' as content,
  30 as planned_minutes,
  'in_progress' as status,
  NOW() - INTERVAL '10 minutes' as started_at
FROM study_sessions ss
WHERE ss.status = 'active';
*/

-- ============================================
-- データ確認クエリ
-- ============================================

-- セッション一覧
-- SELECT * FROM study_sessions ORDER BY created_at DESC;

-- プラン一覧
-- SELECT sp.*, ss.status as session_status 
-- FROM study_plans sp 
-- JOIN study_sessions ss ON sp.session_id = ss.id
-- ORDER BY sp.created_at DESC;

-- ============================================
-- データ削除（リセット用）
-- ============================================

-- DELETE FROM study_plans;
-- DELETE FROM observation_logs;
-- DELETE FROM study_sessions;
