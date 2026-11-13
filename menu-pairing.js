'use strict';

const menuPairing = (() => {
  const root = 'https://api.github.com/repos/Pelinho100/u-mastina-menu/contents/pairing/';
  const branch = 'menu-pairing';
  const lifetime = 5 * 60 * 1000;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function base64(bytes) {
    return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  }
  function unbase64(value) {
    return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), letter => letter.charCodeAt(0));
  }
  const random = size => base64(crypto.getRandomValues(new Uint8Array(size)));
  const associated = offer => encoder.encode('u-mastina-pairing-v1:' + offer.id + ':' + offer.expires);
  const curve = { name: 'ECDH', namedCurve: 'P-256' };
  const generateKeys = () => crypto.subtle.generateKey(curve, false, ['deriveKey']);
  const publicCode = async pair => base64(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
  async function deriveKey(privateKey, publicCode) {
    const publicKey = await crypto.subtle.importKey('raw', unbase64(publicCode), curve, false, []);
    return crypto.subtle.deriveKey({ name: 'ECDH', public: publicKey }, privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  function valid(offer) {
    return Boolean(offer && /^[\w-]{22}$/.test(offer.id) && /^[\w-]{87}$/.test(offer.publicCode) &&
      Number.isSafeInteger(offer.expires) && offer.expires > Date.now() && offer.expires <= Date.now() + lifetime + 30000);
  }
  async function create(url) {
    const pair = await generateKeys();
    const offer = { id: random(16), publicCode: await publicCode(pair), privateKey: pair.privateKey, expires: Date.now() + lifetime };
    const link = new URL('tyzdenne-menu.html', url);
    link.search = '?v=8';
    link.hash = 'pripojit=' + [offer.id, offer.publicCode, offer.expires].join('.');
    return { offer, link: link.href };
  }
  function fromHash(hash) {
    const match = /^#pripojit=([\w-]+)\.([\w-]+)\.(\d+)$/.exec(hash);
    if (!match) return null;
    return { id: match[1], publicCode: match[2], expires: Number(match[3]) };
  }
  async function transport(offer, method, token, body) {
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body) headers['Content-Type'] = 'application/json';
    const query = '?ref=' + branch + (method === 'GET' ? '&t=' + Date.now() : '');
    return fetch(root + offer.id + '.json' + query, {
      method, headers, cache: 'no-store', body: body && JSON.stringify(body)
    });
  }
  function checkResponse(response) {
    if (!response.ok) throw new Error('GitHub vrátil chybu ' + response.status + '.');
  }
  async function approve(offer, token) {
    if (!valid(offer)) throw new Error('Platnosť kódu uplynula. Na počítači zobraz nový QR kód.');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const pair = await generateKeys();
    const key = await deriveKey(pair.privateKey, offer.publicCode);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: associated(offer) }, key, encoder.encode(token));
    const content = btoa(JSON.stringify({ publicCode: await publicCode(pair), iv: base64(iv), encrypted: base64(new Uint8Array(encrypted)) }));
    const response = await transport(offer, 'PUT', token, { branch, content, message: 'Potvrdiť párovanie zariadenia' });
    checkResponse(response);
  }
  async function receive(offer) {
    if (!valid(offer)) throw new Error('Platnosť QR kódu uplynula.');
    const response = await transport(offer, 'GET');
    if (response.status === 404) return null;
    checkResponse(response);
    const file = await response.json();
    if (file.encoding !== 'base64' || !file.sha) throw new Error('GitHub vrátil neplatné potvrdenie.');
    const payload = JSON.parse(atob(file.content));
    const { iv, encrypted } = payload;
    const key = await deriveKey(offer.privateKey, payload.publicCode);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(iv), additionalData: associated(offer) }, key, unbase64(encrypted));
    const token = decoder.decode(decrypted);
    if (!valid(offer) || !/^github_pat_[a-zA-Z0-9_]+$/.test(token)) throw new Error('Potvrdenie je neplatné alebo už vypršalo.');
    return { token, sha: file.sha };
  }
  async function remove(offer, { token, sha }) {
    const response = await transport(offer, 'DELETE', token, { branch, sha, message: 'Odstrániť dokončené párovanie' });
    checkResponse(response);
  }

  function credentials(mode, operation) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('umastina-credentials', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('editor');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const transaction = db.transaction('editor', mode);
        const result = operation(transaction.objectStore('editor'));
        transaction.oncomplete = () => { db.close(); resolve(result.result); };
        transaction.onabort = () => { db.close(); reject(transaction.error); };
      };
    });
  }
  async function remember(token) {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(token));
    await credentials('readwrite', store => store.put({ key, iv, encrypted }, 'github'));
  }
  async function restore() {
    const entry = await credentials('readonly', store => store.get('github'));
    return entry ? decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: entry.iv }, entry.key, entry.encrypted)) : '';
  }
  const forget = () => credentials('readwrite', store => store.delete('github'));
  return { create, fromHash, valid, approve, receive, remove, remember, restore, forget };
})();
