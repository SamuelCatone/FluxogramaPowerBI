/* Fluxo do Power BI · aba Boas práticas */
/* ---------- aba de boas práticas ---------- */
function setView(v) {
  st.mode = v; document.body.classList.toggle('view-bp', v === 'bp');
  document.querySelectorAll('#views [data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === v));
  $('#bp').hidden = v !== 'bp';
  if (v === 'bp') { renderBp(); } else { applyView(); }
}
function openBp(name) { st.bpRule = 'all'; st.bpOpen = new Set([name]); setView('bp'); $('#bpq').value = name; renderBpList(); const el = document.querySelector('.bpm.open'); if (el) el.scrollIntoView({ block: 'center' }); }
function renderBp() {
  if (!st.bp) return; const B = st.bp;
  const nMeas = Object.keys(B.M).length; const total = [...st.g.N.values()].filter(n => n.type === 'medida').length;
  const order = ['div', 'filtab', 'userel', 'dup', 'nofmt', 'calcpq'];
  $('#bpRules').innerHTML = `<button class="bpr${st.bpRule === 'all' ? ' on' : ''}" data-rule="all"><span class="rt">Todas as medidas com pontos</span><span class="rc">${nMeas}</span></button>` +
    order.map(r => { const R = BP_RULES[r]; const n = B.counts[r] || 0; return `<button class="bpr${st.bpRule === r ? ' on' : ''}" data-rule="${r}"${n ? '' : ' disabled'}><span class="sev s-${R.sev}">${R.sev === 'media' ? 'Média' : 'Baixa'}</span><span class="rt">${esc(R.title)}</span><span class="rc">${n}</span></button>`; }).join('');
  $('#bpSum').textContent = `${nMeas} de ${total} medidas têm algum ponto de boas práticas${B.calc.length ? `, e ${B.calc.length} colunas calculadas poderiam ir para o Power Query` : ''}. Nada aqui muda o canvas: é uma leitura das fórmulas.`;
  renderBpList();
}
function renderBpList() {
  const B = st.bp; const q = norm($('#bpq').value.trim()); const r = st.bpRule;
  const R = r !== 'all' ? BP_RULES[r] : null;
  const head = R ? `<div class="bprh"><h3>${esc(R.title)}</h3><p><strong>Por quê:</strong> ${esc(R.why)}</p><p><strong>Como corrigir:</strong> ${esc(R.fix)}</p></div>` : '';
  if (r === 'calcpq') {
    const list = B.calc.filter(x => !q || norm(x.table + ' ' + x.col).includes(q));
    $('#bpList').innerHTML = head + (list.length ? list.map(x => `<article class="bpm open"><div class="bpmh"><div><h4>${esc(x.table)}[${esc(x.col)}]</h4><span class="ft">Coluna calculada${x.today ? '. Usa TODAY(): no Power Query, use DateTime.LocalNow()' : ''}</span></div><button class="btn" data-goflow="t:${esc(x.table)}" data-gocol="${esc(x.col)}">Ver no fluxo</button></div><pre class="code">${esc(x.expr)}</pre></article>`).join('') : '<p class="none">Nada encontrado.</p>');
    return;
  }
  let names = Object.keys(B.M);
  if (r !== 'all') names = names.filter(n => B.M[n].some(f => f.rule === r));
  if (q) names = names.filter(n => norm(n).includes(q));
  const rank = { media: 0, baixa: 1 };
  names.sort((a, b) => Math.min(...B.M[a].map(f => rank[BP_RULES[f.rule].sev])) - Math.min(...B.M[b].map(f => rank[BP_RULES[f.rule].sev])) || B.M[b].length - B.M[a].length || a.localeCompare(b));
  const extra = r === 'dup' && B.dups.length ? `<div class="bpdups"><h4>Grupos de medidas iguais</h4><ul>${B.dups.map(g => `<li>${g.map(esc).join(' = ')}</li>`).join('')}</ul></div>` : '';
  $('#bpList').innerHTML = head + extra + (names.length ? names.map(nm => {
    const n = st.g.N.get('m:' + nm); const d = n.data; const open = st.bpOpen.has(nm); const fs = B.M[nm];
    return `<article class="bpm${open ? ' open' : ''}" data-bpm="${esc(nm)}">
      <button class="bpmh" data-bptoggle="${esc(nm)}" aria-expanded="${open}"><div><h4>${esc(nm)}${d.unused ? ' <span class="bdg warn">sem uso</span>' : ''}</h4><span class="ft">${esc(d.fullFolder ? d.fullFolder.replace(/\\/g, ' / ') : 'sem pasta')}</span></div>
        <span class="bpch">${fs.map(f => `<span class="sev s-${BP_RULES[f.rule].sev}">${esc(BP_RULES[f.rule].title)}</span>`).join('')}</span><span class="chev" aria-hidden="true">${open ? '−' : '+'}</span></button>
      ${open ? `<div class="bpmb">${fs.map(f => { const RR = BP_RULES[f.rule]; return `<div class="bpf"><strong>${esc(RR.title)}</strong>${f.detail ? `<span class="ft">${esc(f.detail)}</span>` : ''}<p>${esc(RR.why)}</p><p><strong>Como corrigir:</strong> ${esc(RR.fix)}</p></div>`; }).join('')}
        <pre class="code">${esc(d.expr.trim())}</pre><div class="btnrow"><button class="btn" data-goflow="m:${esc(nm)}">Ver no fluxo</button></div></div>` : ''}
    </article>`;
  }).join('') : '<p class="none">Nenhuma medida encontrada.</p>');
}
