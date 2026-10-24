/**
 * Who can be added to a class.
 *
 * A student already sitting in a running class is left out: one wrong tap in
 * the list used to put a student in two classes at once, and a student in two
 * classes gets a muddled app (practice days, songs and board from either).
 * Moving someone means taking them out of their class first.
 *
 * Kept out:
 *  - anyone with an enrolment of any kind in this class (those who left come
 *    back with Re-enrol, which keeps their record);
 *  - anyone active or paused in another class that is still running.
 * An enrolment in an archived class doesn't count — that class is over.
 */
export interface EnrolmentRef {
  student_id: string;
  batch_id: string;
  status: string;
  batch_active: boolean;
}

export function enrolCandidates<S extends { id: string }>(
  students: S[],
  enrolments: EnrolmentRef[],
  batchId: string,
): S[] {
  const taken = new Set<string>();
  for (const e of enrolments) {
    if (e.batch_id === batchId) taken.add(e.student_id);
    else if (e.batch_active && (e.status === "active" || e.status === "paused")) taken.add(e.student_id);
  }
  return students.filter((s) => !taken.has(s.id));
}
