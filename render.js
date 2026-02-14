import { STORE_PREFIX, groupByStep, makeKey } from './data.js';

export function renderList(container, data, gState) {
  gState.grouped = groupByStep(data);

  Object.keys(gState.grouped).forEach(function (stepKey) {
    var stepObj = gState.grouped[stepKey];
    var stepDetails = document.createElement('details');
    stepDetails.open = false;
    var stepSummary = document.createElement('summary');
    stepSummary.innerHTML =
      '<span class="badge">Step ' + stepKey + '</span> ' +
      (stepObj.title || '') +
      ' <span class="counts" data-scope="step" data-step="' + stepKey + '"></span>' +
      ' <div class="progress step" data-step="' + stepKey + '"><div class="bar" style="width:0%"></div></div>';
    stepDetails.appendChild(stepSummary);

    Object.keys(stepObj.subs).forEach(function (subKey) {
      var subObj = stepObj.subs[subKey];
      var subDetails = document.createElement('details');
      subDetails.open = false;
      subDetails.dataset.step = String(stepKey);
      subDetails.dataset.substep = String(subKey);
      var subSummary = document.createElement('summary');
      subSummary.innerHTML =
        '<span class="badge small">' + stepKey + '.' + subKey + '</span> ' +
        (subObj.title || '') +
        ' <span class="counts" data-scope="sub" data-step="' + stepKey + '" data-substep="' + subKey + '"></span>' +
        ' <div class="progress sub" data-step="' + stepKey + '" data-substep="' + subKey + '"><div class="bar" style="width:0%"></div></div>';
      subDetails.appendChild(subSummary);

      // Lazy-render items on first expand
      subDetails.addEventListener('toggle', function onFirstOpen() {
        if (subDetails.open && !subDetails._rendered) {
          var frag = document.createDocumentFragment();
          var ulItems = document.createElement('ul');
          subObj.items.forEach(function (it) {
            var li = document.createElement('li');
            li.dataset.step = stepKey;
            li.dataset.sub = subKey;
            var row = document.createElement('div');
            row.className = 'item-row';

            var titleCell = document.createElement('div');
            titleCell.className = 'title-cell';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            var key = makeKey(it);
            cb.dataset.key = key;
            try { cb.checked = localStorage.getItem(STORE_PREFIX + key) === '1'; } catch (e) {}
            titleCell.appendChild(cb);
            var title = it.title || '(untitled)';
            if (it.article) {
              var a = document.createElement('a');
              a.href = String(it.article);
              a.target = '_blank';
              a.rel = 'noopener';
              a.textContent = title;
              a.className = 'item-title';
              titleCell.appendChild(a);
            } else {
              var dv = document.createElement('div');
              dv.className = 'item-title';
              dv.textContent = title;
              titleCell.appendChild(dv);
            }
            row.appendChild(titleCell);

            function linkCol(url, label) {
              var col = document.createElement('div');
              col.className = 'link-col';
              if (url) {
                var wrapper = document.createElement('div');
                wrapper.className = 'links';
                var a = document.createElement('a');
                a.href = String(url);
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = label;
                wrapper.appendChild(a);
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
          frag.appendChild(ulItems);
          subDetails.appendChild(frag);
          subDetails._rendered = true;
          subDetails.removeEventListener('toggle', onFirstOpen);
        }
      });
      stepDetails.appendChild(subDetails);
    });

    stepDetails.dataset.step = String(stepKey);
    container.appendChild(stepDetails);
  });
}

