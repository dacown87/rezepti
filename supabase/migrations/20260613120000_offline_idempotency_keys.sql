-- Offline mutation queue: dedupe retried planner POSTs via a client-generated op id.
-- Shopping list already dedupes via (household_id, recipe_id, canonical_name); no op-id there (K3).
ALTER TABLE public.meal_plan ADD COLUMN IF NOT EXISTS client_op_id uuid;

-- One row per (household, client_op_id). NULL op-ids are allowed and not deduped.
CREATE UNIQUE INDEX IF NOT EXISTS meal_plan_household_opid_uidx
  ON public.meal_plan (household_id, client_op_id)
  WHERE client_op_id IS NOT NULL;
