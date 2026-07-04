import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const TournamentContext = createContext(null);

const DEFAULTS = {
  phase: 'registration',
  mode: 'teams',
  tournament_name: 'Turniej Ping-Ponga',
  max_teams: 8,
  teams_count: 0,
};

export function TournamentProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    return fetch('/api/public/settings')
      .then(r => r.json())
      .then(data => setSettings(s => ({ ...s, ...data })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const isSolo = settings.mode === 'solo';

  return (
    <TournamentContext.Provider value={{ ...settings, isSolo, loading, refresh }}>
      {children}
    </TournamentContext.Provider>
  );
}

export const useTournament = () => useContext(TournamentContext);
