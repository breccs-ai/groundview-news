-- Append 'advertiser' to profiles.roles atomically without duplicates (matches array_append + NOT (... = ANY)).

create or replace function public.append_profile_advertiser_role(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set roles = array_append(coalesce(roles, '{}'::text[]), 'advertiser')
  where id = p_id
    and not ('advertiser'::text = any(coalesce(roles, '{}'::text[])));
end;
$$;

grant execute on function public.append_profile_advertiser_role(uuid) to service_role;
