/* Fluxo do Power BI · regras de boas práticas de DAX e modelo */
/* ===== BOAS PRÁTICAS ===== */
const BP_RULES = {
  div: { title: 'Divisão com /', sev: 'media', why: 'Se o denominador vier zero ou vazio, a divisão com / devolve erro ou infinito no visual.', fix: 'Troque a / por DIVIDE(numerador, denominador), que devolve vazio (ou o valor alternativo que você indicar) quando o denominador é zero.' },
  filtab: { title: 'FILTER na tabela inteira', sev: 'media', why: 'FILTER sobre a tabela inteira percorre linha por linha e ignora a compressão por coluna, o que deixa a medida lenta em tabelas grandes.', fix: 'Use um filtro de coluna direto no CALCULATE, por exemplo CALCULATE([Medida], Tabela[coluna] = "x"), ou FILTER(VALUES(Tabela[coluna]), ...) / KEEPFILTERS.' },
  userel: { title: 'USERELATIONSHIP em relacionamento já ativo', sev: 'baixa', why: 'USERELATIONSHIP só serve para ativar um relacionamento inativo. Em um que já é ativo, ele não muda nada e só confunde quem lê a fórmula.', fix: 'Remova o USERELATIONSHIP da fórmula. Se a ideia era usar outra coluna de data, aponte para o relacionamento inativo correto.' },
  nofmt: { title: 'Medida sem formato', sev: 'baixa', why: 'Sem formato definido, cada visual mostra o número do jeito padrão (casas decimais demais, sem R$ ou %), e o mesmo valor aparece diferente em lugares diferentes.', fix: 'Defina o formato na própria medida (Moeda, Porcentagem, Número inteiro) em Ferramentas de medida → Formatar.' },
  dup: { title: 'Medida duplicada', sev: 'baixa', why: 'Duas medidas com a mesma fórmula e nomes diferentes: uma correção feita numa não chega na outra, e os números podem divergir com o tempo.', fix: 'Fique com uma delas, troque a outra nos visuais e apague a que sobrar.' },
  calcpq: { title: 'Coluna calculada que caberia no Power Query', sev: 'baixa', why: 'A fórmula só usa colunas da própria linha. Feita no Power Query, ela comprime melhor, deixa o modelo menor e fica junto do resto do tratamento.', fix: 'Crie a coluna no Power Query (Adicionar coluna → Coluna personalizada) e apague a coluna calculada, mantendo o mesmo nome.' }
};
function stripDax(e) {
  // strings e comentários numa passada só: "http://x" não pode ser lido como comentário
  return String(e || '').replace(/"(?:[^"]|"")*"|\/\*[\s\S]*?\*\/|(?:\/\/|--)[^\n]*/g, s => s[0] === '"' ? '""' : ' ');
}
function bestPractices(data, g) {
  const { model } = data; const N = g.N; const tables = model.tables || [];
  const tnames = tables.map(t => t.name); const rels = model.relationships || [];
  const M = {}; const add = (name, rule, detail) => { const l = (M[name] = M[name] || []); if (!l.some(f => f.rule === rule && f.detail === (detail || ''))) l.push({ rule, detail: detail || '' }); };
  const measures = [...N.values()].filter(n => n.type === 'medida');
  const norm = e => String(e || '').replace(/"(?:[^"]|"")*"|\/\*[\s\S]*?\*\/|(?:\/\/|--)[^\n]*/g, s => s[0] === '"' ? s : ' ').replace(/\s+/g, '').toLowerCase();
  measures.forEach(n => {
    const d = n.data; const raw = d.expr; const e = stripDax(raw);
    const nd = (e.match(/\//g) || []).length; if (nd) add(n.label, 'div', nd > 1 ? nd + ' divisões com /' : '');
    const fr = /\bFILTER\s*\(\s*(?:'((?:[^']|'')+)'|([A-Za-z_][\w]*))\s*,/gi; let r; const ft = new Set();
    while ((r = fr.exec(e))) { const t = (r[1] || r[2] || '').replace(/''/g, "'"); if (tnames.includes(t)) ft.add(t); }
    if (ft.size) add(n.label, 'filtab', 'FILTER(' + [...ft].join('), FILTER(') + ')');
    const ur = /USERELATIONSHIP\s*\(\s*(?:'((?:[^']|'')+)'|([A-Za-z_][\w]*))\s*\[([^\]]+)\]\s*,\s*(?:'((?:[^']|'')+)'|([A-Za-z_][\w]*))\s*\[([^\]]+)\]\s*\)/gi;
    while ((r = ur.exec(e))) {
      const a = { t: r[1] || r[2], c: r[3].trim() }, b = { t: r[4] || r[5], c: r[6].trim() };
      const hit = rels.find(x => ((x.fromTable === a.t && x.fromColumn === a.c && x.toTable === b.t && x.toColumn === b.c) || (x.fromTable === b.t && x.fromColumn === b.c && x.toTable === a.t && x.toColumn === a.c)));
      if (hit && hit.isActive !== false) add(n.label, 'userel', a.t + '[' + a.c + '] ↔ ' + b.t + '[' + b.c + ']');
    }
    const textish = /\bFORMAT\s*\(|UNICHAR|CONCATENATEX|"<|&\s*"|"\s*&|\bSELECTEDVALUE\s*\([^)]*\[[^\]]*(nome|texto|titulo|título|label)/i.test(raw) || /html|cor |cor$|^cor|subtitulo|subtítulo|título|titulo/i.test(n.label);
    if (!d.fmt && !textish) add(n.label, 'nofmt');
  });
  const byExpr = new Map();
  measures.forEach(n => { const k = norm(n.data.expr); if (k.length < 12) return; (byExpr.get(k) || byExpr.set(k, []).get(k)).push(n.label); });
  const dups = [...byExpr.values()].filter(v => v.length > 1);
  dups.forEach(grp => grp.forEach(nm => add(nm, 'dup', 'idêntica a ' + grp.filter(x => x !== nm).join(', '))));
  const calc = [];
  tables.forEach(t => { if (AUTO_RE.test(t.name)) return; (t.columns || []).forEach(col => {
    if (col.type !== 'calculated') return; const e = stripDax(txt(col.expression));
    if (/\b(RELATED|RELATEDTABLE|CALCULATE|CALCULATETABLE|LOOKUPVALUE|EARLIER|EARLIEST|SUMX|COUNTX|AVERAGEX|MAXX|MINX|COUNTROWS|FILTER|ALL|ALLEXCEPT|ALLSELECTED|SUM|COUNT|COUNTA|AVERAGE|MAX|MIN|DISTINCTCOUNT|RANKX|USERELATIONSHIP|SELECTEDVALUE|VALUES|DISTINCT|TOPN|SUMMARIZE|ADDCOLUMNS|PATH|PATHITEM)\s*\(/i.test(e)) return;
    const refs = [...e.matchAll(/(?:'((?:[^']|'')+)'|([A-Za-z_][\w]*))\s*\[/g)].map(m => m[1] || m[2]).filter(x => tnames.includes(x));
    if (refs.some(x => x !== t.name)) return;
    const mref = [...e.matchAll(/(?<![\w'\]])\[([^\]]+)\]/g)].map(m => m[1].trim()).filter(x => measures.some(n => n.label === x));
    if (mref.length) return;
    calc.push({ table: t.name, col: col.name, expr: txt(col.expression).trim(), today: /\b(TODAY|NOW)\s*\(/i.test(e) });
  }); });
  const counts = {}; Object.values(M).forEach(list => list.forEach(f => counts[f.rule] = (counts[f.rule] || 0) + 1)); counts.calcpq = calc.length;
  return { M, dups, calc, counts };
}
