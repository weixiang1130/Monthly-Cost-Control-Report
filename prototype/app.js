// Monthly Cost Report — Prototype v0.3
// Business logic (aligned with legacy app):
//   cumulative income = prev month AccRealAmt + this month TargetAmount (user input)
//   cumulative cost   = this month AccRealCost + this month MonthlyEstimatedCost (user input)
//   YTD actual cost   = YearRealCost + this month MonthlyEstimatedCost
//   YTD cost diff     = (YTD actual cost) - YearEstCost
//   cumulative cost % = (cumulative cost) / BudgetRevisedAmt
//   monthly rate      = MonthlyEstimatedCost / EstCost (this month)
// Write design: each editable field has its own save button (partial UPSERT to MonthlyReportDesc)

const DATA = window.APP_DATA;

const state = {
  currentProjectId: 'P001',
  currentMonthEnd: null,
  targetAmount: 0,
  monthlyEstimatedCost: 0,
  amtDesc: '',
  solDesc: '',
  dirty: { target: false, est: false, amt: false, sol: false },
  lastSaved: { target: null, est: null, amt: null, sol: null },
  // Keys (`ProjectID|MonthEnd`) manually locked to simulate month-end close
  lockedKeys: new Set(),
};

const fmt = {
  num: (v) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }),
  pct: (v) => v == null || isNaN(v) ? '—' : (Number(v) * 100).toFixed(2) + ' %',
  date: (s) => {
    if (s == null) return '—';
    s = String(s).trim();
    if (!s) return '—';
    const m = s.match(/\/Date\((\-?\d+)\)\//);
    if (m) {
      const d = new Date(parseInt(m[1]));
      return d.toLocaleDateString('en-CA').replace(/-/g, '/');
    }
    if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.substring(0, 10).replace(/-/g, '/');
    return s.replace(/T.*$/, '');
  },
  rocDate: (s) => {
    if (!s) return '—';
    s = String(s).trim();
    const m = s.match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const y = parseInt(m[1]) + 1911;
      return `${y}/${m[2].padStart(2,'0')}/${m[3].padStart(2,'0')}`;
    }
    return s;
  },
  monthShort: (s) => {
    if (!s) return '—';
    s = String(s).trim();
    const m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (m) return `${m[1]} / ${m[2]}`;
    return s;
  }
};

// ===== HTML whitelist sanitizer (front-line XSS defense; production also runs server-side HtmlSanitizer) =====
const SANITIZE = {
  allowedTags: new Set(['P','BR','B','STRONG','I','EM','U','S','SPAN','DIV','UL','OL','LI','A','FONT','H1','H2','H3','H4','BLOCKQUOTE','IMG']),
  dropTags: new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','LINK','META','FORM','INPUT','BUTTON','SVG','MATH','BASE']),
  allowedAttrs: { A:['href','title','target','rel'], IMG:['src','alt','width','height'], FONT:['color','face'],
                  SPAN:['style'], P:['style'], DIV:['style'], LI:['style'], H1:['style'], H2:['style'], H3:['style'] },
  allowedStyle: new Set(['color','background-color','font-weight','font-style','text-decoration','text-align','margin','margin-left','margin-bottom','padding-left']),
};
function _safeUrl(u){ u=(u||'').trim(); return /^(javascript|vbscript|file|data):/i.test(u) ? null : u; }
function _safeImg(u){ u=(u||'').trim(); return (/^data:image\//i.test(u) || /^https?:\/\//i.test(u)) ? u : null; }
function _cleanStyle(s){
  return (s||'').split(';').map(d=>d.trim()).filter(Boolean).filter(d=>{
    const p=d.split(':')[0].trim().toLowerCase(), v=d.slice(d.indexOf(':')+1).toLowerCase();
    return SANITIZE.allowedStyle.has(p) && !/url\(|expression\(|javascript:/i.test(v);
  }).join('; ');
}
function _cleanAttrs(el){
  [...el.attributes].forEach(a=>{
    const name=a.name.toLowerCase(), allowed=SANITIZE.allowedAttrs[el.tagName]||[];
    if (name.startsWith('on') || !allowed.includes(name)) { el.removeAttribute(a.name); return; }
    if (name==='href'){ const s=_safeUrl(a.value); s===null?el.removeAttribute(a.name):el.setAttribute('href',s); }
    else if (name==='src'){ const s=_safeImg(a.value); if(s===null) el.remove(); else el.setAttribute('src',s); }
    else if (name==='style'){ const s=_cleanStyle(a.value); s?el.setAttribute('style',s):el.removeAttribute('style'); }
  });
}
function _sanitizeFragment(root){
  [...root.childNodes].forEach(child=>{
    if (child.nodeType === 8){ child.remove(); return; }
    if (child.nodeType !== 1) return;
    const tag = child.tagName;
    if (SANITIZE.dropTags.has(tag)){ child.remove(); return; }
    if (!SANITIZE.allowedTags.has(tag)){
      _sanitizeFragment(child);
      while (child.firstChild) root.insertBefore(child.firstChild, child);
      child.remove(); return;
    }
    _cleanAttrs(child);
    _sanitizeFragment(child);
  });
}
function sanitizeHtml(html){
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html == null ? '' : html);
  _sanitizeFragment(tpl.content);
  return tpl.innerHTML;
}

function findProjectAttr(projectId) {
  return DATA.projects.find(p => String(p.ProjectID).trim() === projectId);
}

// Show only active projects (exclude settled/closed). Real BI snapshot statuses
// are "執行中 / 預算未鎖檔 / 已結算"; treat any "結算/結案" status as closed.
function getActiveProjects() {
  return DATA.projects.filter(p => {
    const s = String(p.ProjectStatus || '').trim();
    return !s.includes('結算') && !s.includes('結案');
  });
}
function getMonthsForProject(projectId) {
  return DATA.months
    .filter(m => String(m.ProjectID).trim() === projectId)
    .sort((a, b) => String(b.MonthEnd).localeCompare(String(a.MonthEnd)));
}
function findMonthRow(projectId, monthEnd) {
  return DATA.months.find(m =>
    String(m.ProjectID).trim() === projectId &&
    String(m.MonthEnd).trim() === monthEnd);
}
function findPrevMonthRow(projectId, monthEnd) {
  const months = getMonthsForProject(projectId);
  const idx = months.findIndex(m => String(m.MonthEnd).trim() === monthEnd);
  if (idx >= 0 && idx + 1 < months.length) return months[idx + 1];
  return null;
}
function getPaymentsForProject(projectId, monthEnd) {
  const ym = monthEnd ? monthEnd.substring(0, 7) : null;
  return DATA.payments
    .filter(p => String(p.ProjectID).trim() === projectId)
    .filter(p => {
      if (!ym || !p.PayDate) return true;
      const w = String(p.PayDate).match(/^(\d{2,3})-(\d{1,2})-/);
      if (!w) return true;
      const year = parseInt(w[1]) + 1911;
      const month = w[2].padStart(2, '0');
      return `${year}/${month}` === ym;
    });
}

function computeProfitRate(contract, budget) {
  if (!contract || contract === 0) return null;
  return (contract - budget) / contract;
}
// Cumulative income = prev AccRealAmt + this month TargetAmount
function computeAccRealAmtDisplay(prevMonthRow, targetAmount) {
  const prev = prevMonthRow ? Number(prevMonthRow.AccRealAmt || 0) : 0;
  const cur = Number(targetAmount || 0);
  return prev + cur;
}
// Cumulative cost = this month AccRealCost + this month MonthlyEstimatedCost
function computeAccRealCostDisplay(monthRow, monthlyEstCost) {
  const base = monthRow ? Number(monthRow.AccRealCost || 0) : 0;
  return base + Number(monthlyEstCost || 0);
}
// YTD actual cost = YearRealCost + this month MonthlyEstimatedCost
function computeYearRealCostDisplay(monthRow, monthlyEstCost) {
  const base = monthRow ? Number(monthRow.YearRealCost || 0) : 0;
  return base + Number(monthlyEstCost || 0);
}

function renderProjectMenu() {
  const menu = document.getElementById('projmenu');
  menu.innerHTML = '';
  getActiveProjects().forEach(p => {
    const div = document.createElement('div');
    div.className = 'item';
    if (p.ProjectID === state.currentProjectId) div.classList.add('sel');
    div.dataset.pid = p.ProjectID;
    div.innerHTML = `<span>${p.ProjectID} — ${p.ProjectName || ''}</span><span class="meta">${p.ProjectStatus || ''}</span>`;
    div.addEventListener('click', () => {
      switchProject(p.ProjectID);
      menu.classList.remove('open');
    });
    menu.appendChild(div);
  });
}

function renderMonthSelector() {
  const sel = document.getElementById('monthsel');
  const months = getMonthsForProject(state.currentProjectId);
  sel.innerHTML = '';
  months.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.MonthEnd;
    opt.textContent = fmt.monthShort(m.MonthEnd);
    sel.appendChild(opt);
  });
  if (state.currentMonthEnd) sel.value = state.currentMonthEnd;
}

function switchProject(pid) {
  if (hasAnyDirty() && !confirm('Discard unsaved changes and switch project?')) return;
  state.currentProjectId = pid;
  const months = getMonthsForProject(pid);
  state.currentMonthEnd = months.length > 0 ? months[0].MonthEnd : null;
  loadEditableState();
  renderMonthSelector();
  render();
}
function switchMonth(monthEnd) {
  if (hasAnyDirty() && !confirm('Discard unsaved changes and switch month?')) return;
  state.currentMonthEnd = monthEnd;
  loadEditableState();
  render();
}

// Demo reference values mimicking what migrated data would look like once
// the desc table is populated and the subcontract snapshot view is accessible.
const DEMO_REFERENCE = {
  // 'ProjectID|MonthEnd': { targetAmount, monthlyEstimatedCost }
  // populated by hand for a few sample cases; everything else defaults to 0
};
function loadEditableState() {
  const pid = state.currentProjectId;
  const me = state.currentMonthEnd;
  const ref = DEMO_REFERENCE[`${pid}|${me}`] || {
    targetAmount: (pid === 'P001') ? 42300000 : 0,
    monthlyEstimatedCost: 0,
  };
  state.targetAmount = ref.targetAmount;
  state.monthlyEstimatedCost = ref.monthlyEstimatedCost;
  state.amtDesc = (pid === 'P001')
    ? `<p style="margin:0 0 8px">1. This month and cumulative cost <span style="color:#138a51">both met the target</span>, <span style="color:#1366b1">(cumulative rate ~96%)</span>.</p><p style="margin:0">2. This month's revenue achieved the target.</p>`
    : `<p style="margin:0;color:#888"><i>(No content yet for project ${pid} month ${me} — edit and save)</i></p>`;
  state.solDesc = (pid === 'P001')
    ? `<p style="margin:0 0 8px"><b style="color:#c50f1f">Warning:</b> extended end date approaching.</p><p style="margin:0">Action: coordinate trades and track milestones weekly.</p>`
    : `<p style="margin:0;color:#888"><i>(No content yet for project ${pid} month ${me} — edit and save)</i></p>`;
  state.dirty = { target: false, est: false, amt: false, sol: false };
  state.lastSaved = { target: null, est: null, amt: null, sol: null };
  updateDirtyTags();
}

// ===== Lock / readonly / validation =====
// Mirrors Power Apps: only the latest month is editable; older months are
// readonly; the current month can also be locked to simulate month-end close.
function isLatestMonth(projectId, monthEnd) {
  const months = getMonthsForProject(projectId);
  return months.length > 0 && String(months[0].MonthEnd).trim() === monthEnd;
}
function lockKey() { return `${state.currentProjectId}|${state.currentMonthEnd}`; }
function isManuallyLocked() { return state.lockedKeys.has(lockKey()); }
function isEditableNow() {
  return isLatestMonth(state.currentProjectId, state.currentMonthEnd) && !isManuallyLocked();
}

// Monthly income validation: empty allowed (optional); else non-negative integer
function validateTarget() {
  const raw = document.getElementById('targetAmount').value;
  if (raw === '' || raw == null) return { ok: true, msg: '' };
  const n = Number(raw);
  if (isNaN(n)) return { ok: false, msg: 'Enter a number' };
  if (n < 0) return { ok: false, msg: 'Cannot be negative' };
  if (!Number.isInteger(n)) return { ok: false, msg: 'Enter an integer' };
  return { ok: true, msg: '' };
}
function refreshTargetValidation() {
  const v = validateTarget();
  const input = document.getElementById('targetAmount');
  const err = document.getElementById('errTarget');
  input.classList.toggle('invalid', !v.ok);
  err.style.display = v.ok ? 'none' : '';
  err.textContent = v.msg;
  const save = document.getElementById('saveTarget');
  if (save) save.disabled = !isEditableNow() || !v.ok;
  return v.ok;
}

function applyLockState() {
  const editable = isEditableNow();
  const latest = isLatestMonth(state.currentProjectId, state.currentMonthEnd);
  const lockedManual = isManuallyLocked();

  const target = document.getElementById('targetAmount');
  const est = document.getElementById('monthlyEstimatedCost');
  if (target) target.disabled = !editable;
  if (est) est.disabled = !editable;

  ['amtDesc', 'solDesc'].forEach(id => {
    const body = document.getElementById(id);
    if (!body) return;
    body.setAttribute('contenteditable', editable ? 'true' : 'false');
    body.classList.toggle('readonly', !editable);
    const rt = body.closest('.rt');
    if (rt) rt.classList.toggle('readonly', !editable);
  });

  ['saveTarget', 'saveAmt', 'saveSol'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = !editable;
  });

  const toggle = document.getElementById('lockToggle');
  if (latest) {
    toggle.style.display = '';
    toggle.textContent = lockedManual ? '🔓 Unlock month-end' : '🔒 Simulate month-end lock';
    toggle.classList.toggle('locked', lockedManual);
  } else {
    toggle.style.display = 'none';
  }

  const banner = document.getElementById('lockBanner');
  if (!latest) {
    banner.style.display = '';
    banner.className = 'lock-banner history';
    banner.textContent = '📖 Historical month — readonly (only the latest month is editable, mirroring Power Apps)';
  } else if (lockedManual) {
    banner.style.display = '';
    banner.className = 'lock-banner locked';
    banner.textContent = '🔒 This month is locked (month-end close) — readonly. Click “Unlock month-end” to edit.';
  } else {
    banner.style.display = 'none';
  }
}

function render() {
  const pid = state.currentProjectId;
  const attr = findProjectAttr(pid);
  const monthEnd = state.currentMonthEnd;
  const monthRow = findMonthRow(pid, monthEnd);
  const prevMonthRow = findPrevMonthRow(pid, monthEnd);

  document.getElementById('pid').textContent = pid;
  document.getElementById('projname').value = attr ? attr.ProjectName : pid;
  document.getElementById('reportDate').textContent = monthEnd ? fmt.date(monthEnd) : '—';

  document.getElementById('expStartDate').textContent = attr ? fmt.date(attr.ExpStartDate) : '—';
  document.getElementById('expEndDate').textContent = attr ? fmt.date(attr.ExpEndDate) : '—';
  document.getElementById('extEndDate').textContent = attr ? fmt.date(attr.ExtentionEndDate) : '—';

  document.getElementById('contractAmt').textContent = attr ? fmt.num(attr.ContractAmt) : '—';
  document.getElementById('budgetAmt').textContent = attr ? fmt.num(attr.BudgetAmt) : '—';
  document.getElementById('origProfitRate').textContent = attr ? fmt.pct(computeProfitRate(attr.ContractAmt, attr.BudgetAmt)) : '—';

  document.getElementById('contractRevisedAmt').textContent = attr ? fmt.num(attr.ContractRevisedAmt) : '—';
  document.getElementById('budgetRevisedAmt').textContent = attr ? fmt.num(attr.BudgetRevisedAmt) : '—';
  document.getElementById('revProfitRate').textContent = attr ? fmt.pct(computeProfitRate(attr.ContractRevisedAmt, attr.BudgetRevisedAmt)) : '—';

  // Aligned with legacy app formulas (2026-06-22)
  const accRealAmtCalc = computeAccRealAmtDisplay(prevMonthRow, state.targetAmount);
  const accRealCostCalc = computeAccRealCostDisplay(monthRow, state.monthlyEstimatedCost);
  document.getElementById('accRealAmtCalc').textContent = fmt.num(accRealAmtCalc);
  document.getElementById('accRealCost').textContent = fmt.num(accRealCostCalc);
  const accDiff = accRealAmtCalc - accRealCostCalc;
  const accDiffEl = document.getElementById('accRealDiff');
  accDiffEl.textContent = fmt.num(accDiff);
  accDiffEl.classList.toggle('neg', accDiff < 0);

  document.getElementById('yearEstCost').textContent = monthRow ? fmt.num(monthRow.YearEstCost) : '—';
  const yearRealCostCalc = computeYearRealCostDisplay(monthRow, state.monthlyEstimatedCost);
  document.getElementById('yearRealCost').textContent = monthRow ? fmt.num(yearRealCostCalc) : '—';
  const yearDiff = monthRow ? yearRealCostCalc - Number(monthRow.YearEstCost || 0) : 0;
  document.getElementById('yearCostDiff').textContent = monthRow ? fmt.num(yearDiff) : '—';

  document.getElementById('estCost').textContent = monthRow ? fmt.num(monthRow.EstCost) : '—';
  document.getElementById('realCost').textContent = fmt.num(state.monthlyEstimatedCost);
  const monthEst = monthRow ? Number(monthRow.EstCost || 0) : 0;
  const monthAchieve = monthEst > 0 ? state.monthlyEstimatedCost / monthEst : 0;
  document.getElementById('monthAchieve').textContent = monthRow ? fmt.pct(monthAchieve) : '—';

  const budgetRev = attr ? Number(attr.BudgetRevisedAmt || 0) : 0;
  const accCostRate = budgetRev > 0 ? accRealCostCalc / budgetRev : 0;
  document.getElementById('kpiAccCostRate').textContent = monthRow ? fmt.pct(accCostRate) : '—';

  // Do not overwrite the field currently being edited (preserves decimals / mid-typing)
  const targetEl = document.getElementById('targetAmount');
  if (document.activeElement !== targetEl) targetEl.value = state.targetAmount || '';
  const estEl = document.getElementById('monthlyEstimatedCost');
  if (estEl && document.activeElement !== estEl) estEl.value = state.monthlyEstimatedCost || '';
  const amtEl = document.getElementById('amtDesc');
  if (document.activeElement !== amtEl) amtEl.innerHTML = state.amtDesc;
  const solEl = document.getElementById('solDesc');
  if (document.activeElement !== solEl) solEl.innerHTML = state.solDesc;

  renderPayments();

  // Lock / readonly state + field validation
  applyLockState();
  refreshTargetValidation();

  updateLastSavedDisplay();
  renderDevPanel(pid, monthEnd, prevMonthRow ? prevMonthRow.MonthEnd : null, prevMonthRow, monthRow, accRealAmtCalc, accRealCostCalc);
}

function renderPayments() {
  const pid = state.currentProjectId;
  const me = state.currentMonthEnd;
  const tbody = document.getElementById('payRows');
  tbody.innerHTML = '';
  const payments = getPaymentsForProject(pid, me);
  if (payments.length === 0) {
    tbody.innerHTML = '<tr class="empty"><td colspan="5">No payment records this month</td></tr>';
    document.getElementById('payCount').textContent = '0';
    document.getElementById('payRatio').textContent = '0.00 %';
    document.getElementById('payAmount').textContent = '—';
    document.getElementById('payAmountRatio').textContent = '0.00 %';
    return;
  }
  const sorted = [...payments].sort((a, b) => String(b.PayDate || '').localeCompare(String(a.PayDate || '')));
  sorted.slice(0, 20).forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.ContractName || ''}</td>
      <td>${p.VendorName || ''}</td>
      <td class="n">${fmt.num(p.Amount)}</td>
      <td class="c">${p.PayPhase || ''}</td>
      <td class="c">${fmt.rocDate(p.PayDate)}</td>
    `;
    tbody.appendChild(tr);
  });
  const billing = payments.filter(p => p.IsBill === true || String(p.IsBill).toLowerCase() === 'true');
  const paying = payments.filter(p => p.IsPay === true || String(p.IsPay).toLowerCase() === 'true');
  const billCount = billing.length;
  const payCount = paying.length;
  const billSum = billing.reduce((s, p) => s + Number(p.Amount || 0), 0);
  const paySum = paying.reduce((s, p) => s + Number(p.Amount || 0), 0);
  document.getElementById('payCount').textContent = payCount;
  document.getElementById('payRatio').textContent = billCount > 0 ? (payCount / billCount * 100).toFixed(2) + ' %' : '0.00 %';
  document.getElementById('payAmount').textContent = fmt.num(paySum);
  document.getElementById('payAmountRatio').textContent = billSum > 0 ? (paySum / billSum * 100).toFixed(2) + ' %' : '0.00 %';
}

function renderDevPanel(pid, monthEnd, prevMonthEnd, prevMonthRow, monthRow, accRealAmtCalc, accRealCostCalc) {
  const prevAccReal = prevMonthRow ? Number(prevMonthRow.AccRealAmt || 0) : 0;
  const baseAccCost = monthRow ? Number(monthRow.AccRealCost || 0) : 0;
  const html = `
    <div><span class="k">ProjectID:</span> <span class="v">${pid}</span></div>
    <div><span class="k">MonthEnd:</span> <span class="v">${monthEnd}</span></div>
    <div><span class="k">PrevMonth:</span> <span class="v">${prevMonthEnd || '(none)'}</span></div>
    <hr style="border-color:#444;margin:6px 0">
    <div><span class="k">// Cumulative income:</span></div>
    <div>= prev AccRealAmt + this TargetAmount</div>
    <div><span class="k">  Prev AccRealAmt:</span> <span class="v">${fmt.num(prevAccReal)}</span></div>
    <div><span class="k">  This TargetAmount:</span> <span class="v">${fmt.num(state.targetAmount)}</span></div>
    <div><span class="k">  → Cumulative income:</span> <span class="v" style="color:#82dded">${fmt.num(accRealAmtCalc)}</span></div>
    <hr style="border-color:#444;margin:6px 0">
    <div><span class="k">// Cumulative cost:</span></div>
    <div>= this AccRealCost + this MonthlyEstimatedCost</div>
    <div><span class="k">  This AccRealCost:</span> <span class="v">${fmt.num(baseAccCost)}</span></div>
    <div><span class="k">  MonthlyEstimatedCost:</span> <span class="v">${fmt.num(state.monthlyEstimatedCost)}</span></div>
    <div><span class="k">  → Cumulative cost:</span> <span class="v" style="color:#82dded">${fmt.num(accRealCostCalc)}</span></div>
    <hr style="border-color:#444;margin:6px 0">
    <div><span class="k">// 4 per-field UPSERTs:</span></div>
    <div>MonthlyReportDesc (PK: ProjectID + MonthEnd)</div>
    <div><span class="k">  TargetAmount:</span> ${fmt.num(state.targetAmount)} ${state.dirty.target?'⚠':''}</div>
    <div><span class="k">  MonthlyEstimatedCost:</span> ${fmt.num(state.monthlyEstimatedCost)} ${state.dirty.est?'⚠':''} <span style="color:#ff6">⚠ schema TBD</span></div>
    <div><span class="k">  AmtDesc:</span> ${state.amtDesc.length} chars ${state.dirty.amt?'⚠':''}</div>
    <div><span class="k">  SolDesc:</span> ${state.solDesc.length} chars ${state.dirty.sol?'⚠':''}</div>
    <hr style="border-color:#444;margin:6px 0">
    <div><span class="k">Data scale:</span> ${DATA.counts.projects} projects / ${DATA.counts.months} months / ${DATA.counts.payments} payments</div>
  `;
  document.getElementById('devInfo').innerHTML = html;
}

function hasAnyDirty() { return state.dirty.target || state.dirty.est || state.dirty.amt || state.dirty.sol; }
function markDirty(field) { if (state.dirty[field]) return; state.dirty[field] = true; updateDirtyTags(); }
function clearDirty(field) { state.dirty[field] = false; state.lastSaved[field] = new Date().toISOString(); updateDirtyTags(); }

function updateDirtyTags() {
  document.getElementById('dirtyTarget').style.display = state.dirty.target ? '' : 'none';
  const dEst = document.getElementById('dirtyEst');
  if (dEst) dEst.style.display = state.dirty.est ? '' : 'none';
  document.getElementById('dirtyAmt').style.display = state.dirty.amt ? '' : 'none';
  document.getElementById('dirtySol').style.display = state.dirty.sol ? '' : 'none';
  const g = document.getElementById('globalDirty');
  if (hasAnyDirty()) { g.className = 'dirty'; g.textContent = '⚠ Unsaved changes'; }
  else { g.className = 'clean'; g.textContent = '✓ All saved'; }
  updateLastSavedDisplay();
}

function updateLastSavedDisplay() {
  const times = Object.values(state.lastSaved).filter(t => t);
  if (times.length === 0) { document.getElementById('lasttime').textContent = 'never'; }
  else {
    const latest = times.sort().pop();
    document.getElementById('lasttime').textContent = new Date(latest).toLocaleString('en-US');
  }
}

function setupInteractions() {
  const input = document.getElementById('projname');
  const menu = document.getElementById('projmenu');
  input.addEventListener('click', () => menu.classList.toggle('open'));
  document.addEventListener('click', (e) => { if (!e.target.closest('.projsel')) menu.classList.remove('open'); });

  document.getElementById('monthsel').addEventListener('change', (e) => switchMonth(e.target.value));

  const target = document.getElementById('targetAmount');
  target.addEventListener('input', () => {
    state.targetAmount = Number(target.value) || 0;
    markDirty('target'); render();
  });
  const est = document.getElementById('monthlyEstimatedCost');
  if (est) est.addEventListener('input', () => {
    state.monthlyEstimatedCost = Number(est.value) || 0;
    markDirty('est'); render();
  });
  document.getElementById('amtDesc').addEventListener('input', () => {
    state.amtDesc = document.getElementById('amtDesc').innerHTML;
    markDirty('amt');
  });
  document.getElementById('solDesc').addEventListener('input', () => {
    state.solDesc = document.getElementById('solDesc').innerHTML;
    markDirty('sol');
  });

  document.querySelectorAll('.rt').forEach(rt => {
    const body = rt.querySelector('.rt-body');
    rt.querySelectorAll('.tb[data-cmd]').forEach(btn => {
      btn.addEventListener('mousedown', (ev) => {
        ev.preventDefault(); body.focus();
        let val = null;
        if (btn.dataset.prompt) { val = prompt('URL:'); if (!val) return; }
        document.execCommand(btn.dataset.cmd, false, val);
        body.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  });

  setupSaveButton('saveTarget', 'target', 'monthly income', () => ({ TargetAmount: state.targetAmount }));
  setupSaveButton('saveAmt', 'amt', 'cost/income notes', () => ({ AmtDesc: state.amtDesc }));
  setupSaveButton('saveSol', 'sol', 'warnings & actions', () => ({ SolDesc: state.solDesc }));

  // Month-end lock toggle (simulated)
  document.getElementById('lockToggle').addEventListener('click', () => {
    const key = lockKey();
    if (state.lockedKeys.has(key)) {
      state.lockedKeys.delete(key);
    } else {
      if (hasAnyDirty() && !confirm('You have unsaved changes; locking makes this month readonly. Continue?')) return;
      state.lockedKeys.add(key);
    }
    render();
  });

  document.querySelector('.devpanel-h').addEventListener('click', () => {
    document.getElementById('devpanel').classList.toggle('collapsed');
  });
}

function setupSaveButton(btnId, field, label, payloadFn) {
  const btn = document.getElementById(btnId);
  btn.addEventListener('click', () => {
    if (!state.dirty[field]) { showToast(`No changes for "${label}"`, true); return; }
    // Rich-text fields: sanitize HTML before saving (front-line XSS defense)
    if (field === 'amt' || field === 'sol') {
      const k = field === 'amt' ? 'amtDesc' : 'solDesc';
      const cleaned = sanitizeHtml(state[k]);
      if (cleaned !== state[k]) {
        state[k] = cleaned;
        document.getElementById(k).innerHTML = cleaned;
        showToast('⚠ Removed unsafe HTML content (XSS protection)', true);
      }
    }
    const original = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '⌛ Saving...';
    setTimeout(() => {
      const payload = payloadFn();
      console.log(`[simulated UPSERT] MonthlyReportDesc`, {
        ProjectID: state.currentProjectId,
        MonthEnd: state.currentMonthEnd,
        ...payload
      });
      clearDirty(field);
      btn.disabled = false; btn.innerHTML = original;
      showToast(`✓ Saved "${label}" (simulated UPSERT to MonthlyReportDesc)`);
      render();
    }, 600);
  });
}

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.classList.remove('show'), 2500);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!DATA || !DATA.projects) {
    document.body.innerHTML = '<div style="padding:40px;color:#c50f1f">⚠ Failed to load mock-data.js</div>';
    return;
  }
  renderProjectMenu();
  switchProject('P001');
  setupInteractions();
});
