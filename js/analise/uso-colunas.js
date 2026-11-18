/* Fluxo do Power BI · onde cada coluna é usada */
/* ===== USO DE COLUNAS ===== */
function columnUsage(data, g) {
  const { model, report } = data;
  const tables = (model.tables || []);
  const colsOf = {}; tables.forEach(t => colsOf[t.name] = new Set((t.columns || []).filter(c => !/^RowNumber/.test(c.name)).map(c => c.name)));
  const U = {}; tables.forEach(t => { if (AUTO_RE.test(t.name)) return; U[t.name] = {}; colsOf[t.name].forEach(c => U[t.name][c] = { uses: new Set(), by: new Set(), refs: [] }); });
  const mark = (t, col, use, by, ref) => { if (U[t] && U[t][col]) { U[t][col].uses.add(use); if (by) U[t][col].by.add(by); U[t][col].refs.push(Object.assign({ use, by }, ref || {})); } };
  const mNames = new Set(); tables.forEach(t => (t.measures || []).forEach(m => mNames.add(m.name)));
  const scan = (expr, homeTables, use, by, ref) => {
    const refInfo = ref; const re = /(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))\s*\[([^\]]+)\]/g; let r; const refs = new Set();
    while ((r = re.exec(expr))) { const t = (r[1] || r[2] || '').replace(/''/g, "'"); if (colsOf[t] && colsOf[t].has(r[3].trim())) { mark(t, r[3].trim(), use, by, refInfo); refs.add(t); } }
    const bare = /(?<![\w'\]])\[([^\]]+)\]/g;
    while ((r = bare.exec(expr))) { const nm = r[1].trim(); if (mNames.has(nm)) continue; [...homeTables, ...refs].forEach(t => { if (colsOf[t] && colsOf[t].has(nm)) mark(t, nm, use, by, refInfo); }); }
  };
  tables.forEach(t => {
    (t.measures || []).forEach(m => { const e = txt(m.expression); const n = g.N.get('m:' + m.name); scan(e, n ? n.data.depT : [], 'medida', m.name, { id: 'm:' + m.name }); });
    (t.columns || []).forEach(col => { if (col.type === 'calculated') scan(txt(col.expression), [t.name], 'coluna calculada', t.name + '[' + col.name + ']', { id: 't:' + t.name }); });
    const p = (t.partitions || [])[0];
    if (p && p.source && p.source.type === 'calculated' && !AUTO_RE.test(t.name)) scan(txt(p.source.expression), [], 'tabela calculada', t.name, { id: 't:' + t.name });
    (t.hierarchies || []).forEach(h => (h.levels || []).forEach(l => mark(t.name, l.column, 'hierarquia', h.name)));
  });
  const vref = (r, by, ref, use) => r.columns.forEach(x => { const [t, col] = x.split('|'); mark(t, col, use || 'visual', by, ref); });
  (report.pages || []).forEach(pg => { pg.visuals.forEach((v, i) => vref(v.refs, pg.name, { id: 'v:' + pg.id + ':' + i, page: 'p:' + pg.id })); vref(pg.pageRefs, pg.name, { id: 'p:' + pg.id }, 'filtro de página'); });
  vref(report.reportRefs, 'filtro do relatório');
  (model.relationships || []).forEach(r => { if (AUTO_RE.test(r.toTable) || AUTO_RE.test(r.fromTable)) return; const rs = r.fromTable + '[' + r.fromColumn + '] → ' + r.toTable + '[' + r.toColumn + ']' + (r.isActive === false ? ' (inativo)' : ''); mark(r.fromTable, r.fromColumn, 'relacionamento', r.toTable, { id: 't:' + r.toTable, rel: rs }); mark(r.toTable, r.toColumn, 'relacionamento', r.fromTable, { id: 't:' + r.fromTable, rel: rs }); });
  tables.forEach(t => (t.columns || []).forEach(col => { if (col.sortByColumn && U[t.name] && U[t.name][col.name] && U[t.name][col.name].uses.size) mark(t.name, col.sortByColumn, 'ordenação', col.name, { id: 't:' + t.name }); }));
  return U;
}
