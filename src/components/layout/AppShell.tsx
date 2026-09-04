import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SongsProvider } from "@/hooks/useSongs";
import { useAuth } from "@/hooks/useAuth";
import FloatingTuner from "@/components/shared/FloatingTuner";
import ErrorBoundary from "@/components/shared/ErrorBoundary";

const TopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();

  const path = location.pathname;
  const isActive = (p: string, exact = false) => (exact ? path === p : path.startsWith(p));

  const go = (to: string) => {
    navigate(to);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  const initials = (user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <nav className="topnav">
      <div className="brand text-center">
        <span className="dot"></span>bam <span className="uku">​</span>
      </div>
      <div className="nav-spacer"></div>
      <div className="nav-links">
        {role === "student" && (
          <>
            <a className={`nav-link ${isActive("/student", true) ? "active" : ""}`} onClick={() => go("/student")}>Home</a>
            <a className={`nav-link ${isActive("/student/journey") ? "active" : ""}`} onClick={() => go("/student/journey")}>Journey</a>
          </>
        )}
        {role === "teacher" && (
          <>
            <a className={`nav-link ${isActive("/teacher/class") ? "active" : ""}`} onClick={() => go("/teacher/classes")}>My Classes</a>
            <a className={`nav-link ${isActive("/teacher/schedule") ? "active" : ""}`} onClick={() => go("/teacher/schedule")}>Schedule</a>
          </>
        )}

        {role === "admin" && (
          <>
            <a className={`nav-link ${isActive("/admin/schedule") ? "active" : ""}`} onClick={() => go("/admin/schedule")}>Schedule</a>
            <a className={`nav-link ${isActive("/admin/people") ? "active" : ""}`} onClick={() => go("/admin/people")}>People</a>
            <a className={`nav-link ${isActive("/admin/coursework") ? "active" : ""}`} onClick={() => go("/admin/coursework")}>Course work</a>
            {/* Finance hidden for now — routes still live at /admin/finance.
                Restore this link when finance is ready to go public. */}
          </>
        )}
      </div>
      <div className="streak-chip">🔥 keep it up</div>
      <div className="role-toggle" title={user?.email ?? ""}>
        <span className="role-btn active" style={{ pointerEvents: "none" }}>{initials}</span>
        <button className="role-btn" onClick={signOut}>Sign out</button>
      </div>
    </nav>
  );
};

const AppShell = () => {
  const { role } = useAuth();
  const location = useLocation();
  const showFloatingTuner = role !== "teacher" && location.pathname.startsWith("/student");
  return (
    <SongsProvider>
      <TopNav />
      <main id="app">
        {/* Keyed by path so navigating away clears a failed page instead of
            leaving the user stuck on the error card. */}
        <ErrorBoundary key={location.pathname} label="This page">
          <Outlet />
        </ErrorBoundary>
      </main>
      {/* The tuner stays — it's the one tool students need alongside the page.
          It depends on mic permission and live audio, so isolate it: a failure
          there must not take the page down. (Basics book stays hidden.) */}
      {showFloatingTuner && (
        <ErrorBoundary fallback={null}>
          <FloatingTuner />
        </ErrorBoundary>
      )}
    </SongsProvider>
  );
};

export default AppShell;
