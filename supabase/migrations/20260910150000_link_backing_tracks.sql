-- Attach the mp3 backing tracks to their songs.
--
-- They were uploaded without a song, so the play-along in a song's panel had
-- no audio to reach for and fell back to a video play-along instead. Matching
-- by title; normal speed first where a song has both, since that is the one a
-- student plays along to by default and the speed control covers the rest.

with mapping(title, song_id, rank) as (
  values
    ('You are my Sunshine Normal Backing Track', 'sunshine',     1),
    ('You are my Sunshine slow backing',         'sunshine',     2),
    ('Piyu Bole Normal Speed Backing Track',     'piyu-bole',    1),
    ('Piyu Bole Slow Backing track',             'piyu-bole',    2),
    ('Photograph Normal Speed Backing Track',    'photograph',   1),
    ('Photograph Slow Backing Track',            'photograph',   2),
    ('I''m yours Slow Backing Track',            'im-yours',     1),
    ('Kaisi Paheli Slow Backing Track',          'kaisi-paheli', 1),
    ('Kho Gaye Slow Backing Track',              'kho-gaye',     1)
)
update public.course_videos cv
set song_id = m.song_id,
    -- Ahead of the video play-alongs, which sit in the twenties.
    sort_order = m.rank
from mapping m
where cv.title = m.title
  and cv.storage_path like '%.mp3';
