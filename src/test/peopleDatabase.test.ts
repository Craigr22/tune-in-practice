import { describe, expect, it } from "vitest";
import { importRows, mergePeople, parseCsv, phoneKey, rowsToEnquiries, sheetXmlToRows, sharedStringsFromXml, whatsappLink, isDue, type EnquiryRow, type StudentRow } from "@/lib/people";

const student = (over: Partial<StudentRow> = {}): StudentRow => ({
  id: "s1", name: "Test Student", phone: "+91 98200 12345", email: null, parent_name: null, is_active: true, joined_on: "2026-09-01",
  enrollments: [{ status: "active", batches: { code: "BAMUK01", instruments: { name: "Ukulele" } } }], ...over,
});
const enquiry = (over: Partial<EnquiryRow> = {}): EnquiryRow => ({
  id: "e1", created_at: "2026-10-01", name: "Test Enquiry", phone: "9999900000", phone_key: "9999900000", course: "Guitar",
  category: "Adult - Male", kid_age: null, source: "guitar", notes: null, status: "new", follow_up_on: null, last_contact_at: null, student_id: null, ...over,
});

describe("phone numbers", () => {
  it("matches the same number written different ways", () => {
    expect(phoneKey("+91 98200 12345")).toBe("9820012345");
    expect(phoneKey("098200-12345")).toBe("9820012345");
    expect(phoneKey("9820012345")).toBe("9820012345");
    expect(phoneKey("")).toBeNull();
  });
  it("opens WhatsApp on an Indian number", () => {
    expect(whatsappLink("98200 12345")).toBe("https://wa.me/919820012345");
    expect(whatsappLink("+44 7700 900123")).toBe("https://wa.me/447700900123");
    expect(whatsappLink("123")).toBeNull();
  });
});

describe("mergePeople", () => {
  it("lists students and enquiries together", () => {
    const people = mergePeople([student()], [enquiry()]);
    expect(people.map((p) => p.kind).sort()).toEqual(["enquiry", "student"]);
  });

  it("shows an enquirer who became a student once, as the student", () => {
    const people = mergePeople([student()], [enquiry({ phone: "9820012345", phone_key: "9820012345", course: "Ukulele" })]);
    expect(people).toHaveLength(1);
    expect(people[0].kind).toBe("student");
    expect(people[0].status).toBe("joined");
    expect(people[0].enquiry?.course).toBe("Ukulele");
  });

  it("follows an explicit link even when the numbers differ", () => {
    const people = mergePeople([student()], [enquiry({ student_id: "s1" })]);
    expect(people).toHaveLength(1);
  });

  it("tells current, former and unplaced students apart", () => {
    const kinds = mergePeople(
      [
        student({ id: "a" }),
        student({ id: "b", phone: null, enrollments: [{ status: "dropped", batches: null }] }),
        student({ id: "c", phone: null, enrollments: [] }),
        student({ id: "d", phone: null, is_active: false }),
      ],
      [],
    ).reduce((m, p) => ({ ...m, [p.student!.id]: p.kind }), {} as Record<string, string>);
    expect(kinds).toEqual({ a: "student", b: "former", c: "unplaced", d: "former" });
  });

  it("knows whose follow-up is due", () => {
    const [p] = mergePeople([], [enquiry({ follow_up_on: "2026-10-30" })]);
    expect(isDue(p, "2026-10-30")).toBe(true);
    expect(isDue(p, "2026-10-29")).toBe(false);
  });
});

describe("importing a spreadsheet", () => {
  const header = ["Name", "Phone", "Course", "Category", "Kid Age", "Source Tab", "Notes"];

  it("reads the Clean List's columns", () => {
    const { ok } = rowsToEnquiries([header, ["Asha", "9820517453", "Early Years", "Kid", "4.5", "early", "Enquiry"]]);
    expect(ok[0]).toEqual({ name: "Asha", phone: "9820517453", course: "Early Years", category: "Kid", kid_age: 4.5, source: "early", notes: "Enquiry" });
  });

  it("finds the columns in any order and under other names", () => {
    const { ok } = rowsToEnquiries([["Mobile", "Full Name"], ["9820517453", "Asha"]]);
    expect(ok[0].name).toBe("Asha");
  });

  it("leaves a category it doesn't know unset, rather than guessing", () => {
    const { ok } = rowsToEnquiries([header, ["Asha", "9820517453", "Violin", "Needs manual entry", "", "", ""]]);
    expect(ok[0].category).toBeNull();
  });

  it("sets aside rows without a name or a full number, and repeats", () => {
    const r = rowsToEnquiries([header, ["", "9820517453"], ["Ravi", "12345"], ["Asha", "9820517453"], ["Asha again", "+91 98205 17453"]]);
    expect(r.ok).toHaveLength(1);
    expect(r.skipped).toBe(2);
    expect(r.duplicates).toBe(1);
  });

  it("gives every imported row a status, so a batch with one existing student isn't refused", () => {
    const base = { course: null, category: null, kid_age: null, source: null, notes: null };
    const rows = importRows(
      [{ ...base, name: "Asha", phone: "9820517453" }, { ...base, name: "Ravi", phone: "+91 98200 12345" }],
      [{ id: "s1", phone: "9820012345" }],
    );
    expect(rows[0]).toMatchObject({ status: "new", student_id: null });
    expect(rows[1]).toMatchObject({ status: "joined", student_id: "s1" });
    expect(Object.keys(rows[0]).sort()).toEqual(Object.keys(rows[1]).sort());
  });

  it("needs a Name and a Phone column", () => {
    expect(() => rowsToEnquiries([["Course"], ["Guitar"]])).toThrow(/Name and a Phone/);
  });

  it("parses CSV with quotes and commas inside", () => {
    expect(parseCsv('Name,Course\n"Rao, Asha","Guitar, Ukulele"\r\nRavi,Violin\n')).toEqual([
      ["Name", "Course"], ["Rao, Asha", "Guitar, Ukulele"], ["Ravi", "Violin"],
    ]);
  });

  it("reads a sheet's cells, shared strings and gaps", () => {
    const shared = sharedStringsFromXml('<sst><si><t>Name</t></si><si><t>Phone</t></si><si><r><t>As</t></r><r><t>ha</t></r></si></sst>');
    const rows = sheetXmlToRows(
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>9820517453</v></c></row></sheetData></worksheet>',
      shared,
    );
    expect(rows).toEqual([["Name", null, "Phone"], ["Asha", null, "9820517453"]]);
  });
});
