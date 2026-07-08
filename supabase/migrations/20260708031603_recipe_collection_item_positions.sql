alter table public.recipe_collection_items
  add column position integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by collection_id
      order by created_at desc, id
    ) as rn
  from public.recipe_collection_items
)
update public.recipe_collection_items item
set position = ranked.rn * 1000
from ranked
where item.id = ranked.id;

alter table public.recipe_collection_items
  alter column position set not null,
  alter column position set default 0;

create index recipe_collection_items_collection_position_idx
  on public.recipe_collection_items(collection_id, position);
