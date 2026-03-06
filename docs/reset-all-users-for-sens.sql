-- =============================================
-- 네이버 클라우드 Sens 도입을 위한 전체 계정 초기화
-- =============================================
-- 🚨 주의: 실행 전 데이터 백업 필수!
-- 🚨 사업자 등록 완료 후에만 실행!

-- 1. 현재 상태 확인 (실행 전 백업용)
SELECT 
    COUNT(*) as "총_사용자수",
    COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as "활성_사용자",
    COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as "삭제된_사용자"
FROM users;

-- 2. 관련 데이터 확인
SELECT 
    'votes' as table_name, COUNT(*) as count FROM votes
UNION ALL
SELECT 
    'payout_history' as table_name, COUNT(*) as count FROM payout_history
UNION ALL
SELECT 
    'notifications' as table_name, COUNT(*) as count FROM notifications;

-- =============================================
-- 🚨 실제 삭제 명령어들 (주석 해제 후 실행)
-- =============================================

-- 3. 모든 사용자 관련 데이터 삭제 (역순으로 삭제)
-- DELETE FROM notifications;
-- DELETE FROM payout_history;  
-- DELETE FROM votes;
-- DELETE FROM users;

-- 4. 시퀀스/카운터 초기화 (필요시)
-- ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1;

-- 5. 삭제 후 확인
-- SELECT 
--     'users' as table_name, COUNT(*) as remaining FROM users
-- UNION ALL
-- SELECT 
--     'votes' as table_name, COUNT(*) as remaining FROM votes
-- UNION ALL
-- SELECT 
--     'payout_history' as table_name, COUNT(*) as remaining FROM payout_history
-- UNION ALL
-- SELECT 
--     'notifications' as table_name, COUNT(*) as remaining FROM notifications;

-- =============================================
-- 📝 실행 후 체크리스트:
-- =============================================
-- □ Sens API 연동 테스트
-- □ 새 회원가입 플로우 테스트  
-- □ 문자 인증 기능 테스트
-- □ 로그인/로그아웃 기능 테스트