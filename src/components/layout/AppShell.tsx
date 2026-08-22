import { Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { SongsProvider } from "@/hooks/useSongs";
import { useAuth } from "@/hooks/useAuth";
import FloatingTuner from "@/components/shared/FloatingTuner";
import FloatingFoundations from "@/components/shared/FloatingFoundations";

const TopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Role switching / "view as" was a build-time testing aid — removed now that
  // real accounts carry their own role.
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
            <a className={`nav-link ${isActive("/admin/coursework") ? "active" : ""}`} onClick={() => go("/admin/coursework")}>Course Work</a>
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

const RoleHome = () => {
  const { role } = useAuth();
  if (role === "teacher") return <Navigate to="/teacher" replace />;
  return <Navigate to="/student" replace />;
};

const AppShell = () => {
  const { role } = useAuth();
  const location = useLocation();
  const showFloatingTuner = role !== "teacher" && location.pathname.startsWith("/student");
  return (
    <SongsProvider>
      <TopNav />
      <main id="app">
        <Outlet />
      </main>
      {showFloatingTuner && <FloatingFoundations />}
      {showFloatingTuner && <FloatingTuner />}
    </SongsProvider>
  );
};

export { RoleHome };
export default AppShell;
