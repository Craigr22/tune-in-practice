import { useNavigate } from "react-router-dom";
import { FOUNDATIONS } from "@/data/foundations";
import { useSongs } from "@/hooks/useSongs";
import SongCard from "@/components/shared/SongCard";

const Home = () => {
  const navigate = useNavigate();
  const { songs, foundationsState, openSong } = useSongs();

  const tracks = [
    { num: "Track I",  title: "First chords",    sub: "2–3 chords · simple downstrum", t: 1 as const, total: 2, done: 1.5, pct: 75 },
    { num: "Track II", title: "Adding minors",   sub: "4 chords · introduces Am, E7",  t: 2 as const, total: 2, done: 0,   pct: 0 },
    { num: "Track III",title: "Wider vocabulary",sub: "4–5 chords · syncopated strumming", t: 3 as const, total: 2, done: 0, pct: 0 },
    { num: "Track IV", title: "Em & beyond",     sub: "6+ chords · stretch territory", t: 4 as const, total: 2, done: 0,   pct: 0 },
  ];

  return (
    <section className="view view-home active">
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
            <button className="foundations-open-btn" onClick={() => navigate("/student/foundations")}>Open →</button>
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
    </section>
  );
};

export default Home;
