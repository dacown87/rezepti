-- Draft only: multi-user Supabase Data API readiness for Rezepti.
--
-- This file is a reviewable template, not a migration. Do not run it as-is
-- against production without checking the current data shape first.
--
-- Scope:
--   - public.recipes
--   - public.shopping_list
--   - public.meal_plan
--
-- Explicitly backend-only in this phase:
--   - public.api_keys
--   - public.ingredient_dictionary
--
-- Security rules reflected here:
--   - no user_metadata based authz
--   - no service_role in clients
--   - UPDATE needs a SELECT policy
--   - no security definer functions in exposed schemas

begin;

-- Hard deny by default for the exposed client tables, then open them narrowly.
revoke all on table public.recipes from anon, authenticated;
revoke all on table public.shopping_list from anon, authenticated;
revoke all on table public.meal_plan from anon, authenticated;

-- backend-only tables stay closed for the Data API
revoke all on table public.api_keys from anon, authenticated;
revoke all on table public.ingredient_dictionary from anon, authenticated;
alter table public.api_keys enable row level security;
alter table public.ingredient_dictionary enable row level security;

-- Client-facing tables: grant only the authenticated role.
grant select, insert, update, delete on table public.recipes to authenticated;
grant select, insert, update, delete on table public.shopping_list to authenticated;
grant select, insert, update, delete on table public.meal_plan to authenticated;

-- Identity sequences used by the Data API on inserts.
grant usage, select on sequence public.recipes_id_seq to authenticated;
grant usage, select on sequence public.shopping_list_id_seq to authenticated;
grant usage, select on sequence public.meal_plan_id_seq to authenticated;

-- RLS stays enabled on exposed tables.
alter table public.recipes enable row level security;
alter table public.shopping_list enable row level security;
alter table public.meal_plan enable row level security;

-- recipes: own rows are writable, global defaults remain read-only.
drop policy if exists recipes_select_authenticated on public.recipes;
drop policy if exists recipes_insert_authenticated on public.recipes;
drop policy if exists recipes_update_authenticated on public.recipes;
drop policy if exists recipes_delete_authenticated on public.recipes;

create policy recipes_select_authenticated
  on public.recipes
  for select
  to authenticated
  using (user_id = (select auth.uid()) or user_id is null);

create policy recipes_insert_authenticated
  on public.recipes
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy recipes_update_authenticated
  on public.recipes
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy recipes_delete_authenticated
  on public.recipes
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- shopping_list: only owner rows.
drop policy if exists shopping_list_select_authenticated on public.shopping_list;
drop policy if exists shopping_list_insert_authenticated on public.shopping_list;
drop policy if exists shopping_list_update_authenticated on public.shopping_list;
drop policy if exists shopping_list_delete_authenticated on public.shopping_list;

create policy shopping_list_select_authenticated
  on public.shopping_list
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy shopping_list_insert_authenticated
  on public.shopping_list
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy shopping_list_update_authenticated
  on public.shopping_list
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy shopping_list_delete_authenticated
  on public.shopping_list
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- meal_plan: only owner rows.
drop policy if exists meal_plan_select_authenticated on public.meal_plan;
drop policy if exists meal_plan_insert_authenticated on public.meal_plan;
drop policy if exists meal_plan_update_authenticated on public.meal_plan;
drop policy if exists meal_plan_delete_authenticated on public.meal_plan;

create policy meal_plan_select_authenticated
  on public.meal_plan
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy meal_plan_insert_authenticated
  on public.meal_plan
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy meal_plan_update_authenticated
  on public.meal_plan
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy meal_plan_delete_authenticated
  on public.meal_plan
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

commit;

-- Notes for the future migration:
--   - Backfill or normalize shopping_list.user_id and meal_plan.user_id first.
--   - Consider ALTER COLUMN ... SET NOT NULL for those two tables once the data is clean.
--   - Keep recipes.user_id nullable if global default rows stay part of the product model.
