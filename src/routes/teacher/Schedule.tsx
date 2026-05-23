import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/lib/db";
import { useTeacherMe } from "@/hooks/useTeacherMe";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // index = JS day order Mon-first
const DAY_TO_JS = [1, 2, 3, 4, 5, 6, 0];
const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i); // 8..21

function useTeacherBatches() {
  const { data: teacher } = useTeacherMe();
  return useQuery({
    queryKey: ["teacher-schedule", teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batches")
        .select("*, locations(name, address), instruments(name)")
        .eq("teacher_id", teacher!.id)
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useBatchStudentCounts(batchIds: string[]) {
  return useQuery({
    queryKey: ["schedule-counts", batchIds.join(",")],
    enabled: batchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("batch_id")
        .in("batch_id", batchIds)
        .eq("status", "active");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const e of data ?? []) counts[e.batch_id] = (counts[e.batch_id] ?? 0) + 1;
      return counts;
    },
  });
}

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const hh = ((h + 11) % 12) + 1;
  const ap = h < 12 ? "AM" : "PM";
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

export default function Schedule() {
  const { data: batches = [], isLoading } = useTeacherBatches();
  const { data: counts = {} } = useBatchStudentCounts(batches.map((b: any) => b.id));
  const [open, setOpen] = useState<string | null>(null);

  // Layout: each day column, each batch positioned by start_time minutes since 8AM
  const PX_PER_MIN = 1; // 60min = 60px
  const colHeight = HOURS.length * 60 * PX_PER_MIN;

  return (
    <section className="view view-teacher active">
      <div className="teacher-view max-w-6xl mx-auto px-4 py-6">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold">Schedule</h1>
          <div className="text-xs text-muted-foreground">Your weekly classes (read-only)</div>
        </header>

        {isLoading && <div className="text-sm">Loading…</div>}

        <div className="rounded-xl border bg-card overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, minmax(110px, 1fr))" }}>
            {/* header row */}
            <div className="border-b border-r p-2 text-xs text-muted-foreground"></div>
            {DAYS.map((d) => (
              <div key={d} className="border-b border-r last:border-r-0 p-2 text-xs font-medium text-center">{d}</div>
            ))}

            {/* hour gutter */}
            <div className="border-r relative" style={{ height: colHeight }}>
              {HOURS.map((h, i) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 text-[10px] text-muted-foreground pl-1"
                  style={{ top: i * 60 * PX_PER_MIN }}
                >
                  {((h + 11) % 12) + 1} {h < 12 ? "AM" : "PM"}
                </div>
              ))}
            </div>

            {/* day columns */}
            {DAYS.map((_, dayIdx) => {
              const jsDay = DAY_TO_JS[dayIdx];
              const dayBatches = batches.filter((b: any) => b.day_of_week === jsDay);
              return (
                <div
                  key={dayIdx}
                  className="relative border-r last:border-r-0"
                  style={{ height: colHeight }}
                >
                  {/* hour lines */}
                  {HOURS.map((_h, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-border/60"
                      style={{ top: i * 60 * PX_PER_MIN }}
                    />
                  ))}
                  {dayBatches.map((b: any) => {
                    const [h, m] = String(b.start_time).split(":").map(Number);
                    const startMin = (h - 8) * 60 + m;
                    const top = Math.max(0, startMin) * PX_PER_MIN;
                    const height = Math.max(28, (b.duration_min ?? 60) * PX_PER_MIN - 2);
                    if (h < 8 || h > 21) return null;
                    return (
                      <Popover key={b.id} open={open === b.id} onOpenChange={(o) => setOpen(o ? b.id : null)}>
                        <PopoverTrigger asChild>
                          <button
                            className="absolute left-1 right-1 rounded-md bg-primary/15 hover:bg-primary/25 border border-primary/40 text-left p-1.5 text-[11px] overflow-hidden"
                            style={{ top, height }}
                          >
                            <div className="font-medium leading-tight">
                              {fmtTime(b.start_time)}
                            </div>
                            <div className="text-muted-foreground leading-tight truncate">
                              {b.locations?.name}
                            </div>
                            <div className="text-muted-foreground leading-tight truncate">
                              {b.instruments?.name}
                            </div>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="text-sm w-64">
                          <div className="font-semibold">{b.locations?.name}</div>
                          <div className="text-xs text-muted-foreground mb-2">{b.instruments?.name}</div>
                          <div className="space-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Time: </span>
                              {fmtTime(b.start_time)} · {b.duration_min}min
                            </div>
                            {b.locations?.address && (
                              <div>
                                <span className="text-muted-foreground">Address: </span>
                                {b.locations.address}
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground">Students: </span>
                              {counts[b.id] ?? 0}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
