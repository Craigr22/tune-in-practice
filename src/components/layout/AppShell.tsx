import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SongsProvider } from "@/hooks/useSongs";
import { useRole } from "@/hooks/useRole";

const TopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, setRole } = useRole();

  const path = location.pathname;
  const isActive = (p: string) => (p === "/student" ? path === "/student" : path.startsWith(p));

  const go = (to: string) => {
    navigate(to);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  return (
    <nav className="topnav">
      <div className="brand">
        <span className="dot"></span>bam <span className="uku">Ukulele · Sem 1</span>
      </div>
      <div className="nav-spacer"></div>
      <div className="nav-links">
        <a className={`nav-link ${isActive("/student") ? "active" : ""}`} onClick={() => go("/student")}>Course</a>
        <a className={`nav-link ${isActive("/student/foundations") ? "active" : ""}`} onClick={() => go("/student/foundations")}>Foundations</a>
        <a className={`nav-link ${isActive("/student/tuner") ? "active" : ""}`} onClick={() => go("/student/tuner")}>Tuner</a>
        <a className="nav-link">Library</a>
        <a className={`nav-link ${isActive("/teacher") ? "active" : ""}`} onClick={() => go("/teacher")}>My class</a>
      </div>
      <div className="streak-chip">🔥 12-day streak</div>
      <div className="role-toggle">
        <button className={`role-btn ${role === "student" ? "active" : ""}`} onClick={() => setRole("student")}>Student</button>
        <button className={`role-btn ${role === "teacher" ? "active" : ""}`} onClick={() => setRole("teacher")}>Teacher</button>
      </div>
    </nav>
  );
};

const AppShell = () => (
  <SongsProvider>
    <TopNav />
    <main id="app">
      <Outlet />
    </main>
  </SongsProvider>
);

export default AppShell;
