import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTournament } from '../context/TournamentContext.jsx';

export default function TeamsPage() {
  const { user } = useAuth();
  const { isSolo, phase } = useTournament();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchTeams = () => {
    fetch('/api/teams', { credentials: 'include' })
      .then(r => r.json()).then(setTeams);
  };

  useEffect(() => {
    fetch('/api/teams', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setTeams(data); setLoading(false); });
  }, []);

  const myTeam = teams.find(t =>
    t.representative_id === user?.id ||
    t.members?.some(m => m.id === user?.id && m.status === 'accepted')
  );
  const myRepTeam = teams.find(t => t.representative_id === user?.id);
  const pendingRequests = myRepTeam
    ? myRepTeam.members?.filter(m => m.status === 'pending') || []
    : [];

  const createTeam = async () => {
    if (!isSolo && !newTeamName.trim()) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(isSolo ? {} : { name: newTeamName })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(isSolo ? 'Zapisano Cię do turnieju! 🏓' : 'Drużyna utworzona!');
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

  // Opuść drużynę (dla zwykłego gracza)
  const leaveTeam = async (teamId) => {
    if (!window.confirm('Czy na pewno chcesz opuścić drużynę?')) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/teams/${teamId}/leave`, {
        method: 'POST', credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess('Opuściłeś drużynę.');
      fetchTeams();
    } catch { setError('Błąd połączenia'); }
  };

  // Wyrzuć gracza (dla kapitana)
  const kickMember = async (teamId, userId, username) => {
    if (!window.confirm(`Czy na pewno chcesz wyrzucić ${username} z drużyny?`)) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${userId}/kick`, {
        method: 'POST', credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(`Wyrzucono ${username} z drużyny.`);
      fetchTeams();
    } catch { setError('Błąd połączenia'); }
  };

  // Zrezygnuj z turnieju (solo) / usuń własną drużynę
  const withdraw = async (teamId) => {
    const msg = isSolo ? 'Czy na pewno chcesz zrezygnować z turnieju?' : `Usunąć drużynę?`;
    if (!window.confirm(msg)) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(isSolo ? 'Zrezygnowano z turnieju.' : 'Drużyna usunięta.');
      fetchTeams();
    } catch { setError('Błąd połączenia'); }
  };

  if (!user) return (
    <div className="empty-state">
      <div className="empty-icon">🔐</div>
      <h3>Zaloguj się, aby {isSolo ? 'wziąć udział w turnieju' : 'zarządzać drużynami'}</h3>
    </div>
  );

  if (loading) return <div className="empty-state"><p>Ładowanie...</p></div>;

  // ---------- TRYB SOLO ----------
  if (isSolo) {
    return (
      <div>
        <div className="page-header">
          <h1>🏓 Zawodnicy</h1>
          <p>Zapisz się do turnieju singlowego</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {!myTeam && phase === 'registration' && (
          <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <div className="section-title">Weź udział</div>
            <p style={{ color: 'var(--text2)', margin: '0.5rem 0 1rem' }}>
              Kliknij poniżej, aby zapisać się do turnieju jako zawodnik.
            </p>
            <button className="btn btn-primary" onClick={createTeam}>🏓 Dołącz do turnieju</button>
          </div>
        )}

        {myTeam && (
          <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img
                  src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`}
                  alt="" style={{ width: 36, height: 36, borderRadius: '50%' }}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>{myTeam.name}</div>
                  <span className="badge badge-green">✓ Bierzesz udział w turnieju</span>
                </div>
              </div>
              {phase === 'registration' && (
                <button className="btn btn-danger" onClick={() => withdraw(myTeam.id)}>🚪 Zrezygnuj</button>
              )}
            </div>
          </div>
        )}

        <div className="card">
          <div className="section-title">🏆 Wszyscy zawodnicy ({teams.length})</div>
          {teams.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>Brak zapisanych zawodników</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
              {teams.map(team => (
                <div key={team.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  background: 'var(--bg3)',
                  border: `1px solid ${team.representative_id === user?.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  padding: '0.65rem 1rem'
                }}>
                  <img
                    src={team.rep_avatar ? `https://cdn.discordapp.com/avatars/${team.representative_id}/${team.rep_avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`}
                    alt="" style={{ width: 28, height: 28, borderRadius: '50%' }}
                  />
                  <span style={{ flex: 1, fontWeight: 600 }}>{team.name}</span>
                  {team.representative_id === user?.id && <span className="badge badge-blue">To Ty</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- TRYB DRUŻYNOWY ----------
  return (
    <div>
      <div className="page-header">
        <h1>Drużyny</h1>
        <p>Zarządzaj drużyną i składem</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Create team */}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div className="section-title" style={{ margin: 0 }}>⭐ Twoja drużyna</div>
            {/* Opuść drużynę — tylko dla zwykłych członków (nie kapitana) */}
            {myTeam && !myRepTeam && (
              <button
                className="btn btn-danger"
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                onClick={() => leaveTeam(myTeam.id)}
              >
                🚪 Opuść drużynę
              </button>
            )}
          </div>

          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{myTeam.name}</h3>
          {myRepTeam && <span className="badge badge-gold">Jesteś przedstawicielem</span>}

          {/* Pending join requests */}
          {pendingRequests.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div className="section-title">📬 Prośby o dołączenie ({pendingRequests.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {pendingRequests.map(member => (
                  <div key={member.id} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.6rem 0.75rem',
                    background: 'var(--bg3)', borderRadius: '8px'
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
            <div className="section-title">
              👥 Skład ({myTeam.members?.filter(m => m.status === 'accepted').length || 0} graczy)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
              {myTeam.members?.filter(m => m.status === 'accepted').map(member => (
                <div key={member.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--bg3)', borderRadius: '8px'
                }}>
                  <img
                    src={member.avatar ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`}
                    alt="" style={{ width: 28, height: 28, borderRadius: '50%' }}
                  />
                  <span style={{ flex: 1, fontWeight: member.id === myTeam.representative_id ? 600 : 400 }}>
                    {member.username}
                  </span>
                  {member.id === myTeam.representative_id && (
                    <span className="badge badge-gold">Kapitan</span>
                  )}
                  {/* Wyrzuć gracza — tylko kapitan, nie może wyrzucić siebie */}
                  {myRepTeam && member.id !== user.id && (
                    <button
                      className="btn btn-danger"
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}
                      onClick={() => kickMember(myTeam.id, member.id, member.username)}
                    >
                      Wyrzuć
                    </button>
                  )}
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
              const isMyTeam = team.representative_id === user?.id ||
                team.members?.some(m => m.id === user?.id && m.status === 'accepted');
              const hasPendingRequest = team.members?.some(m => m.id === user?.id && m.status === 'pending');
              const acceptedMembers = team.members?.filter(m => m.status === 'accepted') || [];

              return (
                <div key={team.id} style={{
                  background: 'var(--bg3)',
                  border: `1px solid ${isMyTeam ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  padding: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{team.name}</div>
                      <div style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        Kapitan: {team.rep_username} · {team.member_count} {team.member_count === 1 ? 'gracz' : 'graczy'}
                      </div>
                      {/* Avatary członków */}
                      {acceptedMembers.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {acceptedMembers.map(m => (
                            <img
                              key={m.id}
                              src={m.avatar ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`}
                              alt={m.username}
                              title={m.username}
                              style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--bg2)' }}
                            />
                          ))}
                        </div>
                      )}
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
