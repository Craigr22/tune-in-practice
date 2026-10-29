import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseCsv, phoneKey, rowsToEnquiries, type EnquiryInput, type EnquiryRow, type StudentRow } from "@/lib/people";
import { useImportEnquiries } from "@/hooks/usePeopleDatabase";

interface Plan {
  file: string;
  rows: EnquiryInput[];
  fresh: EnquiryInput[];
  already: number;
  students: number;
  skipped: number;
  duplicates: number;
  uncategorised: number;
}

/**
 * Bring in a list of enquiries from a spreadsheet (.xlsx or .csv): Name and
 * Phone columns are needed; Course, Category, Kid Age, Source and Notes are
 * used when they're there. It shows what would be added before adding it.
 */
export default function ImportDialog({ enquiries, students }: { enquiries: EnquiryRow[]; students: StudentRow[] }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const run = useImportEnquiries();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const rows = /\.csv$/i.test(file.name)
        ? parseCsv(await file.text())
        : await (await import("@/lib/xlsxRead")).readFirstSheet(file);
      const { ok, skipped, duplicates } = rowsToEnquiries(rows);
      const known = new Set(enquiries.map((e) => e.phone_key).filter(Boolean));
      const studentPhones = new Set(students.map((s) => phoneKey(s.phone)).filter(Boolean));
      const fresh = ok.filter((r) => !known.has(phoneKey(r.phone)));
      setPlan({
        file: file.name,
        rows: ok,
        fresh,
        already: ok.length - fresh.length,
        students: fresh.filter((r) => studentPhones.has(phoneKey(r.phone))).length,
        skipped,
        duplicates,
        uncategorised: fresh.filter((r) => !r.category).length,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't read that file");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  };

  const go = async () => {
    if (!plan) return;
    setProgress(0);
    try {
      const n = await run.mutateAsync({ rows: plan.fresh, students, onProgress: setProgress });
      toast.success(`${n.toLocaleString()} people added`);
      setPlan(null);
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "The import stopped part-way; run it again to finish — nothing is added twice");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPlan(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Upload className="w-4 h-4 mr-1.5" /> Import spreadsheet</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Import enquiries</DialogTitle></DialogHeader>
        <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {!plan ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Choose an .xlsx or .csv with <strong>Name</strong> and <strong>Phone</strong> columns. Course, Category, Kid Age,
              Source and Notes are brought in too when they're there. Nothing is saved until you confirm.
            </p>
            <Button onClick={() => input.current?.click()} disabled={reading}>{reading ? "Reading…" : "Choose file"}</Button>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="text-muted-foreground">{plan.file}</div>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
              <dt>People in the file</dt><dd className="text-right tabular-nums">{plan.rows.length.toLocaleString()}</dd>
              <dt className="font-medium">To be added</dt><dd className="text-right tabular-nums font-medium">{plan.fresh.length.toLocaleString()}</dd>
              {plan.already > 0 && (<><dt className="text-muted-foreground">Already in the database</dt><dd className="text-right tabular-nums text-muted-foreground">{plan.already}</dd></>)}
              {plan.students > 0 && (<><dt className="text-muted-foreground">Already students (marked joined)</dt><dd className="text-right tabular-nums text-muted-foreground">{plan.students}</dd></>)}
              {plan.uncategorised > 0 && (<><dt className="text-muted-foreground">No category yet</dt><dd className="text-right tabular-nums text-muted-foreground">{plan.uncategorised}</dd></>)}
              {plan.duplicates > 0 && (<><dt className="text-muted-foreground">Same number twice in the file</dt><dd className="text-right tabular-nums text-muted-foreground">{plan.duplicates}</dd></>)}
              {plan.skipped > 0 && (<><dt className="text-muted-foreground">Left out (no name or phone)</dt><dd className="text-right tabular-nums text-muted-foreground">{plan.skipped}</dd></>)}
            </dl>
            {run.isPending && <div className="text-muted-foreground">Adding… {progress.toLocaleString()} of {plan.fresh.length.toLocaleString()}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPlan(null)} disabled={run.isPending}>Choose another file</Button>
              <Button onClick={go} disabled={run.isPending || plan.fresh.length === 0}>
                {run.isPending ? "Adding…" : `Add ${plan.fresh.length.toLocaleString()} people`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
