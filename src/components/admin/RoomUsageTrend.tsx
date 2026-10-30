import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRoomUsageMonths } from "@/hooks/useRoomUsageMonths";
import { buildTrend, type TrendPoint } from "@/lib/roomUsage";

const SERIES_COLORS = ["hsl(221 83% 53%)", "hsl(160 84% 39%)", "hsl(38 92% 50%)", "hsl(280 65% 60%)"];
const BAM_COLOR = "hsl(var(--foreground))";

const pct = (share: number | null | undefined) => (share === null || share === undefined ? "" : `${(share * 100).toFixed(1)}%`);
const monthName = (month: string) =>
  new Date(`${month}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

/** Month-end efficiency for each room, BAM, and BAM over the financial year. */
export default function RoomUsageTrend() {
  const { data = [], isLoading, error } = useRoomUsageMonths();
  const { rooms, points } = useMemo(() => buildTrend(data), [data]);
  const rows = useMemo(
    () => points.map((p: TrendPoint) => ({ ...p.rooms, month: p.month, bam: p.bam, cumulative: p.cumulative })),
    [points],
  );

  if (error) return <p className="text-sm text-destructive">Couldn't load the monthly figures. Refresh to try again.</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading the monthly figures…</p>;
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No months saved yet. The first one is saved tonight.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-4 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Efficiency by month</h2>
          <p className="text-sm text-muted-foreground">
            Saved every night from the running classes, so new classes count straight away and each month keeps its last
            figure. Cumulative adds up seat-hours from April, the start of the financial year.
          </p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthName} fontSize={12} />
              <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} fontSize={12} width={44} domain={[0, "auto"]} />
              <Tooltip labelFormatter={monthName} formatter={(v) => pct(v as number)} />
              <Legend />
              {rooms.map((r, i) => (
                <Line
                  key={r.scope}
                  dataKey={r.scope}
                  name={r.name}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
              <Line dataKey="bam" name="BAM" stroke={BAM_COLOR} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              <Line
                dataKey="cumulative"
                name="BAM cumulative"
                stroke={BAM_COLOR}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th className="text-left p-3 font-medium">Month</th>
              {rooms.map((r) => <th key={r.scope} className="text-right p-3 font-medium">{r.name}</th>)}
              <th className="text-right p-3 font-medium">BAM</th>
              <th className="text-right p-3 font-medium">BAM cumulative</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.month} className="border-b last:border-0">
                <td className="p-3">{monthName(p.month)}</td>
                {rooms.map((r) => <td key={r.scope} className="p-3 text-right">{pct(p.rooms[r.scope])}</td>)}
                <td className="p-3 text-right">{pct(p.bam)}</td>
                <td className="p-3 text-right">{pct(p.cumulative)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
