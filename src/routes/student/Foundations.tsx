import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FOUNDATIONS } from "@/data/foundations";
import { useSongs } from "@/hooks/useSongs";

const Foundations = () => {
  const navigate = useNavigate();
  const { foundationsState, markFoundationsComplete } = useSongs();
  const [activeId, setActiveId] = useState("hold");
  const active = FOUNDATIONS.find((f) => f.id === activeId)!;
  const moduleRef = useRef<HTMLDivElement>(null);

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
    </section>
  );
};

export default Foundations;
