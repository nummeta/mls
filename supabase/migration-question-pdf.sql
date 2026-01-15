-- ============================================
-- 問題PDF URLカラム追加
-- ============================================
ALTER TABLE units ADD COLUMN IF NOT EXISTS question_pdf_url TEXT;
COMMENT ON COLUMN units.question_pdf_url IS 'テスト単元用の問題PDF URL（印刷用）';
