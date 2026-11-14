/* Drive Play Pro – payments server (Google Apps Script web app).
 *
 * 1. The account frame sends {a:'checkout', plan, idToken}. We check the Firebase
 *    sign-in, save an order in Firestore and ask Grow for a payment page.
 * 2. The buyer pays on Grow's page (card, Bit, Apple Pay, Google Pay).
 *    Grow deposits the money straight to the bank account set in Grow.
 * 3. Grow calls this web app (notifyUrl) with the result. We check it and
 *    extend ent/{uid}.until – the only place that turns Pro on.
 *
 * Runs as the owner of the Firebase project, so it writes Firestore with the
 * owner's permission (security rules don't let users write ent/ or orders/).
 * Settings live in Project Settings → Script properties (see SETUP.md).
 */

const PLANS = {
  m: { sum: 14.90, months: 1, name: 'Drive Play Pro – חודש' },
  y: { sum: 119.00, months: 12, name: 'Drive Play Pro – שנה' }
};

function prop_(k, d) { const v = PropertiesService.getScriptProperties().getProperty(k); return v == null || v === '' ? d : v; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* run once from the editor: creates the secret that protects the Grow notification address */
function setup() {
  if (!prop_('NOTIFY_SECRET')) PropertiesService.getScriptProperties().setProperty('NOTIFY_SECRET', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  ['FIREBASE_API_KEY', 'FIREBASE_PROJECT', 'GROW_USER_ID', 'GROW_PAGE_CODE', 'WEB_APP_URL', 'RETURN_URL'].forEach(k => { if (!prop_(k)) console.warn('Missing script property: ' + k); });
  fsGet_('ent/_check');   // makes the editor ask for the Firestore permission now
  console.log('Setup OK. Grow environment: ' + growEnv_());
}

function doGet() { return json_({ ok: true, service: 'drive-play-pay', env: growEnv_() }); }

function doPost(e) {
  try {
    if (e && e.parameter && e.parameter.a === 'notify') return notify_(e);
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (b.a === 'checkout') return json_(checkout_(b));
    return json_({ err: 'bad_request' });
  } catch (x) {
    console.error(x && x.stack || x);
    return json_({ err: 'server' });
  }
}

/* ---------- checkout ---------- */
function checkout_(b) {
  const plan = PLANS[b.plan];
  if (!plan) return { err: 'plan' };
  const user = verifyUser_(b.idToken);
  if (!user) return { err: 'auth' };
  const oid = Utilities.getUuid().replace(/-/g, '');
  fsSet_('orders/' + oid, { uid: user.uid, em: user.email, plan: b.plan, sum: plan.sum, st: 'new', c: Date.now() });
  const ret = prop_('RETURN_URL', '');
  const req = {
    pageCode: prop_('GROW_PAGE_CODE'),
    userId: prop_('GROW_USER_ID'),
    sum: plan.sum.toFixed(2),
    paymentNum: '1',
    maxPaymentNum: '1',
    description: plan.name,
    successUrl: ret + (ret.indexOf('?') < 0 ? '?' : '&') + 's=ok',
    cancelUrl: ret + (ret.indexOf('?') < 0 ? '?' : '&') + 's=cancel',
    notifyUrl: prop_('WEB_APP_URL') + '?a=notify&k=' + prop_('NOTIFY_SECRET'),
    cField1: oid,
    cField2: user.uid
  };
  if (prop_('GROW_API_KEY')) req.apiKey = prop_('GROW_API_KEY');
  if (user.email) req['pageField[email]'] = user.email;
  const r = grow_('createPaymentProcess', req);
  const d = r && r.data;
  if (!r || String(r.status) !== '1' || !d || !d.url) {
    console.error('Grow createPaymentProcess failed: ' + JSON.stringify(r));
    fsPatch_('orders/' + oid, { st: 'err', er: String((r && r.err && (r.err.message || r.err)) || 'grow').slice(0, 200) });
    return { err: 'grow' };
  }
  fsPatch_('orders/' + oid, { pid: String(d.processId || ''), ptok: String(d.processToken || '') });
  return { url: d.url, oid: oid };
}

/* ---------- Grow's notification after a payment ---------- */
function notify_(e) {
  if (e.parameter.k !== prop_('NOTIFY_SECRET')) { console.warn('notify with a wrong secret'); return ContentService.createTextOutput('no'); }
  const p = flatParams_(e);
  const g = function () { for (var i = 0; i < arguments.length; i++) { var v = p[arguments[i]]; if (v != null && v !== '') return String(v); } return ''; };
  const oid = g('data[customFields][cField1]', 'data[cField1]', 'customFields[cField1]', 'cField1');
  const status = g('status');
  const code = g('data[statusCode]', 'statusCode');
  const sum = parseFloat(g('data[sum]', 'sum') || '0');
  const tx = g('data[transactionId]', 'transactionId');
  const pid = g('data[processId]', 'processId');
  console.log('notify order=' + oid + ' status=' + status + ' code=' + code + ' sum=' + sum + ' tx=' + tx);
  if (!oid) return ContentService.createTextOutput('ok');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const order = fsGet_('orders/' + oid);
    if (!order) { console.warn('unknown order ' + oid); return ContentService.createTextOutput('ok'); }
    const paid = status === '1' && (!code || code === '2');
    if (order.st !== 'paid') {
      const plan = PLANS[order.plan];
      if (!paid || !plan || sum + 0.01 < plan.sum || (order.pid && pid && String(order.pid) !== pid)) {
        fsPatch_('orders/' + oid, { st: 'failed', tx: tx, u: Date.now() });
        return ContentService.createTextOutput('ok');
      }
      const ent = fsGet_('ent/' + order.uid) || {};
      const base = Math.max(Date.now(), +ent.until || 0);
      const until = addMonths_(base, plan.months);
      fsSet_('ent/' + order.uid, { until: until, plan: order.plan, last: oid, u: Date.now() });
      fsPatch_('orders/' + oid, { st: 'paid', tx: tx, paid: Date.now(), until: until });
      logSale_(order, sum, tx, until);
    }
    approve_(p);
  } finally { lock.releaseLock(); }
  return ContentService.createTextOutput('ok');
}

/* tells Grow the notification arrived (Grow repeats it up to 5 times otherwise) */
function approve_(p) {
  const req = { pageCode: prop_('GROW_PAGE_CODE') };
  Object.keys(p).forEach(function (k) {
    const m = /^data\[([A-Za-z0-9_]+)\]$/.exec(k);
    if (m) req[m[1]] = p[k];
  });
  if (prop_('GROW_API_KEY')) req.apiKey = prop_('GROW_API_KEY');
  const r = grow_('approveTransaction', req);
  if (!r || String(r.status) !== '1') console.warn('approveTransaction: ' + JSON.stringify(r));
}

/* manual grant, for gifts and support: run from the editor, e.g. grantPro('someone@gmail.com', 1) */
function grantPro(emailOrUid, months) {
  let uid = emailOrUid;
  if (String(emailOrUid).indexOf('@') > 0) {
    const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/projects/' + prop_('FIREBASE_PROJECT') + '/accounts:lookup', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': prop_('FIREBASE_PROJECT') }, payload: JSON.stringify({ email: [emailOrUid] }) });
    const j = JSON.parse(r.getContentText() || '{}');
    if (!j.users || !j.users[0]) throw new Error('No account with this email');
    uid = j.users[0].localId;
  }
  const ent = fsGet_('ent/' + uid) || {};
  const until = addMonths_(Math.max(Date.now(), +ent.until || 0), months || 1);
  fsSet_('ent/' + uid, { until: until, plan: 'gift', last: 'manual', u: Date.now() });
  console.log('Pro for ' + uid + ' until ' + new Date(until));
}

/* ---------- helpers ---------- */
function growEnv_() { return prop_('GROW_ENV', 'sandbox') === 'production' ? 'production' : 'sandbox'; }
function grow_(method, payload) {
  const base = growEnv_() === 'production' ? 'https://secure.meshulam.co.il' : 'https://sandbox.meshulam.co.il';
  const r = UrlFetchApp.fetch(base + '/api/light/server/1.0/' + method, { method: 'post', payload: payload, muteHttpExceptions: true });
  try { return JSON.parse(r.getContentText()); } catch (x) { console.error(method + ' HTTP ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300)); return null; }
}
function flatParams_(e) {
  const p = {};
  Object.keys(e.parameter || {}).forEach(function (k) { p[k] = e.parameter[k]; });
  const t = e.postData && e.postData.type || '';
  if (/json/.test(t)) {
    try {
      const walk = function (o, pre) { Object.keys(o || {}).forEach(function (k) { const key = pre ? pre + '[' + k + ']' : k; if (o[k] && typeof o[k] === 'object') walk(o[k], key); else p[key] = o[k]; }); };
      walk(JSON.parse(e.postData.contents), '');
    } catch (x) {}
  }
  return p;
}
function verifyUser_(idToken) {
  if (!idToken) return null;
  const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + prop_('FIREBASE_API_KEY'), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  const u = (JSON.parse(r.getContentText()).users || [])[0];
  return u && u.localId ? { uid: u.localId, email: u.email || '' } : null;
}
function addMonths_(t, n) { const d = new Date(t); const day = d.getDate(); d.setMonth(d.getMonth() + n); if (d.getDate() < day) d.setDate(0); return d.getTime(); }
function logSale_(order, sum, tx, until) {
  const id = prop_('SALES_SHEET_ID'); if (!id) return;
  try { SpreadsheetApp.openById(id).getSheets()[0].appendRow([new Date(), order.em || '', order.uid, order.plan === 'y' ? 'שנה' : 'חודש', sum, tx, new Date(until)]); } catch (x) { console.warn('sales sheet: ' + x); }
}

/* Firestore REST with the owner's permission */
function fsUrl_(path) { return 'https://firestore.googleapis.com/v1/projects/' + prop_('FIREBASE_PROJECT') + '/databases/(default)/documents/' + path; }
function fsFetch_(url, opt) {
  opt = opt || {}; opt.muteHttpExceptions = true; opt.headers = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  if (opt.payload) opt.contentType = 'application/json';
  const r = UrlFetchApp.fetch(url, opt), c = r.getResponseCode();
  if (c === 404) return null;
  if (c >= 300) throw new Error('Firestore ' + c + ': ' + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText() || '{}');
}
function fsGet_(path) { const j = fsFetch_(fsUrl_(path)); return j ? dec_({ mapValue: { fields: j.fields || {} } }) : null; }
function fsSet_(path, obj) { return fsFetch_(fsUrl_(path), { method: 'patch', payload: JSON.stringify({ fields: encFields_(obj) }) }); }
function fsPatch_(path, obj) {
  const mask = Object.keys(obj).map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
  return fsFetch_(fsUrl_(path) + '?' + mask, { method: 'patch', payload: JSON.stringify({ fields: encFields_(obj) }) });
}
function enc_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc_) } };
  if (typeof v === 'object') return { mapValue: { fields: encFields_(v) } };
  return { stringValue: String(v) };
}
function encFields_(o) { const f = {}; Object.keys(o).forEach(function (k) { f[k] = enc_(o[k]); }); return f; }
function dec_(x) {
  if (!x) return null;
  if ('stringValue' in x) return x.stringValue;
  if ('integerValue' in x) return +x.integerValue;
  if ('doubleValue' in x) return +x.doubleValue;
  if ('booleanValue' in x) return x.booleanValue;
  if ('nullValue' in x) return null;
  if ('timestampValue' in x) return Date.parse(x.timestampValue);
  if ('arrayValue' in x) return (x.arrayValue.values || []).map(dec_);
  if ('mapValue' in x) { const o = {}; const f = x.mapValue.fields || {}; Object.keys(f).forEach(function (k) { o[k] = dec_(f[k]); }); return o; }
  return null;
}
