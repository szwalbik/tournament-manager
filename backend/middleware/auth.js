const db = require('../db/database');

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Musisz być zalogowany' });
  }
  next();
};

const requireAdmin = async (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Musisz być zalogowany' });
  }
  try {
    const user = await db.get('SELECT is_admin FROM users WHERE id = ?', [req.session.user.id]);
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Brak uprawnień administratora' });
    }
    next();
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
};

module.exports = { requireAuth, requireAdmin };
