'use strict';

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const DAY = 86400000;
const KG_LB = 2.20462;
const round1 = v => Math.round(v * 10) / 10;
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : null; };
const fmtNum = (v, d = 1) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });

/* ---------- estado ---------- */
const STORE_KEY = 'forja.v1';
function defaultState() {
  return {
    settings: { unit: 'kg', rest: 90, bar: 20, sound: true, keepAwake: true },
    customExercises: [], routines: [], workouts: [], body: [], active: null
  };
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      const s = Object.assign(defaultState(), d);
      s.settings = Object.assign(defaultState().settings, d.settings || {});
      return s;
    }
  } catch (e) { /* armazenamento indisponível */ }
  return defaultState();
}
let S = load();
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 200); }
let saveWarned = false;
function flush() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); saveWarned = false; }
  catch (e) {
    if (!saveWarned && typeof toast === 'function') { saveWarned = true; toast('Não foi possível salvar. Verifique o espaço do aparelho e faça um backup.'); }
  }
}
// Guarda uma cópia antes de importar ou apagar tudo, para poder desfazer.
function snapshotPrev() { try { localStorage.setItem(STORE_KEY + '.prev', JSON.stringify(S)); } catch (e) { /* ignorado */ } }
function hasPrev() { try { return !!localStorage.getItem(STORE_KEY + '.prev'); } catch (e) { return false; } }
function applyState(d) {
  S = Object.assign(defaultState(), d);
  S.settings = Object.assign(defaultState().settings, d.settings || {});
  invalidateEx(); recomputeAllPRs(); save();
}
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

const ui = {
  tab: 'home', workoutOpen: false, modals: [], draft: null,
  exQ: '', exMuscle: '', exView: 'todos', pick: null, chartMetric: 'duracao', calOffset: 0
};

/* ---------- exercícios ---------- */
function allExercises() { return window.EXERCISES.concat(S.customExercises); }
const EXMAP = () => { const m = {}; for (const e of allExercises()) m[e.id] = e; return m; };
let exCache = null;
function EX(id) {
  if (!exCache) exCache = EXMAP();
  return exCache[id] || { id, name: 'Exercício removido', muscle: 'Outro', equipment: '', kind: 'weight' };
}
function invalidateEx() { exCache = null; }

/* ---------- unidades ---------- */
const unit = () => S.settings.unit;
const toDisp = kg => unit() === 'lb' ? kg * KG_LB : kg;
const fromDisp = v => unit() === 'lb' ? v / KG_LB : v;
const fmtW = kg => fmtNum(round1(toDisp(kg)));
const inW = kg => (kg === null || kg === undefined || kg === '') ? '' : String(round1(toDisp(kg)));
function fmtVol(kg) {
  const v = toDisp(kg);
  return v >= 10000 ? fmtNum(v / 1000, 1) + ' t' : fmtNum(Math.round(v), 0) + ' ' + unit();
}

/* ---------- datas ---------- */
function fmtDur(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}min` : `${m}min`;
}
function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0');
}
function fmtRest(sec) {
  if (!sec) return 'Desligado';
  const m = Math.floor(sec / 60), s = sec % 60;
  return (m ? m + 'min' : '') + (s ? (m ? ' ' : '') + s + 's' : '');
}
function fmtDate(t, opts = { weekday: 'long', day: 'numeric', month: 'short' }) {
  const s = new Date(t).toLocaleDateString('pt-BR', opts);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
function startOfWeek(t) {
  const d = new Date(startOfDay(t));
  const wd = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - wd);
  return d.getTime();
}

/* ---------- métricas ---------- */
const working = s => s.type !== 'W';
const e1rm = (w, r) => (!w || !r) ? 0 : (r === 1 ? w : w * (1 + r / 30));
function wVolume(w) {
  let v = 0;
  for (const e of w.exercises) for (const s of e.sets) if (s.done && working(s)) v += (s.w || 0) * (s.r || 0);
  return v;
}
function wSetCount(w) {
  let n = 0;
  for (const e of w.exercises) for (const s of e.sets) if (s.done && working(s)) n++;
  return n;
}
function wPrCount(w) {
  let n = 0;
  for (const e of w.exercises) for (const s of e.sets) if (s.pr && s.pr.length) n++;
  return n;
}
function sortedWorkouts() { return S.workouts.slice().sort((a, b) => b.start - a.start); }

// Índice exercício -> treinos (mais recente primeiro). Refeito a cada render; evita varrer tudo a cada série.
let histCache = null;
function exHistory(exId) {
  if (!histCache) {
    histCache = {};
    for (const w of sortedWorkouts()) {
      const per = {};
      for (const e of w.exercises) {
        const done = e.sets.filter(s => s.done);
        if (done.length) (per[e.exId] = per[e.exId] || []).push(...done);
      }
      for (const id in per) (histCache[id] = histCache[id] || []).push({ w, sets: per[id] });
    }
  }
  return histCache[exId] || [];
}
// Refaz as marcações de recorde de todo o histórico, em ordem de data (após editar, apagar ou importar).
function recomputeAllPRs() {
  const rec = {};
  for (const w of S.workouts.slice().sort((a, b) => a.start - b.start)) {
    const had = {};
    for (const e of w.exercises) if (!(e.exId in had)) had[e.exId] = !!rec[e.exId];
    for (const e of w.exercises) {
      const r = rec[e.exId] = rec[e.exId] || { maxW: 0, best1rm: 0, bestVol: 0, maxReps: 0 };
      const isReps = EX(e.exId).kind === 'reps';
      for (const s of e.sets) {
        s.pr = [];
        if (!s.done || !working(s) || !s.r) continue;
        const wt = s.w || 0, one = e1rm(wt, s.r), vol = wt * s.r;
        if (had[e.exId]) {
          if (wt > r.maxW && wt > 0) s.pr.push('Maior peso');
          if (one > r.best1rm && wt > 0) s.pr.push('Melhor 1RM estimado');
          if (vol > r.bestVol && wt > 0) s.pr.push('Maior volume na série');
          if (isReps && !wt && s.r > r.maxReps) s.pr.push('Mais repetições');
        }
        r.maxW = Math.max(r.maxW, wt); r.best1rm = Math.max(r.best1rm, one);
        r.bestVol = Math.max(r.bestVol, vol); r.maxReps = Math.max(r.maxReps, s.r);
      }
    }
  }
  histCache = null;
}
function recordsFrom(sets) {
  const r = { maxW: 0, best1rm: 0, bestVol: 0, maxReps: 0 };
  for (const s of sets) {
    if (!s.done || !working(s)) continue;
    const w = s.w || 0, reps = s.r || 0;
    if (w > r.maxW) r.maxW = w;
    if (e1rm(w, reps) > r.best1rm) r.best1rm = e1rm(w, reps);
    if (w * reps > r.bestVol) r.bestVol = w * reps;
    if (reps > r.maxReps) r.maxReps = reps;
  }
  return r;
}
function exRecords(exId) {
  const sets = [];
  for (const h of exHistory(exId)) sets.push(...h.sets);
  return { ...recordsFrom(sets), sessions: exHistory(exId).length };
}
function lastSetsFor(exId) {
  const h = exHistory(exId)[0];
  return h ? h.sets : [];
}
// Série "anterior" equivalente: aquecimento com aquecimento, série de trabalho com série de trabalho.
function prevFor(sets, si, prevSets) {
  const isW = sets[si].type === 'W';
  const k = sets.slice(0, si).filter(s => (s.type === 'W') === isW).length;
  return prevSets.filter(s => (s.type === 'W') === isW)[k];
}

/* ---------- renderização ---------- */
const ICON = {
  home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  train: '<path d="M2 12h2m16 0h2M6 7v10M18 7v10M4 9v6m16-6v6M6 12h12"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>'
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

function render() {
  exCache = null; histCache = null;
  const inWorkout = !!(S.active && ui.workoutOpen);
  document.body.classList.toggle('in-workout', inWorkout);
  const view = $('#view');
  view.innerHTML = inWorkout ? viewWorkout() : VIEWS[ui.tab]();
  renderTabs();
  renderActiveBar();
  renderRestBar();
  renderModals();
  document.querySelectorAll('textarea.note').forEach(autoGrow);
  syncWakeLock();
}

function renderTabs() {
  const tabs = [['home', 'Início', 'home'], ['train', 'Treinar', 'train'], ['exercises', 'Exercícios', 'list'], ['profile', 'Perfil', 'user']];
  $('#tabs').innerHTML = tabs.map(([id, label, ic]) =>
    `<button class="tab ${ui.tab === id ? 'on' : ''}" data-a="tab" data-id="${id}" aria-label="${label}">${icon(ic)}<span>${label}</span></button>`).join('');
}

function renderActiveBar() {
  const bar = $('#activebar');
  const show = S.active && !ui.workoutOpen;
  bar.hidden = !show;
  if (!show) return;
  bar.innerHTML = `<button class="activebar-btn" data-a="openWorkout">
    <span class="pulse"></span>
    <span class="grow"><b>${esc(S.active.name)}</b><small data-elapsed>${fmtClock(Date.now() - S.active.start)}</small></span>
    <span class="pill">Continuar</span></button>`;
}

/* ---------- Início ---------- */
function weekStats() {
  const w0 = startOfWeek(Date.now());
  const ws = S.workouts.filter(w => w.start >= w0);
  return { count: ws.length, vol: ws.reduce((a, w) => a + wVolume(w), 0), dur: ws.reduce((a, w) => a + (w.end - w.start), 0) };
}
function streakWeeks() {
  const weeks = new Set(S.workouts.map(w => startOfWeek(w.start)));
  let wk = startOfWeek(Date.now());
  if (!weeks.has(wk)) wk = startOfWeek(wk - DAY);
  let n = 0;
  while (weeks.has(wk)) { n++; wk = startOfWeek(wk - DAY); }
  return n;
}

function workoutCard(w) {
  const lines = w.exercises.slice(0, 4).map(e =>
    `<li><span class="muted">${e.sets.filter(s => s.done).length} ×</span> ${esc(EX(e.exId).name)}</li>`).join('');
  const more = w.exercises.length > 4 ? `<li class="muted">e mais ${w.exercises.length - 4} exercício(s)</li>` : '';
  const prs = wPrCount(w);
  return `<button class="card wcard" data-a="workoutDetail" data-id="${w.id}">
    <div class="wcard-head"><b>${esc(w.name)}</b><small class="muted">${fmtDate(w.start)}</small></div>
    <div class="stats3">
      <div><small>Duração</small><b>${fmtDur(w.end - w.start)}</b></div>
      <div><small>Volume</small><b>${fmtVol(wVolume(w))}</b></div>
      <div><small>Recordes</small><b>${prs ? '🏆 ' + prs : '—'}</b></div>
    </div>
    <ul class="exlist">${lines}${more}</ul>
  </button>`;
}

function viewHome() {
  const ws = sortedWorkouts();
  const st = weekStats();
  const streak = streakWeeks();
  const head = `<header class="head"><div class="brand"><span class="logo">${icon('train')}</span><div><h1>Forja</h1><small>${greeting()}</small></div></div>${S.active ? '' : `<button class="btn primary small" data-a="tab" data-id="train">${icon('plus')} Treinar</button>`}</header>`;
  if (!ws.length) {
    return head + `<section class="empty card">
      <div class="empty-ic">${icon('train')}</div>
      <h2>Nenhum treino ainda</h2>
      <p class="muted">Comece um treino vazio ou escolha uma rotina. Seus treinos aparecem aqui.</p>
      <button class="btn primary" data-a="startEmpty">Começar treino</button>
      <button class="btn ghost" data-a="seedDemo">Carregar dados de exemplo</button>
    </section>`;
  }
  return head + backupReminder() + weekStrip() + `
    <section class="grid3">
      <div class="card stat"><small>Treinos na semana</small><b>${st.count}</b></div>
      <div class="card stat"><small>Sequência</small><b>${streak} sem.</b></div>
      <div class="card stat"><small>Volume na semana</small><b>${fmtVol(st.vol)}</b></div>
    </section>
    <h2 class="sec">Histórico</h2>
    <section class="stack">${ws.map(workoutCard).join('')}</section>`;
}

function greeting() {
  const h = new Date().getHours();
  const hi = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const n = streakWeeks();
  return n > 1 ? `${hi}! ${n} semanas seguidas 🔥` : `${hi}! Pronto para treinar?`;
}
function weekStrip() {
  const w0 = startOfWeek(Date.now()), today = startOfDay(Date.now());
  const trained = new Set(S.workouts.map(w => startOfDay(w.start)));
  const names = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(w0); d.setDate(d.getDate() + i);
    const t = d.getTime(), on = trained.has(t);
    html += `<div class="wd ${on ? 'on' : ''} ${t === today ? 'today' : ''}">${names[i]}<i>${on ? icon('check') : d.getDate()}</i></div>`;
  }
  return `<section class="card week" aria-label="Dias treinados nesta semana">${html}</section>`;
}
function backupReminder() {
  const now = Date.now();
  if (S.workouts.length < 5 || now - (S.lastBackup || 0) < 14 * DAY || now < (S.backupSnooze || 0)) return '';
  return `<section class="card remind"><b>Hora de fazer um backup</b>
    <p class="muted">${S.lastBackup ? 'Seu último backup tem mais de 2 semanas.' : 'Você ainda não fez nenhum backup dos seus treinos.'} Guarde o arquivo no Drive ou no e-mail.</p>
    <div class="row gap"><button class="btn primary grow" data-a="exportData">Fazer backup</button><button class="btn" data-a="backupLater">Depois</button></div></section>`;
}

/* ---------- Treinar ---------- */
function routineCard(r) {
  const names = r.exercises.map(e => EX(e.exId).name).join(', ');
  return `<div class="card rcard">
    <div class="rcard-head">
      <b>${esc(r.name)}</b>
      <button class="icon-btn" data-a="routineMenu" data-id="${r.id}" aria-label="Opções da rotina">${icon('dots')}</button>
    </div>
    <p class="muted clamp2">${esc(names) || 'Sem exercícios'}</p>
    <button class="btn primary block" data-a="startRoutine" data-id="${r.id}">Começar rotina</button>
  </div>`;
}
function viewTrain() {
  const groups = {};
  for (const [i, t] of window.TEMPLATES.entries()) (groups[t.group] = groups[t.group] || []).push([i, t]);
  return `<header class="head"><h1>Treinar</h1></header>
    <button class="btn primary block big" data-a="startEmpty">${icon('plus')} Começar treino vazio</button>
    <div class="sec-row"><h2 class="sec">Minhas rotinas</h2>
      <button class="btn small" data-a="newRoutine">${icon('plus')} Nova rotina</button></div>
    <section class="stack">${S.routines.length ? S.routines.map(routineCard).join('')
      : '<p class="muted card">Nenhuma rotina ainda. Crie uma ou adicione um modelo abaixo.</p>'}</section>
    <h2 class="sec">Modelos de rotina</h2>
    ${Object.entries(groups).map(([g, list]) => `<div class="card tgroup"><b>${esc(g)}</b>
      ${list.map(([i, t]) => `<div class="trow"><div class="grow"><span>${esc(t.name)}</span>
        <small class="muted clamp1">${t.ex.map(x => EX(x[0]).name).join(', ')}</small></div>
        <button class="btn small" data-a="addTemplate" data-i="${i}">Adicionar</button></div>`).join('')}
    </div>`).join('')}`;
}

/* ---------- Exercícios ---------- */
function hasImg(ex) { return !ex.custom && window.EX_IMG.has(ex.id); }
function avatar(ex) {
  const c = window.MUSCLE_COLORS[ex.muscle] || '#64748b';
  if (hasImg(ex)) return `<span class="avatar photo" style="--c:${c}"><img src="img/ex/${ex.id}-0.jpg" alt="" loading="lazy" decoding="async" draggable="false"></span>`;
  const ini = ex.name.replace(/\(.*?\)/g, ' ').replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase() || (ex.name.match(/[\p{L}\d]/u) || ['?'])[0].toUpperCase();
  return `<span class="avatar" style="--c:${c}">${esc(ini)}</span>`;
}
function filterExercises(q, muscle) {
  const nq = norm(q);
  return allExercises()
    .filter(e => (!muscle || e.muscle === muscle) && (!nq || norm(e.name).includes(nq) || norm(e.muscle).includes(nq) || norm(e.equipment).includes(nq)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function muscleChips(sel, action) {
  return `<div class="chips">${['', ...window.MUSCLES].map(m =>
    `<button class="chip ${sel === m ? 'on' : ''}" data-a="${action}" data-m="${esc(m)}">${m || 'Todos'}</button>`).join('')}</div>`;
}
function exRows(list, createAction = 'newExercise') {
  if (!list.length) return `<div class="pad center"><p class="muted">Nenhum exercício encontrado.</p>
    <button class="btn primary" data-a="${createAction}">${icon('plus')} Criar exercício</button></div>`;
  return list.map(e => `<div class="exrow-wrap"><button class="exrow" data-a="exDetail" data-id="${e.id}">${avatar(e)}
    <span class="grow"><b>${esc(e.name)}</b><small class="muted">${esc(e.muscle)} · ${esc(e.equipment)}${e.custom ? ' · <span class="tag">meu</span>' : ''}</small></span></button>
    ${e.custom && ui.exView === 'meus' ? `<button class="icon-btn" data-a="editExercise" data-id="${e.id}" aria-label="Editar">${icon('edit')}</button>` : ''}</div>`).join('');
}
function exListHtml() {
  if (ui.exView === 'meus') {
    if (!S.customExercises.length) return `<div class="empty"><div class="empty-ic">${icon('edit')}</div>
      <h2>Nenhum exercício seu ainda</h2>
      <p class="muted">Não achou o exercício que você faz? Crie aqui com o nome, o músculo e o equipamento. Ele passa a aparecer nos treinos e rotinas como os outros.</p></div>`;
    return exRows(filterExercises(ui.exQ, ui.exMuscle).filter(e => e.custom));
  }
  return exRows(filterExercises(ui.exQ, ui.exMuscle));
}
function viewExercises() {
  const mine = S.customExercises.length;
  return `<header class="head"><h1>Exercícios</h1></header>
    <div class="seg tabs2">
      <button class="${ui.exView !== 'meus' ? 'on' : ''}" data-a="exView" data-v="todos">Todos (${allExercises().length})</button>
      <button class="${ui.exView === 'meus' ? 'on' : ''}" data-a="exView" data-v="meus">Meus exercícios (${mine})</button>
    </div>
    ${ui.exView === 'meus' ? `<button class="btn primary block big" data-a="newExercise">${icon('plus')} Criar exercício</button>` : ''}
    ${ui.exView === 'meus' && !mine ? '' : `<label class="search">${icon('search')}<input type="search" placeholder="Buscar exercício" value="${esc(ui.exQ)}" data-f="exq" autocomplete="off"></label>
    ${muscleChips(ui.exMuscle, 'exMuscle')}`}
    <section class="card list" id="exlist">${exListHtml()}</section>
    ${ui.exView !== 'meus' ? `<p class="muted center small">Não achou? <button class="linkbtn" data-a="newExercise">Crie seu próprio exercício</button></p>` : ''}`;
}

function openExerciseEditor({ ex, name = '', onSaved } = {}) {
  ui.newEx = ex
    ? { id: ex.id, name: ex.name, muscle: ex.muscle, equipment: ex.equipment, kind: ex.kind }
    : { id: null, name, muscle: window.MUSCLES[0], equipment: window.EQUIPMENT[0], kind: 'weight', onSaved };
  openModal(() => {
    const n = ui.newEx;
    return sheetHead(n.id ? 'Editar exercício' : 'Criar exercício', '<button class="btn primary small" data-a="saveExercise">Salvar</button>') + `<div class="pad stack">
      <label class="field"><span>Nome</span><input class="input" placeholder="Ex.: Remada cavalinho" value="${esc(n.name)}" data-f="nxname" maxlength="60" autocomplete="off"></label>
      <label class="field"><span>Grupo muscular principal</span><select class="input" data-f="nxmuscle">${window.MUSCLES.map(m => `<option ${m === n.muscle ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <label class="field"><span>Equipamento</span><select class="input" data-f="nxequip">${window.EQUIPMENT.map(m => `<option ${m === n.equipment ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <label class="field"><span>Como registrar</span><select class="input" data-f="nxkind">
        <option value="weight" ${n.kind === 'weight' ? 'selected' : ''}>Peso e repetições (ex.: supino)</option>
        <option value="reps" ${n.kind === 'reps' ? 'selected' : ''}>Peso corporal, só repetições (ex.: flexão)</option></select></label>
      ${n.id ? `<p class="muted small">As mudanças valem também para os treinos que você já fez com ele.</p>
        <button class="btn danger-ghost block" data-a="delExercise" data-id="${n.id}">Apagar exercício</button>` : ''}
    </div>`;
  });
}

/* ---------- Perfil ---------- */
function viewProfile() {
  const ws = S.workouts;
  const totalVol = ws.reduce((a, w) => a + wVolume(w), 0);
  const totalDur = ws.reduce((a, w) => a + (w.end - w.start), 0);
  return `<header class="head"><h1>Perfil</h1>
      <button class="icon-btn" data-a="settings" aria-label="Configurações">${icon('gear')}</button></header>
    <section class="grid3">
      <div class="card stat"><small>Treinos</small><b>${ws.length}</b></div>
      <div class="card stat"><small>Volume total</small><b>${fmtVol(totalVol)}</b></div>
      <div class="card stat"><small>Tempo total</small><b>${fmtDur(totalDur)}</b></div>
    </section>
    ${weeklyChart()}
    ${calendar()}
    ${muscleSets()}
    ${bodySection()}`;
}

function weeklyChart() {
  const metrics = { duracao: 'Duração', volume: 'Volume', series: 'Séries', treinos: 'Treinos' };
  const w0 = startOfWeek(Date.now());
  const weeks = [];
  for (let i = 11; i >= 0; i--) weeks.push(startOfWeek(w0 - i * 7 * DAY + DAY));
  const vals = weeks.map(wk => {
    const ws = S.workouts.filter(w => startOfWeek(w.start) === wk);
    switch (ui.chartMetric) {
      case 'volume': return Math.round(toDisp(ws.reduce((a, w) => a + wVolume(w), 0)));
      case 'series': return ws.reduce((a, w) => a + wSetCount(w), 0);
      case 'treinos': return ws.length;
      default: return Math.round(ws.reduce((a, w) => a + (w.end - w.start), 0) / 60000);
    }
  });
  const fmt = ui.chartMetric === 'duracao' ? v => fmtDur(v * 60000) : ui.chartMetric === 'volume' ? v => fmtNum(v, 0) + ' ' + unit() : v => String(v);
  const cur = vals[vals.length - 1];
  return `<section class="card">
    <div class="card-title"><b>Últimas 12 semanas</b><span class="muted">Esta semana: <b class="fg">${fmt(cur)}</b></span></div>
    ${barChart(weeks.map((wk, i) => ({ label: new Date(wk).toLocaleDateString('pt-BR', { day: 'numeric', month: 'numeric' }), value: vals[i] })), fmt)}
    <div class="seg">${Object.entries(metrics).map(([k, l]) => `<button class="${ui.chartMetric === k ? 'on' : ''}" data-a="chartMetric" data-k="${k}">${l}</button>`).join('')}</div>
  </section>`;
}

function barChart(items, fmt) {
  const W = 320, H = 150, pad = 18, bw = (W - 8) / items.length;
  const max = Math.max(1, ...items.map(i => i.value));
  const bars = items.map((it, i) => {
    const h = (it.value / max) * (H - pad - 22);
    const x = 4 + i * bw + bw * 0.18, y = H - pad - h;
    const last = i === items.length - 1;
    return `<g><title>${esc(it.label)}: ${esc(fmt(it.value))}</title>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(h, it.value ? 2 : 0).toFixed(1)}" rx="4" class="${last ? 'bar on' : 'bar'}"/>
      ${i % 2 === 1 || items.length <= 6 ? `<text x="${(x + bw * 0.32).toFixed(1)}" y="${H - 4}" class="axis" text-anchor="middle">${esc(it.label)}</text>` : ''}</g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras">
    <line x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}" class="grid"/>
    <text x="2" y="12" class="axis">${esc(fmt(max))}</text>${bars}</svg>`;
}

function lineChart(points, fmt) {
  if (points.length < 2) return '<p class="muted pad">Treine mais vezes para ver o gráfico.</p>';
  const W = 320, H = 160, px = 8, top = 18, bottom = 34;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const sx = x => px + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - 2 * px);
  const sy = y => top + (1 - (y - y0) / (y1 - y0)) * (H - top - bottom);
  const d = points.map((p, i) => (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' ');
  const area = `${d} L${sx(x1).toFixed(1)} ${H - bottom} L${sx(x0).toFixed(1)} ${H - bottom} Z`;
  const dots = points.map((p, i) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${i === points.length - 1 ? 4.5 : 3}" class="dot${i === points.length - 1 ? ' last' : ''}"><title>${fmtDate(p.x, { day: 'numeric', month: 'short' })}: ${esc(fmt(p.y))}</title></circle>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de linha">
    <text x="2" y="12" class="axis">${esc(fmt(y1))}</text>
    <text x="2" y="${H - bottom + 13}" class="axis">${esc(fmt(y0))}</text>
    <path d="${area}" class="area"/><path d="${d}" class="line"/>${dots}
    <text x="${px}" y="${H - 3}" class="axis">${fmtDate(x0, { day: 'numeric', month: 'short' })}</text>
    <text x="${W - px}" y="${H - 3}" class="axis" text-anchor="end">${fmtDate(x1, { day: 'numeric', month: 'short' })}</text></svg>`;
}

function calendar() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + ui.calOffset, 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const trained = new Set(S.workouts.map(w => startOfDay(w.start)));
  const today = startOfDay(Date.now());
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span></span>';
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const t = new Date(first.getFullYear(), first.getMonth(), d).getTime();
    const on = trained.has(t); if (on) count++;
    cells += `<span class="day ${on ? 'on' : ''} ${t === today ? 'today' : ''}">${d}</span>`;
  }
  const m = first.toLocaleDateString('pt-BR', { month: 'long' });
  const title = m[0].toUpperCase() + m.slice(1) + ' ' + first.getFullYear();
  return `<section class="card">
    <div class="card-title"><button class="icon-btn" data-a="cal" data-d="-1" aria-label="Mês anterior">${icon('left')}</button>
      <b>${title}</b><span class="muted">${count} dia(s)</span>
      <button class="icon-btn" data-a="cal" data-d="1" aria-label="Próximo mês" ${ui.calOffset >= 0 ? 'disabled' : ''}>${icon('right')}</button></div>
    <div class="cal"><small>S</small><small>T</small><small>Q</small><small>Q</small><small>S</small><small>S</small><small>D</small>${cells}</div>
  </section>`;
}

function muscleSets() {
  const since = Date.now() - 7 * DAY;
  const counts = {};
  for (const w of S.workouts) if (w.start >= since)
    for (const e of w.exercises) for (const s of e.sets) if (s.done && working(s)) {
      const m = EX(e.exId).muscle; counts[m] = (counts[m] || 0) + 1;
    }
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(r => r[1]));
  return `<section class="card">
    <div class="card-title"><b>Séries por grupo muscular</b><span class="muted">últimos 7 dias</span></div>
    ${rows.length ? rows.map(([m, n]) => `<div class="hbar"><span>${esc(m)}</span>
      <div class="track"><i style="width:${(n / max * 100).toFixed(0)}%;--c:${window.MUSCLE_COLORS[m] || '#64748b'}"></i></div><b>${n}</b></div>`).join('')
      : '<p class="muted">Nenhuma série nos últimos 7 dias.</p>'}
  </section>`;
}

function bodySection() {
  const pts = S.body.slice().sort((a, b) => a.t - b.t);
  const last = pts[pts.length - 1];
  return `<section class="card">
    <div class="card-title"><b>Peso corporal</b>${last ? `<span class="muted">Atual: <b class="fg">${fmtW(last.kg)} ${unit()}</b></span>` : ''}</div>
    ${lineChart(pts.map(p => ({ x: p.t, y: round1(toDisp(p.kg)) })), v => fmtNum(v) + ' ' + unit())}
    <div class="row gap">
      <input class="input grow" inputmode="decimal" placeholder="Peso hoje (${unit()})" data-f="bodyw" id="bodyw">
      <button class="btn" data-a="addBody">Registrar</button>
    </div>
    ${pts.length ? `<details><summary class="muted">Ver registros (${pts.length})</summary>
      ${pts.slice().reverse().map(p => `<div class="trow"><span class="grow">${fmtDate(p.t, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      <b>${fmtW(p.kg)} ${unit()}</b><button class="icon-btn" data-a="delBody" data-t="${p.t}" aria-label="Apagar">${icon('close')}</button></div>`).join('')}
    </details>` : ''}
  </section>`;
}

const VIEWS = { home: viewHome, train: viewTrain, exercises: viewExercises, profile: viewProfile };

/* ---------- tela de treino ativo ---------- */
function viewWorkout() {
  const w = S.active;
  return `<header class="whead">
      <button class="icon-btn" data-a="minimize" aria-label="Minimizar">${icon('down')}</button>
      <span class="grow center"><b>Treino</b></span>
      <button class="icon-btn danger" data-a="discard" aria-label="Descartar treino">${icon('trash')}</button>
      <button class="btn primary small" data-a="finish">Concluir</button>
    </header>
    <input class="title-input" value="${esc(w.name)}" data-f="wname" aria-label="Nome do treino">
    <div class="stats3 card">
      <div><small>Duração</small><b data-elapsed>${fmtClock(Date.now() - w.start)}</b></div>
      <div><small>Volume</small><b id="wvol">${fmtVol(wVolume(w))}</b></div>
      <div><small>Séries</small><b id="wsets">${wSetCount(w)}</b></div>
    </div>
    ${w.exercises.length ? '' : `<div class="empty card"><div class="empty-ic">${icon('train')}</div><h2>Comece adicionando um exercício</h2></div>`}
    ${w.exercises.map((e, i) => exerciseCard(e, i, 'active')).join('')}
    <button class="btn primary block" data-a="addExercises" data-scope="active">${icon('plus')} Adicionar exercícios</button>
    <button class="btn danger-ghost block" data-a="discard">Descartar treino</button>`;
}

function setLabel(s, n) {
  return s.type === 'W' ? 'A' : s.type === 'D' ? 'D' : s.type === 'F' ? 'F' : String(n);
}

function exerciseCard(e, ei, scope) {
  const ex = EX(e.exId);
  const active = scope === 'active';
  const prev = active ? lastSetsFor(e.exId) : [];
  let n = 0;
  const rows = e.sets.map((s, si) => {
    if (s.type === 'N' || !s.type) n++;
    const p = active ? prevFor(e.sets, si, prev) : null;
    const prevTxt = p ? (ex.kind === 'reps' && !p.w ? `${p.r} reps` : `${fmtW(p.w || 0)} ${unit()} × ${p.r || 0}`) : '—';
    const phW = p && p.w ? inW(p.w) : (ex.kind === 'reps' ? '' : '0');
    const phR = p && p.r ? p.r : '0';
    const pr = s.pr && s.pr.length ? `<span class="prb" title="Recorde">${icon('trophy')}</span>` : '';
    return `<div class="swipe"><button class="swipe-del" data-a="delSet" data-scope="${scope}" data-e="${ei}" data-s="${si}" tabindex="-1">${icon('trash')} Remover</button>
    <div class="setrow ${s.done ? 'done' : ''}" data-e="${ei}" data-s="${si}">
      <button class="setlbl t${s.type || 'N'}" data-a="setMenu" data-scope="${scope}" data-e="${ei}" data-s="${si}">${setLabel(s, n)}</button>
      ${active ? `<button class="prev" data-a="usePrev" data-e="${ei}" data-s="${si}" ${p ? '' : 'disabled'}>${prevTxt}</button>` : ''}
      <input class="cell" inputmode="decimal" value="${inW(s.w)}" placeholder="${phW}" data-f="w" data-scope="${scope}" data-e="${ei}" data-s="${si}" aria-label="Peso">
      <input class="cell" inputmode="numeric" value="${s.r ?? ''}" placeholder="${phR}" data-f="r" data-scope="${scope}" data-e="${ei}" data-s="${si}" aria-label="Repetições">
      ${active ? `<button class="chk ${s.done ? 'on' : ''}" data-a="toggleSet" data-e="${ei}" data-s="${si}" aria-label="Concluir série">${icon('check')}</button>${pr}` : ''}
    </div></div>`;
  }).join('');
  return `<section class="card excard" data-scope="${scope}" data-e="${ei}">
    <div class="excard-head">${avatar(ex)}
      <button class="exname grow" data-a="exDetail" data-id="${ex.id}">${esc(ex.name)}</button>
      <button class="icon-btn" data-a="exMenu" data-scope="${scope}" data-e="${ei}" aria-label="Opções do exercício">${icon('dots')}</button></div>
    <textarea class="note" rows="1" placeholder="Adicionar observação" data-f="note" data-scope="${scope}" data-e="${ei}">${esc(e.notes || '')}</textarea>
    <div class="exactions">
      <button class="restlink" data-a="restMenu" data-scope="${scope}" data-e="${ei}">${icon('timer')} Descanso: ${fmtRest(e.rest ?? S.settings.rest)}</button>
      <button class="restlink addlink" data-a="addSet" data-scope="${scope}" data-e="${ei}">${icon('plus')} Série</button>
    </div>
    <div class="sethead ${active ? '' : 'plain'}"><span>Série</span>${active ? '<span>Anterior</span>' : ''}<span>${ex.kind === 'reps' ? '+' + unit() : unit()}</span><span>Reps</span>${active ? `<span>${icon('check')}</span>` : ''}</div>
    ${rows}
    <button class="btn ghost block small" data-a="addSet" data-scope="${scope}" data-e="${ei}">${icon('plus')} Adicionar série</button>
  </section>`;
}

function scopeObj(scope) { return scope === 'draft' ? ui.draft : S.active; }
function refreshWorkoutStats() {
  if (!S.active) return;
  const v = $('#wvol'), s = $('#wsets');
  if (v) v.textContent = fmtVol(wVolume(S.active));
  if (s) s.textContent = wSetCount(S.active);
}

/* ---------- iniciar / concluir treino ---------- */
function newSet(type = 'N', w = null, r = null) { return { type, w, r, done: false }; }
function startWorkout(name, exercises, routineId) {
  if (S.active) { toast('Já existe um treino em andamento'); ui.workoutOpen = true; render(); return; }
  S.active = { id: uid(), name, start: Date.now(), routineId: routineId || null, exercises };
  ui.workoutOpen = true; ui.tab = 'home';
  save(); render(); scrollTo(0, 0);
}
function finishWorkout(updateRoutine) {
  const w = S.active;
  const done = clone(w);
  done.end = Date.now();
  done.exercises = done.exercises
    .map(e => ({ ...e, sets: e.sets.filter(s => s.done) }))
    .filter(e => e.sets.length);
  if (!done.exercises.length) { toast('Conclua pelo menos uma série'); return; }
  if (updateRoutine && w.routineId) {
    const r = S.routines.find(x => x.id === w.routineId);
    if (r) r.exercises = w.exercises.map(e => ({ exId: e.exId, rest: e.rest, notes: e.notes || '',
      sets: e.sets.map(s => ({ type: s.type, w: s.w, r: s.r })) }));
  }
  S.workouts.push(done);
  S.active = null; ui.workoutOpen = false; ui.tab = 'home';
  stopRest();
  save(); closeAllModals(); render(); scrollTo(0, 0);
  const prs = wPrCount(done);
  toast(prs ? `Treino salvo! 🏆 ${prs} recorde(s)` : 'Treino salvo!');
  // O navegador costuma aceitar depois que a pessoa usa o app; tenta de novo ao salvar um treino.
  if (ui.persisted !== true) requestPersist();
}

/* ---------- timer de descanso ---------- */
let rest = null;
function startRest(sec) {
  stopRest();
  if (!sec) return;
  rest = { end: Date.now() + sec * 1000, total: sec };
  rest.iv = setInterval(tickRest, 250);
  renderRestBar();
}
function stopRest() { if (rest) clearInterval(rest.iv); rest = null; renderRestBar(); }
function tickRest() {
  if (!rest) return;
  if (Date.now() >= rest.end) { stopRest(); beep(); toast('Descanso terminado'); return; }
  renderRestBar();
}
function renderRestBar() {
  const el = $('#restbar');
  if (!el) return;
  if (!rest) { el.hidden = true; el.innerHTML = ''; return; }
  const left = rest.end - Date.now();
  const pct = Math.max(0, Math.min(100, left / (rest.total * 1000) * 100));
  if (el.hidden || !el.firstChild) {
    el.hidden = false;
    el.innerHTML = `<div class="rest-track"><i></i></div><div class="rest-row">
      <button class="btn small" data-a="restAdj" data-d="-15">−15</button>
      <b class="rest-time"></b>
      <button class="btn small" data-a="restAdj" data-d="15">+15</button>
      <button class="btn primary small" data-a="restSkip">Pular</button></div>`;
  }
  el.querySelector('.rest-track i').style.width = pct + '%';
  el.querySelector('.rest-time').textContent = fmtClock(left + 999);
}
let audioCtx = null;
function beep() {
  if (navigator.vibrate) try { navigator.vibrate([200, 100, 200]); } catch (e) { /* ignorado */ }
  if (!S.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(t => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.25, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.18);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch (e) { /* áudio indisponível */ }
}

/* ---------- recordes ao vivo ---------- */
function checkPR(ei, si) {
  const e = S.active.exercises[ei], s = e.sets[si];
  s.pr = [];
  if (!working(s) || !s.r) return;
  const hist = exHistory(e.exId);
  if (!hist.length) return; // primeira vez: sem comparação
  const past = [];
  for (const h of hist) past.push(...h.sets);
  for (const [i, x] of e.sets.entries()) if (i !== si && x.done) past.push(x);
  const r = recordsFrom(past);
  const w = s.w || 0;
  if (w > r.maxW && w > 0) s.pr.push('Maior peso');
  if (e1rm(w, s.r) > r.best1rm && w > 0) s.pr.push('Melhor 1RM estimado');
  if (w * s.r > r.bestVol && w > 0) s.pr.push('Maior volume na série');
  if (EX(e.exId).kind === 'reps' && !w && s.r > r.maxReps) s.pr.push('Mais repetições');
  if (s.pr.length) toast('🏆 Recorde: ' + s.pr.join(', '));
}

/* ---------- modais ---------- */
function openModal(renderFn) { ui.modals.push(renderFn); renderModals(); }
function closeModal() { ui.modals.pop(); renderModals(); }
function closeAllModals() { ui.modals = []; renderModals(); }
function renderModals() {
  const root = $('#modal-root');
  document.body.classList.toggle('modal-open', ui.modals.length > 0);
  root.innerHTML = ui.modals.map((fn, i) => `<div class="backdrop" data-a="backdrop" style="z-index:${50 + i * 2}"></div>
    <div class="sheet" role="dialog" aria-modal="true" style="z-index:${51 + i * 2}">${fn()}</div>`).join('');
}
function rerenderTopModal() {
  const sheets = document.querySelectorAll('#modal-root .sheet');
  const top = sheets[sheets.length - 1];
  if (top) top.innerHTML = ui.modals[ui.modals.length - 1]();
}
function sheetHead(title, right = '') {
  return `<div class="sheet-head"><button class="icon-btn" data-a="closeModal" aria-label="Fechar">${icon('close')}</button>
    <b class="grow center">${title}</b>${right || '<span class="icon-btn"></span>'}</div>`;
}
function menu(title, items) {
  openModal(() => sheetHead(esc(title)) + `<div class="menu">${items.map((it, i) =>
    `<button class="menu-item ${it.danger ? 'danger' : ''}" data-a="menuPick" data-i="${i}">${esc(it.label)}</button>`).join('')}</div>`);
  ui.menuItems = items;
}
function confirmBox(title, text, okLabel, onOk, danger = true) {
  ui.confirmOk = onOk;
  openModal(() => sheetHead(esc(title)) + `<p class="pad">${esc(text)}</p>
    <div class="row gap pad"><button class="btn grow" data-a="closeModal">Cancelar</button>
    <button class="btn grow ${danger ? 'danger' : 'primary'}" data-a="confirmOk">${esc(okLabel)}</button></div>`);
}

let toastTimer;
function toast(msg) {
  const r = $('#toast-root');
  r.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { r.innerHTML = ''; }, 2800);
}

/* ---------- seletor de exercícios ---------- */
function openPicker(onDone) {
  ui.pick = { q: '', m: '', sel: [], onDone };
  openModal(pickerView);
}
function pickerView() {
  const p = ui.pick;
  return sheetHead('Adicionar exercícios', `<button class="btn primary small" data-a="pickDone" ${p.sel.length ? '' : 'disabled'}>Adicionar${p.sel.length ? ' (' + p.sel.length + ')' : ''}</button>`) +
    `<label class="search">${icon('search')}<input type="search" placeholder="Buscar exercício" value="${esc(p.q)}" data-f="pickq" autocomplete="off"></label>
    ${muscleChips(p.m, 'pickMuscle')}
    <div class="list" id="picklist">${pickRows()}</div>`;
}
function pickRows() {
  const p = ui.pick;
  const list = filterExercises(p.q, p.m);
  const create = `<button class="exrow create" data-a="pickCreate"><span class="avatar plus">${icon('plus')}</span>
    <span class="grow"><b>${p.q.trim() ? `Criar “${esc(p.q.trim())}”` : 'Criar exercício'}</b><small class="muted">Não achou o seu? Crie e ele já entra no treino</small></span></button>`;
  if (!list.length) return create;
  return create + list.map(e => {
    const i = p.sel.indexOf(e.id);
    return `<button class="exrow ${i >= 0 ? 'sel' : ''}" data-a="pickToggle" data-id="${e.id}">${avatar(e)}
      <span class="grow"><b>${esc(e.name)}</b><small class="muted">${esc(e.muscle)} · ${esc(e.equipment)}</small></span>
      ${i >= 0 ? `<span class="selnum">${i + 1}</span>` : ''}</button>`;
  }).join('');
}

/* ---------- detalhes ---------- */
function exDetailView(id) {
  const ex = EX(id);
  const rec = exRecords(id);
  const hist = exHistory(id);
  const pts = hist.slice().reverse().map(h => ({ x: h.w.start, y: round1(toDisp(Math.max(...h.sets.filter(working).map(s => e1rm(s.w || 0, s.r || 0)), 0))) })).filter(p => p.y > 0);
  const isReps = ex.kind === 'reps';
  return sheetHead(esc(ex.name)) + `<div class="pad">
    ${hasImg(ex) ? `<div class="exdemo" aria-label="Demonstração do exercício"><img src="img/ex/${ex.id}-0.jpg" alt="Posição inicial"><img src="img/ex/${ex.id}-1.jpg" alt="Posição final"></div>` : ''}
    <p class="muted">${esc(ex.muscle)} · ${esc(ex.equipment)}</p>
    <div class="grid2">
      ${isReps ? `<div class="card stat"><small>Mais repetições</small><b>${rec.maxReps || '—'}</b></div>` : ''}
      <div class="card stat"><small>Maior peso</small><b>${rec.maxW ? fmtW(rec.maxW) + ' ' + unit() : '—'}</b></div>
      <div class="card stat"><small>1RM estimado</small><b>${rec.best1rm ? fmtW(rec.best1rm) + ' ' + unit() : '—'}</b></div>
      <div class="card stat"><small>Melhor série (volume)</small><b>${rec.bestVol ? fmtVol(rec.bestVol) : '—'}</b></div>
      <div class="card stat"><small>Treinos</small><b>${rec.sessions}</b></div>
    </div>
    ${isReps && !rec.maxW ? '' : `<h3 class="sec">1RM estimado por treino</h3>${lineChart(pts, v => fmtNum(v) + ' ' + unit())}`}
    <h3 class="sec">Histórico</h3>
    ${hist.length ? hist.slice(0, 20).map(h => `<div class="card hist"><b>${esc(h.w.name)}</b> <small class="muted">${fmtDate(h.w.start)}</small>
      <ol>${h.sets.map(s => `<li class="${s.type === 'W' ? 'muted' : ''}">${s.type === 'W' ? 'Aquec.: ' : ''}${isReps && !s.w ? '' : fmtW(s.w || 0) + ' ' + unit() + ' × '}${s.r || 0}${isReps && !s.w ? ' reps' : ''}${s.pr && s.pr.length ? ' 🏆' : ''}</li>`).join('')}</ol></div>`).join('')
      : '<p class="muted">Você ainda não fez este exercício.</p>'}
    ${ex.custom ? `<button class="btn block" data-a="editExercise" data-id="${ex.id}">${icon('edit')} Editar exercício</button>` : ''}
  </div>`;
}

function workoutDetailView(id) {
  const w = S.workouts.find(x => x.id === id);
  if (!w) return sheetHead('Treino') + '<p class="pad muted">Treino não encontrado.</p>';
  return sheetHead(esc(w.name), `<button class="icon-btn" data-a="workoutMenu" data-id="${w.id}" aria-label="Opções">${icon('dots')}</button>`) + `<div class="pad">
    <p class="muted">${fmtDate(w.start)} · ${new Date(w.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
    <div class="stats3 card">
      <div><small>Duração</small><b>${fmtDur(w.end - w.start)}</b></div>
      <div><small>Volume</small><b>${fmtVol(wVolume(w))}</b></div>
      <div><small>Séries</small><b>${wSetCount(w)}</b></div>
    </div>
    ${w.exercises.map(e => {
      const ex = EX(e.exId); let n = 0;
      return `<div class="card hist">${avatar(ex)} <b>${esc(ex.name)}</b>
      ${e.notes ? `<p class="muted">${esc(e.notes)}</p>` : ''}
      <div class="dsets">${e.sets.map(s => { if (s.type === 'N') n++; return `<div><span class="setlbl t${s.type}">${setLabel(s, n)}</span>
        <span class="grow">${ex.kind === 'reps' && !s.w ? s.r + ' reps' : fmtW(s.w || 0) + ' ' + unit() + ' × ' + (s.r || 0)}</span>
        ${s.pr && s.pr.length ? `<small class="prtxt">🏆 ${esc(s.pr.join(', '))}</small>` : ''}</div>`; }).join('')}</div></div>`;
    }).join('')}
  </div>`;
}

/* ---------- editor de rotina ---------- */
function openRoutineEditor(r) {
  ui.draft = r ? clone(r) : { id: null, name: '', exercises: [] };
  openModal(routineEditorView);
}
function routineEditorView() {
  const d = ui.draft;
  return sheetHead(d.id ? 'Editar rotina' : 'Nova rotina', `<button class="btn primary small" data-a="saveRoutine">Salvar</button>`) + `<div class="pad">
    <input class="title-input" placeholder="Nome da rotina" value="${esc(d.name)}" data-f="rname">
    ${d.exercises.map((e, i) => exerciseCard(e, i, 'draft')).join('')}
    <button class="btn primary block" data-a="addExercises" data-scope="draft">${icon('plus')} Adicionar exercícios</button>
  </div>`;
}

/* ---------- editar treino salvo ---------- */
function toLocalInput(t) { const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); }
function openWorkoutEditor(w) {
  ui.draft = clone(w);
  ui.draft._dur = Math.max(1, Math.round((w.end - w.start) / 60000));
  openModal(workoutEditorView);
}
function workoutEditorView() {
  const d = ui.draft;
  return sheetHead('Editar treino', `<button class="btn primary small" data-a="saveWorkoutEdit">Salvar</button>`) + `<div class="pad">
    <input class="title-input" placeholder="Nome do treino" value="${esc(d.name)}" data-f="rname">
    <div class="grid2 fields">
      <label class="field"><span>Data e hora</span><input class="input" type="datetime-local" value="${toLocalInput(d.start)}" data-f="wstart"></label>
      <label class="field"><span>Duração (min)</span><input class="input" inputmode="numeric" value="${d._dur}" data-f="wdur"></label>
    </div>
    ${d.exercises.map((e, i) => exerciseCard(e, i, 'draft')).join('')}
    <button class="btn primary block" data-a="addExercises" data-scope="draft">${icon('plus')} Adicionar exercícios</button>
  </div>`;
}

/* ---------- configurações ---------- */
function settingsView() {
  const st = S.settings;
  return sheetHead('Configurações') + `<div class="pad stack">
    <div class="trow"><span class="grow">Unidade de peso</span>
      <div class="seg inline"><button class="${st.unit === 'kg' ? 'on' : ''}" data-a="setUnit" data-u="kg">kg</button><button class="${st.unit === 'lb' ? 'on' : ''}" data-a="setUnit" data-u="lb">lb</button></div></div>
    <div class="trow"><span class="grow">Descanso padrão</span><button class="btn small" data-a="defaultRest">${fmtRest(st.rest)}</button></div>
    <div class="trow"><span class="grow">Peso da barra (${unit()})</span><input class="cell" inputmode="decimal" value="${inW(st.bar)}" data-f="bar"></div>
    <div class="trow"><span class="grow">Som ao fim do descanso</span><button class="toggle ${st.sound ? 'on' : ''}" data-a="toggleSound" aria-label="Som"><i></i></button></div>
    <div class="trow"><span class="grow">Manter a tela ligada no treino</span><button class="toggle ${st.keepAwake ? 'on' : ''}" data-a="toggleAwake" aria-label="Manter a tela ligada"><i></i></button></div>
    <div class="trow"><span class="grow">Armazenamento dos dados<small class="muted">Protege contra limpeza automática do navegador</small></span>
      ${ui.persisted === true ? persistLabel() : `<button class="btn small" data-a="persist">${ui.persisted === 'unsupported' ? 'Não suportado' : 'Pedir de novo'}</button>`}</div>
    ${ui.persisted === false ? '<p class="muted small">O navegador ainda não autorizou. Instale o app na tela inicial e use por alguns dias; ele tenta de novo sozinho.</p>' : ''}
    <hr>
    <button class="btn block" data-a="exportData">Exportar backup (JSON)</button>
    <label class="btn block">Importar backup<input type="file" accept="application/json,.json" hidden data-f="import"></label>
    <button class="btn block" data-a="seedDemo">Carregar dados de exemplo</button>
    ${hasPrev() ? '<button class="btn block" data-a="restorePrev">Desfazer última importação ou limpeza</button>' : ''}
    <p class="muted small">${S.lastBackup ? 'Último backup: ' + fmtDate(S.lastBackup, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Nenhum backup feito ainda.'}</p>
    <button class="btn danger-ghost block" data-a="wipe">Apagar todos os dados</button>
    <p class="muted small">Seus dados ficam só neste aparelho. Faça backup de vez em quando.</p>
  </div>`;
}

function plateView(targetKg) {
  const bar = S.settings.bar || 20;
  const plates = unit() === 'lb' ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25];
  const target = round1(toDisp(targetKg || 0)), barD = round1(toDisp(bar));
  let side = (target - barD) / 2;
  const out = [];
  if (side > 0) for (const p of plates) while (side + 1e-9 >= p) { out.push(p); side -= p; }
  return sheetHead('Calculadora de anilhas') + `<div class="pad">
    <div class="row gap"><input class="input grow" inputmode="decimal" placeholder="Peso total (${unit()})" value="${target || ''}" data-f="plate" id="platein">
    <button class="btn" data-a="plateCalc">Calcular</button></div>
    <p class="muted">Barra: ${fmtNum(barD)} ${unit()} · por lado:</p>
    <div class="plates">${out.length ? out.map(p => `<span class="plate" style="--h:${30 + p * (unit() === 'lb' ? 1.4 : 2.6)}px">${fmtNum(p, 2)}</span>`).join('') : '<span class="muted">Só a barra.</span>'}</div>
    ${side > 0.01 ? `<p class="muted">Sobra ${fmtNum(side * 2, 2)} ${unit()} que não fecha com as anilhas.</p>` : ''}
  </div>`;
}

/* ---------- dados de exemplo ---------- */
function seedDemo() {
  const now = Date.now();
  const plan = [
    ['Push', [['supino-reto-barra', 60, 8], ['supino-inclinado-halter', 22, 10], ['elevacao-lateral', 8, 15], ['triceps-corda', 25, 12]]],
    ['Pull', [['puxada-frente', 55, 10], ['remada-curvada', 50, 8], ['face-pull', 20, 15], ['rosca-alternada', 12, 10]]],
    ['Legs', [['agachamento-livre', 80, 6], ['leg-press', 160, 10], ['stiff', 60, 10], ['panturrilha-pe', 60, 12]]]
  ];
  const ws = [];
  let k = 0;
  for (let d = 42; d >= 1; d--) {
    if ([1, 3, 5].indexOf(new Date(now - d * DAY).getDay()) < 0) continue;
    const [name, exs] = plan[k % 3];
    const prog = Math.floor(k / 3);
    const start = startOfDay(now - d * DAY) + 18 * 3600000 + (k % 4) * 600000;
    ws.push({ id: uid(), name, start, end: start + (50 + (k % 5) * 6) * 60000, routineId: null,
      exercises: exs.map(([exId, w, r]) => ({ exId, notes: '', rest: 90,
        sets: [newSet('W', round1(w * 0.5), 10), ...[0, 1, 2].map(i => ({ type: 'N', w: w + prog * 2.5, r: r - (i === 2 ? 1 : 0), done: true }))]
          .map(s => ({ ...s, done: true })) })) });
    k++;
  }
  S.workouts = S.workouts.concat(ws);
  recomputeAllPRs();
  if (!S.body.length) for (let i = 0; i < 8; i++) S.body.push({ t: startOfDay(now - (49 - i * 7) * DAY), kg: round1(82 - i * 0.4 + (i % 2) * 0.3) });
  if (!S.routines.length) addTemplate(0), addTemplate(1), addTemplate(2);
  save(); closeAllModals(); ui.tab = 'home'; render();
  toast('Dados de exemplo carregados');
}
function addTemplate(i) {
  const t = window.TEMPLATES[i];
  S.routines.push({ id: uid(), name: t.name, exercises: t.ex.map(([exId, sets, r]) => ({ exId, rest: null, notes: '',
    sets: Array.from({ length: sets }, () => ({ type: 'N', w: null, r })) })) });
}

// Anima a entrada da tela só na troca de aba (não a cada série marcada).
let enterTimer;
function animateIn() {
  const v = $('#view');
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  clearTimeout(enterTimer); enterTimer = setTimeout(() => v.classList.remove('enter'), 700);
}

/* ---------- ações (cliques) ---------- */
const A = {
  tab(el) { ui.tab = el.dataset.id; render(); scrollTo(0, 0); animateIn(); },
  openWorkout() { ui.workoutOpen = true; render(); scrollTo(0, 0); },
  minimize() { ui.workoutOpen = false; render(); },
  startEmpty() { startWorkout(defaultWorkoutName(), []); },
  startRoutine(el) {
    const r = S.routines.find(x => x.id === el.dataset.id);
    if (!r) return;
    startWorkout(r.name, r.exercises.map(e => ({ exId: e.exId, notes: e.notes || '', rest: e.rest,
      sets: e.sets.map(s => newSet(s.type || 'N', s.w, s.r)) })), r.id);
  },
  seedDemo() { seedDemo(); },
  addTemplate(el) { addTemplate(+el.dataset.i); save(); render(); toast('Rotina adicionada'); },
  newRoutine() { openRoutineEditor(null); },
  routineMenu(el) {
    const r = S.routines.find(x => x.id === el.dataset.id);
    menu(r.name, [
      { label: 'Editar rotina', fn: () => { closeModal(); openRoutineEditor(r); } },
      { label: 'Duplicar', fn: () => { const c = clone(r); c.id = uid(); c.name += ' (cópia)'; S.routines.push(c); save(); closeModal(); render(); } },
      { label: 'Apagar rotina', danger: true, fn: () => { closeModal(); confirmBox('Apagar rotina?', `“${r.name}” será apagada.`, 'Apagar', () => { S.routines = S.routines.filter(x => x !== r); save(); render(); }); } }
    ]);
  },
  saveRoutine() {
    const d = ui.draft;
    if (!d.name.trim()) { toast('Dê um nome para a rotina'); return; }
    if (!d.exercises.length) { toast('Adicione pelo menos um exercício'); return; }
    d.exercises.forEach(e => e.sets.forEach(s => { delete s.done; delete s.pr; }));
    if (d.id) { const i = S.routines.findIndex(x => x.id === d.id); S.routines[i] = d; }
    else { d.id = uid(); S.routines.push(d); }
    ui.draft = null; save(); closeModal(); render(); toast('Rotina salva');
  },
  saveWorkoutEdit() {
    const d = ui.draft;
    const out = clone(d);
    out.name = (out.name || '').trim() || 'Treino';
    out.exercises = out.exercises
      .map(e => ({ ...e, sets: e.sets.filter(s => s.r > 0).map(s => ({ ...s, done: true })) }))
      .filter(e => e.sets.length);
    if (!out.exercises.length) { toast('O treino precisa de pelo menos uma série com repetições'); return; }
    if (out.start > Date.now()) { toast('A data não pode ser no futuro'); return; }
    out.end = out.start + Math.max(1, out._dur || 1) * 60000;
    delete out._dur;
    const i = S.workouts.findIndex(x => x.id === out.id);
    if (i < 0) return;
    S.workouts[i] = out;
    ui.draft = null; recomputeAllPRs(); save(); closeAllModals(); render(); toast('Treino atualizado');
  },
  backupLater() { S.backupSnooze = Date.now() + 7 * DAY; save(); render(); },
  toggleAwake() { S.settings.keepAwake = !S.settings.keepAwake; save(); syncWakeLock(); rerenderTopModal(); },
  restorePrev() {
    confirmBox('Desfazer?', 'Os dados voltam a ser como eram antes da última importação ou limpeza.', 'Desfazer', () => {
      try {
        const prev = JSON.parse(localStorage.getItem(STORE_KEY + '.prev'));
        if (!prev || !Array.isArray(prev.workouts)) throw new Error('vazio');
        localStorage.removeItem(STORE_KEY + '.prev');
        stopRest(); ui.workoutOpen = false; applyState(prev); closeAllModals(); render(); toast('Dados restaurados');
      } catch (e) { toast('Não há nada para desfazer'); }
    }, false);
  },
  addExercises(el) {
    const scope = el.dataset.scope;
    openPicker(ids => {
      const o = scopeObj(scope);
      for (const id of ids) {
        const last = lastSetsFor(id).filter(working);
        const count = scope === 'draft' ? 3 : Math.max(1, last.length || 3);
        o.exercises.push({ exId: id, notes: '', rest: null, sets: Array.from({ length: count }, () => newSet()) });
      }
      if (scope === 'active') { save(); render(); } else rerenderTopModal();
    });
  },
  pickToggle(el) {
    const p = ui.pick, i = p.sel.indexOf(el.dataset.id);
    if (i >= 0) p.sel.splice(i, 1); else p.sel.push(el.dataset.id);
    rerenderTopModal();
  },
  pickMuscle(el) { ui.pick.m = el.dataset.m; rerenderTopModal(); },
  pickDone() { const p = ui.pick; closeModal(); p.onDone(p.sel); ui.pick = null; },
  exMuscle(el) { ui.exMuscle = el.dataset.m; render(); },
  exDetail(el) { const id = el.dataset.id; openModal(() => exDetailView(id)); },
  workoutDetail(el) { const id = el.dataset.id; openModal(() => workoutDetailView(id)); },
  workoutMenu(el) {
    const w = S.workouts.find(x => x.id === el.dataset.id);
    menu(w.name, [
      { label: 'Editar treino', fn: () => { closeAllModals(); openWorkoutEditor(w); } },
      { label: 'Repetir este treino', fn: () => { closeAllModals(); startWorkout(w.name, w.exercises.map(e => ({ exId: e.exId, notes: e.notes, rest: e.rest, sets: e.sets.map(s => newSet(s.type, s.w, s.r)) }))); } },
      { label: 'Salvar como rotina', fn: () => { S.routines.push({ id: uid(), name: w.name, exercises: w.exercises.map(e => ({ exId: e.exId, rest: e.rest, notes: e.notes || '', sets: e.sets.map(s => ({ type: s.type, w: s.w, r: s.r })) })) }); save(); closeAllModals(); render(); toast('Rotina criada'); } },
      { label: 'Apagar treino', danger: true, fn: () => { closeModal(); confirmBox('Apagar treino?', 'Isso não pode ser desfeito.', 'Apagar', () => { S.workouts = S.workouts.filter(x => x !== w); recomputeAllPRs(); save(); closeAllModals(); render(); }); } }
    ]);
  },
  newExercise() { openExerciseEditor({}); },
  editExercise(el) {
    const ex = S.customExercises.find(e => e.id === el.dataset.id);
    if (ex) openExerciseEditor({ ex });
  },
  pickCreate() {
    // cria um exercício no meio do treino/rotina e já deixa ele selecionado
    openExerciseEditor({ name: ui.pick.q, onSaved: id => { ui.pick.sel.push(id); ui.pick.q = ''; rerenderTopModal(); } });
  },
  saveExercise() {
    const n = ui.newEx;
    const name = n.name.trim();
    if (!name) { toast('Dê um nome ao exercício'); return; }
    const dup = allExercises().find(e => e.id !== n.id && norm(e.name) === norm(name));
    if (dup) { toast('Já existe um exercício com esse nome'); return; }
    let id = n.id;
    if (id) {
      Object.assign(S.customExercises.find(e => e.id === id), { name, muscle: n.muscle, equipment: n.equipment, kind: n.kind });
    } else {
      id = 'c-' + uid();
      S.customExercises.push({ id, name, muscle: n.muscle, equipment: n.equipment, kind: n.kind, custom: true, created: Date.now() });
    }
    invalidateEx(); save();
    const onSaved = n.onSaved;
    closeModal();
    if (onSaved) onSaved(id);
    else { render(); rerenderTopModal(); }
    toast(n.id ? 'Exercício atualizado' : 'Exercício criado');
  },
  delExercise(el) {
    const id = el.dataset.id;
    const ex = S.customExercises.find(e => e.id === id);
    if (!ex) return;
    const used = S.workouts.some(w => w.exercises.some(e => e.exId === id)) || S.routines.some(r => r.exercises.some(e => e.exId === id))
      || (S.active && S.active.exercises.some(e => e.exId === id));
    if (used) { toast('Ele já está no seu histórico ou em rotinas. Você pode editá-lo.'); return; }
    confirmBox('Apagar exercício?', `“${ex.name}” será apagado.`, 'Apagar', () => {
      S.customExercises = S.customExercises.filter(e => e.id !== id); invalidateEx(); save(); closeAllModals(); render();
    });
  },
  exView(el) { ui.exView = el.dataset.v; render(); },
  // séries
  toggleSet(el) {
    const ei = +el.dataset.e, si = +el.dataset.s;
    const e = S.active.exercises[ei], s = e.sets[si];
    if (!s.done) {
      const row = el.closest('.setrow');
      const [wi, ri] = row.querySelectorAll('input');
      if (s.w === null || s.w === undefined) { const v = num(wi.placeholder); s.w = v === null ? null : fromDisp(v); }
      if (s.r === null || s.r === undefined) { const v = num(ri.placeholder); s.r = v === null ? null : Math.round(v); }
      if (!s.r) { toast('Informe as repetições'); return; }
      s.done = true;
      checkPR(ei, si);
      startRest(e.rest ?? S.settings.rest);
    } else { s.done = false; s.pr = []; }
    save(); render();
  },
  usePrev(el) {
    const ei = +el.dataset.e, si = +el.dataset.s;
    const e = S.active.exercises[ei], p = prevFor(e.sets, si, lastSetsFor(e.exId));
    if (!p) return;
    e.sets[si].w = p.w; e.sets[si].r = p.r; save(); render();
  },
  addSet(el) {
    const o = scopeObj(el.dataset.scope), e = o.exercises[+el.dataset.e];
    const last = e.sets[e.sets.length - 1];
    e.sets.push(newSet('N', last ? last.w : null, last ? last.r : null));
    if (el.dataset.scope === 'active') { save(); render(); } else rerenderTopModal();
  },
  setMenu(el) {
    const scope = el.dataset.scope, ei = +el.dataset.e, si = +el.dataset.s;
    const after = () => { if (scope === 'active') { save(); render(); } else rerenderTopModal(); };
    const set = t => () => { closeModal(); scopeObj(scope).exercises[ei].sets[si].type = t; after(); };
    menu('Tipo de série', [
      { label: 'Normal', fn: set('N') }, { label: 'Aquecimento (A)', fn: set('W') },
      { label: 'Drop set (D)', fn: set('D') }, { label: 'Até a falha (F)', fn: set('F') },
      { label: 'Remover série', danger: true, fn: () => { closeModal(); scopeObj(scope).exercises[ei].sets.splice(si, 1); after(); } }
    ]);
  },
  exMenu(el) {
    const scope = el.dataset.scope, ei = +el.dataset.e;
    const o = scopeObj(scope), e = o.exercises[ei];
    const after = () => { if (scope === 'active') { save(); render(); } else rerenderTopModal(); };
    const items = [
      { label: 'Adicionar séries de aquecimento', fn: () => { closeModal(); addWarmups(e); after(); } },
      { label: 'Calculadora de anilhas', fn: () => { closeModal(); const ws = e.sets.find(s => working(s) && s.w) || lastSetsFor(e.exId).find(s => working(s) && s.w); ui.plateKg = ws ? ws.w : 0; openModal(() => plateView(ui.plateKg)); } },
      { label: 'Trocar exercício', fn: () => { closeModal(); openPicker(ids => { if (ids[0]) { e.exId = ids[0]; after(); } }); } }
    ];
    if (ei > 0) items.push({ label: 'Mover para cima', fn: () => { closeModal(); o.exercises.splice(ei - 1, 0, o.exercises.splice(ei, 1)[0]); after(); } });
    if (ei < o.exercises.length - 1) items.push({ label: 'Mover para baixo', fn: () => { closeModal(); o.exercises.splice(ei + 1, 0, o.exercises.splice(ei, 1)[0]); after(); } });
    items.push({ label: 'Remover exercício', danger: true, fn: () => {
      closeModal();
      const remove = () => { o.exercises.splice(ei, 1); after(); };
      if (scope === 'active' && e.sets.some(x => x.done)) confirmBox('Remover exercício?', 'As séries já marcadas deste exercício serão perdidas.', 'Remover', remove);
      else remove();
    } });
    menu(EX(e.exId).name, items);
  },
  restMenu(el) {
    const scope = el.dataset.scope, e = scopeObj(scope).exercises[+el.dataset.e];
    const opts = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
    menu('Timer de descanso', opts.map(sec => ({ label: fmtRest(sec) + (sec === S.settings.rest ? ' (padrão)' : ''), fn: () => {
      closeModal(); e.rest = sec; if (scope === 'active') { save(); render(); } else rerenderTopModal(); } })));
  },
  restAdj(el) { if (!rest) return; rest.end += (+el.dataset.d) * 1000; rest.total = Math.max(rest.total, Math.ceil((rest.end - Date.now()) / 1000)); tickRest(); },
  restSkip() { stopRest(); },
  finish() {
    const w = S.active;
    const pending = w.exercises.reduce((a, e) => a + e.sets.filter(s => !s.done).length, 0);
    const routine = w.routineId && S.routines.find(r => r.id === w.routineId);
    openModal(() => sheetHead('Concluir treino') + `<div class="pad stack">
      <div class="stats3 card"><div><small>Duração</small><b>${fmtDur(Date.now() - w.start)}</b></div>
        <div><small>Volume</small><b>${fmtVol(wVolume(w))}</b></div><div><small>Séries</small><b>${wSetCount(w)}</b></div></div>
      ${pending ? `<p class="muted">${pending} série(s) não marcada(s) serão descartadas.</p>` : ''}
      <button class="btn primary block" data-a="doFinish">Salvar treino</button>
      ${routine ? `<button class="btn block" data-a="doFinish" data-upd="1">Salvar e atualizar a rotina “${esc(routine.name)}”</button>` : ''}
      <button class="btn ghost block" data-a="closeModal">Continuar treinando</button></div>`);
  },
  doFinish(el) { finishWorkout(!!el.dataset.upd); },
  discard() {
    const drop = () => { S.active = null; ui.workoutOpen = false; stopRest(); save(); render(); };
    // Início sem querer: se nada foi marcado nem preenchido, descarta direto, sem perguntar.
    const touched = S.active.exercises.some(e => e.sets.some(s => s.done || s.w || s.r));
    if (!touched) { drop(); toast('Treino descartado'); return; }
    confirmBox('Descartar treino?', 'Tudo o que você registrou neste treino será perdido.', 'Descartar', drop);
  },
  delSet(el) {
    const scope = el.dataset.scope, e = scopeObj(scope).exercises[+el.dataset.e];
    e.sets.splice(+el.dataset.s, 1);
    if (scope === 'active') { save(); render(); } else rerenderTopModal();
  },
  // perfil
  chartMetric(el) { ui.chartMetric = el.dataset.k; render(); },
  cal(el) { ui.calOffset = Math.min(0, ui.calOffset + (+el.dataset.d)); render(); },
  addBody() {
    const v = num($('#bodyw').value);
    if (!v || v <= 0) { toast('Informe o peso'); return; }
    const t = startOfDay(Date.now());
    S.body = S.body.filter(b => b.t !== t); S.body.push({ t, kg: fromDisp(v) });
    save(); render(); toast('Peso registrado');
  },
  delBody(el) { const t = +el.dataset.t; S.body = S.body.filter(b => b.t !== t); save(); render(); },
  settings() { openModal(settingsView); },
  setUnit(el) { S.settings.unit = el.dataset.u; save(); render(); },
  toggleSound() { S.settings.sound = !S.settings.sound; save(); rerenderTopModal(); },
  defaultRest() {
    menu('Descanso padrão', [0, 30, 45, 60, 90, 120, 150, 180, 240, 300].map(sec => ({ label: fmtRest(sec), fn: () => { S.settings.rest = sec; save(); closeModal(); render(); } })));
  },
  exportData() {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `forja-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    S.lastBackup = Date.now(); save();
    if (ui.modals.length) rerenderTopModal(); else render();
  },
  wipe() {
    confirmBox('Apagar todos os dados?', 'Treinos, rotinas, medidas e exercícios personalizados serão apagados deste aparelho.', 'Apagar tudo', () => {
      snapshotPrev();
      S = defaultState(); invalidateEx(); stopRest(); ui.workoutOpen = false; save(); closeAllModals(); render();
      toast('Dados apagados. Dá para desfazer em Configurações.');
    });
  },
  async persist() {
    await requestPersist();
    toast(ui.persisted === true ? 'Dados protegidos ✓' : 'O navegador ainda não autorizou');
  },
  plateCalc() { const v = num($('#platein').value); ui.plateKg = v ? fromDisp(v) : 0; rerenderTopModal(); },
  // modais
  closeModal() { closeModal(); },
  backdrop() { closeModal(); },
  menuPick(el) { const it = ui.menuItems[+el.dataset.i]; if (it) it.fn(); },
  confirmOk() { const fn = ui.confirmOk; closeModal(); fn && fn(); }
};

function addWarmups(e) {
  const first = e.sets.find(s => working(s) && s.w);
  const prevFirst = lastSetsFor(e.exId).find(s => working(s) && s.w);
  const W = first ? first.w : prevFirst ? prevFirst.w : 0;
  if (!W) { toast('Coloque o peso da primeira série antes'); return; }
  const step = unit() === 'lb' ? 5 / KG_LB : 2.5;
  const bar = S.settings.bar || 20;
  const sets = [[0.4, 10], [0.6, 6], [0.8, 3]].map(([p, r]) => newSet('W', Math.max(bar, Math.round(W * p / step) * step), r));
  e.sets = sets.concat(e.sets.filter(s => s.type !== 'W'));
}

function defaultWorkoutName() {
  const h = new Date().getHours();
  return h < 12 ? 'Treino da manhã' : h < 18 ? 'Treino da tarde' : 'Treino da noite';
}

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.a];
  if (fn) { e.preventDefault(); fn(el, e); }
});

document.addEventListener('input', e => {
  const el = e.target, f = el.dataset.f;
  if (!f) return;
  const scope = el.dataset.scope;
  switch (f) {
    case 'w': case 'r': {
      const s = scopeObj(scope).exercises[+el.dataset.e].sets[+el.dataset.s];
      const v = num(el.value);
      if (f === 'w') s.w = v === null ? null : fromDisp(v);
      else s.r = v === null ? null : Math.max(0, Math.round(v));
      if (scope === 'active') { save(); refreshWorkoutStats(); }
      break;
    }
    case 'note': scopeObj(scope).exercises[+el.dataset.e].notes = el.value; if (scope === 'active') save(); autoGrow(el); break;
    case 'wname': S.active.name = el.value; save(); break;
    case 'rname': ui.draft.name = el.value; break;
    case 'wstart': { const t = new Date(el.value).getTime(); if (!isNaN(t)) ui.draft.start = t; break; }
    case 'wdur': { const v = num(el.value); ui.draft._dur = v && v > 0 ? Math.round(v) : 1; break; }
    case 'exq': ui.exQ = el.value; $('#exlist').innerHTML = exListHtml(); break;
    case 'pickq': ui.pick.q = el.value; $('#picklist').innerHTML = pickRows(); break;
    case 'nxname': ui.newEx.name = el.value; break;
    case 'bar': { const v = num(el.value); if (v !== null && v >= 0) { S.settings.bar = fromDisp(v); save(); } break; }
  }
});
document.addEventListener('change', e => {
  const el = e.target, f = el.dataset.f;
  if (f === 'nxmuscle') ui.newEx.muscle = el.value;
  if (f === 'nxequip') ui.newEx.equipment = el.value;
  if (f === 'nxkind') ui.newEx.kind = el.value;
  if (f === 'import' && el.files[0]) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.workouts)) throw new Error('formato');
        snapshotPrev();
        stopRest(); ui.workoutOpen = false;
        applyState(d); closeAllModals(); render(); toast('Backup importado');
      } catch (err) { toast('Arquivo inválido'); }
    };
    rd.readAsText(el.files[0]);
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.modals.length) closeModal();
  if (e.key === 'Enter' && e.target.id === 'bodyw') A.addBody();
  if (e.key === 'Enter' && e.target.id === 'platein') A.plateCalc();
  if (e.key === 'Enter' && e.target.classList.contains('cell') && e.target.dataset.f) {
    const row = e.target.closest('.setrow');
    if (!row) return;
    e.preventDefault();
    if (e.target.dataset.f === 'w') row.querySelector('[data-f="r"]').focus();
    else { const chk = row.querySelector('.chk:not(.on)'); if (chk) chk.click(); else e.target.blur(); }
  }
});
document.addEventListener('focusin', e => { if (e.target.classList.contains('cell')) e.target.select(); });
function autoGrow(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

/* ---------- gestos: deslizar série para remover / segurar exercício para reordenar ---------- */
const SWIPE_W = 92;
let swipe = null, openSwipe = null, dragEx = null, suppressClickUntil = 0;

function closeSwipe(except) {
  if (openSwipe && openSwipe !== except) {
    const r = openSwipe.querySelector('.setrow');
    openSwipe.classList.remove('open'); if (r) r.style.transform = '';
    openSwipe = null;
  }
}
function swipeSet(wrap, x, animate) {
  const row = wrap.querySelector('.setrow');
  row.style.transition = animate ? 'transform .2s cubic-bezier(.2, .8, .2, 1)' : 'none';
  row.style.transform = x ? `translateX(${x}px)` : '';
  wrap.classList.toggle('open', x < 0);
}
document.addEventListener('pointerdown', e => {
  const wrap = e.target.closest('.swipe');
  if (!e.target.closest('.swipe-del')) closeSwipe(wrap && wrap.classList.contains('open') ? wrap : null);
  if (!wrap || e.target.closest('.swipe-del') || (e.pointerType === 'mouse' && (e.button !== 0 || e.target.closest('input')))) return;
  swipe = { wrap, id: e.pointerId, x0: e.clientX, y0: e.clientY, base: wrap.classList.contains('open') ? -SWIPE_W : 0, on: false };
});
document.addEventListener('pointermove', e => {
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x0, dy = e.clientY - swipe.y0;
  if (!swipe.on) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; } // é rolagem
    if (Math.abs(dx) < 10) return;
    swipe.on = true; swipe.wrap.classList.add('swiping');
    try { swipe.wrap.querySelector('.setrow').setPointerCapture(e.pointerId); } catch (err) { /* ignorado */ }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  swipeSet(swipe.wrap, Math.max(-SWIPE_W * 1.25, Math.min(0, swipe.base + dx)), false);
});
function endSwipe(e) {
  if (!swipe || e.pointerId !== swipe.id) return;
  const s = swipe; swipe = null;
  if (!s.on) { if (s.base) closeSwipe(); return; }
  suppressClickUntil = Date.now() + 350;
  s.wrap.classList.remove('swiping');
  const cur = new DOMMatrix(getComputedStyle(s.wrap.querySelector('.setrow')).transform).m41;
  const open = cur < -SWIPE_W / 2;
  swipeSet(s.wrap, open ? -SWIPE_W : 0, true);
  openSwipe = open ? s.wrap : null;
}
document.addEventListener('pointerup', endSwipe);
document.addEventListener('pointercancel', endSwipe);

function scrollParentOf(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement;
}
function dragMove() {
  const d = dragEx; if (!d || !d.on) return;
  const { card, parent } = d;
  card.style.transform = 'none';
  let top = card.getBoundingClientRect().top;
  const cy = d.y;
  // troca de lugar com o vizinho quando o dedo passa do meio dele
  for (const sib of [...parent.querySelectorAll(':scope > .excard')]) {
    if (sib === card) continue;
    const r = sib.getBoundingClientRect(), mid = r.top + r.height / 2;
    const after = card.compareDocumentPosition(sib) & Node.DOCUMENT_POSITION_FOLLOWING;
    if (after && cy > mid) { parent.insertBefore(card, sib.nextSibling); top = card.getBoundingClientRect().top; }
    else if (!after && cy < mid) { parent.insertBefore(card, sib); top = card.getBoundingClientRect().top; }
  }
  card.style.transform = `translateY(${d.y - d.grab - top}px) scale(1.02)`;
}
function dragLoop() {
  const d = dragEx; if (!d || !d.on) return;
  const sc = d.scroller, vh = sc === document.scrollingElement ? innerHeight : sc.getBoundingClientRect().bottom;
  const vt = sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top;
  let v = 0;
  if (d.y < vt + 90) v = -Math.min(14, (vt + 90 - d.y) / 5);
  else if (d.y > vh - 90) v = Math.min(14, (d.y - (vh - 90)) / 5);
  if (v) { sc.scrollTop += v; dragMove(); }
  d.raf = requestAnimationFrame(dragLoop);
}
function endDrag(commit) {
  const d = dragEx; if (!d) return;
  dragEx = null;
  clearTimeout(d.timer); cancelAnimationFrame(d.raf);
  if (!d.on) return;
  suppressClickUntil = Date.now() + 400;
  d.card.classList.remove('dragging'); d.card.style.transform = '';
  document.body.classList.remove('dragging-ex');
  const order = [...d.parent.querySelectorAll(':scope > .excard')].map(c => +c.dataset.e);
  const changed = order.some((v, i) => v !== i);
  if (commit && changed) {
    const o = scopeObj(d.scope);
    o.exercises = order.map(i => o.exercises[i]);
    if (d.scope === 'active') { save(); render(); } else rerenderTopModal();
  } else if (changed) { if (d.scope === 'active') render(); else rerenderTopModal(); }
}
document.addEventListener('pointerdown', e => {
  const head = e.target.closest('.excard-head');
  if (!head || e.target.closest('.icon-btn') || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const card = head.closest('.excard');
  if (!card || card.parentElement.querySelectorAll(':scope > .excard').length < 2) return;
  const d = dragEx = { card, parent: card.parentElement, scope: card.dataset.scope, id: e.pointerId, x0: e.clientX, y0: e.clientY, y: e.clientY, on: false };
  d.timer = setTimeout(() => {
    d.on = true; d.grab = d.y0 - card.getBoundingClientRect().top; d.scroller = scrollParentOf(card);
    card.classList.add('dragging'); document.body.classList.add('dragging-ex');
    if (navigator.vibrate) try { navigator.vibrate(18); } catch (err) { /* ignorado */ }
    closeSwipe(); dragMove(); d.raf = requestAnimationFrame(dragLoop);
  }, 380);
});
document.addEventListener('pointermove', e => {
  const d = dragEx; if (!d || e.pointerId !== d.id) return;
  d.y = e.clientY;
  if (!d.on) { if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 9) { clearTimeout(d.timer); dragEx = null; } return; }
  dragMove();
});
document.addEventListener('pointerup', e => { if (dragEx && e.pointerId === dragEx.id) endDrag(true); });
document.addEventListener('pointercancel', e => { if (dragEx && e.pointerId === dragEx.id) endDrag(true); });
document.addEventListener('touchmove', e => { if (dragEx && dragEx.on) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', e => { if (dragEx && (dragEx.on || e.target.closest('.excard-head'))) e.preventDefault(); });
// depois de arrastar ou deslizar, o "clique" que o navegador dispara não deve abrir nada
document.addEventListener('click', e => { if (Date.now() < suppressClickUntil) { e.stopPropagation(); e.preventDefault(); } }, true);

// relógio do treino
setInterval(() => {
  if (!S.active) return;
  const t = fmtClock(Date.now() - S.active.start);
  document.querySelectorAll('[data-elapsed]').forEach(n => { n.textContent = t; });
}, 1000);

/* ---------- armazenamento permanente ---------- */
// Pede ao navegador para não apagar os dados do app sozinho (por falta de espaço ou inatividade).
// O navegador decide sem perguntar na maioria dos casos; app instalado e uso frequente ajudam.
ui.persisted = null;
async function requestPersist() {
  try {
    if (!navigator.storage || !navigator.storage.persist) { ui.persisted = 'unsupported'; return; }
    ui.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch (e) { ui.persisted = 'unsupported'; }
  if (ui.modals.length) rerenderTopModal();
}
function persistLabel() {
  if (ui.persisted === true) return '<span class="okc">Permanente ✓</span>';
  if (ui.persisted === false) return '<span class="muted">Ainda não autorizado</span>';
  if (ui.persisted === 'unsupported') return '<span class="muted">Não suportado</span>';
  return '<span class="muted">Verificando…</span>';
}
requestPersist();

/* ---------- manter a tela ligada durante o treino ---------- */
let wakeLock = null;
async function syncWakeLock() {
  try {
    const want = !!S.active && S.settings.keepAwake && !document.hidden && 'wakeLock' in navigator;
    if (want && !wakeLock) {
      const lock = await navigator.wakeLock.request('screen');
      wakeLock = lock;
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
    } else if (!want && wakeLock) { const l = wakeLock; wakeLock = null; await l.release(); }
  } catch (e) { /* sem suporte ou negado (ex.: bateria fraca) */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncWakeLock(); });

/* ---------- botão voltar do celular ---------- */
// Voltar fecha a janela aberta, minimiza o treino ou volta ao Início, em vez de sair do app.
try {
  history.replaceState({ forja: 'base' }, '');
  history.pushState({ forja: 'guard' }, '');
  addEventListener('popstate', () => {
    if (ui.modals.length) closeModal();
    else if (S.active && ui.workoutOpen) { ui.workoutOpen = false; render(); }
    else if (ui.tab !== 'home') { ui.tab = 'home'; render(); scrollTo(0, 0); }
    else { history.back(); return; }
    history.pushState({ forja: 'guard' }, '');
  });
} catch (e) { /* histórico indisponível */ }

/* ---------- início ---------- */
if (S.active) ui.workoutOpen = true;
render();
animateIn();
document.querySelectorAll('textarea.note').forEach(autoGrow);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
