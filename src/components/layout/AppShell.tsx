import { Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { SongsProvider } from "@/hooks/useSongs";
import { useAuth } from "@/hooks/useAuth";

const TopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();

  const path = location.pathname;
  const isActive = (p: string) => (p === "/student" ? path === "/student" : path.startsWith(p));

  const go = (to: string) => {
    navigate(to);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  const initials = (user?.email || "?").slice(0, 2).toUpperCase();
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "—";

  return (
    <nav className="topnav">
      <div className="brand">
        <span className="dot"></span>bam <span className="uku">Ukulele · Sem 1</span>
      </div>
      <div className="nav-spacer"></div>
      <div className="nav-links">
        {role !== "teacher" && (
          <>
            <a className={`nav-link ${isActive("/student") ? "active" : ""}`} onClick={() => go("/student")}>Course</a>
            <a className={`nav-link ${isActive("/student/foundations") ? "active" : ""}`} onClick={() => go("/student/foundations")}>Foundations</a>
            <a className={`nav-link ${isActive("/student/tuner") ? "active" : ""}`} onClick={() => go("/student/tuner")}>Tuner</a>
            <a className="nav-link">Library</a>
          </>
        )}
        {(role === "teacher" || role === "admin") && (
          <a className={`nav-link ${isActive("/teacher") ? "active" : ""}`} onClick={() => go("/teacher")}>My class</a>
        )}
      </div>
      <div className="streak-chip">🔥 12-day streak</div>
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

const AppShell = () => (
  <SongsProvider>
    <TopNav />
    <main id="app">
      <Outlet />
    </main>
  </SongsProvider>
);

export { RoleHome };
export default AppShell;
