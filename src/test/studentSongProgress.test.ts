import { describe, expect, it } from "vitest";
import { SONGS } from "@/data/songs";
import {
  songWithStudentProgress,
  type PracticeLog,
  type SongProgress,
} from "@/hooks/useStudentProgress";

const today = new Date(2026, 8, 10, 12);
const log = (playedOn: string): PracticeLog => ({
  id: `${playedOn}-${Math.random()}`,
  student_id: "student-1",
  song_id: SONGS[0].id,
  played_on: playedOn,
  duration_min: 10,
  self_rated_badge: null,
  tuning_check_completed: true,
  check_in: "got_through",
  shared_with_teacher: true,
  recording_url: null,
  acknowledged_at: null,
  created_at: `${playedOn}T12:00:00Z`,
});

const progress = (teacherBadge: number | null): SongProgress => ({
  id: "progress-1",
  student_id: "student-1",
  song_id: SONGS[0].id,
  teacher_badge: teacherBadge,
  self_badge: null,
  last_practiced: null,
  last_updated: "2026-09-10T12:00:00Z",
});

describe("songWithStudentProgress", () => {
  it("does not inherit demo mastery from the catalog", () => {
    expect(SONGS[0].state).toBe("mastered");
    const song = songWithStudentProgress(SONGS[0], [], [], today);
    expect(song.state).toBe("next");
    expect(song.playsToday).toBe(0);
    expect(song.approvedDays).toBe(0);
  });

  it("derives today's practice and approved days from saved logs", () => {
    const logs = [
      ...Array.from({ length: 4 }, () => log("2026-09-10")),
      ...Array.from({ length: 4 }, () => log("2026-09-09")),
    ];
    const song = songWithStudentProgress(SONGS[0], logs, [], today);
    expect(song.state).toBe("in-progress");
    expect(song.playsToday).toBe(4);
    expect(song.approvedDays).toBe(2);
  });

  it("marks mastery only from the student's teacher badge", () => {
    expect(songWithStudentProgress(SONGS[0], [], [progress(4)], today).state).toBe("in-progress");
    expect(songWithStudentProgress(SONGS[0], [], [progress(5)], today).state).toBe("mastered");
  });
});
