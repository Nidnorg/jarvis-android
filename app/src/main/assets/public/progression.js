/* ============================================================
   jarvis progression.js — niveaux, XP, série de jours, compagnon.
   La boucle d'attachement : on revient parce que ça grandit.
   ============================================================ */
'use strict';

const K_PROG = 'jarvis.progress.v1';

/* ---------- niveaux ---------- */
const LEVELS = [
  { n: 1, name: 'Nouveau-né',     xp: 0 },
  { n: 2, name: 'Jeune',          xp: 120 },
  { n: 3, name: 'Compagnon',      xp: 320 },
  { n: 4, name: 'Assistant',      xp: 700 },
  { n: 5, name: 'Tacticien',      xp: 1300 },
  { n: 6, name: 'Stratège',       xp: 2200 },
  { n: 7, name: 'Sage',           xp: 3500 },
  { n: 8, name: 'Transcendant',   xp: 5200 }
];

const XP_GAIN = {
  conversation: 5,
  voix: 10,
  action: 15,
  mission: 25,
  connexion: 20
};

/* ---------- espèces ---------- */
const SPECIES = {
  robot:    { label: 'Robot',    min: 1, voice: 'synthétique claire', perso: 'logique, précis, un peu sarcastique' },
  korrigan: { label: 'Korrigan', min: 3, voice: 'douce, chantante',   perso: 'malicieux, espiègle, taquin' },
  alien:    { label: 'Alien',    min: 5, voice: 'robotique, pitch variable', perso: 'curieux, analytique, fasciné' },
  chat:     { label: 'Chat',     min: 7, voice: 'douce, nonchalante', perso: 'indépendant, affectueux quand il veut' }
};

const BODY_COLORS = ['#B87333', '#00E5FF', '#39FF14', '#FF1493', '#D4AF37', '#8A2BE2', '#FF6B35', '#20B2AA', '#C0C0C0', '#DC143C'];

/* ---------- avatars ---------- */
const AVATARS = {
  robot: `
  <circle class="halo" cx="60" cy="62" r="58" fill="url(#gHalo)"/>
  <g class="head">
    <rect x="20" y="32" width="80" height="62" rx="19" fill="url(#gBrass)" stroke="#f3e0a5" stroke-width="1.4"/>
    <rect x="28" y="42" width="64" height="38" rx="13" fill="url(#gScreen)" stroke="#00e5ff" stroke-opacity=".55"/>
    <g class="eyes">
      <circle class="eye" cx="45" cy="60" r="7" fill="#00e5ff"/><circle class="eye" cx="75" cy="60" r="7" fill="#00e5ff"/>
      <circle class="eye-core" cx="45" cy="60" r="2.6" fill="#eafcff"/><circle class="eye-core" cx="75" cy="60" r="2.6" fill="#eafcff"/>
    </g>
    <g class="mouths">
      <path class="mouth m-flat" d="M52 74 h16" stroke="#00e5ff" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path class="mouth m-happy" d="M50 72 q10 8 20 0" stroke="#00e5ff" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path class="mouth m-sad" d="M50 77 q10 -7 20 0" stroke="#00e5ff" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <ellipse class="mouth m-o" cx="60" cy="75" rx="4.5" ry="5.5" fill="#00e5ff"/>
    </g>
    <line x1="60" y1="32" x2="60" y2="19" stroke="#d4af37" stroke-width="3" stroke-linecap="round"/>
    <circle class="antenna" cx="60" cy="16" r="5" fill="#ff6b35"/>
    <circle class="bolt" cx="28" cy="30" r="3.4" fill="#39ff14"/>
    <circle class="bolt" cx="92" cy="30" r="3.4" fill="#39ff14"/>
    <rect x="34" y="86" width="52" height="7" rx="3.5" fill="#2a1b10" stroke="#d4af37" stroke-opacity=".7"/>
  </g>`,

  korrigan: `
  <circle class="halo" cx="60" cy="62" r="58" fill="url(#gHalo)"/>
  <g class="head">
    <path d="M60 10 L30 44 L90 44 Z" fill="#1f5b34" stroke="#39ff14" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="60" cy="62" r="30" fill="url(#gMoss)" stroke="#8fe36a" stroke-width="1.4"/>
    <ellipse cx="60" cy="88" rx="21" ry="12" fill="#e8e2d0" opacity=".92"/>
    <g class="eyes">
      <circle class="eye" cx="49" cy="56" r="6" fill="#0b2b12"/><circle class="eye" cx="71" cy="56" r="6" fill="#0b2b12"/>
      <circle class="eye-core" cx="47.4" cy="54" r="2.2" fill="#eaffe4"/><circle class="eye-core" cx="69.4" cy="54" r="2.2" fill="#eaffe4"/>
    </g>
    <g class="mouths">
      <path class="mouth m-flat" d="M54 70 h12" stroke="#0b2b12" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path class="mouth m-happy" d="M52 68 q8 7 16 0" stroke="#0b2b12" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path class="mouth m-sad" d="M52 72 q8 -6 16 0" stroke="#0b2b12" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <ellipse class="mouth m-o" cx="60" cy="71" rx="3.6" ry="4.4" fill="#0b2b12"/>
    </g>
    <circle class="antenna" cx="60" cy="9" r="3.4" fill="#39ff14"/>
  </g>`,

  alien: `
  <circle class="halo" cx="60" cy="62" r="58" fill="url(#gHalo)"/>
  <g class="head">
    <ellipse cx="60" cy="58" rx="42" ry="34" fill="url(#gVoid)" stroke="#b388ff" stroke-width="1.5"/>
    <g class="eyes">
      <ellipse class="eye" cx="44" cy="58" rx="12" ry="15" fill="#05030f" transform="rotate(-12 44 58)"/>
      <ellipse class="eye" cx="76" cy="58" rx="12" ry="15" fill="#05030f" transform="rotate(12 76 58)"/>
      <circle class="eye-core" cx="40" cy="52" r="3" fill="#e0d4ff"/><circle class="eye-core" cx="72" cy="52" r="3" fill="#e0d4ff"/>
    </g>
    <g class="mouths">
      <path class="mouth m-flat" d="M54 78 h12" stroke="#b388ff" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path class="mouth m-happy" d="M52 76 q8 7 16 0" stroke="#b388ff" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path class="mouth m-sad" d="M52 80 q8 -6 16 0" stroke="#b388ff" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <ellipse class="mouth m-o" cx="60" cy="79" rx="3.2" ry="4" fill="#b388ff"/>
    </g>
    <line x1="40" y1="26" x2="30" y2="12" stroke="#8f6bd6" stroke-width="2.4" stroke-linecap="round"/>
    <circle class="antenna" cx="29" cy="10" r="3.6" fill="#00e5ff"/>
    <line x1="80" y1="26" x2="90" y2="12" stroke="#8f6bd6" stroke-width="2.4" stroke-linecap="round"/>
    <circle class="antenna" cx="91" cy="10" r="3.6" fill="#00e5ff"/>
  </g>`,

  chat: `
  <circle class="halo" cx="60" cy="62" r="58" fill="url(#gHalo)"/>
  <g class="head">
    <path d="M32 44 L34 18 L56 34 Z" fill="url(#gFur)" stroke="#ffb347" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M88 44 L86 18 L64 34 Z" fill="url(#gFur)" stroke="#ffb347" stroke-width="1.3" stroke-linejoin="round"/>
    <ellipse cx="60" cy="62" rx="34" ry="30" fill="url(#gFur)" stroke="#ffb347" stroke-width="1.3"/>
    <g class="eyes">
      <ellipse class="eye" cx="48" cy="58" rx="7" ry="8.5" fill="#39ff14"/>
      <ellipse class="eye" cx="72" cy="58" rx="7" ry="8.5" fill="#39ff14"/>
      <ellipse class="eye-core" cx="48" cy="58" rx="1.8" ry="7" fill="#05030f"/>
      <ellipse class="eye-core" cx="72" cy="58" rx="1.8" ry="7" fill="#05030f"/>
    </g>
    <path d="M60 70 l-4 5 h8 Z" fill="#ff8fa3"/>
    <g class="mouths">
      <path class="mouth m-flat" d="M56 79 h8" stroke="#3a2412" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path class="mouth m-happy" d="M53 77 q7 7 14 0" stroke="#3a2412" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path class="mouth m-sad" d="M53 81 q7 -6 14 0" stroke="#3a2412" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <ellipse class="mouth m-o" cx="60" cy="80" rx="4" ry="4.6" fill="#3a2412"/>
    </g>
    <g stroke="#ffe0b2" stroke-width="1.2" opacity=".85">
      <line x1="26" y1="68" x2="46" y2="70"/><line x1="26" y1="76" x2="46" y2="74"/>
      <line x1="94" y1="68" x2="74" y2="70"/><line x1="94" y1="76" x2="74" y2="74"/>
    </g>
  </g>`
};

const DEFS = `
  <defs>
    <radialGradient id="gHalo"><stop offset="0" stop-color="#00e5ff" stop-opacity=".40"/><stop offset="1" stop-color="#00e5ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="gBrass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8cf8a"/><stop offset=".45" stop-color="#b87333"/><stop offset="1" stop-color="#7a4a24"/>
    </linearGradient>
    <linearGradient id="gScreen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d1b22"/><stop offset="1" stop-color="#060a0d"/>
    </linearGradient>
    <radialGradient id="gMoss"><stop offset="0" stop-color="#4f9d5d"/><stop offset="1" stop-color="#1f5b34"/></radialGradient>
    <radialGradient id="gVoid"><stop offset="0" stop-color="#3b2a6b"/><stop offset="1" stop-color="#140a2c"/></radialGradient>
    <linearGradient id="gFur" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffc078"/><stop offset=".5" stop-color="#e08a3c"/><stop offset="1" stop-color="#a85a1f"/>
    </linearGradient>
  </defs>`;

/* ---------- état ---------- */
const DAY = new Date().toISOString().slice(0, 10);

let prog = Object.assign({
  xp: 0,
  level: 1,
  streak: 0,
  lastDay: null,
  name: 'Jarvis',
  species: 'robot',
  color: null,
  msgCount: 0,
  lastAway: 0,
  createdAt: Date.now()
}, (() => { try { return JSON.parse(localStorage.getItem(K_PROG)) || {}; } catch { return {}; } })());

function saveProg() { try { localStorage.setItem(K_PROG, JSON.stringify(prog)); } catch {} }

function levelOf(xp) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.xp) cur = l;
  return cur;
}
function nextLevel() {
  return LEVELS.find((l) => l.xp > prog.xp) || null;
}
function progressRatio() {
  const cur = levelOf(prog.xp), nxt = nextLevel();
  if (!nxt) return 1;
  return Math.max(0, Math.min(1, (prog.xp - cur.xp) / (nxt.xp - cur.xp)));
}
function canUse(kind, key) {
  if (kind === 'species') return prog.level >= SPECIES[key].min;
  if (kind === 'color') return prog.level >= 4;
  return true;
}

/* ---------- rendu de l'avatar ---------- */
function applySpecies(species) {
  const bubble = document.getElementById('bubble');
  if (!bubble) return;
  const svg = bubble.querySelector('svg');
  if (!svg) return;
  const body = AVATARS[species] || AVATARS.robot;
  svg.innerHTML = DEFS + body;
  bubble.dataset.species = species;
  if (prog.color) {
    svg.querySelectorAll('.head').forEach((h) => { h.style.filter = `drop-shadow(0 0 6px ${prog.color})`; });
  }
  bubble.classList.toggle('transcendant', prog.level >= 8);
}

/* ---------- XP ---------- */
function addXp(kindOrAmount, reason) {
  const amount = typeof kindOrAmount === 'number' ? kindOrAmount : (XP_GAIN[kindOrAmount] || 0);
  if (!amount) return;
  const before = prog.level;
  prog.xp += amount;
  if (kindOrAmount === 'conversation' || kindOrAmount === 'voix') prog.msgCount = (prog.msgCount || 0) + 1;
  prog.level = levelOf(prog.xp).n;
  saveProg();
  renderChip();
  if (typeof renderSheet === 'function') renderSheet();
  if (prog.level > before) levelUp(prog.level);
  const meta = document.getElementById('xpBump');
  if (meta) {
    meta.textContent = '+' + amount;
    meta.classList.add('on');
    clearTimeout(addXp._t);
    addXp._t = setTimeout(() => meta.classList.remove('on'), 900);
  }
}

function levelUp(n) {
  const l = LEVELS.find((x) => x.n === n);
  const flash = document.getElementById('lvlFlash');
  if (flash) {
    flash.innerHTML = `<div class="lvl-flash-inner"><span>NIVEAU ${n}</span><strong>${l.name}</strong>
      ${newlyUnlocked(n) ? `<em>${newlyUnlocked(n)}</em>` : ''}</div>`;
    flash.classList.add('on');
    setTimeout(() => flash.classList.remove('on'), 2600);
  }
  if (typeof emotion === 'function') emotion('happy', 3000);
  if (typeof buzz === 'function') buzz([18, 40, 18]);
  if (typeof cfg !== 'undefined' && cfg.voice && typeof speak === 'function') {
    speak(`Niveau ${n}. Je suis maintenant ${l.name}.`);
  }
  renderChip();
}

function newlyUnlocked(n) {
  if (n === 3) return 'Nouveau compagnon débloqué : Korrigan';
  if (n === 4) return 'Couleurs du corps débloquées';
  if (n === 5) return 'Nouveau compagnon débloqué : Alien';
  if (n === 7) return 'Nouveau compagnon débloqué : Chat';
  if (n === 8) return 'Aura transcendante';
  return '';
}

/* ---------- série de jours ---------- */
function checkStreak() {
  if (prog.lastDay === DAY) { prog.lastAway = 0; return 0; }
  const prev = prog.lastDay;
  prog.lastAway = prev
    ? Math.max(1, Math.round((new Date(DAY) - new Date(prev)) / 86400000))
    : 0;
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  prog.streak = prog.lastDay === y ? prog.streak + 1 : 1;
  prog.lastDay = DAY;
  saveProg();
  addXp('connexion', 'connexion');
  return prog.streak;
}

/* ---------- UI ---------- */
function renderChip() {
  const chip = document.getElementById('btnLevel');
  if (!chip) return;
  const l = levelOf(prog.xp);
  chip.innerHTML = `<span class="lvl-n">${l.n}</span><span class="lvl-t">${l.name}</span>`;
  chip.title = `${prog.xp} XP · série ${prog.streak} j`;
}

function renderSheet() {
  const sheet = document.getElementById('compagnon');
  if (!sheet || sheet.classList.contains('hidden')) return;
  const l = levelOf(prog.xp), nxt = nextLevel();
  sheet.querySelector('#cgName').textContent = prog.name;
  sheet.querySelector('#cgLevel').textContent = `Niveau ${l.n} · ${l.name}`;
  sheet.querySelector('#cgXpText').textContent = nxt
    ? `${prog.xp} XP · encore ${nxt.xp - prog.xp} avant ${nxt.name}`
    : `${prog.xp} XP · niveau maximum atteint`;
  sheet.querySelector('#cgXpBar').style.width = (progressRatio() * 100).toFixed(1) + '%';
  sheet.querySelector('#cgStreak').textContent = prog.streak > 1
    ? `🔥 ${prog.streak} jours d'affilée` : '🔥 premier jour';

  sheet.querySelectorAll('.sp').forEach((el) => {
    const k = el.dataset.sp;
    const ok = canUse('species', k);
    el.classList.toggle('locked', !ok);
    el.classList.toggle('active', prog.species === k);
    el.querySelector('.lock').textContent = ok ? '' : `niv. ${SPECIES[k].min}`;
  });
  sheet.querySelectorAll('.sw').forEach((el) => {
    const ok = canUse('color', 'x');
    el.classList.toggle('locked', !ok);
    el.classList.toggle('active', (prog.color || '') === el.dataset.c);
    el.disabled = !ok;
  });

  const ul = sheet.querySelector('#cgUnlocks');
  ul.innerHTML = LEVELS.map((x) => {
    const got = prog.xp >= x.xp;
    const what = { 2: 'émotion joie + voix', 3: 'korrigan', 4: 'couleurs', 5: 'alien', 7: 'chat', 8: 'aura' }[x.n] || '';
    return `<li class="${got ? 'got' : ''}"><b>${x.n}</b> ${x.name}${what ? ' · ' + what : ''}${got ? ' ✓' : ''}</li>`;
  }).join('');
}

function openCompagnon() {
  document.getElementById('compagnon').classList.remove('hidden');
  renderSheet();
}
function closeCompagnon() {
  document.getElementById('compagnon').classList.add('hidden');
}

/* ---------- init ---------- */
function initProgression() {
  prog.level = levelOf(prog.xp).n;
  applySpecies(prog.species);
  renderChip();
  checkStreak();
  renderChip();

  const chip = document.getElementById('btnLevel');
  if (chip) chip.onclick = openCompagnon;
  const close = document.getElementById('closeCompagnon');
  if (close) close.onclick = closeCompagnon;

  document.querySelectorAll('#compagnon .sp').forEach((el) => {
    el.onclick = () => {
      const k = el.dataset.sp;
      if (!canUse('species', k)) {
        if (typeof toast === 'function') toast(`${SPECIES[k].label} se débloque au niveau ${SPECIES[k].min}. Continue.`);
        return;
      }
      prog.species = k;
      if (typeof cfg !== 'undefined') { cfg.compagnon = k; try { localStorage.setItem('jarvis.cfg.v1', JSON.stringify(cfg)); } catch {} }
      saveProg();
      applySpecies(k);
      renderSheet();
      if (typeof toast === 'function') toast(`${SPECIES[k].label} est là.`);
    };
  });

  document.querySelectorAll('#compagnon .sw').forEach((el) => {
    el.onclick = () => {
      if (!canUse('color', 'x')) { if (typeof toast === 'function') toast('Les couleurs se débloquent au niveau 4.'); return; }
      prog.color = el.dataset.c;
      saveProg(); applySpecies(prog.species); renderSheet();
    };
  });

  const nameInput = document.getElementById('cgNameInput');
  if (nameInput) {
    nameInput.value = prog.name;
    nameInput.onchange = () => {
      prog.name = (nameInput.value || 'Jarvis').trim().slice(0, 18) || 'Jarvis';
      saveProg(); renderSheet();
    };
  }
}

window.XP = { add: addXp, state: () => prog, levelOf, LEVELS, SPECIES, applySpecies, canUse, checkStreak };

document.addEventListener('DOMContentLoaded', initProgression);
if (document.readyState !== 'loading') initProgression();
