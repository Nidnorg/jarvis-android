/* ============================================================
   jarvis missions.js — missions récurrentes + briefing du matin.
   Jarvis agit sans qu'on lui demande, mais toujours visiblement.
   ============================================================ */
'use strict';

const K_MISSIONS = 'jarvis.missions.v1';
const K_BRIEF = 'jarvis.briefday.v1';

let missions = [];
try { missions = JSON.parse(localStorage.getItem(K_MISSIONS)) || []; } catch { missions = []; }

function saveMissions() {
  try { localStorage.setItem(K_MISSIONS, JSON.stringify(missions)); } catch {}
}

const todayKey = () => new Date().toISOString().slice(0, 10);

/* ---------- calcul de la prochaine exécution ---------- */
function computeNext(m, from) {
  const base = new Date(from || Date.now());
  const d = new Date(base);
  d.setSeconds(0, 0);
  d.setHours(m.hour || 8, m.minute || 0, 0, 0);

  if (m.freq === 'once') {
    if (m.next && m.done) return m.next;
    return m.next || d.getTime();
  }
  if (m.freq === 'day') {
    if (d.getTime() <= base.getTime()) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  if (m.freq === 'week') {
    const target = m.weekday == null ? 1 : m.weekday; // 1 = lundi
    const diff = (target - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    if (d.getTime() <= base.getTime()) d.setDate(d.getDate() + 7);
    return d.getTime();
  }
  return d.getTime();
}

/* ---------- exécution ---------- */
function dueMissions(now) {
  const t = now || Date.now();
  return missions.filter((m) => m.on !== false && (m.next || 0) <= t);
}

function markRun(m, fromNow) {
  m.last = Date.now();
  if (m.freq === 'once') { m.done = true; m.on = false; }
  m.next = computeNext(m, (fromNow || Date.now()) + 1000);
  saveMissions();
}

let missionBusy = false;

function runDue() {
  if (missionBusy) return;
  const due = dueMissions();
  if (!due.length) return;
  // une seule mission par passage : on ne noie pas Rico
  const m = due[0];
  missionBusy = true;
  markRun(m);
  const J = window.Jarvis;
  if (!J) { missionBusy = false; return; }
  J.addMsg('system', '⏱ Mission : ' + m.text);
  J.emotion('thinking');
  try {
    J.send('MISSION AUTOMATIQUE — ' + m.text +
      '\n\nExécute cette mission maintenant et rends le résultat directement à Rico. ' +
      'Si elle demande une action irréversible, propose-la avec le bloc ACTION et attends sa validation.');
  } finally {
    setTimeout(() => { missionBusy = false; }, 4000);
  }
}

/* ---------- briefing du matin ---------- */
function morningBriefing() {
  const day = todayKey();
  let seen = null;
  try { seen = localStorage.getItem(K_BRIEF); } catch {}
  if (seen === day) return;
  try { localStorage.setItem(K_BRIEF, day); } catch {}

  const J = window.Jarvis;
  if (!J) return;
  const now = new Date();
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
                'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const h = now.getHours();
  const salut = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';

  const p = window.XP ? window.XP.state() : null;
  const lvl = p ? window.XP.levelOf(p.xp) : null;
  const actives = missions.filter((m) => m.on !== false && !m.done);
  const auj = actives.filter((m) => {
    const d = new Date(m.next || 0);
    return d.toISOString().slice(0, 10) === day;
  });

  let txt = `${salut} Rico. ${jours[now.getDay()]} ${now.getDate()} ${mois[now.getMonth()]}.`;
  if (lvl) txt += ` Niveau ${lvl.n}, ${lvl.name}.`;
  if (auj.length) {
    txt += `\n\nAujourd'hui : ${auj.map((m) => m.text.replace(/\n/g, ' ').slice(0, 70)).join(' · ')}.`;
  } else if (actives.length) {
    txt += `\n\nRien de prévu aujourd'hui. ${actives.length} mission(s) en veille.`;
  } else {
    txt += `\n\nAucune mission en place. Tu peux m'en confier une dans l'onglet Missions — par exemple « chaque matin, résume mes ventes GPA X ».`;
  }
  J.addMsg('jarvis', txt);
  J.emotion('happy', 3000);
}

/* ---------- UI ---------- */
function fmtNext(m) {
  if (m.on === false) return m.done ? 'terminée' : 'en pause';
  const d = new Date(m.next || 0);
  const day = todayKey();
  const dd = d.toISOString().slice(0, 10);
  const hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (dd === day) return "aujourd'hui " + hh;
  const tmr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dd === tmr) return 'demain ' + hh;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' + hh;
}

const FREQ_LABEL = { day: 'chaque jour', week: 'chaque semaine', once: 'une seule fois' };

function renderMissions() {
  const ul = document.getElementById('msList');
  if (!ul) return;
  if (!missions.length) {
    ul.innerHTML = '<li class="ms-empty">Aucune mission. Écris-en une ci-dessous.</li>';
    return;
  }
  ul.innerHTML = missions.map((m) => `
    <li class="ms-item${m.on === false ? ' off' : ''}">
      <div class="ms-main">
        <div class="ms-text">${escapeHtml(m.text)}</div>
        <div class="ms-meta">${FREQ_LABEL[m.freq] || ''} · ${fmtNext(m)}</div>
      </div>
      <button class="ms-toggle" data-id="${m.id}">${m.on === false ? '▶' : '⏸'}</button>
      <button class="ms-del" data-id="${m.id}">✕</button>
    </li>`).join('');

  ul.querySelectorAll('.ms-toggle').forEach((b) => {
    b.onclick = () => {
      const m = missions.find((x) => x.id === Number(b.dataset.id));
      if (!m) return;
      m.on = m.on === false;
      m.done = false;
      m.next = computeNext(m, Date.now());
      saveMissions(); renderMissions();
    };
  });
  ul.querySelectorAll('.ms-del').forEach((b) => {
    b.onclick = () => {
      missions = missions.filter((x) => x.id !== Number(b.dataset.id));
      saveMissions(); renderMissions();
    };
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function addMission(text, freq, hour, minute, weekday) {
  const m = {
    id: Date.now(),
    text: text.trim(),
    freq: freq || 'day',
    hour: hour == null ? 8 : hour,
    minute: minute == null ? 0 : minute,
    weekday: weekday == null ? 1 : weekday,
    on: true, done: false, last: null
  };
  m.next = computeNext(m, Date.now());
  missions.push(m);
  saveMissions(); renderMissions();
  return m;
}

function initMissions() {
  const open = document.getElementById('openMissions');
  const sheet = document.getElementById('missions');
  const close = document.getElementById('closeMissions');
  if (open && sheet) open.onclick = () => { sheet.classList.remove('hidden'); renderMissions(); };
  if (close && sheet) close.onclick = () => sheet.classList.add('hidden');

  // formulaire
  let freq = 'day';
  document.querySelectorAll('#msFreq .chip').forEach((b) => {
    b.onclick = () => {
      freq = b.dataset.f;
      document.querySelectorAll('#msFreq .chip').forEach((x) => x.classList.toggle('active', x === b));
    };
  });

  const form = document.getElementById('msForm');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const t = document.getElementById('msText').value.trim();
      if (!t) return;
      const hh = document.getElementById('msHour').value || '08:00';
      const [h, mi] = hh.split(':').map((x) => parseInt(x, 10) || 0);
      addMission(t, freq, h, mi);
      document.getElementById('msText').value = '';
      if (window.Jarvis) window.Jarvis.toast('Mission enregistrée. Elle tournera toute seule.');
    };
  }

  renderMissions();

  // briefing puis missions dues, une fois l'app prête
  setTimeout(() => {
    morningBriefing();
    setTimeout(runDue, 2500);
  }, 1200);
  setInterval(runDue, 45000);
}

window.Missions = { add: addMission, due: dueMissions, all: () => missions, computeNext, markRun, runDue, briefing: morningBriefing };

document.addEventListener('DOMContentLoaded', initMissions);
if (document.readyState !== 'loading') initMissions();
