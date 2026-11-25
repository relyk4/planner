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
    w.localStorage.setItem('planner.theme', 'dark');
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

  // draw links: drag from an edge handle onto another item; the two edges give the type
  const barOf = c => $$('#grid .b').find(b => b.querySelector('.cd').textContent === c);
  const PE = w.PointerEvent || w.MouseEvent, fire = (el, type, x, y) => el.dispatchEvent(new PE(type, {bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y}));
  // jsdom has no layout, so the chart sits at 0,0 and chart coordinates are client coordinates.
  const edgeAt = (b, side) => [parseFloat(b.style.left) + (side === 'S' ? 4 : parseFloat(b.style.width) - 4), parseFloat(b.style.top) + parseFloat(b.style.height) / 2];
  const startLink = (from, side) => {fire(barOf(from), 'pointerover'); const h = $(`#grid .lkh[data-side=${side}]`); fire(h, 'pointerdown', parseFloat(h.style.left), parseFloat(h.style.top)); return h};
  const drawLink = (from, fs, to, ts) => {const h = startLink(from, fs), [x, y] = edgeAt(barOf(to), ts); fire(h, 'pointermove', x, y); const lab = $('#grid .lkt')?.textContent || ''; fire(h, 'pointerup', x, y); return lab};
  fire(barOf('2.1.1'), 'pointerover');
  ok($$('#grid .lkh').length === 2, 'hovering a bar shows a link handle on each edge');
  const pred = barOf('2.1.1').dataset.id;
  for (const [fs, ts] of [['F', 'S'], ['S', 'S'], ['F', 'F'], ['S', 'F']]) {
    const lab = drawLink('2.1.1', fs, '3.1.1', ts); await sleep(30);
    ok(lab.startsWith(fs + ts) && $('#lt-' + pred)?.value === fs + ts, `dragging ${fs === 'S' ? 'start' : 'end'} to ${ts === 'S' ? 'start' : 'end'} draws a ${fs + ts} link and opens it in the editor`);
    $('#undo').click(); await sleep(30);
    ok(!$('#dep-' + pred), `undo removes the drawn ${fs + ts} link`);
  }
  $('#dr [data-act=close]').click(); await sleep(30);
  ok(drawLink('1.1.2', 'F', '1.1.1', 'S') === 'Would make a loop' && $('#toast').textContent.includes('loop') && !$('#dr').classList.contains('open'), 'a link that would loop is refused');
  ok(drawLink('1.1.1', 'F', '1.1.2', 'S') === 'Already linked' && !$('#dr').classList.contains('open'), 'a duplicate link is refused');
  {const h = startLink('2.1.1', 'F'), [x, y] = edgeAt(barOf('3.1.1'), 'S'); fire(h, 'pointermove', x, y);
    d.dispatchEvent(new w.KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); fire(h, 'pointerup', x, y); await sleep(30);
    ok(!$('#grid .lkd') && !$('#dr').classList.contains('open'), 'Esc cancels drawing a link')}
  {const b = barOf('2.1.4'), l0 = b.style.left, x = parseFloat(b.style.left) + parseFloat(b.style.width) / 2, y = parseFloat(b.style.top) + 5, cw = parseFloat($('#grid .ch').style.width);
    fire(b, 'pointerdown', x, y); fire(b, 'pointermove', x + cw, y); fire(b, 'pointerup', x + cw, y); await sleep(30);
    ok(barOf('2.1.4').style.left !== l0 && $('#toast').textContent.includes('pinned to step'), 'dragging the middle of a bar still moves it');
    $('#undo').click(); await sleep(30)}
  // pan: drag empty map space to scroll both ways; a click after a pan does nothing, a plain click still closes the editor
  {const bd = $('#board'), bg = () => $('#grid .rbg');
    $('#grid .b').click(); await sleep(30); bd.scrollLeft = 100; bd.scrollTop = 50;
    fire(bg(), 'pointerdown', 300, 200); fire(bg(), 'pointermove', 260, 170); fire(bd, 'pointerup', 260, 170); bg().click(); await sleep(30);
    ok(bd.scrollLeft === 140 && bd.scrollTop === 80 && $('#dr').classList.contains('open'), 'dragging empty map space pans the map and does not close the editor');
    fire(bg(), 'pointerdown', 300, 200); fire(bg(), 'pointerup', 300, 200); bg().click(); await sleep(30);
    ok(bd.scrollLeft === 140 && !$('#dr').classList.contains('open'), 'a click on empty map space without dragging still closes the editor');
    const b = barOf('2.1.4'), l0 = b.style.left;
    d.body.dispatchEvent(new w.KeyboardEvent('keydown', {code: 'Space', key: ' ', bubbles: true}));
    fire(b, 'pointerdown', 300, 200); fire(b, 'pointermove', 200, 200); fire(bd, 'pointerup', 200, 200); await sleep(30);
    d.body.dispatchEvent(new w.KeyboardEvent('keyup', {code: 'Space', key: ' ', bubbles: true}));
    ok(bd.scrollLeft === 240 && barOf('2.1.4').style.left === l0 && !$('#grid .ghost'), 'holding Space and dragging a bar pans instead of moving it')}

  // grid and gantt
  $('[data-view=grid]').click(); await sleep(50);
  ok($$('#gridv tbody tr').length > 20, 'grid view renders rows');
  $('[data-view=gantt]').click(); await sleep(50);
  ok($('#ganttv').innerHTML.length > 1000, 'gantt view renders');
  $('[data-view=map]').click(); await sleep(50);

  // Item IDs: ticket keys in place of outline numbers for features and tasks
  {const bar = c => $$('#grid .b').find(b => b.querySelector('.cd').textContent === c), row = c => $$('#grid .lr').find(r => r.querySelector('.cd')?.textContent === c);
    row('1.1.2').click(); await sleep(30);
    const k = $('#f-key'); k.focus(); k.value = 'UDM-1031'; k.dispatchEvent(new w.Event('input', {bubbles: true})); await sleep(300);
    $('#dr [data-act=close]').click(); await sleep(30);
    $('#set-btn').click(); await sleep(20);
    ok(!$('#set').hidden && $('#set-btn').getAttribute('aria-expanded') === 'true', 'Settings menu opens');
    $('#set [data-set=plan]').click(); await sleep(30);
    ok($('#set').hidden && $('#dr').classList.contains('open') && $('#c-ids'), 'Settings > Plan settings opens the plan settings');
    const s = $('#c-ids'); s.value = 'key'; s.dispatchEvent(new w.Event('change', {bubbles: true})); await sleep(50);
    ok(bar('UDM-1031') && !bar('1.1.2') && !row('UDM-1031').querySelector('.ky') && row('1') && row('M1'), 'Ticket keys shows a task\'s key in place of its outline number; objectives and milestones keep theirs');
    $('#dr [data-act=close]').click(); $('[data-view=grid]').click(); await sleep(50);
    const td = () => $$('#gridv td[data-k=deps]').find(t => t.parentNode.querySelector('.gcd')?.textContent === '1.1.3');
    ok(td().textContent === 'UDM-1031 FF', 'grid dependencies show the key');
    td().dispatchEvent(new w.MouseEvent('dblclick', {bubbles: true})); await sleep(20);
    const inp = td().querySelector('input'); inp.value = 'udm-1031 ss'; inp.dispatchEvent(new w.KeyboardEvent('keydown', {key: 'Enter', bubbles: true})); await sleep(50);
    ok(td().textContent === 'UDM-1031 SS', 'typing a key and link type in the grid links to it');
    $('[data-view=map]').click(); $('#set [data-set=plan]').click(); await sleep(30);
    const s2 = $('#c-ids'); s2.value = 'outline'; s2.dispatchEvent(new w.Event('change', {bubbles: true})); await sleep(50);
    ok(bar('1.1.2') && row('1.1.2').querySelector('.ky')?.textContent === 'UDM-1031', 'Outline numbers brings the numbers back');
    $('#dr [data-act=close]').click(); for (let i = 0; i < 4; i++) $('#undo').click(); await sleep(50)}

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

  // milestones and externals shown under an objective or feature
  {const codes = sel => $$(sel).map(r => r.querySelector('.cd, .gcd')?.textContent), at = (l, c) => l.indexOf(c);
    const setSel = (id, v) => {const s = $(id); s.focus(); s.value = v; s.dispatchEvent(new w.Event('change', {bubbles: true}))};
    const row = c => $$('#grid .lr').find(r => r.querySelector('.cd')?.textContent === c), tallies = () => $('#tal').textContent;
    let m = codes('#grid .lr');
    ok(at(m, 'X5') > at(m, '1.2.3') && at(m, 'X5') < at(m, '1.3') && row('X5').style.paddingLeft === row('1.2.1').style.paddingLeft, 'the sample shows X5 under feature 1.2, indented like a task');
    const t0 = tallies(), left0 = barOf('2.2.1').style.left, n0 = $$('#grid path.e').length;
    row('X2').click(); await sleep(30);
    setSel('#f-parent', row('2.2').dataset.id); await sleep(50);
    m = codes('#grid .lr');
    ok(at(m, 'X2') > at(m, '2.2.3') && at(m, 'X2') < at(m, '3') && row('X2').style.paddingLeft === row('2.2.1').style.paddingLeft, 'Show under moves an external to the end of a feature');
    ok(tallies() === t0 && barOf('2.2.1').style.left === left0 && $$('#grid path.e').length === n0, 'placement leaves steps, tallies and links unchanged');
    $('[data-view=grid]').click(); await sleep(30);
    m = codes('#gridv tbody tr');
    ok(at(m, 'X2') > at(m, '2.2.3') && at(m, 'X2') < at(m, '3'), 'the grid shows it under the same feature');
    $('[data-view=gantt]').click(); await sleep(30);
    m = codes('#ganttv .tll');
    ok(at(m, 'X2') > at(m, '2.2.3') && at(m, 'X2') < at(m, '3.1'), 'the Gantt shows it under the same feature');
    $('[data-view=map]').click(); await sleep(30);
    row('2.2').querySelector('[data-tog]').click(); await sleep(30);
    {const ri = $$('#grid .lr').indexOf(row('2.2')), rh = parseFloat(row('2.2').style.height);
      ok(!row('X2') && $$('#grid .xk').some(e => e.title.startsWith('X2') && Math.abs(parseFloat(e.style.top) - (ri * rh + rh / 2 - 9)) < 1), 'collapsing the feature puts its marker on the feature row')}
    $('#undo').click(); await sleep(50);
    m = codes('#grid .lr');
    ok(at(m, 'X2') < at(m, '1'), 'undo puts it back in the top section in one step');
    $('#dr [data-act=close]').click(); await sleep(30);
    row('1.2').click(); await sleep(30);
    const db = $('#dr [data-act=del]'); db.click(); db.click(); await sleep(50);
    m = codes('#grid .lr');
    const sc = () => $$('#grid .lr.feat .nm').some(n => n.textContent === 'Source connectors');
    ok(!sc() && at(m, 'X5') > -1 && at(m, 'X5') < at(m, '1') && $('#toast').textContent.includes('X5'), 'deleting a feature moves its external back to the top section');
    $('#undo').click(); await sleep(50);
    m = codes('#grid .lr');
    ok(sc() && at(m, 'X5') > at(m, '1.2.3') && at(m, 'X5') < at(m, '1.3'), 'undo restores the feature with X5 under it')}

  // undo
  const name0 = $('#grid .lr.task .nm').textContent;
  $('#grid .lr.task').click(); await sleep(30);
  const f = $('#f-name'); f.focus(); f.value = 'Renamed by smoke test'; f.dispatchEvent(new w.Event('input', {bubbles: true})); f.dispatchEvent(new w.Event('change', {bubbles: true})); await sleep(300);
  $('#dr [data-act=close]').click(); await sleep(30);
  ok($('#grid .lr.task .nm').textContent === 'Renamed by smoke test', 'editing a name updates the map');
  $('#undo').click(); await sleep(50);
  ok($('#grid .lr.task .nm').textContent === name0, 'undo restores it');

  // System settings: theme is per browser, outside the plan
  const thm = () => [d.documentElement.dataset.theme || 'system', $('#sysp [aria-pressed=true]')?.dataset.thm, w.localStorage.getItem('planner.theme')].join();
  ok(d.documentElement.dataset.theme === 'dark', 'saved Dark theme is applied on load');
  $('#set-btn').click(); await sleep(20); $('#set [data-set=sys]').click(); await sleep(20);
  ok($('#sysp').classList.contains('open') && thm() === 'dark,dark,dark', 'Settings > System settings opens with Dark shown as pressed');
  $('#sysp [data-thm=light]').click(); await sleep(20);
  ok(thm() === 'light,light,light', 'Light overrides and is remembered');
  $('#sysp [data-thm=system]').click(); await sleep(20);
  ok(thm() === 'system,system,system' && !d.documentElement.hasAttribute('data-theme'), 'System hands control back to the OS setting');
  $('#grid .b').click(); await sleep(30);
  ok(!$('#sysp').classList.contains('open') && $('#dr').classList.contains('open'), 'opening an item closes System settings');
  $('#dr [data-act=close]').click(); await sleep(30);

  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
} catch (e) {
  console.log('FAIL crashed: ' + (e.stack || e)); fails++;
} finally {
  srv.kill(); rmSync(data, {recursive: true, force: true});
}
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
