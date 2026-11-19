/* ============================================================
   Jarvis PWA v0.1 — cerveau agnostique, mémoire locale,
   compagnon animé, Mode Live (STT/TTS navigateur), validation OUI/NON.
   ============================================================ */
'use strict';

const K_CFG = 'jarvis.cfg.v1';
const K_MSGS = 'jarvis.msgs.v1';
const K_FACTS = 'jarvis.facts.v1';
const MAX_MSGS = 200;
const MAX_CONTEXT = 16;

const PRESETS = {
  openai:    { base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini:    { base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  openrouter:{ base: 'https://openrouter.ai/api/v1', model: 'google/gemini-2.0-flash-001' },
  ollama:    { base: 'http://localhost:11434/v1', model: 'llama3.1' }
};

const SYSTEM_PROMPT = `Tu es Jarvis, l'assistant personnel de Rico. Tu vis dans une bulle flottante sur son téléphone Android et tu apparais aussi en plein écran.

Règles absolues :
- Tu parles TOUJOURS français, ton direct, chaleureux, jamais flagorneur. Pas de « Excellente question ».
- Tu es concis : 1 à 4 phrases par défaut. Tu détailles seulement si on te le demande.
- Toute action irréversible (envoyer, publier, payer, supprimer, modifier) doit être proposée AVANT, jamais exécutée seule. Rico valide OUI ou NON.
- Tu ne publies jamais sur les réseaux sociaux sans son accord explicite.
- Si tu ne sais pas, tu le dis franchement au lieu d'inventer.

Actions disponibles (uniquement si Rico le demande explicitement) : tu termines ta réponse par une ligne exactement de la forme
<<<ACTION {"type":"open_url","url":"https://...","label":"Ouvrir ..."}>>>
Types autorisés : open_url, copy_text, save_note, add_fact, add_mission. Une seule action par réponse.
Pour une mission récurrente : <<<ACTION {"type":"add_mission","title":"Point ventes GPA X","prompt":"Résume mes ventes de la semaine.","kind":"weekly","time":"08:00","dow":1}>>>
kind vaut daily, weekly ou once ; dow va de 0 (dimanche) à 6 (samedi).
Le système demandera confirmation à Rico avant d'exécuter.`;

/* ---------------- storage ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('storage', e); } },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

let cfg = Object.assign(
  { base: '', key: '', model: '', voice: true, compagnon: 'robot' },
  store.get(K_CFG, {})
);
let facts = store.get(K_FACTS, '');
let msgs = store.get(K_MSGS, []);
let busy = false;
let liveOn = false;
let recog = null;

/* ---------------- dom ---------------- */
const $ = (s) => document.querySelector(s);
const chatEl = $('#chat');
const inputEl = $('#input');
const sendBtn = $('#send');
const bubbleEl = $('#bubble');
const badgeEl = $('#bubbleBadge');
const liveBar = $('#liveBar');
const liveText = $('#liveText');
const toastEl = $('#toast');

/* ---------------- ui helpers ---------------- */
function toast(t, ms = 2600) {
  toastEl.textContent = t;
  toastEl.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.add('hidden'), ms);
}
function buzz(ms = 12) { try { navigator.vibrate && navigator.vibrate(ms); } catch {} }
function emotion(e, revertMs) {
  bubbleEl.dataset.emotion = e;
  if (revertMs) {
    clearTimeout(emotion._t);
    emotion._t = setTimeout(() => { if (!busy && !liveOn) emotion('idle'); }, revertMs);
  }
}
function scrollDown() { chatEl.scrollTop = chatEl.scrollHeight; }

function addMsg(role, text, opts = {}) {
  const el = document.createElement('div');
  el.className = 'msg ' + (role === 'user' ? 'user' : role === 'system' ? 'sys' : role === 'error' ? 'error' : 'jarvis');
  el.textContent = text;
  if (opts.meta) {
    const m = document.createElement('span');
    m.className = 'meta';
    m.textContent = opts.meta;
    el.appendChild(m);
  }
  chatEl.appendChild(el);
  scrollDown();
  return el;
}

function persist() {
  if (msgs.length > MAX_MSGS) msgs = msgs.slice(-MAX_MSGS);
  store.set(K_MSGS, msgs);
}

function renderHistory() {
  chatEl.innerHTML = '';
  if (!msgs.length) {
    addMsg('jarvis', "Je suis là. Pose ta question, ou appuie sur le micro pour me parler en direct.");
    return;
  }
  msgs.forEach((m) => addMsg(m.role, m.content));
  scrollDown();
}

/* ---------------- brain ---------------- */
function companionBrief() {
  try {
    const p = window.XP ? window.XP.state() : null;
    if (!p) return '';
    const l = window.XP.levelOf(p.xp);
    const sp = window.XP.SPECIES[p.species] || window.XP.SPECIES.robot;
    return `\n\nTon état actuel : ton nom est ${p.name}. Tu es au niveau ${l.n} sur 8, « ${l.name} », avec ${p.xp} XP. `
      + `Ta forme actuelle est ${sp.label} — personnalité ${sp.perso}. `
      + (p.streak > 1 ? `Rico revient pour le ${p.streak}e jour d'affilée. ` : '')
      + `Niveau 1 à 3 tu es encore jeune : tu poses des questions, tu t'émerveilles. Plus tu montes, plus tu es sûr de toi et synthétique.`;
  } catch { return ''; }
}

function buildContext() {
  const out = [{ role: 'system', content: SYSTEM_PROMPT + companionBrief() + (facts ? `\n\nCe que tu sais déjà de Rico :\n${facts}` : '') }];
  const tail = msgs.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-MAX_CONTEXT);
  tail.forEach((m) => out.push({ role: m.role, content: m.content }));
  return out;
}

async function streamChat(onDelta) {
  if (!cfg.key || !cfg.base || !cfg.model) {
    throw new Error("Aucun cerveau configuré. Ouvre les réglages (⚙️) et colle ta clé API.");
  }
  const url = cfg.base.replace(/\/+$/, '') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + cfg.key
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: buildContext(),
      temperature: 0.7,
      stream: true
    })
  });

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 300); } catch {}
    throw new Error(`Le cerveau a refusé la requête (${res.status}). ${detail}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        const d = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message);
        const piece = d && d.content;
        if (piece) { full += piece; onDelta(full); }
      } catch { /* fragment incomplet, on ignore */ }
    }
  }
  return full;
}

/* ---------------- missions : appeler le cerveau hors conversation ---------------- */
async function rawAsk(prompt) {
  if (!cfg.key || !cfg.base || !cfg.model) throw new Error('aucun cerveau configuré');
  const url = cfg.base.replace(/\/+$/, '') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + companionBrief() + (facts ? `\n\nCe que tu sais déjà de Rico :\n${facts}` : '') },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6
    })
  });
  if (!res.ok) throw new Error('le cerveau a refusé (' + res.status + ')');
  const j = await res.json();
  const d = j.choices && j.choices[0] && j.choices[0].message;
  return (d && d.content) || '(rien)';
}

async function runDueMissions() {
  if (!window.Missions || !cfg.key) return;
  await window.Missions.tick(
    async (text, m) => {
      const el = addMsg('jarvis', String(text));
      el.classList.add('mission');
      const tag = document.createElement('span');
      tag.className = 'meta';
      tag.textContent = 'mission · ' + m.title;
      el.prepend(tag);
      msgs.push({ role: 'assistant', content: `[${m.title}] ${text}` });
      persist();
      if (liveOn) speak(text);
    },
    rawAsk
  );
}

/* ---------------- actions ---------------- */
const ACTION_RE = /<<<ACTION\s*(\{[\s\S]*?\})\s*>>>/;

function extractAction(text) {
  const m = text.match(ACTION_RE);
  if (!m) return { clean: text, action: null };
  let action = null;
  try { action = JSON.parse(m[1]); } catch {}
  return { clean: text.replace(ACTION_RE, '').trim(), action };
}

const ACTION_LABEL = {
  open_url: 'Ouvrir un lien',
  copy_text: 'Copier dans le presse-papier',
  save_note: 'Enregistrer une note',
  add_fact: 'Mémoriser un fait',
  add_mission: 'Créer une mission récurrente'
};

function askConfirm(action) {
  return new Promise((resolve) => {
    const modal = $('#confirm');
    const title = $('#confirmTitle');
    const text = $('#confirmText');
    const detail = $('#confirmDetail');

    title.textContent = ACTION_LABEL[action.type] || 'Action demandée';
    text.textContent = action.label || action.text || action.url || action.note || 'Jarvis veut agir.';
    const raw = JSON.stringify(action, null, 2);
    detail.textContent = raw;
    detail.classList.remove('hidden');

    modal.classList.remove('hidden');
    emotion('surprised');

    const done = (ok) => {
      modal.classList.add('hidden');
      $('#confirmYes').onclick = null;
      $('#confirmNo').onclick = null;
      emotion('idle');
      buzz(ok ? 18 : 8);
      resolve(ok);
    };
    $('#confirmYes').onclick = () => done(true);
    $('#confirmNo').onclick = () => done(false);
  });
}

async function runAction(a) {
  switch (a.type) {
    case 'open_url': {
      const u = String(a.url || '');
      if (!/^https?:\/\//i.test(u)) throw new Error('URL invalide');
      window.open(u, '_blank', 'noopener');
      return 'Lien ouvert.';
    }
    case 'copy_text': {
      await navigator.clipboard.writeText(String(a.text || ''));
      return 'Copié.';
    }
    case 'save_note': {
      const notes = store.get('jarvis.notes', []);
      notes.push({ t: Date.now(), text: String(a.note || a.text || '') });
      store.set('jarvis.notes', notes.slice(-500));
      return 'Note enregistrée.';
    }
    case 'add_fact': {
      const f = String(a.fact || a.text || '').trim();
      if (!f) throw new Error('Fait vide');
      facts = (facts ? facts + '\n' : '') + '- ' + f;
      store.set(K_FACTS, facts);
      $('#cfgFacts').value = facts;
      return 'Mémorisé.';
    }
    case 'add_mission': {
      if (!window.Missions) throw new Error('module missions indisponible');
      const m = window.Missions.create({
        title: a.title || a.mission || 'Mission',
        prompt: a.prompt || a.task || a.title || '',
        kind: a.kind === 'weekly' ? 'weekly' : a.kind === 'once' ? 'once' : 'daily',
        time: /^\d{2}:\d{2}$/.test(a.time || '') ? a.time : '08:00',
        dow: typeof a.dow === 'number' ? a.dow : 1
      });
      window.Missions.render();
      return `Mission « ${m.title} » créée. Elle tournera à la prochaine ouverture après l'heure dite.`;
    }
    default:
      throw new Error('Action non autorisée : ' + a.type);
  }
}

/* ---------------- send flow ---------------- */
async function send(text) {
  if (busy) return;
  text = (text || '').trim();
  if (!text) return;

  busy = true;
  sendBtn.disabled = true;
  inputEl.value = '';
  autoGrow();

  addMsg('user', text);
  msgs.push({ role: 'user', content: text });
  persist();
  if (window.XP) XP.add(liveOn ? 'voix' : 'conversation');

  const holder = addMsg('jarvis', '');
  holder.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
  emotion('thinking');

  let acc = '';
  let streamed = '';
  try {
    const full = await streamChat((partial) => {
      streamed = partial;
      holder.textContent = partial;
      scrollDown();
    });
    acc = full || streamed;

    const { clean, action } = extractAction(acc);
    holder.textContent = clean || '(rien)';

    msgs.push({ role: 'assistant', content: clean });
    persist();

    emotion(clean.length > 220 ? 'idle' : 'happy', 2600);

    if (action) {
      holder.appendChild(Object.assign(document.createElement('span'), {
        className: 'meta', textContent: 'action proposée'
      }));
      const ok = await askConfirm(action);
      if (ok) {
        try {
          const r = await runAction(action);
          addMsg('system', '✓ ' + r);
          if (window.XP) XP.add('action');
          if (liveOn) speak(r);
        } catch (e) {
          addMsg('error', 'Action échouée : ' + e.message);
        }
      } else {
        addMsg('system', 'Action refusée.');
        msgs.push({ role: 'assistant', content: '[Action refusée par Rico]' });
        persist();
      }
    }

    if (liveOn) speak(clean);
  } catch (e) {
    holder.remove();
    addMsg('error', e.message || String(e));
    emotion('sad', 3200);
    if (liveOn) speak("Je n'ai pas pu joindre mon cerveau. Vérifie les réglages.");
  } finally {
    busy = false;
    sendBtn.disabled = false;
    if (!liveOn) emotion('idle');
    scrollDown();
  }
}

/* ---------------- Mode Live ---------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function pickVoice() {
  const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  return vs.find((v) => /fr[-_]FR/i.test(v.lang) && /google|amelie|thomas|audrey/i.test(v.name))
      || vs.find((v) => /^fr/i.test(v.lang)) || null;
}

function speak(text) {
  if (!cfg.voice || !window.speechSynthesis || !text) return;
  try { speechSynthesis.cancel(); } catch {}
  const u = new SpeechSynthesisUtterance(String(text).slice(0, 1200));
  u.lang = 'fr-FR';
  u.rate = 1.02;
  u.pitch = 1;
  const v = pickVoice();
  if (v) u.voice = v;
  u.onstart = () => emotion('speaking');
  u.onend = () => { emotion(liveOn ? 'listening' : 'idle'); if (liveOn) resumeListening(); };
  speechSynthesis.speak(u);
}

function stopSpeaking() {
  try { speechSynthesis.cancel(); } catch {}
}

function startLive() {
  if (!SR) {
    toast("Ton navigateur ne gère pas la reconnaissance vocale. Utilise Chrome.");
    return;
  }
  liveOn = true;
  liveBar.classList.remove('hidden');
  $('#btnLive').style.borderColor = 'var(--cyan)';
  emotion('listening');
  listen();
}

function stopLive() {
  liveOn = false;
  liveBar.classList.add('hidden');
  $('#btnLive').style.borderColor = '';
  stopSpeaking();
  try { recog && recog.stop(); } catch {}
  recog = null;
  emotion('idle');
}

function listen() {
  if (!liveOn) return;
  try { recog && recog.abort(); } catch {}
  recog = new SR();
  recog.lang = 'fr-FR';
  recog.continuous = false;
  recog.interimResults = true;
  recog.maxAlternatives = 1;

  let finalText = '';

  recog.onstart = () => { emotion('listening'); liveText.textContent = 'Écoute…'; };

  recog.onresult = (ev) => {
    // barge-in : Rico reprend la parole pendant que Jarvis parle
    if (window.speechSynthesis && speechSynthesis.speaking) {
      stopSpeaking();
      emotion('surprised', 400);
    }
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    liveText.textContent = (finalText || interim || '…').slice(-70);
  };

  recog.onerror = (e) => {
    if (e.error === 'not-allowed') { toast('Micro refusé. Autorise le micro pour ce site.'); stopLive(); return; }
    if (e.error === 'no-speech') { if (liveOn) setTimeout(listen, 500); return; }
    liveText.textContent = 'Erreur micro : ' + e.error;
    if (liveOn) setTimeout(listen, 900);
  };

  recog.onend = () => {
    const t = finalText.trim();
    if (t && liveOn) {
      try { recog.abort(); } catch {}
      recog = null;
      liveText.textContent = '« ' + t + ' »';
      send(t);
    } else if (liveOn && !busy) {
      setTimeout(listen, 350);
    }
  };

  try { recog.start(); } catch { setTimeout(listen, 600); }
}

function resumeListening() {
  if (liveOn && !busy) setTimeout(listen, 260);
}

/* ---------------- settings ---------------- */
function openSettings() {
  $('#cfgBase').value = cfg.base || '';
  $('#cfgKey').value = cfg.key || '';
  $('#cfgModel').value = cfg.model || '';
  $('#cfgVoice').checked = !!cfg.voice;
  const cg = $('#cfgCompagnon');
  if (cg) cg.value = cfg.compagnon || 'robot';
  $('#cfgFacts').value = facts || '';
  $('#settings').classList.remove('hidden');
  emotion('idle');
}
function closeSettings() {
  cfg.base = $('#cfgBase').value.trim().replace(/\/+$/, '');
  cfg.key = $('#cfgKey').value.trim();
  cfg.model = $('#cfgModel').value.trim();
  cfg.voice = $('#cfgVoice').checked;
  cfg.compagnon = $('#cfgCompagnon').value;
  facts = $('#cfgFacts').value;
  store.set(K_CFG, cfg);
  store.set(K_FACTS, facts);
  bubbleEl.dataset.emotion = cfg.compagnon || 'robot';
  if (cfg.compagnon === 'robot') emotion('idle'); else bubbleEl.dataset.emotion = cfg.compagnon;
  $('#settings').classList.add('hidden');
  toast('Réglages enregistrés.');
}

/* ---------------- events ---------------- */
$('#btnSettings').onclick = openSettings;
$('#closeSettings').onclick = closeSettings;
$('#btnLive').onclick = () => (liveOn ? stopLive() : startLive());
$('#liveStop').onclick = stopLive;

document.querySelectorAll('.preset').forEach((b) => {
  b.onclick = () => {
    const p = PRESETS[b.dataset.p];
    if (!p) return;
    $('#cfgBase').value = p.base;
    $('#cfgModel').value = p.model;
    if (b.dataset.p === 'ollama') toast("Ollama doit tourner sur un PC du même réseau.");
  };
});

$('#btnExport').onclick = () => {
  const txt = msgs.map((m) => `${m.role === 'user' ? 'RICO' : 'JARVIS'} : ${m.content}`).join('\n\n');
  const blob = new Blob([txt || '(vide)'], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'jarvis-conversation.txt';
  a.click();
  URL.revokeObjectURL(a.href);
};

$('#btnWipe').onclick = () => {
  if (!confirm('Effacer la conversation, la mémoire et les réglages ?')) return;
  ['jarvis.cfg.v1', 'jarvis.msgs.v1', 'jarvis.facts.v1', 'jarvis.notes'].forEach(store.del);
  msgs = []; facts = '';
  cfg = { base: '', key: '', model: '', voice: true, compagnon: 'robot' };
  renderHistory();
  toast('Tout est effacé.');
};

$('#composer').onsubmit = (e) => { e.preventDefault(); send(inputEl.value); };

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inputEl.value); }
});
function autoGrow() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 132) + 'px';
}
inputEl.addEventListener('input', autoGrow);

/* compagnon : drag + tap */
(function dragBubble() {
  let sx = 0, sy = 0, ox = 0, oy = 0, moving = false, moved = false;
  const setPos = (x, y) => {
    const w = bubbleEl.offsetWidth, h = bubbleEl.offsetHeight;
    const maxX = innerWidth - w - 6, maxY = innerHeight - h - 6;
    bubbleEl.style.left = Math.max(6, Math.min(x, maxX)) + 'px';
    bubbleEl.style.top = Math.max(6, Math.min(y, maxY)) + 'px';
    bubbleEl.style.right = 'auto';
    bubbleEl.style.bottom = 'auto';
    bubbleEl.style.transform = 'none';
  };
  bubbleEl.addEventListener('pointerdown', (e) => {
    const r = bubbleEl.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    moving = true; moved = false;
    bubbleEl.setPointerCapture(e.pointerId);
  });
  bubbleEl.addEventListener('pointermove', (e) => {
    if (!moving) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    if (moved) setPos(ox + dx, oy + dy);
  });
  bubbleEl.addEventListener('pointerup', (e) => {
    moving = false;
    if (!moved) {
      // tap : taquiner le compagnon
      const list = ['happy', 'surprised', 'curious', 'happy'];
      emotion(list[Math.floor(Math.random() * list.length)], 1200);
      buzz(10);
      const q = ['Oui ?', 'Je t\'écoute.', 'Besoin de moi ?'][Math.floor(Math.random() * 3)];
      if (!busy) toast(q, 1400);
    }
  });
  try {
    const saved = store.get('jarvis.bubblePos', null);
    if (saved) setPos(saved.left, saved.top);
    bubbleEl.addEventListener('pointerup', () => {
      const r = bubbleEl.getBoundingClientRect();
      store.set('jarvis.bubblePos', { left: r.left, top: r.top });
    });
  } catch {}
})();

/* install prompt */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('#btnInstall').classList.remove('hidden');
});
$('#btnInstall').onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') $('#btnInstall').classList.add('hidden');
  deferredPrompt = null;
};

/* boot */
function boot() {
  renderHistory();
  emotion('idle');
  if (window.XP) {
    const p = XP.state();
    const l = XP.levelOf(p.xp);
    const d = p.lastAway || 0;
    setTimeout(() => {
      if (p.msgCount > 0 || p.xp > 0) {
        const r = d > 1 ? `Te revoilà après ${d} jours. Je n'ai pas bougé.`
                : d === 1 ? "Te revoilà. Un jour, c'est long."
                : "Content de te retrouver.";
        addMsg('jarvis', `${r} Niveau ${l.n}, ${l.name}. ${p.xp} XP.`);
        emotion('happy', 3200);
      } else {
        addMsg('jarvis', `Je m'appelle ${p.name}. Je viens de naître — niveau 1. Chaque conversation me fait grandir, et je me souviendrai de toi.`);
      }
    }, 260);
  }
  if (!cfg.key) {
    setTimeout(() => {
      openSettings();
      addMsg('system', "Première fois ? Choisis un fournisseur, colle ta clé API, et on commence.");
    }, 500);
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
}

/* bulle système Android (uniquement dans l'app native) */
if (window.Native) {
  const bb = document.getElementById('btnBubble');
  if (bb) {
    bb.classList.remove('hidden');
    const sync = () => {
      const on = window.Native.bubbleActive && window.Native.bubbleActive() === 'on';
      bb.textContent = on ? 'Désactiver la bulle système' : 'Activer la bulle système';
    };
    bb.onclick = () => {
      const on = window.Native.bubbleActive && window.Native.bubbleActive() === 'on';
      if (on) { window.Native.stopBubble(); toast('Bulle système désactivée.'); }
      else { window.Native.askBubble(); toast('Autorise Jarvis à s\'afficher par-dessus les autres apps.'); }
      setTimeout(sync, 700);
    };
    sync();
  }
}

/* expose pour les autres modules (missions) */
window.Jarvis = { send, addMsg, toast, emotion, speak, isBusy: () => busy };
boot();
