import { STORE_PREFIX, loadData, preloadCounts, groupByStep } from './data.js';
import { renderList } from './render.js';
import { updateCountEl, renderAllCounts, updateProgressBars } from './progress.js';

var gState = { grouped: null, counts: { steps: {}, subs: {} } };
var THEME_KEY = 'a2z:theme';

function ensureTitleCountEl() {
  try {
    var h1 = document.querySelector('h1');
    if (!h1) return null;
    var span = h1.querySelector('.total-count');
    if (!span) {
      span = document.createElement('span');
      span.className = 'total-count';
      h1.appendChild(document.createTextNode(' '));
      h1.appendChild(span);
    }
    return span;
  } catch (e) { return null; }
}

function setGlobalTitleCount(done, total) {
  var el = ensureTitleCountEl();
  if (!el) return;
  el.textContent = '(' + String(done) + '/' + String(total) + ')';
}

function refreshGlobalTitleCountFromState() {
  if (!gState || !gState.counts || !gState.counts.steps) return;
  var aggDone = 0, aggTotal = 0;
  Object.keys(gState.counts.steps).forEach(function (k) {
    var c = gState.counts.steps[k] || { done: 0, total: 0 };
    aggDone += c.done || 0;
    aggTotal += c.total || 0;
  });
  setGlobalTitleCount(aggDone, aggTotal);
}

function setupStickyOffset() {
  var last = -1;
  function updateHeaderOffset() {
    try {
      var header = document.querySelector('.site-header');
      var h = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
      if (h !== last) {
        document.documentElement.style.setProperty('--header-h', h + 'px');
        last = h;
      }
    } catch (e) {}
  }
  var ro = window.ResizeObserver ? new ResizeObserver(updateHeaderOffset) : null;
  if (ro) {
    var headerEl = document.querySelector('.site-header');
    if (headerEl) ro.observe(headerEl);
  }
  updateHeaderOffset();
  window.addEventListener('resize', updateHeaderOffset, { passive: true });
  window.addEventListener('load', updateHeaderOffset, { once: true });
  document.addEventListener('toggle', function () { requestAnimationFrame(updateHeaderOffset); }, true);
}

function setupFilters(content) {
  var nav = document.querySelector('.filters');
  if (!nav) return;
  var buttons = Array.prototype.slice.call(nav.querySelectorAll('.filter-btn'));
  var current = 'all';
  function setActive(btn) {
    buttons.forEach(function (b) {
      var on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function applyFilter(mode) {
    current = mode;
    var subDetails = content.querySelectorAll('#content > details > details');
    var stepDetails = content.querySelectorAll('#content > details');
    var items = content.querySelectorAll('li');

    if (mode === 'all') {
      items.forEach(function (li) { li.style.display = ''; });
      subDetails.forEach(function (d) { d.style.display = ''; });
      stepDetails.forEach(function (sd) { sd.style.display = ''; });
      return;
    }

    items.forEach(function (li) {
      var cb = li.querySelector('.title-cell input[type="checkbox"]');
      var checked = !!(cb && cb.checked);
      var show = true;
      if (mode === 'unsolved') show = !checked;
      else if (mode === 'solved') show = checked;
      li.style.display = show ? '' : 'none';
    });

    subDetails.forEach(function (d) {
      var s = String(d.dataset.step || '');
      var sub = String(d.dataset.substep || '');
      var c = gState.counts.subs[s + '.' + sub] || { done: 0, total: 0 };
      var show = true;
      if (mode === 'unsolved') show = c.done < c.total;
      else if (mode === 'solved') show = c.done > 0;
      d.style.display = show ? '' : 'none';
    });

    stepDetails.forEach(function (sd) {
      var step = String(sd.dataset.step || '');
      var cStep = gState.counts.steps[step] || { done: 0, total: 0 };
      var show = true;
      if (mode === 'unsolved') show = cStep.done < cStep.total;
      else if (mode === 'solved') show = cStep.done > 0;
      sd.style.display = show ? '' : 'none';
    });
  }
  nav.addEventListener('click', function (e) {
    var btn = e.target.closest('.filter-btn');
    if (!btn) return;
    setActive(btn);
    applyFilter(btn.dataset.filter);
  });
  content.addEventListener('change', function (e) {
    if (e.target && e.target.matches('.title-cell input[type="checkbox"]')) {
      applyFilter(current);
    }
  });
  content.addEventListener('toggle', function () { applyFilter(current); });
  applyFilter(current);
}

function showLoading() {
  var content = document.getElementById('content');
  if (content) content.setAttribute('aria-busy', 'true');
  var wrap = document.createElement('div');
  wrap.className = 'loading';
  wrap.textContent = 'Loading problems…';
  content.appendChild(wrap);
}

function hideLoading() {
  var n = document.querySelector('#content .loading');
  if (n) n.remove();
  var content = document.getElementById('content');
  if (content) content.removeAttribute('aria-busy');
}

async function main() {
  var content = document.getElementById('content');
  showLoading();
  var DATA = await loadData();
  hideLoading();
  if (Array.isArray(DATA) && DATA.length) {
    // Preload counts before render for progress and filters
    gState.counts = preloadCounts(groupByStep(DATA));
    // Render
    renderList(content, DATA, gState);
    // After render, recompute counts in case structure changed
    gState.counts = preloadCounts(gState.grouped);
    // Initial UI updates
    renderAllCounts(gState);
    refreshGlobalTitleCountFromState();
    updateProgressBars(gState);

    // Sticky offset
    setupStickyOffset();

    // Checkbox change: update counts, storage, progress
    content.addEventListener('change', function (e) {
      if (e.target && e.target.matches('.title-cell input[type="checkbox"]')) {
        var li = e.target.closest('li');
        if (!li) return;
        var step = String(li.dataset.step);
        var sub = String(li.dataset.sub);
        var stepKey = step;
        var subKey = step + '.' + sub;
        var delta = e.target.checked ? 1 : -1;
        if (gState.counts.steps[stepKey]) gState.counts.steps[stepKey].done += delta;
        if (gState.counts.subs[subKey]) gState.counts.subs[subKey].done += delta;
        var key = e.target.dataset.key;
        try { if (e.target.checked) localStorage.setItem(STORE_PREFIX + key, '1'); else localStorage.removeItem(STORE_PREFIX + key); } catch (err) {}
        updateCountEl(gState, 'step', step);
        updateCountEl(gState, 'sub', step, sub);
        refreshGlobalTitleCountFromState();
        updateProgressBars(gState);
      }
    });

    // Delegated accordion: ensure one open step and one open substep per step
    content.addEventListener('toggle', function (e) {
      var el = e.target;
      if (!el || el.tagName !== 'DETAILS' || !el.open) return;
      var parent = el.parentElement;
      if (parent === content) {
        for (var i = 0; i < parent.children.length; i++) {
          var sib = parent.children[i];
          if (sib !== el && sib.tagName === 'DETAILS' && sib.open) sib.open = false;
        }
      }
      if (parent && parent.tagName === 'DETAILS' && parent.parentElement === content) {
        for (var j = 0; j < parent.children.length; j++) {
          var child = parent.children[j];
          if (child !== el && child.tagName === 'DETAILS' && child.open) child.open = false;
        }
      }
    });

    // Filters
    setupFilters(content);

    // Theme toggle
    setupTheme();
  } else {
    content.textContent = 'No data found.';
  }
}

document.addEventListener('DOMContentLoaded', main);

function setupTheme() {
  var btn = document.getElementById('theme-toggle');
  function apply(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (btn) { btn.textContent = '☀️ Light'; btn.setAttribute('aria-pressed', 'true'); }
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (btn) { btn.textContent = '🌙 Dark'; btn.setAttribute('aria-pressed', 'false'); }
    }
  }
  // Initial: use saved theme, else system preference
  var saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  if (saved === 'dark' || saved === 'light') apply(saved);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) apply('dark');
  else apply('light');

  if (btn) {
    btn.addEventListener('click', function () {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      var next = isDark ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  }
}
