import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Tuner from "@/components/Tuner";
import JamPad from "@/components/student/JamPad";

const FloatingTuner = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open BAM Tuner"
        className="fixed z-40 bottom-6 right-6 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{
          width: 60,
          height: 60,
          background: "linear-gradient(135deg, var(--navy), var(--blue-deep))",
          color: "#fff",
          boxShadow: "0 12px 28px -8px rgba(0,133,199,0.55), 0 4px 10px -4px rgba(0,0,0,0.2)",
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" width="26" height="26" aria-hidden="true">
          <path
            d="M8 2v8a4 4 0 0 0 8 0V2M12 14v8M9.5 22h5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[560px] p-0 overflow-hidden border-none bg-transparent shadow-none"
          // Without this Radix focuses the first control and the browser
          // scrolls to it, opening the panel halfway down the tuner.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">BAM Tuner</DialogTitle>
          {/* Tuner and jam pad share one panel: the tuner's own card provides
              the top, the jam pad drops its card and continues below a rule,
              so the two read as one tool rather than two stacked widgets. */}
          <div
            className="tuner-panel max-h-[85vh] overflow-y-auto mx-auto"
            style={{
              maxWidth: 540,
              background: "var(--card)",
              borderRadius: 24,
              boxShadow: "var(--shadow-lg)",
              overflowX: "hidden",
            }}
          >
            <Tuner />
            <div style={{ borderTop: "1px solid var(--border)" }}>
              <JamPad embedded />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FloatingTuner;
