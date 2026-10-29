import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES, COURSES, phoneKey } from "@/lib/people";
import { useAddEnquiry } from "@/hooks/usePeopleDatabase";

/** Someone calls or walks in asking about lessons. */
export default function AddEnquiryDialog() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", course: "", category: "", age: "", notes: "" });
  const add = useAddEnquiry();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.name.trim()) return toast.error("Add their name");
    if ((phoneKey(f.phone) ?? "").length < 10) return toast.error("Add a 10-digit phone number");
    try {
      await add.mutateAsync({
        name: f.name.trim(),
        phone: f.phone.trim(),
        course: f.course || null,
        category: f.category || null,
        kid_age: f.category === "Kid" && Number(f.age) > 0 ? Number(f.age) : null,
        source: "Added by hand",
        notes: f.notes.trim() || null,
      });
      toast.success(`${f.name.trim()} added`);
      setF({ name: "", phone: "", course: "", category: "", age: "", notes: "" });
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't add them");
    }
  };

  const select = "w-full border rounded-md h-9 px-2 bg-background text-sm";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-1.5" /> Add enquiry</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add an enquiry</DialogTitle></DialogHeader>
        <div className="grid gap-3 text-sm">
          <Input placeholder="Name" value={f.name} onChange={set("name")} />
          <Input placeholder="Phone" inputMode="tel" value={f.phone} onChange={set("phone")} />
          <div className="grid grid-cols-2 gap-3">
            <select value={f.course} onChange={set("course")} className={select}>
              <option value="">Course…</option>
              {COURSES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={f.category} onChange={set("category")} className={select}>
              <option value="">Category…</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {f.category === "Kid" && <Input placeholder="Child's age" inputMode="decimal" value={f.age} onChange={set("age")} />}
          <Input placeholder="Notes (optional)" value={f.notes} onChange={set("notes")} />
          <div className="flex justify-end">
            <Button onClick={save} disabled={add.isPending}>{add.isPending ? "Adding…" : "Add"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
