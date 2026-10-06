/* =========================================================
   Riff — AI Song Studio for the Suno API (https://docs.sunoapi.org)
   Plain JS, no build step. All state lives in the browser.
   ========================================================= */
(() => {
  'use strict';

  // ---------- tiny helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => { s = Math.max(0, Math.round(Number(s) || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const round2 = (n) => Math.round(Number(n) * 100) / 100;
  const slug = (s) => String(s || 'track').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'track';

  // Library, jobs, personas, lyrics and the API key are kept per signed-in user;
  // UI preferences (mode, model, volume) are shared on the device.
  const GLOBAL_KEYS = new Set(['vol', 'mode', 'model']);
  let scope = 'riff.';
  const fullKey = (k) => (GLOBAL_KEYS.has(k) ? 'riff.' : scope) + k;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(fullKey(k)); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(fullKey(k), JSON.stringify(v)); } catch { /* quota / private mode */ } },
  };

  // ---------- constants from the Suno API docs ----------
  const MODELS = [
    { id: 'V6', name: 'V6', desc: 'Natural vocals, rich detail', badge: 'Best' },
    { id: 'V6_WILD', name: 'V6 Wild', desc: 'Bold, experimental, distinctive' },
    { id: 'V6_MINI', name: 'V6 Mini', desc: 'Fast and lightweight' },
    { id: 'V5_5', name: 'V5.5', desc: 'Voice-customized', legacy: true },
    { id: 'V5', name: 'V5', desc: 'Expressive, fast', legacy: true },
    { id: 'V4_5PLUS', name: 'V4.5+', desc: 'Richer tones, up to 8 min', legacy: true },
    { id: 'V4_5ALL', name: 'V4.5 All', desc: 'Better song structure', legacy: true },
    { id: 'V4_5', name: 'V4.5', desc: 'Smart prompts, up to 8 min', legacy: true },
    { id: 'V4', name: 'V4', desc: 'Clear vocals, up to 4 min', legacy: true },
  ];
  const DURATION_MODELS = ['V6', 'V6_WILD', 'V6_MINI', 'V5_5'];
  const PERSONA_MODELS = ['V6', 'V6_WILD', 'V6_MINI', 'V5_5', 'V5'];
  const VARIETY = ['Off', 'Normal', 'High', 'Extra', 'Max'];
  const KEYS = ['Any', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'];
  const STEMS = ['Lead Vocal', 'Backing Vocals', 'Drum Kit', 'Kick', 'Snare', 'Hi-Hat', 'Bass', 'Bass Guitar', '808', 'Piano', 'Electric Piano', 'Rhodes', 'Keyboards', 'Organ', 'Synth', 'Synth Pad', 'Synth Bass', 'Synth Lead', 'Acoustic Guitar', 'Electric Guitar', 'Lead Guitar', 'Guitar', 'String Section', 'Violin', 'Cello', 'Brass Section', 'Trumpet', 'Saxophone', 'Woodwinds', 'Flute', 'Percussion', 'Choir', 'Sound Effects'];

  const IDEAS = [
    ['☀️ Summer road trip', 'An upbeat summer pop anthem about a road trip with best friends, windows down, huge singalong chorus'],
    ['🌧️ Rainy lo-fi', 'Mellow lo-fi hip hop about a rainy Sunday in a cozy café, soft jazzy chords and dreamy vocals'],
    ['🐶 Ode to my dog', 'A goofy, heartwarming country song about my dog who steals socks, banjo and handclaps'],
    ['🚀 Space synthwave', 'Retro 80s synthwave about drifting through a neon galaxy, driving bassline, airy female vocals'],
    ['💔 Breakup ballad', 'A raw piano ballad about letting go of someone you still love, building to an emotional final chorus'],
    ['🎂 Birthday banger', 'A high-energy party track wishing my friend Sam a happy birthday, EDM drop, crowd chants'],
    ['⚔️ Epic boss battle', 'Cinematic orchestral metal for a final boss fight, choir, pounding drums, heroic brass'],
    ['☕ Morning motivation', 'Feel-good funk track about getting out of bed and crushing Monday, slap bass and horns'],
  ];
  const SURPRISE = [
    'A sea shanty about debugging code at 3am, rowdy group vocals and accordion',
    'Dreamy bedroom pop about falling in love at a laundromat',
    'A Bollywood-disco fusion about a cat who wants to be a movie star',
    'Afrobeats summer jam about dancing on a rooftop at sunset',
    'Dark trap song about a haunted vending machine',
    'Bluegrass breakdown about a racoon who robs picnic baskets',
    'K-pop anthem about finally beating the final level of a video game',
    'Soulful gospel choir song celebrating the weekend',
    'Jazz lounge tune sung by a robot learning to feel emotions',
    'Punk rock song about a pigeon who refuses to fly',
    'Tropical house track about a vacation you can’t afford yet',
    'A lullaby for a sleepy dragon, music box and soft strings',
    'Reggaeton hit about a grandma who owns the dance floor',
    'Indie folk song about the last day before moving to a new city',
  ];
  const GENRES = ['Pop', 'Hip-hop', 'Rock', 'EDM', 'Lo-fi', 'Jazz', 'R&B', 'Country', 'Indie folk', 'Synthwave', 'Afrobeats', 'Reggaeton', 'K-pop', 'Cinematic', 'Metal', 'Classical', 'Funk', 'House'];
  const MOODS = ['Uplifting', 'Melancholic', 'Dreamy', 'Energetic', 'Dark', 'Romantic', 'Chill', 'Epic', 'Playful', 'Nostalgic'];
  const TAGS = ['[Intro]', '[Verse]', '[Pre-Chorus]', '[Chorus]', '[Bridge]', '[Drop]', '[Instrumental]', '[Outro]'];
  const SOUND_IDEAS = ['Lo-fi drum loop', 'Rain on a window ambience', 'Sci-fi UI blips', 'Epic trailer riser', 'Deep house bassline', 'Forest birds at dawn', '8-bit victory jingle'];
  const STAGE_LINES = {
    PENDING: ['Warming up the studio…', 'Tuning the guitars…', 'Brewing a melody…', 'Hunting for the hook…', 'Setting up the mics…'],
    TEXT_SUCCESS: ['Lyrics locked in — recording vocals…', 'Laying down the beat…', 'Mixing the first take…'],
    FIRST_SUCCESS: ['First take is streaming — tap ▶ in your library', 'Polishing the second take…'],
  };
  const ERR_CODES = {
    400: 'Some settings aren’t valid', 401: 'Your API key was rejected', 404: 'Endpoint not found', 405: 'Rate limit hit — slow down a little',
    409: 'This already exists', 413: 'Your text is too long', 429: 'You’re out of credits', 430: 'Too many requests — try again in a moment',
    455: 'Suno API is under maintenance', 500: 'Suno API server error',
  };

  // ---------- network ----------
  const isLocal = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const DIRECT = { suno: 'https://api.sunoapi.org', upload: 'https://sunoapiorg.redpandaai.co' };
  const PROXY = { suno: '/proxy/suno', upload: '/proxy/upload' };
  let useProxy = !isLocal;
  const CALLBACK = (!isLocal && location.protocol.startsWith('http')) ? `${location.origin}/.netlify/functions/suno-callback` : 'https://example.com/suno-callback';

  class ApiError extends Error {
    constructor(message, code, data) { super(message); this.code = code; this.data = data; }
  }

  async function api(path, body, { kind = 'suno', form, key = state.key } = {}) {
    const method = body || form ? 'POST' : 'GET';
    const attempt = async (proxy) => {
      const headers = { Authorization: `Bearer ${key}` };
      if (body) headers['Content-Type'] = 'application/json';
      const res = await fetch((proxy ? PROXY : DIRECT)[kind] + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
      const text = await res.text();
      try { return JSON.parse(text); } catch { const e = new Error('not-json'); e.notJson = true; e.status = res.status; throw e; }
    };
    let json;
    try {
      json = await attempt(useProxy);
    } catch (e) {
      // Proxy missing (e.g. static preview) or direct call blocked by CORS: flip transport and retry once.
      if (!(e.notJson || e instanceof TypeError)) throw e;
      try { json = await attempt(!useProxy); useProxy = !useProxy; }
      catch (e2) { throw new ApiError(e2.notJson ? `Unexpected response from the API (HTTP ${e2.status}).` : 'Couldn’t reach the Suno API. Check your connection.', 0); }
    }
    const code = Number(json.code);
    if (code !== 200) {
      const base = ERR_CODES[code] || 'Request failed';
      const msg = json.msg && json.msg !== 'success' ? `${base}: ${json.msg}` : base;
      throw new ApiError(msg, code, json.data);
    }
    return json.data;
  }

  async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('uploadPath', 'riff-uploads');
    fd.append('fileName', `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`);
    const data = await api('/api/file-stream-upload', null, { kind: 'upload', form: fd });
    if (!data?.downloadUrl) throw new ApiError('Upload finished but no file URL came back.', 0);
    return data.downloadUrl;
  }

  // ---------- state ----------
  const state = {
    key: '',
    user: null,
    tracks: [],
    jobs: [],
    personas: [],
    lyrics: [],
    mode: store.get('mode', 'simple'),
    model: store.get('model', 'V6'),
    showLegacy: false,
    gender: '',
    media: [],
    filter: 'all',
    query: '',
    remixOp: 'cover',
    current: null,
    credits: null,
  };
  const saveTracks = () => store.set('tracks', state.tracks);
  const saveJobs = () => store.set('jobs', state.jobs);
  const trackById = (id) => state.tracks.find((t) => t.id === id);

  // ---------- toasts / confetti ----------
  function toast(title, text = '', type = '', actions = []) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<b>${esc(title)}</b>${text ? `<div>${esc(text)}</div>` : ''}`;
    if (actions.length) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;margin-top:8px';
      actions.forEach(([label, fn]) => {
        const b = document.createElement('button');
        b.className = 'btn btn-sm'; b.textContent = label;
        b.onclick = () => { fn(); el.remove(); };
        row.appendChild(b);
      });
      el.appendChild(row);
    }
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), actions.length ? 9000 : type === 'bad' ? 7000 : 4500);
  }

  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = $('#confetti');
    const colors = ['#7c5cff', '#ff5ca8', '#29c5ff', '#ffc53d', '#3ddc97'];
    for (let i = 0; i < 90; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = pick(colors);
      p.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
      p.style.animationDelay = Math.random() * 0.4 + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.appendChild(p);
      setTimeout(() => p.remove(), 4200);
    }
  }

  function setBusy(btn, busy) {
    btn.disabled = busy;
    btn.classList.toggle('loading', busy);
  }

  // ---------- theme ----------
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('riff.theme', t); } catch { /* ignore */ }
    $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeSet === t)));
  }
  $$('[data-theme-set]').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.themeSet)));
  applyTheme((() => { try { return localStorage.getItem('riff.theme') || 'system'; } catch { return 'system'; } })());

  // ---------- gate ----------
  function readKey() {
    try { return localStorage.getItem(scope + 'key') || sessionStorage.getItem(scope + 'key') || ''; } catch { return ''; }
  }
  function saveKey(k, remember) {
    try {
      localStorage.removeItem(scope + 'key'); sessionStorage.removeItem(scope + 'key');
      (remember ? localStorage : sessionStorage).setItem(scope + 'key', k);
    } catch { /* ignore */ }
  }
  function signOut(msg) {
    try { localStorage.removeItem(scope + 'key'); sessionStorage.removeItem(scope + 'key'); } catch { /* ignore */ }
    state.key = '';
    audio.pause();
    $('#app').hidden = true;
    $('#gate').hidden = false;
    $('#gate-key').value = '';
    const err = $('#gate-error');
    err.hidden = !msg; err.textContent = msg || '';
    setTimeout(() => $('#gate-key').focus(), 50);
  }

  $('#gate-toggle').addEventListener('click', () => {
    const i = $('#gate-key');
    i.type = i.type === 'password' ? 'text' : 'password';
  });
  $('#gate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = $('#gate-key').value.trim().replace(/^Bearer\s+/i, '');
    const err = $('#gate-error');
    const btn = $('#gate-submit');
    if (!key) return;
    setBusy(btn, true); err.hidden = true;
    try {
      const credits = await api('/api/v1/generate/credit', null, { key });
      state.key = key;
      saveKey(key, $('#gate-remember').checked);
      enterApp();
      setCredits(credits);
      toast('Welcome to the studio 🎧', typeof credits === 'number' ? `You have ${credits} credits. Let’s make something.` : '', 'good');
    } catch (ex) {
      err.textContent = ex.code === 401 ? 'That key didn’t work. Double-check it on sunoapi.org/api-key.' : ex.message;
      err.hidden = false;
    } finally { setBusy(btn, false); }
  });
  $('#signout').addEventListener('click', () => {
    $('#account-menu').classList.remove('open');
    if (confirm('Forget your Suno API key on this device? You’ll be asked for a key again. Your library stays here.')) signOut();
  });
  $('#account-btn').addEventListener('click', () => {
    const m = $('#account-menu');
    m.classList.toggle('open');
    $('#account-btn').setAttribute('aria-expanded', m.classList.contains('open'));
  });

  function enterApp() {
    $('#gate').hidden = true;
    $('#app').hidden = false;
    renderAll();
    pollLoop();
  }

  // ---------- credits ----------
  function setCredits(n) {
    state.credits = n;
    $('#credits-val').textContent = typeof n === 'number' ? n.toLocaleString() : '—';
    $('#credits').classList.toggle('low', typeof n === 'number' && n < 20);
  }
  async function refreshCredits() {
    try { setCredits(await api('/api/v1/generate/credit')); }
    catch (e) { if (e.code === 401) signOut('Your API key is no longer valid. Please enter a new one.'); }
  }
  $('#credits').addEventListener('click', refreshCredits);

  // ---------- tabs & modes ----------
  function setTab(name) {
    $$('.tab').forEach((t) => { const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
    $$('.panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.goto === 'lyrics' && !$('#l-prompt').value.trim()) {
      const hint = [$('#c-title').value, $('#c-style').value].filter(Boolean).join(' — ');
      if (hint) $('#l-prompt').value = hint.slice(0, 200);
    }
    setTab(b.dataset.goto);
    $('#l-prompt').focus();
  }));

  function setMode(m) {
    state.mode = m; store.set('mode', m);
    $$('.mode-switch button').forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle('active', on); b.setAttribute('aria-checked', on); });
    $$('[data-mode-panel]').forEach((p) => { p.hidden = p.dataset.modePanel !== m; });
    syncInstrumental();
  }
  $$('.mode-switch button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  // ---------- model picker ----------
  function renderModels() {
    const list = MODELS.filter((m) => !m.legacy || state.showLegacy || m.id === state.model);
    $('#models').innerHTML = list.map((m) => `
      <button type="button" class="model ${m.id === state.model ? 'active' : ''}" data-model="${m.id}" aria-pressed="${m.id === state.model}">
        ${m.badge ? `<span class="badge">${m.badge}</span>` : m.legacy ? '<span class="badge gray">Legacy</span>' : ''}
        <b>${esc(m.name)}</b><small>${esc(m.desc)}</small>
      </button>`).join('');
    $('#legacy-toggle').textContent = state.showLegacy ? 'Hide legacy' : 'Show legacy';
    syncModelLimits();
  }
  $('#models').addEventListener('click', (e) => {
    const b = e.target.closest('[data-model]');
    if (!b) return;
    state.model = b.dataset.model; store.set('model', state.model);
    renderModels();
  });
  $('#legacy-toggle').addEventListener('click', () => { state.showLegacy = !state.showLegacy; renderModels(); });

  function syncModelLimits() {
    const m = state.model;
    $('#c-style').maxLength = m === 'V4' ? 200 : 1000;
    const durOk = DURATION_MODELS.includes(m);
    $('#dur-wrap').style.opacity = durOk ? '' : '.5';
    $('#c-dur-on').disabled = !durOk;
    $('#dur-hint').textContent = durOk ? '10 seconds to 6 minutes. Leave off to let the model decide.' : 'Length control needs a V6-series model.';
    updateCounters();
  }

  const modelOptions = (sel = 'V6') => MODELS.map((m) => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)}${m.legacy ? ' (legacy)' : ''} — ${esc(m.desc)}</option>`).join('');

  // ---------- counters, sliders ----------
  function updateCounters() {
    $$('.counter[data-for]').forEach((c) => {
      const el = document.getElementById(c.dataset.for);
      if (!el) return;
      const max = el.maxLength > 0 ? el.maxLength : null;
      c.textContent = max ? `${el.value.length}/${max}` : el.value.length;
      c.classList.toggle('warn', !!max && el.value.length > max * 0.92);
    });
  }
  document.addEventListener('input', (e) => {
    if (e.target.matches('textarea, input')) updateCounters();
    if (e.target.matches('input[type=range][data-out]')) {
      const out = document.getElementById(e.target.dataset.out);
      if (out) out.textContent = e.target.dataset.fmt === 'variety' ? VARIETY[e.target.value] : e.target.dataset.fmt === 'time' ? fmt(e.target.value) : Number(e.target.value).toFixed(2);
    }
  });
  [['c-sw', 'o-sw'], ['c-wc', 'o-wc'], ['c-aw', 'o-aw']].forEach(([i, o]) => { $('#' + i).dataset.out = o; });
  Object.assign($('#c-var').dataset, { out: 'o-var', fmt: 'variety' });
  Object.assign($('#c-dur').dataset, { out: 'o-dur', fmt: 'time' });
  $('#c-dur-on').addEventListener('change', (e) => { $('#c-dur').disabled = !e.target.checked; });
  $('#x-bpm-on').addEventListener('change', (e) => { $('#x-bpm').disabled = !e.target.checked; $('#o-bpm').textContent = e.target.checked ? $('#x-bpm').value : 'Auto'; });
  $('#x-bpm').addEventListener('input', (e) => { $('#o-bpm').textContent = e.target.value; });

  // ---------- chips / ideas ----------
  function chipRow(el, items, onClick) {
    el.innerHTML = items.map((it, i) => `<button type="button" class="chip" data-i="${i}">${esc(Array.isArray(it) ? it[0] : it)}</button>`).join('');
    el.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) onClick(items[b.dataset.i], b); });
  }
  chipRow($('#s-ideas'), IDEAS, ([, prompt]) => { $('#s-prompt').value = prompt; updateCounters(); $('#s-prompt').focus(); });
  function toggleStyleTag(tag) {
    const el = $('#c-style');
    const parts = el.value.split(',').map((s) => s.trim()).filter(Boolean);
    const idx = parts.findIndex((p) => p.toLowerCase() === tag.toLowerCase());
    if (idx >= 0) parts.splice(idx, 1); else parts.push(tag.toLowerCase());
    el.value = parts.join(', ');
    syncStyleChips(); updateCounters();
  }
  function syncStyleChips() {
    const v = $('#c-style').value.toLowerCase().split(',').map((s) => s.trim());
    $$('#c-genres .chip, #c-moods .chip').forEach((c) => c.classList.toggle('on', v.includes(c.textContent.toLowerCase())));
  }
  chipRow($('#c-genres'), GENRES, toggleStyleTag);
  chipRow($('#c-moods'), MOODS, toggleStyleTag);
  $('#c-style').addEventListener('input', syncStyleChips);
  chipRow($('#x-ideas'), SOUND_IDEAS, (idea) => { $('#x-prompt').value = idea; updateCounters(); });

  $('#tagbar').innerHTML = TAGS.map((t) => `<button type="button">${t}</button>`).join('');
  $('#tagbar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const ta = $('#c-lyrics');
    const { selectionStart: s, selectionEnd: en, value } = ta;
    const before = value.slice(0, s);
    const insert = (before && !before.endsWith('\n') ? '\n\n' : '') + b.textContent + '\n';
    ta.value = before + insert + value.slice(en);
    ta.focus(); ta.selectionStart = ta.selectionEnd = s + insert.length;
    updateCounters();
  });

  $('#surprise').addEventListener('click', () => {
    const el = $('#s-prompt');
    el.value = pick(SURPRISE.filter((s) => s !== el.value));
    el.animate?.([{ transform: 'scale(.98)' }, { transform: 'scale(1)' }], { duration: 180 });
    updateCounters();
  });

  $('#c-gender').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.gender = b.dataset.v;
    $$('#c-gender button').forEach((x) => x.classList.toggle('active', x === b));
  });

  function syncInstrumental() {
    const inst = $('#instrumental').checked;
    $('#lyrics-field').hidden = inst;
    $('#aw-wrap').classList.toggle('disabled', inst);
    $('#c-gender').style.opacity = inst ? '.5' : '';
  }
  $('#instrumental').addEventListener('change', syncInstrumental);

  // ---------- personas ----------
  function renderPersonas() {
    const opts = '<option value="">None</option>' + state.personas.map((p) => `<option value="${esc(p.id)}" data-model="${esc(p.model || 'style_persona')}">${esc(p.name)}</option>`).join('');
    $$('select[data-persona-select], #c-persona').forEach((s) => { const v = s.value; s.innerHTML = opts; s.value = v; });
  }
  document.addEventListener('change', (e) => {
    if (e.target.id === 'r-persona') { const o = e.target.selectedOptions[0]; if (o?.dataset.model) $('#r-pmodel').value = o.dataset.model; }
  });
  $('#c-persona').addEventListener('change', (e) => {
    const o = e.target.selectedOptions[0];
    if (o?.dataset.model) $('#c-persona-model').value = o.dataset.model;
  });

  // ---------- simple-mode media ----------
  function renderMedia() {
    $('#s-media-list').innerHTML = state.media.map((m, i) => `
      <div class="media-item">
        <span>${m.type === 'image' ? '🖼️' : m.type === 'video' ? '🎬' : '🎧'}</span>
        <span class="name">${esc(m.name)}</span>
        <span class="state ${m.status === 'ready' ? 'ok' : m.status === 'error' ? 'err' : ''}">${m.status === 'ready' ? 'Ready ✓' : m.status === 'error' ? 'Failed' : 'Uploading…'}</span>
        <button type="button" class="icon-btn" data-rm="${i}" aria-label="Remove">✕</button>
      </div>`).join('');
  }
  $('#s-media-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    state.media.splice(Number(b.dataset.rm), 1); renderMedia();
  });
  async function addMedia(files) {
    for (const file of files) {
      const type = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'audio';
      const count = state.media.filter((m) => m.type === type).length;
      if (type === 'image' && count >= 5) { toast('Up to 5 images', '', 'bad'); continue; }
      if (type === 'video' && count >= 1) { toast('Only 1 video reference allowed', '', 'bad'); continue; }
      if (state.media.length >= 8) { toast('That’s plenty of references', 'Max 10 attachments including style and lyrics.', 'bad'); break; }
      const item = { name: file.name, type, status: 'uploading', url: '' };
      state.media.push(item); renderMedia();
      try { item.url = await uploadFile(file); item.status = 'ready'; }
      catch (e) { item.status = 'error'; toast('Upload failed', e.message, 'bad'); }
      renderMedia();
    }
  }

  // ---------- dropzones (delegated) ----------
  document.addEventListener('click', (e) => {
    const dz = e.target.closest('.dropzone');
    if (dz && !e.target.closest('input,button,a')) $('input[type=file]', dz).click();
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches('.dropzone input[type=file]') && e.target.files.length) {
      handleDrop(e.target.closest('.dropzone'), [...e.target.files]);
      e.target.value = '';
    }
  });
  ['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => {
    const dz = e.target.closest?.('.dropzone'); if (!dz) return;
    e.preventDefault(); dz.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => {
    const dz = e.target.closest?.('.dropzone'); if (!dz) return;
    e.preventDefault(); dz.classList.remove('over');
    if (ev === 'drop' && e.dataTransfer.files.length) handleDrop(dz, [...e.dataTransfer.files]);
  }));

  async function handleDrop(dz, files) {
    if (dz.dataset.drop === 's-media') return addMedia(files);
    const file = files[0];
    if (!file.type.startsWith('audio') && !/\.(mp3|wav|m4a|flac|ogg|aac)$/i.test(file.name)) { toast('Please choose an audio file', '', 'bad'); return; }
    const input = document.getElementById(dz.dataset.target);
    const label = $('span', dz);
    label.textContent = `Uploading ${file.name}…`;
    dz.classList.add('has-file');
    try {
      input.value = await uploadFile(file);
      delete input.dataset.trackId;
      label.textContent = `✓ ${file.name} uploaded`;
      const lib = document.getElementById(dz.dataset.target + '-lib'); if (lib) lib.value = '';
    } catch (e) {
      label.textContent = 'Upload failed — try again or paste a URL';
      dz.classList.remove('has-file');
      toast('Upload failed', e.message, 'bad');
    }
  }

  // ---------- CREATE: generate ----------
  function tuneValues(prefix, instrumental) {
    const out = {};
    out.styleWeight = round2($(`#${prefix}-sw`).value);
    out.weirdnessConstraint = round2($(`#${prefix}-wc`).value);
    out.variety = Number($(`#${prefix}-var`).value);
    if (!instrumental) out.audioWeight = round2($(`#${prefix}-aw`).value);
    return out;
  }

  async function onGenerate() {
    const btn = $('#generate');
    const instrumental = $('#instrumental').checked;
    const model = state.model;
    const body = { customMode: state.mode === 'custom', instrumental, model, callBackUrl: CALLBACK };
    let label;

    if (state.mode === 'simple') {
      const prompt = $('#s-prompt').value.trim();
      const style = $('#s-style').value.trim();
      if (state.media.some((m) => m.status === 'uploading')) return toast('Hang on — still uploading your media', '', 'bad');
      const refs = state.media.filter((m) => m.status === 'ready');
      if (!prompt && !style && !refs.length) { $('#s-prompt').focus(); return toast('Tell us what to make', 'Describe your song, or hit 🎲 Surprise me.', 'bad'); }
      if (prompt) body.prompt = prompt;
      if (style) body.style = style;
      const byType = (t) => refs.filter((m) => m.type === t).map((m) => m.url);
      if (byType('image').length) body.imageUrls = byType('image');
      if (byType('video').length) body.videoUrls = byType('video');
      if (byType('audio').length) body.audioUrls = byType('audio');
      label = prompt || style || 'Media-inspired song';
    } else {
      const title = $('#c-title').value.trim();
      const style = $('#c-style').value.trim();
      const lyrics = $('#c-lyrics').value.trim();
      const neg = $('#c-neg').value.trim();
      if (!style && !(lyrics && !instrumental) && !neg) { $('#c-style').focus(); return toast('Add a style or some lyrics', 'Custom mode needs at least a style, lyrics, or styles to exclude.', 'bad'); }
      if (title) body.title = title;
      if (style) body.style = style;
      if (neg) body.negativeTags = neg;
      if (!instrumental && lyrics) {
        body.lyrics = lyrics;
        body.prompt = lyrics.slice(0, model === 'V4' ? 3000 : 5000); // legacy models read lyrics from prompt
        if (state.gender) body.vocalGender = state.gender;
      }
      if ($('#c-tune').checked) Object.assign(body, tuneValues('c', instrumental));
      if ($('#c-dur-on').checked && DURATION_MODELS.includes(model)) body.duration = Number($('#c-dur').value);
      const personaId = $('#c-persona-id').value.trim() || $('#c-persona').value;
      if (personaId) {
        if (!PERSONA_MODELS.includes(model)) return toast('Personas need V5 or newer', 'Switch to a V6 model to use a persona.', 'bad');
        body.personaId = personaId;
        body.personaModel = $('#c-persona-model').value;
      }
      label = title || style || 'Untitled song';
    }

    setBusy(btn, true);
    try {
      const data = await api('/api/v1/generate', body);
      addJob({ kind: 'music', taskId: data.taskId, label, op: 'Song', model });
      toast('Song is on the way 🎶', 'Two takes usually land in 1–3 minutes.', 'good');
      refreshCredits();
    } catch (e) { handleError(e); } finally { setBusy(btn, false); }
  }
  $('#generate').addEventListener('click', onGenerate);

  function handleError(e, title = 'Something went wrong') {
    if (e.code === 401) return signOut('Your API key was rejected. Please enter a valid key.');
    toast(e.code === 429 ? 'Out of credits' : title, e.message, 'bad', e.code === 429 ? [['Top up', () => window.open('https://sunoapi.org/', '_blank', 'noopener')]] : []);
  }

  // ---------- boost style ----------
  $('#boost').addEventListener('click', async () => {
    const el = $('#c-style');
    const content = el.value.trim();
    if (!content) { el.focus(); return toast('Type a rough style first', 'e.g. “sad pop, piano” — we’ll expand it.', 'bad'); }
    const btn = $('#boost'); btn.disabled = true; btn.textContent = '✨ Boosting…';
    try {
      const data = await api('/api/v1/style/generate', { content });
      if (data?.result) {
        const prev = el.value;
        el.value = data.result.slice(0, el.maxLength);
        syncStyleChips(); updateCounters();
        toast('Style boosted ✨', '', 'good', [['Undo', () => { el.value = prev; syncStyleChips(); updateCounters(); }]]);
      } else toast('No boost came back', data?.errorMessage || 'Try rephrasing your style.', 'bad');
    } catch (e) { handleError(e, 'Couldn’t boost style'); } finally { btn.disabled = false; btn.textContent = '✨ Boost style'; }
  });

  // ---------- LYRICS ----------
  $('#l-go').addEventListener('click', async () => {
    const prompt = $('#l-prompt').value.trim();
    if (!prompt) { $('#l-prompt').focus(); return toast('What’s the song about?', '', 'bad'); }
    const btn = $('#l-go'); setBusy(btn, true);
    try {
      const data = await api('/api/v1/lyrics', { prompt, callBackUrl: CALLBACK });
      addJob({ kind: 'lyrics', taskId: data.taskId, label: prompt, op: 'Lyrics' });
      toast('Writing lyrics ✍️', 'Usually takes under a minute.', 'good');
    } catch (e) { handleError(e); } finally { setBusy(btn, false); }
  });
  function renderLyrics() {
    $('#l-results').innerHTML = state.lyrics.map((l, i) => `
      <div class="lyric-card">
        <h4>${esc(l.title || 'Untitled')}</h4>
        <pre>${esc(l.text)}</pre>
        <div class="actions">
          <button class="btn btn-primary btn-sm" data-use="${i}">Use these lyrics</button>
          <button class="btn btn-sm" data-copy="${i}">Copy</button>
          <button class="btn btn-ghost btn-sm" data-del="${i}">Discard</button>
        </div>
      </div>`).join('');
  }
  $('#l-results').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const l = state.lyrics[b.dataset.use ?? b.dataset.copy ?? b.dataset.del];
    if (b.dataset.use != null) {
      setMode('custom'); setTab('create');
      $('#instrumental').checked = false; syncInstrumental();
      $('#c-lyrics').value = l.text;
      if (!$('#c-title').value && l.title) $('#c-title').value = l.title.slice(0, 80);
      updateCounters();
      toast('Lyrics loaded into Custom mode', 'Add a style and hit Create.', 'good');
      $('#c-style').focus();
    } else if (b.dataset.copy != null) {
      navigator.clipboard?.writeText(l.text).then(() => toast('Copied to clipboard'));
    } else {
      state.lyrics.splice(Number(b.dataset.del), 1); store.set('lyrics', state.lyrics); renderLyrics();
    }
  });

  // ---------- SOUNDS ----------
  $('#x-key').innerHTML = KEYS.map((k) => `<option>${k}</option>`).join('');
  $('#x-model').innerHTML = modelOptions('V6');
  $('#x-go').addEventListener('click', async () => {
    const prompt = $('#x-prompt').value.trim();
    if (!prompt) { $('#x-prompt').focus(); return toast('Describe the sound', '', 'bad'); }
    const body = { prompt, model: $('#x-model').value, soundLoop: $('#x-loop').checked, soundKey: $('#x-key').value, grabLyrics: $('#x-grab').checked, callBackUrl: CALLBACK };
    if ($('#x-bpm-on').checked) body.soundTempo = Number($('#x-bpm').value);
    const btn = $('#x-go'); setBusy(btn, true);
    try {
      const data = await api('/api/v1/generate/sounds', body);
      addJob({ kind: 'music', taskId: data.taskId, label: prompt, op: 'Sound', model: body.model });
      toast('Cooking up your sound 🔊', '', 'good');
      refreshCredits();
    } catch (e) { handleError(e); } finally { setBusy(btn, false); }
  });

  // ---------- REMIX ----------
  const OPS = {
    cover: { ico: '🎨', name: 'Cover', desc: 'New style, same melody' },
    extend: { ico: '⏩', name: 'Extend', desc: 'Keep the song going' },
    vocals: { ico: '🎤', name: 'Add vocals', desc: 'Sing over a beat' },
    instrumental: { ico: '🎸', name: 'Add backing', desc: 'A band for your vocals' },
    mashup: { ico: '🔀', name: 'Mashup', desc: 'Blend two tracks' },
    replace: { ico: '✂️', name: 'Replace part', desc: 'Redo a 10s+ section' },
  };
  $('#ops').innerHTML = Object.entries(OPS).map(([k, o]) => `<button type="button" class="op" data-op="${k}"><span class="ico">${o.ico}</span><b>${o.name}</b><small>${o.desc}</small></button>`).join('');
  $('#ops').addEventListener('click', (e) => { const b = e.target.closest('[data-op]'); if (b) renderRemix(b.dataset.op); });

  const F = {
    text: (id, label, o = {}) => `<label class="field"><span class="label">${label}${o.req ? '' : ' <span class="muted">(optional)</span>'}</span><input id="${id}" ${o.max ? `maxlength="${o.max}"` : ''} placeholder="${esc(o.ph || '')}" value="${esc(o.value || '')}" /></label>`,
    area: (id, label, o = {}) => `<label class="field"><span class="label">${label}${o.req ? '' : ' <span class="muted">(optional)</span>'}</span><textarea id="${id}" rows="${o.rows || 3}" ${o.max ? `maxlength="${o.max}"` : ''} placeholder="${esc(o.ph || '')}">${esc(o.value || '')}</textarea>${o.max ? `<span class="counter" data-for="${id}"></span>` : ''}</label>`,
    num: (id, label, o = {}) => `<label class="field"><span class="label">${label}${o.req ? '' : ' <span class="muted">(optional)</span>'}</span><input id="${id}" type="number" step="${o.step || 0.01}" min="${o.min ?? 0}" ${o.maxv ? `max="${o.maxv}"` : ''} placeholder="${esc(o.ph || '')}" value="${esc(o.value ?? '')}" /></label>`,
    model: (id, value = state.model) => `<label class="field"><span class="label">Model</span><select id="${id}">${modelOptions(value)}</select></label>`,
    gender: (id) => `<label class="field"><span class="label">Vocal gender</span><select id="${id}"><option value="">Any</option><option value="f">Female</option><option value="m">Male</option></select></label>`,
    toggle: (id, label, checked) => `<label class="toggle"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} /><span class="tgl"><span class="thumb"></span></span><span><b>${label}</b></span></label>`,
    source: (id, label, track) => {
      const lib = state.tracks.filter((t) => t.audio);
      return `<div class="field"><span class="label">${label}</span>
        <div class="dropzone ${track ? 'has-file' : ''}" data-target="${id}"><input type="file" accept="audio/*" hidden /><span>${track ? `🎵 ${esc(track.title)} (from library)` : 'Drop an audio file or <u>browse</u>'}</span></div>
        <div class="row">
          <input id="${id}" type="url" placeholder="…or paste a public audio URL" value="${esc(track?.audio || '')}" ${track ? `data-track-id="${esc(track.id)}"` : ''} />
          ${lib.length ? `<select id="${id}-lib" title="Pick from your library" style="max-width:44%"><option value="">From library…</option>${lib.map((t) => `<option value="${esc(t.id)}" ${track?.id === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select>` : ''}
        </div></div>`;
    },
    persona: (p) => `<div class="field"><span class="label">Persona / voice <span class="muted">(optional)</span></span><div class="row"><select id="${p}-persona" data-persona-select><option value="">None</option></select><select id="${p}-pmodel"><option value="style_persona">Style persona</option><option value="voice_persona">Voice persona</option></select></div></div>`,
    duration: (p) => `<div class="field"><span class="label-row"><span class="label">Length</span><label class="check inline"><input type="checkbox" id="${p}-dur-on" data-enables="${p}-dur" /> <span>Set length</span></label></span><div class="range-row"><input type="range" id="${p}-dur" min="10" max="360" step="5" value="120" data-out="${p}-o-dur" data-fmt="time" disabled /><output id="${p}-o-dur">2:00</output></div></div>`,
    tune: (p) => `<details class="more"><summary>Fine-tune</summary>
      <label class="check"><input type="checkbox" id="${p}-tune" /> <span>Send these values</span></label>
      <div class="sliders">
        <label class="slider"><span>Style adherence <output id="${p}-o-sw">0.50</output></span><input type="range" id="${p}-sw" min="0" max="1" step="0.01" value="0.5" data-out="${p}-o-sw" /></label>
        <label class="slider"><span>Weirdness <output id="${p}-o-wc">0.50</output></span><input type="range" id="${p}-wc" min="0" max="1" step="0.01" value="0.5" data-out="${p}-o-wc" /></label>
        <label class="slider"><span>Audio weight <output id="${p}-o-aw">0.50</output></span><input type="range" id="${p}-aw" min="0" max="1" step="0.01" value="0.5" data-out="${p}-o-aw" /></label>
        <label class="slider"><span>Variety <output id="${p}-o-var">Normal</output></span><input type="range" id="${p}-var" min="0" max="4" step="1" value="1" data-out="${p}-o-var" data-fmt="variety" /></label>
      </div></details>`,
  };
  document.addEventListener('change', (e) => {
    if (e.target.dataset.enables) document.getElementById(e.target.dataset.enables).disabled = !e.target.checked;
    // library picker for any source field
    if (e.target.id?.endsWith('-lib') && e.target.tagName === 'SELECT') {
      const input = document.getElementById(e.target.id.slice(0, -4));
      const t = trackById(e.target.value);
      const dz = $(`.dropzone[data-target="${input.id}"]`);
      if (t) {
        input.value = t.audio; input.dataset.trackId = t.id;
        if (dz) { dz.classList.add('has-file'); $('span', dz).textContent = `🎵 ${t.title} (from library)`; }
        prefillFromTrack(t);
      } else {
        input.value = ''; delete input.dataset.trackId;
        if (dz) { dz.classList.remove('has-file'); $('span', dz).innerHTML = 'Drop an audio file or <u>browse</u>'; }
      }
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.matches('#r-src, #r-src2')) {
      delete e.target.dataset.trackId;
      const lib = document.getElementById(e.target.id + '-lib'); if (lib) lib.value = '';
    }
  });

  function prefillFromTrack(t) {
    const set = (id, v) => { const el = document.getElementById(id); if (el && !el.value && v) el.value = v; };
    const op = state.remixOp;
    if (op === 'extend') set('r-title', t.title ? `${t.title} (Extended)` : '');
    else if (op === 'cover') set('r-title', t.title ? `${t.title} (Cover)` : '');
    else set('r-title', t.title);
    if (op !== 'cover') set('r-style', t.tags);
    if (op === 'replace') { set('r-full', t.lyrics); const hint = $('#r-dur-hint'); if (hint && t.duration) hint.textContent = `Track is ${fmt(t.duration)} long. Replace at least 10s and at most half of it.`; }
    if (op === 'extend' && t.duration) { const ca = $('#r-at'); if (ca) { ca.max = Math.floor(t.duration); ca.placeholder = `Seconds, e.g. ${Math.max(1, Math.floor(t.duration - 20))} (track is ${fmt(t.duration)})`; } }
    updateCounters();
  }

  function renderRemix(op, track) {
    state.remixOp = op;
    $$('#ops .op').forEach((b) => b.classList.toggle('active', b.dataset.op === op));
    const styleMax = 1000;
    const parts = [];
    const lyr = (label = 'Lyrics') => F.area('r-lyrics', label, { rows: 5, max: 5000, ph: '[Verse]\n…' });
    switch (op) {
      case 'cover':
        parts.push(F.source('r-src', 'Song to cover', track), F.text('r-title', 'Title', { max: 80, ph: 'My cover' }),
          F.area('r-style', 'New style', { rows: 2, max: styleMax, ph: 'acoustic jazz, smoky female vocals', req: true }),
          F.toggle('r-inst', 'Instrumental', false), lyr('Lyrics (leave empty to keep the vibe)'),
          F.text('r-neg', 'Exclude styles', { ph: 'e.g. heavy metal' }), F.gender('r-gender'), F.model('r-model'), F.duration('r'), F.persona('r'), F.tune('r'));
        break;
      case 'extend':
        parts.push(F.source('r-src', 'Song to extend', track), F.num('r-at', 'Continue from (seconds)', { step: 1, min: 1, ph: 'Seconds from the start' }),
          F.text('r-title', 'Title', { max: 100 }), F.area('r-style', 'Style', { rows: 2, max: styleMax, ph: 'Keep blank to match the original' }),
          F.toggle('r-inst', 'Instrumental', false), lyr('Lyrics for the new part'),
          F.text('r-neg', 'Exclude styles'), F.gender('r-gender'), F.model('r-model'), F.persona('r'), F.tune('r'));
        break;
      case 'vocals':
        parts.push(F.source('r-src', 'Instrumental track', track), F.text('r-title', 'Title', { max: 80, req: true }),
          F.area('r-style', 'Vocal & music style', { rows: 2, max: styleMax, req: true, ph: 'soulful R&B, breathy female vocals' }),
          lyr('Lyrics to sing'), F.text('r-neg', 'Exclude', { req: true, value: 'off-key, harsh, distortion' }), F.gender('r-gender'), F.model('r-model'), F.tune('r'));
        break;
      case 'instrumental':
        parts.push(F.source('r-src', 'Vocal / melody track', track), F.text('r-title', 'Title', { max: 80, req: true }),
          F.area('r-style', 'Backing style', { rows: 2, max: styleMax, req: true, ph: 'acoustic guitar, soft piano, warm strings' }),
          F.text('r-neg', 'Exclude', { req: true, value: 'heavy distortion, harsh noise' }), F.model('r-model'), F.tune('r'));
        break;
      case 'mashup':
        parts.push(F.source('r-src', 'Track A', track), F.source('r-src2', 'Track B'), F.text('r-title', 'Title', { max: 80 }),
          F.area('r-style', 'Style', { rows: 2, max: styleMax }), lyr(), F.gender('r-gender'), F.model('r-model'), F.duration('r'), F.persona('r'), F.tune('r'));
        break;
      case 'replace':
        parts.push(F.source('r-src', 'Song', track),
          `<div class="grid-2">${F.num('r-start', 'Start (s)', { req: true, ph: '30' })}${F.num('r-end', 'End (s)', { req: true, ph: '45' })}</div><p class="hint" id="r-dur-hint">Replace at least 10 seconds and no more than half the song.</p>`,
          F.text('r-title', 'Title', { max: 80, req: true }), F.area('r-style', 'Style tags', { rows: 2, max: styleMax, req: true }),
          F.area('r-lyrics', 'New lyrics for this section', { rows: 3, max: 5000, req: true }),
          F.area('r-full', 'Full song lyrics (after the change)', { rows: 6, max: 5000, req: true }),
          F.text('r-neg', 'Exclude styles'), F.gender('r-gender'), F.model('r-model'), F.tune('r'));
        break;
    }
    $('#remix-form').innerHTML = parts.join('') + `<button class="btn btn-primary btn-block" id="r-go"><span class="btn-label">${OPS[op].ico} ${OPS[op].name}</span></button>`;
    renderPersonas();
    if (track) prefillFromTrack(track);
    const inst = $('#r-inst');
    if (inst) inst.addEventListener('change', () => { const l = $('#r-lyrics')?.closest('.field'); if (l) l.hidden = inst.checked; });
    $('#r-go').addEventListener('click', submitRemix);
    updateCounters();
  }

  const v = (id) => (document.getElementById(id)?.value || '').trim();
  const checked = (id) => !!document.getElementById(id)?.checked;

  async function submitRemix() {
    const op = state.remixOp;
    const src = $('#r-src');
    const url = v('r-src');
    const libTrack = src?.dataset.trackId ? trackById(src.dataset.trackId) : null;
    if (!url && !libTrack) { toast('Add a source track first', 'Upload a file, paste a URL, or pick from your library.', 'bad'); return; }
    const model = v('r-model') || 'V6';
    const inst = checked('r-inst');
    const body = { callBackUrl: CALLBACK };
    const addCommon = () => {
      if (v('r-title')) body.title = v('r-title');
      if (v('r-neg')) body.negativeTags = v('r-neg');
      if (!inst && v('r-lyrics')) { body.lyrics = v('r-lyrics'); body.prompt = v('r-lyrics'); }
      if (!inst && v('r-gender')) body.vocalGender = v('r-gender');
      if (checked('r-tune')) Object.assign(body, tuneValues('r', inst));
      if (checked('r-dur-on') && DURATION_MODELS.includes(model)) body.duration = Number(v('r-dur'));
      const pid = v('r-persona');
      if (pid && PERSONA_MODELS.includes(model)) { body.personaId = pid; body.personaModel = v('r-pmodel'); }
    };
    let path; let label = v('r-title') || libTrack?.title || OPS[op].name;
    const need = (id, what) => { if (!v(id)) { document.getElementById(id)?.focus(); throw new ApiError(`${what} is required.`, -1); } };

    try {
      switch (op) {
        case 'cover':
          path = '/api/v1/generate/upload-cover';
          Object.assign(body, { uploadUrl: url, model, instrumental: inst });
          if (v('r-style')) body.style = v('r-style');
          addCommon();
          if (!body.style && !body.lyrics) throw new ApiError('Give the cover a new style (or new lyrics).', -1);
          break;
        case 'extend':
          if (libTrack) { path = '/api/v1/generate/extend'; Object.assign(body, { audioId: libTrack.id, taskId: libTrack.taskId }); }
          else { path = '/api/v1/generate/upload-extend'; body.uploadUrl = url; }
          Object.assign(body, { model, instrumental: inst });
          if (v('r-at')) {
            const at = Number(v('r-at'));
            if (libTrack?.duration && at >= libTrack.duration) throw new ApiError(`“Continue from” must be less than the track length (${fmt(libTrack.duration)}).`, -1);
            body.continueAt = at;
          }
          if (v('r-style')) body.style = v('r-style');
          addCommon();
          delete body.duration;
          break;
        case 'vocals':
          need('r-title', 'Title'); need('r-style', 'Style'); need('r-neg', 'Exclude');
          path = '/api/v1/generate/add-vocals';
          Object.assign(body, { uploadUrl: url, model, style: v('r-style') });
          addCommon();
          break;
        case 'instrumental':
          need('r-title', 'Title'); need('r-style', 'Backing style'); need('r-neg', 'Exclude');
          path = '/api/v1/generate/add-instrumental';
          Object.assign(body, { uploadUrl: url, model, tags: v('r-style') });
          addCommon();
          break;
        case 'mashup': {
          const url2 = v('r-src2');
          if (!url2) throw new ApiError('Add a second track to mash up.', -1);
          path = '/api/v1/generate/mashup';
          Object.assign(body, { uploadUrlList: [url, url2], model });
          if (v('r-style')) body.style = v('r-style');
          addCommon();
          break;
        }
        case 'replace': {
          need('r-start', 'Start'); need('r-end', 'End'); need('r-title', 'Title'); need('r-style', 'Style tags'); need('r-lyrics', 'Section lyrics'); need('r-full', 'Full lyrics');
          const s = round2(v('r-start')); const en = round2(v('r-end'));
          if (en - s < 10) throw new ApiError('The section must be at least 10 seconds long.', -1);
          if (libTrack?.duration && en - s > libTrack.duration / 2) throw new ApiError(`You can replace at most half the song (${fmt(libTrack.duration / 2)}).`, -1);
          path = '/api/v1/generate/replace-section';
          if (libTrack) Object.assign(body, { taskId: libTrack.taskId, audioId: libTrack.id });
          else Object.assign(body, { uploadUrl: url, model });
          Object.assign(body, { infillStartS: s, infillEndS: en, tags: v('r-style'), fullLyrics: v('r-full') });
          addCommon();
          body.prompt = v('r-lyrics'); body.lyrics = v('r-lyrics');
          delete body.duration;
          break;
        }
      }
    } catch (e) { toast('Almost there', e.message, 'bad'); return; }

    const btn = $('#r-go'); setBusy(btn, true);
    try {
      const data = await api(path, body);
      addJob({ kind: 'music', taskId: data.taskId, label, op: OPS[op].name, model });
      toast(`${OPS[op].name} started ${OPS[op].ico}`, 'New takes will appear in your library.', 'good');
      refreshCredits();
    } catch (e) { handleError(e); } finally { setBusy(btn, false); }
  }

  function openRemix(op, track) {
    setTab('remix');
    renderRemix(op, track);
    $('.studio').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- JOBS & POLLING ----------
  const POLL = {
    music: (id) => `/api/v1/generate/record-info?taskId=${encodeURIComponent(id)}`,
    lyrics: (id) => `/api/v1/lyrics/record-info?taskId=${encodeURIComponent(id)}`,
    wav: (id) => `/api/v1/wav/record-info?taskId=${encodeURIComponent(id)}`,
    stems: (id) => `/api/v1/vocal-removal/record-info?taskId=${encodeURIComponent(id)}`,
    video: (id) => `/api/v1/mp4/record-info?taskId=${encodeURIComponent(id)}`,
    art: (id) => `/api/v1/suno/cover/record-info?taskId=${encodeURIComponent(id)}`,
  };
  const KIND_LABEL = { lyrics: 'Lyrics', wav: 'WAV export', stems: 'Stem split', video: 'Music video', art: 'Cover art' };

  function addJob(j) {
    const job = { id: `${j.kind}:${j.taskId}`, status: 'PENDING', createdAt: Date.now(), nextAt: Date.now() + 4000, meta: {}, ...j };
    state.jobs = state.jobs.filter((x) => x.id !== job.id);
    state.jobs.unshift(job);
    saveJobs(); renderJobs();
  }
  function finishJob(job, ok, error) {
    job.status = ok ? 'DONE' : 'FAILED';
    job.error = error;
    saveJobs(); renderJobs();
    if (ok) setTimeout(() => { state.jobs = state.jobs.filter((x) => x !== job); saveJobs(); renderJobs(); }, 2500);
  }

  let polling = false;
  function pollLoop() {
    if (polling) return;
    polling = true;
    const tick = async () => {
      if (state.key) {
        const now = Date.now();
        const due = state.jobs.filter((j) => !['DONE', 'FAILED'].includes(j.status) && (j.nextAt || 0) <= now);
        if (due.length) { await Promise.all(due.map(pollJob)); renderJobs(); }
      }
      setTimeout(tick, 2000);
    };
    tick();
  }

  async function pollJob(job) {
    const age = Date.now() - job.createdAt;
    job.nextAt = Date.now() + (age < 180000 ? 5000 : 12000);
    if (age > 25 * 60000) return finishJob(job, false, 'Timed out. The task may still finish — check back later.');
    let data;
    try { data = await api(POLL[job.kind](job.taskId)); }
    catch (e) {
      if (e.code === 401) return signOut('Your API key was rejected. Please enter a valid key.');
      job.misses = (job.misses || 0) + 1;
      if (job.misses > 8) finishJob(job, false, e.message);
      return;
    }
    job.misses = 0;
    if (!data) return;
    try { HANDLERS[job.kind](job, data); } catch (e) { console.error(e); }
    saveJobs();
  }

  const failed = (s) => typeof s === 'string' && /FAIL|ERROR/.test(s);

  const HANDLERS = {
    music(job, d) {
      const status = d.status || 'PENDING';
      job.status = status;
      const items = d.response?.sunoData || [];
      if (items.length) {
        const before = JSON.stringify(state.tracks);
        items.forEach((it) => upsertTrack(it, job));
        if (JSON.stringify(state.tracks) !== before) { saveTracks(); renderTracks(); }
      }
      if (status === 'FIRST_SUCCESS' && !job.firstNotified && items.some((it) => it.stream_audio_url || it.audio_url)) {
        job.firstNotified = true;
        const first = items.find((it) => it.stream_audio_url || it.audio_url);
        toast('First take is streaming 🎧', 'Listen now while the rest finishes.', 'good', [['▶ Listen', () => play(first.id)]]);
      }
      const hasAudio = items.length && items.every((it) => it.audio_url || it.source_audio_url);
      if (status === 'SUCCESS' || (status === 'CALLBACK_EXCEPTION' && hasAudio)) {
        finishJob(job, true);
        confetti();
        toast(job.op === 'Sound' ? 'Your sound is ready 🔊' : 'Fresh tracks are ready 🎉', job.label, 'good', items[0] ? [['▶ Play', () => play(items[0].id)]] : []);
        refreshCredits();
      } else if (failed(status) || status === 'CALLBACK_EXCEPTION') {
        const msg = status === 'SENSITIVE_WORD_ERROR' ? 'The prompt or lyrics tripped the content filter. Try rewording.' : d.errorMessage || 'Generation failed.';
        finishJob(job, false, msg);
        toast('Generation failed', msg, 'bad');
      }
    },
    lyrics(job, d) {
      job.status = d.status || 'PENDING';
      if (d.status === 'SUCCESS') {
        const got = (d.response?.data || []).filter((x) => x.status !== 'failed' && x.text);
        state.lyrics = [...got.map((x) => ({ title: x.title, text: x.text, prompt: job.label })), ...state.lyrics].slice(0, 12);
        store.set('lyrics', state.lyrics); renderLyrics();
        finishJob(job, true);
        toast('Lyrics are ready ✍️', `${got.length} version${got.length === 1 ? '' : 's'} to choose from.`, 'good', [['View', () => setTab('lyrics')]]);
      } else if (failed(d.status)) {
        const msg = d.status === 'SENSITIVE_WORD_ERROR' ? 'That topic tripped the content filter. Try rewording.' : d.errorMessage || 'Lyrics generation failed.';
        finishJob(job, false, msg); toast('Lyrics failed', msg, 'bad');
      }
    },
    wav(job, d) { extraHandler(job, d, d.response?.audioWavUrl, (t, url) => { t.extras.wav = url; }, 'WAV is ready 💿', () => download(d.response.audioWavUrl, `${slug(trackById(job.meta.trackId)?.title)}.wav`), '⬇ Download'); },
    video(job, d) { extraHandler(job, d, d.response?.videoUrl, (t, url) => { t.extras.video = url; }, 'Music video is ready 🎬', () => showVideo(trackById(job.meta.trackId)), '▶ Watch'); },
    stems(job, d) {
      const r = d.response || {};
      const stems = collectStems(r);
      extraHandler(job, d, stems.length ? stems : null, (t, s) => { t.extras.stems = s; }, 'Stems are ready 🎚️', () => showStems(trackById(job.meta.trackId)), 'Open');
    },
    art(job, d) {
      const flag = Number(d.successFlag);
      job.status = ['PENDING', 'SUCCESS', 'GENERATING', 'FAILED'][flag] || 'PENDING';
      if (flag === 1 && d.response?.images?.length) {
        const t = trackById(job.meta.trackId);
        if (t) { t.extras.covers = d.response.images; saveTracks(); renderTracks(); }
        finishJob(job, true);
        toast('New cover art 🖼️', '', 'good', [['Choose', () => showCovers(trackById(job.meta.trackId))]]);
      } else if (flag === 3) { finishJob(job, false, d.errorMessage || 'Cover art failed.'); toast('Cover art failed', d.errorMessage || '', 'bad'); }
    },
  };

  function extraHandler(job, d, result, apply, msg, action, actionLabel) {
    const flag = d.successFlag || 'PENDING';
    job.status = flag;
    if (result && (flag === 'SUCCESS' || flag === 'CALLBACK_EXCEPTION')) {
      const t = trackById(job.meta.trackId);
      if (t) { t.extras = t.extras || {}; apply(t, result); saveTracks(); renderTracks(); }
      finishJob(job, true);
      toast(msg, t?.title || '', 'good', [[actionLabel, action]]);
      refreshCredits();
    } else if (failed(flag) || flag === 'CALLBACK_EXCEPTION') {
      finishJob(job, false, d.errorMessage || 'Task failed.');
      toast(`${KIND_LABEL[job.kind]} failed`, d.errorMessage || '', 'bad');
    }
  }

  function collectStems(r) {
    const named = { vocalUrl: 'Vocals', instrumentalUrl: 'Instrumental', backingVocalsUrl: 'Backing vocals', drumsUrl: 'Drums', bassUrl: 'Bass', guitarUrl: 'Guitar', keyboardUrl: 'Keyboard', percussionUrl: 'Percussion', stringsUrl: 'Strings', synthUrl: 'Synth', fxUrl: 'FX', brassUrl: 'Brass', woodwindsUrl: 'Woodwinds' };
    const out = [];
    const seen = new Set();
    (r.originData || []).forEach((o) => { if (o.audio_url && !seen.has(o.audio_url)) { seen.add(o.audio_url); out.push({ name: o.stem_type_group_name || 'Stem', url: o.audio_url }); } });
    Object.entries(named).forEach(([k, name]) => { if (r[k] && !seen.has(r[k])) { seen.add(r[k]); out.push({ name, url: r[k] }); } });
    return out;
  }

  function upsertTrack(it, job) {
    if (!it.id) return;
    const ex = trackById(it.id);
    const t = {
      id: it.id,
      taskId: job.taskId,
      title: it.title || ex?.title || job.label,
      tags: it.tags || ex?.tags || '',
      lyrics: it.prompt || ex?.lyrics || '',
      image: ex?.imagePinned ? ex.image : it.image_url || it.source_image_url || ex?.image || '',
      audio: it.audio_url || it.source_audio_url || ex?.audio || '',
      stream: it.stream_audio_url || it.source_stream_audio_url || ex?.stream || '',
      duration: it.duration || ex?.duration || 0,
      model: it.model_name || ex?.model || job.model || '',
      op: job.op,
      createdAt: ex?.createdAt || Date.now(),
      fav: ex?.fav || false,
      imagePinned: ex?.imagePinned || false,
      extras: ex?.extras || {},
    };
    if (ex) Object.assign(ex, t); else state.tracks.unshift(t);
  }

  function renderJobs() {
    const el = $('#jobs');
    el.innerHTML = state.jobs.map((j) => {
      const failedJob = j.status === 'FAILED';
      const done = j.status === 'DONE';
      const secs = Math.round((Date.now() - j.createdAt) / 1000);
      const stageP = { PENDING: 18, TEXT_SUCCESS: 45, FIRST_SUCCESS: 78, SUCCESS: 100, DONE: 100 }[j.status] ?? 30;
      const p = done ? 100 : Math.min(95, stageP + Math.min(20, secs / 6));
      const lines = STAGE_LINES[j.status] || STAGE_LINES.PENDING;
      const line = failedJob ? j.error : done ? 'Done!' : j.kind === 'music' ? lines[Math.floor(secs / 7) % lines.length] : 'Working on it…';
      const what = j.kind === 'music' ? j.op : KIND_LABEL[j.kind];
      return `<div class="job ${failedJob ? 'failed' : ''}" style="--p:${p}%">
        ${failedJob ? '<span style="font-size:22px">⚠️</span>' : `<span class="eqbars ${done ? 'paused' : ''}"><i></i><i></i><i></i><i></i></span>`}
        <div class="job-main"><div class="job-title">${esc(what)} · ${esc(j.label)}</div><div class="job-sub">${esc(line)}${failedJob || done ? '' : ` · ${fmt(secs)}`}</div></div>
        <button class="icon-btn" data-dismiss="${esc(j.id)}" title="${failedJob ? 'Dismiss' : 'Stop tracking'}" aria-label="Dismiss">✕</button>
      </div>`;
    }).join('');
  }
  $('#jobs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dismiss]'); if (!b) return;
    state.jobs = state.jobs.filter((j) => j.id !== b.dataset.dismiss); saveJobs(); renderJobs();
  });

  // ---------- LIBRARY ----------
  function visibleTracks() {
    const q = state.query.toLowerCase();
    return state.tracks.filter((t) => (state.filter !== 'fav' || t.fav) && (!q || `${t.title} ${t.tags} ${t.lyrics}`.toLowerCase().includes(q)));
  }

  function renderTracks() {
    const list = visibleTracks();
    $('#empty').hidden = state.tracks.length > 0;
    if (state.tracks.length && !list.length) {
      $('#tracks').innerHTML = `<p class="hint" style="grid-column:1/-1">No tracks match. ${state.filter === 'fav' ? 'Star a track to add it to favorites.' : ''}</p>`;
      return;
    }
    $('#tracks').innerHTML = list.map((t) => {
      const playable = t.audio || t.stream;
      const final = !!t.audio;
      const ex = t.extras || {};
      const playing = state.current === t.id && !audio.paused;
      return `<article class="track ${state.current === t.id ? 'playing' : ''}" data-id="${esc(t.id)}">
        <div class="art">
          ${t.image ? `<img src="${esc(t.image)}" alt="" loading="lazy" />` : ''}
          <div class="tagline">${t.model ? `<span class="badge">${esc(String(t.model).replace(/^chirp-/, ''))}</span>` : ''}${t.op && t.op !== 'Song' ? `<span class="badge">${esc(t.op)}</span>` : ''}${!final ? '<span class="badge">Streaming</span>' : ''}</div>
          ${playable ? `<button class="play-over" data-act="play" aria-label="${playing ? 'Pause' : 'Play'} ${esc(t.title)}">${playing ? '❚❚' : '▶'}</button>` : ''}
          ${t.duration ? `<span class="dur">${fmt(t.duration)}</span>` : ''}
        </div>
        <div class="track-body">
          <div class="track-top"><div class="track-title" title="${esc(t.title)}">${esc(t.title)}</div><button class="fav ${t.fav ? 'on' : ''}" data-act="fav" aria-label="Favorite" title="Favorite">${t.fav ? '★' : '☆'}</button></div>
          ${t.tags ? `<div class="track-tags">${esc(t.tags)}</div>` : ''}
          ${ex.wav || ex.video || ex.stems?.length || ex.covers?.length ? `<div class="extras">
            ${ex.wav ? `<a href="#" data-act="wav">💿 WAV</a>` : ''}
            ${ex.video ? `<a href="#" data-act="video">🎬 Video</a>` : ''}
            ${ex.stems?.length ? `<a href="#" data-act="stems">🎚️ ${ex.stems.length} stems</a>` : ''}
            ${ex.covers?.length ? `<a href="#" data-act="art">🖼️ Covers</a>` : ''}
          </div>` : ''}
          <div class="track-actions">
            <button class="btn" data-act="download" ${final ? '' : 'disabled title="Available when the track finishes"'}>⬇ MP3</button>
            <button class="btn" data-act="extend" ${final ? '' : 'disabled'}>⏩ Extend</button>
            <div class="menu-wrap">
              <button class="btn" data-act="menu" aria-label="More actions" aria-haspopup="true" ${final ? '' : 'disabled'}>•••</button>
              <div class="menu" role="menu">
                <button data-act="karaoke">🎤 Sing-along lyrics</button>
                <button data-act="lyrics">📜 View lyrics & details</button>
                <hr />
                <button data-act="cover">🎨 Cover in a new style</button>
                <button data-act="replace">✂️ Replace a section</button>
                <button data-act="vocals">🎙️ Add vocals</button>
                <button data-act="instrumental">🎸 Add backing</button>
                <button data-act="mashup">🔀 Mash up with…</button>
                <hr />
                <button data-act="stems">🎚️ Split stems</button>
                <button data-act="wav">💿 Export WAV</button>
                <button data-act="video">🎬 Make music video</button>
                <button data-act="art">🖼️ New cover art</button>
                <button data-act="persona">🧬 Save voice as persona</button>
                <hr />
                <button data-act="remove" class="danger">🗑 Remove from library</button>
              </div>
            </div>
          </div>
        </div>
      </article>`;
    }).join('');
  }
  $('#tracks').addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.remove(); }, true);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-wrap')) $$('.menu.open').forEach((m) => m.classList.remove('open'));
  });

  $('#tracks').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    e.preventDefault();
    const card = b.closest('.track');
    const t = trackById(card.dataset.id); if (!t) return;
    const act = b.dataset.act;
    if (act !== 'menu') $$('.menu.open').forEach((m) => m.classList.remove('open'));
    switch (act) {
      case 'play': toggle(t.id); break;
      case 'fav': t.fav = !t.fav; saveTracks(); renderTracks(); break;
      case 'menu': {
        const m = $('.menu', b.parentElement);
        const open = !m.classList.contains('open');
        $$('.menu.open').forEach((x) => x.classList.remove('open'));
        m.classList.toggle('open', open);
        if (open) {
          m.classList.remove('up');
          const r = m.getBoundingClientRect();
          const bottomLimit = window.innerHeight - ($('#player').hidden ? 12 : 100);
          if (r.bottom > bottomLimit && b.getBoundingClientRect().top - 70 > r.height) m.classList.add('up');
        }
        break;
      }
      case 'download': download(t.audio, `${slug(t.title)}.mp3`); break;
      case 'extend': case 'cover': case 'replace': case 'vocals': case 'instrumental': case 'mashup': openRemix(act, t); break;
      case 'karaoke': play(t.id); openKaraoke(true); break;
      case 'lyrics': showDetails(t); break;
      case 'stems': t.extras?.stems?.length ? showStems(t) : stemsDialog(t); break;
      case 'wav': t.extras?.wav ? download(t.extras.wav, `${slug(t.title)}.wav`) : startWav(t); break;
      case 'video': t.extras?.video ? showVideo(t) : videoDialog(t); break;
      case 'art': t.extras?.covers?.length ? showCovers(t) : startArt(t); break;
      case 'persona': personaDialog(t); break;
      case 'remove':
        if (confirm(`Remove “${t.title}” from your library?`)) {
          state.tracks = state.tracks.filter((x) => x !== t); saveTracks(); renderTracks();
          if (state.current === t.id) { audio.pause(); }
        }
        break;
    }
  });

  $('#lib-search').addEventListener('input', (e) => { state.query = e.target.value; renderTracks(); });
  $('#lib-filter').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.filter = b.dataset.f;
    $$('#lib-filter button').forEach((x) => x.classList.toggle('active', x === b));
    renderTracks();
  });

  async function download(url, filename) {
    if (!url) return;
    toast('Preparing download…', filename);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  }

  // ---------- modal ----------
  const modal = $('#modal');
  let modalPrimary = null;
  function openModal(title, bodyHTML, actions = []) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = bodyHTML;
    $('#modal-body').onclick = null;
    const foot = $('#modal-foot');
    foot.innerHTML = '';
    modalPrimary = null;
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn ${a.primary ? 'btn-primary' : ''}`;
      b.innerHTML = `<span class="btn-label">${esc(a.label)}</span>`;
      b.onclick = async () => {
        if (!a.onClick) return modal.close();
        setBusy(b, true);
        try { if ((await a.onClick()) !== false) modal.close(); } finally { setBusy(b, false); }
      };
      if (a.primary) modalPrimary = b;
      foot.appendChild(b);
    });
    renderPersonas();
    updateCounters();
    modal.showModal();
  }
  $('#modal-form').addEventListener('submit', (e) => { e.preventDefault(); modalPrimary?.click(); });
  $('#modal-close').addEventListener('click', () => modal.close());
  modal.addEventListener('close', () => { $$('audio, video', modal).forEach((m) => m.pause()); });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

  async function startTask(path, body, kind, t, label) {
    try {
      const data = await api(path, { ...body, callBackUrl: CALLBACK });
      addJob({ kind, taskId: data.taskId, label: t.title, meta: { trackId: t.id } });
      toast(`${label} started`, 'We’ll let you know when it’s ready.', 'good');
      refreshCredits();
      return true;
    } catch (e) {
      if (kind === 'art' && e.data?.taskId) { // already generated once: just fetch it
        addJob({ kind, taskId: e.data.taskId, label: t.title, meta: { trackId: t.id } });
        return true;
      }
      handleError(e); return false;
    }
  }

  function startWav(t) { startTask('/api/v1/wav/generate', { taskId: t.taskId, audioId: t.id }, 'wav', t, 'WAV export'); }
  function startArt(t) { startTask('/api/v1/suno/cover/generate', { taskId: t.taskId }, 'art', t, 'Cover art'); }

  function stemsDialog(t) {
    openModal('Split into stems', `
      <p class="hint">Pull “${esc(t.title)}” apart for remixing, karaoke or practice.</p>
      <div class="field">
        <label class="check"><input type="radio" name="stype" value="separate_vocal" checked /> <span><b>Vocals + instrumental</b> — two clean tracks</span></label>
        <label class="check"><input type="radio" name="stype" value="split_stem" /> <span><b>Full band</b> — drums, bass, guitar, keys, and more</span></label>
        <label class="check"><input type="radio" name="stype" value="split_stem_advanced" /> <span><b>One instrument</b> — isolate a specific part</span></label>
      </div>
      <label class="field" id="stem-pick" hidden><span class="label">Instrument</span><select id="stem-name">${STEMS.map((s) => `<option>${s}</option>`).join('')}</select></label>`,
    [{ label: 'Cancel' }, { label: 'Split', primary: true, onClick: () => {
      const type = $('input[name=stype]:checked', modal).value;
      const body = { taskId: t.taskId, audioId: t.id, type };
      if (type === 'split_stem_advanced') body.stemName = $('#stem-name').value;
      return startTask('/api/v1/vocal-removal/generate', body, 'stems', t, 'Stem split');
    } }]);
    $$('input[name=stype]', modal).forEach((r) => r.addEventListener('change', () => { $('#stem-pick').hidden = r.value !== 'split_stem_advanced' || !r.checked; }));
  }

  function showStems(t) {
    const stems = t.extras?.stems || [];
    openModal(`Stems · ${t.title}`, `<div class="result-list">${stems.map((s, i) => `
      <div class="result-item"><span class="name">${esc(s.name)}</span><audio controls preload="none" src="${esc(s.url)}"></audio><button type="button" class="icon-btn" data-dl="${i}" title="Download">⬇</button></div>`).join('')}</div>`,
    [{ label: 'Split differently', onClick: () => { setTimeout(() => stemsDialog(t), 0); } }, { label: 'Done', primary: true }]);
    $('#modal-body').onclick = (e) => { const b = e.target.closest('[data-dl]'); if (b) { const s = stems[b.dataset.dl]; download(s.url, `${slug(t.title)}-${slug(s.name)}.mp3`); } };
  }

  function videoDialog(t) {
    openModal('Make a music video', `
      <p class="hint">Creates an MP4 with animated visuals and your cover art — perfect for sharing.</p>
      ${F.text('mv-author', 'Artist name', { max: 50, ph: 'Shown on the video' })}
      ${F.text('mv-domain', 'Watermark', { max: 50, ph: 'e.g. yoursite.com' })}`,
    [{ label: 'Cancel' }, { label: 'Create video', primary: true, onClick: () => {
      const body = { taskId: t.taskId, audioId: t.id };
      if (v('mv-author')) body.author = v('mv-author');
      if (v('mv-domain')) body.domainName = v('mv-domain');
      return startTask('/api/v1/mp4/generate', body, 'video', t, 'Music video');
    } }]);
  }
  function showVideo(t) {
    if (!t?.extras?.video) return;
    openModal(t.title, `<video src="${esc(t.extras.video)}" controls playsinline autoplay></video>`,
      [{ label: 'Download', onClick: () => { download(t.extras.video, `${slug(t.title)}.mp4`); return false; } }, { label: 'Close', primary: true }]);
    audio.pause();
  }

  function showCovers(t) {
    if (!t) return;
    openModal('Pick your cover art', `<p class="hint">Click an image to use it as this track’s artwork.</p><div class="cover-grid">${(t.extras.covers || []).map((u, i) => `<button type="button" class="icon-btn" style="width:auto;height:auto;padding:0" data-cover="${i}"><img src="${esc(u)}" alt="Cover option ${i + 1}" /></button>`).join('')}</div>`,
      [{ label: 'Close', primary: true }]);
    $('#modal-body').onclick = (e) => {
      const b = e.target.closest('[data-cover]'); if (!b) return;
      t.image = t.extras.covers[b.dataset.cover]; t.imagePinned = true;
      saveTracks(); renderTracks(); if (state.current === t.id) updatePlayerMeta(t);
      modal.close(); toast('Artwork updated 🖼️', '', 'good');
    };
  }

  function personaDialog(t) {
    const dur = Math.floor(t.duration || 60);
    openModal('Save as persona', `
      <p class="hint">Capture this track’s voice and vibe, then reuse it in future songs (Custom → Advanced → Persona).</p>
      ${F.text('pe-name', 'Persona name', { req: true, max: 60, ph: 'e.g. Velvet Midnight', value: t.title })}
      ${F.area('pe-desc', 'Describe the sound', { req: true, rows: 3, ph: 'Warm, husky female vocals with jazzy phrasing over lo-fi beats', value: t.tags })}
      <div class="grid-2">${F.num('pe-start', 'Analyze from (s)', { step: 1, value: 0 })}${F.num('pe-end', 'to (s)', { step: 1, value: Math.min(30, dur) })}</div>
      ${F.text('pe-style', 'Style label', { ph: 'e.g. Neo-soul', value: (t.tags || '').split(',')[0] })}`,
    [{ label: 'Cancel' }, { label: 'Create persona', primary: true, onClick: async () => {
      if (!v('pe-name') || !v('pe-desc')) { toast('Name and description are required', '', 'bad'); return false; }
      const body = { taskId: t.taskId, audioId: t.id, name: v('pe-name'), description: v('pe-desc') };
      if (v('pe-start') !== '') body.vocalStart = Number(v('pe-start'));
      if (v('pe-end') !== '') body.vocalEnd = Number(v('pe-end'));
      if (v('pe-style')) body.style = v('pe-style');
      if (body.vocalEnd <= body.vocalStart) { toast('End must be after start', '', 'bad'); return false; }
      try {
        const d = await api('/api/v1/generate/generate-persona', body);
        state.personas.unshift({ id: d.personaId, name: d.name || body.name, model: 'style_persona' });
        store.set('personas', state.personas); renderPersonas();
        toast('Persona saved 🧬', 'Find it under Custom → Advanced → Persona.', 'good');
        return true;
      } catch (e) { handleError(e, 'Couldn’t create persona'); return false; }
    } }]);
  }

  function showDetails(t) {
    openModal(t.title, `
      ${t.image ? `<img src="${esc(t.image)}" alt="" style="width:100%;border-radius:14px;margin-bottom:12px;max-height:220px;object-fit:cover" />` : ''}
      ${t.tags ? `<p class="hint"><b>Style:</b> ${esc(t.tags)}</p>` : ''}
      <pre style="white-space:pre-wrap;font:inherit;font-size:14px;background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:12px;max-height:40vh;overflow:auto">${esc(t.lyrics || 'Instrumental — no lyrics.')}</pre>
      <p class="fine">Model: ${esc(t.model || '—')} · Length: ${fmt(t.duration)}<br/>Task ID: <code>${esc(t.taskId)}</code><br/>Audio ID: <code>${esc(t.id)}</code></p>`,
    [{ label: 'Copy lyrics', onClick: () => { navigator.clipboard?.writeText(t.lyrics || ''); toast('Lyrics copied'); return false; } },
      { label: 'Reuse in Custom', onClick: () => {
        setMode('custom'); setTab('create');
        $('#c-title').value = t.title || ''; $('#c-style').value = t.tags || ''; $('#c-lyrics').value = t.lyrics || '';
        syncStyleChips(); updateCounters();
      } }, { label: 'Close', primary: true }]);
  }

  // ---------- PLAYER ----------
  const audio = $('#audio');
  audio.volume = Number(store.get('vol', 0.9));
  $('#p-vol').value = audio.volume;

  function updatePlayerMeta(t) {
    $('#p-title').textContent = t.title;
    $('#p-sub').textContent = t.tags || t.op || '';
    const art = $('#p-art');
    if (t.image) { art.src = t.image; art.style.visibility = ''; } else { art.removeAttribute('src'); }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: 'Riff', artwork: t.image ? [{ src: t.image, sizes: '512x512' }] : [] });
    }
  }
  function play(id) {
    const t = trackById(id); if (!t) return;
    const src = t.audio || t.stream;
    if (!src) return toast('Not ready yet', 'Audio appears once the first take streams.');
    if (state.current !== id || !audio.src) {
      state.current = id;
      audio.src = src;
      updatePlayerMeta(t);
      karaoke.words = null;
      if (karaoke.open) loadKaraoke(t);
    }
    $('#player').hidden = false;
    $('#app').classList.add('has-player');
    audio.play().catch(() => toast('Couldn’t play this track', 'The link may have expired (Suno keeps files ~14 days).', 'bad'));
  }
  function toggle(id) {
    if (id && id !== state.current) return play(id);
    if (audio.paused) play(state.current); else audio.pause();
  }
  function step(dir) {
    const list = visibleTracks().filter((t) => t.audio || t.stream);
    if (!list.length) return;
    const i = list.findIndex((t) => t.id === state.current);
    play(list[(i + dir + list.length) % list.length].id);
  }
  $('#p-play').addEventListener('click', () => toggle());
  $('#p-prev').addEventListener('click', () => (audio.currentTime > 3 ? (audio.currentTime = 0) : step(-1)));
  $('#p-next').addEventListener('click', () => step(1));
  $('#p-vol').addEventListener('input', (e) => { audio.volume = Number(e.target.value); store.set('vol', audio.volume); });
  let seeking = false;
  $('#p-bar').addEventListener('input', (e) => { seeking = true; if (audio.duration) $('#p-cur').textContent = fmt((e.target.value / 1000) * audio.duration); });
  $('#p-bar').addEventListener('change', (e) => { if (isFinite(audio.duration)) audio.currentTime = (e.target.value / 1000) * audio.duration; seeking = false; });
  audio.addEventListener('timeupdate', () => {
    if (!seeking && isFinite(audio.duration)) $('#p-bar').value = (audio.currentTime / audio.duration) * 1000;
    $('#p-cur').textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('loadedmetadata', () => { $('#p-dur').textContent = isFinite(audio.duration) ? fmt(audio.duration) : '∞'; });
  const syncPlayState = () => {
    $('#p-play').textContent = audio.paused ? '▶' : '❚❚';
    $('#p-play').setAttribute('aria-label', audio.paused ? 'Play' : 'Pause');
    $$('.track').forEach((c) => {
      const on = c.dataset.id === state.current;
      c.classList.toggle('playing', on);
      const b = $('.play-over', c); if (b) b.textContent = on && !audio.paused ? '❚❚' : '▶';
    });
    if (!audio.paused && karaoke.open) karaokeTick();
  };
  audio.addEventListener('play', syncPlayState);
  audio.addEventListener('pause', syncPlayState);
  audio.addEventListener('ended', () => step(1));
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => audio.play());
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
  }

  // ---------- karaoke (timestamped lyrics) ----------
  const karaoke = { open: false, words: null, spans: [], last: -1 };
  function openKaraoke(on) {
    karaoke.open = on;
    $('#karaoke').hidden = !on;
    $('#p-karaoke').classList.toggle('on', on);
    const t = trackById(state.current);
    if (on && t) loadKaraoke(t);
  }
  $('#p-karaoke').addEventListener('click', () => openKaraoke(!karaoke.open));

  async function loadKaraoke(t) {
    const box = $('#k-lines');
    if (!t.audio) { box.innerHTML = '<p class="k-empty">Sing-along lyrics are available once the track finishes.</p>'; return; }
    let words = t.extras?.aligned;
    if (!words) {
      box.innerHTML = '<p class="k-empty">Syncing lyrics to the beat…</p>';
      try {
        const d = await api('/api/v1/generate/get-timestamped-lyrics', { taskId: t.taskId, audioId: t.id });
        words = (d?.alignedWords || []).map((w) => ({ w: w.word, s: w.startS, e: w.endS }));
        t.extras = t.extras || {}; t.extras.aligned = words; saveTracks();
      } catch (e) {
        box.innerHTML = `<p class="k-empty">${esc(e.message)}</p>`; return;
      }
    }
    if (state.current !== t.id) return;
    if (!words.length) { box.innerHTML = '<p class="k-empty">No sung lyrics found — enjoy the instrumental 🎶</p>'; return; }
    karaoke.words = words;
    box.innerHTML = words.map((w, i) => {
      const clean = esc(w.w.replace(/\[[^\]]*\]/g, '')).replace(/\n+/g, '<br/>');
      return `<span class="w" data-i="${i}">${clean}</span>`;
    }).join('');
    karaoke.spans = $$('.w', box);
    karaoke.last = -1;
    karaokeTick();
  }
  function karaokeTick() {
    if (!karaoke.open || !karaoke.words) return;
    const ct = audio.currentTime;
    let idx = -1;
    for (let i = 0; i < karaoke.words.length; i++) { if (karaoke.words[i].s <= ct) idx = i; else break; }
    if (idx !== karaoke.last) {
      karaoke.spans.forEach((s, i) => { s.classList.toggle('sung', i < idx); s.classList.toggle('now', i === idx); });
      const cur = karaoke.spans[idx];
      if (cur) { const box = $('#karaoke'); box.scrollTop = cur.offsetTop - box.clientHeight / 2; }
      karaoke.last = idx;
    }
    if (!audio.paused) requestAnimationFrame(karaokeTick);
  }
  audio.addEventListener('seeked', karaokeTick);

  // ---------- keyboard ----------
  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches('input, textarea, select, [contenteditable]');
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !$('#app').hidden && !modal.open) {
      e.preventDefault();
      const target = { create: '#generate', lyrics: '#l-go', sounds: '#x-go', remix: '#r-go' }[$('.tab.active').dataset.tab];
      if (target) $(target)?.click();
    } else if (e.code === 'Space' && !typing && !modal.open && state.current && !$('#app').hidden) {
      e.preventDefault(); toggle();
    }
  });

  // ---------- init ----------
  function renderAll() {
    renderModels();
    setMode(state.mode);
    renderTracks();
    renderJobs();
    renderLyrics();
    renderPersonas();
    renderMedia();
    renderRemix(state.remixOp);
    syncInstrumental();
    updateCounters();
    refreshCredits();
  }

  // Refresh "elapsed" labels on active jobs.
  setInterval(() => { if (state.jobs.some((j) => !['DONE', 'FAILED'].includes(j.status))) renderJobs(); }, 1000);

  // ---------- session lifecycle (driven by auth.js) ----------
  const USER_KEYS = ['tracks', 'jobs', 'personas', 'lyrics'];

  // Data created before accounts existed belongs to whoever signs in first on this device.
  function adoptLegacyData() {
    try {
      USER_KEYS.forEach((k) => {
        const old = localStorage.getItem('riff.' + k);
        if (old != null && localStorage.getItem(scope + k) == null) localStorage.setItem(scope + k, old);
        localStorage.removeItem('riff.' + k);
      });
      [localStorage, sessionStorage].forEach((st) => {
        const old = st.getItem('riff.key');
        if (old && !st.getItem(scope + 'key')) st.setItem(scope + 'key', old);
        st.removeItem('riff.key');
      });
    } catch { /* storage unavailable */ }
  }

  function start(user) {
    if (state.user?.id === user.id) return;
    if (state.user) stop();
    state.user = user;
    scope = `riff.u.${user.id}.`;
    adoptLegacyData();
    state.tracks = store.get('tracks', []);
    state.jobs = store.get('jobs', []);
    state.personas = store.get('personas', []);
    state.lyrics = store.get('lyrics', []);
    const email = user.email || 'your account';
    $$('.who').forEach((el) => { el.textContent = email; });
    $('#avatar').textContent = email.charAt(0);
    state.key = readKey();
    if (state.key) enterApp();
    else { $('#gate-error').hidden = true; $('#gate').hidden = false; $('#gate-key').focus(); }
  }

  function stop() {
    state.key = '';
    state.user = null;
    scope = 'riff.';
    state.tracks = []; state.jobs = []; state.personas = []; state.lyrics = [];
    state.current = null;
    audio.pause(); audio.removeAttribute('src');
    if (modal.open) modal.close();
    openKaraoke(false);
    $('#player').hidden = true;
    $('#app').classList.remove('has-player');
    $('#account-menu').classList.remove('open');
    $('#app').hidden = true;
    $('#gate').hidden = true;
    $('#gate-key').value = '';
    $$('.toast').forEach((t) => t.remove());
  }

  window.Riff = { start, stop };
})();
