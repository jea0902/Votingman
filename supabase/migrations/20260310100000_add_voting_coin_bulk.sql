-- 정산 속도 최적화: N회 RPC 대신 1회 bulk 업데이트
-- p_items: [{"user_id": "uuid", "amount": 100.5}, ...]
-- 반환: 성공한 user_id 목록 (없는 유저는 업데이트 안 됨)

CREATE OR REPLACE FUNCTION public.add_voting_coin_bulk(p_items jsonb)
RETURNS TABLE(updated_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH items AS (
    SELECT
      (elem->>'user_id')::uuid AS user_id,
      ROUND(GREATEST(0, (elem->>'amount')::numeric), 2) AS amount
    FROM jsonb_array_elements(p_items) AS elem
    WHERE elem->>'user_id' IS NOT NULL AND (elem->>'amount')::numeric > 0
  ),
  updated AS (
    UPDATE users u
    SET voting_coin_balance = COALESCE(u.voting_coin_balance, 0) + i.amount
    FROM items i
    WHERE u.user_id = i.user_id
    RETURNING u.user_id
  )
  SELECT u.user_id FROM updated u;
END;
$$;

COMMENT ON FUNCTION public.add_voting_coin_bulk(jsonb) IS '정산용: 여러 유저에게 한 번에 VTC 지급. items: [{user_id, amount}, ...]';

-- auth.users에만 있고 public.users에 없는 유저 일괄 생성 (정산 전 선행)
CREATE OR REPLACE FUNCTION public.ensure_users_for_settlement_bulk(p_user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  WITH missing AS (
    SELECT id AS user_id FROM auth.users au
    WHERE au.id = ANY(p_user_ids)
      AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = au.id)
  ),
  inserted AS (
    INSERT INTO public.users (user_id, email, nickname, role, voting_coin_balance)
    SELECT
      m.user_id,
      COALESCE(au.email, ''),
      COALESCE(au.raw_user_meta_data->>'nickname', split_part(COALESCE(au.email, 'x@x'), '@', 1), 'user'),
      'user',
      0
    FROM missing m
    JOIN auth.users au ON au.id = m.user_id
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id
  )
  SELECT count(*)::integer INTO v_inserted FROM inserted;
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.ensure_users_for_settlement_bulk(uuid[]) IS '정산용: public.users에 없는 유저를 auth.users에서 일괄 생성';
