
# Admin Scheduling + Users/Enrollments

Reusing the existing `batches`, `sessions`, `enrollments`, `teachers`, `students`, and `user_roles` tables. No `profiles` or `class_sessions` tables will be created.

## Prompt 1 — Month calendar + batch creation

### Database (one migration)
- Add a Postgres function `public.generate_sessions_for_batch(batch_id uuid)`:
  - Reads `day_of_week`, `start_time`, `semester_start`, `semester_end` from `batches`.
  - If `semester_end` is null, uses `semester_start + 12 weeks`.
  - Inserts a row into `sessions` for every matching weekday in that range with `status = 'upcoming'`. Skips dates that already exist for that batch.
- Add a trigger on `batches` AFTER INSERT that calls the function so new batches auto-generate sessions.
- `sessions.status` enum already includes `cancelled` — no change needed. RLS already restricts writes to admin/teacher; reads work for the involved roles.

### Frontend
- Install `react-big-calendar` + `date-fns`.
- New route `/admin/schedule` (admin-only — redirect to `/` if `role !== "admin"`).
- Add a "Schedule" link to the admin nav in `AppShell.tsx`.
- Page contents:
  - Month view calendar showing every `sessions` row for the visible month, joined with `batches` (title from `batches` — we'll use `instrument name + teacher name` as the title since `batches` has no title column; see Technical notes).
  - Cancelled sessions render greyed out (muted bg, line-through).
  - "New Batch" button opens a dialog with: title, teacher dropdown (from `teachers`), instrument dropdown (from `instruments`, required by existing schema), location (from `locations`, required), day of week, start time, duration (min), start date, optional end date.
  - On submit: insert into `batches`; trigger auto-creates sessions; invalidate queries.
  - Clicking an event opens a small popover with "Cancel this session" → updates that single `sessions` row to `status='cancelled'`.

## Prompt 2 — Users + enrollments

### Database (second migration)
- `enrollments` already exists with `(student_id, batch_id, status, enrolled_on)`. Add a unique constraint on `(student_id, batch_id)` if not present.
- No new role table — roles live in `user_roles`. Role changes will upsert/delete rows there.

### Frontend
- New route `/admin/users` (admin-only):
  - Lists every auth user that has a row in `user_roles` (joined with `teachers.email` / `students.email` / `students.name` when available; fall back to user id).
  - Each row: name, email, role dropdown (admin/teacher/student). Changing the dropdown deletes the old `user_roles` row and inserts the new one for that user.
  - Add "Users" link to admin nav.
- Batch detail (new): clicking a batch on the calendar (or a "Manage" button on the event popover) opens a dialog showing:
  - Enrolled students list (from `enrollments` joined with `students`), each with a Remove button (`DELETE FROM enrollments`).
  - "Enroll student" dropdown listing `students` whose `user_id` has role `student` (or all active students) — selecting inserts a new `enrollments` row.

## Technical notes

- The existing `batches` table has no `title` column. We will display the title as `"{instrument} · {teacher name}"`. If you'd prefer a real title column, say so and I'll add it.
- The `batches` table requires `instrument_id` and `location_id` (NOT NULL). The New Batch form must include these — they aren't in your spec but the schema needs them. I'll seed reasonable defaults if only one location/instrument exists.
- `sessions.status` is an enum; existing values include `cancelled`, so single-session cancel works without schema changes.
- The generator function runs on the server in a trigger, so admins don't need to do anything after creating a batch.
- `react-big-calendar` will be styled to fit the existing dark theme via a small CSS override file.
- All new pages gate on `role === "admin"` from `useAuth`.

## Files to create / edit
- Migration: trigger + `generate_sessions_for_batch` function; unique constraint on enrollments.
- `src/routes/admin/Schedule.tsx` (new) — calendar + dialogs.
- `src/routes/admin/Users.tsx` (new) — role management.
- `src/components/admin/NewBatchDialog.tsx`, `SessionPopover.tsx`, `BatchDetailDialog.tsx` (new).
- `src/hooks/useSessions.ts`, `useEnrollments.ts` (new).
- `src/App.tsx` — register routes.
- `src/components/layout/AppShell.tsx` — add Schedule + Users admin nav links.
- `src/index.css` — react-big-calendar theme overrides.
- `package.json` — add `react-big-calendar`.
