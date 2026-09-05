-- Say what a clip is, instead of inferring it from its name.
--
-- course_videos held tutorials, numbered drills and backing tracks side by
-- side with nothing to tell them apart, so the planner had to guess from the
-- title. Backing tracks are also about to include audio — the mp3s that were
-- bundled into the app — and audio is not something to guess at.

alter table public.course_videos
  add column if not exists kind text not null default 'lesson';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'course_videos_kind_check'
  ) then
    alter table public.course_videos
      add constraint course_videos_kind_check
      check (kind in ('lesson', 'track', 'exercise'));
  end if;
end $$;

-- Backfill from the naming the library already follows. Numbered first, so
-- "5. Strumming Im yours" is read as a drill rather than a backing track.
update public.course_videos
set kind = case
  when title ~ '^[0-9]+\.\s'                                                   then 'exercise'
  when title ~* '(playalong|play along|slow|normal|plucking|picking|strumming|bpm)' then 'track'
  else 'lesson'
end;

create index if not exists course_videos_kind_idx
  on public.course_videos (instrument, kind, created_at desc);

-- The mp3s that used to be bundled into the app are backing tracks, whatever
-- their titles say. They are uploaded under a predictable path prefix.
update public.course_videos
set kind = 'track'
where storage_path like '%/legacy-track-%';
