import { Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { SongsProvider } from "@/hooks/useSongs";
import { useAuth } from "@/hooks/useAuth";
import FloatingTuner from "@/components/shared/FloatingTuner";

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
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "—";

  return (
    <nav className="topnav">
      <div className="brand text-center">
        <span className="dot"></span>bam <span className="uku">​</span>
      </div>
      <div className="nav-spacer"></div>
      <div className="nav-links">
        {role !== "teacher" && (
          <>
            <a className={`nav-link ${isActive("/student", true) ? "active" : ""}`} onClick={() => go("/student")}>Home</a>
            <a className={`nav-link ${isActive("/student/journey") ? "active" : ""}`} onClick={() => go("/student/journey")}>Journey</a>
            <a className={`nav-link ${isActive("/student/songs") ? "active" : ""}`} onClick={() => go("/student/songs")}>Songs</a>
            <a className={`nav-link ${isActive("/student/foundations") || isActive("/student/tuner") ? "active" : ""}`} onClick={() => go("/student/foundations")}>Foundations</a>
          </>
        )}
        {(role === "teacher" || role === "admin") && (
          <>
            <a className={`nav-link ${isActive("/teacher/today") ? "active" : ""}`} onClick={() => go("/teacher/today")}>Today</a>
            <a className={`nav-link ${isActive("/teacher/students") ? "active" : ""}`} onClick={() => go("/teacher/students")}>My Students</a>
            
          </>
        )}
        {role === "admin" && (
          <>
            <a className={`nav-link ${isActive("/admin", true) ? "active" : ""}`} onClick={() => go("/admin")}>Dashboard</a>
            <a className={`nav-link ${isActive("/admin/finance") ? "active" : ""}`} onClick={() => go("/admin/finance")}>Finance</a>
          </>
        )}
      </div>
      <div className="streak-chip">🔥 keep it up</div>
      <div className="role-toggle" title={user?.email ?? ""}>
        <span className="role-btn active" style={{ pointerEvents: "none" }}>{roleLabel}</span>
        <button className="role-btn" onClick={signOut}>{initials} · Sign out</button>
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
      {showFloatingTuner && <FloatingTuner />}
    </SongsProvider>
  );
};

export { RoleHome };
export default AppShell;
