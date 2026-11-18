/* Fluxo do Power BI · abrir o .pbit e comparar versões */
/* ---------- carregar arquivo ---------- */
async function parseFile(file) {
  if (/\.pbix$/i.test(file.name)) throw new Error('PBIX');
  const zip = await JSZip.loadAsync(file);
  const data = await parsePbit(zip);
  const g = buildGraph(data); g.colUse = columnUsage(data, g);
  const f = zip.file('DataModelSchema');
  return { data, g, name: file.name, size: file.size, date: (f && f.date) || null, mtime: file.lastModified || 0 };
}
function errText(e) {
  return e.message === 'PBIX'
    ? 'Este arquivo é .pbix: o modelo vem compactado e não dá para ler. No Power BI Desktop, use Arquivo → Exportar → Modelo do Power BI e escolha o .pbit gerado.'
    : e.message === 'SEM_MODELO'
      ? 'Não encontrei o modelo de dados dentro do arquivo. Confira se é um .pbit exportado pelo Power BI Desktop.'
      : 'Não consegui abrir o arquivo. Ele precisa ser um .pbit exportado pelo Power BI Desktop.';
}
function openParsed(p) {
  const g = p.g; st.manual = false; document.body.classList.remove('manual');
  st.cur = p; st.g = g; st.file = p.name; st.key = 'fluxo-pbi:' + p.name + ':' + p.size;
  st.pos = {}; st.notes = []; st.exp = new Set(); st.showAuto = false; st.sel = null; st.selSet = new Set(); st.focusF = null; st.search = '';
  st.flag = null; st.flagIds = null; st.iso = null; st.isoPos = {}; st.arrows = []; st.frames = []; st.selArrow = null; st.showRels = false; st.tool = 'select';
  st.pexp = new Set(); st.checks = loadChecks(p.name);
  st.fwd = new Map(); st.back = new Map();
  g.L.forEach(l => { (st.fwd.get(l.s) || st.fwd.set(l.s, []).get(l.s)).push(l.t); (st.back.get(l.t) || st.back.set(l.t, []).get(l.t)).push(l.s); });
  const had = restore();
  $('#fname').textContent = p.name; document.querySelector('.brand').title = p.name;
  $('#q').value = '';
  document.body.classList.add('loaded');
  st.diag = diagnose(p.data, g);
  st.bp = bestPractices(p.data, g); st.bpOpen = new Set(); st.bpRule = 'all';
  const bpn = Object.keys(st.bp.M).length + st.bp.calc.length; $('#bpCount').textContent = bpn || '';
  if (st.mode === 'bp') renderBp();
  updateDiagBtn();
  updateIsoUi();
  return had;
}
async function loadFile(file) {
  const msg = $('#msg'); msg.textContent = 'Lendo o arquivo…'; msg.className = 'msg';
  try {
    const p = await parseFile(file);
    st.cmp = null;
    const had = openParsed(p);
    if (st.mode === 'bp') setView('fluxo');
    hidePanel(); render(); showDiag(); fit(null, true);
    msg.textContent = '';
    if (had) toast('Posições e anotações deste arquivo foram restauradas.');
    else { let seen = false; try { seen = localStorage.getItem('fluxo-pbi:tutorial') === 'visto'; } catch (e) {} if (!seen) toast('Primeira vez por aqui? Clique em Ajuda para um tour rápido.'); }
  } catch (e) {
    if (!['PBIX', 'SEM_MODELO'].includes(e.message)) console.warn('Leitura do arquivo falhou:', e);
    if (st.g) { toast(errText(e)); return; }
    msg.className = 'msg err'; msg.textContent = errText(e);
    document.body.classList.remove('loaded');
  }
}

/* ---------- comparação ---------- */
const fmtDate = d => d ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'data desconhecida';
async function compareWith(file) {
  let p2;
  try { p2 = await parseFile(file); } catch (e) { toast(errText(e)); return; }
  const p1 = st.cur;
  const t1 = (p1.date && p1.date.getTime()) || p1.mtime, t2 = (p2.date && p2.date.getTime()) || p2.mtime;
  try { if (t2 > t1) runCompare(p1, p2, true); else runCompare(p2, p1, false); }
  catch (e) { console.warn('Comparação falhou:', e); toast('Não consegui comparar os arquivos.'); }
}
function runCompare(antes, depois, reopen) {
  if (st.mode === 'bp') setView('fluxo'); // o painel não aparece na aba Boas práticas
  if (reopen) { openParsed(depois); render(); fit(null, true); }
  const D = diffModels(snapshot(antes.data, antes.g), snapshot(depois.data, depois.g));
  const prev = loadChecks(antes.name);
  st.checks = Object.assign({}, prev, st.checks); saveChecks(); updateDiagBtn();
  const da = diagnose(antes.data, antes.g), dd = st.diag;
  const ka = new Map(da.map(x => [x.key, x])), kd = new Map(dd.map(x => [x.key, x]));
  const diagD = { resolved: da.filter(x => !kd.has(x.key)), added: dd.filter(x => !ka.has(x.key)), changed: dd.filter(x => ka.has(x.key) && ka.get(x.key).title !== x.title).map(x => ({ before: ka.get(x.key).title, after: x.title, sev: x.sev })) };
  st.cmp = { antes, depois, D, diagD };
  markCompare(); render(); showCompare();
}
function swapCompare() { if (!st.cmp) return; const { antes, depois } = st.cmp; runCompare(depois, antes, true); }
function markCompare() {
  const N = st.g.N; const D = st.cmp.D;
  for (const n of N.values()) n.badges = n.badges.filter(b => b.k !== 'new' && b.k !== 'chg');
  const tag = (id, k) => { const n = N.get(id); if (n && !n.badges.some(b => b.k === 'new' || b.k === 'chg')) n.badges.unshift({ t: k === 'new' ? 'novo' : 'alterado', k }); };
  D.measures.add.forEach(m => tag('m:' + m, 'new')); D.measures.chg.forEach(x => tag('m:' + x.name, 'chg')); D.measures.moved.forEach(x => tag('m:' + x.name, 'chg'));
  D.queries.add.forEach(q => tag('q:' + q, 'new')); D.queries.chg.forEach(x => tag('q:' + x.name, 'chg')); D.queries.load.forEach(x => tag('q:' + x.name, 'chg'));
  D.tables.add.forEach(t => tag('t:' + t, 'new'));
  [...D.cols.add, ...D.cols.del, ...D.cols.chg].forEach(x => tag('t:' + x.t, 'chg'));
  [...D.rels.add, ...D.rels.chg].forEach(r => { tag('t:' + r.from, 'chg'); tag('t:' + r.to, 'chg'); });
  const pid = name => { for (const n of N.values()) if (n.type === 'pagina' && n.label === name) return n.id; return null; };
  D.pages.add.forEach(p => tag(pid(p), 'new')); D.pages.chg.forEach(x => tag(pid(x.name), 'chg'));
  // pasta mostra se tem medida nova ou alterada
  for (const n of N.values()) if (n.type === 'pasta' && n.data.members.some(m => N.get(m).badges.some(b => b.k === 'new' || b.k === 'chg'))) tag(n.id, 'chg');
}
function cmpIds() {
  const ids = []; for (const n of st.g.N.values()) if (n.type !== 'pasta' && n.badges.some(b => b.k === 'new' || b.k === 'chg')) ids.push(n.id);
  return ids;
}
function showCompare() {
  const { antes, depois, D, diagD } = st.cmp; const out = [];
  const gone = s => `<span class="chip gone">${esc(s)}</span>`;
  const list = (arr, fn) => `<div class="chips">${arr.map(fn).join('')}</div>`;
  const sec = (title, n, body) => n ? `<section class="cmp"><h3>${esc(title)} <span class="cn">${n}</span></h3>${body}</section>` : '';
  const sub = (label, html) => html ? `<p class="cl">${esc(label)}</p>${html}` : '';
  const codeDiff = (b, a) => `<details><summary>Ver antes e depois</summary><p class="cl">Antes</p><pre class="code">${esc(b.trim())}</pre><p class="cl">Depois</p><pre class="code">${esc(a.trim())}</pre></details>`;
  out.push(backLinks().replace('<button class="back" data-act="cmp">← Comparação</button>', ''));
  out.push(`<div class="ph"><span class="kind">Comparação</span><h2>${D.total ? D.total + (D.total > 1 ? ' mudanças no modelo' : ' mudança no modelo') : 'Nenhuma mudança no modelo'}</h2></div>`);
  out.push(`<dl class="vers"><dt>Antes</dt><dd>${esc(antes.name)}<span>${fmtDate(antes.date)}</span></dd><dt>Depois</dt><dd>${esc(depois.name)}<span>${fmtDate(depois.date)}</span></dd></dl>`);
  out.push(`<p class="meta">O canvas mostra a versão de depois, com os blocos novos e alterados marcados.</p><div class="btnrow"><button class="btn" data-act="cmpshow">Mostrar mudanças no canvas</button><button class="btn" data-act="swap">Inverter antes e depois</button></div>`);
  const dg = diagD.resolved.length + diagD.added.length + diagD.changed.length;
  out.push(sec('Diagnóstico', dg,
    (diagD.resolved.length ? `<ul class="dl ok">${diagD.resolved.map(x => { const c = st.checks[x.key]; return `<li><span class="mk">✓</span><span>Resolvido: ${esc(x.title)}${c ? `<span class="now">No checklist: ${esc(CHK[c.s] || c.s)}</span>` : ''}</span></li>`; }).join('')}</ul>${diagD.resolved.some(x => chkOf(x.key) !== 'resolvido') ? '<button class="btn" data-act="markresolved">Marcar estes como resolvidos no checklist</button>' : ''}` : '') +
    (diagD.changed.length ? `<ul class="dl">${diagD.changed.map(x => `<li><span class="mk">→</span><span>${esc(x.before)}<span class="now">Agora: ${esc(x.after)}</span></span></li>`).join('')}</ul>` : '') +
    (diagD.added.length ? `<ul class="dl bad">${diagD.added.map(x => `<li><span class="mk">!</span>Novo: ${esc(x.title)}</li>`).join('')}</ul>` : '')));
  const M = D.measures;
  out.push(sec('Medidas', M.add.length + M.del.length + M.chg.length + M.moved.length,
    sub('Criadas', M.add.length && list(M.add, m => chip('m:' + m))) +
    sub('Apagadas', M.del.length && list(M.del, gone)) +
    sub('Fórmula alterada', M.chg.length && `<ul class="cl2">${M.chg.map(x => `<li>${chip('m:' + x.name)}${codeDiff(x.before, x.after)}</li>`).join('')}</ul>`) +
    sub('Mudaram de pasta', M.moved.length && `<ul class="cl2">${M.moved.map(x => `<li>${chip('m:' + x.name)} <span class="ft">${esc(x.before)} → ${esc(x.after)}</span></li>`).join('')}</ul>`)));
  const Q = D.queries;
  out.push(sec('Consultas', Q.add.length + Q.del.length + Q.chg.length + Q.load.length,
    sub('Criadas', Q.add.length && list(Q.add, q => chip('q:' + q))) +
    sub('Removidas', Q.del.length && list(Q.del, gone)) +
    sub('Carga mudou', Q.load.length && `<ul class="cl2">${Q.load.map(x => `<li>${chip('q:' + x.name)} <span class="ft">${x.after ? 'carga habilitada' : 'carga desabilitada'}</span></li>`).join('')}</ul>`) +
    sub('Código alterado', Q.chg.length && `<ul class="cl2">${Q.chg.map(x => `<li>${chip('q:' + x.name)}${x.stepsAdd.length ? `<span class="ft">Etapas novas: ${esc(x.stepsAdd.join(', '))}</span>` : ''}${x.stepsDel.length ? `<span class="ft">Etapas removidas: ${esc(x.stepsDel.join(', '))}</span>` : ''}${codeDiff(x.before, x.after)}</li>`).join('')}</ul>`)));
  const byT = arr => { const o = {}; arr.forEach(x => (o[x.t] = o[x.t] || []).push(x)); return o; };
  const colBlock = (arr, label) => { if (!arr.length) return ''; const o = byT(arr); return `<p class="cl">${esc(label)} (${arr.length})</p><ul class="cl2">${Object.keys(o).map(t => `<li>${st.g.N.has('t:' + t) ? chip('t:' + t) : gone(t)}<span class="ft">${esc(o[t].map(x => x.c).join(', '))}</span></li>`).join('')}</ul>`; };
  const T = D.tables, C = D.cols;
  out.push(sec('Tabelas e colunas', T.add.length + T.del.length + C.add.length + C.del.length + C.chg.length,
    sub('Tabelas criadas', T.add.length && list(T.add, t => chip('t:' + t))) +
    sub('Tabelas removidas', T.del.length && list(T.del, gone)) +
    colBlock(C.del, 'Colunas removidas') + colBlock(C.add, 'Colunas novas') +
    (C.chg.length ? `<p class="cl">Colunas com tipo ou fórmula alterados (${C.chg.length})</p><ul class="cl2">${C.chg.map(x => `<li>${chip('t:' + x.t, x.t + '[' + x.c + ']')}<span class="ft">${esc(x.before)} → ${esc(x.after)}</span></li>`).join('')}</ul>` : '')));
  const R = D.rels;
  out.push(sec('Relacionamentos', R.add.length + R.del.length + R.chg.length,
    sub('Novos', R.add.length && `<ul class="cl2">${R.add.map(r => `<li><code>${esc(r.k)}</code></li>`).join('')}</ul>`) +
    sub('Removidos', R.del.length && `<ul class="cl2">${R.del.map(r => `<li class="gone"><code>${esc(r.k)}</code></li>`).join('')}</ul>`) +
    sub('Alterados', R.chg.length && `<ul class="cl2">${R.chg.map(r => `<li><code>${esc(r.k)}</code><span class="ft">${r.wasActive !== r.active ? (r.active ? 'agora ativa' : 'agora inativa') : ''}${r.wasBoth !== r.both ? (r.both ? ' agora filtra nas duas direções' : ' agora filtra numa direção') : ''}</span></li>`).join('')}</ul>`)));
  const P = D.pages;
  const pchip = name => { for (const n of st.g.N.values()) if (n.type === 'pagina' && n.label === name) return chip(n.id); return gone(name); };
  out.push(sec('Páginas', P.add.length + P.del.length + P.chg.length,
    sub('Novas', P.add.length && list(P.add, pchip)) + sub('Removidas', P.del.length && list(P.del, gone)) +
    sub('Alteradas', P.chg.length && `<ul class="cl2">${P.chg.map(x => `<li>${pchip(x.name)}<span class="ft">${x.before.visuals !== x.after.visuals ? x.before.visuals + ' → ' + x.after.visuals + ' visuais' : ''}${x.before.hidden !== x.after.hidden ? (x.after.hidden ? ' agora oculta' : ' agora visível') : ''}</span></li>`).join('')}</ul>`)));
  if (D.auto[0] !== D.auto[1]) out.push(sec('Datas automáticas', 1, `<p class="meta">${D.auto[0]} → ${D.auto[1]} tabelas de data ocultas</p>`));
  $('#pbody').innerHTML = out.join('');
  $('#panel').hidden = false; document.body.classList.add('panel-open'); st.panelMode = 'cmp';
  $('#pbody').scrollTop = 0;
}
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 3200); }
