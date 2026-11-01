-- Keep authenticated clients from calling this SECURITY DEFINER helper
-- directly and inserting forged audit records. Other SECURITY DEFINER RPCs
-- continue to call it under their owner's privileges.
revoke execute on function public.log_action(text,text,uuid,jsonb) from public, anon, authenticated;
