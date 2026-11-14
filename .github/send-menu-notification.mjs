import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const appId = JSON.parse(await readFile('menu-notifications-config.json', 'utf8')).appId;
const { ONESIGNAL_API_KEY: apiKey, WEEK: expectedWeek, MENU_RAW_URL: menuUrl } = process.env;
if (!appId || !apiKey) {
  console.log('OneSignal zatiaľ nie je pripojený.');
  process.exit(0);
}
const response = await fetch(menuUrl + '?check=' + Date.now());
if (!response.ok) throw new Error('Zverejnený lístok sa nepodarilo načítať.');
const data = await response.json();
const week = data.history?.find(item => item.id === data.publishedWeekId)?.data?.start;
if (!/^\d{4}-\d{2}-\d{2}$/.test(week || '') || (expectedWeek && expectedWeek !== week)) {
  console.log('Požadovaný týždeň už nie je verejnou ponukou.');
  process.exit(0);
}
// OneSignal expects a UUID. A stable key makes retries for this week idempotent.
const hash = createHash('sha256').update(appId + ':' + week).digest('hex');
const uuid = [hash.slice(0, 8), hash.slice(8, 12), '4' + hash.slice(13, 16), '8' + hash.slice(17, 20), hash.slice(20, 32)].join('-');
const sent = await fetch('https://api.onesignal.com/notifications?c=push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Key ' + apiKey },
  body: JSON.stringify({
    app_id: appId,
    included_segments: ['Subscribed Users'],
    headings: { en: 'U Mastina' },
    contents: { en: 'Nové obedové menu U Mastina je vonku' },
    url: 'https://pelinho100.github.io/u-mastina-menu/obedove-menu.html',
    idempotency_key: uuid
  })
});
if (!sent.ok) throw new Error('OneSignal odmietol odoslanie (' + sent.status + ').');
console.log('OneSignal spracoval požiadavku na oznámenie pre týždeň ' + week + '.');
