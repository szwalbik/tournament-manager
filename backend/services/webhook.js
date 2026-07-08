// 🔔 System powiadomień webhookowych
//
// Niezależny od bota Discord — admin może wkleić dowolny URL webhooka:
//  - Discord Webhook (np. https://discord.com/api/webhooks/...) -> wysyłamy
//    ładny embed w formacie natywnym dla Discorda, wizualnie spójny z tym,
//    co wysyła bot (te same kolory, emoji, pogrubienia, stopki),
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

// Te same kolory co w powiadomieniach bota (discord-client.js) — webhook ma
// wyglądać tak samo, niezależnie od tego, czy wiadomość przyszła od bota,
// czy z webhooka.
const COLORS = {
  blue:   0x5865F2,
  green:  0x3ECF8E,
  gold:   0xF0B429,
  red:    0xF87171,
  purple: 0x9B59B6,
  orange: 0xE67E22,
  grey:   0x99AAB5,
};

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

const EVENT_COLORS = {
  team_registered: COLORS.blue,
  join_request: COLORS.purple,
  member_joined: COLORS.green,
  member_left: COLORS.orange,
  member_kicked: COLORS.red,
  tournament_started: COLORS.gold,
  result_submitted: COLORS.purple,
  match_finished: COLORS.green,
  admin_added: COLORS.gold,
  settings_changed: COLORS.grey,
  backup_completed: COLORS.green,
  restore_completed: COLORS.purple,
  test: COLORS.blue,
};

const DEFAULT_FOOTER = { text: 'TourneyManager • Webhook' };

// Buduje embed „uszyty na miarę” konkretnego zdarzenia — z opisami,
// pogrubieniami i emoji w polach, tak samo jak robi to bot, a dla
// rozpoczęcia turnieju nawet ładniej (pełna lista par I rundy w jednym polu).
function buildEventEmbed(event, data) {
  const base = {
    color: EVENT_COLORS[event] ?? COLORS.blue,
    footer: DEFAULT_FOOTER,
    timestamp: new Date().toISOString(),
  };

  switch (event) {
    case 'team_registered':
      return {
        ...base,
        title: EVENT_LABELS[event],
        fields: [
          { name: '🏳️ Drużyna', value: `**${data.drużyna}**`, inline: true },
          { name: '👤 Kapitan', value: `${data.kapitan}`, inline: true },
        ],
      };

    case 'join_request':
      return {
        ...base,
        title: '📩 Prośba o dołączenie do drużyny',
        description: `**${data.gracz}** chce dołączyć do drużyny **${data.drużyna}**`,
        footer: { text: 'Kapitan może zaakceptować lub odrzucić na stronie' },
      };

    case 'member_joined':
      return {
        ...base,
        title: EVENT_LABELS[event],
        fields: [
          { name: '👤 Gracz', value: `${data.gracz}`, inline: true },
          { name: '🏳️ Drużyna', value: `**${data.drużyna}**`, inline: true },
        ],
      };

    case 'member_left':
      return {
        ...base,
        title: EVENT_LABELS[event],
        fields: [
          { name: '👤 Gracz', value: `${data.gracz}`, inline: true },
          { name: '🏳️ Drużyna', value: `${data.drużyna}`, inline: true },
        ],
      };

    case 'member_kicked':
      return {
        ...base,
        title: '👢 Gracz wyrzucony z drużyny',
        fields: [
          { name: '👤 Gracz', value: `${data.gracz}`, inline: true },
          { name: '🏳️ Drużyna', value: `${data.drużyna}`, inline: true },
        ],
      };

    case 'tournament_started': {
      const pairLines = Array.isArray(data.pary) && data.pary.length
        ? data.pary.map((p, i) => (
            p.bye
              ? `\`${i + 1}.\` **${p.team1}** — *bye (automatyczny awans)*`
              : `\`${i + 1}.\` **${p.team1}** ⚔️ **${p.team2}**`
          )).join('\n')
        : null;

      return {
        ...base,
        title: `🏆 ${data.turniej} — Turniej Rozpoczęty!`,
        description: 'Losowanie par zostało przeprowadzone. Niech najlepsi wygrają!',
        fields: [
          ...(pairLines ? [{ name: '⚔️ Pary I Rundy', value: pairLines }] : []),
          { name: '👥 Drużyny', value: `${data.drużyny}`, inline: true },
          { name: '🔢 Rundy', value: `${data.rundy}`, inline: true },
        ],
        footer: { text: 'Zgłaszaj wyniki na stronie turnieju' },
      };
    }

    case 'result_submitted':
      return {
        ...base,
        title: EVENT_LABELS[event],
        fields: [
          { name: '⚔️ Mecz', value: `**${data.mecz}**` },
          { name: '📊 Zgłoszony wynik', value: `**${data.wynik}**`, inline: true },
          { name: '🙋 Zgłosiła', value: `${data.zgłosił}`, inline: true },
        ],
        footer: { text: 'Druga drużyna musi potwierdzić wynik na stronie' },
      };

    case 'match_finished':
      return {
        ...base,
        title: `🏁 Mecz zakończony${data.tryb === 'admin' ? ' (Admin)' : ''}`,
        fields: [
          { name: '⚔️ Mecz', value: `**${data.mecz}**` },
          { name: '📊 Wynik', value: `**${data.wynik}**`, inline: true },
          { name: '🏆 Zwycięzca', value: `**${data.zwycięzca}**`, inline: true },
          { name: '🔢 Runda', value: `${data.runda}`, inline: true },
        ],
      };

    case 'admin_added':
      return {
        ...base,
        title: EVENT_LABELS[event],
        description: `**${data.dodał}** nadał uprawnienia administratora użytkownikowi **${data.nowy_admin}**`,
      };

    case 'settings_changed':
      return {
        ...base,
        title: EVENT_LABELS[event],
        description: `Administrator **${data.admin}** zmienił ustawienia turnieju`,
      };

    case 'backup_completed':
      return {
        ...base,
        title: EVENT_LABELS[event],
        description: 'Kopia zapasowa danych turnieju została zapisana',
      };

    case 'restore_completed':
      return {
        ...base,
        title: EVENT_LABELS[event],
        description: `Dane turnieju zostały przywrócone z kopii zapasowej${data.z ? ` (**${data.z}**)` : ''}`,
      };

    case 'test':
      return {
        ...base,
        title: EVENT_LABELS[event],
        description: `Wysłał **${data.wysłał}** o godzinie **${data.o}**\n\nJeśli widzisz tę wiadomość, webhook działa poprawnie ✅`,
      };

    default: {
      // Nieznane / niestandardowe zdarzenie — spójny generyczny układ
      // zamiast gołych pól bez formatowania.
      const fields = Object.entries(data).map(([name, value]) => ({
        name, value: `**${value}**`, inline: true,
      }));
      return { ...base, title: EVENT_LABELS[event] || event, fields };
    }
  }
}

async function sendWebhook(event, data = {}) {
  const url = await getWebhookUrl();
  if (!url) return { ok: false, error: 'Webhook nie skonfigurowany' };

  const label = EVENT_LABELS[event] || event;

  try {
    let body;
    if (isDiscordWebhook(url)) {
      body = {
        username: 'TourneyManager',
        embeds: [buildEventEmbed(event, data)],
      };
    } else {
      // Format generyczny — łatwy do przetworzenia przez dowolny odbiornik
      // (Zapier, n8n, Slack, własny serwer itp.).
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
