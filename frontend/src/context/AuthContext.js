import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setUser(data.user); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const login = () => { window.location.href = '/auth/discord'; };

  const logout = () => {
    fetch('/auth/logout', { method: 'POST', credentials: 'include' })
      .then(() => { setUser(null); });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
