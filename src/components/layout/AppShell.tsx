import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SongsProvider } from "@/hooks/useSongs";
import { useAuth } from "@/hooks/useAuth";
import FloatingTuner from "@/components/shared/FloatingTuner";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { useViewAs, setViewAs, useViewableAccounts } from "@/hooks/useViewAs";

const TopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, actualRole, signOut } = useAuth();
  const viewAs = useViewAs();
  const { data: accounts = [] } = useViewableAccounts(actualRole === "admin");

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

      {/* Admin-only lens: see the app as a particular teacher or student.
          Always paired with a way straight back to your own account. */}
      {actualRole === "admin" && (
        <div className="role-toggle" title="See the app as someone else">
          <select
            className="role-btn"
            style={{ padding: "4px 8px", fontSize: 12, maxWidth: 190 }}
            value={viewAs ? `${viewAs.role}:${viewAs.id}` : ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) { setViewAs(null); go("/admin/schedule"); return; }
              const [role, id] = v.split(":");
              const person = accounts.find((a) => a.id === id && a.role === role);
              if (!person) return;
              setViewAs(person);
              go(role === "teacher" ? "/teacher/classes" : "/student");
            }}
          >
            <option value="">👤 My account (admin)</option>
            <optgroup label="Teachers">
              {accounts.filter((a) => a.role === "teacher").map((a) => (
                <option key={`t${a.id}`} value={`teacher:${a.id}`}>{a.name}</option>
              ))}
            </optgroup>
            <optgroup label="Students">
              {accounts.filter((a) => a.role === "student").map((a) => (
                <option key={`s${a.id}`} value={`student:${a.id}`}>{a.name}</option>
              ))}
            </optgroup>
          </select>
          {viewAs && (
            <button
              className="role-btn active"
              onClick={() => { setViewAs(null); go("/admin/schedule"); }}
              title="Return to your own account"
            >
              Exit
            </button>
          )}
        </div>
      )}

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
