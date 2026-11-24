// UI smoke test: starts server.py with a throwaway data folder, loads the page
// in jsdom, creates the sample plan and clicks through the main features.
//   cd tests/ui && npm install && npm test
// Dev-only: jsdom is never needed to run Planner itself.
import {JSDOM} from 'jsdom';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = await new Promise(r => {const s = net.createServer().listen(0, () => {const p = s.address().port; s.close(() => r(p))})});
const data = mkdtempSync(join(tmpdir(), 'planner-ui-'));
const py = process.platform === 'win32' ? 'python' : 'python3';
const srv = spawn(py, [join(ROOT, 'server.py'), '--port', String(port), '--data', data], {env: {...process.env, PLANNER_QUIET: '1'}, stdio: 'ignore'});
const base = `http://127.0.0.1:${port}/`;
let fails = 0, errors = [];
const ok = (cond, msg) => {console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++};
try {
  for (let i = 0; i < 50; i++) {try {await fetch(base + 'api/health'); break} catch {await sleep(100)}}
  const html = await (await fetch(base)).text();
  // resources:'usable' makes jsdom fetch app.css and the js/*.js files from the server.
  let loaded;
  const dom = new JSDOM(html, {url: base, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) {
    w.ResizeObserver = class {observe() {}};
    w.Element.prototype.scrollIntoView = function () {};
    w.fetch = (u, o) => fetch(new URL(u, base), o);
    w.localStorage.setItem('planner.user', 'Smoke test');
    w.addEventListener('error', e => errors.push(e.message));
    w.onunhandledrejection = e => errors.push(String(e.reason && e.reason.stack || e.reason));
    loaded = new Promise(r => w.addEventListener('load', r));
  }});
  const w = dom.window, d = w.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  await loaded; await sleep(1200);
  ok($('#conn').textContent.includes('local server'), 'page talks to the server');

  $('[data-m=sample]').click(); await sleep(800);
  const bars = $$('#grid .b').length;
  ok(bars > 10, `map shows task bars (${bars})`);
  ok($$('#grid path.e').length > 10, 'map draws dependency links');
  ok($$('#grid .ch').length >= 5, 'map shows step columns');

  // status filter
  $('#flt-btn').click(); await sleep(20);
  ok(!$('#flt').hidden, 'filter menu opens');
  const doneBars = $$('#grid .b.done').length;
  $('#flt [data-fs=done]').click(); await sleep(50);
  ok($$('#grid .b').length === bars - doneBars && $$('#grid .b.done').length === 0, 'unticking Done hides done tasks');
  ok(!$('#fltsum').hidden, 'filter summary shows');
  $('#fltsum [data-fp=all]').click(); await sleep(50);
  ok($$('#grid .b').length === bars, 'Clear shows every task again');

  // editor
  $('#grid .b').click(); await sleep(50);
  ok($('#dr').classList.contains('open'), 'clicking a bar opens the editor');
  $('#dr [data-act=close]').click(); await sleep(30);

  // map zoom and full screen
  const h0 = parseFloat($('#grid .b').style.height);
  $('#zm-in').click(); await sleep(60);
  ok($('#zm-0').textContent === '110%' && parseFloat($('#grid .b').style.height) > h0 && w.localStorage.getItem('planner.mapzoom') === '1.1', 'zoom in redraws the map larger and remembers the level');
  $('#zm-0').click(); await sleep(60);
  ok($('#zm-0').textContent === '100%' && parseFloat($('#grid .b').style.height) === h0, 'reset zoom returns to 100%');
  $('#fs-btn').click(); await sleep(20);
  ok($('#app').classList.contains('fullmap') && $('#fs-btn').getAttribute('aria-pressed') === 'true', 'Full screen hides the sidebar and header');
  d.dispatchEvent(new w.KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); await sleep(20);
  ok(!$('#app').classList.contains('fullmap'), 'Esc leaves full screen');
  // milestones and externals: pin to a later gate, reset to auto, undo
  const x2 = () => $$('#grid .xk').find(e => e.title.startsWith('X2')), bar221 = () => $$('#grid .b').find(b => b.querySelector('.cd').textContent === '2.2.1').style.left;
  const left0 = bar221();
  x2().click(); await sleep(50);
  $('#dr [data-act=mvr]').click(); await sleep(50);
  ok(x2().title.includes('pinned to the gate after step 1') && $('#dr [data-act=unpin]') && bar221() !== left0, 'Later gate pins an external item and pushes what waits on it');
  $('#dr [data-act=unpin]').click(); await sleep(50);
  ok(!x2().title.includes('pinned') && !$('#dr [data-act=unpin]') && bar221() === left0, 'Reset to auto clears the pin');
  $('#undo').click(); await sleep(50);
  ok(x2().title.includes('pinned'), 'undo restores the pin');
  $('#undo').click(); await sleep(50);
  $('#dr [data-act=close]').click(); await sleep(30);

  // grid and gantt
  $('[data-view=grid]').click(); await sleep(50);
  ok($$('#gridv tbody tr').length > 20, 'grid view renders rows');
  $('[data-view=gantt]').click(); await sleep(50);
  ok($('#ganttv').innerHTML.length > 1000, 'gantt view renders');
  $('[data-view=map]').click(); await sleep(50);

  // releases: own tab, a page per release, and links in the left rail
  $('[data-view=rel]').click(); await sleep(50);
  ok(!$('#relv').hidden && $$('#relv .rr').length === 3, 'Releases tab lists the releases');
  $('#relv .rr').click(); await sleep(50);
  ok($('#relv .relp h2')?.textContent === 'R0 Foundations' && $$('#relv .relp-t tbody tr').length > 0, 'clicking a release opens its page with its tasks');
  $$('#rail-rel-l [data-rp]')[2].click(); await sleep(50);
  ok($('#relv .relp h2')?.textContent === 'R1 Ingest MVP' && $('#rail-rel-l .on')?.dataset.rp === $$('#rail-rel-l [data-rp]')[2].dataset.rp, 'a release in the sidebar opens its page');
  $('#relv [data-act=rel-map]').click(); await sleep(50);
  ok(!$('#board').hidden && $('#dr').classList.contains('open') && $('#f-rdue'), 'Show on map focuses the release on the map');
  $('#dr [data-act=close]').click(); await sleep(30);

  // Add menu, keyboard first
  const key = k => d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', {key: k, bubbles: true}));
  $('#add-btn').focus(); key('ArrowDown'); await sleep(20);
  ok(!$('#add').hidden && d.activeElement === $('#add [data-add=obj]'), 'ArrowDown opens the Add menu on its first item');
  key('ArrowDown'); key('ArrowDown');
  ok(d.activeElement === $('#add [data-add=ext]'), 'arrow keys move through the Add menu');
  key('ArrowUp'); key('ArrowUp'); key('ArrowUp');
  ok(d.activeElement === $('#add [data-add=rel]'), 'arrow keys wrap around');
  key('Escape'); await sleep(20);
  ok($('#add').hidden && d.activeElement === $('#add-btn'), 'Esc closes the Add menu and returns focus');
  const objs = $$('#grid .lr.obj').length;
  $('#add-btn').click(); await sleep(20);
  $('#add [data-add=obj]').click(); await sleep(50);
  ok($('#add').hidden && $$('#grid .lr.obj').length === objs + 1 && d.activeElement === $('#f-name'), 'Add > Objective adds one and opens its editor');
  $('#undo').click(); await sleep(50);
  $('#add-btn').click(); await sleep(20);
  $('#add [data-add=rel]').click(); await sleep(50);
  ok(!$('#relv').hidden && $('#relv .relp h2')?.textContent === 'R4' && $('#rail-rel-n').textContent === '4', 'Add > Release opens the new release page');
  $('#undo').click(); await sleep(50);
  ok($('#relv .relp') === null && $$('#relv .rr').length === 3, 'undoing it returns to the release list');
  $('[data-view=map]').click(); await sleep(50);

  // undo
  const name0 = $('#grid .lr.task .nm').textContent;
  $('#grid .lr.task').click(); await sleep(30);
  const f = $('#f-name'); f.focus(); f.value = 'Renamed by smoke test'; f.dispatchEvent(new w.Event('input', {bubbles: true})); f.dispatchEvent(new w.Event('change', {bubbles: true})); await sleep(300);
  $('#dr [data-act=close]').click(); await sleep(30);
  ok($('#grid .lr.task .nm').textContent === 'Renamed by smoke test', 'editing a name updates the map');
  $('#undo').click(); await sleep(50);
  ok($('#grid .lr.task .nm').textContent === name0, 'undo restores it');

  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
} catch (e) {
  console.log('FAIL crashed: ' + (e.stack || e)); fails++;
} finally {
  srv.kill(); rmSync(data, {recursive: true, force: true});
}
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
