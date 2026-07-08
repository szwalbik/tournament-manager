import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(() => {
    return fetch('/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setUser(data.user); return data.user; })
      .catch(() => null);
  }, []);

  useEffect(() => {
    fetchUser().finally(() => setLoading(false));
  }, [fetchUser]);

  const login = () => { window.location.href = '/auth/discord'; };

  const logout = () => {
    fetch('/auth/logout', { method: 'POST', credentials: 'include' })
      .then(() => { setUser(null); });
  };

  // Odświeża dane zalogowanego użytkownika (np. po zapisaniu profilu),
  // żeby np. navbar od razu pokazał nowe imię i nazwisko bez przeładowania strony.
  const refreshUser = () => fetchUser();

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
