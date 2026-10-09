import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useTheme } from "./context/ThemeContext";
import NotificationBell from "./components/NotificationBell";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Data from "./pages/Data";
import Profile from "./pages/Profile";

const Icon = ({ name, size = 18 }) => {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    database: <><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 3.4-6 8-6s7.2 2 8 6"/></>,
    moon: <path d="M20 15.2A8 8 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l-1.4-1.4"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 3h5v18h-5"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

function Shell({ children }) {
  const { user, logout } = useAuth();
  const { dark, setDark } = useTheme();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-symbol">E</div>
          <div><strong>EDABIP</strong><span>DATA INTELLIGENCE</span></div>
        </div>
        <div className="workspace-pill"><span className="live-dot"/> Workspace live</div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav">
          <NavLink to="/dashboard"><Icon name="grid"/><span>Command center</span><em>01</em></NavLink>
          <NavLink to="/data"><Icon name="database"/><span>Data studio</span><em>02</em></NavLink>
          <NavLink to="/profile"><Icon name="user"/><span>My profile</span><em>03</em></NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="nav-label">SYSTEM</div>
          <button className="side-action" onClick={() => setDark(!dark)}><Icon name={dark ? "sun" : "moon"}/><span>{dark ? "Light interface" : "Dark interface"}</span></button>
          <button className="side-action logout" onClick={logout}><Icon name="logout"/><span>Sign out</span></button>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="breadcrumb"><span>EDABIP</span><b>/</b><strong>Intelligence workspace</strong></div>
          <div className="topbar-actions">
            <div className="system-state"><i/> All systems normal</div>
            <NotificationBell/>
            <div className="user-menu">
              <div className="avatar-mini">
                {user?.avatar_url ? <img src={`http://localhost:5000${user.avatar_url}`} alt="" /> : user?.name?.[0] || "E"}
              </div>
              <div><strong>{user?.name}</strong><small>{user?.role}</small></div>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function Forbidden() {
  return <div className="page"><div className="empty-state"><div>403</div><h1>Restricted workspace</h1><p>Your current role does not have access to this area.</p><NavLink className="primary empty-action" to="/dashboard">Return to command center</NavLink></div></div>;
}

export default function App() {
  const { user } = useAuth();
  return <Routes>
    <Route path="/login" element={<Login/>}/>
    <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
    <Route path="/dashboard" element={<ProtectedRoute><Shell><Dashboard/></Shell></ProtectedRoute>}/>
    <Route path="/data" element={<ProtectedRoute><RoleRoute allowed={["admin","analyst"]} user={user}><Shell><Data/></Shell></RoleRoute></ProtectedRoute>}/>
    <Route path="/profile" element={<ProtectedRoute><Shell><Profile/></Shell></ProtectedRoute>}/>
    <Route path="/403" element={<ProtectedRoute><Shell><Forbidden/></Shell></ProtectedRoute>}/>
    <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
  </Routes>;
}
