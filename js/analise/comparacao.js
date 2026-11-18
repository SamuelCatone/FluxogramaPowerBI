/* Fluxo do Power BI · comparação entre duas versões do .pbit */
/* ===== COMPARAÇÃO ===== */
function snapshot(data, g) {
  const m = data.model; const S = { tables: {}, measures: {}, queries: {}, rels: {}, pages: {}, auto: 0 };
  (m.tables || []).forEach(t => {
    if (AUTO_RE.test(t.name)) { if (/^LocalDateTable_/.test(t.name)) S.auto++; return; }
    const cols = {}; (t.columns || []).filter(c => !/^RowNumber/.test(c.name)).forEach(c => cols[c.name] = { type: c.dataType || '', calc: c.type === 'calculated', expr: txt(c.expression) });
    S.tables[t.name] = { cols };
    (t.measures || []).forEach(ms => S.measures[ms.name] = { expr: txt(ms.expression), folder: ms.displayFolder || '', home: t.name });
  });
  for (const n of g.N.values()) if (n.type === 'consulta') S.queries[n.label] = { m: n.data.m, loaded: n.data.loaded, steps: n.data.steps.map(s => s.name) };
  (m.relationships || []).forEach(r => { if (AUTO_RE.test(r.toTable) || AUTO_RE.test(r.fromTable)) return; S.rels[r.fromTable + '[' + r.fromColumn + '] → ' + r.toTable + '[' + r.toColumn + ']'] = { active: r.isActive !== false, both: r.crossFilteringBehavior === 'bothDirections', from: r.fromTable, to: r.toTable }; });
  // duas páginas com o mesmo nome não podem se fundir na comparação
  (data.report.pages || []).forEach(p => { let k = p.name, i = 2; while (S.pages[k]) k = p.name + ' (' + i++ + ')'; S.pages[k] = { visuals: p.visuals.length, hidden: p.hidden }; });
  return S;
}
const normCode = s => String(s || '').replace(/\s+/g, ' ').trim();
function diffModels(a, b) {
  const keys = o => Object.keys(o);
  const D = { tables: { add: [], del: [] }, cols: { add: [], del: [], chg: [] }, measures: { add: [], del: [], chg: [], moved: [] }, queries: { add: [], del: [], chg: [], load: [] }, rels: { add: [], del: [], chg: [] }, pages: { add: [], del: [], chg: [] }, auto: [a.auto, b.auto] };
  keys(b.tables).forEach(t => { if (!a.tables[t]) D.tables.add.push(t); });
  keys(a.tables).forEach(t => { if (!b.tables[t]) D.tables.del.push(t); });
  keys(b.tables).forEach(t => { if (!a.tables[t]) return; const ca = a.tables[t].cols, cb = b.tables[t].cols;
    keys(cb).forEach(c => { if (!ca[c]) D.cols.add.push({ t, c }); else if (ca[c].type !== cb[c].type || normCode(ca[c].expr) !== normCode(cb[c].expr)) D.cols.chg.push({ t, c, before: ca[c].type + (ca[c].expr ? ' = ' + ca[c].expr : ''), after: cb[c].type + (cb[c].expr ? ' = ' + cb[c].expr : '') }); });
    keys(ca).forEach(c => { if (!cb[c]) D.cols.del.push({ t, c }); }); });
  keys(b.measures).forEach(m => { const x = a.measures[m], y = b.measures[m]; if (!x) D.measures.add.push(m); else { if (normCode(x.expr) !== normCode(y.expr)) D.measures.chg.push({ name: m, before: x.expr, after: y.expr }); if (x.folder !== y.folder) D.measures.moved.push({ name: m, before: x.folder || 'sem pasta', after: y.folder || 'sem pasta' }); } });
  keys(a.measures).forEach(m => { if (!b.measures[m]) D.measures.del.push(m); });
  keys(b.queries).forEach(q => { const x = a.queries[q], y = b.queries[q]; if (!x) D.queries.add.push(q); else {
    if (normCode(x.m) !== normCode(y.m)) D.queries.chg.push({ name: q, before: x.m, after: y.m, stepsAdd: y.steps.filter(s => !x.steps.includes(s)), stepsDel: x.steps.filter(s => !y.steps.includes(s)) });
    if (x.loaded !== y.loaded) D.queries.load.push({ name: q, after: y.loaded }); } });
  keys(a.queries).forEach(q => { if (!b.queries[q]) D.queries.del.push(q); });
  keys(b.rels).forEach(r => { const x = a.rels[r], y = b.rels[r]; if (!x) D.rels.add.push(Object.assign({ k: r }, y)); else if (x.active !== y.active || x.both !== y.both) D.rels.chg.push(Object.assign({ k: r, wasActive: x.active, wasBoth: x.both }, y)); });
  keys(a.rels).forEach(r => { if (!b.rels[r]) D.rels.del.push(Object.assign({ k: r }, a.rels[r])); });
  keys(b.pages).forEach(p => { const x = a.pages[p], y = b.pages[p]; if (!x) D.pages.add.push(p); else if (x.visuals !== y.visuals || x.hidden !== y.hidden) D.pages.chg.push({ name: p, before: x, after: y }); });
  keys(a.pages).forEach(p => { if (!b.pages[p]) D.pages.del.push(p); });
  D.total = D.tables.add.length + D.tables.del.length + D.cols.add.length + D.cols.del.length + D.cols.chg.length + D.measures.add.length + D.measures.del.length + D.measures.chg.length + D.measures.moved.length + D.queries.add.length + D.queries.del.length + D.queries.chg.length + D.queries.load.length + D.rels.add.length + D.rels.del.length + D.rels.chg.length + D.pages.add.length + D.pages.del.length + D.pages.chg.length;
  return D;
}
