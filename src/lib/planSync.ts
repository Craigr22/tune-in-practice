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
  focus_song_id: string;
  focus_instruction: string;
  warmup_instruction: string;
  bonus_instruction: string;
}

export interface ExistingRow extends SyncableRow {
  warmup_completed: boolean;
  focus_completed: boolean;
  bonus_completed: boolean;
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
    // Generated weeks pick a fresh warm-up and bonus each time, so re-syncing
    // them would never settle.
    if (!opts.planned) return false;
    const touched =
      cur.warmup_completed || cur.focus_completed || cur.bonus_completed || !!cur.completed_at;
    if (touched || cur.scheduled_date < opts.today) return false;
    return (
      cur.scheduled_date !== row.scheduled_date ||
      cur.focus_song_id !== row.focus_song_id ||
      cur.focus_instruction !== row.focus_instruction ||
      cur.warmup_instruction !== row.warmup_instruction ||
      cur.bonus_instruction !== row.bonus_instruction
    );
  });
}
