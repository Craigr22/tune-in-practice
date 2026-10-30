import { useMemo, useState } from "react";
import BatchDetailDialog from "@/components/admin/BatchDetailDialog";
import RoomUsageTrend from "@/components/admin/RoomUsageTrend";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBatchList } from "@/hooks/useBatches";
import { useLocations } from "@/hooks/useLocations";
import { useRoomPlanClasses } from "@/hooks/useRoomPlanClasses";
import {
  CLASS_CAPACITY,
  CLOSE_HOUR,
  OPEN_HOURS_PER_ROOM,
  OPEN_HOUR,
  computeRoomUsage,
  overlappingIds,
  startMinutes,
  type RoomUsage,
  type UsageClass,
} from "@/lib/roomUsage";

const DAYS = [
  { dow: 1, label: "Mon" },
  { dow: 2, label: "Tue" },
  { dow: 3, label: "Wed" },
  { dow: 4, label: "Thu" },
  { dow: 5, label: "Fri" },
  { dow: 6, label: "Sat" },
  { dow: 0, label: "Sun" },
];

const HOUR_PX = 44;

/** `names` is set only for workbook classes, which have no portal students. */
type Slot = UsageClass & { teacher: string; instrument: string; names?: string[] };

const pct = (share: number) => `${(share * 100).toFixed(1)}%`;
const hours = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
const hourLabel = (h: number) => `${(h + 11) % 12 + 1}${h < 12 || h === 24 ? "am" : "pm"}`;
const clock = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = String(mins % 60).padStart(2, "0");
  return `${(h + 11) % 12 + 1}:${m} ${h < 12 || h === 24 ? "am" : "pm"}`;
};

/** A full class is the darkest; past full gets a red ring as well. */
const fillClass = (enrolled: number) => {
  if (enrolled > CLASS_CAPACITY) return "bg-primary/45 ring-2 ring-inset ring-destructive";
  if (enrolled === CLASS_CAPACITY) return "bg-primary/45";
  if (enrolled / CLASS_CAPACITY > 0.4) return "bg-primary/25";
  return "bg-primary/10";
};

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border p-4 bg-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function RoomWeek({
  usage,
  slots,
  overlaps,
  onOpen,
}: {
  usage: RoomUsage;
  slots: Slot[];
  overlaps: Set<string>;
  onOpen: (slot: Slot) => void;
}) {
  // Open hours set the grid, unless a class runs outside them.
  const from = Math.min(OPEN_HOUR, ...slots.map((s) => Math.floor(startMinutes(s.startTime) / 60)));
  const to = Math.max(CLOSE_HOUR, ...slots.map((s) => Math.ceil((startMinutes(s.startTime) + s.durationMin) / 60)));
  const height = (to - from) * HOUR_PX;

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{usage.room.name}</h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {usage.classes} {usage.classes === 1 ? "class" : "classes"}, {pct(usage.roomUse)} of open hours,{" "}
          {pct(usage.classFill)} full, {pct(usage.efficiency)} efficiency
          {usage.overlaps > 0 ? `, ${usage.overlaps} overlapping` : ""}
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(5.5rem,1fr))] min-w-[44rem] text-xs tabular-nums">
          <div />
          {DAYS.map((d) => (
            <div key={d.dow} className="py-1 text-center font-medium">{d.label}</div>
          ))}
          <div className="relative" style={{ height }}>
            {Array.from({ length: to - from }, (_, i) => (
              <div
                key={i}
                className="absolute right-1 text-muted-foreground"
                style={{ top: i * HOUR_PX }}
              >
                {hourLabel(from + i)}
              </div>
            ))}
          </div>
          {DAYS.map((d) => (
            <div
              key={d.dow}
              className="relative border-l overflow-hidden"
              style={{
                height,
                backgroundImage: `repeating-linear-gradient(to bottom, hsl(var(--ui-border)) 0 1px, transparent 1px ${HOUR_PX}px)`,
              }}
            >
              {slots.filter((s) => s.dayOfWeek === d.dow).map((s) => {
                const start = startMinutes(s.startTime);
                const clash = overlaps.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onOpen(s)}
                    title={[
                      `${clock(start)} to ${clock(start + s.durationMin)}`,
                      `${s.teacher}, ${s.instrument}`,
                      `${s.enrolled} of ${CLASS_CAPACITY} seats`,
                      s.names ? "From the class & teacher workbook" : "",
                      clash ? "Overlaps another class in this room" : "",
                    ].filter(Boolean).join("\n")}
                    className={`absolute inset-x-0.5 rounded px-1 overflow-hidden leading-tight text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-ring ${fillClass(s.enrolled)} ${clash ? "outline-dashed outline-2 -outline-offset-2 outline-amber-600" : ""}`}
                    style={{ top: (start / 60 - from) * HOUR_PX, height: (s.durationMin / 60) * HOUR_PX - 2 }}
                  >
                    <div className="flex justify-between gap-1 font-medium">
                      <span className="truncate">{s.teacher}</span>
                      <span>{s.enrolled}/{CLASS_CAPACITY}</span>
                    </div>
                    <div className="text-muted-foreground truncate">{clock(start)}</div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * How much of BAM's room time and seats the weekly timetable uses. It reads
 * the running classes and their active students, so it moves as classes and
 * enrolments change in the portal, plus the workbook classes kept only for
 * this page.
 */
export default function RoomUsagePage() {
  const { data: batches = [], isLoading: loadingClasses, error: classError } = useBatchList();
  const { data: locations = [], isLoading: loadingRooms, error: roomError } = useLocations();
  const { data: planClasses = [], isLoading: loadingPlan, error: planError } = useRoomPlanClasses();
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [openPlan, setOpenPlan] = useState<Slot | null>(null);

  const { slots, rooms, usage, overlaps } = useMemo(() => {
    const portal: Slot[] = batches
      .filter((b: any) => b.is_active)
      .map((b: any) => ({
        id: b.id,
        locationId: b.location_id,
        dayOfWeek: b.day_of_week,
        startTime: b.start_time,
        durationMin: b.duration_min,
        enrolled: b.enrolled,
        teacher: b.teachers?.name ?? "No teacher",
        instrument: b.instruments?.name ?? "Class",
      }));
    const workbook: Slot[] = planClasses.map((p: any) => ({
      id: p.id,
      locationId: p.location_id,
      dayOfWeek: p.day_of_week,
      startTime: p.start_time,
      durationMin: p.duration_min,
      enrolled: p.student_names.length,
      teacher: p.teacher_name,
      instrument: p.instrument ?? "Class",
      names: p.student_names,
    }));
    const slots = [...portal, ...workbook];
    const rooms = locations
      .filter((l: any) => l.is_active)
      .map((l: any) => ({ id: l.id, name: l.name }));
    return { slots, rooms, usage: computeRoomUsage(slots, rooms), overlaps: overlappingIds(slots) };
  }, [batches, locations, planClasses]);

  const open = (slot: Slot) => (slot.names ? setOpenPlan(slot) : setOpenClass(slot.id));

  if (classError || roomError || planError) {
    return <div className="p-6 text-sm text-destructive">Couldn't load the timetable. Refresh to try again.</div>;
  }
  if (loadingClasses || loadingRooms || loadingPlan) {
    return <div className="p-6 text-sm text-muted-foreground">Loading the timetable…</div>;
  }

  const { overall } = usage;
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Room efficiency usage</h1>
        <p className="text-sm text-muted-foreground">
          Rooms are booked {pct(overall.roomUse)} of open hours and classes run {pct(overall.classFill)} full, so BAM is
          using {pct(overall.efficiency)} of its weekly seats.
        </p>
      </div>

      <Tabs defaultValue="week" className="space-y-6">
        <TabsList>
          <TabsTrigger value="week">This week</TabsTrigger>
          <TabsTrigger value="trend">Monthly trend</TabsTrigger>
        </TabsList>
        <TabsContent value="trend"><RoomUsageTrend /></TabsContent>
        <TabsContent value="week" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          label="BAM efficiency"
          value={pct(overall.efficiency)}
          hint={`${hours(overall.seatHoursFilled)} of ${hours(overall.seatHoursOpen)} seat-hours: ${CLASS_CAPACITY} students × ${rooms.length} ${rooms.length === 1 ? "room" : "rooms"} × ${OPEN_HOURS_PER_ROOM} open hours`}
        />
        <Stat
          label="Room time used"
          value={pct(overall.roomUse)}
          hint={`${hours(overall.bookedHours)} of ${hours(overall.openHours)} open room hours have a class`}
        />
        <Stat
          label="Class fill"
          value={pct(overall.classFill)}
          hint={`${overall.enrolled} students in ${overall.classes} weekly ${overall.classes === 1 ? "class" : "classes"}, at ${CLASS_CAPACITY} a class`}
        />
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-primary/10 border" />1–2 students</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-primary/25 border" />3–4 students</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-primary/45 border" />Full at {CLASS_CAPACITY}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-primary/45 ring-2 ring-inset ring-destructive" />Over {CLASS_CAPACITY}</span>
        <span>Open 7am to 10pm every day. Click a class to see its students.</span>
      </div>

      {usage.rooms.map((room) => (
        <RoomWeek
          key={room.room.id}
          usage={room}
          slots={slots.filter((s) => s.locationId === room.room.id)}
          overlaps={overlaps}
          onOpen={open}
        />
      ))}
      {rooms.length === 0 && <p className="text-sm text-muted-foreground">No active rooms yet. Add one to see its week.</p>}
        </TabsContent>
      </Tabs>
      <BatchDetailDialog batchId={openClass} onClose={() => setOpenClass(null)} />
      <Dialog open={!!openPlan} onOpenChange={(o) => !o && setOpenPlan(null)}>
        <DialogContent>
          {openPlan && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {openPlan.teacher}, {DAYS.find((d) => d.dow === openPlan.dayOfWeek)?.label} {clock(startMinutes(openPlan.startTime))}
                </DialogTitle>
                <DialogDescription>
                  {openPlan.instrument}. From the class &amp; teacher workbook, so these students aren't in the portal.
                </DialogDescription>
              </DialogHeader>
              <ul className="text-sm space-y-1">
                {openPlan.names!.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
