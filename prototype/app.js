// Monthly Cost Report — Prototype v0.2
// Business logic: cumulative income = prev month AccRealAmt + this month TargetAmount
// Write design: each editable field has its own save button (partial UPSERT to MonthlyReportDesc)

const DATA = window.APP_DATA;

const state = {
  currentProjectId: 'P001',
  currentMonthEnd: null,
  targetAmount: 0,
  amtDesc: '',
  solDesc: '',
  dirty: { target: false, amt: false, sol: false },
  lastSaved: { target: null, amt: null, sol: null },
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

function findProjectAttr(projectId) {
  return DATA.projects.find(p => String(p.ProjectID).trim() === projectId);
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
function computeAccRealAmtDisplay(prevMonthRow, targetAmount) {
  const prev = prevMonthRow ? Number(prevMonthRow.AccRealAmt || 0) : 0;
  const cur = Number(targetAmount || 0);
  return prev + cur;
}

function renderProjectMenu() {
  const menu = document.getElementById('projmenu');
  menu.innerHTML = '';
  DATA.projects.forEach(p => {
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

function loadEditableState() {
  const pid = state.currentProjectId;
  const me = state.currentMonthEnd;
  state.targetAmount = (pid === 'P001') ? 42300000 : 0;
  state.amtDesc = (pid === 'P001')
    ? `<p style="margin:0 0 8px">1. This month and cumulative cost <span style="color:#138a51">both met the target</span>, <span style="color:#1366b1">(cumulative rate ~96%)</span>.</p><p style="margin:0">2. This month's revenue achieved the target.</p>`
    : `<p style="margin:0;color:#888"><i>(No content yet for project ${pid} month ${me} — edit and save)</i></p>`;
  state.solDesc = (pid === 'P001')
    ? `<p style="margin:0 0 8px"><b style="color:#c50f1f">Warning:</b> extended end date approaching.</p><p style="margin:0">Action: coordinate trades and track milestones weekly.</p>`
    : `<p style="margin:0;color:#888"><i>(No content yet for project ${pid} month ${me} — edit and save)</i></p>`;
  state.dirty = { target: false, amt: false, sol: false };
  state.lastSaved = { target: null, amt: null, sol: null };
  updateDirtyTags();
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

  const accRealAmtCalc = computeAccRealAmtDisplay(prevMonthRow, state.targetAmount);
  document.getElementById('accRealAmtCalc').textContent = fmt.num(accRealAmtCalc);
  const accRealCost = monthRow ? Number(monthRow.AccRealCost || 0) : 0;
  document.getElementById('accRealCost').textContent = fmt.num(accRealCost);
  const accDiff = accRealAmtCalc - accRealCost;
  const accDiffEl = document.getElementById('accRealDiff');
  accDiffEl.textContent = fmt.num(accDiff);
  accDiffEl.classList.toggle('neg', accDiff < 0);

  document.getElementById('yearEstCost').textContent = monthRow ? fmt.num(monthRow.YearEstCost) : '—';
  document.getElementById('yearRealCost').textContent = monthRow ? fmt.num(monthRow.YearRealCost) : '—';
  const yearDiff = monthRow ? Number(monthRow.YearEstCost || 0) - Number(monthRow.YearRealCost || 0) : 0;
  document.getElementById('yearCostDiff').textContent = monthRow ? fmt.num(yearDiff) : '—';

  document.getElementById('estCost').textContent = monthRow ? fmt.num(monthRow.EstCost) : '—';
  document.getElementById('realCost').textContent = monthRow ? fmt.num(monthRow.RealCost) : '—';
  document.getElementById('monthAchieve').textContent = monthRow ? fmt.pct(monthRow.YearCostExecRate) : '—';

  document.getElementById('kpiAccCostRate').textContent = monthRow ? fmt.pct(monthRow.AccRealCostRate) : '—';

  document.getElementById('targetAmount').value = state.targetAmount || '';
  document.getElementById('amtDesc').innerHTML = state.amtDesc;
  document.getElementById('solDesc').innerHTML = state.solDesc;

  renderPayments();
  updateLastSavedDisplay();
  renderDevPanel(pid, monthEnd, prevMonthRow ? prevMonthRow.MonthEnd : null, prevMonthRow, accRealAmtCalc);
}

function renderPayments() {
  const pid = state.currentProjectId;
  const me = state.currentMonthEnd;
  const tbody = document.getElementById('payRows');
  tbody.innerHTML = '';
  const payments = getPaymentsForProject(pid, me);
  if (payments.length === 0) {
    tbody.innerHTML = '<tr class="empty"><td colspan="7">No payment records this month</td></tr>';
    document.getElementById('payCount').textContent = '0';
    document.getElementById('payRatio').textContent = '0.00 %';
    document.getElementById('payAmount').textContent = '—';
    document.getElementById('payAmountRatio').textContent = '0.00 %';
    return;
  }
  const sorted = [...payments].sort((a, b) => String(b.PayDate || '').localeCompare(String(a.PayDate || '')));
  sorted.slice(0, 20).forEach(p => {
    const tr = document.createElement('tr');
    const isPay = p.IsPay === true || String(p.IsPay).toLowerCase() === 'true';
    tr.innerHTML = `
      <td class="c ${isPay ? 'pay-y' : 'pay-n'}">${isPay ? '✓' : '—'}</td>
      <td>${p.ContractName || ''}</td>
      <td>${p.VendorName || ''}</td>
      <td class="n">${fmt.num(p.Amount)}</td>
      <td class="c">${p.PayPhase || ''}</td>
      <td class="c">${fmt.rocDate(p.PayDate)}</td>
      <td class="c" style="color:#888">${p.Status || ''}</td>
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

function renderDevPanel(pid, monthEnd, prevMonthEnd, prevMonthRow, accRealAmtCalc) {
  const prevAccReal = prevMonthRow ? Number(prevMonthRow.AccRealAmt || 0) : 0;
  const html = `
    <div><span class="k">ProjectID:</span> <span class="v">${pid}</span></div>
    <div><span class="k">MonthEnd:</span> <span class="v">${monthEnd}</span></div>
    <div><span class="k">PrevMonth:</span> <span class="v">${prevMonthEnd || '(none)'}</span></div>
    <hr style="border-color:#444;margin:6px 0">
    <div><span class="k">// Cumulative income logic:</span></div>
    <div>= prev AccRealAmt + this TargetAmount</div>
    <div><span class="k">Prev AccRealAmt:</span> <span class="v">${fmt.num(prevAccReal)}</span></div>
    <div><span class="k">This TargetAmount:</span> <span class="v">${fmt.num(state.targetAmount)}</span></div>
    <div><span class="k">→ Cumulative income:</span> <span class="v" style="color:#82dded">${fmt.num(accRealAmtCalc)}</span></div>
    <hr style="border-color:#444;margin:6px 0">
    <div><span class="k">// Per-field UPSERTs:</span></div>
    <div>MonthlyReportDesc (PK: ProjectID + MonthEnd)</div>
    <div><span class="k">  TargetAmount:</span> ${fmt.num(state.targetAmount)} ${state.dirty.target?'⚠':''}</div>
    <div><span class="k">  AmtDesc:</span> ${state.amtDesc.length} chars ${state.dirty.amt?'⚠':''}</div>
    <div><span class="k">  SolDesc:</span> ${state.solDesc.length} chars ${state.dirty.sol?'⚠':''}</div>
    <hr style="border-color:#444;margin:6px 0">
    <div><span class="k">Data scale:</span> ${DATA.counts.projects} projects / ${DATA.counts.months} months / ${DATA.counts.payments} payments</div>
  `;
  document.getElementById('devInfo').innerHTML = html;
}

function hasAnyDirty() { return state.dirty.target || state.dirty.amt || state.dirty.sol; }
function markDirty(field) { if (state.dirty[field]) return; state.dirty[field] = true; updateDirtyTags(); }
function clearDirty(field) { state.dirty[field] = false; state.lastSaved[field] = new Date().toISOString(); updateDirtyTags(); }

function updateDirtyTags() {
  document.getElementById('dirtyTarget').style.display = state.dirty.target ? '' : 'none';
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

  document.querySelector('.devpanel-h').addEventListener('click', () => {
    document.getElementById('devpanel').classList.toggle('collapsed');
  });
}

function setupSaveButton(btnId, field, label, payloadFn) {
  const btn = document.getElementById(btnId);
  btn.addEventListener('click', () => {
    if (!state.dirty[field]) { showToast(`No changes for "${label}"`, true); return; }
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
