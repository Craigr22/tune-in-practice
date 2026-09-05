-- Link the uploaded clips to the songs they belong to.
--
-- Every one of the 37 videos had song_id null, so the song panel in Journey —
-- which looks clips up by song — had nothing to show for any song. Tutorials
-- and backing tracks were uploaded but unreachable from the map.
--
-- Song ids are the catalogue's own slugs (src/data/songs.ts). Matched by
-- title, so this reads as the library; anything general — tuning, the first
-- lesson, the numbered exercises, the bpm tracks — belongs to no single song
-- and is deliberately left unlinked.

with mapping(title, song_id) as (
  values
    -- You Are My Sunshine: tutorial, completed version, two backing tracks
    ('You are my Sunshine',            'sunshine'),
    ('Completed: You are my Sunshine', 'sunshine'),
    ('You are my Sunshine CF Slow',    'sunshine'),
    ('You are my sunshine cfg slow',   'sunshine'),

    -- Piyu Bole
    ('Piyu Bole Tutorial',             'piyu-bole'),
    ('Piyu Bole Slow',                 'piyu-bole'),
    ('Piyu Bole Playalong normal',     'piyu-bole'),

    -- Photograph
    ('Photograph Tutorial',            'photograph'),
    ('Photograph slow playalong',      'photograph'),
    ('Photograph normal playalong',    'photograph'),

    -- I'm Yours
    ('I''m Yours Tutorial',            'im-yours'),
    ('Im yours slow playalong',        'im-yours'),
    ('Im yours normal playalong',      'im-yours'),
    ('5. Strumming Im yours',          'im-yours'),

    -- Kho Gaye Hum Kahan
    ('Kho Gaye Hum Kahan Tutorial',    'kho-gaye'),
    ('kho gaye slow strumming',        'kho-gaye'),
    ('Kho gaye normal strumming',      'kho-gaye'),
    ('Kho gaye slow picking',          'kho-gaye'),
    ('Kho Gaye Normal Plucking',       'kho-gaye'),

    -- Over the Rainbow
    ('Over the Rainbow Tutorial',      'over-rainbow'),
    ('Rainbow slow playalong',         'over-rainbow'),
    ('Rainbow normal playalong',       'over-rainbow'),

    -- Single-clip songs
    ('Kaisi Paheli Tutorial',          'kaisi-paheli'),
    ('Sham normal playalong',          'sham')
)
update public.course_videos cv
set song_id = m.song_id
from mapping m
where cv.title = m.title
  and cv.song_id is distinct from m.song_id;
