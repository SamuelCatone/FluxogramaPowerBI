/* Fluxo do Power BI · painel de detalhes, diagnóstico e linhagem de coluna */
/* ---------- seleção e painel ---------- */
function panelOpen() { return !$('#panel').hidden; }
function select(id, opts = {}) {
  st.flag = null; st.flagIds = null; st.colSel = null;
  st.selSet = new Set(id ? [id] : []); st.sel = id; computeFocus();
  if (opts.reveal && id && st.iso && !st.iso.has(id)) exitIso(true);
  if (opts.reveal && id && !st.iso) {
    const n = st.g.N.get(id);
    if (n.type === 'medida' && !st.exp.has(n.folder)) { st.exp.add(n.folder); save(); }
    if (n.type === 'visual' && !st.pexp.has(n.page)) { st.pexp.add(n.page); save(); }
    if (n.auto && !st.showAuto) { st.showAuto = true; save(); }
    render();
  } else { drawEdges(); updateClasses(); }
  if (id) { showPanel(id); if (opts.reveal && visId(id)) centerOn(id); } else if (st.panelMode !== 'diag' && st.panelMode !== 'cmp') hidePanel();
}
function chip(id, label, extra) {
  const n = st.g.N.get(id);
  if (!n) return `<span class="chip broken">${esc(label || id)}</span>`;
  return `<button class="chip t-${n.type}" data-go="${esc(id)}">${esc(label || n.label)}${extra || ''}</button>`;
}
function chips(ids, max = 40) {
  if (!ids.length) return '<p class="none">Nenhum</p>';
  const s = ids.slice(0, max).map(id => chip(id)).join('');
  return `<div class="chips">${s}${ids.length > max ? `<span class="more-n">e mais${ids.length - max}</span>` : ''}</div>`;
}
function pagesAndVisuals(id) {
  // páginas e visuais alcançados a partir do bloco (direto ou por outras medidas)
  const seen = new Set([id]); const q = [id]; const pages = new Set(), visuals = new Set();
  while (q.length) { const x = q.pop(); (st.fwd.get(x) || []).forEach(y => { if (seen.has(y)) return; seen.add(y); const n = st.g.N.get(y); if (!n) return;
    if (n.type === 'visual') { visuals.add(y); pages.add('p:' + n.page); } else if (n.type === 'pagina') pages.add(y); else if (n.type === 'medida') q.push(y); }); }
  return { pages: [...pages], visuals: [...visuals] };
}
function linksTo(id, kind) { return st.g.L.filter(l => l.t === id && (!kind || kind.includes(l.kind))).map(l => l.s); }
function linksFrom(id, kind) { return st.g.L.filter(l => l.s === id && (!kind || kind.includes(l.kind))).map(l => l.t); }
const DT = { string: 'texto', int64: 'inteiro', double: 'decimal', decimal: 'decimal fixo', dateTime: 'data/hora', boolean: 'lógico', binary: 'binário' };
function showPanel(id) {
  if (st.g.N.get(id) && st.g.N.get(id).manual) return showManualPanel(id);
  const n = st.g.N.get(id); const d = n.data || {}; const out = [];
  out.push(`<div class="ph t-${n.type}"><span class="kind">${TYPE_NAMES[n.type]}</span><h2>${esc(n.label)}</h2>${n.badges.length ? `<div class="pb">${n.badges.map(b => `<span class="bdg ${b.k}">${esc(b.t)}</span>`).join('')}</div>` : ''}</div>`);
  if (n.type === 'origem') {
    out.push(`<p class="meta">${esc(n.sub)}</p>`);
    if (d.publicCount) out.push(`<div class="alert">${d.publicCount} ${d.publicCount > 1 ? 'endereços usam' : 'endereço usa'} link público. Quem tiver a URL consegue baixar esses dados sem login. Trate como dado sensível da organização.</div>`);
    out.push(`<h3>Alimenta</h3>` + chips(linksFrom(id)));
    if (d.urls && d.urls.length) out.push(`<details><summary>Ver ${d.urls.length} ${d.urls.length > 1 ? 'endereços' : 'endereço'}</summary><pre class="code">${esc(d.urls.join('\n'))}</pre></details>`);
  } else if (n.type === 'consulta') {
    out.push(`<p class="meta">${d.loaded ? 'Carrega uma tabela no modelo' : 'Carga desabilitada: serve só de etapa para outra consulta'}</p>`);
    const srcs = linksTo(id, ['src']), refs = linksTo(id, ['ref']), usedBy = linksFrom(id, ['ref']), tab = linksFrom(id, ['load']);
    if (srcs.length) out.push('<h3>Lê de</h3>' + chips(srcs));
    if (d.sql && d.sql.from) out.push(`<p class="meta">Tabela no banco: <code>${esc(d.sql.from)}</code></p>`);
    if (refs.length) out.push('<h3>Junta dados de</h3>' + chips(refs));
    if (usedBy.length) out.push('<h3>Usada pela consulta</h3>' + chips(usedBy));
    if (tab.length) out.push('<h3>Vira a tabela</h3>' + chips(tab));
    out.push(`<h3>Tratamento (${d.steps.length} ${d.steps.length === 1 ? 'etapa' : 'etapas'})</h3><ol class="steps">${d.steps.map(s => `<li><span class="sn">${esc(s.name)}</span><span class="sl">${esc(s.label)}</span></li>`).join('')}</ol>`);
    out.push(`<details><summary>Código M</summary><pre class="code">${esc(d.m)}</pre></details>`);
  } else if (n.type === 'tabela') {
    const kinds = { importada: 'Importada pelo Power Query', calculada: 'Tabela calculada com DAX', auto: 'Criada pela data/hora automática do Power BI' };
    out.push(`<p class="meta">${esc(kinds[d.kind] || d.kind)}${d.mode && d.mode !== 'import' ? ' · modo ' + esc(d.mode) : ''}</p>`);
    const rels = st.g.rels.filter(r => (r.fromTable === n.label || r.toTable === n.label) && !(AUTO_RE.test(r.toTable) && !st.showAuto));
    if (rels.length) out.push(`<h3>Relacionamentos (${rels.length})</h3><ul class="rels">${rels.map(r => {
      const other = r.fromTable === n.label ? r.toTable : r.fromTable;
      return `<li><code>${esc(r.fromTable)}[${esc(r.fromColumn)}]</code> → <code>${esc(r.toTable)}[${esc(r.toColumn)}]</code>${r.isActive === false ? ' <span class="bdg mute">inativa</span>' : ''}${r.crossFilteringBehavior === 'bothDirections' ? ' <span class="bdg mute">ambas direções</span>' : ''} ${st.g.N.has('t:' + other) ? chip('t:' + other, 'abrir') : ''}</li>`;
    }).join('')}</ul>`);
    const ms = linksFrom(id, ['uses']), pg = linksFrom(id, ['showcol']), from = linksTo(id);
    if (from.length) out.push('<h3>Vem de</h3>' + chips(from));
    out.push(`<h3>Medidas que usam esta tabela (${ms.length})</h3>` + chips(ms, 30));
    const directV = linksFrom(id, ['showcolv']); const pgv = [...new Set([...pg, ...directV.map(v => 'p:' + st.g.N.get(v).page)])];
    if (pgv.length) out.push('<h3>Colunas aparecem nas páginas</h3>' + chips(pgv));
    if (directV.length) out.push(`<h3>Visuais que usam colunas desta tabela (${directV.length})</h3>` + chips(directV, 30));
    const CU = (st.g.colUse || {})[n.label];
    if (CU && !n.auto) {
      const un = d.cols.filter(c => CU[c.name] && !CU[c.name].uses.size), us = d.cols.filter(c => CU[c.name] && CU[c.name].uses.size);
      out.push(`<h3>Colunas: ${us.length} em uso, ${un.length} sem uso</h3><p class="note-s">Clique numa coluna para ver o que depende dela.</p>`);
      if (un.length) out.push(`<details open><summary>Sem uso (${un.length})</summary><ul class="cols">${un.map(c => `<li><button class="colbtn" data-col="${esc(c.name)}">${esc(c.name)}</button><span class="ct">${c.calc ? 'calculada · ' : ''}${esc(DT[c.dataType] || c.dataType || '')}</span></li>`).join('')}</ul><p class="note-s">Nenhuma medida, visual, filtro, relacionamento, coluna calculada ou ordenação usa estas colunas.</p></details>`);
      if (us.length) out.push(`<details${us.length <= 15 ? ' open' : ''}><summary>Em uso (${us.length})</summary><ul class="cols">${us.map(c => { const u2 = CU[c.name]; const by = [...u2.by].slice(0, 4); return `<li class="cu"><button class="colbtn" data-col="${esc(c.name)}">${esc(c.name)}</button><span class="ct">${[...u2.uses].map(x => `<span class="ub">${esc(x)}</span>`).join('')}</span>${by.length ? `<span class="cby">${esc(by.join(', '))}${u2.by.size > 4 ? ' e mais ' + (u2.by.size - 4) : ''}</span>` : ''}</li>`; }).join('')}</ul></details>`);
    } else out.push(`<details${d.cols.length <= 12 ? ' open' : ''}><summary>${d.cols.length} colunas</summary><ul class="cols">${d.cols.map(c => `<li><span>${esc(c.name)}</span><span class="ct">${c.calc ? 'calculada · ' : ''}${esc(DT[c.dataType] || c.dataType || '')}</span></li>`).join('')}</ul></details>`);
    if (d.expr) out.push(`<details><summary>Expressão DAX</summary><pre class="code">${esc(d.expr)}</pre></details>`);
  } else if (n.type === 'pasta') {
    const mem = membersOf(n);
    out.push(`<p class="meta">${mem.length} ${mem.length === 1 ? 'medida' : 'medidas'}${d.unused ? `, ${d.unused} sem uso em nenhum visual` : ''}</p>`);
    out.push(`<button class="btn wide" data-act="togglesel">${st.exp.has(n.label) ? 'Recolher no canvas' : 'Expandir no canvas'}</button>`);
    out.push(`<div class="chips">${mem.map(m => chip(m.id, null, m.data.unused ? ' <span class="u">sem uso</span>' : '')).join('')}</div>`);
  } else if (n.type === 'medida') {
    out.push(`<p class="meta">Pasta ${esc(d.fullFolder ? d.fullFolder.replace(/\\/g, ' / ') : 'sem pasta')}, guardada na tabela ${esc(d.home)}${d.fmt ? ', formato ' + esc(d.fmt) : ''}</p>`);
    if (d.unused) out.push('<div class="alert soft">Não aparece em nenhum visual nem filtro, nem por meio de outra medida usada.</div>');
    const usedByM = linksFrom(id, ['dep']); const reach = pagesAndVisuals(id); const pgs = reach.pages;
    out.push('<h3>Usa as tabelas</h3>' + chips(d.depT.map(t => 't:' + t)));
    if (d.depM.length) out.push('<h3>Usa as medidas</h3>' + chips(d.depM.map(m => 'm:' + m)));
    if (usedByM.length) out.push('<h3>É usada pelas medidas</h3>' + chips(usedByM));
    out.push('<h3>Aparece nas páginas</h3>' + chips(pgs));
    if (reach.visuals.length) out.push(`<h3>Visuais afetados se ela mudar (${reach.visuals.length})</h3>` + chips(reach.visuals, 40) + '<p class="note-s">Inclui os visuais que usam medidas que dependem desta.</p>');
    out.push(bpPanelSection(n.label));
    out.push(`<h3>Fórmula</h3><pre class="code">${esc(d.expr.trim())}</pre>`);
  } else if (n.type === 'visual') {
    const v = d.v;
    out.push(`<p class="meta">${esc(d.tname)}${v.title ? '' : ', sem título'} na página ${esc(d.pageName)}</p>`);
    if (d.missT.length || d.missM.length) out.push(`<div class="alert">Este visual usa ${[...d.missT.map(t => 'a tabela ' + t), ...d.missM.map(m => 'o campo ' + m)].map(esc).join(', ')}, que não existe mais no modelo.</div>`);
    out.push('<h3>Página</h3>' + chips(['p:' + n.page]));
    const ms = [...v.refs.measures]; const cs = [...v.refs.columns];
    if (ms.length) out.push(`<h3>Medidas (${ms.length})</h3><div class="chips">${ms.map(m => st.g.N.has('m:' + m) ? chip('m:' + m) : `<span class="chip broken">${esc(m)}</span>`).join('')}</div>`);
    if (cs.length) out.push(`<h3>Colunas (${cs.length})</h3><div class="chips">${cs.map(c => { const [t, col] = c.split('|'); return st.g.N.has('t:' + t) ? chip('t:' + t, t + '[' + col + ']') : `<span class="chip broken">${esc(t + '[' + col + ']')}</span>`; }).join('')}</div>`);
    out.push('<p class="note-s">Se alguma dessas medidas ou colunas mudar ou sair do modelo, este visual é afetado.</p>');
  } else if (n.type === 'pagina') {
    const pg = d.pg;
    out.push(`<p class="meta">${pg.visuals.length} visuais${pg.hidden ? ', página oculta para quem vê o relatório' : ''}</p>`);
    if (d.broken.length) out.push(`<div class="alert">Algum visual usa campo de tabela que não existe mais: ${d.broken.map(esc).join(', ')}.</div>`);
    if ((d.visuals || []).length) out.push(`<button class="btn wide" data-act="togglepage">${st.pexp.has(pg.id) ? 'Recolher os visuais no canvas' : 'Abrir os visuais no canvas'}</button>`);
    const vs = pg.visuals.filter(v => v.refs.measures.size || v.refs.columns.size || v.title);
    out.push(`<h3>Visuais com dados (${vs.length})</h3><ul class="vis">${vs.map(v => {
      const ms = [...v.refs.measures].map(m => st.g.N.has('m:' + m) ? chip('m:' + m) : `<span class="chip broken">${esc(m)}</span>`).join('');
      const cs = [...v.refs.columns].map(c => { const [t, col] = c.split('|'); return st.g.N.has('t:' + t) ? chip('t:' + t, t + '[' + col + ']') : `<span class="chip broken">${esc(t + '[' + col + ']')}</span>`; }).join('');
      return `<li><div class="vt"><strong>${esc(visualName(v.type))}</strong>${v.title ? ` <span>${esc(v.title)}</span>` : ''}</div><div class="chips">${ms}${cs}</div></li>`;
    }).join('')}</ul>`);
  }
  out.splice(1, 0, `<button class="btn wide" data-act="iso">${st.iso ? 'Mostrar tudo' : 'Isolar o caminho deste bloco'}</button>`);
  $('#pbody').innerHTML = backLinks() + out.join('');
  $('#panel').hidden = false; document.body.classList.add('panel-open'); st.panelMode = 'node';
  $('#pbody').scrollTop = 0;
}
function columnImpact(t, c) {
  const N = st.g.N; const U = ((st.g.colUse || {})[t] || {})[c] || { refs: [], uses: new Set() };
  const direct = { measures: new Set(), visuals: new Set(), pages: new Set(), rels: [], calc: new Set(), sort: new Set(), hier: new Set(), ctables: new Set() };
  U.refs.forEach(r => {
    if (r.use === 'medida') direct.measures.add(r.id);
    else if (r.use === 'visual') { if (N.has(r.id)) direct.visuals.add(r.id); if (r.page) direct.pages.add(r.page); }
    else if (r.use === 'filtro de página') direct.pages.add(r.id);
    else if (r.use === 'relacionamento') direct.rels.push(r);
    else if (r.use === 'coluna calculada') direct.calc.add(r.by);
    else if (r.use === 'ordenação') direct.sort.add(r.by);
    else if (r.use === 'hierarquia') direct.hier.add(r.by);
    else if (r.use === 'tabela calculada') direct.ctables.add(r.id);
  });
  // medidas que dependem das diretas, e visuais e páginas alcançados
  const indirect = new Set(); const vis = new Set(direct.visuals); const pages = new Set(direct.pages);
  const q = [...direct.measures]; const seen = new Set(q);
  while (q.length) { const x = q.pop(); (st.fwd.get(x) || []).forEach(y => { const n = N.get(y); if (!n) return;
    if (n.type === 'medida' && !seen.has(y)) { seen.add(y); indirect.add(y); q.push(y); }
    else if (n.type === 'visual') { vis.add(y); pages.add('p:' + n.page); } else if (n.type === 'pagina') pages.add(y); }); }
  direct.visuals.forEach(v => pages.add('p:' + N.get(v).page));
  const F = new Set(['t:' + t, ...seen, ...vis, ...pages, ...direct.ctables]);
  direct.rels.forEach(r => F.add(r.id));
  const up = ['t:' + t]; while (up.length) { const x = up.pop(); (st.back.get(x) || []).forEach(y => { const n = N.get(y); if (n && (n.type === 'consulta' || n.type === 'origem') && !F.has(y)) { F.add(y); up.push(y); } }); }
  // Power Query: etapas que citam a coluna pelo nome
  const pq = []; const qn = N.get('q:' + t);
  if (qn) { let cur = ''; qn.data.m.split('\n').forEach(line => { const m = /^\s*(#"(?:[^"]|"")*"|[A-Za-zÀ-ÿ_][\wÀ-ÿ]*)\s*=/.exec(line); if (m && m[1] !== 'let') cur = m[1].replace(/^#"|"$/g, ''); if (line.includes('"' + c + '"') && cur && !pq.includes(cur)) pq.push(cur); });
    if (qn.data.sql && new RegExp('(^|[^\\w])' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^\\w]|$)', 'i').test(qn.data.sql.sql) && !pq.includes('Fonte (SQL)')) pq.unshift('Fonte (SQL)'); }
  return { direct, indirect: [...indirect], visuals: [...vis], pages: [...pages], pq, F, used: U.uses.size > 0 };
}
function showColumn(t, c) {
  st.colSel = { t, c }; st.selSet = new Set(['t:' + t]); st.sel = 't:' + t; st.flag = null; st.flagIds = null;
  computeFocus(); drawEdges(); updateClasses();
  const I = columnImpact(t, c); const D = I.direct; const N = st.g.N;
  const col = (N.get('t:' + t).data.cols || []).find(x => x.name === c) || {};
  const out = [backLinks() + `<button class="back" data-go="t:${esc(t)}">← ${esc(t)}</button>`];
  out.push(`<div class="ph t-tabela"><span class="kind">Coluna</span><h2>${esc(t)}[${esc(c)}]</h2></div>`);
  out.push(`<p class="meta">${esc(DT[col.dataType] || col.dataType || '')}${col.calc ? ', coluna calculada' : ''}. O caminho aceso no canvas mostra tudo que depende dela.</p>`);
  if (!I.used && !I.pq.length) out.push('<div class="alert soft">Nada no modelo usa esta coluna. Dá para remover ou renomear sem quebrar medidas, visuais ou relacionamentos.</div>');
  else if (!I.used) out.push('<div class="alert soft">Nada no modelo usa esta coluna. Só o Power Query cita o nome dela nas etapas abaixo: ao remover, tire também dessas etapas.</div>');
  else if (I.used) out.push(`<div class="alert">Se você remover ou renomear esta coluna, quebra o que está listado abaixo.${I.indirect.length ? ' As medidas indiretas não citam a coluna, mas dependem de medidas que citam.' : ''}</div>`);
  const sec = (title, html) => html ? `<h3>${title}</h3>${html}` : '';
  out.push(sec(`Relacionamentos (${D.rels.length})`, D.rels.length && `<ul class="rels">${D.rels.map(r => `<li><code>${esc(r.rel)}</code></li>`).join('')}</ul>`));
  out.push(sec(`Medidas que usam a coluna (${D.measures.size})`, D.measures.size && chips([...D.measures], 60)));
  out.push(sec(`Medidas afetadas indiretamente (${I.indirect.length})`, I.indirect.length && chips(I.indirect, 60)));
  out.push(sec(`Visuais que usam a coluna (${D.visuals.size})`, D.visuals.size && chips([...D.visuals], 40)));
  const viaM = I.visuals.filter(v => !D.visuals.has(v));
  out.push(sec(`Visuais afetados pelas medidas (${viaM.length})`, viaM.length && chips(viaM, 40)));
  out.push(sec(`Páginas afetadas (${I.pages.length})`, I.pages.length && chips(I.pages)));
  out.push(sec('Colunas calculadas', D.calc.size && `<ul class="cl2">${[...D.calc].map(x => `<li><code>${esc(x)}</code></li>`).join('')}</ul>`));
  out.push(sec('Ordenação', D.sort.size && `<p class="meta">É a coluna de "Classificar por coluna" de: ${[...D.sort].map(esc).join(', ')}.</p>`));
  out.push(sec('Hierarquias', D.hier.size && `<p class="meta">${[...D.hier].map(esc).join(', ')}</p>`));
  out.push(sec('Tabelas calculadas e parâmetros', D.ctables.size && chips([...D.ctables])));
  if (I.pq.length) out.push(`<h3>Power Query</h3><p class="meta">Etapas da consulta ${esc(t)} que citam a coluna pelo nome: ${I.pq.map(esc).join(', ')}. Se o nome mudar na origem, essas etapas dão erro na atualização.</p>`);
  $('#pbody').innerHTML = out.join('');
  $('#panel').hidden = false; document.body.classList.add('panel-open'); st.panelMode = 'node';
  $('#pbody').scrollTop = 0;
}
function bpFindings(name) { return (st.bp && st.bp.M[name]) || []; }
function bpPanelSection(name) {
  const f = bpFindings(name);
  if (!f.length) return '<h3>Boas práticas</h3><p class="none">Nenhum ponto de boas práticas nesta medida.</p>';
  return `<h3>Boas práticas (${f.length})</h3><ul class="bpl">${f.map(x => { const R = BP_RULES[x.rule]; return `<li><span class="sev s-${R.sev}">${R.sev === 'media' ? 'Média' : 'Baixa'}</span><strong>${esc(R.title)}</strong>${x.detail ? `<span class="ft">${esc(x.detail)}</span>` : ''}<span class="ft">${esc(R.fix)}</span></li>`; }).join('')}</ul><button class="btn" data-bpopen="${esc(name)}">Ver na aba Boas práticas</button>`;
}
function backLinks() {
  return (st.diag.length ? '<button class="back" data-act="diag">← Diagnóstico</button>' : '') + (st.cmp ? '<button class="back" data-act="cmp">← Comparação</button>' : '');
}
const SEV = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const CHK = { vou: 'Vou resolver', resolvido: 'Resolvido', ignorar: 'Ignorar de propósito' };
function chkOf(key) { return st.checks[key] && st.checks[key].s; }
function setCheck(key, s) {
  const x = st.diag.find(d => d.key === key);
  if (chkOf(key) === s) delete st.checks[key];
  else st.checks[key] = { s, em: new Date().toISOString(), t: x ? x.title : (st.checks[key] && st.checks[key].t) || key, sev: x ? x.sev : (st.checks[key] && st.checks[key].sev) };
  saveChecks(); updateDiagBtn(); showDiag(true);
}
function updateDiagBtn() {
  const open = st.diag.filter(x => !['resolvido', 'ignorar'].includes(chkOf(x.key)));
  const alta = open.filter(x => x.sev === 'alta').length;
  $('#btnDiag').innerHTML = 'Diagnóstico' + (open.length ? ` <span class="dn${alta ? ' hi' : ''}">${open.length}</span>` : (st.diag.length ? ' <span class="dn ok">✓</span>' : ''));
}
function showDiag(keepScroll) {
  const d = st.diag; const sc = keepScroll ? $('#pbody').scrollTop : 0;
  const active = d.filter(x => !['resolvido', 'ignorar'].includes(chkOf(x.key)));
  const marked = d.filter(x => ['resolvido', 'ignorar'].includes(chkOf(x.key)));
  const gone = Object.keys(st.checks).filter(k => !d.some(x => x.key === k));
  const cnt = s => active.filter(x => x.sev === s).length;
  const nVou = d.filter(x => chkOf(x.key) === 'vou').length;
  const out = [(st.cmp ? '<button class="back" data-act="cmp">← Comparação</button>' : '') + `<div class="ph"><span class="kind">Diagnóstico</span><h2>${d.length ? active.length + (active.length === 1 ? ' ponto em aberto' : ' pontos em aberto') : 'Nenhum ponto encontrado'}</h2></div>`];
  if (d.length) out.push(`<div class="sevsum">${['alta', 'media', 'baixa'].map(s => `<span class="sev s-${s}">${cnt(s)} ${s === 'media' ? 'média' : s}${cnt(s) > 1 ? 's' : ''}</span>`).join('')}${nVou ? `<span class="sev s-vou">${nVou} vou resolver</span>` : ''}${marked.length ? `<span class="sev s-done">${marked.length} marcado${marked.length > 1 ? 's' : ''}</span>` : ''}</div>
    <p class="meta">Marque cada ponto como Vou resolver, Resolvido ou Ignorar de propósito. O checklist fica salvo neste navegador para este arquivo, vai junto quando você salva o desenho e acompanha a comparação de versões.</p>`);
  else out.push('<p class="meta">O modelo passou em todas as verificações.</p>');
  const item = x => {
    const s = chkOf(x.key); const c = st.checks[x.key];
    const stillThere = s === 'resolvido' ? '<div class="alert soft">Marcado como resolvido, mas o problema ainda aparece neste arquivo. Depois de corrigir, exporte um .pbit novo e abra aqui.</div>' : '';
    return `<section class="dg s-${x.sev}${s ? ' chk-' + s : ''}">
      <div class="dgh"><span class="sev s-${x.sev}">${SEV[x.sev]}</span><span class="cat">${esc(x.cat)}</span>${s ? `<span class="chkst c-${s}">${CHK[s]}${c && c.em ? ' em ' + new Date(c.em).toLocaleDateString('pt-BR') : ''}</span>` : ''}</div>
      <h3>${esc(x.title)}</h3>
      ${stillThere}
      <p>${esc(x.text)}</p>
      ${x.cols.length ? `<details${x.cols.length <= 3 ? ' open' : ''}><summary>Detalhes (${x.cols.length})</summary><ul class="dcols">${x.cols.map(c => `<li>${esc(c)}</li>`).join('')}</ul></details>` : ''}
      <p class="fix"><strong>Como resolver:</strong> ${esc(x.fix)}</p>
      <div class="chk" role="group" aria-label="Status no checklist">${Object.keys(CHK).map(k => `<button class="c-${k}" data-chk="${esc(x.key)}" data-s="${k}" aria-pressed="${s === k}">${CHK[k]}</button>`).join('')}</div>
      ${x.ids.length ? `<div class="btnrow"><button class="btn" data-diagsel="${x.idx}">Mostrar no canvas (${x.ids.length})</button><button class="btn" data-diagiso="${x.idx}">Isolar</button></div>` : ''}
    </section>`;
  };
  active.forEach(x => out.push(item(x)));
  if (marked.length) out.push(`<details class="marked"><summary>Marcados como resolvidos ou ignorados (${marked.length})</summary>${marked.map(item).join('')}</details>`);
  if (gone.length) out.push(`<section class="cmp"><h3>Não aparecem mais neste arquivo <span class="cn">${gone.length}</span></h3><ul class="dl ok">${gone.map(k => { const c = st.checks[k]; return `<li><span class="mk">✓</span><span>${esc(c.t || k)}<span class="now">Estava como: ${esc(CHK[c.s] || c.s)}</span></span></li>`; }).join('')}</ul></section>`);
  $('#pbody').innerHTML = out.join('');
  $('#panel').hidden = false; document.body.classList.add('panel-open'); st.panelMode = 'diag';
  $('#pbody').scrollTop = sc;
}
function selectMany(ids) {
  let changed = false;
  ids.forEach(id => { const n = st.g.N.get(id); if (n && n.type === 'medida' && !st.exp.has(n.folder)) { st.exp.add(n.folder); changed = true; } if (n && n.type === 'visual' && !st.pexp.has(n.page)) { st.pexp.add(n.page); changed = true; } });
  if (changed) { save(); render(); }
  const set = new Set(); ids.forEach(id => { const v = visId(id); if (v) set.add(v); });
  st.selSet = new Set(); st.sel = null; st.focusF = null; st.flag = set; st.flagIds = ids.slice();
  drawEdges(); updateClasses(); fit(set);
  const bb0 = bbox(set);
  if (bb0 && st.view.k < 0.5) {
    const bb = bb0; const r = $('#vp').getBoundingClientRect(); const pw = innerWidth > 760 ? 380 : 0; const k = 0.5;
    st.view = { k, x: (r.width - pw) / 2 - ((bb.x1 + bb.x2) / 2) * k, y: 70 - bb.y1 * k }; applyView();
    toast('Os itens destacados continuam para baixo: role a tela para ver todos.');
  }
}
function applySelection() {
  st.flag = null; st.flagIds = null; st.colSel = null;
  st.sel = st.selSet.size === 1 ? [...st.selSet][0] : null;
  computeFocus(); drawEdges(); updateClasses();
  if (st.selSet.size === 1) showPanel(st.sel);
  else if (st.selSet.size > 1) showMulti();
  else if (st.panelMode !== 'diag' && st.panelMode !== 'cmp') hidePanel();
}
function showMulti() {
  const ids = [...st.selSet];
  const order = ['origem', 'consulta', 'tabela', 'pasta', 'medida', 'pagina'];
  ids.sort((a, b) => order.indexOf(st.g.N.get(a).type) - order.indexOf(st.g.N.get(b).type));
  $('#pbody').innerHTML = backLinks() + `<div class="ph"><span class="kind">Seleção</span><h2>${ids.length} blocos selecionados</h2></div>
    <p class="meta">O caminho de todos eles está aceso no canvas. Arraste qualquer um para mover o grupo inteiro.</p>
    <div class="btnrow"><button class="btn" data-act="iso">${st.iso ? 'Mostrar tudo' : 'Isolar o caminho'}</button><button class="btn" data-act="clearsel">Limpar seleção</button></div>
    <div class="chips">${ids.map(id => chip(id)).join('')}</div>`;
  $('#panel').hidden = false; document.body.classList.add('panel-open'); st.panelMode = 'multi';
}
function hidePanel() { $('#panel').hidden = true; document.body.classList.remove('panel-open'); st.panelMode = ''; }

function visualName(t) {
  if (VISUAL_NAMES[t]) return VISUAL_NAMES[t];
  const m = /^(.+?)[0-9A-Fa-f]{32}$/.exec(t);
  if (m) { const base = m[1].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()); return base + ' (visual personalizado)'; }
  return t;
}
