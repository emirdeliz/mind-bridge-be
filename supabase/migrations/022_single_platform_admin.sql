-- At most one platform admin (is_admin = true) at a time.

create unique index if not exists profiles_single_admin_uidx
  on public.profiles ((true))
  where is_admin = true;
