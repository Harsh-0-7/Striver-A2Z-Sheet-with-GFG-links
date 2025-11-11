#!/usr/bin/env node
/**
 * Build step: inline minified JSON data into index.html
 * - Reads data from data.global.js (window.data = [...];)
 * - Writes data.min.json (minified JSON)
 * - Replaces the contents of <script type="application/json" id="a2z-json">...</script>
 *
 * Usage: node scripts/build-inline-json.js
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dataJsPath = path.join(root, 'data.global.js');
const dataJsonPath = path.join(root, 'data.min.json');
const indexPath = path.join(root, 'index.html');

function readWindowDataArray(js) {
  let arrSrc;
  const m = js.match(/window\.data\s*=\s*([\s\S]*?);\s*$/);
  if (m) {
    arrSrc = m[1];
  } else {
    // Fallback: grab from first '[' after assignment up to the matching closing ']'
    const assignIdx = js.indexOf('window.data');
    const bracketStart = js.indexOf('[', assignIdx);
    const bracketEnd = js.lastIndexOf(']');
    if (assignIdx === -1 || bracketStart === -1 || bracketEnd === -1) {
      throw new Error('Could not locate array literal in data.global.js');
    }
    arrSrc = js.slice(bracketStart, bracketEnd + 1);
  }
  // Evaluate as a JS array literal (supports unquoted keys/trailing commas inside objects won't matter here)
  try {
    // Wrap in parentheses to be a valid expression
    // eslint-disable-next-line no-new-func
    const arr = Function('"use strict"; return (' + arrSrc + ')')();
    if (!Array.isArray(arr)) throw new Error('Not an array');
    return arr;
  } catch (e) {
    throw new Error('Failed to evaluate data array: ' + e.message);
  }
}

function inlineIntoHtml(html, minJson) {
  const re = /(<script\s+type="application\/json"\s+id="a2z-json">)([\s\S]*?)(<\/script>)/i;
  if (!re.test(html)) {
    throw new Error('index.html does not contain <script type="application/json" id="a2z-json">');
  }
  return html.replace(re, (_, p1, _old, p3) => p1 + minJson + p3);
}

(function main() {
  const js = fs.readFileSync(dataJsPath, 'utf8');
  const arr = readWindowDataArray(js);
  const min = JSON.stringify(arr);
  fs.writeFileSync(dataJsonPath, min, 'utf8');
  const html = fs.readFileSync(indexPath, 'utf8');
  const out = inlineIntoHtml(html, min);
  fs.writeFileSync(indexPath, out, 'utf8');
  console.log(`Wrote ${dataJsonPath} (${min.length} bytes) and inlined JSON into ${indexPath}`);
})();
