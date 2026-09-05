alter table public.course_videos
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by instrument, kind
      order by created_at desc, id
    ) as rn
  from public.course_videos
)
update public.course_videos cv
set sort_order = ranked.rn
from ranked
where cv.id = ranked.id
  and cv.sort_order = 0;

create index if not exists course_videos_sort_idx
  on public.course_videos (instrument, kind, sort_order);