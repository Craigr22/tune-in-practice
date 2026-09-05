-- Let an admin decide the order of the video and backing-track libraries.
--
-- Both listed newest-first, which is the order things happened to be uploaded
-- rather than any order worth teaching in. Ordering is per library, so each
-- instrument's lessons and its backing tracks are ranked separately.

alter table public.course_videos
  add column if not exists sort_order integer not null default 0;

-- Seed from the existing newest-first listing, so nothing appears to move on
-- the first load, and every row starts with a distinct rank to swap against.
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
