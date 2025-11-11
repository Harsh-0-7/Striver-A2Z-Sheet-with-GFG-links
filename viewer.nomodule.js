(function () {
  var STORE_PREFIX = 'a2z:checked:';

  function linkEl(href, label) {
    if (!href) return null;
    var a = document.createElement('a');
    a.href = String(href);
    a.target = '_blank';
    a.rel = 'noopener';
    if (label) {
      a.textContent = label;
    } else {
      try { var u = new URL(href); a.textContent = u.hostname + u.pathname; }
      catch (e) { a.textContent = String(href); }
    }
    return a;
  }

  function groupByStep(data) {
    var map = new Map();
    data.forEach(function (it) {
      var step = it.step != null ? it.step : 'Unknown';
      var sub = it.substep != null ? it.substep : 'Unknown';
      var stepKey = String(step);
      var subKey = String(sub);
      if (!map.has(stepKey)) map.set(stepKey, { title: it.stepTitle || ('Step ' + stepKey), sub: new Map() });
      var stepObj = map.get(stepKey);
      if (!stepObj.sub.has(subKey)) stepObj.sub.set(subKey, { title: it.substepTitle || ('Step ' + stepKey + '.' + subKey), items: [] });
      stepObj.sub.get(subKey).items.push(it);
    });
    return map;
  }

  function renderList(container, data) {
    var grouped = groupByStep(data);

    grouped.forEach(function (stepObj, stepKey) {
      var stepDetails = document.createElement('details');
      stepDetails.open = false;
      var stepSummary = document.createElement('summary');
      stepSummary.innerHTML = '<span class="badge">Step ' + stepKey + '</span> ' + (stepObj.title || '') + ' <span class="counts" data-scope="step" data-step="' + stepKey + '"></span>';
      stepDetails.appendChild(stepSummary);

      stepObj.sub.forEach(function (subObj, subKey) {
        var subDetails = document.createElement('details');
        subDetails.open = false;
        var subSummary = document.createElement('summary');
        subSummary.innerHTML = '<span class="badge small">' + stepKey + '.' + subKey + '</span> ' + (subObj.title || '') + ' <span class="counts" data-scope="sub" data-step="' + stepKey + '" data-substep="' + subKey + '"></span>';
        subDetails.appendChild(subSummary);

        var ulItems = document.createElement('ul');
        subObj.items.forEach(function (it) {
          var li = document.createElement('li');
          var row = document.createElement('div');
          row.className = 'item-row';

          // Title cell with checkbox + title/link
          var titleCell = document.createElement('div');
          titleCell.className = 'title-cell';
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          var key = (it.checkboxId) ? String(it.checkboxId) : ('s' + (it.step||'') + '-' + (it.substep||'') + '-' + (it.title||'').toLowerCase());
          cb.dataset.key = key;
          try { cb.checked = localStorage.getItem(STORE_PREFIX + key) === '1'; } catch (e) {}
          cb.addEventListener('change', function (e) {
            try {
              if (e.target.checked) localStorage.setItem(STORE_PREFIX + key, '1');
              else localStorage.removeItem(STORE_PREFIX + key);
            } catch (err) {}
          });
          titleCell.appendChild(cb);

          var title = it.title || '(untitled)';
          if (it.article) {
            var a = linkEl(it.article, title);
            a.className = 'item-title';
            titleCell.appendChild(a);
          } else {
            var dv = document.createElement('div');
            dv.className = 'item-title';
            dv.textContent = title;
            titleCell.appendChild(dv);
          }
          row.appendChild(titleCell);

          // Helper to create a link column
          function linkCol(url, label) {
            var col = document.createElement('div');
            col.className = 'link-col';
            if (url) {
              var wrapper = document.createElement('div');
              wrapper.className = 'links';
              var el = linkEl(url, label);
              wrapper.appendChild(el);
              col.appendChild(wrapper);
            }
            return col;
          }

          row.appendChild(linkCol(it.gfg, 'GfG'));
          row.appendChild(linkCol(it.leetcode, 'LeetCode'));
          row.appendChild(linkCol(it.solution, 'Solution'));
          row.appendChild(linkCol(it.video, 'Video'));

          li.appendChild(row);
          ulItems.appendChild(li);
        });

        subDetails.appendChild(ulItems);
        stepDetails.appendChild(subDetails);
      });

      container.appendChild(stepDetails);
    });
  }

  function computeCounts() {
    var data = [];
    var all = document.querySelectorAll('.title-cell input[type="checkbox"][data-key]');
    all.forEach(function (cb) {
      // Find enclosing details to read step/substep from badge text present in summaries
      var row = cb.closest('li');
      var subDetails = row && row.closest('details');
      var stepDetails = subDetails && subDetails.parentElement && subDetails.parentElement.closest('details');
      // Extract step/sub from the data attributes we set on summary counts
      var subCount = subDetails && subDetails.querySelector('summary .counts[data-scope="sub"]');
      var stepCount = stepDetails && stepDetails.querySelector('summary .counts[data-scope="step"]');
      var step = stepCount ? stepCount.getAttribute('data-step') : null;
      var sub = subCount ? subCount.getAttribute('data-substep') : null;
      if (step && sub) {
        data.push({ step: step, sub: sub, checked: cb.checked });
      }
    });
    var counts = { steps: {}, subs: {} };
    data.forEach(function (it) {
      var sk = it.step, sb = it.sub;
      var sKey = sk;
      var subKey = sk + '.' + sb;
      if (!counts.steps[sKey]) counts.steps[sKey] = { done: 0, total: 0 };
      if (!counts.subs[subKey]) counts.subs[subKey] = { done: 0, total: 0 };
      counts.steps[sKey].total++;
      counts.subs[subKey].total++;
      if (it.checked) {
        counts.steps[sKey].done++;
        counts.subs[subKey].done++;
      }
    });
    return counts;
  }

  function renderStepwiseCounts() {
    var counts = computeCounts();
    // Update step counts
    document.querySelectorAll('summary .counts[data-scope="step"]').forEach(function (el) {
      var step = el.getAttribute('data-step');
      var c = counts.steps[step] || { done: 0, total: 0 };
      el.textContent = '(' + c.done + '/' + c.total + ')';
    });
    // Update substep counts
    document.querySelectorAll('summary .counts[data-scope="sub"]').forEach(function (el) {
      var step = el.getAttribute('data-step');
      var sub = el.getAttribute('data-substep');
      var c = counts.subs[step + '.' + sub] || { done: 0, total: 0 };
      el.textContent = '(' + c.done + '/' + c.total + ')';
    });
  }

  var content = document.getElementById('content');
  if (Array.isArray(window.data) && window.data.length) {
    renderList(content, window.data);
    renderStepwiseCounts();
    content.addEventListener('change', function (e) {
      if (e.target && e.target.matches('.title-cell input[type="checkbox"]')) {
        renderStepwiseCounts();
      }
    });
  } else {
    content.textContent = 'No data found.';
  }
})();
