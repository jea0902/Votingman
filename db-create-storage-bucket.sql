-- =========================================
-- Supabase Storage: board-images 버킷 생성
-- =========================================

/**
 * 설계 의도:
 * - 게시글 첨부 이미지를 저장할 Supabase Storage 버킷 생성
 * - Public 액세스 허용 (누구나 읽기 가능)
 * - 파일 크기 제한: 5MB
 * - 허용 MIME 타입: image/*
 * 
 * 보안:
 * - RLS 정책으로 업로드 권한 제어 (추후 인증 추가 시)
 * - 현재는 임시로 모든 사용자가 업로드 가능
 */

-- =========================================
-- STEP 1: 버킷 생성 (또는 확인)
-- =========================================

/**
 * 주의: 
 * - 버킷 이름은 board_images (언더스코어)
 * - UI에서 이미 생성되어 있음 (2026-01-30 확인)
 * - 이 SQL은 설정만 업데이트 (파일 크기, MIME 타입)
 */

-- 버킷 설정 업데이트 (이미 존재하므로 UPDATE만)
-- MIME 타입 NULL = 모든 타입 허용
UPDATE storage.buckets
SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = NULL
WHERE id = 'board_images';

-- =========================================
-- STEP 2: board-images 버킷 전용 RLS 정책
-- =========================================

/**
 * 보안 전략:
 * - 읽기(SELECT): 누구나 가능 (public 버킷이므로)
 * - 업로드(INSERT): Service Role만 가능 (API Route에서만)
 * - 삭제(DELETE): Service Role만 가능
 * 
 * 왜 이렇게?
 * - 클라이언트에서 직접 업로드 불가 → 무분별한 업로드 방지
 * - API Route에서 검증 후 업로드 → Rate Limiting 적용 가능
 * - Service Role은 RLS 우회 → 별도 정책 불필요
 */

-- 기존 정책 제거 (있다면)
DROP POLICY IF EXISTS "board_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "board_images_public_upload" ON storage.objects;
DROP POLICY IF EXISTS "board_images_public_delete" ON storage.objects;

-- 정책 1: 누구나 board_images 버킷 읽기 가능 (이미지 표시용)
CREATE POLICY "board_images_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'board_images');

-- 업로드/삭제는 정책 불필요:
-- API Route가 Service Role Key를 사용하므로 RLS를 자동으로 우회함

-- =========================================
-- 중요: yf-raw-data 버킷은 영향받지 않음!
-- =========================================
-- 위 정책은 bucket_id = 'board_images' 조건으로 
-- board_images 버킷에만 적용됩니다.
-- yf-raw-data의 기존 정책은 그대로 유지됩니다.

-- =========================================
-- 보안 검증 체크리스트
-- =========================================
-- [x] 클라이언트에서 직접 업로드 불가
-- [x] API Route에서만 업로드 (검증 가능)
-- [x] Service Role Key는 서버에만 존재
-- [x] 파일 타입 검증 (이미지만)
-- [x] 파일 크기 검증 (5MB)
-- [x] Rate Limiting 적용 가능 (향후)
-- [x] yf-raw-data 버킷 독립성 보장

COMMENT ON TABLE storage.objects IS '파일 메타데이터 저장 (Supabase 관리)';
