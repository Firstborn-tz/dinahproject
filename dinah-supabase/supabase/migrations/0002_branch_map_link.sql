-- =============================================================================
-- 0002 — Branch map links + public branch listing
-- Run this AFTER 0001_init.sql, once, in Supabase -> SQL Editor.
-- Safe to re-run.
-- =============================================================================

-- 1. Every branch can carry a Google Maps link. Existing branches get an
--    empty value (shown as "Missing" in the admin UI until you edit them);
--    NEW branches must supply one (enforced inside create_branch below).
alter table public.branches add column if not exists map_url text not null default '';

-- 2. create_branch now REQUIRES a map link.
drop function if exists public.create_branch(text, text);
create or replace function public.create_branch(p_name text, p_address text default '', p_map_url text default '')
returns public.branches language plpgsql security definer set search_path = public as $$
declare v_branch public.branches;
begin
  if not public.is_manager() then raise exception 'Only a manager can create a branch.'; end if;
  if p_name is null or trim(p_name) = '' then raise exception 'Branch name is required.'; end if;
  if p_map_url is null or trim(p_map_url) = '' then
    raise exception 'A Google Maps link is required for every new branch.';
  end if;
  if p_map_url !~* '^https?://' then
    raise exception 'The map link must start with http:// or https://';
  end if;
  insert into public.branches (name, address, map_url)
    values (trim(p_name), coalesce(p_address, ''), trim(p_map_url)) returning * into v_branch;
  perform public.log_action('BRANCH_CREATE', 'branch', v_branch.id, jsonb_build_object('name', p_name));
  return v_branch;
end;
$$;

-- 3. update_branch can now edit the map link too.
drop function if exists public.update_branch(uuid, text, text, boolean);
create or replace function public.update_branch(p_branch_id uuid, p_name text, p_address text, p_map_url text, p_active boolean)
returns public.branches language plpgsql security definer set search_path = public as $$
declare v_branch public.branches;
begin
  if not public.is_manager() then raise exception 'Only a manager can update a branch.'; end if;
  if p_map_url is not null and trim(p_map_url) <> '' and p_map_url !~* '^https?://' then
    raise exception 'The map link must start with http:// or https://';
  end if;
  update public.branches set
    name = coalesce(nullif(trim(p_name), ''), name),
    address = coalesce(p_address, address),
    map_url = coalesce(nullif(trim(p_map_url), ''), map_url),
    active = coalesce(p_active, active)
  where id = p_branch_id returning * into v_branch;
  if not found then raise exception 'Branch not found.'; end if;
  perform public.log_action('BRANCH_UPDATE', 'branch', v_branch.id, '{}'::jsonb);
  return v_branch;
end;
$$;

-- 4. Public listing for the landing page (no login needed): only active branches.
create or replace view public.public_branches as
  select id, name, address, map_url from public.branches where active = true;
grant select on public.public_branches to anon, authenticated;

-- branches_view is "select *", so recreate it to pick up the new column.
create or replace view public.branches_view as
  select * from public.branches where public.is_manager() or id = public.app_branch_id();
grant select on public.branches_view to authenticated;

grant execute on function public.create_branch(text, text, text) to authenticated;
grant execute on function public.update_branch(uuid, text, text, text, boolean) to authenticated;
