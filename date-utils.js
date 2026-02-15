function pad2(n) { return n < 10 ? '0' + n : String(n); }

export function toDateStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function todayStr() { return toDateStr(new Date()); }

export function parseDateStr(s) {
  return s ? new Date(s + 'T00:00:00') : null;
}

export function localNoonFromDateStr(s) {
  if (!s) return null;
  var parts = s.split('-');
  if (parts.length < 3) return null;
  return new Date(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0, 0);
}

export function localNoonToday() {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}
