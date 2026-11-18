/* Fluxo do Power BI · pontos de atenção do modelo */
/* ===== DIAGNÓSTICO ===== */
const PII_RE = /(cpf|(^|_)rg($|_)|nascimento|genero|gênero|estado_civil|profissao|profissão|endereco|endereço|(^|_)cep($|_)|bairro|telefone|celular|whatsapp|e_?mail|razaosocial|razao_social|cliente_nome|^cliente$|nome_cliente|(^|_)users__name$|(^|_)nome$|informacao_extra|observa)/i;
function diagnose(data, g) {
  const { model } = data; const N = g.N; const out = [];
  const CU = g.colUse || columnUsage(data, g);
  const tables = (model.tables || []).filter(t => !AUTO_RE.test(t.name));
  const rels = (model.relationships || []);
  const add = (o) => out.push(Object.assign({ ids: [], cols: [] }, o));
  const queries = [...N.values()].filter(n => n.type === 'consulta');
  const qOf = name => N.get('q:' + name);
  const mType = (tname, col) => { const q = qOf(tname); if (!q) return ''; const r = new RegExp('\\{\\s*"' + escRe(col) + '"\\s*,\\s*(type\\s+\\w+|[\\w.]+)\\s*\\}', 'g'); let m, last = ''; while ((m = r.exec(q.data.m))) last = m[1]; return last.replace(/^type\s+/, ''); };

  // 1. links públicos
  const pubs = [...N.values()].filter(n => n.type === 'origem' && n.data.publicCount);
  if (pubs.length) {
    const total = pubs.reduce((a, n) => a + n.data.publicCount, 0);
    const qs = pubs.flatMap(n => g.L.filter(l => l.s === n.id).map(l => l.t));
    add({ key: 'pub', sev: 'alta', cat: 'Segurança', title: total + (total > 1 ? ' consultas baixam dados por link público' : ' consulta baixa dados por link público'),
      text: 'Endereços com /public/ costumam abrir sem login. Quem tiver a URL, ou receber o .pbit, consegue baixar esses dados.',
      fix: 'Leve a carga para uma fonte autenticada (por exemplo, n8n gravando no banco) e depois revogue os links.', ids: [...pubs.map(n => n.id), ...qs] });
  }
  // 2. dados pessoais
  const pii = [];
  tables.forEach(t => { const cols = (t.columns || []).filter(c => !/^RowNumber/.test(c.name) && PII_RE.test(c.name) && !/empresa/i.test(c.name)).map(c => c.name); if (cols.length) pii.push({ t: t.name, cols }); });
  pii.forEach(p => { p.cols = p.cols.map(col => CU[p.t] && CU[p.t][col] && !CU[p.t][col].uses.size ? col + ' (sem uso)' : col); });
  if (pii.length) add({ key: 'pii', sev: 'alta', cat: 'Segurança', title: 'Possíveis dados pessoais em ' + pii.length + (pii.length > 1 ? ' tabelas' : ' tabela'),
    text: 'Colunas com nome de dado pessoal (CPF, nascimento, endereço, nome etc.). Quem acessa o relatório publicado chega a elas por Exportar dados ou Analisar no Excel, mesmo ocultas.',
    fix: 'Confira se são usadas e remova as que não forem, de preferência na própria consulta.', ids: pii.map(p => 't:' + p.t), cols: pii.map(p => p.t + ': ' + p.cols.join(', ')) });
  // 3. calendário com fim fixo
  const today = new Date(); today.setHours(0, 0, 0, 0);
  queries.forEach(q => {
    const m = q.data.m; if (!/List\.Dates/.test(m)) return;
    if (/LocalNow|FixedLocalNow|UtcNow|List\.Max|Table\.Max|List\.Min|Table\.Min/.test(m)) return;
    const r = /List\.Dates\(\s*#date\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*,\s*([\d\s*+\-]+?)\s*,/.exec(m);
    let end = null;
    if (r) { const cnt = simpleArith(r[4]);
      if (isFinite(cnt)) { end = new Date(+r[1], +r[2] - 1, +r[3]); end.setDate(end.getDate() + cnt - 1); } }
    const soon = end && (end - today) / 864e5 < 120;
    add({ key: 'cal:' + q.label, sev: !end || soon ? 'alta' : 'media', cat: 'Números', title: 'Calendário ' + q.label + ' tem data final fixa' + (end ? ' (' + end.toLocaleDateString('pt-BR') + ')' : ''),
      text: end && end < today ? 'O calendário já acabou: dados depois dessa data não se ligam a ele e somem dos visuais filtrados por data.' : 'Quando os dados passarem dessa data, as linhas novas não se ligam ao calendário e somem dos visuais filtrados por data.',
      fix: 'Calcule o fim a partir da data atual, por exemplo Date.EndOfYear(Date.AddYears(DateTime.Date(DateTime.LocalNow()), 1)).', ids: [q.id, 't:' + q.label].filter(id => N.has(id)) });
  });
  (model.tables || []).forEach(t => {
    const p = (t.partitions || [])[0]; if (!p || !p.source || p.source.type !== 'calculated' || AUTO_RE.test(t.name)) return;
    const e = txt(p.source.expression);
    if (/\bCALENDAR\s*\(/i.test(e) && !/TODAY|NOW|MAX|MIN|CALENDARAUTO/i.test(e))
      add({ key: 'caldax:' + t.name, sev: 'alta', cat: 'Números', title: 'Calendário ' + t.name + ' tem datas fixas no DAX', text: 'As datas de início e fim estão escritas na fórmula. Dados fora desse intervalo somem dos visuais filtrados por data.', fix: 'Use TODAY() ou MAX das datas dos fatos para calcular o fim.', ids: ['t:' + t.name] });
  });
  // 4. chaves de data com hora
  const dtk = [];
  rels.forEach(r => {
    if (AUTO_RE.test(r.toTable) || AUTO_RE.test(r.fromTable)) return;
    const a = mType(r.fromTable, r.fromColumn), b = mType(r.toTable, r.toColumn);
    if (a === 'datetime' && b && b !== 'datetime') dtk.push(r);
  });
  if (dtk.length) add({ key: 'dtk', sev: 'media', cat: 'Números', title: dtk.length + (dtk.length > 1 ? ' relacionamentos usam data com hora' : ' relacionamento usa data com hora'),
    text: 'O lado do fato é data/hora e o outro lado é só data. Se algum valor vier com hora diferente de 00:00, a linha não encontra o dia e some dos visuais por data.',
    fix: 'Mude o tipo da coluna para Data no Power Query.', ids: dtk.map(r => 't:' + r.fromTable), cols: dtk.map(r => r.fromTable + '[' + r.fromColumn + '] → ' + r.toTable + '[' + r.toColumn + ']') });
  // 5. campos quebrados
  [...N.values()].filter(n => n.type === 'pagina' && n.data.broken && n.data.broken.length).forEach(n =>
    add({ key: 'broken:' + n.label, sev: 'alta', cat: 'Números', title: 'Visual quebrado na página ' + n.label, text: 'Algum visual usa campo de uma tabela que não existe mais: ' + n.data.broken.join(', ') + '.', fix: 'Troque o campo pelo equivalente da tabela atual ou remova o visual.', ids: [n.id, ...(n.data.visuals || []).filter(v => N.get(v).data.missT.length)] }));
  // medida usada em visual mas inexistente
  const mNames = new Set([...N.values()].filter(n => n.type === 'medida').map(n => n.label));
  [...N.values()].filter(n => n.type === 'pagina').forEach(n => {
    const miss = new Set(); n.data.pg.visuals.forEach(v => v.refs.measures.forEach(m => { if (!mNames.has(m) && !(model.tables || []).some(t => (t.columns || []).some(c => c.name === m))) miss.add(m); }));
    if (miss.size) add({ key: 'miss:' + n.label, sev: 'alta', cat: 'Números', title: 'Medida inexistente na página ' + n.label, text: 'Visuais usam medidas que não existem no modelo: ' + [...miss].join(', ') + '.', fix: 'Recrie a medida ou troque o campo do visual.', ids: [n.id] });
  });
  // 6. data/hora automática
  const autoN = (model.tables || []).filter(t => /^LocalDateTable_/.test(t.name)).length;
  if (autoN) {
    const hier = [...N.values()].filter(n => n.type === 'medida' && /\]\.\[(Date|Data|Ano|Year|Mês|Month|Trimestre|Quarter|Dia|Day)\]/.test(n.data.expr));
    add({ key: 'auto', sev: 'media', cat: 'Desempenho', title: 'Data/hora automática ligada (' + autoN + ' tabelas ocultas)',
      text: 'O Power BI cria uma tabela de datas escondida para cada coluna de data. Isso pesa no arquivo e na atualização.' + (hier.length ? ' Antes de desligar, reescreva as medidas que usam a hierarquia automática (.[Date]).' : ' Nenhuma medida usa a hierarquia automática, então dá para desligar direto.'),
      fix: 'Arquivo → Opções → Arquivo atual → Carregamento de dados → desmarque Data/hora automática. Depois marque a tabela calendário como tabela de datas.', ids: hier.map(n => n.id) });
  }
  // 7. consultas auxiliares carregadas
  const dup = queries.filter(q => q.data.loaded && g.L.some(l => l.s === q.id && l.kind === 'ref'));
  if (dup.length) add({ key: 'dup', sev: 'media', cat: 'Desempenho', title: dup.length + (dup.length > 1 ? ' consultas auxiliares estão carregadas no modelo' : ' consulta auxiliar está carregada no modelo'),
    text: 'Essas consultas já entram em outra consulta (append ou mesclagem) e também viram tabela própria. Os dados ficam duplicados e a origem pode ser lida duas vezes.',
    fix: 'No Power Query, clique com o botão direito na consulta e desmarque Habilitar carga.', ids: dup.map(q => q.id) });
  // 8. tabelas sem uso
  const dupT = new Set(dup.map(q => 't:' + q.label));
  const unusedT = tables.filter(t => {
    const id = 't:' + t.name; const n = N.get(id); if (!n || dupT.has(id)) return false;
    if ((t.measures || []).length) return false;
    const usedL = g.L.some(l => l.s === id && (l.kind === 'uses' || l.kind === 'showcol' || l.kind === 'showcolv'));
    const inRel = rels.some(r => (r.fromTable === t.name || r.toTable === t.name) && !AUTO_RE.test(r.toTable) && !AUTO_RE.test(r.fromTable));
    // usada em coluna calculada ou tabela calculada, com ou sem [coluna] (ex.: SUMMARIZE(Vendas, ...))
    const ref = new RegExp("'" + escRe(t.name.replace(/'/g, "''")) + "'|(?<![\\w'.])" + escRe(t.name) + "(?![\\w(])", 'i');
    const usa = ex => ref.test(stripDax(txt(ex)).replace(/\[[^\]]*\]/g, '[]'));
    const inCalc = (model.tables || []).some(o => o.name !== t.name && ((o.columns || []).some(c => c.type === 'calculated' && usa(c.expression)) || (o.partitions || []).some(p => p.source && p.source.type === 'calculated' && usa(p.source.expression))));
    return !usedL && !inRel && !inCalc;
  });
  if (unusedT.length) add({ key: 'unusedT', sev: 'baixa', cat: 'Limpeza', title: unusedT.length + (unusedT.length > 1 ? ' tabelas sem uso' : ' tabela sem uso'),
    text: 'Nenhuma medida, visual, coluna calculada ou relacionamento usa estas tabelas.', fix: 'Desabilite a carga ou exclua, depois de confirmar que nenhum outro relatório usa este modelo.', ids: unusedT.map(t => 't:' + t.name) });
  // 9. medidas sem uso
  const um = [...N.values()].filter(n => n.type === 'medida' && n.data.unused);
  if (um.length) add({ key: 'unusedM', sev: 'baixa', cat: 'Limpeza', title: um.length + (um.length > 1 ? ' medidas sem uso' : ' medida sem uso'),
    text: 'Não aparecem em visual nem filtro, nem por meio de outra medida usada.', fix: 'Apague as que forem testes ou rascunhos. Antes, salve uma cópia do arquivo.', ids: um.map(n => n.id) });
  // colunas sem uso
  const uc = []; let ucN = 0;
  Object.keys(CU).forEach(t => { const n = N.get('t:' + t); if (!n || n.data.kind === 'calculada') return; const list = Object.keys(CU[t]).filter(col => !CU[t][col].uses.size); if (list.length) { uc.push({ t, list }); ucN += list.length; } });
  if (ucN) add({ key: 'unusedC', sev: 'baixa', cat: 'Limpeza', title: ucN + (ucN > 1 ? ' colunas sem uso em ' : ' coluna sem uso em ') + uc.length + (uc.length > 1 ? ' tabelas' : ' tabela'),
    text: 'Nenhuma medida, visual, filtro, relacionamento, coluna calculada ou ordenação usa essas colunas. Elas só ocupam espaço e tempo de atualização.',
    fix: 'Remova na consulta (lista de colunas no SQL ou Remover colunas no Power Query). Abra a tabela no canvas para ver coluna por coluna.', ids: uc.map(x => 't:' + x.t), cols: uc.map(x => x.t + ' (' + x.list.length + '): ' + x.list.join(', ')) });
  // 10. select *
  const star = queries.filter(q => q.data.sql && /select\s+\*/i.test(q.data.sql.sql));
  if (star.length) add({ key: 'star', sev: 'baixa', cat: 'Limpeza', title: star.length + (star.length > 1 ? ' consultas usam select *' : ' consulta usa select *'),
    text: 'Trazem todas as colunas da tabela do banco, inclusive as que ninguém usa e as que podem ter dado pessoal. Se o banco ganhar colunas novas, elas entram sozinhas.', fix: 'Liste só as colunas necessárias no SQL.', ids: star.map(q => q.id) });
  // 11. consultas soltas
  const loose = queries.filter(q => !q.data.loaded && !g.L.some(l => l.s === q.id && l.kind === 'ref'));
  if (loose.length) add({ key: 'loose', sev: 'baixa', cat: 'Limpeza', title: loose.length + (loose.length > 1 ? ' consultas sem destino' : ' consulta sem destino'), text: 'Estão com carga desabilitada e nenhuma outra consulta usa.', fix: 'Exclua se não forem mais necessárias.', ids: loose.map(q => q.id) });
  // 12. bidirecionais
  const bi = rels.filter(r => r.crossFilteringBehavior === 'bothDirections');
  if (bi.length) add({ key: 'bi', sev: 'baixa', cat: 'Modelo', title: bi.length + (bi.length > 1 ? ' relacionamentos filtram nas duas direções' : ' relacionamento filtra nas duas direções'), text: 'Filtro bidirecional pode gerar resultados ambíguos e deixar o modelo mais lento.', fix: 'Use direção única, a não ser que seja realmente necessário.', ids: [...new Set(bi.flatMap(r => ['t:' + r.fromTable, 't:' + r.toTable]))], cols: bi.map(r => r.fromTable + '[' + r.fromColumn + '] ↔ ' + r.toTable + '[' + r.toColumn + ']') });
  // 13. TODAY em colunas calculadas
  const tc = []; (model.tables || []).forEach(t => (t.columns || []).forEach(c => { if (c.type === 'calculated' && /\b(TODAY|NOW)\s*\(/i.test(txt(c.expression))) tc.push(t.name + '[' + c.name + ']'); }));
  if (tc.length) add({ key: 'today', sev: 'baixa', cat: 'Modelo', title: tc.length + (tc.length > 1 ? ' colunas calculadas usam TODAY()' : ' coluna calculada usa TODAY()'), text: 'Colunas calculadas só são recalculadas na atualização do modelo, não quando o relatório é aberto.', fix: 'Se o valor precisa mudar a cada dia sem atualização, use uma medida.', ids: [...new Set(tc.map(x => 't:' + x.split('[')[0]))], cols: tc });

  const order = { alta: 0, media: 1, baixa: 2 };
  out.sort((a, b) => order[a.sev] - order[b.sev]);
  out.forEach((d, i) => { d.idx = i; d.ids = [...new Set(d.ids)].filter(id => N.has(id)); });
  return out;
}
