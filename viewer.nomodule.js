(function () {
  function link(href, label) {
    if (!href) return '';
    var safe = String(href);
    var text = label || (function () {
      try { var u = new URL(safe); return u.hostname + u.pathname; } catch (e) { return safe; }
    })();
    return '<a href="' + safe + '" target="_blank" rel="noopener">' + text + '</a>';
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
          var title = it.title || '(untitled)';
          var cols = [];
          // Title column as a link to article if present
          if (it.article) {
            cols.push('<a class="item-title" href="' + it.article + '" target="_blank" rel="noopener">' + title + '</a>');
          } else {
            cols.push('<div class="item-title">' + title + '</div>');
          }
          // Link columns (vertically stacked within each type)
          cols.push('<div class="link-col">' + (it.gfg ? ('<div class="links">' + link(it.gfg, 'GfG') + '</div>') : '') + '</div>');
          cols.push('<div class="link-col">' + (it.leetcode ? ('<div class="links">' + link(it.leetcode, 'LeetCode') + '</div>') : '') + '</div>');
          cols.push('<div class="link-col">' + (it.solution ? ('<div class="links">' + link(it.solution, 'Solution') + '</div>') : '') + '</div>');
          cols.push('<div class="link-col">' + (it.video ? ('<div class="links">' + link(it.video, 'Video') + '</div>') : '') + '</div>');
          li.innerHTML = '<div class="item-row">' + cols.join('') + '</div>';
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
