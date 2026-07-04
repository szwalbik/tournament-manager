import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AdminPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({});
  const [status, setStatus] = useState({});
  const [adminUsers, setAdminUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newAdminId, setNewAdminId] = useState('');
  const [form, setForm] = useState({ max_teams: '', tournament_name: '', discord_channel_id: '' });

  const fetchData = () => {
    Promise.all([
      fetch('/api/admin/settings', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/users', { credentials: 'include' }).then(r => r.json())
    ]).then(([settingsData, usersData]) => {
      const settingsMap = {};
      settingsData.settings?.forEach(s => { settingsMap[s.key] = s.value; });
      setSettings(settingsMap);
      setStatus(settingsData.status || {});
      setAdminUsers(settingsData.adminUsers || []);
      setAllUsers(usersData);
      setForm({
        max_teams: settingsMap.max_teams || '8',
        tournament_name: settingsMap.tournament_name || '',
        discord_channel_id: settingsMap.discord_channel_id || ''
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const saveSettings = async () => {
    setError(''); setSuccess('');
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form)
    });
    if (res.ok) { setSuccess('Ustawienia zapisane!'); fetchData(); }
    else { const d = await res.json(); setError(d.error); }
  };

  const startTournament = async () => {
    if (!window.confirm('Czy na pewno chcesz rozpocząć turniej? Losowanie zostanie wykonane teraz.')) return;
    setError(''); setSuccess('');
    const res = await fetch('/api/admin/start', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (res.ok) { setSuccess('Turniej rozpoczęty! Drabinka wygenerowana.'); fetchData(); }
    else setError(data.error);
  };

  const resetTournament = async () => {
    if (!window.confirm('UWAGA: To usunie wszystkie drużyny, mecze i wyniki. Czy kontynuować?')) return;
    const res = await fetch('/api/admin/reset', { method: 'POST', credentials: 'include' });
    if (res.ok) { setSuccess('Turniej zresetowany.'); fetchData(); }
  };

  const addAdmin = async () => {
    if (!newAdminId.trim()) return;
    setError(''); setSuccess('');
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId: newAdminId.trim() })
    });
    const data = await res.json();
    if (res.ok) { setSuccess(`Dodano admina: ${data.username}`); setNewAdminId(''); fetchData(); }
    else setError(data.error);
  };

  const removeAdmin = async (userId) => {
    const res = await fetch(`/api/admin/admins/${userId}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) fetchData();
    else { const d = await res.json(); setError(d.error); }
  };

  if (!user) return (
    <div className="empty-state">
      <div className="empty-icon">🔐</div>
      <h3>Zaloguj się, aby uzyskać dostęp</h3>
    </div>
  );

  if (!user.is_admin) return (
    <div className="empty-state">
      <div className="empty-icon">🚫</div>
      <h3>Brak uprawnień administratora</h3>
      <p>Tylko administratorzy mogą uzyskać dostęp do tego panelu</p>
    </div>
  );

  if (loading) return <div className="empty-state"><p>Ładowanie...</p></div>;

  const phaseLabel = { registration: '📝 Rejestracja', active: '⚔️ Aktywny', finished: '🏁 Zakończony' };

  return (
    <div>
      <div className="page-header">
        <h1>⚙️ Panel Administratora</h1>
        <p>Zarządzaj turniejem i uprawnieniami</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Status bar */}
      <div className="status-bar" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 600 }}>Status turnieju:</div>
        <span className="badge badge-blue">{phaseLabel[status.phase] || status.phase}</span>
        {status.started_at && <span style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>
          Rozpoczęty: {new Date(status.started_at).toLocaleString('pl-PL')}
        </span>}
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Settings */}
        <div className="card">
          <div className="section-title">⚙️ Ustawienia turnieju</div>
          <div style={{ marginTop: '0.75rem' }}>
            <div className="form-group">
              <label>Nazwa turnieju</label>
              <input className="input" value={form.tournament_name}
                onChange={e => setForm(f => ({ ...f, tournament_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Maksymalna liczba drużyn</label>
              <input className="input" type="number" min="2" max="64" value={form.max_teams}
                onChange={e => setForm(f => ({ ...f, max_teams: e.target.value }))}
                disabled={status.phase !== 'registration'} />
              {status.phase !== 'registration' && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>Niedostępne po starcie turnieju</span>
              )}
            </div>
            <div className="form-group">
              <label>Discord Channel ID (powiadomienia)</label>
              <input className="input" value={form.discord_channel_id} placeholder="np. 1234567890123456789"
                onChange={e => setForm(f => ({ ...f, discord_channel_id: e.target.value }))} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
                Kliknij prawym na kanał → Kopiuj ID (włącz tryb dewelopera w DC)
              </span>
            </div>
            <button className="btn btn-primary" onClick={saveSettings}>💾 Zapisz ustawienia</button>
          </div>
        </div>

        {/* Tournament control */}
        <div className="card">
          <div className="section-title">🏆 Sterowanie turniejem</div>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Rozpocznij turniej</div>
              <div style={{ color: 'var(--text2)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                Losowo dobierze drużyny i wygeneruje drabinkę pucharową. Operacja nieodwracalna.
              </div>
              <button
                className="btn btn-gold"
                onClick={startTournament}
                disabled={status.phase !== 'registration'}
              >
                ▶ Rozpocznij i losuj drabinkę
              </button>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(248,113,113,0.2)' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.4rem', color: 'var(--red)' }}>Reset turnieju</div>
              <div style={{ color: 'var(--text2)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                Usuwa wszystkie drużyny, mecze i wyniki. Wraca do fazy rejestracji.
              </div>
              <button className="btn btn-danger" onClick={resetTournament}>
                🗑 Resetuj wszystko
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin management */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">👑 Administratorzy</div>
        <div style={{ marginTop: '0.75rem' }}>
          <div className="form-row" style={{ marginBottom: '1rem' }}>
            <input
              className="input"
              placeholder="Discord User ID (np. 123456789012345678)"
              value={newAdminId}
              onChange={e => setNewAdminId(e.target.value)}
            />
            <button className="btn btn-primary" onClick={addAdmin}>Dodaj admina</button>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text3)', marginBottom: '1rem' }}>
            Aby znaleźć User ID: Kliknij prawym na użytkownika w DC → Kopiuj ID (wymagany tryb dewelopera). Użytkownik musi się najpierw zalogować na stronie.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {adminUsers.map(admin => (
              <div key={admin.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.6rem', background: 'var(--bg3)', borderRadius: '8px'
              }}>
                <img
                  src={admin.avatar ? `https://cdn.discordapp.com/avatars/${admin.id}/${admin.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`}
                  alt="" style={{ width: 28, height: 28, borderRadius: '50%' }}
                />
                <span style={{ flex: 1, fontWeight: 500 }}>{admin.username}</span>
                <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>{admin.id}</span>
                {admin.id !== user.id && (
                  <button className="btn btn-danger" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                    onClick={() => removeAdmin(admin.id)}>
                    Usuń
                  </button>
                )}
                {admin.id === user.id && <span className="badge badge-gold">Ty</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All users */}
      <div className="card">
        <div className="section-title">👤 Wszyscy użytkownicy ({allUsers.length})</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Użytkownik</th>
                <th>Discord ID</th>
                <th>Rola</th>
                <th>Dołączył</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <img
                        src={u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`}
                        alt="" style={{ width: 24, height: 24, borderRadius: '50%' }}
                      />
                      {u.username}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text3)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.id}</td>
                  <td>
                    {u.is_admin
                      ? <span className="badge badge-gold">Admin</span>
                      : <span className="badge badge-gray">Użytkownik</span>
                    }
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>
                    {new Date(u.created_at).toLocaleDateString('pl-PL')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
