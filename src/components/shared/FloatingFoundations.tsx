import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FOUNDATIONS } from "@/data/foundations";

const FloatingFoundations = () => {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>(FOUNDATIONS[0]?.id ?? "");
  const active = FOUNDATIONS.find((f) => f.id === activeId) ?? FOUNDATIONS[0];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open ukulele basics"
        title="Ukulele basics"
        className="fixed z-40 right-6 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{
          width: 60,
          height: 60,
          bottom: 96, // sits above the tuner (which is at bottom: 24px, 60px tall)
          background: "linear-gradient(135deg, var(--gold), #E8B530)",
          color: "var(--navy)",
          boxShadow: "0 12px 28px -8px rgba(244,208,63,0.55), 0 4px 10px -4px rgba(0,0,0,0.2)",
          fontSize: 26,
        }}
      >
        📖
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Ukulele basics</DialogTitle>
          <div
            style={{ background: "var(--paper-warm)" }}
            className="max-h-[85vh] overflow-y-auto"
          >
            <div className="p-6 md:p-8">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                Ukulele basics
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mt-1" style={{ color: "var(--navy)" }}>
                Hold, tune & play
              </h2>

              <div className="flex flex-wrap gap-2 mt-5">
                {FOUNDATIONS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveId(f.id)}
                    className="text-xs font-semibold px-3 py-2 rounded-full transition"
                    style={{
                      background: activeId === f.id ? "var(--navy)" : "rgba(0,0,0,0.06)",
                      color: activeId === f.id ? "#fff" : "var(--navy)",
                    }}
                  >
                    {f.title}
                  </button>
                ))}
              </div>

              {active && (
                <article className="mt-6">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                    {active.eyebrow}
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold mt-1" style={{ color: "var(--navy)" }}>
                    {active.title}
                  </h3>
                  <div
                    className="foundation-body mt-4 text-sm md:text-base leading-relaxed"
                    style={{ color: "var(--ink)" }}
                    dangerouslySetInnerHTML={{ __html: active.body }}
                  />
                </article>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FloatingFoundations;
