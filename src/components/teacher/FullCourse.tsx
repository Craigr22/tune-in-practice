import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Instrument } from "@/hooks/useSongCatalog";
import { useCatalogSongs } from "@/hooks/useSongCatalog";
import { useStudentCoursePlan, type CoursePlanDay } from "@/hooks/useCoursePlan";
import { useCourseVideos, useSignedVideoUrls, type CourseVideo } from "@/hooks/useCourseVideos";
import LessonVideo from "@/components/student/LessonVideo";
import { getTier } from "@/lib/tiers";

const DAY_NAMES = ["Class", "Practice 1", "Practice 2"];

/**
 * One week of the course, as the class is shown it: each day's song, the
 * words around each clip, and the clips themselves.
 *
 * Its links to the videos are only fetched once the week is opened — a whole
 * course is a lot of clips to ask for at once.
 */
function Week({
  week,
  days,
  videos,
  songTitle,
  current,
  open,
  onToggle,
}: {
  week: number;
  days: CoursePlanDay[];
  videos: CourseVideo[];
  songTitle: (id: string | null) => string | null;
  current: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const clips = (d: CoursePlanDay) =>
    (d.video_ids ?? []).map((id) => videos.find((v) => v.id === id)).filter(Boolean) as CourseVideo[];
  const paths = open ? days.flatMap((d) => clips(d).map((v) => v.storage_path)) : [];
  const { data: urls = {} } = useSignedVideoUrls(paths);
  const songs = [...new Set(days.map((d) => songTitle(d.song_id)).filter(Boolean))];
  const tier = getTier(days[0]?.tier);

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left bg-muted/30 hover:bg-muted/50"
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            Week {week}
            <span className="ml-2 font-normal text-muted-foreground">{tier.name}</span>
            {current && (
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                Class is here
              </span>
            )}
          </span>
          {songs.length > 0 && <span className="block text-xs text-muted-foreground truncate">{songs.join(" · ")}</span>}
        </span>
      </button>

      {open && (
        <div className="divide-y">
          {days.map((d) => (
            <div key={d.id} className="px-4 py-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {DAY_NAMES[d.day_number - 1] ?? `Day ${d.day_number}`}
                {songTitle(d.song_id) && <span className="ml-2 normal-case tracking-normal font-medium text-foreground">{songTitle(d.song_id)}</span>}
              </div>
              {d.class_topic && <p className="text-sm mt-1">{d.class_topic}</p>}
              {d.instruction && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{d.instruction}</p>}
              {clips(d).length > 0 ? (
                <div className="mt-3 flex flex-col gap-6 max-w-xl">
                  {clips(d).map((v) => (
                    <LessonVideo
                      key={v.id}
                      src={urls[v.storage_path]}
                      path={v.storage_path}
                      title={v.title}
                      above={d.video_notes?.[v.id]?.above}
                      below={d.video_notes?.[v.id]?.below}
                      maxHeight={260}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">No clips on this day.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The whole course, open.
 *
 * Students get it a week at a time: next week's song is "up next" and the
 * rest is hidden until its day. A teacher needs the opposite — every week,
 * every note and every clip, to see what the class has been shown and what is
 * coming. Nothing here is locked or dated; it is the plan itself, laid out in
 * the order the class meets it.
 */
export default function FullCourse({ instrument, currentWeek }: { instrument: Instrument; currentWeek: number | null }) {
  const { days } = useStudentCoursePlan(instrument);
  const { data: videos = [] } = useCourseVideos(instrument);
  const catalog = useCatalogSongs(instrument, { showInactive: false });
  const songTitle = (id: string | null) => (id ? catalog.find((c) => c.id === id)?.title ?? id : null);

  const weeks = useMemo(() => {
    const map = new Map<number, CoursePlanDay[]>();
    for (const d of [...days].sort((a, b) => a.week_number - b.week_number || a.day_number - b.day_number)) {
      if (!map.has(d.week_number)) map.set(d.week_number, []);
      map.get(d.week_number)!.push(d);
    }
    return [...map.entries()];
  }, [days]);

  // The week the class is on starts open; the rest are one tap away.
  const [opened, setOpened] = useState<Set<number> | null>(null);
  const open = opened ?? new Set(currentWeek ? [currentWeek] : weeks.slice(0, 1).map(([w]) => w));
  const toggle = (w: number) => {
    const next = new Set(open);
    if (next.has(w)) next.delete(w);
    else next.add(w);
    setOpened(next);
  };
  const allOpen = weeks.length > 0 && weeks.every(([w]) => open.has(w));

  if (!weeks.length) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        No course has been planned for this instrument yet. An admin writes it in Course work.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Everything your students are shown, week by week — all of it open to you. They see one week at a time.
        </p>
        <button
          type="button"
          onClick={() => setOpened(allOpen ? new Set() : new Set(weeks.map(([w]) => w)))}
          className="shrink-0 text-xs font-medium underline"
        >
          {allOpen ? "Close all" : "Open all"}
        </button>
      </div>
      {weeks.map(([w, ds]) => (
        <Week
          key={w}
          week={w}
          days={ds}
          videos={videos}
          songTitle={songTitle}
          current={w === currentWeek}
          open={open.has(w)}
          onToggle={() => toggle(w)}
        />
      ))}
    </div>
  );
}
