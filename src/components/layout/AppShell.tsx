import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SongsProvider } from "@/hooks/useSongs";
import { useAuth } from "@/hooks/useAuth";
import FloatingTuner from "@/components/shared/FloatingTuner";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { useViewAs, setViewAs, useViewableAccounts } from "@/hooks/useViewAs";
import { displayLogin } from "@/lib/studentLogin";

const TopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, actualRole, signOut } = useAuth();
  const viewAs = useViewAs();
  const { data: accounts = [] } = useViewableAccounts(actualRole === "admin");

  const path = location.pathname;
  const isActive = (p: string, exact = false) => (exact ? path === p : path.startsWith(p));

  // Below ~900px the header's contents don't fit, so they live behind a menu.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [path]);

  const go = (to: string) => {
    setMenuOpen(false);
    navigate(to);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  /**
   * How this account is named back to the person signed in.
   *
   * A student's account sits on a synthetic address that never receives mail
   * — showing them "payal.malviya@students.bam.invalid" names their login
   * with something they must not type and could not be sent anything at. The
   * username is the part that is theirs.
   */
  const signedInAs = displayLogin(user?.email);

  const initials = (signedInAs || "?").slice(0, 2).toUpperCase();

  /** One source for the nav, so the header and the phone menu can't drift. */
  const links =
    role === "student"
      ? [
          { to: "/student", label: "Home", active: isActive("/student", true) },
          { to: "/student/journey", label: "Journey", active: isActive("/student/journey") },
        ]
      : role === "teacher"
      ? [
          { to: "/teacher/classes", label: "My Classes", active: isActive("/teacher/class") },
          { to: "/teacher/schedule", label: "Schedule", active: isActive("/teacher/schedule") },
        ]
      : [
          { to: "/admin/schedule", label: "Schedule", active: isActive("/admin/schedule") },
          { to: "/admin/people", label: "People", active: isActive("/admin/people") },
          { to: "/admin/coursework", label: "Course work", active: isActive("/admin/coursework") },
          // Finance hidden for now — routes still live at /admin/finance.
        ];

  const onViewAsChange = (v: string) => {
    if (!v) { setViewAs(null); go("/admin/schedule"); return; }
    const [r, id] = v.split(":");
    const person = accounts.find((a) => a.id === id && a.role === r);
    if (!person) return;
    setViewAs(person);
    go(r === "teacher" ? "/teacher/classes" : "/student");
  };

  return (
    <nav className="topnav">
      <div className="brand text-center">
        <span className="dot"></span>bam <span className="uku">​</span>
      </div>
      <div className="nav-spacer"></div>
      <div className="nav-links">
        {links.map((l) => (
          <a key={l.to} className={`nav-link ${l.active ? "active" : ""}`} onClick={() => go(l.to)}>
            {l.label}
          </a>
        ))}
      </div>
      {role === "student" && <div className="streak-chip">🔥 keep it up</div>}

      {/* Admin-only lens: see the app as a particular teacher or student.
          Always paired with a way straight back to your own account. */}
      {actualRole === "admin" && (
        <div className="role-toggle" title="See the app as someone else">
          <select
            className="role-btn"
            style={{ padding: "4px 8px", fontSize: 12, maxWidth: 190 }}
            value={viewAs ? `${viewAs.role}:${viewAs.id}` : ""}
            onChange={(e) => onViewAsChange(e.target.value)}
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

      <div className="role-toggle" title={signedInAs}>
        <span className="role-btn active" style={{ pointerEvents: "none" }}>{initials}</span>
        <button className="role-btn" onClick={signOut}>Sign out</button>
      </div>

      {/* Phones: one button for everything the header can't fit. */}
      <button
        className="nav-menu-btn"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        <span aria-hidden>{menuOpen ? "✕" : "☰"}</span>
        <span className="nav-menu-initials">{initials}</span>
      </button>

      {menuOpen && (
        <div className="nav-sheet">
          {links.map((l) => (
            <button
              key={l.to}
              className={`nav-sheet-link ${l.active ? "active" : ""}`}
              onClick={() => go(l.to)}
            >
              {l.label}
            </button>
          ))}

          {actualRole === "admin" && (
            <label className="nav-sheet-field">
              <span>View the app as</span>
              <select
                value={viewAs ? `${viewAs.role}:${viewAs.id}` : ""}
                onChange={(e) => onViewAsChange(e.target.value)}
              >
                <option value="">My account (admin)</option>
                <optgroup label="Teachers">
                  {accounts.filter((a) => a.role === "teacher").map((a) => (
                    <option key={`mt${a.id}`} value={`teacher:${a.id}`}>{a.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Students">
                  {accounts.filter((a) => a.role === "student").map((a) => (
                    <option key={`ms${a.id}`} value={`student:${a.id}`}>{a.name}</option>
                  ))}
                </optgroup>
              </select>
            </label>
          )}

          <div className="nav-sheet-foot">
            <span className="nav-sheet-email">{signedInAs}</span>
            <button className="nav-sheet-signout" onClick={signOut}>Sign out</button>
          </div>
        </div>
      )}
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
