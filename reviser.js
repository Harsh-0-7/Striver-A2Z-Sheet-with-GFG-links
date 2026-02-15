import { STORE_PREFIX, makeKey } from './data.js';
import { qs } from './utils.js';
import { renderHeatmap as paintHeatmap } from './reviser-heatmap.js';
import { todayStr, parseDateStr, localNoonFromDateStr, localNoonToday, toDateStr } from './date-utils.js';

var REVISER_KEY = 'a2z:reviser';
var SCHEDULE_DAYS = [1, 7, 30];
var state = {
  root: null,
  dataIndex: {},
  store: { version: 1, items: {} }
};

function addDaysStr(dateStr, days) {
  var d = parseDateStr(dateStr || todayStr());
  if (!d) return todayStr();
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}
function diffDays(aStr, bStr) {
  var a = parseDateStr(aStr);
  var b = parseDateStr(bStr);
  if (!a || !b) return 0;
  var ms = a.getTime() - b.getTime();
  return Math.round(ms / 86400000);
}

function loadJson(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return fallback;
    var parsed = JSON.parse(raw);
    return parsed || fallback;
  } catch (e) { return fallback; }
}
function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

function loadStore() {
  var st = loadJson(REVISER_KEY, { version: 1, items: {} });
  if (!st || typeof st !== 'object') st = { version: 1, items: {} };
  if (!st.items || typeof st.items !== 'object') st.items = {};
  return st;
}


function indexData(data) {
  var index = {};
  data.forEach(function (it) {
    var key = makeKey(it);
    index[key] = it;
  });
  return index;
}

function ensureSolvedFromChecks(data) {
  var st = state.store;
  var today = todayStr();
  data.forEach(function (it) {
    var key = makeKey(it);
    var isSolved = false;
    try { isSolved = localStorage.getItem(STORE_PREFIX + key) === '1'; } catch (e) {}
    if (isSolved && !st.items[key]) {
      st.items[key] = {
        title: it.title || '(untitled)',
        step: String(it.step || ''),
        sub: String(it.substep || ''),
        solvedAt: today,
        lastReviewedAt: today,
        stage: 0
      };
    }
  });
}

function upsertItem(meta) {
  var st = state.store;
  var today = todayStr();
  if (!st.items[meta.key]) {
    st.items[meta.key] = {
      title: meta.title || '(untitled)',
      step: String(meta.step || ''),
      sub: String(meta.sub || ''),
      solvedAt: today,
      lastReviewedAt: today,
      stage: 0
    };
  } else if (!st.items[meta.key].solvedAt) {
    st.items[meta.key].solvedAt = today;
    st.items[meta.key].lastReviewedAt = today;
  }
}

function removeItem(key) {
  var st = state.store;
  if (st.items[key]) delete st.items[key];
}

function computeDueList() {
  var st = state.store;
  var today = todayStr();
  var due = [];
  var upcoming = [];
  Object.keys(st.items).forEach(function (key) {
    var it = st.items[key];
    var stage = it.stage || 0;
    if (stage >= SCHEDULE_DAYS.length) return;
    var base = it.lastReviewedAt || it.solvedAt || today;
    var nextDue = addDaysStr(base, SCHEDULE_DAYS[stage]);
    var daysFromToday = diffDays(nextDue, today);
    var entry = {
      key: key,
      title: it.title || (state.dataIndex[key] && state.dataIndex[key].title) || '(untitled)',
      nextDue: nextDue,
      stage: stage
    };
    if (daysFromToday <= 0) due.push(entry);
    else if (daysFromToday <= 7) upcoming.push(entry);
  });
  due.sort(function (a, b) { return a.nextDue.localeCompare(b.nextDue); });
  upcoming.sort(function (a, b) { return a.nextDue.localeCompare(b.nextDue); });
  return { due: due, upcoming: upcoming };
}

function recordReview(key) {
  var st = state.store;
  var today = todayStr();
  var it = st.items[key];
  if (!it) return;
  it.lastReviewedAt = today;
  it.stage = (it.stage || 0) + 1;
}

function computeHeatmap() {
  var st = state.store;
  var map = {};
  Object.keys(st.items).forEach(function (key) {
    var d = st.items[key].solvedAt;
    if (!d) return;
    if (!map[d]) map[d] = 0;
    map[d] += 1;
  });
  return map;
}

function renderHeatmap() {
  var wrap = qs('#reviser-heatmap', state.root);
  if (!wrap) return;
  var countMap = computeHeatmap();
  var today = todayStr();
  var countEl = qs('[data-heatmap-today]', state.root);
  if (countEl) countEl.textContent = String(countMap[today] || 0);

  var dataArr = Object.keys(countMap).map(function (d) {
    return { date: localNoonFromDateStr(d), value: countMap[d] };
  });

  var now = localNoonToday();
  paintHeatmap(wrap, now, dataArr);
}

function renderDueLists() {
  var lists = computeDueList();
  var dueEl = qs('.reviser-due', state.root);
  var upEl = qs('.reviser-upcoming', state.root);
  function openProblem(key) {
    var meta = state.dataIndex[key];
    if (meta) {
      var step = String(meta.step || '');
      var sub = String(meta.substep || '');
      var stepDetails = document.querySelector('#content > details[data-step="' + step + '"]');
      if (stepDetails && !stepDetails.open) stepDetails.open = true;
      var subDetails = document.querySelector('#content > details[data-step="' + step + '"] > details[data-step="' + step + '"][data-substep="' + sub + '"]');
      if (subDetails && !subDetails.open) subDetails.open = true;
      if (subDetails) {
        // Trigger lazy render on substep if needed
        var toggleEvent = new Event('toggle');
        subDetails.dispatchEvent(toggleEvent);
      }
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var li = document.querySelector('li[data-key="' + key + '"]');
        if (!li) return;
        li.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var row = li.querySelector('.item-row');
        if (row) {
          row.classList.remove('is-highlight');
          // Force reflow to restart animation
          void row.offsetWidth;
          row.classList.add('is-highlight');
          setTimeout(function () { row.classList.remove('is-highlight'); }, 1600);
        }
      });
    });
  }
  function renderList(el, items, emptyText) {
    if (!el) return;
    el.innerHTML = '';
    if (!items.length) {
      var empty = document.createElement('li');
      empty.className = 'reviser-empty';
      empty.textContent = emptyText;
      el.appendChild(empty);
      return;
    }
    items.forEach(function (it) {
      var li = document.createElement('li');
      li.className = 'reviser-item';
      var title = document.createElement('div');
      title.className = 'reviser-item-title';
      title.textContent = it.title;
      var meta = document.createElement('div');
      meta.className = 'reviser-item-meta';
      meta.textContent = 'Review ' + (it.stage + 1) + '/' + SCHEDULE_DAYS.length + ' • due ' + it.nextDue;
      var actions = document.createElement('div');
      actions.className = 'reviser-item-actions';
      var openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'reviser-btn ghost';
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', function () { openProblem(it.key); });
      actions.appendChild(openBtn);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'reviser-btn';
      btn.textContent = 'Mark reviewed';
      btn.addEventListener('click', function () {
        recordReview(it.key);
        saveJson(REVISER_KEY, state.store);
        renderAll();
      });
      actions.appendChild(btn);
      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(actions);
      el.appendChild(li);
    });
  }
  renderList(dueEl, lists.due, 'Nothing due today.');
  renderList(upEl, lists.upcoming, 'No upcoming reviews in the next 7 days.');
}

function renderAll() {
  renderHeatmap();
  renderDueLists();
}

export function initReviser(rootEl, data) {
  if (!rootEl) return;
  state.root = rootEl;
  state.dataIndex = indexData(data);
  state.store = loadStore();
  ensureSolvedFromChecks(data);
  saveJson(REVISER_KEY, state.store);
  renderAll();
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () { renderHeatmap(); });
    var wrap = qs('#reviser-heatmap', state.root);
    if (wrap) ro.observe(wrap);
  } else {
    window.addEventListener('resize', function () { renderHeatmap(); }, { passive: true });
  }
}

export function onProblemToggle(meta, checked) {
  if (!meta || !meta.key) return;
  if (checked) upsertItem(meta);
  else removeItem(meta.key);
  saveJson(REVISER_KEY, state.store);
  renderAll();
}
