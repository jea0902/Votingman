-- =============================================
-- 010: btc_ohlc created_at, updated_at을 KST로 저장
--
-- 목적: 데이터 확인 시 KST로 보이도록. candle_start_at은 UTC 유지.
-- - created_at, updated_at: TIMESTAMP WITHOUT TIME ZONE, 값은 KST 시각
-- - 기존 데이터: UTC → KST로 변환하여 저장
-- =============================================

-- 1. btc_ohlc 전용 updated_at 트리거 함수 (KST로 설정)
CREATE OR REPLACE FUNCTION public.btc_ohlc_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := (now() AT TIME ZONE 'Asia/Seoul');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 기존 트리거 제거
DROP TRIGGER IF EXISTS btc_ohlc_updated_at ON public.btc_ohlc;

-- 3. created_at: 타입 변경 + 기존 값(UTC) → KST 시각으로 변환 + 기본값 KST
ALTER TABLE public.btc_ohlc
    ALTER COLUMN created_at TYPE timestamp without time zone
    USING (created_at AT TIME ZONE 'Asia/Seoul');

ALTER TABLE public.btc_ohlc
    ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'Asia/Seoul');

-- 4. updated_at: 타입 변경 + 기존 값(UTC) → KST 시각으로 변환 + 기본값 KST
ALTER TABLE public.btc_ohlc
    ALTER COLUMN updated_at TYPE timestamp without time zone
    USING (updated_at AT TIME ZONE 'Asia/Seoul');

ALTER TABLE public.btc_ohlc
    ALTER COLUMN updated_at SET DEFAULT (now() AT TIME ZONE 'Asia/Seoul');

-- 5. 새 트리거 부착 (UPDATE 시 updated_at을 KST로 갱신)
CREATE TRIGGER btc_ohlc_updated_at
    BEFORE UPDATE ON public.btc_ohlc
    FOR EACH ROW
    EXECUTE PROCEDURE public.btc_ohlc_set_updated_at();

-- 6. 코멘트
COMMENT ON COLUMN public.btc_ohlc.created_at IS '레코드 생성 시각 (KST, timestamp without time zone)';
COMMENT ON COLUMN public.btc_ohlc.updated_at IS '레코드 수정 시각 (KST, timestamp without time zone)';

-- =============================================
-- 실행 후 확인 (선택)
-- =============================================
-- SELECT id, market, candle_start_at, created_at, updated_at FROM public.btc_ohlc ORDER BY updated_at DESC LIMIT 5;
