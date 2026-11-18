/* Fluxo do Power BI · modo de fluxo montado à mão: raias, paleta e cards */
/* ---------- fluxo próprio (montado à mão) ---------- */
const LANE_HINT = ['Arraste aqui as origens dos dados', 'Arraste aqui as consultas do Power Query', 'Arraste aqui as tabelas do modelo', 'Arraste aqui as medidas', 'Arraste aqui as páginas e os visuais'];
const TPL = [
  { lane: 0, items: [
    { type: 'origem', label: 'Banco de dados', sub: 'PostgreSQL, SQL Server…' },
    { type: 'origem', label: 'Planilha', sub: 'Excel ou CSV' },
    { type: 'origem', label: 'API ou web', sub: 'Endereço ou serviço web' },
    { type: 'origem', label: 'SharePoint ou OneDrive', sub: 'Pasta ou arquivo na nuvem' },
    { type: 'origem', label: 'Sistema', sub: 'ERP, CRM, Hubsoft…' }] },
  { lane: 1, items: [
    { type: 'consulta', label: 'Consulta', sub: 'Carrega uma tabela' },
    { type: 'consulta', label: 'Acrescentar consultas', sub: 'Une as linhas de duas ou mais', notes: 'Table.Combine({Consulta1, Consulta2})' },
    { type: 'consulta', label: 'Mesclar consultas', sub: 'Junta colunas por uma chave', notes: 'Table.NestedJoin(Consulta1, {"chave"}, Consulta2, {"chave"}, "Nova", JoinKind.LeftOuter)' },
    { type: 'consulta', label: 'Tratamento', sub: 'Limpa, tipa e padroniza' },
    { type: 'consulta', label: 'Parâmetro', sub: 'Valor reutilizável' }] },
  { lane: 2, items: [
    { type: 'tabela', label: 'Tabela fato', sub: 'Eventos e valores' },
    { type: 'tabela', label: 'Dimensão', sub: 'Cadastro para filtrar' },
    { type: 'tabela', label: 'Calendário', sub: 'Uma linha por dia', notes: 'let\n    Inicio = #date(2025, 1, 1),\n    Fim = Date.EndOfYear(Date.AddYears(DateTime.Date(DateTime.LocalNow()), 1)),\n    Fonte = List.Dates(Inicio, Duration.Days(Fim - Inicio) + 1, #duration(1, 0, 0, 0))\nin\n    Fonte' },
    { type: 'tabela', label: 'Tabela calculada', sub: 'Criada com DAX' },
    { type: 'tabela', label: 'Tabela de medidas', sub: 'Só para organizar medidas' }] },
  { lane: 3, items: [
    { type: 'medida', label: 'Medida base', sub: 'SUM ou COUNT', notes: 'Total = SUM(Tabela[valor])' },
    { type: 'medida', label: 'Percentual', sub: 'DIVIDE', notes: '% = DIVIDE([Parte], [Total])' },
    { type: 'medida', label: 'Mês anterior', sub: 'DATEADD', notes: 'Mês anterior = CALCULATE([Total], DATEADD(\'Calendário\'[Data], -1, MONTH))' },
    { type: 'medida', label: 'Acumulado no ano', sub: 'TOTALYTD', notes: 'Acumulado = TOTALYTD([Total], \'Calendário\'[Data])' },
    { type: 'medida', label: 'Contagem distinta', sub: 'DISTINCTCOUNT', notes: 'Clientes = DISTINCTCOUNT(Tabela[id_cliente])' }] },
  { lane: 4, items: [
    { type: 'pagina', label: 'Página', sub: 'Uma página do relatório' },
    { type: 'visual', label: 'Cartão', sub: 'Número em destaque' },
    { type: 'visual', label: 'Gráfico de linhas', sub: 'Evolução no tempo' },
    { type: 'visual', label: 'Gráfico de colunas', sub: 'Comparação entre itens' },
    { type: 'visual', label: 'Tabela ou matriz', sub: 'Detalhe em linhas' },
    { type: 'visual', label: 'Segmentação', sub: 'Filtro na página' }] }
];
const EXAMPLE = (() => {
  const n = (id, type, label, sub, x, y, notes) => ({ id, type, label, sub, notes: notes || '', x, y });
  const X = i => i * COLW; const Y = k => k * (H + GAPY);
  const nodes = [
    n('o1', 'origem', 'Banco de dados', 'PostgreSQL', X(0), Y(0)), n('o2', 'origem', 'Planilha de metas', 'Excel', X(0), Y(3)),
    n('q1', 'consulta', 'f_vendas', 'Consulta SQL', X(1), Y(0)), n('q2', 'consulta', 'd_calendario', 'Gerada no Power Query', X(1), Y(1)), n('q3', 'consulta', 'metas', 'Tratamento', X(1), Y(3)),
    n('t1', 'tabela', 'f_vendas', 'Tabela fato', X(2), Y(0)), n('t2', 'tabela', 'd_calendario', 'Calendário', X(2), Y(1)), n('t3', 'tabela', 'd_metas', 'Dimensão', X(2), Y(3)),
    n('m1', 'medida', 'Faturamento', 'SUM', X(3), Y(0), 'Faturamento = SUM(f_vendas[valor])'),
    n('m2', 'medida', 'Faturamento mês anterior', 'DATEADD', X(3), Y(1), 'Faturamento mês anterior = CALCULATE([Faturamento], DATEADD(d_calendario[data], -1, MONTH))'),
    n('m3', 'medida', 'Atingimento da meta %', 'DIVIDE', X(3), Y(3), 'Atingimento da meta % = DIVIDE([Faturamento], SUM(d_metas[meta]))'),
    n('p1', 'pagina', 'Visão geral', 'Página do relatório', X(4), Y(0)),
    { id: 'v1', type: 'visual', label: 'Faturamento', sub: 'Cartão', notes: '', x: X(4) + 22, y: Y(1) },
    { id: 'v2', type: 'visual', label: 'Faturamento por mês', sub: 'Gráfico de linhas', notes: '', x: X(4) + 22, y: Y(1) + MH + 8 },
    { id: 'v3', type: 'visual', label: 'Atingimento da meta', sub: 'Cartão', notes: '', x: X(4) + 22, y: Y(1) + 2 * (MH + 8) }
  ];
  const links = [['o1', 'q1'], ['o2', 'q3'], ['q1', 't1'], ['q2', 't2'], ['q3', 't3'], ['t1', 'm1'], ['m1', 'm2'], ['t2', 'm2'], ['m1', 'm3'], ['t3', 'm3'], ['m1', 'v1'], ['m1', 'v2'], ['t2', 'v2'], ['m3', 'v3']].map(([s, t]) => ({ s, t }));
  const pos = {}; nodes.forEach(x => pos[x.id] = { x: x.x, y: x.y });
  return { name: 'Exemplo financeiro', nodes, links, pos };
})();
function manualStats() {
  const c = t => [...st.g.N.values()].filter(n => n.type === t).length;
  return { origens: c('origem'), consultas: c('consulta'), tabelas: c('tabela'), auto: 0, medidas: c('medida'), semUso: 0, paginas: c('pagina'), visuais: c('visual') };
}
function manualData(type, notes) {
  const d = { notes: notes || '' };
  if (type === 'medida') Object.assign(d, { depT: [], depM: [], expr: '', unused: false, fullFolder: '' });
  if (type === 'pagina') Object.assign(d, { visuals: [], broken: [] });
  if (type === 'tabela') Object.assign(d, { kind: 'manual', cols: [] });
  if (type === 'consulta') Object.assign(d, { steps: [], srcs: [], refs: [], m: '', loaded: true });
  if (type === 'origem') Object.assign(d, { kind: 'manual', urls: [], publicCount: 0, queries: [] });
  return d;
}
function addManualNode(o) {
  const n = { id: o.id, type: o.type, label: o.label || 'Card', sub: o.sub || '', badges: [], manual: true, data: manualData(o.type, o.notes) };
  if (n.type === 'pagina') n.data.pg = { id: n.id, name: n.label, visuals: [], hidden: false };
  st.g.N.set(n.id, n); return n;
}
function rebuildAdj() {
  st.fwd = new Map(); st.back = new Map();
  st.g.L.forEach(l => { (st.fwd.get(l.s) || st.fwd.set(l.s, []).get(l.s)).push(l.t); (st.back.get(l.t) || st.back.set(l.t, []).get(l.t)).push(l.s); });
}
function openManual(state) {
  state = cleanDrawing(state);
  const g = { N: new Map(), L: [], rels: [], stats: {}, colUse: {} };
  st.manual = true; document.body.classList.add('manual');
  st.cur = { data: { model: { tables: [], relationships: [] }, report: { pages: [], reportRefs: { measures: new Set(), columns: new Set(), tables: new Set() } } }, g, name: state.name || 'Meu fluxo', size: 0, date: null };
  st.g = g; st.file = st.cur.name; st.key = 'fluxo-pbi:manual';
  st.pos = {}; st.notes = []; st.exp = new Set(); st.showAuto = false; st.sel = null; st.selSet = new Set(); st.focusF = null; st.search = '';
  st.flag = null; st.flagIds = null; st.iso = null; st.isoPos = {}; st.arrows = []; st.frames = []; st.selArrow = null; st.showRels = false; st.tool = 'select';
  st.pexp = new Set(); st.checks = {}; st.cmp = null; st.colSel = null; st.undo = null;
  (state.nodes || []).forEach(addManualNode);
  const lk = new Set(); g.L = state.links.filter(l => g.N.has(l.s) && g.N.has(l.t) && !lk.has(l.s + '>' + l.t) && lk.add(l.s + '>' + l.t)).map(l => ({ s: l.s, t: l.t, kind: 'man' }));
  rebuildAdj();
  applyDrawing(state); st.checks = {};
  st.diag = []; st.bp = { M: {}, dups: [], calc: [], counts: {} }; updateDiagBtn(); $('#bpCount').textContent = '';
  if (st.mode === 'bp') setView('fluxo');
  $('#fname').textContent = st.file; document.querySelector('.brand').title = st.file; $('#q').value = '';
  document.body.classList.add('loaded'); hidePanel(); updateIsoUi(); renderPalette(); render(); fit(null, true);
}
function savedManual() { try { const r = JSON.parse(localStorage.getItem('fluxo-pbi:manual') || 'null'); return r && r.manual && (r.nodes || []).length ? r : null; } catch (e) { return null; } }
function startManual(kind) {
  if (kind === 'resume') { const r = savedManual(); if (r) { openManual(r); return; } }
  // sem fluxo aberto, o botão substituiria em silêncio o fluxo salvo neste navegador
  else if (!st.manual && savedManual() && !confirm('Isso substitui o fluxo próprio salvo neste navegador. Continuar?')) return;
  openManual(kind === 'example' ? JSON.parse(JSON.stringify(EXAMPLE)) : { name: 'Meu fluxo', nodes: [], links: [] });
  save();
  toast(kind === 'example' ? 'Exemplo aberto. Edite os cards ou arraste novos da paleta.' : 'Fluxo em branco pronto. Arraste os cards da paleta para as raias.');
}
function renderLanes() {
  const el = $('#lanes'); if (!st.manual || st.iso) { el.innerHTML = ''; return; }
  let maxY = 0; for (const n of st.g.N.values()) maxY = Math.max(maxY, pos(n.id).y + nodeH(n));
  const h = Math.max(760, maxY + 220);
  const counts = [0, 0, 0, 0, 0]; for (const n of st.g.N.values()) counts[COLS[n.type]]++;
  el.innerHTML = [0, 1, 2, 3, 4].map(i => `<div class="lane c${i}" data-lane="${i}" style="left:${i * COLW - 18}px;top:-20px;width:${W + 36}px;height:${h}px">${counts[i] ? '' : `<span class="lane-hint">${LANE_HINT[i]}</span>`}</div>`).join('');
}
function renderPalette() {
  $('#palette').innerHTML = `<div class="pal-head"><label class="pal-name">Nome do fluxo<input id="flowName" value="${esc(st.file || 'Meu fluxo')}" spellcheck="false"></label><button class="pal-x" id="palClose" aria-label="Recolher modelos" title="Recolher modelos"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 5l-5 5 5 5"/></svg></button></div>
    <p class="pal-tip">Arraste um modelo para a raia ou clique para adicionar no fim dela.</p>
    ${TPL.map(g => `<section class="pal-sec c${g.lane}"><h4><span class="dot"></span>${esc(HEADS[g.lane])}</h4>${g.items.map((t, i) => `<div class="tpl t-${t.type}" draggable="true" data-tpl="${g.lane}:${i}" role="button" tabindex="0" title="Adicionar ${esc(t.label)}"><strong>${esc(t.label)}</strong><span>${esc(t.sub)}</span></div>`).join('')}</section>`).join('')}`;
  $('#flowName').addEventListener('input', e => { st.file = e.target.value.trim() || 'Meu fluxo'; $('#fname').textContent = st.file; clearTimeout(st._nt); st._nt = setTimeout(save, 400); });
  $('#palClose').addEventListener('click', () => setPalette(false));
}
function setPalette(open) { document.body.classList.toggle('pal-open', open); try { localStorage.setItem('fluxo-pbi:paleta', open ? 'aberta' : 'recolhida'); } catch (e) {} }
function tplOf(key) { const [l, i] = key.split(':').map(Number); return TPL[l].items[i]; }
function newManualId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function addFromTemplate(key, wx, wy) {
  const t = tplOf(key); const lane = COLS[t.type];
  const n = addManualNode({ id: newManualId(), type: t.type, label: t.label, sub: t.sub, notes: t.notes });
  let x, y;
  if (wx == null) {
    const sel = st.sel && st.g.N.get(st.sel);
    if (t.type === 'visual' && sel && sel.type === 'pagina' && sel.manual) {
      const under = [...st.g.N.values()].filter(m => m !== n && m.type === 'visual' && Math.abs(pos(m.id).x - (pos(sel.id).x + 22)) < 10 && pos(m.id).y > pos(sel.id).y);
      x = pos(sel.id).x + 22; y = pos(sel.id).y + H + 8 + under.length * (MH + 8);
    } else {
      let maxY = -GAPY; for (const m of st.g.N.values()) if (m !== n && COLS[m.type] === lane) maxY = Math.max(maxY, pos(m.id).y + nodeH(m));
      x = lane * COLW + (t.type === 'visual' ? 22 : 0); y = maxY + GAPY;
    }
  } else {
    const li = Math.round((wx - W / 2) / COLW); const inLane = li >= 0 && li <= 4 && Math.abs(wx - (li * COLW + W / 2)) < W / 2 + 40;
    x = inLane ? li * COLW + (t.type === 'visual' ? 22 : 0) : Math.round(wx - nodeW(n) / 2); y = Math.round(wy - nodeH(n) / 2);
  }
  st.pos[n.id] = { x, y }; save(); render();
  st.selSet = new Set([n.id]); applySelection();
  const inp = document.querySelector('[data-mf="label"]'); if (inp) { inp.focus(); inp.select(); }
}
function showManualPanel(id) {
  const n = st.g.N.get(id); const d = n.data;
  const ins = st.g.L.filter(l => l.t === id), outs = st.g.L.filter(l => l.s === id);
  const lk = (l, other) => `<span class="mlink">${chip(other)}<button class="mlx" data-unlink="${esc(l.s)}>${esc(l.t)}" aria-label="Remover ligação">×</button></span>`;
  const types = [['origem', 'Origem'], ['consulta', 'Consulta'], ['tabela', 'Tabela'], ['medida', 'Medida'], ['pagina', 'Página'], ['visual', 'Visual']];
  $('#pbody').innerHTML = `<div class="ph t-${n.type}"><span class="kind">Card de ${esc(TYPE_NAMES[n.type].toLowerCase())}</span><h2>${esc(n.label)}</h2></div>
    <div class="mform">
      <label>Título<input data-mf="label" value="${esc(n.label)}"></label>
      <label>Detalhe<input data-mf="sub" value="${esc(n.sub || '')}" placeholder="Ex.: PostgreSQL, Tabela fato, SUM…"></label>
      <label>Tipo<select data-mf="type">${types.map(([v, l]) => `<option value="${v}"${v === n.type ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Anotações ou código<textarea data-mf="notes" rows="6" spellcheck="false" placeholder="Fórmula DAX, código M, regra de negócio…">${esc(d.notes || '')}</textarea></label>
    </div>
    <h3>Recebe de (${ins.length})</h3>${ins.length ? `<div class="chips">${ins.map(l => lk(l, l.s)).join('')}</div>` : '<p class="none">Nenhum</p>'}
    <h3>Liga para (${outs.length})</h3>${outs.length ? `<div class="chips">${outs.map(l => lk(l, l.t)).join('')}</div>` : '<p class="none">Nenhum</p>'}
    <p class="note-s">Para ligar, arraste o ponto à direita do card até outro card.</p>
    <div class="btnrow"><button class="btn" data-act="mdup">Duplicar</button><button class="btn" data-act="iso">${st.iso ? 'Mostrar tudo' : 'Isolar o caminho'}</button><button class="btn danger" data-act="mdel">Apagar card</button></div>`;
  $('#panel').hidden = false; document.body.classList.add('panel-open'); st.panelMode = 'node';
}
function updateManualField(id, f, v) {
  const n = st.g.N.get(id); if (!n) return;
  if (f === 'type') { const keep = n.data.notes; n.type = v; n.data = manualData(v, keep); if (v === 'pagina') n.data.pg = { id: n.id, name: n.label, visuals: [], hidden: false }; render(); updateClasses(); showManualPanel(id); }
  else if (f === 'notes') n.data.notes = v;
  else { n[f] = v; const el = document.querySelector(`#nodes [data-id="${CSS.escape(id)}"]`); if (el) { if (f === 'label') { el.querySelector('.nt').textContent = v; el.querySelector('.nt').title = v; const h2 = document.querySelector('#pbody .ph h2'); if (h2) h2.textContent = v; } else { const s = el.querySelector('.sub'); if (s) s.textContent = v; } } }
  clearTimeout(st._mt); st._mt = setTimeout(save, 400);
}
function deleteManual(ids) {
  ids = ids.filter(id => st.g.N.get(id) && st.g.N.get(id).manual); if (!ids.length) return;
  const set = new Set(ids);
  st.undo = { nodes: ids.map(id => { const n = st.g.N.get(id); return { id, type: n.type, label: n.label, sub: n.sub, notes: n.data.notes, pos: st.pos[id] }; }), links: st.g.L.filter(l => set.has(l.s) || set.has(l.t)), arrows: st.arrows.filter(a => (a.from.t === 'node' && set.has(a.from.id)) || (a.to.t === 'node' && set.has(a.to.id))) };
  ids.forEach(id => { st.g.N.delete(id); delete st.pos[id]; });
  st.g.L = st.g.L.filter(l => !set.has(l.s) && !set.has(l.t));
  st.arrows = st.arrows.filter(a => !st.undo.arrows.includes(a));
  rebuildAdj(); st.selSet = new Set(); st.sel = null; st.focusF = null; hidePanel(); save(); render();
  toast((ids.length > 1 ? ids.length + ' cards apagados' : 'Card apagado') + '. Ctrl+Z desfaz.');
}
function undoManual() {
  const u = st.undo; if (!u) return; st.undo = null;
  u.nodes.forEach(o => { addManualNode(o); if (o.pos) st.pos[o.id] = o.pos; });
  st.g.L.push(...u.links); st.arrows.push(...u.arrows); rebuildAdj(); save(); render(); toast('Desfeito.');
}
function duplicateManual(id) {
  const n = st.g.N.get(id); const p = pos(id);
  const m = addManualNode({ id: newManualId(), type: n.type, label: n.label + ' (cópia)', sub: n.sub, notes: n.data.notes });
  st.pos[m.id] = { x: p.x + 24, y: p.y + nodeH(n) + GAPY }; save(); render(); st.selSet = new Set([m.id]); applySelection();
}
