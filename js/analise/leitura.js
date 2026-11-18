/* Fluxo do Power BI · leitura do .pbit (ZIP, modelo e relatório) e montagem do grafo */
/* ===== CORE: leitura do .pbit e grafo ===== */
const AUTO_RE = /^(LocalDateTable_|DateTableTemplate_)/;
const VISUAL_NAMES = {
  tableEx: 'Tabela', pivotTable: 'Matriz', card: 'Cartão', cardVisual: 'Cartão', multiRowCard: 'Cartão de várias linhas',
  slicer: 'Segmentação', advancedSlicerVisual: 'Segmentação', clusteredColumnChart: 'Colunas agrupadas',
  columnChart: 'Colunas', stackedColumnChart: 'Colunas empilhadas', clusteredBarChart: 'Barras agrupadas',
  barChart: 'Barras', stackedBarChart: 'Barras empilhadas', lineChart: 'Linhas', areaChart: 'Área',
  lineClusteredColumnComboChart: 'Linhas e colunas', lineStackedColumnComboChart: 'Linhas e colunas empilhadas',
  pieChart: 'Pizza', donutChart: 'Rosca', waterfallChart: 'Cascata', funnel: 'Funil', gauge: 'Medidor',
  kpi: 'KPI', map: 'Mapa', filledMap: 'Mapa preenchido', azureMap: 'Mapa', treemap: 'Treemap',
  scatterChart: 'Dispersão', textbox: 'Caixa de texto', image: 'Imagem', shape: 'Forma',
  actionButton: 'Botão', ribbonChart: 'Faixas', decompositionTreeVisual: 'Árvore de decomposição'
};
const STEP_NAMES = {
  'Table.TransformColumnTypes': 'tipos alterados', 'Table.RenameColumns': 'colunas renomeadas',
  'Table.SelectRows': 'linhas filtradas', 'Table.RemoveColumns': 'colunas removidas',
  'Table.SelectColumns': 'colunas selecionadas', 'Table.AddColumn': 'coluna adicionada',
  'Table.Combine': 'consultas acrescentadas', 'Table.NestedJoin': 'mesclagem', 'Table.Join': 'mesclagem',
  'Table.ExpandTableColumn': 'coluna expandida', 'Table.TransformColumns': 'colunas transformadas',
  'Csv.Document': 'leitura de CSV', 'Web.Contents': 'download web', 'PostgreSQL.Database': 'consulta PostgreSQL',
  'Sql.Database': 'consulta SQL Server', 'Table.PromoteHeaders': 'cabeçalhos promovidos', 'Table.Group': 'agrupamento',
  'Table.Distinct': 'duplicatas removidas', 'Table.ReplaceValue': 'valores substituídos', 'Table.Sort': 'classificação',
  'Table.UnpivotOtherColumns': 'colunas não dinâmicas', 'Table.Unpivot': 'colunas não dinâmicas',
  'Table.FromList': 'lista convertida em tabela', 'List.Dates': 'lista de datas', 'Excel.Workbook': 'leitura de Excel',
  'Json.Document': 'leitura de JSON', 'Table.Pivot': 'coluna dinâmica', 'Table.FillDown': 'preenchido para baixo',
  'Table.DuplicateColumn': 'coluna duplicada', 'Table.SplitColumn': 'coluna dividida', 'Table.Buffer': 'buffer'
};

function visualTypeName(t) {
  if (VISUAL_NAMES[t]) return VISUAL_NAMES[t];
  const m = /^(.+?)[0-9A-Fa-f]{32}$/.exec(t || '');
  if (m) return m[1].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()) + ' (personalizado)';
  return t || 'Visual';
}
// soma, subtração e multiplicação de inteiros (ex.: 365*2), sem eval
function simpleArith(s) {
  const tk = String(s).replace(/\s+/g, '').match(/\d+|[*+-]/g); if (!tk || tk.join('') !== String(s).replace(/\s+/g, '')) return NaN;
  let total = 0, sign = 1, term = null, mul = false;
  for (const t of tk) {
    if (/\d/.test(t)) { const n = +t; term = term === null ? n : (mul ? term * n : NaN); mul = false; }
    else if (t === '*') { if (term === null) return NaN; mul = true; }
    else { if (term === null) return NaN; total += sign * term; sign = t === '-' ? -1 : 1; term = null; }
  }
  return term === null || mul ? NaN : total + sign * term;
}
function txt(e) { return Array.isArray(e) ? e.join('\n') : (e || ''); }
function decodeBytes(u8) {
  let enc = 'utf-8';
  if (u8.length > 1 && u8[0] === 0xFF && u8[1] === 0xFE) enc = 'utf-16le';
  else if (u8.length > 3 && u8[1] === 0 && u8[3] === 0) enc = 'utf-16le';
  return new TextDecoder(enc).decode(u8).replace(/^\uFEFF/, '');
}
function walk(o, f) {
  if (Array.isArray(o)) { for (const x of o) walk(x, f); }
  else if (o && typeof o === 'object') { f(o); for (const k in o) walk(o[k], f); }
}
function deepParse(o) {
  // configs antigos guardam JSON dentro de strings
  if (typeof o === 'string') {
    const s = o.trim();
    if ((s[0] === '{' && s.endsWith('}')) || (s[0] === '[' && s.endsWith(']'))) {
      try { return deepParse(JSON.parse(s)); } catch (e) { return o; }
    }
    return o;
  }
  if (Array.isArray(o)) return o.map(deepParse);
  if (o && typeof o === 'object') { const r = {}; for (const k in o) r[k] = deepParse(o[k]); return r; }
  return o;
}
function collectRefs(obj) {
  const refs = { measures: new Set(), columns: new Set(), tables: new Set() };
  const consumed = new WeakSet();
  // cada consulta (visual, filtro) tem o próprio From, e os apelidos curtos (c, d...) se repetem entre elas
  const visit = (o, aliases) => {
    if (Array.isArray(o)) { for (const x of o) visit(x, aliases); return; }
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o.From)) { aliases = Object.assign({}, aliases); o.From.forEach(a => { if (a && a.Name && a.Entity) aliases[a.Name] = a.Entity; }); }
    check(o, sr => sr && (sr.Entity || aliases[sr.Source]));
    for (const k in o) visit(o[k], aliases);
  };
  const check = (o, ent) => {
    if (o.Measure && o.Measure.Property && o.Measure.Expression) {
      // medidas criadas no próprio relatório (Schema "extension") não existem no modelo
      const sr = o.Measure.Expression.SourceRef;
      if (!(sr && sr.Schema === 'extension')) refs.measures.add(o.Measure.Property);
      consumed.add(o.Measure.Expression);
    }
    if (o.Column && o.Column.Property && o.Column.Expression) {
      const e = ent(o.Column.Expression.SourceRef);
      if (e) refs.columns.add(e + '|' + o.Column.Property);
    }
    if (o.PropertyVariationSource && o.PropertyVariationSource.Property && o.PropertyVariationSource.Expression) {
      const e = ent(o.PropertyVariationSource.Expression.SourceRef); if (e) refs.columns.add(e + '|' + o.PropertyVariationSource.Property);
    }
    if (o.SourceRef && !consumed.has(o) && o.SourceRef.Schema !== 'extension') { const e = ent(o.SourceRef); if (e) refs.tables.add(e); }
  };
  visit(obj, {});
  return refs;
}
function titleOf(v) {
  const t = (v && v.visual && v.visual.visualContainerObjects && v.visual.visualContainerObjects.title)
    || (v && v.singleVisual && v.singleVisual.vcObjects && v.singleVisual.vcObjects.title);
  try {
    const val = t[0].properties.text.expr.Literal.Value;
    return String(val).replace(/^'|'$/g, '');
  } catch (e) { return ''; }
}

async function parseReport(zip) {
  const files = Object.keys(zip.files);
  const pages = []; let reportRefs = { measures: new Set(), columns: new Set(), tables: new Set() };
  const pj = zip.file('Report/definition/pages/pages.json');
  const pageFiles = files.filter(p => /^Report\/definition\/pages\/[^/]+\/page\.json$/.test(p));
  if (pageFiles.length) {
    let order = [];
    if (pj) { try { order = JSON.parse(await pj.async('string')).pageOrder || []; } catch (e) {} }
    for (const pf of pageFiles) {
      const dir = pf.replace(/page\.json$/, '');
      const id = dir.split('/').slice(-2)[0];
      let page = {}; try { page = JSON.parse(await zip.file(pf).async('string')); } catch (e) {}
      const visuals = [];
      for (const vf of files.filter(p => p.startsWith(dir + 'visuals/') && /\/visual\.json$/.test(p))) {
        let v; try { v = JSON.parse(await zip.file(vf).async('string')); } catch (e) { continue; }
        if (!v.visual) continue;
        visuals.push({ type: v.visual.visualType || '?', title: titleOf(v), refs: collectRefs(v) });
      }
      const pageRefs = collectRefs(page.filterConfig || {});
      pages.push({ id, name: page.displayName || id, hidden: page.visibility === 'HiddenInViewMode', visuals, pageRefs, idx: order.indexOf(id) });
    }
    pages.sort((a, b) => (a.idx < 0 ? 1e9 : a.idx) - (b.idx < 0 ? 1e9 : b.idx));
    const rf = zip.file('Report/definition/report.json');
    if (rf) { try { reportRefs = collectRefs(JSON.parse(await rf.async('string')).filterConfig || {}); } catch (e) {} }
  } else if (zip.file('Report/Layout')) {
    const lay = deepParse(JSON.parse(decodeBytes(await zip.file('Report/Layout').async('uint8array'))));
    (lay.sections || []).forEach((s, i) => {
      const visuals = [];
      (s.visualContainers || []).forEach(vc => {
        const cfg = vc.config || {};
        const sv = cfg.singleVisual; if (!sv) return;
        const r = collectRefs({ a: cfg, b: vc.filters || [], c: vc.query || {} });
        visuals.push({ type: sv.visualType || '?', title: titleOf(cfg), refs: r });
      });
      const cfg = s.config || {};
      pages.push({ id: s.name || String(i), name: s.displayName || ('Página ' + (i + 1)), hidden: cfg.visibility === 1, visuals, pageRefs: collectRefs(s.filters || []), idx: i });
    });
    reportRefs = collectRefs(lay.filters || []);
  }
  return { pages, reportRefs };
}

async function parsePbit(zip) {
  const dms = zip.file('DataModelSchema');
  if (!dms) {
    if (zip.file('DataModel')) throw new Error('PBIX');
    throw new Error('SEM_MODELO');
  }
  const schema = JSON.parse(decodeBytes(await dms.async('uint8array')));
  const report = await parseReport(zip);
  return { model: schema.model || {}, report };
}

function stripStrings(m) { return m.replace(/(#?)"(?:[^"]|"")*"/g, (s, h) => h ? s : '""'); }
function parseSteps(m) {
  const body = stripStrings(m);
  const out = []; const re = /^\s*(#"(?:[^"]|"")*"|[A-Za-zÀ-ÿ_][\wÀ-ÿ]*)\s*=\s*([A-Za-z][\w.]*)?/gm; let r;
  while ((r = re.exec(body))) {
    let name = r[1]; if (name === 'let' || name === 'in') continue;
    name = name.replace(/^#"|"$/g, '').replace(/""/g, '"');
    const fn = r[2] || '';
    out.push({ name, fn, label: STEP_NAMES[fn] || (fn && fn.includes('.') ? fn : 'navegação') });
  }
  return out;
}
function detectSources(m) {
  const out = []; let r;
  const add = s => { if (!out.find(x => x.key === s.key)) out.push(s); };
  const pg = /PostgreSQL\.Database\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
  while ((r = pg.exec(m))) add({ key: 'pg:' + r[1] + '/' + r[2], kind: 'PostgreSQL', label: r[1], sub: 'PostgreSQL · banco ' + r[2] });
  const my = /MySQL\.Database\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
  while ((r = my.exec(m))) add({ key: 'my:' + r[1] + '/' + r[2], kind: 'MySQL', label: r[1], sub: 'MySQL · banco ' + r[2] });
  const sql = /Sql\.Databases?\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?/g;
  while ((r = sql.exec(m))) add({ key: 'sql:' + r[1] + '/' + (r[2] || ''), kind: 'SQL Server', label: r[1], sub: 'SQL Server' + (r[2] ? ' · banco ' + r[2] : '') });
  const web = /Web\.Contents\(\s*"([^"]+)"/g;
  while ((r = web.exec(m))) {
    let host = r[1]; try { host = new URL(r[1]).host; } catch (e) {}
    const pub = /\/public\//i.test(r[1]);
    const key = 'web:' + host;
    const ex = out.find(x => x.key === key);
    if (ex) { ex.urls.push(r[1]); if (pub) ex.publicCount++; }
    else out.push({ key, kind: 'Web', label: host, sub: 'Download pela web', urls: [r[1]], publicCount: pub ? 1 : 0 });
  }
  const file = /File\.Contents\(\s*"([^"]+)"/g;
  while ((r = file.exec(m))) add({ key: 'file:' + r[1], kind: 'Arquivo', label: r[1].split(/[\\/]/).pop(), sub: 'Arquivo local' });
  const sp = /SharePoint\.(?:Files|Contents|Tables)\(\s*"([^"]+)"/g;
  while ((r = sp.exec(m))) { let h = r[1]; try { h = new URL(r[1]).host; } catch (e) {} add({ key: 'sp:' + h, kind: 'SharePoint', label: h, sub: 'SharePoint' }); }
  const od = /OData\.Feed\(\s*"([^"]+)"/g;
  while ((r = od.exec(m))) { let h = r[1]; try { h = new URL(r[1]).host; } catch (e) {} add({ key: 'od:' + h, kind: 'OData', label: h, sub: 'OData' }); }
  const bq = /GoogleBigQuery\.Database\(/g; if (bq.test(m)) add({ key: 'bq', kind: 'BigQuery', label: 'Google BigQuery', sub: 'BigQuery' });
  const sf = /Snowflake\.Databases\(\s*"([^"]+)"/g; while ((r = sf.exec(m))) add({ key: 'sf:' + r[1], kind: 'Snowflake', label: r[1], sub: 'Snowflake' });
  const odbc = /Odbc\.(?:DataSource|Query)\(\s*"([^"]+)"/g; while ((r = odbc.exec(m))) add({ key: 'odbc:' + r[1], kind: 'ODBC', label: r[1].slice(0, 40), sub: 'ODBC' });
  return out;
}
function sqlInfo(m) {
  const q = /Query\s*=\s*"((?:[^"]|"")*)"/.exec(m);
  if (!q) return null;
  const sql = q[1].replace(/""/g, '"');
  const f = /\bfrom\s+([\w."]+)/i.exec(sql);
  return { sql, from: f ? f[1].replace(/"/g, '') : '' };
}
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildGraph(data) {
  const { model, report } = data;
  const N = new Map(); const L = [];
  const node = (id, o) => { if (!N.has(id)) N.set(id, Object.assign({ id, badges: [] }, o)); return N.get(id); };
  const link = (s, t, kind) => { if (s !== t && N.has(s) && N.has(t)) L.push({ s, t, kind }); };
  const tables = model.tables || [];
  const tableNames = tables.map(t => t.name);

  // consultas
  const queries = [];
  tables.forEach(t => {
    const p = (t.partitions || [])[0]; if (!p || !p.source) return;
    if (p.source.type === 'm') queries.push({ name: t.name, m: txt(p.source.expression), loaded: true });
  });
  (model.expressions || []).forEach(e => {
    const m = txt(e.expression);
    if (/IsParameterQuery\s*=\s*true/i.test(m)) return;
    if (e.kind && e.kind !== 'm') return;
    if (!tableNames.includes(e.name)) queries.push({ name: e.name, m, loaded: false });
  });
  const qNames = queries.map(q => q.name);

  queries.forEach(q => {
    const steps = parseSteps(q.m);
    const srcs = detectSources(q.m);
    const refs = qNames.filter(o => o !== q.name && (q.m.includes('#"' + o + '"') || (!/[\s"]/.test(o) && new RegExp('(?<![\\w."#\\[])' + escRe(o) + '(?![\\w"\\]])').test(stripStrings(q.m)))));
    const n = node('q:' + q.name, { type: 'consulta', label: q.name, data: { m: q.m, steps, loaded: q.loaded, srcs, refs, sql: sqlInfo(q.m) } });
    n.sub = steps.length + (steps.length === 1 ? ' etapa' : ' etapas');
    if (!q.loaded) n.badges.push({ t: 'carga desabilitada', k: 'mute' });
    srcs.forEach(s => {
      const o = node('o:' + s.key, { type: 'origem', label: s.label, sub: s.sub, data: { kind: s.kind, urls: [], publicCount: 0, queries: [] } });
      if (s.urls) { o.data.urls.push(...s.urls); o.data.publicCount += s.publicCount; }
      o.data.queries.push(q.name);
    });
    if (!srcs.length && !refs.length) {
      const o = node('o:gen:pq', { type: 'origem', label: 'Gerado no Power Query', sub: 'Sem fonte externa', data: { kind: 'Power Query', urls: [], publicCount: 0, queries: [] } });
      o.data.queries.push(q.name);
    }
  });
  for (const o of N.values()) if (o.type === 'origem' && o.data.publicCount) o.badges.push({ t: o.data.publicCount + (o.data.publicCount > 1 ? ' links públicos' : ' link público'), k: 'warn' });
  queries.forEach(q => {
    const n = N.get('q:' + q.name);
    n.data.srcs.forEach(s => link('o:' + s.key, n.id, 'src'));
    if (!n.data.srcs.length && !n.data.refs.length) link('o:gen:pq', n.id, 'src');
    n.data.refs.forEach(r => link('q:' + r, n.id, 'ref'));
  });

  // tabelas
  const rels = model.relationships || [];
  tables.forEach(t => {
    const auto = AUTO_RE.test(t.name);
    const p = (t.partitions || [])[0] || {}; const st = p.source ? p.source.type : '';
    const cols = (t.columns || []).filter(c => !/^RowNumber/.test(c.name)).map(c => ({ name: c.name, dataType: c.dataType, calc: c.type === 'calculated', hidden: !!c.isHidden, expr: txt(c.expression) }));
    const kind = auto ? 'auto' : (st === 'calculated' ? 'calculada' : (st === 'm' ? 'importada' : (st || 'outra')));
    const n = node('t:' + t.name, { type: 'tabela', label: t.name, auto, data: { kind, cols, expr: st === 'calculated' ? txt(p.source.expression) : '', mode: p.mode || '' } });
    const nm = (t.measures || []).length;
    n.sub = cols.length + (cols.length === 1 ? ' coluna' : ' colunas') + (nm ? ' · ' + nm + (nm === 1 ? ' medida' : ' medidas') : '');
    if (auto) n.badges.push({ t: 'data automática', k: 'mute' });
    if (kind === 'calculada') n.badges.push({ t: 'DAX', k: 'mute' });
    if (st === 'm') link('q:' + t.name, n.id, 'load');
    if (st === 'calculated') {
      const oid = auto ? 'o:gen:auto' : 'o:gen:dax';
      node(oid, auto ? { type: 'origem', label: 'Data/hora automática', sub: 'Criadas pelo Power BI', auto: true, data: { kind: 'auto', urls: [], publicCount: 0, queries: [] } }
        : { type: 'origem', label: 'Calculada com DAX', sub: 'Tabelas criadas no modelo', data: { kind: 'DAX', urls: [], publicCount: 0, queries: [] } });
      N.get(oid).data.queries.push(t.name);
      link(oid, n.id, 'calc');
    }
  });

  // medidas
  const measures = [];
  tables.forEach(t => (t.measures || []).forEach(ms => measures.push({ name: ms.name, home: t.name, folder: (ms.displayFolder || '').split('\\')[0] || '(sem pasta)', fullFolder: ms.displayFolder || '', expr: txt(ms.expression), fmt: ms.formatString || '', hidden: !!ms.isHidden })));
  const mNames = new Set(measures.map(m => m.name));
  // a tabela conta como usada também quando entra como argumento (SUMX(Vendas, ...), COUNTROWS(Vendas)), não só em Vendas[Coluna]
  const tabRe = tableNames.map(tn => ({ tn, re: new RegExp("'" + escRe(tn.replace(/'/g, "''")) + "'" + (/^[A-Za-z_]\w*$/.test(tn) ? '|(?<![\\w\'.])' + escRe(tn) + '(?![\\w(])' : ''), 'i') }));
  const mRe = [...mNames].map(mn => ({ mn, re: new RegExp('(?<![\\w\'\\]])\\[\\s*' + escRe(mn) + '\\s*\\]') }));
  const depsOf = expr => {
    // sem strings e comentários; o que está entre colchetes é coluna ou medida, não tabela
    const e = stripDax(expr); const semCol = e.replace(/\[[^\]]*\]/g, '[]');
    return { tables: tabRe.filter(x => x.re.test(semCol)).map(x => x.tn), measures: mRe.filter(x => x.re.test(e)).map(x => x.mn) };
  };
  measures.forEach(ms => {
    const d = depsOf(ms.expr);
    ms.depT = d.tables; ms.depM = d.measures.filter(x => x !== ms.name);
    node('m:' + ms.name, { type: 'medida', label: ms.name, folder: ms.folder, data: ms });
  });
  // usos em colunas e tabelas calculadas
  const otherUse = new Set();
  tables.forEach(t => {
    (t.columns || []).forEach(c => { if (c.type === 'calculated') depsOf(txt(c.expression)).measures.forEach(x => otherUse.add(x)); });
    const p = (t.partitions || [])[0];
    if (p && p.source && p.source.type === 'calculated') depsOf(txt(p.source.expression)).measures.forEach(x => otherUse.add(x));
  });

  // páginas
  const directUse = new Set([...report.reportRefs.measures].filter(x => mNames.has(x)));
  otherUse.forEach(x => directUse.add(x));
  (report.pages || []).forEach(pg => {
    const mset = new Set(), tset = new Set();
    const addRefs = r => {
      r.measures.forEach(x => { if (mNames.has(x)) mset.add(x); });
      r.columns.forEach(c => tset.add(c.split('|')[0]));
      r.tables.forEach(x => { if (tableNames.includes(x)) tset.add(x); });
    };
    pg.visuals.forEach(v => addRefs(v.refs)); addRefs(pg.pageRefs);
    // tabela "lar" de medidas não conta como uso de coluna
    measures.forEach(ms => { if (mset.has(ms.name) && tset.has(ms.home)) {
      const homeCols = pg.visuals.some(v => [...v.refs.columns].some(c => c.startsWith(ms.home + '|')));
      if (!homeCols) tset.delete(ms.home);
    } });
    mset.forEach(x => directUse.add(x));
    const n = node('p:' + pg.id, { type: 'pagina', label: pg.name, data: { pg, mset, tset } });
    n.sub = pg.visuals.length + (pg.visuals.length === 1 ? ' visual' : ' visuais');
    if (pg.hidden) n.badges.push({ t: 'oculta', k: 'mute' });
    const broken = [...tset].filter(x => !tableNames.includes(x));
    n.data.broken = broken;
    if (broken.length) n.badges.push({ t: 'campo quebrado', k: 'warn' });
  });
  // alcance de uso
  const used = new Set(); const stack = [...directUse];
  const byName = new Map(measures.map(m => [m.name, m]));
  while (stack.length) { const x = stack.pop(); if (used.has(x)) continue; used.add(x); const m = byName.get(x); if (m) stack.push(...m.depM); }
  measures.forEach(ms => { ms.unused = !used.has(ms.name); if (ms.unused) N.get('m:' + ms.name).badges.push({ t: 'sem uso', k: 'warn' }); });
  measures.forEach(ms => {
    const n = N.get('m:' + ms.name);
    n.sub = ms.fullFolder ? ms.fullFolder.replace(/\\/g, ' / ') : 'sem pasta';
    ms.depT.forEach(tn => link('t:' + tn, n.id, 'uses'));
    ms.depM.forEach(mn => link('m:' + mn, n.id, 'dep'));
  });
  for (const n of [...N.values()]) if (n.type === 'pagina') {
    const pg = n.data.pg; n.data.visuals = [];
    // filtros da página ligam direto na página
    pg.pageRefs.measures.forEach(x => { if (mNames.has(x)) link('m:' + x, n.id, 'show'); });
    new Set([...pg.pageRefs.columns].map(c => c.split('|')[0])).forEach(t => link('t:' + t, n.id, 'showcol'));
    pg.visuals.forEach((v, i) => {
      const ms = [...v.refs.measures].filter(x => mNames.has(x));
      const ctabs = new Set([...v.refs.columns].map(c => c.split('|')[0]));
      if (!ms.length && !ctabs.size) return;
      const vid = 'v:' + pg.id + ':' + i;
      const tname = visualTypeName(v.type);
      const missT = [...ctabs].filter(t => !tableNames.includes(t));
      const missM = [...v.refs.measures].filter(x => !mNames.has(x) && !tables.some(t => (t.columns || []).some(c => c.name === x)));
      const firstCol = [...v.refs.columns][0]; const fallback = ms[0] || (firstCol ? firstCol.split('|')[1] : tname);
      const vn = node(vid, { type: 'visual', label: v.title || fallback, sub: tname, page: pg.id, data: { v, pageName: pg.name, tname, missT, missM } });
      if (missT.length || missM.length) vn.badges.push({ t: 'campo quebrado', k: 'warn' });
      n.data.visuals.push(vid);
      ms.forEach(x => link('m:' + x, vid, 'showv'));
      ctabs.forEach(t => link('t:' + t, vid, 'showcolv'));
      link(vid, n.id, 'in');
    });
  }
  // pastas
  const folders = new Map();
  measures.forEach(ms => { if (!folders.has(ms.folder)) folders.set(ms.folder, []); folders.get(ms.folder).push(ms.name); });
  for (const [f, list] of folders) {
    const un = list.filter(x => byName.get(x).unused).length;
    const n = node('f:' + f, { type: 'pasta', label: f, data: { members: list.map(x => 'm:' + x), unused: un } });
    n.sub = list.length + (list.length === 1 ? ' medida' : ' medidas');
    if (un) n.badges.push({ t: un + ' sem uso', k: 'warn' });
  }
  const stats = {
    tabelas: tables.filter(t => !AUTO_RE.test(t.name)).length, auto: tables.filter(t => AUTO_RE.test(t.name)).length,
    consultas: queries.length, medidas: measures.length, semUso: measures.filter(m => m.unused).length,
    paginas: (report.pages || []).length, visuais: (report.pages || []).reduce((a, p) => a + p.visuals.length, 0),
    relacoes: rels.filter(r => !AUTO_RE.test(r.toTable) && !AUTO_RE.test(r.fromTable)).length
  };
  return { N, L, rels, stats };
}
