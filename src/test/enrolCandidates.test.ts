import { describe, it, expect } from "vitest";
import { enrolCandidates, type EnrolmentRef } from "@/lib/enrolment";

const students = [
  { id: "sid", name: "Siddharth" },
  { id: "sou", name: "Sourav" },
  { id: "old", name: "Old student" },
  { id: "left", name: "Left this class" },
];
const THIS = "uk03";

const ids = (e: EnrolmentRef[]) => enrolCandidates(students, e, THIS).map((s) => s.id);

describe("who can be added to a class", () => {
  it("leaves out a student already active in another running class", () => {
    expect(ids([{ student_id: "sid", batch_id: "uk02", status: "active", batch_active: true }])).not.toContain("sid");
  });

  it("leaves out a student paused in another running class", () => {
    expect(ids([{ student_id: "sid", batch_id: "uk02", status: "paused", batch_active: true }])).not.toContain("sid");
  });

  it("offers a student whose only class is archived", () => {
    expect(ids([{ student_id: "old", batch_id: "gone", status: "active", batch_active: false }])).toContain("old");
  });

  it("offers a student who left another class", () => {
    expect(ids([{ student_id: "sid", batch_id: "uk02", status: "dropped", batch_active: true }])).toContain("sid");
  });

  it("leaves out someone who left this class — they come back with Re-enrol", () => {
    expect(ids([{ student_id: "left", batch_id: THIS, status: "dropped", batch_active: true }])).not.toContain("left");
  });

  it("offers a student in no class at all", () => {
    expect(ids([])).toContain("sou");
  });
});
