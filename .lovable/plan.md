## Heads up — scope check

This request references infrastructure from "Prompt 3.75" that doesn't exist in the project yet:
- No `src/lib/sessionTemplates.ts`, `src/lib/weeklyPlan.ts`, or `src/lib/sessionSegments.ts`
- No `weekly_plan_sessions` table in the database
- No `miniChallenges.ts` data file

So this is greenfield, not an extension. I'll build it end-to-end. It's a big change touching DB, generation logic, and the practice UI — please confirm before I migrate the DB.

---

## Plan

### 1. Weekly calendar widget on Today (`/student`)
Add a 7-day strip above the "Today" hero card in `src/routes/student/Home.tsx`:
- 🔴 Red dot = class day (derived from the student's batch `day_of_week`)
- 🔵 Blue dot = practice day (the 3 non-class days spaced with ~1 day rest between them, e.g. class Sat → practice Mon / Wed / Fri)
- Today highlighted; past days dimmed; completed practice days show a check
- Pure presentational; no schema change for this part

### 2. Schema migration — `weekly_plan_sessions`
New table per student per ISO week with one row per scheduled session (3 rows / week):
- `student_id`, `week_start` (date), `session_index` (0–2), `scheduled_date`
- `focus_song_id`, `focus_instruction`, `session_type` ('build' | 'flow' | 'stretch')
- `warmup_target_min`, `focus_target_min`, `bonus_target_min`
- `warmup_song_id` (nullable), `warmup_instruction`
- `bonus_type` enum ('callback_song' | 'mini_challenge' | 'jam' | 'foundation_refresh')
- `bonus_song_id` (nullable), `bonus_instruction`
- `warmup_completed`, `focus_completed`, `bonus_completed` (bool defaults false)
- `generated_at`, `completed_at` (nullable)
- RLS: student owns own rows; teacher reads via `is_teacher_of_student`; admin all

### 3. Static data + templates
- `src/lib/sessionTemplates.ts` — 3 session types (Build 20 / Flow 15 / Stretch 15) with target minutes
- `src/data/miniChallenges.ts` — ~15 challenges tagged with `prerequisite_min_week`

### 4. Deterministic generation — `src/lib/sessionSegments.ts`
Pure functions taking `{ progress, logs, foundationsSeen, currentSongId, weekNumber }`:
- `generateWarmup()` — pool = songs with badge ≥ 3, exclude focus + last-2-session warmups, 2× weight if not practiced in 10d, fallback to "Quick chord review" with 2 known chords, or "Play any chord — 30s" if empty. Skip song if no audio in `SONG_AUDIO`.
- `generateBonus()` — weighted random (50/20/15/15), never same type 2 sessions in a row, per-type pool rules exactly as spec.

### 5. Weekly plan orchestration — `src/lib/weeklyPlan.ts` + hook
- `generateWeekFor(studentId)` — picks 3 dates around class day, calls warmup/bonus generators, upserts into `weekly_plan_sessions`
- `useWeeklyPlan()` hook — fetches current week, triggers regeneration of warmup/bonus if `generated_at` is >7 days old before student opens the session

### 6. Update `src/routes/student/SongDetail.tsx`
When entered via "Do now" from the weekly plan (carry plan session id in route state):
- Top: 3-segment progress bar with target minutes
- Card 1 Warm-up · Card 2 Focus (current content) · Card 3 Bonus (renders by `bonus_type`)
- Per-segment "Done" / "Skip" → updates `*_completed` flags
- Existing post-practice check-in fires after all 3, rating applies to focus

Free-practice path keeps current behavior with opt-in "Suggest warm-up / bonus" buttons that call the same generators inline (no DB write).

### 7. Journey expansion
Update `src/routes/student/Journey.tsx` to render completed weekly sessions as a diary entry with the 3 segments listed (Warm-up ✓ / Focus ✓ rated / Bonus ✓). Existing song-map tier view stays.

---

## Notes / questions
- This is ~6–8 new files, 1 migration, 3 UI rewrites. I estimate ~3 large edit cycles.
- Want me to proceed with the migration as the first step? Or split delivery — e.g. **ship the calendar widget first** (small, instant value) and tackle the segment system in a follow-up?

Reply "go" to do it all, "calendar first" to ship only the weekly strip now, or tell me what to trim.