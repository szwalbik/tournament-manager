import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [phase, setPhase] = useState('registration');

  const fetchTeams = () => {
    fetch('/api/teams', { credentials: 'include' })
      .then(r => r.json()).then(setTeams);
  };

  useEffect(() => {
    fetch('/api/teams', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setTeams(data); setLoading(false); });

    fetch('/api/admin/settings', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setPhase(data.status?.phase || 'registration'))
      .catch(() => {});
  }, []);

  const myTeam = teams.find(t =>
    t.representative_id === user?.id ||
    t.members?.some(m => m.id === user?.id && m.status === 'accepted')
  );

  const myRepTeam = teams.find(t => t.representative_id === user?.id);

  const pendingRequests = myRepTeam
    ? myRepTeam.members?.filter(m => m.status === 'pending') || []
    : [];

  const myMembership = teams.flatMap(t =>
    (t.members || []).filter(m => m.id === user?.id)
  )[0];

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newTeamName })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess('Drużyna utworzona!');
      setNewTeamName('');
      fetchTeams();
    } catch { setError('Błąd połączenia'); }
  };

  const joinTeam = async (teamId) => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/teams/${teamId}/join`, {
        method: 'POST', credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess('Prośba o dołączenie wysłana!');
      fetchTeams();
    } catch { setError('Błąd połączenia'); }
  };

  const respondToJoin = async (teamId, userId, action) => {
    try {
      await fetch(`/api/teams/${teamId}/members/${userId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action })
      });
      fetchTeams();
    } catch {}
  };

  if (!user) return (
    <div className="empty-state">
      <div className="empty-icon">🔐</div>
      <h3>Zaloguj się, aby zarządzać drużynami</h3>
    </div>
  );

  if (loading) return <div className="empty-state"><p>Ładowanie...</p></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Drużyny</h1>
        <p>Zarządzaj drużyną i składem</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Create team section */}
      {!myTeam && phase === 'registration' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="section-title">➕ Zarejestruj drużynę</div>
          <div className="form-row" style={{ marginTop: '0.75rem' }}>
            <input
              className="input"
              placeholder="Nazwa drużyny..."
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createTeam()}
            />
            <button className="btn btn-primary" onClick={createTeam} disabled={!newTeamName.trim()}>
              Utwórz drużynę
            </button>
          </div>
        </div>
      )}

      {/* My team info */}
      {myTeam && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--accent)' }}>
          <div className="section-title">⭐ Twoja drużyna</div>
          <div style={{ marginTop: '0.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{myTeam.name}</h3>
            {myRepTeam && <span className="badge badge-gold">Jesteś przedstawicielem</span>}
          </div>

          {/* Pending join requests for rep */}
          {pendingRequests.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div className="section-title">📬 Prośby o dołączenie ({pendingRequests.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {pendingRequests.map(member => (
                  <div key={member.id} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.6rem 0.75rem',
                    background: 'var(--bg3)',
                    borderRadius: '8px'
                  }}>
                    <img
                      src={member.avatar ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`}
                      alt="" style={{ width: 28, height: 28, borderRadius: '50%' }}
                    />
                    <span style={{ flex: 1, fontWeight: 500 }}>{member.username}</span>
                    <button className="btn btn-success" style={{ padding: '0.3rem 0.7rem' }}
                      onClick={() => respondToJoin(myRepTeam.id, member.id, 'accept')}>
                      ✓ Akceptuj
                    </button>
                    <button className="btn btn-danger" style={{ padding: '0.3rem 0.7rem' }}
                      onClick={() => respondToJoin(myRepTeam.id, member.id, 'reject')}>
                      ✗ Odrzuć
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members list */}
          <div style={{ marginTop: '1rem' }}>
            <div className="section-title">👥 Skład ({myTeam.members?.filter(m => m.status === 'accepted').length || 0} graczy)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
              {myTeam.members?.filter(m => m.status === 'accepted').map(member => (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img
                    src={member.avatar ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`}
                    alt="" style={{ width: 26, height: 26, borderRadius: '50%' }}
                  />
                  <span>{member.username}</span>
                  {member.id === myTeam.representative_id && <span className="badge badge-gold">Kapitan</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* All teams */}
      <div className="card">
        <div className="section-title">🏆 Wszystkie drużyny ({teams.length})</div>
        {teams.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <p>Brak zarejestrowanych drużyn</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
            {teams.map(team => {
              const isMyTeam = team.representative_id === user?.id || team.members?.some(m => m.id === user?.id && m.status === 'accepted');
              const hasPendingRequest = team.members?.some(m => m.id === user?.id && m.status === 'pending');

              return (
                <div key={team.id} style={{
                  background: 'var(--bg3)',
                  border: `1px solid ${isMyTeam ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  padding: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{team.name}</div>
                      <div style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>
                        Kapitan: {team.rep_username} · {team.member_count} {team.member_count === 1 ? 'gracz' : 'graczy'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {isMyTeam && <span className="badge badge-blue">Twoja drużyna</span>}
                      {hasPendingRequest && <span className="badge badge-gold">⏳ Oczekuje</span>}
                      {!isMyTeam && !hasPendingRequest && !myTeam && phase === 'registration' && (
                        <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }}
                          onClick={() => joinTeam(team.id)}>
                          Poproś o dołączenie
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
