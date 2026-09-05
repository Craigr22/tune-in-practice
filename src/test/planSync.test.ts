import { describe, it, expect } from "vitest";
import { rowsToWrite, type ExistingRow } from "@/lib/planSync";

const row = (over: Partial<ExistingRow> = {}) => ({
  session_index: 0,
  scheduled_date: "2026-09-09",
  focus_song_id: "song1",
  focus_instruction: "Watch the Piyu Bole summary.",
  warmup_instruction: "Tune up.",
  bonus_instruction: "Loop the tricky change.",
  ...over,
});

const existing = (over: Partial<ExistingRow> = {}): ExistingRow => ({
  ...row(),
  warmup_completed: false,
  focus_completed: false,
  bonus_completed: false,
  completed_at: null,
  ...over,
});

const opts = { planned: true, today: "2026-09-05" };

describe("rowsToWrite", () => {
  it("writes a session that doesn't exist yet", () => {
    expect(rowsToWrite([row()], [], opts)).toHaveLength(1);
  });

  it("leaves an up-to-date session alone", () => {
    expect(rowsToWrite([row()], [existing()], opts)).toHaveLength(0);
  });

  it("re-syncs a future session when the plan's wording changes", () => {
    const changed = row({ focus_instruction: "Watch the Piyu Bole summary, then learn the shapes." });
    expect(rowsToWrite([changed], [existing()], opts)).toHaveLength(1);
  });

  it("re-syncs when the week now maps to different plan content", () => {
    const changed = row({ focus_song_id: "song2", focus_instruction: "Watch the first lesson." });
    expect(rowsToWrite([changed], [existing()], opts)).toHaveLength(1);
  });

  it("never rewrites practice the student has started", () => {
    const changed = row({ focus_instruction: "something else" });
    for (const touch of [
      { warmup_completed: true },
      { focus_completed: true },
      { bonus_completed: true },
      { completed_at: "2026-09-09T10:00:00Z" },
    ]) {
      expect(rowsToWrite([changed], [existing(touch)], opts)).toHaveLength(0);
    }
  });

  it("never rewrites a session in the past", () => {
    const changed = row({ scheduled_date: "2026-09-02", focus_instruction: "something else" });
    const cur = existing({ scheduled_date: "2026-09-02" });
    expect(rowsToWrite([changed], [cur], opts)).toHaveLength(0);
  });

  it("leaves generated weeks alone, since their content is picked fresh each time", () => {
    const changed = row({ focus_instruction: "a different generated warm-up" });
    expect(rowsToWrite([changed], [existing()], { ...opts, planned: false })).toHaveLength(0);
  });

  it("settles — a written row is not written again", () => {
    const changed = row({ focus_instruction: "new wording" });
    const [written] = rowsToWrite([changed], [existing()], opts);
    expect(written).toBeTruthy();
    expect(rowsToWrite([changed], [existing({ focus_instruction: "new wording" })], opts)).toHaveLength(0);
  });
});
