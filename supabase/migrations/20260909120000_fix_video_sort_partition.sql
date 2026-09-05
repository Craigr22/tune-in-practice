-- Rank each library the way the screen groups it.
--
-- The first pass partitioned by kind, giving lessons 1..n and exercises their
-- own 1..n. But Course work shows two libraries, not three: Videos (lessons
-- and drills together) and Backing tracks. So twenty rows in the Videos tab
-- shared eleven ranks, the order was arbitrary between them, and moving a row
-- swapped two identical numbers and appeared to do nothing.
--
-- Re-rank by the split the UI actually uses, keeping the current arrangement
-- as far as the old ranks describe it.

with ranked as (
  select
    id,
    row_number() over (
      partition by instrument, (kind = 'track')
      order by sort_order, created_at desc, id
    ) as rn
  from public.course_videos
)
update public.course_videos cv
set sort_order = ranked.rn
from ranked
where cv.id = ranked.id
  and cv.sort_order is distinct from ranked.rn;
