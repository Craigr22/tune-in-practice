import { useEffect, useMemo, useRef, useState } from "react";
import { SONGS, SONG_REASONING, type Song } from "@/data/songs";
import { FOUNDATIONS } from "@/data/foundations";
import { STUDENTS, RECORDINGS } from "@/data/students";
import Tuner from "@/components/Tuner";

type View = "home" | "foundations" | "teacher" | "tuner";
type Tab = "warmup" | "drills" | "song" | "plan";

/* =====================================================================
   ROOT
===================================================================== */
const Index = () => {
  const [view, setView] = useState<View>("home");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [songs, setSongs] = useState<Song[]>(() => SONGS.map((s) => ({ ...s })));
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  const [foundationsState, setFoundationsState] = useState(() =>
    FOUNDATIONS.map((f) => ({ id: f.id, done: f.done }))
  );

  const navigateTo = (v: View) => {
    setView(v);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  const setRoleAndNav = (r: "student" | "teacher") => {
    setRole(r);
    navigateTo(r === "teacher" ? "teacher" : "home");
  };

  const openSong = (id: string) => {
    const song = songs.find((s) => s.id === id);
    if (!song) return;
    if (song.state === "locked") {
      alert(`🔒 ${song.title} is locked. Finish the previous track first — it builds the chords you need.`);
      return;
    }
    setOpenSongId(id);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  const closeSong = () => {
    setOpenSongId(null);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  const logPlay = (songId: string) => {
    setSongs((prev) => {
      const next = prev.map((s) => ({ ...s, history: s.history ? [...s.history] : [] }));
      const song = next.find((s) => s.id === songId);
      if (!song) return prev;
      song.playsToday = (song.playsToday || 0) + 1;
      if (song.history && song.history.length) {
        song.history[song.history.length - 1] = song.playsToday;
      }
      const justApproved = song.playsToday === song.dailyTarget;
      if (justApproved) {
        song.approvedDays = (song.approvedDays || 0) + 1;
        if (song.targetApprovals && song.approvedDays >= song.targetApprovals) {
          song.state = "mastered";
        }
        setTimeout(() => {
          const msg =
            song.state === "mastered"
              ? `🎉 You mastered ${song.title}! ${song.targetApprovals} approved days complete.`
              : `✓ Day approved! ${song.approvedDays} of ${song.targetApprovals} approved days for ${song.title}.`;
          alert(msg);
        }, 200);
      }
      return next;
    });
  };

  const markFoundationsComplete = () => {
    setFoundationsState((s) =>
      s.map((f) => (f.id === "transitions" ? { ...f, done: true } : f))
    );
    alert("Foundations complete. You're ready for Song 1: Piyu Bole.");
    navigateTo("home");
  };

  // Esc to close song
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openSongId) closeSong();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSongId]);

  const openSongObj = openSongId ? songs.find((s) => s.id === openSongId) ?? null : null;

  const songOpen = !!openSongObj;
  return (
    <>
      <TopNav view={view} role={role} navigateTo={navigateTo} setRole={setRoleAndNav} />
      <main id="app">
        <section className={`view view-home ${view === "home" && !songOpen ? "active" : ""}`}>
          <HomeView songs={songs} foundationsState={foundationsState} navigateTo={navigateTo} openSong={openSong} />
        </section>
        <section className={`view view-foundations ${view === "foundations" && !songOpen ? "active" : ""}`}>
          <FoundationsView
            foundationsState={foundationsState}
            navigateTo={navigateTo}
            markComplete={markFoundationsComplete}
          />
        </section>
        <section className={`view view-teacher ${view === "teacher" && !songOpen ? "active" : ""}`}>
          <TeacherView />
        </section>
        <section className={`view view-tuner ${view === "tuner" && !songOpen ? "active" : ""}`}>
          <Tuner />
        </section>
        {openSongObj && (
          <SongOverlay song={openSongObj} close={closeSong} logPlay={logPlay} />
        )}
      </main>
    </>
  );
};

/* =====================================================================
   TOP NAV
===================================================================== */
const TopNav = ({
  view, role, navigateTo, setRole,
}: { view: View; role: "student" | "teacher"; navigateTo: (v: View) => void; setRole: (r: "student" | "teacher") => void }) => (
  <nav className="topnav">
    <div className="brand">
      <span className="dot"></span>bam <span className="uku">Ukulele · Sem 1</span>
    </div>
    <div className="nav-spacer"></div>
    <div className="nav-links">
      <a className={`nav-link ${view === "home" ? "active" : ""}`} onClick={() => navigateTo("home")}>Course</a>
      <a className={`nav-link ${view === "foundations" ? "active" : ""}`} onClick={() => navigateTo("foundations")}>Foundations</a>
      <a className={`nav-link ${view === "tuner" ? "active" : ""}`} onClick={() => navigateTo("tuner")}>Tuner</a>
      <a className="nav-link">Library</a>
      <a className="nav-link">My class</a>
    </div>
    <div className="streak-chip">🔥 12-day streak</div>
    <div className="role-toggle">
      <button className={`role-btn ${role === "student" ? "active" : ""}`} onClick={() => setRole("student")}>Student</button>
      <button className={`role-btn ${role === "teacher" ? "active" : ""}`} onClick={() => setRole("teacher")}>Teacher</button>
    </div>
  </nav>
);

/* =====================================================================
   HOME
===================================================================== */
const HomeView = ({
  songs, foundationsState, navigateTo, openSong,
}: { songs: Song[]; foundationsState: { id: string; done: boolean }[]; navigateTo: (v: View) => void; openSong: (id: string) => void }) => {
  const tracks = [
    { num: "Track I",  title: "First chords",    sub: "2–3 chords · simple downstrum", t: 1 as const, total: 2, done: 1.5, pct: 75 },
    { num: "Track II", title: "Adding minors",   sub: "4 chords · introduces Am, E7",  t: 2 as const, total: 2, done: 0,   pct: 0 },
    { num: "Track III",title: "Wider vocabulary",sub: "4–5 chords · syncopated strumming", t: 3 as const, total: 2, done: 0, pct: 0 },
    { num: "Track IV", title: "Em & beyond",     sub: "6+ chords · stretch territory", t: 4 as const, total: 2, done: 0,   pct: 0 },
  ];
  return (
    <div className="home">
      <header className="hero">
        <div className="hero-titlewrap">
          <div className="hero-eyebrow">Semester 1 · Ukulele · Cohort B-24</div>
          <h1 className="hero-title">Discover the music<br /><em>in you.</em></h1>
          <p className="hero-sub">Eight songs, eleven students, daily reps. A practice-first companion that meets you between Saturday classes — log a play after each run-through, hit your daily target, and approve the day.</p>
        </div>
        <div className="hero-stats">
          <div className="hero-stats-row">
            <div>
              <div className="hero-stat-num">3<span className="of">/11</span></div>
              <div className="hero-stat-lbl">Songs</div>
            </div>
            <div>
              <div className="hero-stat-num">12</div>
              <div className="hero-stat-lbl">Day streak</div>
            </div>
            <div>
              <div className="hero-stat-num">68%</div>
              <div className="hero-stat-lbl">Sem 1</div>
            </div>
          </div>
          <button className="practice-cta" onClick={() => openSong("sunshine")}>
            <div className="practice-cta-icon">▶</div>
            <div>
              <div>Continue: You Are My Sunshine</div>
              <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85, marginTop: 1 }}>2 of 4 plays today · 2 to go</div>
            </div>
            <div className="practice-cta-meta">Wed</div>
          </button>
        </div>
      </header>

      <div className="foundations-bar">
        <div>
          <div className="foundations-eyebrow">Before song 1 · about 25 minutes</div>
          <div className="foundations-title">
            Get the basics{" "}
            <em style={{ fontFamily: "var(--font-script)", fontWeight: 700, color: "var(--gold)", fontSize: "1.2em" }}>right.</em>
          </div>
          <div className="foundations-sub">
            Five micro-modules the book never includes: tuning, posture, reading a chord box, your first strum, and how to actually <em>switch</em> between chords.
          </div>
        </div>
        <div className="foundations-modules">
          {FOUNDATIONS.map((f) => {
            const done = foundationsState.find((x) => x.id === f.id)?.done;
            const label = f.title.replace(/^How to (the )?/i, "").replace(/^Read a /, "").replace(/^Tune your ukulele$/, "Tune");
            const compact: Record<string, string> = {
              hold: "Hold", tune: "Tune", "chord-box": "Chord box", "first-strum": "First strum", transitions: "Transitions",
            };
            return (
              <div key={f.id} className={`foundations-pill ${done ? "done" : "todo"}`}>
                {compact[f.id] ?? label}
              </div>
            );
          })}
          <button className="foundations-open-btn" onClick={() => navigateTo("foundations")}>Open →</button>
        </div>
      </div>

      {tracks.map((tr) => (
        <section className="track-section" key={tr.t}>
          <div className="track-head">
            <div className="track-num">{tr.num}</div>
            <div className="track-title">{tr.title}</div>
            <div className="track-sub">{tr.sub}</div>
            <div className="track-progress">
              <div className="track-progress-bar"><div className="track-progress-fill" style={{ width: `${tr.pct}%` }}></div></div>
              <span>{tr.done} / {tr.total}</span>
            </div>
          </div>
          <div className="song-grid">
            {songs.filter((s) => s.track === tr.t).map((s) => (
              <SongCard key={s.id} song={s} onOpen={() => openSong(s.id)} />
            ))}
          </div>
        </section>
      ))}

      <section className="track-section fingerstyle-track">
        <div className="track-head">
          <div className="track-num">Bonus</div>
          <div className="track-title">Fingerstyle</div>
          <div className="track-sub">A different skill — read tab, pluck strings individually</div>
          <div className="track-progress">
            <div className="track-progress-bar"><div className="track-progress-fill" style={{ width: "0%" }}></div></div>
            <span>0 / 4</span>
          </div>
        </div>
        <div className="song-grid">
          {songs.filter((s) => s.track === "fs").map((s) => (
            <SongCard key={s.id} song={s} onOpen={() => openSong(s.id)} />
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <div className="footer-brand">BAM Music · Semester 1 Ukulele Coursebook · Online Edition</div>
        <div>Next class: Saturday · 10:30 AM with Anjali</div>
      </footer>
    </div>
  );
};

const SongCard = ({ song, onOpen }: { song: Song; onOpen: () => void }) => {
  const stateClass = song.state || "";
  const lockBadge =
    song.state === "mastered" ? <span className="song-status-badge mastered">✓ Mastered</span> :
    song.state === "in-progress" ? <span className="song-status-badge progress">In progress</span> :
    song.state === "next" ? <span className="song-status-badge next">Up next</span> :
    song.state === "locked" ? <span className="song-status-badge locked">🔒 Locked</span> :
    song.state === "stretch" ? <span className="song-status-badge locked">Stretch</span> : null;

  if (song.fingerstyle) {
    return (
      <div className={`song-card ${stateClass}`} onClick={onOpen}>
        <div className="fingerstyle-tag">{song.isLesson ? "Lesson" : "Fingerstyle"}</div>
        <div className="song-card-head">
          <div className="song-num">{song.order || "·"}</div>
          <div className="song-info">
            <div className="song-title">{song.title}</div>
            <div className="song-artist">{song.artist}</div>
          </div>
        </div>
        {lockBadge}
        <div className="song-card-meta" style={{ marginTop: 14 }}>
          <span>{song.difficulty}</span>
          <span className="dot">·</span>
          <span>Tab notation</span>
        </div>
      </div>
    );
  }

  const dayInfo =
    song.state === "in-progress" ? <span><strong style={{ color: "var(--ink)" }}>{song.playsToday}/{song.dailyTarget}</strong> today</span> :
    song.state === "mastered" ? <span style={{ color: "var(--olive)", fontWeight: 600 }}>✓ {song.approvedDays} approved days</span> :
    <span>{song.difficulty}</span>;

  const progressPct = song.targetApprovals
    ? Math.min(100, Math.round(((song.approvedDays || 0) / song.targetApprovals) * 100))
    : 0;

  const progressMini =
    song.state === "in-progress" ? (
      <span className="progress-mini">
        <span className="song-progress-bar"><span className="song-progress-fill" style={{ width: `${progressPct}%` }}></span></span>
        {song.approvedDays}/{song.targetApprovals}
      </span>
    ) : song.state === "mastered" ? (
      <span className="progress-mini" style={{ color: "var(--olive)" }}>✓ Mastered</span>
    ) : null;

  return (
    <div className={`song-card ${stateClass}`} onClick={onOpen}>
      {lockBadge}
      <div className="song-card-head">
        <div className="song-num">{String(song.order).padStart(2, "0")}</div>
        <div className="song-info">
          <div className="song-title">{song.title}</div>
          <div className="song-artist">{song.artist}</div>
        </div>
      </div>
      <div className="chord-pills">
        {song.chords.map((c) => {
          let cls = "";
          if (song.newChord && (c === song.newChord || song.newChord.includes(c))) cls = "new";
          if (c === "Bb" || c === "Fm") cls = "hard";
          return <span key={c} className={`chord-pill ${cls}`}>{c}</span>;
        })}
      </div>
      <div className="song-card-meta">
        {dayInfo}
        <span className="dot">·</span>
        <span>{song.chords.length} chords</span>
        {progressMini}
      </div>
    </div>
  );
};

/* =====================================================================
   FOUNDATIONS VIEW
===================================================================== */
const FoundationsView = ({
  foundationsState, navigateTo, markComplete,
}: { foundationsState: { id: string; done: boolean }[]; navigateTo: (v: View) => void; markComplete: () => void }) => {
  const [activeId, setActiveId] = useState("hold");
  const active = FOUNDATIONS.find((f) => f.id === activeId)!;
  const moduleRef = useRef<HTMLDivElement>(null);

  // wire body actions
  useEffect(() => {
    const root = moduleRef.current;
    if (!root) return;
    const handler = (e: Event) => {
      const tgt = e.target as HTMLElement;
      const action = tgt.dataset?.action;
      if (action === "mark-complete") markComplete();
      if (action === "back-home") navigateTo("home");
    };
    root.addEventListener("click", handler);
    return () => root.removeEventListener("click", handler);
  }, [activeId, markComplete, navigateTo]);

  return (
    <div className="foundations-view">
      <a className="back-link" onClick={() => navigateTo("home")}>← Back to course</a>
      <h1 className="foundations-page-title">
        The <em style={{ fontFamily: "var(--font-script)", fontWeight: 700, color: "var(--gold-deep)", fontStyle: "normal" }}>basics</em>, first.
      </h1>
      <p className="foundations-page-sub">The five micro-modules that prevent 80% of week-1 dropouts. Do these once and your first song will feel possible.</p>

      <div className="foundations-grid">
        <nav className="foundations-nav">
          {FOUNDATIONS.map((f, i) => {
            const done = foundationsState.find((x) => x.id === f.id)?.done;
            return (
              <div
                key={f.id}
                className={`foundations-nav-item ${activeId === f.id ? "active" : ""} ${done ? "done" : ""}`}
                onClick={() => { setActiveId(f.id); window.scrollTo({ top: 200, behavior: "smooth" }); }}
              >
                <div className="foundations-nav-num">{i + 1}</div>
                <div>{f.title}</div>
              </div>
            );
          })}
        </nav>
        <div className="foundations-module" ref={moduleRef}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--gold-deep)", marginBottom: 10 }}>
            {active.eyebrow}
          </div>
          <h2>{active.title}</h2>
          <div dangerouslySetInnerHTML={{ __html: active.body }} />
        </div>
      </div>
    </div>
  );
};

/* =====================================================================
   TEACHER VIEW
===================================================================== */
const TeacherView = () => {
  // Stable per-recording bar heights
  const recordingBars = useMemo(
    () =>
      RECORDINGS.map((r) =>
        Array.from({ length: r.bars }, (_, i) => {
          // deterministic pseudo-random for stable rendering
          const seed = (r.name.charCodeAt(0) + i * 7) % 20;
          return 4 + seed;
        })
      ),
    []
  );

  return (
    <div className="teacher-view">
      <header className="teacher-header">
        <div>
          <div className="teacher-eyebrow">Cohort B-24 · Saturday class · 10:30 AM</div>
          <h1 className="teacher-title">
            Tomorrow's class,{" "}
            <em style={{ fontFamily: "var(--font-script)", fontWeight: 700, color: "var(--gold-deep)", fontStyle: "normal" }}>already prepared.</em>
          </h1>
        </div>
        <div className="teacher-summary">
          <div className="teacher-summary-stat"><div className="num">8</div><div className="lbl">Students</div></div>
          <div className="teacher-summary-stat"><div className="num">4</div><div className="lbl">Approved today</div></div>
          <div className="teacher-summary-stat"><div className="num">2</div><div className="lbl">Need attn</div></div>
          <div className="teacher-summary-stat"><div className="num">14</div><div className="lbl">Recordings</div></div>
        </div>
      </header>

      <div className="teacher-class">
        <div className="teacher-class-head">
          <div>
            <div className="teacher-class-title">This week's roster</div>
            <div className="teacher-class-meta">Activity since last Saturday's class</div>
          </div>
          <button className="next-class-cta">Generate class plan →</button>
        </div>
        <div>
          {STUDENTS.map((s) => {
            const approvalPct = Math.round((s.approvedDays / s.targetApprovals) * 100);
            const isApprovedToday = s.todayPlays >= s.dailyTarget;
            return (
              <div className="student-row" key={s.name}>
                <div className="student-name-cell">
                  <div className={`student-avatar ${s.avatarType}`}>{s.avatar}</div>
                  <div>
                    <div className="student-name">{s.name}</div>
                    <div className="student-meta">{s.joined}</div>
                  </div>
                </div>
                <div className="student-progress">
                  <div className="student-progress-bar">
                    <div className={`student-progress-fill ${s.barColor}`} style={{ width: `${approvalPct}%` }}></div>
                  </div>
                  <span className="student-progress-text">{s.approvedDays}/{s.targetApprovals}</span>
                </div>
                <div className="student-current">
                  <div className="song">{s.current}</div>
                  <div
                    className="day"
                    style={{
                      color: isApprovedToday ? "var(--olive)" : s.todayPlays > 0 ? "var(--gold-deep)" : "var(--ink-faint)",
                      fontWeight: 600,
                    }}
                  >
                    {isApprovedToday ? "✓ " : ""}{s.todayPlays}/{s.dailyTarget} today
                  </div>
                </div>
                <div className="student-streak">
                  <span className="num">{s.streak}</span> day streak
                </div>
                <div><span className={`flag-pill ${s.flag}`}>{s.flagText}</span></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="recordings-strip">
        <h3>Recordings to review · 6 new</h3>
        <p className="sub">Students recorded these in the last 3 days. Hearts back to the student before tomorrow.</p>
        <div className="recordings-row">
          {RECORDINGS.map((r, idx) => (
            <div className="recording-card" key={`${r.name}-${idx}`}>
              <div className="recording-card-head">
                <div className="student-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                  {r.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="recording-card-name">{r.name}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>{r.days}</div>
                </div>
              </div>
              <div className="recording-card-song">{r.song}</div>
              <div className="audio-bars">
                {recordingBars[idx].map((h, i) => (
                  <div key={i} className="audio-bar" style={{ height: h }}></div>
                ))}
              </div>
              <div className="recording-card-actions">
                <button className="recording-action-btn primary">▶ Listen</button>
                <button className="recording-action-btn">❤️ Heart</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* =====================================================================
   SONG OVERLAY (phone)
===================================================================== */
const SongOverlay = ({ song, close, logPlay }: { song: Song; close: () => void; logPlay: (id: string) => void }) => {
  const [tab, setTab] = useState<Tab>("warmup");

  // reset tab when song changes
  useEffect(() => { setTab("warmup"); }, [song.id]);

  return (
    <div className="song-page" id="songOverlay">
      <div className="song-page-content">
        <div className="bam-phone bam-phone--page">
          <SongHeader song={song} close={close} />
          <div className="bam-tabs">
            {(["warmup", "drills", "song", "plan"] as Tab[]).map((t) => (
              <div key={t} className={`bam-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                <span className="ic">{ { warmup: "🎯", drills: "🔁", song: "🎵", plan: "📅" }[t] }</span>
                {{ warmup: "Warm Up", drills: "Drills", song: "Song", plan: "Plan" }[t]}
              </div>
            ))}
          </div>
          <div className="bam-content bam-content--page">
            {tab === "warmup" && <WarmupTab song={song} setTab={setTab} />}
            {tab === "drills" && <DrillsTab song={song} />}
            {tab === "song" && <SongTab song={song} />}
            {tab === "plan" && <PlanTab song={song} logPlay={logPlay} />}
          </div>
        </div>
        <SidePanel song={song} />
      </div>
    </div>
  );
};

const SongHeader = ({ song, close }: { song: Song; close: () => void }) => {
  const dayBadge =
    song.state === "mastered" ? <div className="bam-day-badge" style={{ background: "var(--olive)", color: "var(--paper)" }}>✓ Done</div> :
    song.state === "in-progress" ? <div className="bam-day-badge">{song.playsToday}/{song.dailyTarget} today</div> :
    <div className="bam-day-badge" style={{ background: "var(--paper-warm)", color: "var(--ink-soft)" }}>New</div>;

  const subline = song.fingerstyle
    ? `${song.difficulty} · Fingerstyle`
    : `${song.difficulty} · ${song.chords.length} chord${song.chords.length === 1 ? "" : "s"} · ${song.targetApprovals || 7} approved days to master`;

  const progressPct = song.state === "mastered"
    ? 100
    : song.targetApprovals ? Math.min(100, Math.round(((song.approvedDays || 0) / song.targetApprovals) * 100)) : 0;

  return (
    <div className="bam-header">
      <div className="bam-header-row">
        <div className="bam-back" onClick={close}>←</div>
        <div>
          <div className="bam-song-title">{song.title}</div>
          <div className="bam-song-meta">{subline}</div>
        </div>
        {dayBadge}
      </div>
      <div className="bam-progress-bar"><div className="bam-progress-fill" style={{ width: `${progressPct}%` }}></div></div>
      <div className="bam-progress-label">
        {song.state === "mastered" ? <><span>Mastered</span><span>🔥 12-day streak</span></> :
         song.state === "in-progress" ? <><span>{song.approvedDays} of {song.targetApprovals} approved days</span><span>🔥 12-day streak</span></> :
         <><span>Not started</span><span>🔥 12-day streak</span></>}
      </div>
    </div>
  );
};

const getChordState = (song: Song, chord: string, idx: number): { cls: string; stat: string } => {
  if (song.state === "mastered") return { cls: "ok", stat: "✓ clean" };
  if (song.state === "in-progress") {
    if (chord === song.newChord) return { cls: "work", stat: "getting there" };
    return idx === 0 ? { cls: "ok", stat: "✓ clean" } : { cls: "ok", stat: "✓ clean" };
  }
  if (chord === song.newChord || (song.newChord && song.newChord.includes(chord))) {
    return { cls: "new", stat: "new chord" };
  }
  return { cls: "ok", stat: "✓ ready" };
};

const WarmupTab = ({ song, setTab }: { song: Song; setTab: (t: Tab) => void }) => {
  if (song.fingerstyle) {
    return (
      <>
        <div className="bam-card">
          <div className="bam-card-title">Hands warm? <span className="pill">2 min</span></div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.55 }}>
            Fingerstyle uses individual fingers (thumb, index, middle, ring) instead of a strum. Run through finger exercises 1–3 from the foundations module before starting.
          </div>
        </div>
        <div className="bam-card">
          <div className="bam-card-title">Tab refresher <span className="pill">if needed</span></div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.55 }}>
            Numbers on lines = which fret to press. Top line = A string, bottom line = G string.
          </div>
        </div>
        <button className="bam-cta" onClick={() => setTab("drills")}>Open the tab →</button>
      </>
    );
  }

  return (
    <>
      <div className="bam-card">
        <div className="bam-card-title">Tuner check <span className="pill">30 sec</span></div>
        <div className="mini-tuner-row">
          <div className="mini-tuner-cell ok"><div className="note">G</div><div className="stat">in tune</div></div>
          <div className="mini-tuner-cell ok"><div className="note">C</div><div className="stat">in tune</div></div>
          <div className={`mini-tuner-cell ${song.id === "sunshine" ? "warn" : "ok"}`}>
            <div className="note">E</div><div className="stat">{song.id === "sunshine" ? "flat -8¢" : "in tune"}</div>
          </div>
          <div className="mini-tuner-cell ok"><div className="note">A</div><div className="stat">in tune</div></div>
        </div>
      </div>

      <div className="bam-card">
        <div className="bam-card-title">Chord check <span className="pill">{song.chords.length} chord{song.chords.length === 1 ? "" : "s"}</span></div>
        <div className="chord-row">
          {song.chords.map((c, i) => {
            const s = getChordState(song, c, i);
            return (
              <div key={c} className={`chord-mini ${s.cls}`}>
                <div className="lbl">{c}</div>
                <div className="stat">{s.stat}</div>
              </div>
            );
          })}
        </div>
        {song.newChord && (
          <div style={{ fontSize: 11, color: "var(--terracotta)", marginTop: 10, fontWeight: 600 }}>
            ⚡ New: {song.newChord} — tap it for the fingering video.
          </div>
        )}
      </div>

      <button className="bam-cta" onClick={() => setTab("drills")}>Start today's drills →</button>
    </>
  );
};

const DrillCard = ({ title, beatCount, meta }: { title: string; beatCount: number; meta: React.ReactNode }) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, []);

  const toggle = () => {
    if (playing) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      setPlaying(false);
      setActiveIdx(null);
      return;
    }
    setPlaying(true);
    let i = 0;
    intervalRef.current = window.setInterval(() => {
      setActiveIdx(i);
      i = (i + 1) % beatCount;
    }, 375);
  };

  return (
    <div className="drill">
      <div className="drill-head">
        <div className="drill-title">{title}</div>
        <button className={`drill-play ${playing ? "playing" : ""}`} onClick={toggle} aria-label="Toggle drill">
          {playing ? "■" : "▶"}
        </button>
      </div>
      <div className="beat-row">
        {Array.from({ length: beatCount }, (_, i) => (
          <div key={i} className={`beat ${i % 4 === 0 ? "down" : ""} ${activeIdx === i ? "active" : ""}`}></div>
        ))}
      </div>
      <div className="drill-meta">{meta}</div>
    </div>
  );
};

const BpmPills = ({ bpms, activeBpm }: { bpms: number[]; activeBpm: number }) => {
  const [active, setActive] = useState(activeBpm);
  return (
    <div className="bpm-pills">
      {bpms.map((b) => (
        <div key={b} className={`bpm-pill ${active === b ? "active" : ""}`} onClick={() => setActive(b)}>{b}</div>
      ))}
    </div>
  );
};

const DrillsTab = ({ song }: { song: Song }) => {
  if (song.fingerstyle) {
    return (
      <>
        <div className="bam-card" style={{ background: "var(--gold-bg)", borderColor: "var(--gold)" }}>
          <div style={{ fontSize: 11, color: "var(--gold-deep)", fontWeight: 700, lineHeight: 1.5 }}>
            <strong>Fingerstyle drill:</strong> right-hand pattern first, then add notes. The rhythm is harder than the fingering.
          </div>
        </div>
        <div className="bam-card">
          <div className="bam-card-title">Right-hand pattern <span className="pill">5 min</span></div>
          <DrillCard
            title="Thumb · Index · Middle · Ring"
            beatCount={4}
            meta={<>
              <span>One finger per string · slow & even</span>
              <BpmPills bpms={[60, 76, 90]} activeBpm={60} />
            </>}
          />
        </div>
      </>
    );
  }

  const why = (song.state === "in-progress" || song.state === "next") && (
    <div className="bam-card" style={{ background: "var(--gold-bg)", borderColor: "var(--gold-soft)" }}>
      <div style={{ fontSize: 11, color: "var(--gold-deep)", fontWeight: 600, lineHeight: 1.5 }}>
        <strong>Why drills?</strong> The hardest part isn't forming the chords — it's switching in time. 5 minutes of this beats 30 minutes of song attempts.
      </div>
    </div>
  );

  const strumBeats = (song.strum || "").replace(/[\s\-·•]/g, "").split("");

  return (
    <>
      {why}
      <div className="bam-card">
        <div className="bam-card-title">Chord transitions <span className="pill">5 min</span></div>
        {(song.keyDrills || []).map((d, i) => {
          const score = d.score > 0
            ? <><span>Yesterday: {d.score}/{d.total}</span><span style={{ color: "var(--olive)", fontWeight: 700 }}>+{Math.floor(d.total * 0.2)} today</span></>
            : <><span>First time today</span><span style={{ color: "var(--ink-faint)" }}>starting</span></>;
          return (
            <DrillCard
              key={i}
              title={`${d.name} · ${d.desc}`}
              beatCount={8}
              meta={<>
                {score}
                <BpmPills bpms={[60, 80, 100]} activeBpm={d.bpm} />
              </>}
            />
          );
        })}
      </div>
      <div className="bam-card">
        <div className="bam-card-title">Strum pattern <span className="pill">{song.strum}</span></div>
        <div className="beat-row" style={{ height: 36 }}>
          {strumBeats.map((s, i) => (
            <div key={i} className={`beat ${s === "D" ? "down" : ""}`} style={{ height: 30, borderRadius: 5 }}></div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.5 }}>
          {song.strumNote || "Steady downstrums."}
        </div>
      </div>
    </>
  );
};

const SongTab = ({ song }: { song: Song }) => {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<"50%" | "75%" | "100%">("75%");
  const [loop, setLoop] = useState("Whole song");

  if (song.fingerstyle) {
    return (
      <>
        <div className="song-player">
          <div className="player-controls">
            <button className="player-btn" onClick={() => setPlaying((p) => !p)}>{playing ? "■" : "▶"}</button>
            <div className="player-info">
              <div className="nm">{song.title}</div>
              <div className="sub">Tab notation · play-along reference</div>
            </div>
          </div>
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>SPEED</div>
          <div className="speed-row">
            {(["50%", "75%", "100%"] as const).map((s) => (
              <div key={s} className={`speed-pill ${speed === s ? "active" : ""}`} onClick={() => setSpeed(s)}>{s}</div>
            ))}
          </div>
          <div className="progression">
            <div className="progression-label">Bar 1 · current</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, background: "rgba(0,0,0,0.2)", padding: 8, borderRadius: 6, lineHeight: 1.7 }}>
              A|—0—3—2—0———7—5———<br />
              E|—0—————————————<br />
              C|———————————————<br />
              G|———————————————
            </div>
          </div>
        </div>
        <div className="bam-card" style={{ marginTop: 10 }}>
          <div className="bam-card-title">Today's goal</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            Play first 4 bars cleanly at 75% speed. Don't worry about timing yet — clean notes first, rhythm later.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="song-player">
        <div className="player-controls">
          <button className="player-btn" onClick={() => setPlaying((p) => !p)}>{playing ? "■" : "▶"}</button>
          <div className="player-info">
            <div className="nm">{song.title}</div>
            <div className="sub">{song.artist} · {song.bpm || 80} BPM</div>
          </div>
        </div>
        <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>SPEED</div>
        <div className="speed-row">
          {(["50%", "75%", "100%"] as const).map((s) => (
            <div key={s} className={`speed-pill ${speed === s ? "active" : ""}`} onClick={() => setSpeed(s)}>{s}</div>
          ))}
        </div>
        <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>LOOP</div>
        <div className="loop-row">
          <div className={`loop-pill ${loop === "Whole song" ? "active" : ""}`} onClick={() => setLoop("Whole song")}>Whole song</div>
          {(song.sections || []).map((s) => (
            <div key={s.name} className={`loop-pill ${loop === s.name ? "active" : ""}`} onClick={() => setLoop(s.name)}>{s.name}</div>
          ))}
        </div>
        <div className="progression">
          <div className="progression-label">Chord progression · timeline</div>
          {(song.sections || []).map((sec, secIdx) => {
            const isCurrent = secIdx === 0 && song.state === "in-progress";
            return (
              <div key={sec.name}>
                <div className="bar-section">{sec.name}</div>
                <div className="bar-row">
                  {sec.bars.map((b, i) => {
                    const isCurrentBar = isCurrent && i === 2;
                    const cls = isCurrentBar ? "current" : b === "—" ? "muted" : "";
                    return <div key={i} className={`bar ${cls}`}>{b === "—" ? "·" : b}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        className="stuck-btn"
        onClick={() => alert("Common issues:\n\n• Chord buzzing? Press just behind the fret.\n• Strum feels rushed? Drop to 50% speed.\n• Lost the count? Watch the rhythm video.\n• Sore fingertips? See Day 3 note in Plan.")}
      >
        🤔 I'm stuck — show me what's wrong
      </button>

      <div className="bam-card" style={{ marginTop: 10 }}>
        <div className="bam-card-title">Today's goal</div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
          {song.state === "in-progress"
            ? "Play Verse 1 at 75% speed without stopping. Record it when ready — your teacher sees it before Saturday."
            : "Get familiar with the chord progression. Don't try to play along yet."}
        </div>
        <button className="bam-cta bam-cta-gold" style={{ marginTop: 10 }}>🎤 Record my attempt</button>
      </div>
    </>
  );
};

const PlanTab = ({ song, logPlay }: { song: Song; logPlay: (id: string) => void }) => {
  if (song.fingerstyle) {
    return (
      <>
        <div className="bam-card streak-card">
          <div className="streak-row">
            <div className="streak-num">🎼</div>
            <div className="streak-lbl">
              <strong style={{ color: "var(--ink)" }}>Fingerstyle pace</strong><br />
              1 play per day = approved. Practice when you want a break from strumming.
            </div>
          </div>
        </div>
        <div className="bam-card">
          <div className="bam-card-title">Suggested approach</div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.55 }}>
            <strong>Phase 1:</strong> Right-hand pattern only<br />
            <strong>Phase 2:</strong> First 4 bars clean<br />
            <strong>Phase 3:</strong> Full piece at 50% speed<br />
            <strong>Phase 4:</strong> Full speed + record
          </div>
        </div>
      </>
    );
  }

  const target = song.dailyTarget || 4;
  const playsToday = song.playsToday || 0;
  const approved = song.approvedDays || 0;
  const totalToMaster = song.targetApprovals || 7;
  const history = song.history || [];

  const isApprovedToday = playsToday >= target;
  const playsToGo = Math.max(0, target - playsToday);

  return (
    <>
      <div className={`today-card ${isApprovedToday ? "approved" : ""}`}>
        <div className="today-card-head">
          <div className="lbl">Today</div>
          {isApprovedToday
            ? <span className="approved-tag">✓ Approved</span>
            : <span className="togo-tag">{playsToGo} to go</span>}
        </div>
        <div className="play-dots-row">
          {Array.from({ length: target }, (_, i) => {
            const done = i < playsToday;
            return (
              <div key={i} className={`play-dot ${done ? "done" : ""}`}>
                <span className="num">{i + 1}</span>
              </div>
            );
          })}
        </div>
        <div className="today-count-text">
          {isApprovedToday
            ? <><span className="big">{playsToday}</span> / {target} plays · target met</>
            : <><span className="big">{playsToday}</span> of {target} plays today</>}
        </div>
        {song.state === "mastered" ? (
          <button className="log-play-btn" disabled><span className="plus">✓</span>Mastered — practice anytime</button>
        ) : isApprovedToday ? (
          <button className="log-play-btn" onClick={() => logPlay(song.id)}><span className="plus">+</span>Log a bonus play</button>
        ) : (
          <button className="log-play-btn" onClick={() => logPlay(song.id)}><span className="plus">+</span>Log a play</button>
        )}
      </div>

      {song.state === "mastered" ? (
        <div className="bam-card streak-card">
          <div className="streak-row">
            <div className="streak-num">✓</div>
            <div className="streak-lbl">
              <strong style={{ color: "var(--ink)" }}>Mastered</strong><br />
              {approved} approved days. This song is in your library.
            </div>
          </div>
        </div>
      ) : (
        <div className="bam-card">
          <div className="bam-card-title">Approval streak <span className="pill">{approved}/{totalToMaster}</span></div>
          <div className="approval-dots">
            {Array.from({ length: totalToMaster }, (_, i) => {
              const done = i < approved;
              return <div key={i} className={`approval-dot ${done ? "done" : ""}`}><span className="num">{i + 1}</span></div>;
            })}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", textAlign: "center", lineHeight: 1.5 }}>
            {approved === 0
              ? `Hit your daily target ${totalToMaster} days to master this song.`
              : approved >= totalToMaster - 1
              ? "One more approved day and this song is yours."
              : `${totalToMaster - approved} more approved days to mastery.`}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bam-card">
          <div className="bam-card-title">Last 14 days</div>
          <div className="history-grid">
            {history.map((plays, i) => {
              const isToday = i === history.length - 1;
              let cls = "missed";
              if (plays >= target) cls = "approved";
              else if (plays > 0) cls = "partial";
              return <div key={i} className={`history-cell ${cls} ${isToday ? "today" : ""}`} title={`${plays} plays`}></div>;
            })}
          </div>
          <div className="history-legend">
            <span><span className="history-legend-swatch" style={{ background: "var(--gold)" }}></span>Approved</span>
            <span><span className="history-legend-swatch" style={{ background: "var(--gold-soft)" }}></span>Partial</span>
            <span><span className="history-legend-swatch" style={{ background: "var(--paper-cool)", border: "1px dashed var(--border-strong)" }}></span>No practice</span>
          </div>
        </div>
      )}

      {approved >= 1 && approved <= 3 && song.state === "in-progress" && (
        <div className="bam-card">
          <div className="bam-card-title">Sore fingers? <span className="pill">normal</span></div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.55 }}>
            Early days are when fingertips hurt most. This passes by approved-day 5 as your skin toughens. Take 5-min breaks, keep practicing — pain here is a sign you're doing it <em>right</em>.
          </div>
        </div>
      )}

      <div className="bam-card" style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
        <div className="bam-card-title">📚 Saturday class preview</div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.55 }}>
          Your teacher sees today's plays before class.{" "}
          {song.newChord
            ? <>Bring questions about <strong>{song.newChord}</strong> — it's the new chord here.</>
            : "You have time for revision questions."}
        </div>
      </div>
    </>
  );
};

const SidePanel = ({ song }: { song: Song }) => (
  <div className="song-side-panel">
    <div className="side-eyebrow">{song.fingerstyle ? "Fingerstyle bonus" : `Track ${song.track} · #${song.order}`}</div>
    <div className="side-title">{song.title}</div>
    <div className="side-artist">{song.artist}</div>

    <div className="side-section">
      <h4>At a glance</h4>
      <div className="side-detail-row"><span className="label">Difficulty</span><span className="value">{song.difficulty}</span></div>
      {song.chords.length > 0 && (
        <div className="side-detail-row"><span className="label">Chords</span><span className="value">{song.chords.join(" · ")}</span></div>
      )}
      {song.newChord && (
        <div className="side-detail-row"><span className="label">New chord</span><span className="value" style={{ color: "var(--terracotta)" }}>{song.newChord}</span></div>
      )}
      {song.strum && (
        <div className="side-detail-row"><span className="label">Strum</span><span className="value" style={{ fontFamily: "var(--font-body)", fontSize: 12 }}>{song.strum}</span></div>
      )}
      {song.bpm && (
        <div className="side-detail-row"><span className="label">Tempo</span><span className="value">{song.bpm} BPM</span></div>
      )}
      <div className="side-detail-row">
        <span className="label">{song.fingerstyle ? "Pace" : "Daily target"}</span>
        <span className="value">{song.fingerstyle ? "1 play/day" : `${song.dailyTarget || 4} plays/day`}</span>
      </div>
      {song.targetApprovals && (
        <div className="side-detail-row"><span className="label">Mastery</span><span className="value">{song.targetApprovals} approved days</span></div>
      )}
    </div>

    {song.sections && (
      <div className="side-section">
        <h4>Structure</h4>
        {song.sections.map((s) => (
          <div key={s.name} className="side-detail-row">
            <span className="label">{s.name}</span><span className="value">{s.bars.length} bars</span>
          </div>
        ))}
      </div>
    )}

    <div className="side-section">
      <h4>Why this song here</h4>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, fontFamily: "var(--font-display)", fontWeight: 400 }}>
        {SONG_REASONING[song.id] || ""}
      </p>
    </div>

    <div className="side-close">Use the back arrow to return to the course.</div>
  </div>
);

export default Index;
