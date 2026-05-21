import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Tuner from "@/components/Tuner";

const FloatingTuner = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open tuner"
        className="fixed z-40 bottom-6 right-6 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{
          width: 60,
          height: 60,
          background: "linear-gradient(135deg, var(--navy), var(--blue-deep))",
          color: "#fff",
          boxShadow: "0 12px 28px -8px rgba(0,133,199,0.55), 0 4px 10px -4px rgba(0,0,0,0.2)",
          fontSize: 26,
        }}
      >
        🎼
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Ukulele tuner</DialogTitle>
          <div style={{ background: "var(--paper-warm)" }} className="max-h-[85vh] overflow-y-auto">
            <Tuner />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FloatingTuner;
