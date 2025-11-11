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
      stepSummary.innerHTML = '<span class="badge">Step ' + stepKey + '</span> ' + (stepObj.title || '');
      stepDetails.appendChild(stepSummary);

      stepObj.sub.forEach(function (subObj, subKey) {
        var subDetails = document.createElement('details');
        subDetails.open = false;
        var subSummary = document.createElement('summary');
        subSummary.innerHTML = '<span class="badge small">' + stepKey + '.' + subKey + '</span> ' + (subObj.title || '');
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

  var content = document.getElementById('content');
  if (Array.isArray(window.data) && window.data.length) {
    renderList(content, window.data);
  } else {
    content.textContent = 'No data found.';
  }
})();
