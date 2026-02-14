(function () {
  var STORE_PREFIX = "a2z:checked:";

  // Prefer inline JSON (<script type="application/json" id="a2z-json">) if present
  function loadData() {
    var inline = document.getElementById('a2z-json');
    if (inline && inline.textContent) {
      try { return JSON.parse(inline.textContent); } catch (e) { console.error('Invalid inline JSON', e); }
    }
    if (Array.isArray(window.data)) return window.data;
    return [];
  }

  // Global UI state for performance
  var gState = {
    grouped: null, // { [step]: { title, subs: { [sub]: { title, items: [...] } } } }
    counts: { steps: {}, subs: {} },
  };

  function linkEl(href, label) {
    if (!href) return null;
    var a = document.createElement("a");
    a.href = String(href);
    a.target = "_blank";
    a.rel = "noopener";
    if (label) {
      a.textContent = label;
    } else {
      try {
        var u = new URL(href);
        a.textContent = u.hostname + u.pathname;
      } catch (e) {
        a.textContent = String(href);
      }
    }
    return a;
  }

  function groupByStep(data) {
    var grouped = {};
    data.forEach(function (it) {
      var stepKey = String(it.step != null ? it.step : "Unknown");
      var subKey = String(it.substep != null ? it.substep : "Unknown");
      if (!grouped[stepKey]) grouped[stepKey] = { title: it.stepTitle || "Step " + stepKey, subs: {} };
      if (!grouped[stepKey].subs[subKey]) grouped[stepKey].subs[subKey] = { title: it.substepTitle || ("Step " + stepKey + "." + subKey), items: [] };
      grouped[stepKey].subs[subKey].items.push(it);
    });
    return grouped;
  }

  function makeKey(it) {
    return it.checkboxId
      ? String(it.checkboxId)
      : "s" + (it.step || "") + "-" + (it.substep || "") + "-" + (it.title || "").toLowerCase();
  }

  function preloadCounts(grouped) {
    var counts = { steps: {}, subs: {} };
    Object.keys(grouped).forEach(function (stepKey) {
      var step = grouped[stepKey];
      var stepCount = (counts.steps[stepKey] = { done: 0, total: 0 });
      Object.keys(step.subs).forEach(function (subKey) {
        var sub = step.subs[subKey];
        var subCount = (counts.subs[stepKey + "." + subKey] = { done: 0, total: 0 });
        sub.items.forEach(function (it) {
          subCount.total++;
          stepCount.total++;
          var key = makeKey(it);
          try {
            if (localStorage.getItem(STORE_PREFIX + key) === "1") {
              subCount.done++;
              stepCount.done++;
            }
          } catch (e) {}
        });
      });
    });
    return counts;
  }

  function renderList(container, data) {
    gState.grouped = groupByStep(data);
    gState.counts = preloadCounts(gState.grouped);

    Object.keys(gState.grouped).forEach(function (stepKey) {
      var stepObj = gState.grouped[stepKey];
      var stepDetails = document.createElement("details");
      stepDetails.open = false;
      var stepSummary = document.createElement("summary");
      stepSummary.innerHTML =
        '<span class="badge">Step ' +
        stepKey +
        "</span> " +
        (stepObj.title || "") +
        ' <span class="counts" data-scope="step" data-step="' +
        stepKey +
        '"></span>' +
        // Step progress bar moved inside summary at the rightmost
        ' <div class="progress step" data-step="' + stepKey + '"><div class="bar" style="width:0%"></div></div>';
      stepDetails.appendChild(stepSummary);

      // Note: Step progress is now inside the summary to sit at the far right

      // Accordion: when a step opens, close other steps
      stepDetails.addEventListener("toggle", function () {
        if (!stepDetails.open) return;
        var parent = content;
        for (var i = 0; i < parent.children.length; i++) {
          var sib = parent.children[i];
          if (sib !== stepDetails && sib.tagName === 'DETAILS' && sib.open) sib.open = false;
        }
      });

      Object.keys(stepObj.subs).forEach(function (subKey) {
        var subObj = stepObj.subs[subKey];
        var subDetails = document.createElement("details");
        subDetails.open = false;
        subDetails.dataset.step = String(stepKey);
        subDetails.dataset.substep = String(subKey);
        var subSummary = document.createElement("summary");
        subSummary.innerHTML =
          '<span class="badge small">' +
          stepKey +
          "." +
          subKey +
          "</span> " +
          (subObj.title || "") +
          ' <span class="counts" data-scope="sub" data-step="' +
          stepKey +
          '" data-substep="' +
          subKey +
          '"></span>' +
          // Substep progress bar moved inside summary at the rightmost
          ' <div class="progress sub" data-step="' + stepKey + '" data-substep="' + subKey + '"><div class="bar" style="width:0%"></div></div>';
        subDetails.appendChild(subSummary);

        // Note: Substep progress is now inside the summary to sit at the far right

        // Accordion: when a substep opens, close sibling substeps under same step
        subDetails.addEventListener("toggle", function () {
          if (!subDetails.open) return;
          for (var j = 0; j < stepDetails.children.length; j++) {
            var child = stepDetails.children[j];
            if (child !== subDetails && child.tagName === 'DETAILS' && child.open) child.open = false;
          }
        });

        // Lazy-render items on first expand
        subDetails.addEventListener(
          "toggle",
          function () {
            if (subDetails.open && !subDetails._rendered) {
              var frag = document.createDocumentFragment();
              var ulItems = document.createElement("ul");
              subObj.items.forEach(function (it) {
                var li = document.createElement("li");
                li.dataset.step = stepKey;
                li.dataset.sub = subKey;
                var row = document.createElement("div");
                row.className = "item-row";

                var titleCell = document.createElement("div");
                titleCell.className = "title-cell";
                var cb = document.createElement("input");
                cb.type = "checkbox";
                var key = makeKey(it);
                cb.dataset.key = key;
                try {
                  cb.checked = localStorage.getItem(STORE_PREFIX + key) === "1";
                } catch (e) {}
                titleCell.appendChild(cb);
                var title = it.title || "(untitled)";
                if (it.article) {
                  var a = linkEl(it.article, title);
                  a.className = "item-title";
                  titleCell.appendChild(a);
                } else {
                  var dv = document.createElement("div");
                  dv.className = "item-title";
                  dv.textContent = title;
                  titleCell.appendChild(dv);
                }
                row.appendChild(titleCell);

                function linkCol(url, label) {
                  var col = document.createElement("div");
                  col.className = "link-col";
                  if (url) {
                    var wrapper = document.createElement("div");
                    wrapper.className = "links";
                    var el = linkEl(url, label);
                    wrapper.appendChild(el);
                    col.appendChild(wrapper);
                  }
                  return col;
                }

                row.appendChild(linkCol(it.gfg, "GfG"));
                row.appendChild(linkCol(it.leetcode, "LeetCode"));
                row.appendChild(linkCol(it.solution, "Solution"));
                row.appendChild(linkCol(it.video, "Video"));

                li.appendChild(row);
                ulItems.appendChild(li);
              });
              frag.appendChild(ulItems);
              subDetails.appendChild(frag);
              subDetails._rendered = true;
            }
          },
          { once: true }
        );
        stepDetails.appendChild(subDetails);
      });

      stepDetails.dataset.step = String(stepKey);
      container.appendChild(stepDetails);
    });
  }

  function updateCountEl(scope, step, sub) {
    if (scope === "step") {
      var el = document.querySelector(
        'summary .counts[data-scope="step"][data-step="' + step + '"]'
      );
      var c = gState.counts.steps[step] || { done: 0, total: 0 };
      if (el) {
        el.textContent = "(" + c.done + "/" + c.total + ")";
        // Apply visual state classes
        var pctVal = c.total ? (c.done / c.total) : 0;
        el.classList.remove('is-neutral','is-low','is-mid','is-high','is-done');
        if (c.total === 0 || pctVal === 0) el.classList.add('is-neutral');
        else if (pctVal > 0 && pctVal <= 0.33) el.classList.add('is-low');
        else if (pctVal > 0.33 && pctVal <= 0.66) el.classList.add('is-mid');
        else if (pctVal > 0.66 && pctVal < 1) el.classList.add('is-high');
        else if (pctVal === 1) el.classList.add('is-done');
      }
    } else if (scope === "sub") {
      var el2 = document.querySelector(
        'summary .counts[data-scope="sub"][data-step="' +
          step +
          '"][data-substep="' +
          sub +
          '"]'
      );
      var c2 = gState.counts.subs[step + "." + sub] || { done: 0, total: 0 };
      if (el2) {
        el2.textContent = "(" + c2.done + "/" + c2.total + ")";
        var pctVal2 = c2.total ? (c2.done / c2.total) : 0;
        el2.classList.remove('is-neutral','is-low','is-mid','is-high','is-done');
        if (c2.total === 0 || pctVal2 === 0) el2.classList.add('is-neutral');
        else if (pctVal2 > 0 && pctVal2 <= 0.33) el2.classList.add('is-low');
        else if (pctVal2 > 0.33 && pctVal2 <= 0.66) el2.classList.add('is-mid');
        else if (pctVal2 > 0.66 && pctVal2 < 1) el2.classList.add('is-high');
        else if (pctVal2 === 1) el2.classList.add('is-done');
      }
    }
  }

  function renderAllCounts() {
    Object.keys(gState.counts.steps).forEach(function (step) {
      updateCountEl("step", step);
    });
    Object.keys(gState.counts.subs).forEach(function (k) {
      var parts = k.split(".");
      updateCountEl("sub", parts[0], parts[1]);
    });
  }

  function pct(done, total) { return total ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0; }

  function updateProgressBars() {
    // Global
    (function () {
      var aggDone = 0, aggTotal = 0;
      Object.keys(gState.counts.steps).forEach(function (k) {
        var c = gState.counts.steps[k];
        aggDone += c.done; aggTotal += c.total;
      });
      var elBar = document.querySelector('.global-progress .bar');
      var elWrap = document.querySelector('.global-progress .progress');
      var elText = document.querySelector('.global-progress .progress-text');
      if (elBar) elBar.style.width = pct(aggDone, aggTotal) + '%';
      if (elWrap) {
        var p = aggTotal ? (aggDone / aggTotal) : 0;
        elWrap.classList.remove('is-neutral','is-low','is-mid','is-high','is-done');
        if (aggTotal === 0 || p === 0) elWrap.classList.add('is-neutral');
        else if (p > 0 && p <= 0.33) elWrap.classList.add('is-low');
        else if (p > 0.33 && p <= 0.66) elWrap.classList.add('is-mid');
        else if (p > 0.66 && p < 1) elWrap.classList.add('is-high');
        else if (p === 1) elWrap.classList.add('is-done');
      }
      if (elText) elText.textContent = aggDone + ' solved of ' + aggTotal + ' (' + pct(aggDone, aggTotal) + '%)';
    })();

    // Steps
    Object.keys(gState.counts.steps).forEach(function (step) {
      var c = gState.counts.steps[step];
      var wrap = document.querySelector('.progress.step[data-step="' + step + '"]');
      var el = wrap && wrap.querySelector('.bar');
      if (el) el.style.width = pct(c.done, c.total) + '%';
      if (wrap) {
        var p2 = c.total ? (c.done / c.total) : 0;
        wrap.classList.remove('is-neutral','is-low','is-mid','is-high','is-done');
        if (c.total === 0 || p2 === 0) wrap.classList.add('is-neutral');
        else if (p2 > 0 && p2 <= 0.33) wrap.classList.add('is-low');
        else if (p2 > 0.33 && p2 <= 0.66) wrap.classList.add('is-mid');
        else if (p2 > 0.66 && p2 < 1) wrap.classList.add('is-high');
        else if (p2 === 1) wrap.classList.add('is-done');
      }
    });
    // Substeps
    Object.keys(gState.counts.subs).forEach(function (k) {
      var c2 = gState.counts.subs[k];
      var parts = k.split('.');
      var wrap2 = document.querySelector('.progress.sub[data-step="' + parts[0] + '"][data-substep="' + parts[1] + '"]');
      var el2 = wrap2 && wrap2.querySelector('.bar');
      if (el2) el2.style.width = pct(c2.done, c2.total) + '%';
      if (wrap2) {
        var p3 = c2.total ? (c2.done / c2.total) : 0;
        wrap2.classList.remove('is-neutral','is-low','is-mid','is-high','is-done');
        if (c2.total === 0 || p3 === 0) wrap2.classList.add('is-neutral');
        else if (p3 > 0 && p3 <= 0.33) wrap2.classList.add('is-low');
        else if (p3 > 0.33 && p3 <= 0.66) wrap2.classList.add('is-mid');
        else if (p3 > 0.66 && p3 < 1) wrap2.classList.add('is-high');
        else if (p3 === 1) wrap2.classList.add('is-done');
      }
    });
  }

  // Global title count helpers
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

  var content = document.getElementById("content");
  var DATA = loadData();
  if (Array.isArray(DATA) && DATA.length) {
    renderList(content, DATA);
    renderAllCounts();
    refreshGlobalTitleCountFromState();
    updateProgressBars();

    // Keep sticky step headers positioned below the sticky site header
    (function setupStickyOffset() {
      function updateHeaderOffset() {
        try {
          var header = document.querySelector('.site-header');
          var h = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
          document.documentElement.style.setProperty('--header-h', h + 'px');
        } catch (e) {}
      }
      updateHeaderOffset();
      window.addEventListener('resize', updateHeaderOffset);
      // In case fonts/images affect layout after load
      window.addEventListener('load', updateHeaderOffset);
      // When filters toggle visibility or details open/close, header height can shift slightly
      document.addEventListener('toggle', function () { updateHeaderOffset(); }, true);
    })();
    // Incremental updates without DOM rescans
    content.addEventListener("change", function (e) {
      if (e.target && e.target.matches('.title-cell input[type="checkbox"]')) {
        var li = e.target.closest("li");
        if (!li) return;
        var step = String(li.dataset.step);
        var sub = String(li.dataset.sub);
        var stepKey = step;
        var subKey = step + "." + sub;
        var delta = e.target.checked ? 1 : -1;
        if (gState.counts.steps[stepKey]) gState.counts.steps[stepKey].done += delta;
        if (gState.counts.subs[subKey]) gState.counts.subs[subKey].done += delta;
        // Persist storage
        var key = e.target.dataset.key;
        try {
          if (e.target.checked)
            localStorage.setItem(STORE_PREFIX + key, "1");
          else localStorage.removeItem(STORE_PREFIX + key);
        } catch (err) {}
        // Update affected counters only
        updateCountEl("step", step);
        updateCountEl("sub", step, sub);
        refreshGlobalTitleCountFromState();
        updateProgressBars();
      }
    });
    // Accordion behavior: only one step open, and only one substep per step
    content.addEventListener("toggle", function (e) {
      var el = e.target;
      if (!el || el.tagName !== 'DETAILS' || !el.open) return; // Only when a <details> is opened
      var parent = el.parentElement;
      // If this is a top-level step (parent is #content), close other top-level details
      if (parent === content) {
        for (var i = 0; i < parent.children.length; i++) {
          var sib = parent.children[i];
          if (sib !== el && sib.tagName === 'DETAILS' && sib.open) sib.open = false;
        }
      }
      // If this is a substep (parent is a step <details>), close sibling substeps under same step
      if (parent && parent.tagName === 'DETAILS' && parent.parentElement === content) {
        for (var j = 0; j < parent.children.length; j++) {
          var child = parent.children[j];
          if (child !== el && child.tagName === 'DETAILS' && child.open) child.open = false;
        }
      }
    });

    // Quick filters (All, Unsolved, Solved)
    (function setupFilters() {
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
          // Reset everything to visible
          items.forEach(function (li) { li.style.display = ''; });
          subDetails.forEach(function (d) { d.style.display = ''; });
          stepDetails.forEach(function (sd) { sd.style.display = ''; });
          return;
        }

        // Hide/show individual items that are already rendered
        items.forEach(function (li) {
          var cb = li.querySelector('.title-cell input[type="checkbox"]');
          var checked = !!(cb && cb.checked);
          var show = true;
          if (mode === 'unsolved') show = !checked;
          else if (mode === 'solved') show = checked;
          li.style.display = show ? '' : 'none';
        });

        // Substeps: show if they match the filter based on counts
        subDetails.forEach(function (d) {
          var s = String(d.dataset.step || '');
          var sub = String(d.dataset.substep || '');
          var c = gState.counts.subs[s + '.' + sub] || { done: 0, total: 0 };
          var show = true;
          if (mode === 'unsolved') show = c.done < c.total;
          else if (mode === 'solved') show = c.done > 0;
          d.style.display = show ? '' : 'none';
        });

        // Steps: show if any of their substeps match the filter
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
      // Re-apply filter when checkbox state changes
      content.addEventListener('change', function (e) {
        if (e.target && e.target.matches('.title-cell input[type="checkbox"]')) {
          applyFilter(current);
        }
      });
      // Re-apply filter when sections are toggled (lazy render)
      content.addEventListener('toggle', function () { applyFilter(current); });
      // Initialize to current state
      applyFilter(current);
    })();
  } else {
    content.textContent = "No data found.";
  }
})();
