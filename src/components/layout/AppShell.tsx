import { Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { SongsProvider } from "@/hooks/useSongs";
import { useAuth } from "@/hooks/useAuth";
import FloatingTuner from "@/components/shared/FloatingTuner";

const TopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, actualRole, setViewAs, signOut } = useAuth();

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
        {role !== "teacher" && (
          <>
            <a className={`nav-link ${isActive("/student", true) ? "active" : ""}`} onClick={() => go("/student")}>Home</a>
            <a className={`nav-link ${isActive("/student/journey") ? "active" : ""}`} onClick={() => go("/student/journey")}>Journey</a>
            
            <a className={`nav-link ${isActive("/student/foundations") || isActive("/student/tuner") ? "active" : ""}`} onClick={() => go("/student/foundations")}>Foundations</a>
          </>
        )}
        {(role === "teacher" || role === "admin") && (
          <>
            <a className={`nav-link ${isActive("/teacher/today") ? "active" : ""}`} onClick={() => go("/teacher/today")}>Today</a>
            <a className={`nav-link ${isActive("/teacher/students") ? "active" : ""}`} onClick={() => go("/teacher/students")}>My Students</a>
            <a className={`nav-link ${isActive("/teacher/schedule") ? "active" : ""}`} onClick={() => go("/teacher/schedule")}>Schedule</a>
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
      {actualRole === "admin" && (
        <div className="role-toggle" title="View the app as a different role">
          <button
            className={`role-btn ${role === "admin" ? "active" : ""}`}
            onClick={() => { setViewAs(null); go("/admin"); }}
          >Admin</button>
          <button
            className={`role-btn ${role === "teacher" ? "active" : ""}`}
            onClick={() => { setViewAs("teacher"); go("/teacher/today"); }}
          >Teacher</button>
          <button
            className={`role-btn ${role === "student" ? "active" : ""}`}
            onClick={() => { setViewAs("student"); go("/student"); }}
          >Student</button>
        </div>
      )}
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
      {showFloatingTuner && <FloatingTuner />}
    </SongsProvider>
  );
};

export { RoleHome };
export default AppShell;
