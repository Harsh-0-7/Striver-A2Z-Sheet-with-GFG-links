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
        '"></span>';
      stepDetails.appendChild(stepSummary);

      Object.keys(stepObj.subs).forEach(function (subKey) {
        var subObj = stepObj.subs[subKey];
        var subDetails = document.createElement("details");
        subDetails.open = false;
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
          '"></span>';
        subDetails.appendChild(subSummary);

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

      container.appendChild(stepDetails);
    });
  }

  function updateCountEl(scope, step, sub) {
    if (scope === "step") {
      var el = document.querySelector(
        'summary .counts[data-scope="step"][data-step="' + step + '"]'
      );
      var c = gState.counts.steps[step] || { done: 0, total: 0 };
      if (el) el.textContent = "(" + c.done + "/" + c.total + ")";
    } else if (scope === "sub") {
      var el2 = document.querySelector(
        'summary .counts[data-scope="sub"][data-step="' +
          step +
          '"][data-substep="' +
          sub +
          '"]'
      );
      var c2 = gState.counts.subs[step + "." + sub] || { done: 0, total: 0 };
      if (el2) el2.textContent = "(" + c2.done + "/" + c2.total + ")";
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

  var content = document.getElementById("content");
  var DATA = loadData();
  if (Array.isArray(DATA) && DATA.length) {
    renderList(content, DATA);
    renderAllCounts();
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
      }
    });
  } else {
    content.textContent = "No data found.";
  }
})();
