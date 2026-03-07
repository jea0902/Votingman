-- =============================================
-- 누적 승률·전적 DB 기반 검증
-- =============================================
-- 1) payout_history 기준 승/패/무효 판정
--    - payout_amount > 0 && != bet_amount → 승
--    - payout_amount = 0 → 패
--    - payout_amount = bet_amount → 무효
-- 2) user_stats vs 실제 계산 비교
-- 3) vote-history 누적 승률 검증
-- =============================================

-- 사용할 user_id (실제 값으로 교체)
-- SET @user_id = 'your-user-id-here';

-- 1) 특정 유저의 payout_history 기반 승/패/무효 집계
WITH user_payouts AS (
  SELECT
    ph.poll_id,
    ph.user_id,
    ph.bet_amount,
    ph.payout_amount,
    CASE
      WHEN ph.payout_amount = 0 THEN 'loss'
      WHEN ph.payout_amount = ph.bet_amount THEN 'invalid'
      WHEN ph.payout_amount > 0 THEN 'win'
      ELSE 'unknown'
    END AS result
  FROM payout_history ph
  WHERE ph.user_id = '여기에_user_id_입력'  -- 실제 user_id로 교체
)
SELECT
  result,
  COUNT(*) AS cnt,
  SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) AS losses,
  SUM(CASE WHEN result IN ('win', 'loss') THEN 1 ELSE 0 END) AS total_counted
FROM user_payouts
GROUP BY result;

-- 2) user_stats와 비교 (market='all')
-- SELECT
--   us.user_id,
--   us.win_count AS user_stats_wins,
--   us.participation_count AS user_stats_total,
--   ROUND(us.win_count::numeric / NULLIF(us.participation_count, 0) * 100, 1) AS user_stats_win_rate_pct
-- FROM user_stats us
-- WHERE us.user_id = '여기에_user_id_입력' AND us.market = 'all';

-- 3) payout_history 기반 실제 계산 (승/패만, 무효 제외)
WITH actual AS (
  SELECT
    ph.user_id,
    COUNT(*) FILTER (WHERE ph.payout_amount > 0 AND ph.payout_amount != ph.bet_amount) AS wins,
    COUNT(*) FILTER (WHERE ph.payout_amount = 0) AS losses,
    COUNT(*) FILTER (WHERE ph.payout_amount > 0 AND ph.payout_amount != ph.bet_amount) +
    COUNT(*) FILTER (WHERE ph.payout_amount = 0) AS total_counted
  FROM payout_history ph
  JOIN sentiment_votes v ON v.poll_id = ph.poll_id AND v.user_id = ph.user_id AND v.bet_amount > 0
  JOIN sentiment_polls p ON p.id = ph.poll_id AND p.settled_at IS NOT NULL
  WHERE ph.user_id = '여기에_user_id_입력'
  GROUP BY ph.user_id
)
SELECT
  a.user_id,
  a.wins,
  a.losses,
  a.total_counted,
  ROUND(a.wins::numeric / NULLIF(a.total_counted, 0) * 100, 1) AS actual_win_rate_pct
FROM actual a;

-- 4) user_stats vs 실제 (한 번에 비교)
-- user_id를 위와 동일하게 교체 후 실행
WITH actual AS (
  SELECT
    ph.user_id,
    COUNT(*) FILTER (WHERE ph.payout_amount > 0 AND ph.payout_amount != ph.bet_amount) AS wins,
    COUNT(*) AS participation
  FROM payout_history ph
  JOIN sentiment_votes v ON v.poll_id = ph.poll_id AND v.user_id = ph.user_id AND v.bet_amount > 0
  JOIN sentiment_polls p ON p.id = ph.poll_id AND p.settled_at IS NOT NULL
  WHERE ph.user_id = '여기에_user_id_입력'
  GROUP BY ph.user_id
)
SELECT
  a.user_id,
  us.win_count AS user_stats_wins,
  us.participation_count AS user_stats_total,
  a.wins AS actual_wins,
  a.participation AS actual_participation,
  CASE
    WHEN us.win_count IS DISTINCT FROM a.wins OR us.participation_count IS DISTINCT FROM a.participation
    THEN '⚠️ 불일치 (POST /api/rank/refresh 호출로 user_stats 갱신)'
    ELSE 'OK'
  END AS match
FROM actual a
LEFT JOIN user_stats us ON us.user_id = a.user_id AND us.market = 'all';
