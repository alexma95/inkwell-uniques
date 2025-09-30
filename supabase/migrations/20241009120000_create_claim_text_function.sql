CREATE OR REPLACE FUNCTION public.claim_text(p_product_id UUID)
RETURNS public.texts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_text public.texts%ROWTYPE;
BEGIN
  SELECT *
  INTO claimed_text
  FROM public.texts
  WHERE product_id = p_product_id
    AND is_assigned = false
  ORDER BY random()
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_TEXTS_AVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.texts
  SET is_assigned = true
  WHERE id = claimed_text.id;

  claimed_text.is_assigned := true;

  RETURN claimed_text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_text(UUID) TO anon, authenticated;
