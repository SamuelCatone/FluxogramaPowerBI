/* Fluxo do Power BI · visibilidade, layout, caminho aceso, desenho dos blocos e ligações */
/* ---------- visibilidade ---------- */
function isHiddenAuto(n) { return n.auto && !st.showAuto; }
function visId(id) {
  const n = st.g.N.get(id); if (!n || isHiddenAuto(n)) return null;
  if (st.iso) return st.iso.has(id) && n.type !== 'pasta' ? id : null;
  if (n.manual) return id;
  if (n.type === 'medida' && !st.exp.has(n.folder)) return 'f:' + n.folder;
  if (n.type === 'visual' && !st.pexp.has(n.page)) return 'p:' + n.page;
  return id;
}
function visibleNodes() {
  const out = [];
  for (const n of st.g.N.values()) {
    if (isHiddenAuto(n)) continue;
    if (st.iso) { if (st.iso.has(n.id) && n.type !== 'pasta') out.push(n); continue; }
    if (n.manual) { out.push(n); continue; }
    if (n.type === 'medida' && !st.exp.has(n.folder)) continue;
    if (n.type === 'visual' && !st.pexp.has(n.page)) continue;
    out.push(n);
  }
  return out;
}
const isSmall = n => n.type === 'medida' || n.type === 'visual';
const nodeW = n => isSmall(n) ? MW : W;
const nodeH = n => isSmall(n) ? MH : H;

/* ---------- layout automático ---------- */
function layout() {
  const N = st.g.N, auto = {};
  const vis = visibleNodes();
  const by = t => vis.filter(n => n.type === t);
  const idx = {};
  const origens = by('origem').sort((a, b) => (a.auto ? 1 : 0) - (b.auto ? 1 : 0) || (a.data.kind === 'DAX') - (b.data.kind === 'DAX') || a.label.localeCompare(b.label));
  origens.forEach((n, i) => idx[n.id] = i);
  const qs = by('consulta'); const key = {};
  qs.forEach(q => {
    const ps = st.g.L.filter(l => l.t === q.id && l.kind === 'src').map(l => idx[l.s]).filter(x => x != null);
    key[q.id] = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 50;
  });
  // consulta usada por outra fica logo abaixo dela
  const helpers = new Map();
  st.g.L.filter(l => l.kind === 'ref').forEach(l => { if (!helpers.has(l.s)) helpers.set(l.s, l.t); });
  const mains = qs.filter(q => !helpers.has(q.id) || !key.hasOwnProperty(helpers.get(q.id)));
  mains.sort((a, b) => key[a.id] - key[b.id] || a.label.localeCompare(b.label));
  const rank = {}; mains.forEach((q, i) => rank[q.id] = i);
  qs.forEach(q => { if (rank[q.id] == null) rank[q.id] = (rank[helpers.get(q.id)] != null ? rank[helpers.get(q.id)] : 1e4) + 0.5; });
  qs.sort((a, b) => rank[a.id] - rank[b.id] || a.label.localeCompare(b.label)).forEach((n, i) => idx[n.id] = i);
  const ts = by('tabela');
  ts.forEach(t => {
    const q = 'q:' + t.label;
    key[t.id] = idx[q] != null ? idx[q] : (t.auto ? 2000 : 1000);
  });
  ts.sort((a, b) => key[a.id] - key[b.id] || a.label.localeCompare(b.label)).forEach((n, i) => idx[n.id] = i);
  const fs = by('pasta');
  fs.forEach(f => {
    const vals = [];
    f.data.members.forEach(m => N.get(m).data.depT.forEach(t => { if (idx['t:' + t] != null) vals.push(idx['t:' + t]); }));
    key[f.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 999;
  });
  fs.sort((a, b) => key[a.id] - key[b.id] || a.label.localeCompare(b.label));
  const ps = by('pagina');
  const place = (list, col) => { let y = 0; list.forEach(n => { auto[n.id] = { x: col * COLW, y }; y += nodeH(n) + GAPY; }); };
  place(origens, 0); place(qs, 1); place(ts, 2);
  if (st.iso) {
    const vs = by('visual'); let yy = 0; const done = new Set();
    ps.forEach(p => { auto[p.id] = { x: 4 * COLW, y: yy }; yy += H + GAPY; vs.filter(v => v.page === p.data.pg.id).forEach(v => { auto[v.id] = { x: 4 * COLW + 22, y: yy }; yy += MH + 8; done.add(v.id); }); });
    vs.filter(v => !done.has(v.id)).forEach(v => { auto[v.id] = { x: 4 * COLW, y: yy }; yy += MH + 10; });
  } else {
    let yp = 0;
    ps.forEach(p => { auto[p.id] = { x: 4 * COLW, y: yp }; yp += H + GAPY; if (st.pexp.has(p.data.pg.id)) yp += (p.data.visuals || []).length * (MH + 8) + 6; });
  }
  if (st.iso) {
    const ms = by('medida');
    ms.forEach(m => { const v = m.data.depT.map(t => idx['t:' + t]).filter(x => x != null); key[m.id] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 999; });
    ms.sort((a, b) => key[a.id] - key[b.id] || a.label.localeCompare(b.label));
    let yy = 0; ms.forEach(m => { auto[m.id] = { x: 3 * COLW, y: yy }; yy += MH + 10; });
  }
  let y = 0;
  fs.forEach(f => {
    auto[f.id] = { x: 3 * COLW, y };
    y += H + GAPY;
    if (st.exp.has(f.label)) y += membersOf(f).length * (MH + 8) + 6;
  });
  st.auto = auto;
}
function membersOf(f) {
  return f.data.members.map(id => st.g.N.get(id)).sort((a, b) => (a.data.unused ? 1 : 0) - (b.data.unused ? 1 : 0) || a.label.localeCompare(b.label));
}
function pos(id) {
  if (st.iso) return st.isoPos[id] || st.auto[id] || { x: 0, y: 0 };
  if (st.pos[id]) return st.pos[id];
  const mn = st.g.N.get(id); if (mn && mn.manual) return { x: (COLS[mn.type] || 0) * COLW, y: 0 };
  if (st.auto[id]) return st.auto[id];
  const n = st.g.N.get(id);
  if (n && n.type === 'medida') {
    const f = 'f:' + n.folder; const fp = pos(f);
    const i = membersOf(st.g.N.get(f)).indexOf(n);
    return { x: fp.x + 22, y: fp.y + H + 8 + i * (MH + 8) };
  }
  if (n && n.type === 'visual') {
    const pid = 'p:' + n.page; const pp = pos(pid);
    const i = (st.g.N.get(pid).data.visuals || []).indexOf(id);
    return { x: pp.x + 22, y: pp.y + H + 8 + i * (MH + 8) };
  }
  return { x: 0, y: 0 };
}

/* ---------- foco (caminho) ---------- */
function computeFocus() {
  if (st.colSel) { st.focusF = columnImpact(st.colSel.t, st.colSel.c).F; return; }
  if (!st.selSet.size) { st.focusF = null; return; }
  const start = [];
  st.selSet.forEach(id => { const n = st.g.N.get(id); if (!n) return; start.push(id); if (n.type === 'pasta') start.push(...n.data.members); });
  const F = new Set(start);
  const go = (map) => { const q = [...start]; const seen = new Set(start); while (q.length) { const x = q.pop(); (map.get(x) || []).forEach(y => { if (!seen.has(y)) { seen.add(y); F.add(y); q.push(y); } }); } };
  go(st.fwd); go(st.back);
  if (st.showRels) st.selSet.forEach(id => { const n = st.g.N.get(id); if (!n || n.type !== 'tabela') return;
    st.g.rels.forEach(r => { if (AUTO_RE.test(r.toTable) || AUTO_RE.test(r.fromTable)) return; if (r.fromTable === n.label) F.add('t:' + r.toTable); if (r.toTable === n.label) F.add('t:' + r.fromTable); }); });
  st.focusF = F;
}
function focusVisible() {
  if (!st.focusF) return null;
  const V = new Set(); st.focusF.forEach(id => { const v = visId(id); if (v) V.add(v); });
  return V;
}

/* ---------- desenho ---------- */
function render() {
  layout();
  const nodes = visibleNodes();
  const html = [];
  nodes.forEach(n => {
    const p = pos(n.id); const w = nodeW(n), h = nodeH(n);
    const badges = n.badges.map(b => `<span class="bdg ${b.k}">${esc(b.t)}</span>`).join('');
    const open = n.type === 'pasta' ? st.exp.has(n.label) : n.type === 'pagina' ? st.pexp.has(n.data.pg.id) : false;
    const hasTog = n.type === 'pasta' || (n.type === 'pagina' && (n.data.visuals || []).length && !st.iso);
    const tog = hasTog ? `<button class="tog" data-act="toggle" aria-label="${open ? 'Recolher' : 'Expandir'} ${n.type === 'pasta' ? 'pasta' : 'visuais da página'} ${esc(n.label)}" aria-expanded="${open}">${open ? '−' : '+'}</button>` : '';
    html.push(`<div class="node t-${n.type}${n.type === 'medida' && n.data.unused ? ' unused' : ''}${hasTog ? ' has-tog' : ''}" data-id="${esc(n.id)}" role="button" tabindex="0" aria-label="${esc(TYPE_NAMES[n.type] + ' ' + n.label)}" style="left:${p.x}px;top:${p.y}px;width:${w}px;height:${h}px">
      ${tog}<span class="port-in" aria-hidden="true"></span><span class="port-out" data-port="out" title="Arraste até outro card para ligar"></span><div class="nt" title="${esc(n.label)}">${esc(n.label)}</div>${n.type === 'medida' && !n.manual ? (badges ? `<div class="ns">${badges}</div>` : '') : `<div class="ns"><span class="sub">${esc(n.sub || '')}</span>${badges}</div>`}</div>`);
  });
  $('#nodes').innerHTML = html.join('');
  const counts = [0, 0, 0, 0, 0];
  for (const n of (st.iso ? nodes : st.g.N.values())) { if (isHiddenAuto(n)) continue; if (n.type === 'origem') counts[0]++; else if (n.type === 'consulta') counts[1]++; else if (n.type === 'tabela') counts[2]++; else if (n.type === 'medida') counts[3]++; else if (n.type === 'pagina') counts[4]++; }
  $('#heads').innerHTML = HEADS.map((h, i) => `<div class="colhead c${i}" style="left:${i * COLW}px"><span class="dot"></span>${esc(h)} <span class="cnt">${counts[i]}</span></div>`).join('');
  renderNotes();
  renderLanes();
  renderFrames();
  drawEdges();
  updateToolUi();
  updateClasses();
  updateLegend();
}
function positionNodes() {
  document.querySelectorAll('#nodes .node').forEach(el => { const p = pos(el.dataset.id); el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; });
}
let edgeRaf = 0;
function schedule() { if (edgeRaf) return; edgeRaf = requestAnimationFrame(() => { edgeRaf = 0; positionNodes(); drawEdges(); }); }
function edgeList() {
  const V = focusVisible(); const seen = new Map();
  st.g.L.forEach(l => {
    if (l.kind === 'in') return;
    const s = visId(l.s), t = visId(l.t); if (!s || !t || s === t) return;
    if (l.kind === 'dep' && !st.iso) {
      if (!V || s !== l.s || t !== l.t || !st.focusF.has(l.s) || !st.focusF.has(l.t)) return;
    }
    const k = s + '>' + t;
    const hot = !!(V && st.focusF.has(l.s) && st.focusF.has(l.t));
    if (l.kind === 'dep' && st.iso && V && !hot) return;
    const e = seen.get(k);
    if (e) { e.hot = e.hot || hot; } else seen.set(k, { s, t, kind: l.kind, hot });
  });
  return [...seen.values()];
}
function edgeGeom() {
  const N = st.g.N; const V = focusVisible(); const out = [];
  edgeList().forEach(e => {
    const a = N.get(e.s), b = N.get(e.t); const pa = pos(e.s), pb = pos(e.t);
    const aw = nodeW(a), ah = nodeH(a), bw = nodeW(b), bh = nodeH(b);
    let P;
    const ay = pa.y + ah / 2, by = pb.y + bh / 2;
    if (COLS[a.type] < COLS[b.type] || (e.kind === 'man' && pb.x > pa.x + aw)) {
      const x1 = pa.x + aw, x2 = pb.x - 4; const dx = Math.max(50, (x2 - x1) / 2);
      P = [x1, ay, x1 + dx, ay, x2 - dx, by, x2, by];
    } else if (e.kind === 'dep') {
      const x1 = pa.x + aw, x2 = pb.x + bw + 4; const cx = Math.max(x1, x2) + 50 + Math.abs(by - ay) * 0.12;
      P = [x1, ay, cx, ay, cx, by, x2, by];
    } else {
      const x1 = pa.x, x2 = pb.x - 4; const cx = Math.min(x1, x2) - 46 - Math.abs(by - ay) * 0.1;
      P = [x1, ay, cx, ay, cx, by, x2, by];
    }
    const d = `M${P[0]},${P[1]} C${P[2]},${P[3]} ${P[4]},${P[5]} ${P[6]},${P[7]}`;
    const mid = { x: (P[0] + 3 * P[2] + 3 * P[4] + P[6]) / 8, y: (P[1] + 3 * P[3] + 3 * P[5] + P[7]) / 8 };
    const state = V ? (e.hot ? 'hot' : 'dim') : (st.flag ? 'dim' : (st.showRels ? 'faint' : ''));
    out.push({ d, kind: e.kind, state, s: e.s, t: e.t, mid });
  });
  if (st.showRels) relGeom().forEach(r => out.push(r));
  return out;
}
function relGeom() {
  const N = st.g.N; const out = [];
  st.g.rels.forEach(r => {
    if (AUTO_RE.test(r.toTable) || AUTO_RE.test(r.fromTable)) return;
    const s = visId('t:' + r.fromTable), t = visId('t:' + r.toTable); if (!s || !t || s === t) return;
    const a = N.get(s), b = N.get(t); const pa = pos(s), pb = pos(t);
    const aw = nodeW(a), ah = nodeH(a), bw = nodeW(b), bh = nodeH(b);
    const ay = pa.y + ah / 2, by = pb.y + bh / 2; let d, p1, p2;
    if (Math.abs(pa.x - pb.x) < 120) {
      const x1 = pa.x + aw, x2 = pb.x + bw + 4; const cx = Math.max(x1, x2) + 24 + Math.min(62, Math.abs(by - ay) * 0.06);
      d = `M${x1},${ay} C${cx},${ay} ${cx},${by} ${x2},${by}`; p1 = { x: x1 + 8, y: ay - 6 }; p2 = { x: x2 + 10, y: by - 6 };
    } else {
      const right = pb.x > pa.x; const x1 = right ? pa.x + aw : pa.x, x2 = right ? pb.x - 4 : pb.x + bw + 4; const dx = (x2 - x1) / 2;
      d = `M${x1},${ay} C${x1 + dx},${ay} ${x2 - dx},${by} ${x2},${by}`; p1 = { x: x1 + (right ? 8 : -14), y: ay - 6 }; p2 = { x: x2 + (right ? -14 : 8), y: by - 6 };
    }
    const card = c => c === 'one' ? '1' : '*';
    const selT = [...st.selSet].filter(id => id.startsWith('t:'));
    const fstate = st.focusF ? (selT.includes(s) || selT.includes(t) ? ' hot' : ' dim') : '';
    out.push({ d, kind: 'rel', state: fstate + (r.isActive === false ? ' inactive' : '') + (r.crossFilteringBehavior === 'bothDirections' ? ' both' : ''),
      l1: { x: p1.x, y: p1.y, t: card(r.fromCardinality || 'many') }, l2: { x: p2.x, y: p2.y, t: card(r.toCardinality || 'one') } });
  });
  return out;
}
function drawEdges() {
  const html = edgeGeom().map(g => {
    if (g.kind === 'rel') return `<g class="relg${/dim/.test(g.state) ? ' dim' : ''}"><path class="e rel ${g.state}" d="${g.d}" marker-end="url(#arel)"${/both/.test(g.state) ? ' marker-start="url(#arel2)"' : ''}/><text class="card" x="${g.l1.x}" y="${g.l1.y}">${g.l1.t}</text><text class="card" x="${g.l2.x}" y="${g.l2.y}">${g.l2.t}</text></g>`;
    const key = g.s + '>' + g.t; const on = g.kind === 'man' && st.linkHover === key;
    const main = `<path class="e k-${g.kind}${g.state ? ' ' + g.state : ''}${on ? ' lhover' : ''}" d="${g.d}" marker-end="url(#${g.state === 'hot' || on ? 'ahot' : 'a'})"/>`;
    return g.kind === 'man' ? main + `<path class="lhit" data-link="${esc(key)}" d="${g.d}"/>` : main;
  });
  st.linkMid = {}; edgeGeom().forEach(g => { if (g.kind === 'man') st.linkMid[g.s + '>' + g.t] = g.mid; });
  $('#edges').innerHTML = `<defs><marker id="a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1,1 L7,4 L1,7" class="ah"/></marker><marker id="ahot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1,1 L7,4 L1,7" class="ah hot"/></marker><marker id="arel" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1,1 L7,4 L1,7" class="ah rel"/></marker><marker id="arel2" viewBox="0 0 8 8" refX="1" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M7,1 L1,4 L7,7" class="ah rel"/></marker></defs>` + html.join('');
  drawArrows();
  placeLinkTools();
}
/* ---------- ferramentas na ligação (lixeira e +) ---------- */
let linkHideT = 0;
function showLinkTools(key) { clearTimeout(linkHideT); if (st.linkHover === key) return; st.linkHover = key; drawEdges(); }
function hideLinkTools(now) { clearTimeout(linkHideT); const go = () => { if (st.linkPop) return; st.linkHover = null; drawEdges(); }; if (now) go(); else linkHideT = setTimeout(go, 280); }
function placeLinkTools() {
  const el = $('#ltools'); const key = st.linkHover; const m = key && st.linkMid && st.linkMid[key];
  if (!m || !st.manual) { el.hidden = true; $('#lpop').hidden = true; st.linkPop = false; return; }
  el.hidden = false; el.style.left = m.x + 'px'; el.style.top = m.y + 'px';
  const pop = $('#lpop'); pop.hidden = !st.linkPop; if (st.linkPop) { pop.style.left = m.x + 'px'; pop.style.top = (m.y + 22) + 'px'; }
}
function removeLink(key) {
  const [s, t] = key.split('>'); st.g.L = st.g.L.filter(l => !(l.s === s && l.t === t)); rebuildAdj(); save();
  st.linkHover = null; st.linkPop = false; computeFocus(); drawEdges(); updateClasses();
  if (st.sel && st.g.N.get(st.sel) && st.g.N.get(st.sel).manual) showManualPanel(st.sel);
  toast('Ligação removida.');
}
function insertOnLink(key, tplKey) {
  const [s, t] = key.split('>'); const m = st.linkMid[key]; const tp = tplOf(tplKey);
  const n = addManualNode({ id: newManualId(), type: tp.type, label: tp.label, sub: tp.sub, notes: tp.notes });
  st.pos[n.id] = { x: Math.round(m.x - nodeW(n) / 2), y: Math.round(m.y - nodeH(n) / 2) };
  st.g.L = st.g.L.filter(l => !(l.s === s && l.t === t)); st.g.L.push({ s, t: n.id, kind: 'man' }, { s: n.id, t, kind: 'man' });
  rebuildAdj(); st.linkHover = null; st.linkPop = false; save(); render();
  st.selSet = new Set([n.id]); applySelection();
  const inp = document.querySelector('[data-mf="label"]'); if (inp) { inp.focus(); inp.select(); }
}
function renderLinkPop() {
  $('#lpop').innerHTML = `<p class="lp-t">Inserir um card no meio da ligação</p>` + TPL.map(g => `<div class="lp-g c${g.lane}"><span class="lp-h"><span class="dot"></span>${esc(HEADS[g.lane])}</span><div class="lp-items">${g.items.map((t, i) => `<button class="t-${t.type}" data-ins="${g.lane}:${i}">${esc(t.label)}</button>`).join('')}</div></div>`).join('');
}
function updateClasses() {
  const V = focusVisible(); const q = norm(st.search.trim());
  const matchFolders = new Set();
  if (q) for (const n of st.g.N.values()) {
    if (n.type === 'medida' && !st.exp.has(n.folder) && norm(n.label).includes(q)) matchFolders.add('f:' + n.folder);
    if (n.type === 'visual' && !st.pexp.has(n.page) && norm(n.label).includes(q)) matchFolders.add('p:' + n.page);
  }
  document.querySelectorAll('#nodes .node').forEach(el => {
    const id = el.dataset.id; const n = st.g.N.get(id);
    el.classList.toggle('sel', st.selSet.has(id));
    el.classList.toggle('dim', (!!V && !V.has(id)) || (!!st.flag && !st.flag.has(id)));
    el.classList.toggle('flag', !!st.flag && st.flag.has(id));
    el.classList.toggle('match', !!q && (norm(n.label).includes(q) || matchFolders.has(id)));
  });
  document.body.classList.toggle('focusing', !!V);
  if (!st.iso) $('#btnIso').disabled = !(st.selSet.size || st.flagIds);
}
function updateLegend() {
  const s = st.manual ? manualStats() : st.g.stats;
  const pl = (n, a, b) => n + ' ' + (n === 1 ? a : b);
  if (st.manual) $('#legend').innerHTML = `
    <div class="lg c0"><span class="sw"></span>${pl(s.origens, 'origem', 'origens')}</div>
    <div class="lg c1"><span class="sw"></span>${pl(s.consultas, 'consulta', 'consultas')}</div>
    <div class="lg c2"><span class="sw"></span>${pl(s.tabelas, 'tabela', 'tabelas')}</div>
    <div class="lg c3"><span class="sw"></span>${pl(s.medidas, 'medida', 'medidas')}</div>
    <div class="lg c4"><span class="sw"></span>${pl(s.paginas, 'página', 'páginas')}, ${pl(s.visuais, 'visual', 'visuais')}</div>`;
  else $('#legend').innerHTML = `
    <div class="lg c0"><span class="sw"></span>Origens</div>
    <div class="lg c1"><span class="sw"></span>${s.consultas} consultas</div>
    <div class="lg c2"><span class="sw"></span>${s.tabelas} tabelas${st.showAuto ? ' + ' + s.auto + ' de data' : ''}</div>
    <div class="lg c3"><span class="sw"></span>${s.medidas} medidas, ${s.semUso} sem uso</div>
    <div class="lg c4"><span class="sw"></span>${s.paginas} páginas, ${s.visuais} visuais</div>`;
  $('#btnAuto').setAttribute('aria-pressed', st.showAuto);
  $('#btnAuto').textContent = st.showAuto ? 'Ocultar datas automáticas' : 'Mostrar datas automáticas (' + s.auto + ')';
  const allExp = [...st.g.N.values()].filter(n => n.type === 'pasta').every(f => st.exp.has(f.label));
  $('#btnFold').textContent = allExp ? 'Recolher pastas' : 'Abrir pastas';
  $('#mFold').textContent = $('#btnFold').textContent;
}

/* ---------- anotações ---------- */
function renderNotes() {
  $('#notes').innerHTML = st.notes.map(n => `<div class="note" data-note="${n.id}" style="left:${n.x}px;top:${n.y}px">
    <div class="note-grip"><span>Anotação</span><button class="note-x" data-del="${n.id}" aria-label="Apagar anotação">×</button></div>
    <textarea aria-label="Texto da anotação" data-ta="${n.id}" placeholder="Escreva aqui…">${esc(n.text)}</textarea></div>`).join('');
}
function addNote(x, y) {
  const n = { id: 'n' + Date.now().toString(36), x, y, text: '' };
  st.notes.push(n); renderNotes(); save();
  setTimeout(() => { const ta = document.querySelector(`[data-ta="${n.id}"]`); if (ta) ta.focus(); }, 0);
}
