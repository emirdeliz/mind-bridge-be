-- Persist phone from signup metadata when creating profile

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role public.user_role;
  user_phone text;
begin
  user_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'patient');
  user_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');

  insert into public.profiles (id, email, role, phone)
  values (new.id, new.email, user_role, user_phone);

  return new;
end;
$$;
