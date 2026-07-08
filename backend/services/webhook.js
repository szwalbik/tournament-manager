// 🔔 System powiadomień webhookowych
//
// Niezależny od bota Discord — admin może wkleić dowolny URL webhooka:
//  - Discord Webhook (np. https://discord.com/api/webhooks/...) -> wysyłamy
//    ładny embed w formacie natywnym dla Discorda,
//  - dowolny inny endpoint HTTP (Zapier, n8n, Slack incoming webhook,
//    własny serwer itp.) -> wysyłamy przewidywalny, generyczny JSON.
//
// Dzięki temu powiadomienia można podłączyć do czegokolwiek, nie tylko do
// bota Discord skonfigurowanego w .env.

const db = require('../db/database');

async function getWebhookUrl() {
  const row = await db.get("SELECT value FROM tournament_settings WHERE key = 'webhook_url'");
  return row?.value?.trim() || '';
}

function isDiscordWebhook(url) {
  return /discord(app)?\.com\/api\/webhooks\//i.test(url);
}

const EVENT_LABELS = {
  team_registered: '🆕 Nowa drużyna zarejestrowana',
  join_request: '📩 Prośba o dołączenie',
  member_joined: '✅ Gracz dołączył do drużyny',
  member_left: '🚪 Gracz opuścił drużynę',
  member_kicked: '👢 Gracz wyrzucony',
  tournament_started: '🏆 Turniej rozpoczęty',
  result_submitted: '📋 Wynik zgłoszony',
  match_finished: '🏁 Mecz zakończony',
  admin_added: '👑 Nowy administrator',
  settings_changed: '⚙️ Zmieniono ustawienia turnieju',
  backup_completed: '💾 Wykonano kopię zapasową',
  restore_completed: '♻️ Przywrócono dane z kopii zapasowej',
  test: '🧪 Testowe powiadomienie',
};

async function sendWebhook(event, data = {}) {
  const url = await getWebhookUrl();
  if (!url) return { ok: false, error: 'Webhook nie skonfigurowany' };

  const label = EVENT_LABELS[event] || event;
  const fields = Object.entries(data).map(([name, value]) => ({
    name, value: String(value), inline: true
  }));

  try {
    let body;
    if (isDiscordWebhook(url)) {
      body = {
        embeds: [{
          title: label,
          color: 0x5865F2,
          fields,
          timestamp: new Date().toISOString(),
          footer: { text: 'TourneyManager' },
        }]
      };
    } else {
      // Format generyczny — łatwy do przetworzenia przez dowolny odbiornik.
      body = {
        event,
        label,
        data,
        timestamp: new Date().toISOString(),
        source: 'tourneymanager',
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return { ok: false, error: `Webhook odpowiedział błędem HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { sendWebhook, getWebhookUrl };
