import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Phone, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ENQUIRY_STATUSES, KIND_LABEL, whatsappLink, type EnquiryStatus, type Person } from "@/lib/people";
import { useEnquiryActivity, useLogContact, useMakeStudent, useUpdateEnquiry } from "@/hooks/usePeopleDatabase";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const KIND_TEXT: Record<string, string> = { call: "Called", whatsapp: "WhatsApp", note: "Note", status: "Status" };

/** One person: who they are, how to reach them, and where things stand. */
export default function PersonPanel({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const e = person?.enquiry ?? null;
  const s = person?.student ?? null;
  const { data: activity = [] } = useEnquiryActivity(e?.id);
  const update = useUpdateEnquiry();
  const log = useLogContact();
  const makeStudent = useMakeStudent();
  const [note, setNote] = useState("");

  if (!person) return null;
  const wa = whatsappLink(person.phone);

  const reach = (kind: "call" | "whatsapp") => {
    if (e) log.mutate({ enquiry: e, kind });
  };
  const setStatus = (status: EnquiryStatus) =>
    e && update.mutate({ id: e.id, patch: { status }, log: { kind: "status", body: ENQUIRY_STATUSES.find((x) => x.key === status)?.label } });
  const saveNote = async () => {
    if (!e || !note.trim()) return;
    await log.mutateAsync({ enquiry: e, kind: "note", body: note.trim() });
    setNote("");
  };
  const join = async () => {
    if (!e) return;
    try {
      await makeStudent.mutateAsync(e);
      toast.success(`${e.name} is now a student — put them in a class from Schedule → Classes`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't make them a student");
    }
  };

  return (
    <Sheet open={!!person} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{person.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-2 text-sm text-muted-foreground">
          {KIND_LABEL[person.kind]}
          {person.what && <> · {person.what}</>}
        </div>

        {/* Reaching them: the buttons open WhatsApp or the dialler, and count as contact. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {wa && (
            <Button asChild size="sm">
              <a href={wa} target="_blank" rel="noreferrer" onClick={() => reach("whatsapp")}>
                <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
              </a>
            </Button>
          )}
          {person.phone && (
            <Button asChild size="sm" variant="outline">
              <a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`} onClick={() => reach("call")}>
                <Phone className="w-4 h-4 mr-1.5" /> {person.phone}
              </a>
            </Button>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          {person.category && (<><dt className="text-muted-foreground">Category</dt><dd>{person.category}{person.kidAge ? `, age ${person.kidAge}` : ""}</dd></>)}
          {e?.course && (<><dt className="text-muted-foreground">Asked about</dt><dd>{e.course}</dd></>)}
          {e?.source && (<><dt className="text-muted-foreground">Source</dt><dd>{e.source}</dd></>)}
          {e?.notes && (<><dt className="text-muted-foreground">Notes</dt><dd className="whitespace-pre-line">{e.notes}</dd></>)}
          {s?.parent_name && (<><dt className="text-muted-foreground">Parent</dt><dd>{s.parent_name}</dd></>)}
          {s?.email && (<><dt className="text-muted-foreground">Email</dt><dd>{s.email}</dd></>)}
          {s?.joined_on && (<><dt className="text-muted-foreground">Joined</dt><dd>{s.joined_on}</dd></>)}
          {e?.last_contact_at && (<><dt className="text-muted-foreground">Last contact</dt><dd>{when(e.last_contact_at)}</dd></>)}
        </dl>

        {person.kind === "enquiry" && e && (
          <div className="mt-6 space-y-4 border-t pt-5">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                <span className="text-muted-foreground">Status</span>
                <select
                  value={e.status}
                  onChange={(ev) => setStatus(ev.target.value as EnquiryStatus)}
                  className="mt-1 w-full border rounded-md h-9 px-2 bg-background text-sm"
                >
                  {ENQUIRY_STATUSES.filter((x) => x.key !== "joined").map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                </select>
              </label>
              <label className="text-xs">
                <span className="text-muted-foreground">Follow up on</span>
                <input
                  type="date"
                  value={e.follow_up_on ?? ""}
                  onChange={(ev) => update.mutate({ id: e.id, patch: { follow_up_on: ev.target.value || null } })}
                  className="mt-1 w-full border rounded-md h-9 px-2 bg-background text-sm"
                />
              </label>
            </div>

            <div>
              <Textarea value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="What was said — e.g. wants a Sunday batch, call back after Diwali" rows={3} />
              <div className="mt-2 flex items-center justify-between gap-2">
                <Button size="sm" variant="outline" onClick={saveNote} disabled={!note.trim() || log.isPending}>Save note</Button>
                <Button size="sm" onClick={join} disabled={makeStudent.isPending}>
                  <UserPlus className="w-4 h-4 mr-1.5" /> {makeStudent.isPending ? "Adding…" : "Make a student"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {s && person.kind !== "enquiry" && (
          <p className="mt-6 border-t pt-5 text-sm text-muted-foreground">
            Classes, payments and logins for students are managed in{" "}
            <Link to="/admin/people" className="underline">People</Link> and <Link to="/admin/schedule" className="underline">Schedule</Link>.
          </p>
        )}

        {e && activity.length > 0 && (
          <div className="mt-6 border-t pt-5">
            <div className="text-sm font-medium mb-2">History</div>
            <ul className="space-y-2 text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{when(a.at)}</span>
                  <span><span className="font-medium">{KIND_TEXT[a.kind] ?? a.kind}</span>{a.body ? `: ${a.body}` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
