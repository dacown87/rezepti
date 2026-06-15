create table if not exists public.cookidoo_credentials (
  id bigserial primary key,
  scope_type text not null,
  user_id uuid null,
  household_id uuid null,
  email text not null,
  password text not null,
  created_by uuid not null,
  session_cookies text null,
  session_user_agent text null,
  session_expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cookidoo_credentials_scope_type_check
    check (scope_type in ('user', 'household')),
  constraint cookidoo_credentials_scope_shape_check
    check (
      (scope_type = 'user' and user_id is not null and household_id is null)
      or
      (scope_type = 'household' and user_id is null and household_id is not null)
    )
);

create unique index if not exists cookidoo_credentials_user_uidx
  on public.cookidoo_credentials (user_id)
  where scope_type = 'user';

create unique index if not exists cookidoo_credentials_household_uidx
  on public.cookidoo_credentials (household_id)
  where scope_type = 'household';

create index if not exists cookidoo_credentials_created_by_idx
  on public.cookidoo_credentials (created_by);
