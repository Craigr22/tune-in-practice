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

update public.course_videos
set kind = case
  when title ~ '^[0-9]+\.\s'                                                       then 'exercise'
  when title ~* '(playalong|play along|slow|normal|plucking|picking|strumming|bpm)' then 'track'
  else 'lesson'
end;

create index if not exists course_videos_kind_idx
  on public.course_videos (instrument, kind, created_at desc);

update public.course_videos
set kind = 'track'
where storage_path like '%/legacy-track-%';