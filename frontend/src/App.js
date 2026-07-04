import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import HomePage from './pages/HomePage';
import TeamsPage from './pages/TeamsPage';
import BracketPage from './pages/BracketPage';
import AdminPage from './pages/AdminPage';
import './App.css';

function NavBar() {
  const { user, login, logout } = useAuth();
  const location = useLocation();

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">⚔️</span>
        <Link to="/" className="brand-name">TourneyManager</Link>
      </div>
      <div className="navbar-links">
        <Link to="/" className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}>Tabela</Link>
        <Link to="/bracket" className={location.pathname === '/bracket' ? 'nav-link active' : 'nav-link'}>Drabinka</Link>
        {user && <Link to="/teams" className={location.pathname === '/teams' ? 'nav-link active' : 'nav-link'}>Drużyny</Link>}
        {user?.is_admin && <Link to="/admin" className={location.pathname === '/admin' ? 'nav-link active nav-admin' : 'nav-link nav-admin'}>⚙️ Admin</Link>}
      </div>
      <div className="navbar-auth">
        {user ? (
          <div className="user-info">
            <img src={avatarUrl} alt="" className="user-avatar" />
            <span className="user-name">{user.username}</span>
            {user.is_admin && <span className="admin-badge">ADMIN</span>}
            <button onClick={logout} className="btn-logout">Wyloguj</button>
          </div>
        ) : (
          <button onClick={login} className="btn-discord">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 13.95 13.95 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Zaloguj przez Discord
          </button>
        )}
      </div>
    </nav>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <NavBar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/bracket" element={<BracketPage />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
