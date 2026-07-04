import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTournament } from '../context/TournamentContext.jsx';

export default function HomePage() {
  const { user } = useAuth();
  const { phase, isSolo, tournament_name } = useTournament();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/matches')
      .then(r => r.json())
      .then(data => { setMatches(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const entryLabel = isSolo ? 'Zawodnik' : 'Drużyna';

  // Compute standings from finished matches
  const standings = computeStandings(matches);
  const activeMatches = matches.filter(m => m.status === 'scheduled' && m.team1_id && m.team2_id);
  const recentMatches = matches.filter(m => m.status === 'finished').reverse().slice(0, 5);

  const phaseLabel = {
    registration: { label: 'Rejestracja', color: 'badge-blue' },
    active: { label: 'Aktywny', color: 'badge-green' },
    finished: { label: 'Zakończony', color: 'badge-gold' }
  }[phase] || { label: phase, color: 'badge-gray' };

  if (loading) return <div className="empty-state"><p>Ładowanie...</p></div>;

  return (
    <div>
      <div className="pingpong-banner">
        <div className="pingpong-banner-text">
          <h1>{tournament_name}</h1>
          <p>{isSolo ? 'Turniej singlowy — gracz kontra gracz' : 'Turniej drużynowy w ping-ponga'} — podgląd wyników na żywo</p>
        </div>
        <div className="pingpong-ball">🏓</div>
      </div>

      <div className="status-bar">
        <div className={`status-dot ${phase === 'active' ? '' : 'inactive'}`} />
        <div>
          <span style={{ fontWeight: 600 }}>Status turnieju: </span>
          <span className={`badge ${phaseLabel.color}`}>{phaseLabel.label}</span>
        </div>
        {phase === 'registration' && !user && (
          <span style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>
            🔑 Zaloguj się przez Discord, aby {isSolo ? 'wziąć udział' : 'zarejestrować drużynę'}
          </span>
        )}
      </div>

      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        {/* Active matches */}
        <div className="card">
          <div className="section-title">🏓 Aktualne mecze</div>
          {activeMatches.length === 0 ? (
            <div style={{ color: 'var(--text2)', padding: '1rem 0', textAlign: 'center' }}>
              {phase === 'registration' ? 'Turniej jeszcze nie wystartował' : 'Brak aktywnych meczów'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activeMatches.map(m => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          )}
        </div>

        {/* Recent results */}
        <div className="card">
          <div className="section-title">📋 Ostatnie wyniki</div>
          {recentMatches.length === 0 ? (
            <div style={{ color: 'var(--text2)', padding: '1rem 0', textAlign: 'center' }}>
              Brak zakończonych meczów
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentMatches.map(m => (
                <ResultRow key={m.id} match={m} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Standings */}
      {standings.length > 0 && (
        <div className="card">
          <div className="section-title">🏅 Wyniki {isSolo ? '' : 'drużyn'}</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{entryLabel}</th>
                  <th>Mecze</th>
                  <th>Wygrane</th>
                  <th>Przegrane</th>
                  <th>Sety</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team, i) => (
                  <tr key={team.id}>
                    <td>
                      <span style={{ color: i === 0 ? 'var(--gold)' : 'var(--text2)', fontWeight: 700 }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{team.name}</td>
                    <td>{team.played}</td>
                    <td><span className="badge badge-green">{team.wins}</span></td>
                    <td><span className="badge badge-red">{team.losses}</span></td>
                    <td style={{ color: 'var(--text2)' }}>{team.goalsFor}:{team.goalsAgainst}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match }) {
  return (
    <div style={{
      background: 'var(--bg3)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '0.75rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    }}>
      <span style={{ flex: 1, fontWeight: 600, textAlign: 'right' }}>{match.team1_name}</span>
      <span style={{ background: 'var(--bg2)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
        Runda {match.round}
      </span>
      <span style={{ flex: 1, fontWeight: 600 }}>{match.team2_name}</span>
    </div>
  );
}

function ResultRow({ match }) {
  const team1Won = match.winner_id === match.team1_id;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.5rem 0', borderBottom: '1px solid var(--border)'
    }}>
      <span style={{ flex: 1, textAlign: 'right', fontWeight: team1Won ? 600 : 400, color: team1Won ? 'var(--text)' : 'var(--text2)' }}>
        {match.team1_name}
      </span>
      <span style={{ fontWeight: 700, padding: '0 0.5rem', minWidth: '50px', textAlign: 'center' }}>
        {match.team1_score}:{match.team2_score}
      </span>
      <span style={{ flex: 1, fontWeight: !team1Won ? 600 : 400, color: !team1Won ? 'var(--text)' : 'var(--text2)' }}>
        {match.team2_name}
      </span>
    </div>
  );
}

function computeStandings(matches) {
  const teams = {};
  matches.filter(m => m.status === 'finished').forEach(m => {
    if (!m.team1_id || !m.team2_id) return;
    [m.team1_id, m.team2_id].forEach((id, idx) => {
      const name = idx === 0 ? m.team1_name : m.team2_name;
      if (!teams[id]) teams[id] = { id, name, played: 0, wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
    });
    const t1 = teams[m.team1_id];
    const t2 = teams[m.team2_id];
    t1.played++; t2.played++;
    t1.goalsFor += m.team1_score || 0; t1.goalsAgainst += m.team2_score || 0;
    t2.goalsFor += m.team2_score || 0; t2.goalsAgainst += m.team1_score || 0;
    if (m.winner_id === m.team1_id) { t1.wins++; t2.losses++; }
    else { t2.wins++; t1.losses++; }
  });
  return Object.values(teams).sort((a, b) => b.wins - a.wins || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
}
