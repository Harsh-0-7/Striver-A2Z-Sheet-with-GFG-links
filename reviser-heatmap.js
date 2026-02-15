var HEATMAP = {
  days: 30,
  colors: ['#e8fbf0', '#d9f7e8', '#8ee6bb', '#34d399', '#067647'],
  thresholds: [1, 2, 4, 7],
  baseCell: 14,
  minCell: 10,
  maxCell: 20,
  minGutter: 2,
  maxGutter: 6,
  smallWidth: 520,
  radius: 3,
  neutralColor: '#e4e7ec'
};

function getHeatmapSizing(width) {
  var cellSize = HEATMAP.baseCell;
  var gutter = 4;
  if (width > 0) {
    var minGutter = width < HEATMAP.smallWidth ? HEATMAP.minGutter : 4;
    var maxGutter = width < HEATMAP.smallWidth ? 4 : HEATMAP.maxGutter;
    var tentative = Math.floor((width - minGutter * (HEATMAP.days - 1)) / HEATMAP.days);
    cellSize = Math.max(HEATMAP.minCell, Math.min(HEATMAP.maxCell, tentative));
    var remaining = width - (cellSize * HEATMAP.days);
    gutter = Math.max(1, Math.min(maxGutter, Math.floor(remaining / (HEATMAP.days - 1))));
    while (cellSize * HEATMAP.days + gutter * (HEATMAP.days - 1) > width && cellSize > 8) {
      cellSize -= 1;
    }
  }
  return { cellSize: cellSize, gutter: gutter };
}

function createSameRowTemplate(now) {
  return function (DateHelper, options) {
    return {
      name: 'day_same_row_30',
      parent: 'day',
      rowsCount: function () { return 1; },
      columnsCount: function () { return HEATMAP.days; },
      mapping: function (startDate, endDate, defaultValues) {
        var end = DateHelper.date(now).add(1, 'day').startOf('day');
        var start = DateHelper.date(now).subtract(HEATMAP.days - 1, 'day').startOf('day');
        return DateHelper.intervals('day', start, end).map(function (d, idx) {
          return { t: d.valueOf(), x: idx, y: 0, value: 0, ...defaultValues };
        });
      },
      extractUnit: function (ts) {
        return DateHelper.date(ts).startOf('day').valueOf();
      }
    };
  };
}

function buildHeatmapPlugins() {
  if (!window.Tooltip) return [];
  return [[window.Tooltip, {
    text: function (timestamp, value, dayjsDate) {
      var v = value || 0;
      return v + ' solved on ' + dayjsDate.format('YYYY-MM-DD');
    }
  }]];
}

export function renderHeatmap(wrap, now, dataArr) {
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!window.CalHeatmap) {
    wrap.textContent = 'Heatmap library failed to load.';
    return;
  }

  var cal = new window.CalHeatmap();
  var sizing = getHeatmapSizing(wrap.clientWidth || 0);
  var sameRow30 = createSameRowTemplate(now);
  if (cal.addTemplates) cal.addTemplates([sameRow30]);

  cal.paint({
    itemSelector: '#reviser-heatmap',
    range: 1,
    domain: {
      type: 'month',
      gutter: 0,
      padding: [0, 0, 0, 0],
      dynamicDimension: false,
      label: { position: 'top', text: '' }
    },
    subDomain: {
      type: 'day_same_row_30',
      width: sizing.cellSize,
      height: sizing.cellSize,
      radius: HEATMAP.radius,
      gutter: sizing.gutter,
      color: HEATMAP.neutralColor
    },
    date: {
      start: now,
      locale: { weekStart: 1 }
    },
    data: {
      source: dataArr,
      x: 'date',
      y: 'value',
      defaultValue: 0
    },
    scale: {
      color: {
        type: 'threshold',
        domain: HEATMAP.thresholds,
        range: HEATMAP.colors
      }
    }
  }, buildHeatmapPlugins());

  requestAnimationFrame(function () {
    var svg = wrap.querySelector('svg');
    if (!svg) return;
    var bbox = svg.getBBox ? svg.getBBox() : null;
    var svgWidth = bbox && bbox.width ? bbox.width : svg.getBoundingClientRect().width;
    var wrapWidth = wrap.clientWidth || 0;
    if (!svgWidth || !wrapWidth) return;
    var scale = wrapWidth / svgWidth;
    svg.style.transformOrigin = 'left top';
    svg.style.transform = 'scale(' + scale + ')';
    svg.style.width = svgWidth + 'px';
    svg.style.height = (bbox && bbox.height ? bbox.height : svg.getBoundingClientRect().height) + 'px';
    wrap.style.height = Math.ceil((bbox && bbox.height ? bbox.height : svg.getBoundingClientRect().height) * scale) + 'px';
  });
}
