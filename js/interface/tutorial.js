/* Fluxo do Power BI · tour da Ajuda */
/* ---------- tutorial ---------- */
const TOUR = [
  { sel: '#vp', title: 'O fluxo do seu modelo', text: 'Cada coluna é uma etapa: origens, consultas do Power Query, tabelas, medidas e páginas. Clique num bloco para acender o caminho dele e ver os detalhes. O botão + abre as pastas de medidas e os visuais de cada página.' },
  { sel: '#vp', title: 'Mouse e teclado', text: 'Botão esquerdo seleciona; arraste na malha vazia para selecionar vários, e Ctrl ou Shift soma à seleção. Botão direito ou a rodinha pressionada arrastam a tela, e girar a rodinha dá zoom. Arraste os blocos para organizar do seu jeito.' },
  { sel: '#views', title: 'Fluxo e Boas práticas', text: 'A aba Fluxo é o canvas. A aba Boas práticas lista as medidas com pontos de qualidade nas fórmulas (divisão com /, FILTER na tabela inteira, medidas duplicadas, sem formato) sem mexer no desenho.' },
  { sel: '#palette', title: 'Modelos de cards', text: 'No seu próprio fluxo, arraste um modelo para a raia certa ou clique nele para adicionar no fim dela. Clique num card para editar título, detalhe, tipo e anotações. Para ligar, arraste o ponto à direita do card até outro card.' },
  { sel: '#q', title: 'Busca', text: 'Digite o nome de uma tabela, medida, consulta ou página e aperte Enter para ir direto ao bloco. O atalho é a tecla /.' },
  { sel: '#btnDiag', title: 'Diagnóstico', text: 'Lista os pontos de atenção do modelo por prioridade: links públicos, dados pessoais, calendário fixo, campos quebrados, itens sem uso. Cada ponto diz como resolver, mostra os blocos no canvas e pode ser marcado no checklist como Vou resolver, Resolvido ou Ignorar.' },
  { sel: '#btnCmp', title: 'Comparar versões', text: 'Escolha outra versão do .pbit e veja o que mudou: medidas, consultas, colunas, relacionamentos, páginas e o que foi resolvido no diagnóstico.' },
  { sel: '#btnIso', title: 'Isolar caminho', text: 'Com um ou mais blocos selecionados, mostra só o caminho deles e esconde o resto do modelo. Mostrar tudo, ou Esc, volta ao canvas completo.' },
  { sel: '#btnRels', title: 'Relacionamentos', text: 'Liga as linhas entre as tabelas: * é o lado muitos, 1 é o lado um e tracejado é inativo. Clique numa tabela para ver só os relacionamentos dela.' },
  { sel: '#toolbox', title: 'Ferramentas de desenho', text: 'O ponto à direita de cada bloco liga ele a outro: é só arrastar. A Seta liga anotações (dois cliques nela para escrever), Moldura agrupa uma área com título e Anotação cria um post-it. A setinha embaixo recolhe a caixa.' },
  { sel: '#more summary', title: 'Mais opções', text: 'Gerar o dicionário de dados em Excel ou Markdown, exportar a imagem em PNG ou SVG, salvar e abrir o desenho em arquivo, mostrar as tabelas de data automáticas, reorganizar os blocos e trocar de arquivo.' },
  { sel: '.zoom', title: 'Zoom e atalhos', text: 'Aqui você aproxima e afasta. Atalhos: 0 ajusta à tela, + e − dão zoom, / abre a busca e Esc limpa a seleção.' }
];
let tourI = 0, tourSteps = [], tourReCollapse = false;
function startTour() {
  closeMenu();
  tourReCollapse = $('#toolbox').classList.contains('collapsed');
  if (tourReCollapse) $('#toolbox').classList.remove('collapsed');
  tourSteps = TOUR.filter(s => { const el = document.querySelector(s.sel); return el && el.offsetParent !== null && !el.closest('[hidden]'); });
  tourI = 0; $('#tour').hidden = false; tourShow(); $('#tourNext').focus();
}
function tourShow() {
  const s = tourSteps[tourI]; if (!s) return endTour();
  const el = document.querySelector(s.sel); const r = el.getBoundingClientRect();
  const big = r.width > innerWidth * 0.6 && r.height > innerHeight * 0.5;
  const pad = big ? -24 : 6;
  const sp = $('#tourSpot'); sp.style.left = (r.left - pad) + 'px'; sp.style.top = (r.top - pad) + 'px'; sp.style.width = (r.width + pad * 2) + 'px'; sp.style.height = (r.height + pad * 2) + 'px';
  $('#tourStep').textContent = (tourI + 1) + ' de ' + tourSteps.length;
  $('#tourTitle').textContent = s.title; $('#tourText').textContent = s.text;
  $('#tourPrev').disabled = tourI === 0;
  $('#tourNext').textContent = tourI === tourSteps.length - 1 ? 'Concluir' : 'Próximo';
  const c = $('#tourCard'); const cw = c.offsetWidth, ch = c.offsetHeight; let x, y;
  if (big) { x = (innerWidth - cw) / 2; y = Math.max(80, (innerHeight - ch) / 2); }
  else if (r.bottom + 14 + ch < innerHeight) { y = r.bottom + 14; x = r.left + r.width / 2 - cw / 2; }
  else if (r.top - 14 - ch > 0) { y = r.top - 14 - ch; x = r.left + r.width / 2 - cw / 2; }
  else { y = Math.max(12, r.top + r.height / 2 - ch / 2); x = r.right + 14 + cw < innerWidth ? r.right + 14 : r.left - 14 - cw; }
  c.style.left = Math.max(12, Math.min(innerWidth - cw - 12, x)) + 'px'; c.style.top = Math.max(12, Math.min(innerHeight - ch - 12, y)) + 'px';
}
function tourGo(d) { const n = tourI + d; if (n < 0) return; if (n >= tourSteps.length) return endTour(); tourI = n; tourShow(); }
function endTour() {
  $('#tour').hidden = true;
  if (tourReCollapse) $('#toolbox').classList.add('collapsed');
  try { localStorage.setItem('fluxo-pbi:tutorial', 'visto'); } catch (e) {}
  $('#btnHelp').focus();
}
function toggleNode(id) {
  const n = st.g.N.get(id); if (!n) return;
  if (n.type === 'pasta') toggleFolder(n.label);
  else if (n.type === 'pagina') togglePage(n.data.pg.id);
}
function togglePage(pid) {
  if (st.pexp.has(pid)) st.pexp.delete(pid); else st.pexp.add(pid);
  save(); render();
  if (st.panelMode === 'node' && st.sel) showPanel(st.sel);
}
function toggleFolder(name) {
  if (st.exp.has(name)) st.exp.delete(name); else st.exp.add(name);
  save(); render();
}
