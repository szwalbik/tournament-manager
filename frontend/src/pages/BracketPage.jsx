import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function BracketPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resultModal, setResultModal] = useState(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [error, setError] = useState('');

  const fetchMatches = () => {
    fetch('/api/matches', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setMatches(data); setLoading(false); });
  };

  useEffect(() => { fetchMatches(); }, []);

  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
  const maxRound = Math.max(...rounds, 0);

  const getRoundName = (round) => {
    if (round === maxRound) return 'FINAŁ';
    if (round === maxRound - 1) return 'PÓŁFINAŁ';
    if (round === maxRound - 2) return 'ĆWIERĆFINAŁ';
    return `RUNDA ${round}`;
  };

  const canSubmitResult = (match) => {
    if (!user || match.status === 'finished' || !match.team1_id || !match.team2_id) return false;
    return true; // API will validate rep status
  };

  const submitResult = async () => {
    if (score1 === '' || score2 === '') { setError('Wpisz wyniki'); return; }
    setError('');
    try {
      const endpoint = user?.is_admin
        ? `/api/matches/${resultModal.id}/admin-result`
        : `/api/matches/${resultModal.id}/result`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ team1_score: parseInt(score1), team2_score: parseInt(score2) })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResultModal(null); setScore1(''); setScore2('');
      fetchMatches();
    } catch { setError('Błąd połączenia'); }
  };

  if (loading) return <div className="empty-state"><p>Ładowanie drabinki...</p></div>;

  if (matches.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🏆</div>
        <h3>Drabinka nie jest jeszcze gotowa</h3>
        <p>Turniej rozpocznie się po zarejestrowaniu wszystkich drużyn</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Drabinka turniejowa</h1>
        <p>Kliknij na mecz, aby wpisać wynik (po zalogowaniu)</p>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '2rem', minWidth: 'max-content', alignItems: 'flex-start', padding: '1rem 0' }}>
          {rounds.map(round => {
            const roundMatches = matches.filter(m => m.round === round).sort((a, b) => a.match_number - b.match_number);
            const totalRounds = rounds.length;
            const spacingFactor = Math.pow(2, round - 1);

            return (
              <div key={round} style={{ display: 'flex', flexDirection: 'column', gap: `${spacingFactor * 0.5}rem` }}>
                <div className="section-title" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                  {getRoundName(round)}
                </div>
                {roundMatches.map(match => (
                  <MatchBracketCard
                    key={match.id}
                    match={match}
                    canSubmit={canSubmitResult(match)}
                    onSubmit={() => { setResultModal(match); setScore1(''); setScore2(''); setError(''); }}
                    spacingFactor={spacingFactor}
                    totalRounds={totalRounds}
                    round={round}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Result Modal */}
      {resultModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '400px', position: 'relative' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>
              {user?.is_admin ? '⚙️ Wpisz wynik (Admin)' : '📝 Zgłoś wynik'}
            </h3>
            {!user?.is_admin && (
              <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                Obie drużyny muszą potwierdzić wynik. Druga drużyna również musi go zgłosić.
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{resultModal.team1_name}</div>
                <input
                  type="number" min="0"
                  className="input"
                  style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700 }}
                  value={score1}
                  onChange={e => setScore1(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div style={{ color: 'var(--text2)', fontWeight: 700, fontSize: '1.2rem' }}>:</div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{resultModal.team2_name}</div>
                <input
                  type="number" min="0"
                  className="input"
                  style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700 }}
                  value={score2}
                  onChange={e => setScore2(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setResultModal(null)}>Anuluj</button>
              <button className="btn btn-primary" onClick={submitResult}>
                {user?.is_admin ? 'Zatwierdź wynik' : 'Zgłoś wynik'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchBracketCard({ match, canSubmit, onSubmit, spacingFactor }) {
  const isEmpty = !match.team1_id && !match.team2_id;
  const isBye = (match.team1_id && !match.team2_id) || (!match.team1_id && match.team2_id);

  const team1Won = match.winner_id === match.team1_id;
  const team2Won = match.winner_id === match.team2_id;
  const isFinished = match.status === 'finished';

  const team1Pending = match.team1_confirmed && !match.team2_confirmed;
  const team2Pending = match.team2_confirmed && !match.team1_confirmed;

  return (
    <div
      onClick={canSubmit ? onSubmit : undefined}
      style={{
        background: 'var(--bg2)',
        border: `1px solid ${isFinished ? 'var(--border)' : canSubmit ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: '10px',
        width: '220px',
        overflow: 'hidden',
        cursor: canSubmit ? 'pointer' : 'default',
        transition: 'border-color 0.15s, transform 0.1s',
        transform: canSubmit ? 'translateY(0)' : undefined,
        boxShadow: isFinished ? 'none' : canSubmit ? '0 0 12px var(--accent-glow)' : 'none',
        marginTop: `${(spacingFactor - 1) * 0.5}rem`,
        marginBottom: `${(spacingFactor - 1) * 0.5}rem`,
      }}
      onMouseEnter={e => { if (canSubmit) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {isEmpty ? (
        <div style={{ padding: '0.75rem 1rem', color: 'var(--text3)', fontSize: '0.85rem', textAlign: 'center' }}>
          Oczekuje...
        </div>
      ) : (
        <>
          <TeamRow
            name={match.team1_name || '?'}
            score={isFinished ? match.team1_score : undefined}
            won={team1Won}
            pending={team1Pending}
            isEmpty={!match.team1_id}
          />
          <div style={{ height: '1px', background: 'var(--border)' }} />
          <TeamRow
            name={match.team2_name || (isBye ? 'BYE' : '?')}
            score={isFinished ? match.team2_score : undefined}
            won={team2Won}
            pending={team2Pending}
            isEmpty={!match.team2_id}
          />
        </>
      )}
      {isFinished && (
        <div style={{
          padding: '4px 10px',
          background: 'var(--bg3)',
          fontSize: '0.7rem',
          color: 'var(--text3)',
          borderTop: '1px solid var(--border)'
        }}>
          ✅ Zakończony
        </div>
      )}
      {!isFinished && canSubmit && (
        <div style={{
          padding: '4px 10px',
          background: 'var(--accent-glow)',
          fontSize: '0.7rem',
          color: 'var(--accent)',
          borderTop: '1px solid rgba(88,101,242,0.2)'
        }}>
          Kliknij, aby wpisać wynik
        </div>
      )}
    </div>
  );
}

function TeamRow({ name, score, won, pending, isEmpty }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.6rem 0.75rem',
      background: won ? 'rgba(62,207,142,0.08)' : 'transparent'
    }}>
      <span style={{
        flex: 1,
        fontWeight: won ? 700 : 400,
        color: isEmpty ? 'var(--text3)' : won ? 'var(--green)' : 'var(--text)',
        fontSize: '0.875rem',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}>
        {won && '🏆 '}{name}
      </span>
      {pending && <span style={{ fontSize: '0.7rem', color: 'var(--gold)' }}>⏳</span>}
      {score !== undefined && (
        <span style={{
          fontWeight: 700,
          color: won ? 'var(--green)' : 'var(--text2)',
          fontSize: '1rem',
          minWidth: '20px',
          textAlign: 'right'
        }}>
          {score}
        </span>
      )}
    </div>
  );
}
