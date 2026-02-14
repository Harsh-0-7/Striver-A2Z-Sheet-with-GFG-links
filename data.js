export const STORE_PREFIX = 'a2z:checked:';

export async function loadData() {
  // Prefer fetching the external, minified payload for faster first paint on Pages/CDNs
  try {
    var res = await fetch('./data.min.json', { credentials: 'omit', cache: 'default' });
    if (res && res.ok) {
      var json = await res.json();
      if (Array.isArray(json)) return json;
    }
  } catch (e) {
    // Network unavailable (e.g., file://) or fetch failed — fall through to inline/window fallback
  }
  // Fallbacks for local/offline usage
  var inline = document.getElementById('a2z-json');
  if (inline && inline.textContent) {
    try { return JSON.parse(inline.textContent); } catch (e) { console.error('Invalid inline JSON', e); }
  }
  if (Array.isArray(window.data)) return window.data;
  return [];
}

export function groupByStep(data) {
  var grouped = {};
  data.forEach(function (it) {
    var stepKey = String(it.step != null ? it.step : 'Unknown');
    var subKey = String(it.substep != null ? it.substep : 'Unknown');
    if (!grouped[stepKey]) grouped[stepKey] = { title: it.stepTitle || 'Step ' + stepKey, subs: {} };
    if (!grouped[stepKey].subs[subKey]) grouped[stepKey].subs[subKey] = { title: it.substepTitle || ('Step ' + stepKey + '.' + subKey), items: [] };
    grouped[stepKey].subs[subKey].items.push(it);
  });
  return grouped;
}

export function makeKey(it) {
  return it.checkboxId
    ? String(it.checkboxId)
    : 's' + (it.step || '') + '-' + (it.substep || '') + '-' + (it.title || '').toLowerCase();
}

export function preloadCounts(grouped) {
  var counts = { steps: {}, subs: {} };
  Object.keys(grouped).forEach(function (stepKey) {
    var step = grouped[stepKey];
    var stepCount = (counts.steps[stepKey] = { done: 0, total: 0 });
    Object.keys(step.subs).forEach(function (subKey) {
      var sub = step.subs[subKey];
      var subCount = (counts.subs[stepKey + '.' + subKey] = { done: 0, total: 0 });
      sub.items.forEach(function (it) {
        subCount.total++;
        stepCount.total++;
        var key = makeKey(it);
        try {
          if (localStorage.getItem(STORE_PREFIX + key) === '1') {
            subCount.done++;
            stepCount.done++;
          }
        } catch (e) {}
      });
    });
  });
  return counts;
}
