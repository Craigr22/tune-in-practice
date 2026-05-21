import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FOUNDATIONS } from "@/data/foundations";
import { useSongs } from "@/hooks/useSongs";
import { useFoundationProgress } from "@/hooks/useFoundationProgress";
import TuneCheckLesson from "@/components/shared/TuneCheckLesson";

const Foundations = () => {
  const navigate = useNavigate();
  const { foundationsState, markFoundationsComplete } = useSongs();
  const { data: dbCompleted = [] } = useFoundationProgress();
  const [activeId, setActiveId] = useState("hold");
  const active = FOUNDATIONS.find((f) => f.id === activeId)!;
  const moduleRef = useRef<HTMLDivElement>(null);

  const isDone = (id: string) =>
    !!foundationsState.find((x) => x.id === id)?.done ||
    dbCompleted.some((c) => c.foundation_id === id);

  useEffect(() => {
    const root = moduleRef.current;
    if (!root) return;
    const handler = (e: Event) => {
      const tgt = e.target as HTMLElement;
      const action = tgt.dataset?.action;
      if (action === "mark-complete") markFoundationsComplete();
      if (action === "back-home") navigate("/student");
    };
    root.addEventListener("click", handler);
    return () => root.removeEventListener("click", handler);
  }, [activeId, markFoundationsComplete, navigate]);

  return (
    <section className="view view-foundations active">
      <div className="foundations-view">
        <a className="back-link" onClick={() => navigate("/student")}>← Back to course</a>
        <h1 className="foundations-page-title">
          The <em style={{ fontFamily: "var(--font-script)", fontWeight: 700, color: "var(--gold-deep)", fontStyle: "normal" }}>basics</em>, first.
        </h1>
        <p className="foundations-page-sub">The five micro-modules that prevent 80% of week-1 dropouts. Do these once and your first song will feel possible.</p>

        <div className="foundations-grid">
          <nav className="foundations-nav">
            {FOUNDATIONS.map((f, i) => {
              const done = isDone(f.id);
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
            <div
              className="foundations-nav-item"
              style={{ marginTop: 12, opacity: 0.8 }}
              onClick={() => navigate("/student/tuner")}
            >
              <div className="foundations-nav-num">🎼</div>
              <div>Standalone tuner →</div>
            </div>
          </nav>
          <div className="foundations-module" ref={moduleRef}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--gold-deep)", marginBottom: 10 }}>
              {active.eyebrow}
            </div>
            <h2>{active.title}</h2>
            {activeId === "tune" ? (
              <>
                <p className="lead">An out-of-tune ukulele makes everything you play sound wrong — even when you're playing it right. Let's tune together, one string at a time.</p>
                <p style={{ marginBottom: 16, fontSize: 14, color: "var(--ink-soft)" }}>
                  Play each string when prompted. Turn the peg slowly until the needle centers and the bar turns green. Hold for a second to confirm.
                </p>
                <TuneCheckLesson />
              </>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: active.body }} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Foundations;
