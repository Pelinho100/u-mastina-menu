'use strict';

const $ = id => document.getElementById(id);
const days = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok'];
const categories = { dishes: 'Hlavné jedlá', soups: 'Polievky', sides: 'Prílohy' };
const defaults = {
  restaurant: 'Reštaurácia U Mastina', title: 'Obedové menu', hours: '10:00 – 14:00',
  orderphone: '', orderemail: '', orderinfo: '', owner: '', address: '', ico: '', dic: '', icdph: '', phone: '', footer: ''
};
const settingsLabels = {
  restaurant: 'Názov reštaurácie', title: 'Nadpis lístka', hours: 'Čas podávania',
  orderphone: 'Telefón na objednávky', orderemail: 'E-mail na objednávky', orderinfo: 'Pokyny k objednávke',
  owner: 'Meno majiteľa alebo názov prevádzkovateľa', address: 'Adresa prevádzky', ico: 'IČO',
  dic: 'DIČ', icdph: 'IČ DPH', phone: 'Kontaktný telefón', footer: 'Poznámka pre hostí'
};
const keys = {
  draft: 'umastina-weekly-v6-draft', state: 'umastina-weekly-v6-data',
  drafts: 'umastina-weekly-v8-drafts', token: 'umastina-weekly-v6-token', old: 'umastina-weekly-v1'
};
const github = 'https://api.github.com/repos/Pelinho100/u-mastina-menu/contents/menu-data.json';
const branch = 'menu-data';
const kitchenMode = new URLSearchParams(location.search).get('view') === 'kuchyna';

const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const clean = value => text(value).trim();
const esc = value => text(value).replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));
const fold = value => clean(value).toLocaleLowerCase('sk').normalize('NFD').replace(/\p{M}/gu, '');
const list = value => Array.isArray(value) ? value : [];
const clone = value => structuredClone(value);
const identifier = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function iso(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((value, index) => index ? String(value).padStart(2, '0') : value).join('-');
}
function dateAt(start, offset = 0) {
  const date = new Date(start + 'T12:00:00');
  date.setDate(date.getDate() + offset);
  return date;
}
function monday(value) {
  const date = /^\d{4}-\d\d-\d\d$/.test(text(value)) ? dateAt(value) : new Date();
  if (Number.isNaN(+date)) return monday();
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return iso(date);
}
const formatDate = (start, offset = 0) => dateAt(start, offset).toLocaleDateString('sk-SK');
const range = start => formatDate(start) + ' – ' + formatDate(start, 4);
const emptyMeal = () => ({ name: '', price: '', sides: Array(5).fill('') });
const emptySoup = () => ({ name: '', price: '' });
const emptyDay = () => ({ soups: [emptySoup(), emptySoup()], meals: Array.from({ length: 5 }, emptyMeal) });
const emptyWeek = (start = monday()) => ({ start, days: days.map(emptyDay) });
const emptyData = () => ({ schema: 1, library: { dishes: [], soups: [], sides: [] }, history: [] });

const allergenNames = [
  'Obilniny s lepkom', 'Kôrovce', 'Vajcia', 'Ryby', 'Arašidy', 'Sója',
  'Mlieko vrátane laktózy', 'Škrupinové plody', 'Zeler', 'Horčica', 'Sezam',
  'Oxid siričitý a siričitany', 'Vlčí bôb', 'Mäkkýše'
];
const allergenHints = [
  [/\b(vyprazan\w* syr\w*|trojobal\w*|obalovan\w*|ciernohorsk\w* rezen)\b/, [1, 3]],
  [/\b(muk\w*|struhank\w*|knedl\w*|cestovin\w*|chlieb|chleb\w*|rezanc\w*)\b/, [1]],
  [/\b(vajc\w*|vajec\w*|majonez\w*)\b/, [3]],
  [/\b(ryb\w*|heik\w*|losos\w*|tuniak\w*|tresk\w*|pstruh\w*)\b/, [4]],
  [/\b(krevet\w*|krab\w*|homar\w*)\b/, [2]],
  [/\b(arasid\w*|burak\w*)\b/, [5]],
  [/\b(soj\w*|tofu)\b/, [6]],
  [/\b(syr\w*|mliek\w*|mliec\w*|smotan\w*|maslo|maslov\w*|bryndz\w*|tvaroh\w*)\b/, [7]],
  [/\b(orech\w*|mandl\w*|pistaci\w*|kesu)\b/, [8]],
  [/\b(zeler\w*|vyvar\w*|bujon\w*)\b/, [9]],
  [/\b(horcic\w*)\b/, [10]],
  [/\b(tatarsk\w*)\b/, [3, 10]],
  [/\b(sezam\w*)\b/, [11]],
  [/\b(vlc\w* bob\w*|lupin\w*)\b/, [13]],
  [/\b(musl\w*|ustric\w*|kalamar\w*|chobotnic\w*|slavk\w*)\b/, [14]]
];
function allergenCodes(values) {
  return [...new Set(list(values).filter(code => Number.isInteger(code) && code >= 1 && code <= allergenNames.length))]
    .sort((a, b) => a - b);
}
function suggestedAllergens(name) {
  const normalized = fold(name);
  return allergenCodes(allergenHints.flatMap(([pattern, codes]) => pattern.test(normalized) ? codes : []));
}
function normalizeProfiles(profiles) {
  return Object.fromEntries(Object.entries(profiles || {}).filter(([key, codes]) =>
    /^(dishes|soups|sides):.+/.test(key) && Array.isArray(codes)
  ).map(([key, codes]) => [key, allergenCodes(codes)]));
}
function allergenComponents(item, kind) {
  const entries = [[kind, item.name], ...list(item.sides).map(side => ['sides', side])];
  return entries.filter(([, name]) => clean(name)).map(([category, name]) => {
    const key = category + ':' + fold(name);
    const confirmed = cache.allergenProfiles?.[key];
    return { key, name, confirmed, codes: confirmed ?? suggestedAllergens(name) };
  });
}
function allergenReview(item, kind) {
  const components = allergenComponents(item, kind);
  return {
    codes: allergenCodes(components.flatMap(component => component.codes)),
    pending: components.some(component => component.confirmed === undefined)
  };
}
function weekAllergens(menu, archived) {
  return menu.days.flatMap((day, i) =>
    [['soups', day.soups], ['dishes', day.meals]].flatMap(([kind, entries]) =>
      entries.filter(item => clean(item.name)).map(item => ({
        name: clean(item.name), day: days[i],
        pending: archived ? !Array.isArray(item.allergens) : allergenReview(item, kind).pending
      }))
    )
  );
}
function allergenButton(kind, index) {
  return `<button type="button" class="secondary allergen-button" data-allergens="${kind}.${index}" aria-haspopup="dialog">Alergény</button>`;
}
function updateAllergenButtons() {
  for (const button of $('day-editor').querySelectorAll('[data-allergens]')) {
    const [kind, index] = button.dataset.allergens.split('.');
    const item = week.days[dayIndex][kind][index];
    const review = allergenReview(item, kind === 'meals' ? 'dishes' : 'soups');
    button.hidden = !clean(item.name);
    button.textContent = review.pending ? 'Alergény na kontrolu' + (review.codes.length ? ' · ' + review.codes.join(', ') : '')
      : 'Alergény overené' + (review.codes.length ? ' · ' + review.codes.join(', ') : '');
  }
}
function openAllergens(path) {
  const [kind, index] = path.split('.');
  const item = week.days[dayIndex][kind][index];
  if (!clean(item?.name)) return;
  const components = [...new Map(allergenComponents(item, kind === 'meals' ? 'dishes' : 'soups')
    .map(component => [component.key, component])).values()];
  $('allergen-title').textContent = 'Alergény – ' + item.name;
  $('allergen-fields').innerHTML = components.map((component, componentIndex) => `
    <fieldset><legend>${esc(component.name)}</legend>
      <p class="muted">${component.confirmed !== undefined ? 'Uložené podľa receptúry' : 'Návrh podľa názvu. Skontroluj receptúru a etikety.'}</p>
      <div class="allergen-options">${allergenNames.map((name, i) =>
        `<label><input type="checkbox" name="component-${componentIndex}" value="${i + 1}" ${component.codes.includes(i + 1) ? 'checked' : ''}> ${i + 1}. ${name}</label>`
      ).join('')}</div>
    </fieldset>`).join('');
  $('allergen-confirm').checked = false;
  $('allergen-form').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profiles = Object.fromEntries(components.map((component, i) =>
      [component.key, form.getAll('component-' + i).map(Number)]
    ));
    stage({ allergenProfiles: profiles });
    updateAllergenButtons();
    renderPreview();
    $('allergen-dialog').close();
  };
  $('allergen-dialog').showModal();
}

function normalizeWeek(raw) {
  const start = monday(raw?.start);
  return {
    start,
    days: days.map((_, i) => {
      const day = raw?.days?.[i];
      if (!day) return emptyDay();
      return {
        soups: list(day.soups).map(soup => ({ name: text(soup?.name ?? soup), price: text(soup?.price), allergens: Array.isArray(soup?.allergens) ? allergenCodes(soup.allergens) : undefined })),
        meals: list(day.meals).map(meal => ({
          name: text(meal?.name), price: text(meal?.price),
          allergens: Array.isArray(meal?.allergens) ? allergenCodes(meal.allergens) : undefined,
          sides: Array.from({ length: 5 }, (_, j) => text(meal?.sides?.[j] ?? meal?.['side' + (j + 1)] ?? (j === 0 ? meal?.side : '')))
        }))
      };
    })
  };
}
function addEntries(library, incoming) {
  for (const category of Object.keys(categories)) {
    const values = library[category];
    for (const item of list(incoming?.[category])) {
      const name = clean(item?.name ?? item);
      if (name && !values.some(value => fold(value) === fold(name))) values.push(name);
    }
    values.sort((a, b) => a.localeCompare(b, 'sk'));
  }
}
function normalizeHistory(items) {
  return list(items).filter(item => Array.isArray(item?.data?.days) && item.data.days.length === 5)
    .map((item, i) => ({
      id: clean(item.id) || 'legacy-' + item.data.start + '-' + clean(item.saved) + '-' + i,
      saved: clean(item.saved), data: normalizeWeek(item.data)
    }));
}
function addHistory(data, items) {
  const seen = new Set(data.history.map(item => item.id));
  for (const item of items) {
    if (!seen.has(item.id)) {
      data.history.push(item);
      seen.add(item.id);
    }
  }
  data.history.sort((a, b) => {
    const aTime = /^\d{4}-\d\d-\d\dT/.test(a.saved) ? a.saved : '';
    const bTime = /^\d{4}-\d\d-\d\dT/.test(b.saved) ? b.saved : '';
    return bTime.localeCompare(aTime);
  });
}
function applyOperation(data, op) {
  if (op.allergenProfiles) data.allergenProfiles = { ...data.allergenProfiles, ...normalizeProfiles(op.allergenProfiles) };
  if (op.settings) data.settings = { ...data.settings, ...normalizeSettings(op.settings) };
  if (op.entries) addEntries(data.library, op.entries);
  if (op.replacedHistoryIds) {
    const replaced = new Set(op.replacedHistoryIds);
    data.history = data.history.filter(item => !replaced.has(item.id));
  }
  if (op.history) addHistory(data, op.history);
  if (op.edit) {
    const { category, before, after } = op.edit;
    data.library[category] = data.library[category].filter(item => fold(item) !== fold(before));
    if (after) addEntries(data.library, { [category]: [after] });
  }
  return data;
}
function legacyState() {
  const data = emptyData();
  const old = read(keys.old + '-library', {});
  const daily = read('mastina_database_v2', {});
  addEntries(data.library, old);
  addEntries(data.library, daily);
  addEntries(data.library, { sides: list(daily.dishes).flatMap(dish => [dish?.side1, dish?.side2, dish?.side3]) });
  const oldHistory = normalizeHistory(read(keys.old + '-history', []));
  const last = read(keys.old, null);
  if (!oldHistory.length && Array.isArray(last?.days)) {
    oldHistory.push({ id: 'legacy-current-' + last.start, saved: '', data: normalizeWeek(last) });
  }
  addHistory(data, oldHistory);
  const seed = { id: identifier(), entries: clone(data.library), history: clone(data.history) };
  return { data, queue: Object.values(data.library).some(values => values.length) || data.history.length ? [seed] : [] };
}
const initialState = read(keys.state, null) || legacyState();
let cache = initialState.data;
let week = normalizeWeek(read(keys.draft, null) || read(keys.old, null) || cache.history[0]?.data || emptyWeek());
function normalizeSettings(value) {
  return Object.fromEntries(Object.keys(defaults).filter(key => typeof value?.[key] === 'string')
    .map(key => [key, value[key].slice(0, 150)]));
}
let settingsDirty = false;
let settings = {
  ...defaults,
  ...Object.fromEntries(['orderphone', 'address', 'ico', 'phone', 'footer'].map(key => [key, localStorage.getItem('mastina_' + key) || ''])),
  ...read('umastina-weekly-v6-settings', {}),
  ...cache.settings,
  ...read('umastina-weekly-v7-settings-draft', {})
};
settingsDirty = Boolean(read('umastina-weekly-v7-settings-draft', null));
let dayIndex = 0;
let category = 'dishes';
let syncJob = null;
let token = sessionStorage.getItem(keys.token) || '';
let pickerTarget = null;
let kitchenSelection = '';
let kitchenShared = [];
if (read(keys.draft + '-dirty', false)) {
  const drafts = read(keys.drafts, {});
  if (!drafts[week.start]) {
    drafts[week.start] = week;
    localStorage.setItem(keys.drafts, JSON.stringify(drafts));
  }
  localStorage.removeItem(keys.draft + '-dirty');
}
const initialDraft = read(keys.drafts, {})[week.start];
week = normalizeWeek(initialDraft || week);
let originalWeekStart = initialDraft?.originalWeekStart || week.start;
let draftDirty = Boolean(initialDraft);
let archiveStart = '';

function writeState(value) {
  localStorage.setItem(keys.state, JSON.stringify(value));
  cache = value.data;
}
if (!read(keys.state, null)) writeState(initialState);
function stage(operation) {
  const state = read(keys.state, initialState);
  const entry = { id: identifier(), ...operation };
  applyOperation(state.data, entry);
  state.queue.push(entry);
  writeState(state);
  refreshLists();
  if (token) sync().catch(showSyncError);
}
function updateDrafts(change) {
  const drafts = read(keys.drafts, {});
  change(drafts);
  localStorage.setItem(keys.drafts, JSON.stringify(drafts));
}
function renderDraftStatus() {
  $('draft-status').textContent = draftDirty
    ? 'Rozpracované · automaticky uložené v tomto prehliadači'
    : 'Zmeny sa priebežne ukladajú ako rozpracované menu.';
  $('draft-status').classList.toggle('draft-active', draftDirty);
}
function markDraft() {
  updateDrafts(drafts => { drafts[week.start] = { ...week, originalWeekStart }; });
  localStorage.setItem(keys.draft, JSON.stringify(week));
  if (!draftDirty) {
    draftDirty = true;
    renderDraftStatus();
  }
  renderPreview();
}
function setWeek(next, isDraft = false) {
  week = normalizeWeek(next);
  originalWeekStart = next.originalWeekStart || week.start;
  draftDirty = isDraft;
  localStorage.setItem(keys.draft, JSON.stringify(week));
  renderEditor();
  renderDraftStatus();
  renderPreview();
}
function openWeek(start) {
  const draft = read(keys.drafts, {})[start];
  const saved = cache.history.find(item => item.data.start === start);
  dayIndex = 0;
  setWeek(draft || saved?.data || emptyWeek(start), Boolean(draft));
  openView('editor');
}
function changeWeekDate(value) {
  const start = value ? monday(value) : week.start;
  if (start === week.start) {
    $('start').value = week.start;
    return;
  }
  const drafts = read(keys.drafts, {});
  const saved = cache.history.some(item => item.data.start === week.start);
  if (!draftDirty && !saved) {
    openWeek(start);
    return;
  }
  const occupied = cache.history.some(item => item.data.start === start);
  if (drafts[start] || (occupied && start !== originalWeekStart)) {
    $('start').value = week.start;
    notify('Pre týždeň ' + range(start) + ' už existuje menu. Otvor ho cez Uložené týždne alebo vyber iný dátum.', true);
    return;
  }
  const previousStart = week.start;
  week.start = start;
  updateDrafts(items => {
    delete items[previousStart];
    items[start] = { ...week, originalWeekStart };
  });
  setWeek({ ...week, originalWeekStart }, true);
  notify('Dátum je upravený. Klikni na Uložiť týždeň, aby sa zmena prejavila v archíve.');
}
function notify(message, error = false) {
  $('notice').hidden = false;
  $('notice').textContent = message;
  $('notice').classList.toggle('error', error);
}
function kitchenStatus(message) {
  $('kitchen-status').hidden = !message;
  $('kitchen-status').textContent = message;
}
const lookupLabels = { dishes: 'Vybrať hlavné jedlo', soups: 'Vybrať polievku', sides: 'Vybrať prílohu' };
function pickerField(kind, path, label, value) {
  const id = 'field-' + path;
  return `<div class="field"><label for="${id}">${label}</label><div class="pick-field">
    <input id="${id}" maxlength="160" data-path="${path}" value="${esc(value)}">
    <button data-pick="${kind}" data-target="${id}" aria-label="${lookupLabels[kind]} · ${label}" title="${lookupLabels[kind]}" aria-haspopup="dialog">▼</button>
  </div></div>`;
}
function priceField(path, value, label = 'Cena €') {
  return `<label>${label}<input data-path="${path}" inputmode="decimal" maxlength="10" value="${esc(value)}" placeholder="0,00"></label>`;
}
function renderEditor() {
  $('start').value = week.start;
  updateKitchenLink();
  $('week-range').textContent = range(week.start);
  $('day-tabs').innerHTML = days.map((day, i) => `<button data-day="${i}" aria-pressed="${dayIndex === i}"><span>${day}</span><small>${formatDate(week.start, i)}</small></button>`).join('');
  const day = week.days[dayIndex];
  $('day-editor').innerHTML = `
    <h2 class="day-heading">${days[dayIndex]} · ${formatDate(week.start, dayIndex)}</h2>
    <section class="edit-card"><div class="card-title"><h3>Polievky</h3>${day.soups.length < 2 ? '<button class="secondary" data-action="add-soup">+ Pridať polievku</button>' : ''}</div>
      ${day.soups.map((soup, i) => `<div class="soup-line">${pickerField('soups', 'soups.' + i + '.name', 'Polievka ' + (i + 1), soup.name)}
        ${priceField('soups.' + i + '.price', soup.price)}<button class="icon remove" data-action="remove-soup" data-index="${i}" aria-label="Odobrať polievku ${i + 1}" title="Odobrať polievku">×</button>${allergenButton('soups', i)}</div>`).join('')}
      ${day.soups.length ? '' : '<p class="muted">Bez polievky</p>'}
    </section>
    <div class="card-title"><h3>Hlavné jedlá</h3><button class="primary" data-action="add-meal">+ Pridať jedlo</button></div>
    ${day.meals.map((meal, i) => `<section class="meal-card"><div class="card-title"><h3>Jedlo ${i + 1}</h3><button class="remove" data-action="remove-meal" data-index="${i}" aria-label="Odobrať jedlo ${i + 1}">× Odobrať</button></div>
      <div class="meal-top">${pickerField('dishes', 'meals.' + i + '.name', 'Hlavné jedlo', meal.name)}${priceField('meals.' + i + '.price', meal.price)}</div>
      <h3 class="sides-heading">Prílohy</h3><div class="sides">${meal.sides.map((side, j) => pickerField('sides', 'meals.' + i + '.sides.' + j, 'Príloha ' + (j + 1), side)).join('')}</div>
      ${allergenButton('meals', i)}
    </section>`).join('')}
    ${day.meals.length ? '<button class="add-meal secondary" data-action="add-meal">+ Pridať jedlo</button>' : ''}
  `;
  updateAllergenButtons();
}
function readEntryChanges(event) {
  const path = event.target.dataset.path;
  if (!path) return;
  const parts = path.split('.');
  const last = parts.pop();
  const parent = parts.reduce((target, name) => target[name], week.days[dayIndex]);
  parent[last] = event.target.value;
  markDraft();
  updateAllergenButtons();
}
function rememberEntry(event) {
  const path = event.target.dataset.path || '';
  const category = /^(meals|soups)\.\d+\.name$/.test(path)
    ? (path.startsWith('meals') ? 'dishes' : 'soups')
    : /^meals\.\d+\.sides\.\d+$/.test(path) ? 'sides' : '';
  const name = clean(event.target.value);
  if (category && name && !cache.library[category].some(item => fold(item) === fold(name))) {
    stage({ entries: { [category]: [name] } });
  }
}
function alterDay(event) {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.allergens) {
    openAllergens(button.dataset.allergens);
    return;
  }
  if (button.dataset.pick) {
    pickerTarget = $(button.dataset.target);
    $('picker-title').textContent = lookupLabels[button.dataset.pick];
    $('picker').dataset.kind = button.dataset.pick;
    $('picker-search').value = '';
    renderPicker();
    $('picker').showModal();
    $('picker-search').focus();
    return;
  }
  const day = week.days[dayIndex];
  const index = Number(button.dataset.index);
  switch (button.dataset.action) {
    case 'add-meal': day.meals.push(emptyMeal()); break;
    case 'remove-meal': day.meals.splice(index, 1); break;
    case 'add-soup': day.soups.push(emptySoup()); break;
    case 'remove-soup': day.soups.splice(index, 1); break;
    default: return;
  }
  renderEditor();
  markDraft();
  if (button.dataset.action === 'add-meal') $('field-meals.' + (day.meals.length - 1) + '.name').focus();
  if (button.dataset.action === 'add-soup') $('field-soups.' + (day.soups.length - 1) + '.name').focus();
}
function matching(values, query) {
  const needle = fold(query);
  const results = values.filter(value => fold(value).includes(needle));
  return results.sort((a, b) => Number(fold(b).startsWith(needle)) - Number(fold(a).startsWith(needle)) || a.localeCompare(b, 'sk'));
}
function renderPicker() {
  const kind = $('picker').dataset.kind;
  const results = matching(cache.library[kind], $('picker-search').value);
  $('picker-results').replaceChildren();
  if (!results.length) $('picker-results').innerHTML = '<p class="muted">Žiadne zodpovedajúce položky. Názov môžeš napísať aj priamo do kolónky.</p>';
  for (const value of results) {
    const button = document.createElement('button');
    button.className = 'secondary';
    button.textContent = value;
    button.onclick = () => {
      pickerTarget.value = value;
      pickerTarget.dispatchEvent(new Event('input', { bubbles: true }));
      $('picker').close();
    };
    $('picker-results').append(button);
  }
}
function renderDatabase() {
  $('category-tabs').innerHTML = Object.entries(categories).map(([id, title]) =>
    `<button data-category="${id}" aria-pressed="${category === id}">${title} <small>${cache.library[id].length}</small></button>`
  ).join('');
  const matches = matching(cache.library[category], $('database-search').value);
  $('database-list').innerHTML = matches.map(value => `<div class="db-row"><span>${esc(value)}</span><button class="secondary" data-rename="${esc(value)}">Premenovať</button><button class="remove" data-delete="${esc(value)}">Odobrať</button></div>`).join('') || '<p class="muted">Žiadne zodpovedajúce položky.</p>';
}
function renderSettings() {
  const groups = [
    ['Jedálny lístok', ['restaurant', 'title', 'hours', 'footer']],
    ['Objednávky', ['orderphone', 'orderemail', 'orderinfo']],
    ['Prevádzkovateľ a kontakt', ['owner', 'address', 'ico', 'dic', 'icdph', 'phone']]
  ];
  $('settings-fields').innerHTML = groups.map(([heading, fields]) =>
    `<fieldset class="settings-fields"><legend>${heading}</legend>${fields.map(key =>
      `<label>${settingsLabels[key]}<input data-setting="${key}" maxlength="150" value="${esc(settings[key])}"${key === 'orderphone' || key === 'phone' ? ' inputmode="tel"' : key === 'orderemail' ? ' inputmode="email"' : ''}></label>`
    ).join('')}</fieldset>`
  ).join('');
}
function dateLabel(saved) {
  const parsed = /^\d{4}-\d\d-\d\dT/.test(saved) && new Date(saved);
  return parsed && !Number.isNaN(+parsed) ? parsed.toLocaleString('sk-SK') : saved;
}
function renderArchive() {
  const weeks = new Map();
  for (const item of cache.history) {
    if (!weeks.has(item.data.start)) weeks.set(item.data.start, item);
  }
  const starts = [...weeks.keys()].sort().reverse();
  archiveStart = weeks.has(archiveStart) ? archiveStart : starts[0] || '';
  const selected = weeks.get(archiveStart);
  $('archive-week').disabled = !starts.length;
  $('archive-week').innerHTML = starts.length
    ? starts.map(start => `<option value="${esc(start)}">${range(start)}</option>`).join('')
    : '<option>Žiadne uložené týždne</option>';
  if (selected) $('archive-week').value = archiveStart;
  $('archive-details').innerHTML = selected ? `
    <div class="archive-actions">
      <span class="muted">${selected.saved ? 'Uložené ' + esc(dateLabel(selected.saved)) : ''}</span>
      <button class="secondary" data-open-week="${esc(archiveStart)}">${read(keys.drafts, {})[archiveStart] ? 'Pokračovať v rozpísanej úprave' : 'Otvoriť v editore'}</button>
    </div>
    <div class="archive-days">${selected.data.days.map((day, i) => renderDay(day, i, archiveStart)).join('')}</div>
  ` : '<p class="muted">Po kliknutí na „Uložiť týždeň“ sa tu zobrazí hotové menu.</p>';
  const drafts = Object.keys(read(keys.drafts, {})).sort().reverse();
  $('draft-list').innerHTML = drafts.length ? drafts.map(start =>
    `<div class="archive-actions"><strong>${range(start)}</strong><button class="secondary" data-open-week="${esc(start)}">Pokračovať v úprave</button></div>`
  ).join('') : '<p class="muted">Žiadne rozpracované týždne.</p>';
}
function refreshLists() {
  $('load-last').disabled = !cache.history.length;
  renderArchive();
  if (!$('archive').hidden) renderPreview();
  renderDatabase();
}
function priceLabel(raw) {
  const value = clean(raw).replace(/\s*€$/, '').replace(',', '.');
  if (!value) return '';
  return /^\d+(\.\d{1,2})?$/.test(value)
    ? new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(Number(value))
    : esc(value) + ' €';
}
function renderDay(day, i, start, kitchen = false, archived = true) {
  const heading = kitchen ? 'h2' : 'h3';
  const renderRows = (items, meals) => items.filter(item => clean(item.name)).map((item, row) => {
    const sides = list(item.sides).map(clean).filter(Boolean);
    const review = kitchen || archived ? null : allergenReview(item, meals ? 'dishes' : 'soups');
    const codes = review ? (review.pending ? null : review.codes) : item.allergens;
    const allergens = !kitchen && codes?.length ? '<div class="print-allergens">Obsahuje: ' + codes.join(', ') + '</div>' : '';
    return `<div class="print-row"><strong>${meals ? '<span class="meal-number">' + (row + 1) + '.</span> ' : ''}${esc(clean(item.name))}</strong><span class="print-price">${priceLabel(item.price)}</span>${sides.length ? '<small>' + sides.map(esc).join(' · ') + '</small>' : ''}${allergens}</div>`;
  }).join('');
  const soups = renderRows(day.soups, false);
  const meals = renderRows(day.meals, true);
  return `<section class="${kitchen ? 'kitchen-day' : 'print-day'}"><${heading}><span>${days[i]}</span><time datetime="${iso(dateAt(start, i))}">${formatDate(start, i)}</time></${heading}>
    ${soups ? '<div class="print-group"><h4>Polievky</h4>' + soups + '</div>' : ''}
    ${meals ? '<div class="print-group"><h4>Hlavné jedlá</h4>' + meals + '</div>' : ''}
    ${soups || meals ? '' : '<p class="empty-print">Menu zatiaľ nie je vyplnené.</p>'}</section>`;
}
function fitPaper() {
  const paper = $('paper');
  const frame = $('paper-frame');
  const inner = paper.firstElementChild;
  if (!frame.clientWidth || !inner) return;
  const size = getComputedStyle(paper);
  const height = parseFloat(size.height) - parseFloat(size.paddingTop) - parseFloat(size.paddingBottom);
  inner.style.transform = '';
  inner.style.width = '100%';
  inner.style.minHeight = '0';
  // Measure the natural layout, then scale it as one unit so the footer
  // still reaches the bottom when a full week needs smaller type.
  const fit = Math.min(1, height / (inner.offsetHeight + 1));
  if (fit < 1) {
    inner.style.width = 100 / fit + '%';
    // A wider line can fit more text. Keep the initial scale to fit the
    // widest content and fill the remaining height with flexible space.
    inner.style.transform = 'scale(' + fit + ')';
  }
  inner.style.minHeight = height / fit + 'px';
  paper.style.transform = 'scale(' + frame.clientWidth / parseFloat(size.width) + ')';
}
function renderPreview() {
  const saved = $('archive').hidden ? null : cache.history.find(item => item.data.start === archiveStart);
  const previewWeek = saved?.data || week;
  const cards = previewWeek.days.map((day, i) => renderDay(day, i, previewWeek.start, false, Boolean(saved)));
  const entries = weekAllergens(previewWeek, Boolean(saved));
  const pending = entries.filter(item => item.pending);
  $('allergen-print-status').hidden = !pending.length;
  $('allergen-print-status').textContent = pending.length
    ? 'Pred tlačou over alergény v editore (' + pending.length + ' položiek).' + (saved ? ' Potom týždeň znovu ulož.' : '')
    : '';
  document.body.classList.toggle('allergens-pending', Boolean(pending.length));
  const contact = [
    settings.owner, settings.address, clean(settings.ico) && 'IČO ' + clean(settings.ico),
    clean(settings.dic) && 'DIČ ' + clean(settings.dic), clean(settings.icdph) && 'IČ DPH ' + clean(settings.icdph),
    clean(settings.phone) && 'Tel. ' + clean(settings.phone)
  ].map(clean).filter(Boolean).map(esc);
  const order = [settings.orderphone, settings.orderemail].map(clean).filter(Boolean).map(esc);
  const orderInfo = clean(settings.orderinfo);
  const note = clean(settings.footer);
  $('paper').innerHTML = `<div class="paper-inner"><header class="paper-header">
    <div class="paper-ornament" aria-hidden="true"><span></span></div>
    ${settings.restaurant ? '<div class="restaurant">' + esc(settings.restaurant) + '</div>' : ''}
    <h2>${esc(settings.title)}</h2><div class="paper-range"><span>${range(previewWeek.start)}</span>${clean(settings.hours) ? '<span>' + esc(clean(settings.hours)) + '</span>' : ''}</div></header>
    <div class="paper-days">${cards.join('')}</div>
    ${contact.length || order.length || orderInfo || note || entries.length ? `<footer class="paper-footer">
      ${entries.length ? '<p class="allergen-legend"><b>Alergény:</b> ' + allergenNames.map((name, i) => (i + 1) + ' ' + name).join(' · ') + '</p>' : ''}
      ${order.length || orderInfo ? `<section class="paper-orders"><h3>Objednávky</h3>
        ${order.length ? '<div class="order-details">' + order.map(item => '<strong>' + item + '</strong>').join('') + '</div>' : ''}
        ${orderInfo ? '<p>' + esc(orderInfo) + '</p>' : ''}</section>` : ''}
      ${contact.length ? '<section class="paper-contact"><h3>Prevádzkovateľ a kontakt</h3><p>' + contact.join(' · ') + '</p></section>' : ''}
      ${note ? '<p class="paper-note">' + esc(note) + '</p>' : ''}</footer>` : ''}
    </div>`;
  fitPaper();
}
function collectWeek() {
  return {
    dishes: week.days.flatMap(day => day.meals.map(meal => meal.name)),
    soups: week.days.flatMap(day => day.soups.map(soup => soup.name)),
    sides: week.days.flatMap(day => day.meals.filter(meal => clean(meal.name)).flatMap(meal => meal.sides))
  };
}
function saveWeek() {
  const latest = read(keys.state, initialState).data.history;
  const moved = originalWeekStart !== week.start;
  if (moved && latest.some(item => item.data.start === week.start)) {
    notify('Pre nový dátum už existuje uložené menu. Vyber iný dátum.', true);
    return;
  }
  const replacedHistoryIds = moved ? latest.filter(item => item.data.start === originalWeekStart).map(item => item.id) : [];
  const savedWeek = clone(week);
  for (const day of savedWeek.days) {
    for (const [kind, items] of [['soups', day.soups], ['dishes', day.meals]]) {
      for (const item of items) {
        const review = allergenReview(item, kind);
        item.allergens = review.pending ? undefined : review.codes;
      }
    }
  }
  stage({
    entries: collectWeek(),
    replacedHistoryIds,
    history: [{ id: identifier(), saved: new Date().toISOString(), data: savedWeek }]
  });
  updateDrafts(drafts => { delete drafts[week.start]; });
  archiveStart = week.start;
  setWeek(week);
  renderArchive();
  notify(token ? 'Týždeň je v archíve. Prebieha synchronizácia s GitHubom.' : 'Týždeň je v archíve v tomto prehliadači.');
}
function showSavedWeek(item) {
  if (!item) return;
  archiveStart = item.data.start;
  openView('archive');
}
function warnings() {
  return week.days.flatMap((day, i) => {
    const result = [];
    const meals = day.meals.filter(meal => clean(meal.name));
    if (!day.soups.some(soup => clean(soup.name))) result.push(days[i] + ' – chýba polievka');
    if (!meals.length) result.push(days[i] + ' – chýba hlavné jedlo');
    for (const meal of meals) {
      if (!/\b(salat|salad)\b/.test(fold(meal.name)) && !meal.sides.some(side => clean(side))) {
        result.push(days[i] + ' – chýba príloha k jedlu „' + clean(meal.name) + '“');
      }
    }
    return result;
  });
}
function renderKitchen() {
  const items = new Map();
  const combined = emptyData();
  addHistory(combined, kitchenShared);
  addHistory(combined, cache.history);
  for (const item of combined.history) if (!items.has(item.data.start)) items.set(item.data.start, item.data);
  const requested = new URLSearchParams(location.search).get('tyzden');
  if (requested === week.start && (draftDirty || !items.has(requested))) items.set(week.start, week);
  const entries = [...items.keys()].sort().reverse();
  const selected = items.has(kitchenSelection) ? kitchenSelection : [requested, monday(), entries[0]].find(key => items.has(key));
  $('kitchen-history').innerHTML = entries.length
    ? entries.map(key => `<option value="${key}">${range(key)}</option>`).join('')
    : '<option value="">Žiadny uložený týždeň</option>';
  $('kitchen-history').disabled = !entries.length;
  $('kitchen-print').disabled = !selected;
  if (selected) $('kitchen-history').value = selected;
  const chosen = items.get(selected);
  $('kitchen-days').innerHTML = chosen ? chosen.days.map((day, i) => renderDay(day, i, chosen.start, true)).join('') : '';
}

async function githubAccessError(response, action) {
  const body = await response.json().catch(() => ({}));
  const message = typeof body?.message === 'string' ? body.message : '';
  if (response.status === 429 || response.headers?.get('x-ratelimit-remaining') === '0' ||
      response.headers?.get('retry-after') || /rate limit|abuse detection/i.test(message)) {
    return 'GitHub dočasne obmedzil počet požiadaviek. Počkaj a skús znova s tým istým tokenom.';
  }
  if (/protected branch|repository rule|GH013|GH006/i.test(message)) {
    return 'Pravidlá repozitára GitHub zablokovali zápis. Skontroluj pravidlá pre vetvy menu-data a menu-pairing.';
  }
  return 'GitHub odmietol ' + action + '. V nastaveniach tokenu vyber Pelinho100 → u-mastina-menu → Contents: Read and write a ulož zmeny.';
}
async function request(method = 'GET', auth = '', body) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (auth) headers.Authorization = 'Bearer ' + auth;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(github + '?ref=' + branch, {
    method, headers, cache: 'no-store', body: body && JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = [403, 429].includes(response.status)
      ? await githubAccessError(response, method === 'PUT' ? 'zápis menu' : 'načítanie menu')
      : {
      401: 'GitHub token je neplatný alebo vypršal.',
      404: 'GitHub súbor sa nenašiel. Skontroluj prístup k repozitáru u-mastina-menu.',
      409: 'Databázu práve zmenilo iné zariadenie.',
      422: 'GitHub zamietol zápis databázy.'
    }[response.status];
    const error = new Error(detail || 'GitHub vrátil chybu ' + response.status + '.');
    error.status = response.status;
    throw error;
  }
  return response.json();
}
async function remoteData(auth = '') {
  const file = await request('GET', auth);
  if (file.encoding !== 'base64' || !file.sha) throw new Error('Neplatný súbor databázy na GitHube.');
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(file.content), char => char.charCodeAt(0)));
  const raw = JSON.parse(decoded);
  if (raw.schema !== 1 || !raw.library || !Array.isArray(raw.history)) throw new Error('Neplatný formát databázy na GitHube.');
  const data = emptyData();
  addEntries(data.library, raw.library);
  addHistory(data, normalizeHistory(raw.history));
  if (raw.allergenProfiles) data.allergenProfiles = normalizeProfiles(raw.allergenProfiles);
  if (raw.settings) data.settings = normalizeSettings(raw.settings);
  return { sha: file.sha, data };
}
function encode(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2) + '\n');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function syncLabels(message) {
  $('sync-state').textContent = message;
  $('github-status').textContent = message;
  $('open-sync').textContent = token ? 'GitHub synchronizácia' : 'Pripojiť GitHub';
  pairingControls();
  $('sync-now').hidden = !token;
  $('disconnect').hidden = !token;
}
function showSyncError(error) {
  const detail = error instanceof TypeError ? 'GitHub je momentálne nedostupný.' : error.message;
  syncLabels(detail + ' Lokálne zmeny sú uložené.');
  notify(detail + ' Lokálne zmeny sú uložené.', true);
}
async function syncWork(auth, verifyWrite) {
  let mustVerify = verifyWrite;
  syncLabels('Synchronizujem s GitHubom…');
  for (let attempt = 0; attempt < 5; attempt++) {
    const remote = await remoteData(auth);
    const pending = read(keys.state, initialState).queue;
    if (pending.length || mustVerify) {
      for (const op of pending) applyOperation(remote.data, op);
      try {
        await request('PUT', auth, {
          branch, sha: remote.sha, content: encode(remote.data),
          message: pending.length ? 'Uložiť údaje týždenného menu' : 'Overiť prístup editora k databáze'
        });
      } catch (error) {
        if (error.status === 409) continue;
        throw error;
      }
      mustVerify = false;
    }
    const finished = new Set(pending.map(op => op.id));
    const remaining = read(keys.state, initialState).queue.filter(op => !finished.has(op.id));
    for (const op of remaining) applyOperation(remote.data, op);
    writeState({ data: remote.data, queue: remaining });
    refreshLists();
    updateAllergenButtons();
    renderPreview();
    if (!settingsDirty && cache.settings) {
      Object.assign(settings, cache.settings);
      localStorage.setItem('umastina-weekly-v6-settings', JSON.stringify(settings));
      renderSettings();
      renderPreview();
    }
    if (!remaining.length) {
      syncLabels('Údaje sú synchronizované s GitHubom.');
      if (pending.length) notify('Zmeny sú uložené aj na GitHube.');
      return;
    }
  }
  throw new Error('Synchronizáciu skús znova.');
}
function sync(auth = token, verifyWrite = false) {
  if (!syncJob) {
    syncJob = syncWork(auth, verifyWrite).finally(() => { syncJob = null; });
  }
  return syncJob;
}
function updateKitchenLink() {
  $('kitchen-link').href = '?view=kuchyna&tyzden=' + encodeURIComponent(week.start);
}
function openView(view) {
  for (const button of document.querySelectorAll('[data-view]')) {
    const active = button.dataset.view === view;
    $(button.dataset.view).hidden = !active;
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  $('save').hidden = view === 'archive';
  if (view === 'archive') renderArchive();
  renderPreview();
  document.querySelector('.work-area').scrollTop = 0;
}
function backup() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ data: week, library: cache.library, allergenProfiles: cache.allergenProfiles, history: cache.history, drafts: read(keys.drafts, {}), settings }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'u-mastina-tyzden-zaloha.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function importBackup(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    const incoming = JSON.parse(await file.text());
    if (!Array.isArray(incoming?.data?.days) || incoming.data.days.length !== 5) throw new Error('Záloha musí obsahovať päť dní.');
    const imported = normalizeWeek(incoming.data);
    const localDrafts = read(keys.drafts, {});
    if (localDrafts[imported.start] && !confirm('Nahradiť rozpracované menu pre ' + range(imported.start) + ' touto zálohou?')) return;
    stage({ entries: incoming.library, allergenProfiles: incoming.allergenProfiles, history: normalizeHistory(incoming.history) });
    updateDrafts(drafts => {
      for (const draft of Object.values(incoming.drafts || {})) {
        if (!Array.isArray(draft?.days) || draft.days.length !== 5) continue;
        const normalized = normalizeWeek(draft);
        drafts[normalized.start] ??= normalized;
      }
    });
    setWeek(imported, true);
    if (incoming.settings) {
      for (const key of Object.keys(defaults)) {
        if (typeof incoming.settings[key] === 'string') settings[key] = incoming.settings[key];
      }
      settingsDirty = true;
      localStorage.setItem('umastina-weekly-v7-settings-draft', JSON.stringify(settings));
      renderSettings();
      renderPreview();
    }
    markDraft();
    notify('Záloha bola načítaná. Rozpracované menu môžeš pridať do histórie tlačidlom Uložiť týždeň.');
  } catch (error) {
    notify('Import zlyhal. ' + error.message, true);
  }
}
async function refreshKitchen() {
  $('kitchen-refresh').disabled = true;
  kitchenStatus('Načítavam uložené týždne…');
  try {
    const { data } = await remoteData(token);
    kitchenShared = data.history;
    renderKitchen();
    kitchenStatus($('kitchen-history').disabled ? 'Zatiaľ nie je uložený žiadny týždeň.' : '');
  } catch {
    kitchenStatus('GitHub je nedostupný. Zobrazené sú týždne uložené v tomto prehliadači.');
  } finally {
    $('kitchen-refresh').disabled = false;
  }
}
let activePairing = null;
const pairingHash = location.hash;
const approval = menuPairing.fromHash(pairingHash);
let approvalPending = Boolean(approval);

function pairingControls() {
  $('start-pairing').hidden = Boolean(token || activePairing || approvalPending);
  $('pairing-offer').hidden = !activePairing;
  $('manual-help').hidden = Boolean(token || activePairing);
  $('github-form').hidden = Boolean(token || activePairing);
  $('approve-pairing').hidden = !(approvalPending && token);
}
function cancelPairing() {
  if (activePairing) clearTimeout(activePairing.timer);
  activePairing = null;
  pairingControls();
}
async function connect(auth, verifyWrite) {
  await sync(auth, verifyWrite);
  await menuPairing.remember(auth);
  token = auth;
  sessionStorage.removeItem(keys.token);
  syncLabels('Údaje sú synchronizované s GitHubom.');
}
function pairingStatus(message) {
  $('github-status').textContent = message;
}
async function pollPairing(pairing) {
  if (activePairing !== pairing) return;
  if (!menuPairing.valid(pairing.offer)) {
    cancelPairing();
    pairingStatus('QR kód vypršal. Zobraz nový kód.');
    return;
  }
  try {
    const credential = await menuPairing.receive(pairing.offer);
    if (activePairing !== pairing) return;
    if (credential) {
      cancelPairing();
      await connect(credential.token, false);
      await menuPairing.remove(pairing.offer, credential).catch(() => {});
      return;
    }
  } catch (error) {
    if (activePairing === pairing) cancelPairing();
    pairingStatus(error.message);
    return;
  }
  if (activePairing === pairing) pairing.timer = setTimeout(() => pollPairing(pairing), 6500);
}
async function startPairing() {
  $('start-pairing').disabled = true;
  try {
    const pairing = await menuPairing.create(location.href);
    drawMenuQr($('pairing-qr'), pairing.link);
    activePairing = pairing;
    pairingControls();
    pairingStatus('Čakám na potvrdenie na telefóne…');
    pairing.timer = setTimeout(() => pollPairing(pairing), 3000);
  } catch {
    cancelPairing();
    pairingStatus('QR kód sa nepodarilo vytvoriť.');
  } finally {
    $('start-pairing').disabled = false;
  }
}
async function approvePairing() {
  if (!approvalPending || !token) return;
  const button = $('confirm-pairing');
  button.disabled = true;
  try {
    await menuPairing.approve(approval, token);
    approvalPending = false;
    pairingControls();
    pairingStatus('Počítač je potvrdený. Prihlásenie na ňom prebehne o chvíľu.');
  } catch (error) {
    pairingStatus(error.message);
  } finally {
    button.disabled = false;
  }
}
async function restoreConnection() {
  try {
    const saved = await menuPairing.restore();
    if (saved) token = saved;
    else if (token) {
      await menuPairing.remember(token);
      sessionStorage.removeItem(keys.token);
    }
    if (token) {
      syncLabels('Pripojené ku GitHubu');
      sync().catch(error => { if (!approvalPending) showSyncError(error); });
    }
  } catch {
    pairingStatus('Uložené prihlásenie sa nepodarilo načítať.');
  }
  if (!approvalPending) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (!menuPairing.valid(approval)) {
    approvalPending = false;
    pairingControls();
    pairingStatus('QR kód vypršal. Na počítači zobraz nový kód.');
  } else {
    pairingControls();
    pairingStatus(token ? '' : 'Na telefóne sa najprv pripoj ku GitHubu pomocou tokenu. Potom potvrď počítač.');
  }
  if (!$('github-dialog').open) $('github-dialog').showModal();
}

if (kitchenMode) {
  document.title = 'Kuchyňa · Týždenné menu';
  document.body.classList.add('kitchen-mode');
  $('kitchen').hidden = false;
  $('kitchen-history').onchange = event => {
    kitchenSelection = event.target.value;
    renderKitchen();
  };
  $('kitchen-print').onclick = () => menuPrint.open([...$('kitchen-days').querySelectorAll('.kitchen-day')], true);
  $('kitchen-refresh').onclick = refreshKitchen;
  window.addEventListener('storage', event => {
    if (event.key === keys.state) {
      cache = read(keys.state, initialState).data;
      renderKitchen();
    }
  });
  renderKitchen();
  refreshKitchen();
} else {
  renderEditor();
  renderPreview();
  renderSettings();
  renderDraftStatus();
  refreshLists();
  syncLabels(token ? 'Pripojené ku GitHubu' : 'Lokálne ukladanie');
  new ResizeObserver(fitPaper).observe(document.querySelector('.preview-pane'));
  window.addEventListener('beforeprint', fitPaper);
  window.addEventListener('afterprint', fitPaper);
  $('day-tabs').onclick = event => {
    const button = event.target.closest('[data-day]');
    if (button) {
      dayIndex = Number(button.dataset.day);
      renderEditor();
      $('day-tabs').querySelector('[aria-pressed=true]').focus();
    }
  };
  $('day-editor').addEventListener('input', readEntryChanges);
  $('day-editor').addEventListener('change', rememberEntry);
  $('day-editor').addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing || !event.target.dataset.path) return;
    event.preventDefault();
    event.target.blur();
  });
  $('day-editor').onclick = alterDay;
  $('picker-search').oninput = renderPicker;
  document.querySelectorAll('[data-close]').forEach(button => {
    button.onclick = () => $(button.dataset.close).close();
  });
  document.querySelectorAll('[data-view]').forEach(button => {
    button.onclick = () => openView(button.dataset.view);
  });
  $('start').onchange = event => changeWeekDate(event.target.value);
  $('save').onclick = saveWeek;
  $('load-last').onclick = () => showSavedWeek(cache.history[0]);
  $('archive-week').onchange = event => {
    archiveStart = event.target.value;
    renderArchive();
    renderPreview();
    $('archive-week').focus();
  };
  $('archive').onclick = event => {
    const button = event.target.closest('[data-open-week]');
    if (button) {
      openWeek(button.dataset.openWeek);
      $('start').focus({ preventScroll: true });
      $('start').scrollIntoView({ block: 'nearest' });
    }
  };
  $('new-week').onclick = () => openWeek(iso(dateAt(week.start, 7)));
  $('print').onclick = () => {
    const saved = $('archive').hidden ? null : cache.history.find(item => item.data.start === archiveStart);
    const pending = weekAllergens(saved?.data || week, Boolean(saved)).filter(item => item.pending);
    if (pending.length) {
      alert('Pred tlačou over alergény:\n' + pending.map(item => item.day + ' · ' + item.name).join('\n') +
        (saved ? '\n\nOtvor týždeň v editore a po overení ho znovu ulož.' : ''));
      return;
    }
    const issues = $('archive').hidden ? warnings() : [];
    if (!issues.length || confirm(issues.join('\n') + '\n\nVytlačiť aj tak?')) menuPrint.open([$('paper')]);
  };
  $('category-tabs').onclick = event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    $('database-search').value = '';
    renderDatabase();
    $('category-tabs').querySelector('[aria-pressed=true]').focus();
  };
  $('database-form').onsubmit = event => {
    event.preventDefault();
    const value = clean($('entry').value);
    if (!value) return;
    if (cache.library[category].some(item => fold(item) === fold(value))) {
      notify('Táto položka už je v databáze.');
      return;
    }
    stage({ entries: { [category]: [value] } });
    $('entry').value = '';
    $('database-search').value = '';
    renderDatabase();
    notify('Položka bola pridaná.');
  };
  $('database-search').oninput = renderDatabase;
  $('database-list').onclick = event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.rename) {
      const before = button.dataset.rename;
      const after = clean(prompt('Nový názov položky', before));
      if (after && after !== before) {
        stage({ edit: { category, before, after } });
        notify('Položka bola premenovaná.');
      }
    }
    if (button.dataset.delete && confirm('Odobrať položku „' + button.dataset.delete + '“ z databázy?')) {
      stage({ edit: { category, before: button.dataset.delete, after: '' } });
      notify('Položka bola odobratá.');
    }
  };
  $('settings-fields').oninput = event => {
    const key = event.target.dataset.setting;
    if (!key) return;
    settings[key] = event.target.value;
    settingsDirty = true;
    localStorage.setItem('umastina-weekly-v7-settings-draft', JSON.stringify(settings));
    renderPreview();
  };
  $('save-settings').onclick = () => {
    settingsDirty = false;
    localStorage.setItem('umastina-weekly-v6-settings', JSON.stringify(settings));
    localStorage.removeItem('umastina-weekly-v7-settings-draft');
    stage({ settings: clone(settings) });
    notify(token ? 'Nastavenia uložené. Prebieha synchronizácia.' : 'Nastavenia uložené v tomto prehliadači.');
  };
  $('backup').onclick = backup;
  $('restore').onclick = () => $('import-file').click();
  $('import-file').onchange = importBackup;
  $('open-sync').onclick = () => $('github-dialog').showModal();
  $('github-form').onsubmit = async event => {
    event.preventDefault();
    const input = $('github-token');
    const candidate = clean(input.value);
    if (!/^github_pat_[a-zA-Z0-9_]+$/.test(candidate)) {
      pairingStatus('Vlož GitHub token typu Fine-grained.');
      return;
    }
    input.value = '';
    const submit = event.target.querySelector('button');
    submit.disabled = true;
    try {
      await connect(candidate, true);
      if (approvalPending) pairingStatus('Teraz môžeš potvrdiť prihlásenie počítača.');
    } catch (error) {
      showSyncError(error);
    } finally {
      submit.disabled = false;
    }
  };
  $('sync-now').onclick = () => sync().catch(showSyncError);
  $('disconnect').onclick = async () => {
    if (syncJob) return;
    try {
      await menuPairing.forget();
      token = '';
      sessionStorage.removeItem(keys.token);
      syncLabels('Lokálne ukladanie');
    } catch {
      pairingStatus('Uložené prihlásenie sa nepodarilo odstrániť.');
    }
  };
  $('start-pairing').onclick = startPairing;
  $('cancel-pairing').onclick = () => { cancelPairing(); pairingStatus('QR kód bol zrušený.'); };
  $('github-dialog').addEventListener('close', cancelPairing);
  $('confirm-pairing').onclick = approvePairing;
  $('decline-pairing').onclick = () => {
    approvalPending = false;
    pairingControls();
    $('github-dialog').close();
  };
  window.addEventListener('storage', event => {
    if (event.key === keys.drafts) renderArchive();
    if (event.key === keys.state) {
      cache = read(keys.state, initialState).data;
      refreshLists();
      updateAllergenButtons();
      renderPreview();
    }
  });
  window.addEventListener('online', () => { if (token) sync().catch(showSyncError); });
  window.addEventListener('focus', () => { if (token) sync().catch(showSyncError); });
  restoreConnection();
}
