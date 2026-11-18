/* Fluxo do Power BI · dicionário de dados em Excel e Markdown */
/* ---------- dicionário de dados ---------- */
function buildDict() {
  const { data, g } = st.cur; const N = g.N; const m = data.model; const CU = g.colUse || {};
  const tables = (m.tables || []).filter(t => !AUTO_RE.test(t.name));
  const DT2 = { string: 'Texto', int64: 'Número inteiro', double: 'Número decimal', decimal: 'Decimal fixo', dateTime: 'Data/hora', boolean: 'Verdadeiro/falso', binary: 'Binário' };
  const srcOf = tname => {
    const q = N.get('q:' + tname); const t = N.get('t:' + tname);
    if (t && t.data.kind === 'calculada') return 'Tabela calculada com DAX';
    if (!q) return '';
    const parts = q.data.srcs.map(s => s.kind + ': ' + s.label + (s.publicCount ? ' (link público)' : ''));
    if (q.data.sql && q.data.sql.from) parts.push('tabela no banco ' + q.data.sql.from);
    if (q.data.refs.length) parts.push('junta com ' + q.data.refs.join(', '));
    return parts.join('; ') || 'Gerado no Power Query';
  };
  const pageName = id => { const n = N.get(id); return n ? n.label : id; };
  const T = tables.map(t => {
    const id = 't:' + t.name; const cu = CU[t.name] || {};
    const cols = (t.columns || []).filter(c => !/^RowNumber/.test(c.name));
    const unused = cols.filter(c => cu[c.name] && !cu[c.name].uses.size).length;
    const ms = g.L.filter(l => l.s === id && l.kind === 'uses').map(l => N.get(l.t).label);
    const vis = g.L.filter(l => l.s === id && (l.kind === 'showcolv' || l.kind === 'showcol')).map(l => { const n = N.get(l.t); return n.type === 'visual' ? pageName('p:' + n.page) : n.label; });
    const kind = N.get(id) ? N.get(id).data.kind : '';
    return { name: t.name, kind: kind === 'importada' ? 'Importada' : kind === 'calculada' ? 'Calculada (DAX)' : kind, src: srcOf(t.name), ncols: cols.length, unused, measures: [...new Set(ms)], pages: [...new Set(vis)], desc: t.description || '' };
  });
  const C = []; tables.forEach(t => (t.columns || []).filter(c => !/^RowNumber/.test(c.name)).forEach(c => {
    const u = (CU[t.name] || {})[c.name];
    C.push({ table: t.name, col: c.name, type: DT2[c.dataType] || c.dataType || '', calc: c.type === 'calculated', used: !!(u && u.uses.size), uses: u ? [...u.uses] : [], by: u ? [...u.by] : [], expr: c.type === 'calculated' ? txt(c.expression).trim() : '', hidden: !!c.isHidden, desc: c.description || '' });
  }));
  const M = []; for (const n of N.values()) if (n.type === 'medida') {
    const d = n.data; const reach = pagesAndVisuals(n.id);
    M.push({ name: n.label, folder: d.fullFolder ? d.fullFolder.replace(/\\/g, ' / ') : '', home: d.home, fmt: d.fmt, expr: d.expr.trim(), depT: d.depT, depM: d.depM,
      usedBy: g.L.filter(l => l.s === n.id && l.kind === 'dep').map(l => N.get(l.t).label), pages: reach.pages.map(pageName), nvis: reach.visuals.length, used: !d.unused });
  }
  M.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
  const Q = []; for (const n of N.values()) if (n.type === 'consulta') {
    const d = n.data;
    Q.push({ name: n.label, load: d.loaded ? 'Habilitada' : 'Desabilitada', src: d.srcs.map(s => s.kind + ': ' + s.label + (s.publicCount ? ' (link público)' : '')).join('; '), from: d.sql ? d.sql.from : '', refs: d.refs.join(', '), nsteps: d.steps.length, steps: d.steps.map((s, i) => (i + 1) + '. ' + s.name + ' (' + s.label + ')').join('\n') });
  }
  Q.sort((a, b) => a.name.localeCompare(b.name));
  const R = (m.relationships || []).filter(r => !AUTO_RE.test(r.toTable) && !AUTO_RE.test(r.fromTable)).map(r => ({
    from: r.fromTable + '[' + r.fromColumn + ']', to: r.toTable + '[' + r.toColumn + ']',
    card: ((r.fromCardinality || 'many') === 'many' ? 'Muitos' : 'Um') + ' para ' + ((r.toCardinality || 'one') === 'one' ? 'um' : 'muitos'),
    active: r.isActive === false ? 'Não' : 'Sim', dir: r.crossFilteringBehavior === 'bothDirections' ? 'Ambas' : 'Única' }));
  const P = []; for (const n of N.values()) if (n.type === 'pagina') {
    const pg = n.data.pg;
    (n.data.visuals || []).forEach(vid => { const v = N.get(vid); P.push({ page: pg.name, hidden: pg.hidden ? 'Sim' : 'Não', visual: v.label, type: v.data.tname, title: v.data.v.title || '', measures: [...v.data.v.refs.measures].join(', '), cols: [...v.data.v.refs.columns].map(c => { const [t, col] = c.split('|'); return t + '[' + col + ']'; }).join(', '), broken: v.data.missT.length || v.data.missM.length ? 'Sim' : '' }); });
    if (!(n.data.visuals || []).length) P.push({ page: pg.name, hidden: pg.hidden ? 'Sim' : 'Não', visual: '', type: '', title: '', measures: '', cols: '', broken: '' });
  }
  const D = st.diag.map(x => ({ sev: SEV[x.sev], cat: x.cat, title: x.title, fix: x.fix, det: x.cols.join('\n'), chk: CHK[chkOf(x.key)] || 'Pendente' }));
  const S = { file: st.file, when: new Date(), tables: T.length, cols: C.length, colsUnused: C.filter(c => !c.used).length, measures: M.length, measuresUnused: M.filter(x => !x.used).length, queries: Q.length, rels: R.length, pages: (data.report.pages || []).length, visuals: [...N.values()].filter(n => n.type === 'visual').length, diagOpen: st.diag.filter(x => !['resolvido', 'ignorar'].includes(chkOf(x.key))).length };
  return { S, T, C, M, Q, R, P, D };
}
const xmlEsc = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function xlsxCol(i) { let s = ''; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
async function buildXlsx(sheets) {
  const z = new JSZip(); const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  z.file('[Content_Types].xml', H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>');
  z.file('_rels/.rels', H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  z.file('xl/workbook.xml', H + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>');
  z.file('xl/_rels/workbook.xml.rels', H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  z.file('xl/styles.xml', H + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1C292E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  sheets.forEach((s, i) => {
    const rows = [s.cols.map(c => c.h), ...s.rows];
    const body = rows.map((r, ri) => `<row r="${ri + 1}"${ri === 0 && !s.noHeader ? ' ht="22" customHeight="1"' : ''}>` + r.map((v, ci) => {
      const ref = xlsxCol(ci) + (ri + 1);
      const style = ri === 0 && !s.noHeader ? 1 : (s.cols[ci] && s.cols[ci].wrap ? 2 : 0);
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
      let t = String(v == null ? '' : v); if (t.length > 32000) t = t.slice(0, 32000) + '…';
      return t ? `<c r="${ref}" s="${s.titleRow === ri ? 3 : style}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(t)}</t></is></c>` : '';
    }).join('') + '</row>').join('');
    const last = xlsxCol(s.cols.length - 1) + rows.length;
    z.file(`xl/worksheets/sheet${i + 1}.xml`, H + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${s.noHeader ? '' : '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'}<cols>${s.cols.map((c, ci) => `<col min="${ci + 1}" max="${ci + 1}" width="${c.w || 18}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData>${s.noHeader ? '' : `<autoFilter ref="A1:${last}"/>`}</worksheet>`);
  });
  return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const simNao = b => b ? 'Sim' : 'Não';
async function exportDictXlsx() {
  if (!st.cur) return; toast('Montando o dicionário…');
  const { S, T, C, M, Q, R, P, D } = buildDict();
  const sheets = [
    { name: 'Resumo', noHeader: true, titleRow: 0, cols: [{ h: 'Dicionário de dados', w: 34 }, { h: '', w: 60 }], rows: [
      ['Arquivo', S.file], ['Gerado em', S.when.toLocaleString('pt-BR')], ['', ''],
      ['Tabelas', S.tables], ['Colunas', S.cols], ['Colunas sem uso', S.colsUnused], ['Medidas', S.measures], ['Medidas sem uso', S.measuresUnused],
      ['Consultas do Power Query', S.queries], ['Relacionamentos', S.rels], ['Páginas', S.pages], ['Visuais com dados', S.visuals], ['Pontos do diagnóstico em aberto', S.diagOpen], ['', ''],
      ['Observação', 'Gerado pelo Fluxo do Power BI a partir do .pbit. O código M completo não entra no dicionário; as origens aparecem só pelo servidor.']] },
    { name: 'Tabelas', cols: [{ h: 'Tabela', w: 30 }, { h: 'Tipo', w: 16 }, { h: 'Origem', w: 60, wrap: 1 }, { h: 'Colunas', w: 10 }, { h: 'Colunas sem uso', w: 15 }, { h: 'Medidas que usam', w: 50, wrap: 1 }, { h: 'Páginas onde as colunas aparecem', w: 40, wrap: 1 }, { h: 'Descrição', w: 40, wrap: 1 }],
      rows: T.map(t => [t.name, t.kind, t.src, t.ncols, t.unused, t.measures.join(', '), t.pages.join(', '), t.desc]) },
    { name: 'Colunas', cols: [{ h: 'Tabela', w: 28 }, { h: 'Coluna', w: 34 }, { h: 'Tipo de dado', w: 16 }, { h: 'Calculada', w: 10 }, { h: 'Oculta', w: 9 }, { h: 'Em uso', w: 9 }, { h: 'Usada em', w: 30, wrap: 1 }, { h: 'Usada por', w: 50, wrap: 1 }, { h: 'Fórmula (se calculada)', w: 60, wrap: 1 }, { h: 'Descrição', w: 40, wrap: 1 }],
      rows: C.map(c => [c.table, c.col, c.type, simNao(c.calc), simNao(c.hidden), simNao(c.used), c.uses.join(', '), c.by.join(', '), c.expr, c.desc]) },
    { name: 'Medidas', cols: [{ h: 'Medida', w: 36 }, { h: 'Pasta', w: 26 }, { h: 'Tabela onde fica', w: 18 }, { h: 'Formato', w: 16 }, { h: 'Em uso', w: 9 }, { h: 'Páginas', w: 36, wrap: 1 }, { h: 'Visuais afetados', w: 10 }, { h: 'Usa tabelas', w: 30, wrap: 1 }, { h: 'Usa medidas', w: 36, wrap: 1 }, { h: 'Usada pelas medidas', w: 36, wrap: 1 }, { h: 'Fórmula DAX', w: 80, wrap: 1 }],
      rows: M.map(x => [x.name, x.folder, x.home, x.fmt, simNao(x.used), x.pages.join(', '), x.nvis, x.depT.join(', '), x.depM.join(', '), x.usedBy.join(', '), x.expr]) },
    { name: 'Consultas', cols: [{ h: 'Consulta', w: 32 }, { h: 'Carga', w: 13 }, { h: 'Origem', w: 50, wrap: 1 }, { h: 'Tabela no banco', w: 26 }, { h: 'Junta dados de', w: 30, wrap: 1 }, { h: 'Etapas', w: 8 }, { h: 'Etapas do tratamento', w: 60, wrap: 1 }],
      rows: Q.map(q => [q.name, q.load, q.src, q.from, q.refs, q.nsteps, q.steps]) },
    { name: 'Relacionamentos', cols: [{ h: 'De (lado muitos)', w: 42 }, { h: 'Para (lado um)', w: 42 }, { h: 'Cardinalidade', w: 18 }, { h: 'Ativo', w: 8 }, { h: 'Direção do filtro', w: 16 }],
      rows: R.map(r => [r.from, r.to, r.card, r.active, r.dir]) },
    { name: 'Páginas e visuais', cols: [{ h: 'Página', w: 22 }, { h: 'Oculta', w: 9 }, { h: 'Visual', w: 36 }, { h: 'Tipo', w: 24 }, { h: 'Título', w: 30 }, { h: 'Medidas', w: 50, wrap: 1 }, { h: 'Colunas', w: 50, wrap: 1 }, { h: 'Campo quebrado', w: 14 }],
      rows: P.map(p => [p.page, p.hidden, p.visual, p.type, p.title, p.measures, p.cols, p.broken]) },
    { name: 'Diagnóstico', cols: [{ h: 'Prioridade', w: 11 }, { h: 'Categoria', w: 13 }, { h: 'Ponto', w: 50, wrap: 1 }, { h: 'Checklist', w: 18 }, { h: 'Como resolver', w: 60, wrap: 1 }, { h: 'Detalhes', w: 60, wrap: 1 }],
      rows: D.map(d => [d.sev, d.cat, d.title, d.chk, d.fix, d.det]) }
  ];
  try { const blob = await buildXlsx(sheets); await offerFile(baseName() + ' - dicionário de dados.xlsx', blob); }
  catch (e) { console.error(e); toast('Não consegui gerar o Excel.'); }
}
async function exportDictMd() {
  if (!st.cur) return;
  const { S, T, C, M, Q, R, P, D } = buildDict();
  const cell = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  const table = (head, rows) => rows.length ? '| ' + head.join(' | ') + ' |\n|' + head.map(() => ' --- |').join('') + '\n' + rows.map(r => '| ' + r.map(cell).join(' | ') + ' |').join('\n') + '\n' : '_Nenhum item._\n';
  const o = [];
  o.push(`# Dicionário de dados: ${S.file}\n`);
  o.push(`Gerado em ${S.when.toLocaleString('pt-BR')} pelo Fluxo do Power BI. O código M completo não entra no dicionário; as origens aparecem só pelo servidor.\n`);
  o.push('## Resumo\n');
  o.push(table(['Item', 'Quantidade'], [['Tabelas', S.tables], ['Colunas', S.cols], ['Colunas sem uso', S.colsUnused], ['Medidas', S.measures], ['Medidas sem uso', S.measuresUnused], ['Consultas do Power Query', S.queries], ['Relacionamentos', S.rels], ['Páginas', S.pages], ['Visuais com dados', S.visuals], ['Pontos do diagnóstico em aberto', S.diagOpen]]));
  o.push('\n## Tabelas\n');
  T.forEach(t => {
    o.push(`### ${t.name}\n`);
    o.push(`- **Tipo:** ${t.kind}\n- **Origem:** ${t.src || '—'}\n- **Colunas:** ${t.ncols} (${t.unused} sem uso)\n` + (t.measures.length ? `- **Medidas que usam:** ${t.measures.join(', ')}\n` : '') + (t.pages.length ? `- **Páginas onde as colunas aparecem:** ${t.pages.join(', ')}\n` : '') + (t.desc ? `- **Descrição:** ${t.desc}\n` : ''));
    o.push('\n' + table(['Coluna', 'Tipo', 'Calculada', 'Em uso', 'Usada em'], C.filter(c => c.table === t.name).map(c => [c.col, c.type, simNao(c.calc), simNao(c.used), c.uses.join(', ')])) + '\n');
  });
  o.push('## Medidas\n');
  let lastF = null;
  M.forEach(x => {
    if (x.folder !== lastF) { o.push(`### Pasta: ${x.folder || 'sem pasta'}\n`); lastF = x.folder; }
    o.push(`#### ${x.name}${x.used ? '' : ' _(sem uso)_'}\n`);
    o.push(`- **Tabela onde fica:** ${x.home}${x.fmt ? `\n- **Formato:** \`${x.fmt}\`` : ''}\n- **Páginas:** ${x.pages.join(', ') || '—'}\n- **Visuais afetados se mudar:** ${x.nvis}\n` + (x.depT.length ? `- **Usa tabelas:** ${x.depT.join(', ')}\n` : '') + (x.depM.length ? `- **Usa medidas:** ${x.depM.join(', ')}\n` : '') + (x.usedBy.length ? `- **Usada pelas medidas:** ${x.usedBy.join(', ')}\n` : ''));
    o.push('\n```dax\n' + x.expr + '\n```\n');
  });
  o.push('## Consultas do Power Query\n');
  o.push(table(['Consulta', 'Carga', 'Origem', 'Tabela no banco', 'Junta dados de', 'Etapas'], Q.map(q => [q.name, q.load, q.src, q.from, q.refs, q.nsteps])));
  o.push('\n## Relacionamentos\n');
  o.push(table(['De (lado muitos)', 'Para (lado um)', 'Cardinalidade', 'Ativo', 'Direção'], R.map(r => [r.from, r.to, r.card, r.active, r.dir])));
  o.push('\n## Páginas e visuais\n');
  o.push(table(['Página', 'Oculta', 'Visual', 'Tipo', 'Medidas', 'Colunas', 'Quebrado'], P.map(p => [p.page, p.hidden, p.visual, p.type, p.measures, p.cols, p.broken])));
  o.push('\n## Diagnóstico\n');
  o.push(table(['Prioridade', 'Categoria', 'Ponto', 'Checklist', 'Como resolver'], D.map(d => [d.sev, d.cat, d.title, d.chk, d.fix])));
  await offerFile(baseName() + ' - dicionário de dados.md', o.join('\n'));
}
