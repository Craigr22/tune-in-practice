/**
 * The database of people: students and everyone who has asked about lessons.
 * Pure helpers, so they can be tested without a database.
 */

export type EnquiryStatus = "new" | "contacted" | "trial" | "joined" | "not_interested";
export const ENQUIRY_STATUSES: { key: EnquiryStatus; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "trial", label: "Trial booked" },
  { key: "joined", label: "Joined" },
  { key: "not_interested", label: "Not interested" },
];
export const CATEGORIES = ["Kid", "Adult - Female", "Adult - Male"] as const;
export const COURSES = ["Guitar", "Violin", "Ukulele", "Early Years", "Vocals", "Piano"] as const;

/** The last ten digits of a phone number: how two ways of writing one number are matched. */
export function phoneKey(phone: string | null | undefined): string | null {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d.length ? d : null;
}

/** A link that opens WhatsApp on this number (Indian numbers, as most are). */
export function whatsappLink(phone: string | null | undefined): string | null {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}`;
}

export interface EnquiryRow {
  id: string;
  created_at: string;
  name: string;
  phone: string | null;
  phone_key: string | null;
  course: string | null;
  category: string | null;
  kid_age: number | null;
  source: string | null;
  notes: string | null;
  status: EnquiryStatus;
  follow_up_on: string | null;
  last_contact_at: string | null;
  student_id: string | null;
}

export interface StudentRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  parent_name: string | null;
  is_active: boolean;
  joined_on: string | null;
  enrollments: { status: string; batches: { code: string | null; instruments: { name: string } | null } | null }[];
}

export type PersonKind = "student" | "former" | "unplaced" | "enquiry";

export interface Person {
  key: string;
  kind: PersonKind;
  name: string;
  phone: string | null;
  /** Classes for a student; what they asked about for an enquiry. */
  what: string;
  category: string | null;
  kidAge: number | null;
  status: EnquiryStatus | null;
  followUpOn: string | null;
  lastContactAt: string | null;
  student: StudentRow | null;
  enquiry: EnquiryRow | null;
}

/**
 * Students and enquiries as one list of people.
 *
 * An enquiry that has become a student — linked to one, or with the same
 * phone number — folds into that student's row rather than showing twice,
 * so the list is a list of people, not of records.
 */
export function mergePeople(students: StudentRow[], enquiries: EnquiryRow[]): Person[] {
  const byPhone = new Map<string, StudentRow>();
  for (const s of students) {
    const k = phoneKey(s.phone);
    if (k && !byPhone.has(k)) byPhone.set(k, s);
  }
  const enquiryFor = new Map<string, EnquiryRow>();
  const loose: EnquiryRow[] = [];
  for (const e of enquiries) {
    const s = (e.student_id && students.find((x) => x.id === e.student_id)) || (e.phone_key && byPhone.get(e.phone_key)) || null;
    if (s && !enquiryFor.has(s.id)) enquiryFor.set(s.id, e);
    else if (!s) loose.push(e);
  }

  const people: Person[] = students.map((s) => {
    const active = (s.enrollments ?? []).filter((e) => e.status === "active");
    const kind: PersonKind = !s.is_active ? "former" : active.length ? "student" : (s.enrollments ?? []).length ? "former" : "unplaced";
    const e = enquiryFor.get(s.id) ?? null;
    return {
      key: `s:${s.id}`,
      kind,
      name: s.name,
      phone: s.phone,
      what: active.map((x) => [x.batches?.code, x.batches?.instruments?.name].filter(Boolean).join(" · ")).join(", ") || (e?.course ?? ""),
      category: e?.category ?? null,
      kidAge: e?.kid_age ?? null,
      status: e ? "joined" : null,
      followUpOn: null,
      lastContactAt: e?.last_contact_at ?? null,
      student: s,
      enquiry: e,
    };
  });

  for (const e of loose) {
    people.push({
      key: `e:${e.id}`,
      kind: "enquiry",
      name: e.name,
      phone: e.phone,
      what: e.course ?? "",
      category: e.category,
      kidAge: e.kid_age,
      status: e.status,
      followUpOn: e.follow_up_on,
      lastContactAt: e.last_contact_at,
      student: null,
      enquiry: e,
    });
  }
  return people.sort((a, b) => a.name.localeCompare(b.name));
}

export const KIND_LABEL: Record<PersonKind, string> = {
  student: "Student",
  unplaced: "Student, no class",
  former: "Former student",
  enquiry: "Enquiry",
};

export const statusLabel = (s: EnquiryStatus | null) => ENQUIRY_STATUSES.find((x) => x.key === s)?.label ?? "";

/** Follow-up due on or before `today`. */
export const isDue = (p: Person, today: string) => p.kind === "enquiry" && !!p.followUpOn && p.followUpOn <= today;

/* ---------------- importing a spreadsheet ---------------- */

export interface EnquiryInput {
  name: string;
  phone: string;
  course: string | null;
  category: string | null;
  kid_age: number | null;
  source: string | null;
  notes: string | null;
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");

/** Which column is which, by header name, so the columns can be in any order. */
function findColumns(header: (string | null)[]) {
  const at = (...names: string[]) => header.findIndex((h) => names.includes(norm(h)));
  return {
    name: at("name", "fullname", "studentname"),
    phone: at("phone", "phonenumber", "mobile", "contact", "number"),
    course: at("course", "instrument", "courses"),
    category: at("category", "type"),
    age: at("kidage", "age", "childage"),
    source: at("sourcetab", "source"),
    notes: at("notes", "note", "remarks", "comment", "comments"),
  };
}

const CATEGORY_BY_KEY: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [norm(c), c]));

/**
 * Spreadsheet rows (the first being the header) → enquiries to add.
 * Rows without a name or a usable phone number are set aside, not guessed at;
 * a phone number that appears twice is kept once.
 */
export function rowsToEnquiries(rows: (string | null)[][]): { ok: EnquiryInput[]; skipped: number; duplicates: number } {
  if (!rows.length) return { ok: [], skipped: 0, duplicates: 0 };
  const c = findColumns(rows[0]);
  if (c.name < 0 || c.phone < 0) throw new Error("The sheet needs a Name and a Phone column.");
  const seen = new Set<string>();
  const ok: EnquiryInput[] = [];
  let skipped = 0;
  let duplicates = 0;
  for (const r of rows.slice(1)) {
    const cell = (i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
    const name = cell(c.name);
    const phone = cell(c.phone);
    const key = phoneKey(phone);
    if (!name || !key || key.length < 10) {
      if (name || phone) skipped++;
      continue;
    }
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    const age = Number(cell(c.age));
    ok.push({
      name,
      phone,
      course: cell(c.course) || null,
      category: CATEGORY_BY_KEY[norm(cell(c.category))] ?? null,
      kid_age: cell(c.age) && Number.isFinite(age) && age > 0 && age < 100 ? age : null,
      source: cell(c.source) || null,
      notes: cell(c.notes) || null,
    });
  }
  return { ok, skipped, duplicates };
}

/** A CSV file → rows, quoted fields and all. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

/** A sheet's XML, given its shared strings → rows. */
export function sheetXmlToRows(sheetXml: string, shared: string[]): (string | null)[][] {
  const doc = new DOMParser().parseFromString(sheetXml, "application/xml");
  const colIndex = (ref: string) => {
    let n = 0;
    for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + ch.charCodeAt(0) - 64;
    return n - 1;
  };
  const rows: (string | null)[][] = [];
  for (const rowEl of Array.from(doc.getElementsByTagName("row"))) {
    const out: (string | null)[] = [];
    for (const c of Array.from(rowEl.getElementsByTagName("c"))) {
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? null;
      const val =
        t === "s" && v != null ? shared[Number(v)] ?? "" :
        t === "inlineStr" ? Array.from(c.getElementsByTagName("t")).map((x) => x.textContent ?? "").join("") :
        v;
      out[colIndex(c.getAttribute("r") ?? "A")] = val;
    }
    if (out.some((x) => x != null && x !== "")) rows.push(Array.from(out, (x) => x ?? null));
  }
  return rows;
}

export function sharedStringsFromXml(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.getElementsByTagName("si")).map((si) =>
    Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""),
  );
}
