-- 정산 시 승자 VTC 지급을 원자적으로 수행 (select+update 대신 1회 update로 race/실패 최소화)
-- RPC: add_voting_coin(user_id, amount) → 해당 유저 잔액에 amount를 더함. 없으면 null 반환.

CREATE OR REPLACE FUNCTION public.add_voting_coin(p_user_id uuid, p_amount numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_add numeric := ROUND(GREATEST(0, p_amount)::numeric, 2);
BEGIN
  UPDATE users
  SET voting_coin_balance = COALESCE(voting_coin_balance, 0) + v_add
  WHERE user_id = p_user_id
  RETURNING user_id INTO v_user_id;
  RETURN v_user_id;
END;
$$;

COMMENT ON FUNCTION public.add_voting_coin(uuid, numeric) IS '정산용: 해당 user의 voting_coin_balance에 amount를 더함. user 없으면 null.';

-- 정산 시 users 행이 없을 때만 사용. auth.users에 있으면 최소 행 생성 후 재시도 가능하게 함.
CREATE OR REPLACE FUNCTION public.ensure_user_for_settlement(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE user_id = p_user_id) THEN
    RETURN true;
  END IF;
  INSERT INTO public.users (user_id, email, nickname, role, voting_coin_balance)
  SELECT
    au.id,
    COALESCE(au.email, ''),
    COALESCE(au.raw_user_meta_data->>'nickname', split_part(COALESCE(au.email, 'x@x'), '@', 1), 'user'),
    'user',
    0
  FROM auth.users au
  WHERE au.id = p_user_id
  LIMIT 1;
  RETURN FOUND;
EXCEPTION
  WHEN OTHERS THEN
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.ensure_user_for_settlement(uuid) IS '정산 복구용: auth.users에만 있고 public.users에 없으면 최소 행 생성. 성공 시 true.';
