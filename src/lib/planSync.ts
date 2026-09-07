/**
 * Which of a week's freshly-built rows should actually be written.
 *
 * Sessions are generated once and then belong to the student, but the admin's
 * course plan can change under them — an edited instruction, or a start date
 * that moves the week onto different plan content. Re-syncing keeps those in
 * step without ever rewriting practice someone has already started.
 */
export interface SyncableRow {
  session_index: number;
  scheduled_date: string;
  song_id: string;
  instruction: string;
}

export interface ExistingRow extends SyncableRow {
  completed: boolean;
  completed_at: string | null;
}

export function rowsToWrite<T extends SyncableRow>(
  rows: T[],
  existing: ExistingRow[],
  opts: { planned: boolean; today: string },
): T[] {
  return rows.filter((row) => {
    const cur = existing.find((e) => e.session_index === row.session_index);
    if (!cur) return true;
    // Generated weeks pick fresh content each time, so re-syncing them would
    // never settle.
    if (!opts.planned) return false;
    const touched = cur.completed || !!cur.completed_at;
    if (touched || cur.scheduled_date < opts.today) return false;
    return (
      cur.scheduled_date !== row.scheduled_date ||
      cur.song_id !== row.song_id ||
      cur.instruction !== row.instruction
    );
  });
}
