require('dotenv').config({ quiet: true });
const jwt = require('jsonwebtoken'); const { spawn } = require('child_process'); const os = require('os'); const path = require('path');
const APP = 'http://192.168.1.5:5173';
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${path.join(os.tmpdir(), 'cdp-prof')}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws;
  for (let i = 0; i < 30 && !ws; i++) { try { const t = await (await fetch('http://localhost:9333/json/list')).json(); const pg = t.find(x => x.type === 'page'); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch {} await wait(300); }
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; const log = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
    if (d.method === 'Network.responseReceived' && /\/api\//.test(d.params.response.url)) log.push(`${d.params.response.status} ${d.params.response.url.replace(/^https?:\/\/[^/]+/, '')}`);
    if (d.method === 'Network.loadingFailed') log.push(`FAILED ${d.params.errorText} ${d.params.blockedReason || ''}`);
    if (d.method === 'Runtime.exceptionThrown') log.push('EXC ' + d.params.exceptionDetails.exception?.description?.split('\n')[0]);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') log.push('CONSOLE ' + d.params.args.map(a => a.value || a.description).join(' ').slice(0, 200)); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
  await send('Network.enable'); await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: APP + '/college/login' }); await wait(3000);
  const token = jwt.sign({ id: 2, role: 'college', is_staff: false, sxp: Math.floor(Date.now() / 1000) + 3600 }, process.env.JWT_SECRET, { expiresIn: 3600 });
  await ev(`localStorage.setItem('collegeAdmissionToken', ${JSON.stringify(token)}); localStorage.setItem('collegeAdmissionAuth', JSON.stringify({ user: { id: 2, name: 'Elphinstone College' }, role: 'college', isAuthenticated: true })); true`);
  await send('Page.navigate', { url: APP + '/college/apply/82' }); await wait(7000);
  const type = (name, val) => ev(`(() => { const el = document.querySelector('input[name="${name}"]'); if (!el) return 'no ${name} input'; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ${JSON.stringify(val)}); el.dispatchEvent(new Event('input', { bubbles: true })); return 'typed ' + el.value })()`);
  const opts = id => ev(`(() => { const d = document.getElementById('${id}'); return d ? d.options.length + ' options, first: ' + [...d.options].slice(0,3).map(o => o.value).join(' | ') : 'no datalist ${id}' })()`);
  const val = name => ev(`document.querySelector('input[name="${name}"]')?.value`);
  console.log('page:', await ev(`document.title + ' — ' + (document.querySelector('h2')?.textContent || '')`));
  console.log('states list:', await opts('dl-state'));
  console.log(await type('state', 'Maharashtra')); await wait(3000);
  console.log('state value now:', await val('state'), '| district placeholder:', await ev(`document.querySelector('input[name="district"]')?.placeholder`));
  console.log('districts list:', await opts('dl-district'));
  console.log(await type('district', 'Sindhudurg')); await wait(3000);
  console.log('district value now:', await val('district'), '| taluka placeholder:', await ev(`document.querySelector('input[name="taluka"]')?.placeholder`));
  console.log('talukas list:', await opts('dl-taluka'));
  console.log('--- network/errors ---\n' + log.join('\n'));
  ws.close(); chrome.kill();
})().catch(e => { console.error('ERR', e.message); chrome.kill(); });
