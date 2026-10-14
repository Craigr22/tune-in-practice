import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useInstruments } from "@/hooks/useTeachers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/finance";
import { toast } from "sonner";

interface Fee {
  instrument_id: string;
  amount: number;
  fee_cycle: "monthly" | "quarterly" | "semester";
  registration_fee: number;
  is_active: boolean;
}

/** Tolerate the page being opened before its migration has run. */
const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /website_(fees|bookings)/.test(e.message ?? ""));

function useWebsiteFees() {
  return useQuery({
    queryKey: ["website-fees"],
    queryFn: async (): Promise<Fee[] | null> => {
      const { data, error } = await (supabase as any).from("website_fees").select("*");
      if (error) {
        if (missing(error)) return null;
        throw error;
      }
      return data ?? [];
    },
  });
}

function useWebsiteBookings() {
  return useQuery({
    queryKey: ["website-bookings"],
    queryFn: async (): Promise<any[] | null> => {
      const { data, error } = await (supabase as any)
        .from("website_bookings")
        .select("id, created_at, student_name, parent_name, phone, amount, status, username, notes, batches(code, instruments(name))")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        if (missing(error)) return null;
        throw error;
      }
      return data ?? [];
    },
  });
}

/** One instrument's price on the website. */
function FeeRow({ instrument, fee }: { instrument: { id: string; name: string }; fee?: Fee }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(fee ? String(fee.amount) : "");
  const [registration, setRegistration] = useState(fee ? String(fee.registration_fee) : "0");
  const [cycle, setCycle] = useState<Fee["fee_cycle"]>(fee?.fee_cycle ?? "monthly");
  const [active, setActive] = useState(fee?.is_active ?? true);

  const save = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!value || value <= 0) throw new Error("Enter the fee");
      const { error } = await (supabase as any).from("website_fees").upsert({
        instrument_id: instrument.id,
        amount: value,
        fee_cycle: cycle,
        registration_fee: Number(registration) || 0,
        is_active: active,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${instrument.name} fee saved`);
      qc.invalidateQueries({ queryKey: ["website-fees"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save"),
  });

  return (
    <tr className="border-t">
      <td className="p-3 font-medium">{instrument.name}</td>
      <td className="p-3"><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="e.g. 3500" className="w-28" /></td>
      <td className="p-3">
        <select value={cycle} onChange={(e) => setCycle(e.target.value as Fee["fee_cycle"])} className="border rounded-md h-9 px-2 bg-background">
          <option value="monthly">per month</option>
          <option value="quarterly">per quarter</option>
          <option value="semester">per semester</option>
        </select>
      </td>
      <td className="p-3"><Input value={registration} onChange={(e) => setRegistration(e.target.value)} inputMode="decimal" className="w-24" /></td>
      <td className="p-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Bookable
        </label>
      </td>
      <td className="p-3 text-right">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </td>
    </tr>
  );
}

const STATUS: Record<string, string> = {
  pending: "Started, not paid",
  processing: "Paid — being set up",
  paid: "Joined",
  error: "Paid — needs you",
};

/**
 * The website's booking: what each instrument costs to join, and who has
 * booked. A booking that is paid becomes a student on its own — in the class,
 * with the payment recorded and a login made. Only one that went wrong after
 * payment needs anything from an admin.
 */
export default function WebsiteBookings() {
  const { data: instruments = [] } = useInstruments();
  const { data: fees } = useWebsiteFees();
  const { data: bookings } = useWebsiteBookings();

  if (fees === null || bookings === null) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold">Website</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Website booking isn't switched on yet — its database update hasn't been applied.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Website</h1>
        <p className="text-sm text-muted-foreground">
          What joining costs on bamacademyofmusic.com, and who has booked there. A class can be booked
          once its instrument has a fee here.
        </p>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Instrument</th>
              <th className="text-left p-3">Fee (₹)</th>
              <th className="text-left p-3">Every</th>
              <th className="text-left p-3">One-off registration (₹)</th>
              <th className="text-left p-3"></th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {instruments.map((i: any) => (
              <FeeRow key={`${i.id}:${fees?.find((f) => f.instrument_id === i.id)?.amount ?? ""}`} instrument={i} fee={fees?.find((f) => f.instrument_id === i.id)} />
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Bookings</h2>
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">Student</th>
                <th className="text-left p-3">Class</th>
                <th className="text-left p-3">Paid</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(bookings ?? []).map((b) => (
                <tr key={b.id} className="border-t align-top">
                  <td className="p-3 text-muted-foreground whitespace-nowrap">{new Date(b.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    <div className="font-medium">{b.student_name}</div>
                    <div className="text-xs text-muted-foreground">{[b.parent_name, b.phone].filter(Boolean).join(" · ")}</div>
                    {b.username && <div className="text-xs font-mono mt-0.5">{b.username}</div>}
                  </td>
                  <td className="p-3">{[b.batches?.code, b.batches?.instruments?.name].filter(Boolean).join(" · ")}</td>
                  <td className="p-3 tabular-nums">{formatINR(Number(b.amount))}</td>
                  <td className="p-3">
                    <span className={b.status === "error" ? "text-red-600 font-medium" : b.status === "paid" ? "text-emerald-600" : "text-muted-foreground"}>
                      {STATUS[b.status] ?? b.status}
                    </span>
                    {b.status === "error" && b.notes && <div className="text-xs text-muted-foreground mt-0.5 max-w-xs">{b.notes}</div>}
                  </td>
                </tr>
              ))}
              {(bookings ?? []).length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No bookings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
