-- =============================================
-- 네이티브 캔들 성공 검증
-- =============================================

-- 1. 최신 수집된 데이터 확인 (방금 curl로 수집한 데이터)
SELECT 
    market,
    candle_start_at as "UTC시간",
    candle_start_at_kst as "KST시간",
    open,
    close,
    created_at as "수집시각",
    updated_at as "업데이트시각"
FROM btc_ohlc 
WHERE updated_at > NOW() - INTERVAL '10 minutes'  -- 최근 10분 내 업데이트
ORDER BY market, candle_start_at DESC;

-- 2. 연속성 검증 (최신 데이터 포함)
WITH latest_consistency AS (
    SELECT 
        market,
        candle_start_at,
        candle_start_at_kst,
        open,
        close,
        LAG(close) OVER (PARTITION BY market ORDER BY candle_start_at) as prev_close,
        updated_at
    FROM btc_ohlc 
    WHERE market IN ('btc_15m', 'btc_1h', 'btc_4h')
    ORDER BY market, candle_start_at DESC
    LIMIT 30  -- 각 마켓별로 최근 10개 정도
)
SELECT 
    market,
    candle_start_at_kst as "KST시간",
    prev_close as "이전봉_종가",
    open as "현재봉_시가",
    ABS(COALESCE(prev_close, 0) - open) as "차이",
    CASE 
        WHEN prev_close IS NULL THEN '🔸 첫번째캔들'
        WHEN ABS(prev_close - open) = 0 THEN '✅ 완벽일치' 
        WHEN ABS(prev_close - open) < 0.01 THEN '🟢 거의일치'
        WHEN ABS(prev_close - open) < 0.1 THEN '🟡 미세차이'
        ELSE '🔴 큰차이'
    END as "연속성상태",
    CASE 
        WHEN updated_at > NOW() - INTERVAL '10 minutes' THEN '🆕 방금수집'
        ELSE '기존데이터'
    END as "데이터타입"
FROM latest_consistency
ORDER BY market, candle_start_at DESC;

-- 3. 4시간봉 특별 확인 (11:00 같은 비정상 시간이 사라졌는지)
SELECT 
    market,
    candle_start_at,
    EXTRACT(HOUR FROM candle_start_at) as utc_hour,
    open,
    close,
    CASE 
        WHEN updated_at > NOW() - INTERVAL '10 minutes' THEN '🆕 신규'
        ELSE '기존'
    END as "타입"
FROM btc_ohlc 
WHERE market = 'btc_4h'
ORDER BY candle_start_at DESC 
LIMIT 10;

-- 4. 현재 크론 상태 업데이트
SELECT 
    market as "시장",
    MAX(candle_start_at_kst) as "최신_캔들_KST",
    NOW() AT TIME ZONE 'Asia/Seoul' as "현재_KST",
    CASE 
        WHEN market = 'btc_15m' THEN 
            FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(candle_start_at))) / 900)
        WHEN market = 'btc_1h' THEN 
            FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(candle_start_at))) / 3600)
        WHEN market = 'btc_4h' THEN 
            FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(candle_start_at))) / 14400)
        ELSE 0
    END as "누락캔들수",
    CASE 
        WHEN market = 'btc_15m' AND 
             FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(candle_start_at))) / 900) = 0 THEN '✅ 최신상태'
        WHEN market = 'btc_1h' AND 
             FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(candle_start_at))) / 3600) = 0 THEN '✅ 최신상태'
        WHEN market = 'btc_4h' AND 
             FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(candle_start_at))) / 14400) = 0 THEN '✅ 최신상태'
        ELSE '🟡 약간지연'
    END as "상태"
FROM btc_ohlc 
WHERE market IN ('btc_15m', 'btc_1h', 'btc_4h')
GROUP BY market
ORDER BY market;