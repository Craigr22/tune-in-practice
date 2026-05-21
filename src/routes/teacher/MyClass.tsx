import { useMemo, useState } from "react";
import { STUDENTS, RECORDINGS } from "@/data/students";

const MyClass = () => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const recordingBars = useMemo(
    () =>
      RECORDINGS.map((r) =>
        Array.from({ length: r.bars }, (_, i) => {
          const seed = (r.name.charCodeAt(0) + i * 7) % 20;
          return 4 + seed;
        })
      ),
    []
  );

  const attendanceLabels = ['Nov 16', 'Nov 23', 'Nov 30', 'Dec 7', 'Dec 14', 'Tomorrow'];

  return (
    <section className="view view-teacher active">
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
              <div className="teacher-class-meta">Click any student to see attendance & workload completion</div>
            </div>
            <button className="next-class-cta">Generate class plan →</button>
          </div>
          <div>
            {STUDENTS.map((s) => {
              const approvalPct = Math.round((s.approvedDays / s.targetApprovals) * 100);
              const isApprovedToday = s.todayPlays >= s.dailyTarget;
              const isOpen = expanded === s.name;
              const mastered = s.workload.filter(w => w.status === 'mastered').length;
              const inProg = s.workload.filter(w => w.status === 'in-progress').length;
              const overallPct = Math.round(
                s.workload.reduce((sum, w) => sum + w.completion, 0) / s.workload.length
              );
              const attended = s.attendance.filter(a => a === 'present' || a === 'late').length;
              const heldClasses = s.attendance.filter(a => a !== 'upcoming').length;
              return (
                <div key={s.name}>
                  <div
                    className={`student-row ${isOpen ? 'open' : ''}`}
                    onClick={() => setExpanded(isOpen ? null : s.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="student-name-cell">
                      <div className={`student-avatar ${s.avatarType}`}>{s.avatar}</div>
                      <div>
                        <div className="student-name">{s.name} <span className="row-caret">{isOpen ? '▾' : '▸'}</span></div>
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

                  {isOpen && (
                    <div className="student-detail">
                      <div className="student-detail-grid">
                        <div className="student-detail-card">
                          <div className="sd-card-head">
                            <span className="sd-card-title">Class attendance</span>
                            <span className="sd-card-meta">{attended}/{heldClasses} classes attended</span>
                          </div>
                          <div className="attendance-row">
                            {s.attendance.map((a, i) => (
                              <div key={i} className="attendance-cell">
                                <div className={`attendance-dot ${a}`} title={a}>
                                  {a === 'present' && '✓'}
                                  {a === 'late' && 'L'}
                                  {a === 'absent' && '✗'}
                                  {a === 'upcoming' && '·'}
                                </div>
                                <div className="attendance-label">{attendanceLabels[i]}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="student-detail-card">
                          <div className="sd-card-head">
                            <span className="sd-card-title">Semester workload completed</span>
                            <span className="sd-card-meta">{mastered} mastered · {inProg} in progress · {overallPct}% overall</span>
                          </div>
                          <div className="workload-list">
                            {s.workload.map((w) => (
                              <div key={w.song} className={`workload-item ${w.status}`}>
                                <div className="workload-song">
                                  <span className={`wl-status-dot ${w.status}`}></span>
                                  {w.song}
                                </div>
                                <div className="workload-bar">
                                  <div className={`workload-fill ${w.status}`} style={{ width: `${w.completion}%` }}></div>
                                </div>
                                <div className="workload-pct">
                                  {w.status === 'locked' ? '—' : w.status === 'next' ? 'Next' : `${w.completion}%`}
                                </div>
                                <div className="workload-plays">{w.plays > 0 ? `${w.plays} plays` : ''}</div>
                              </div>
                            ))}
                          </div>
                          <div className="workload-footer">
                            Total practice: <strong>{s.totalPlays} plays</strong> this semester
                          </div>
                        </div>
                      </div>
                      {s.notes && (
                        <div className="student-detail-note">
                          <strong>Teacher note:</strong> {s.notes}
                        </div>
                      )}
                    </div>
                  )}
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
    </section>
  );
};

export default MyClass;
