/* Fluxo do Power BI · molduras, setas e rótulos */
/* ---------- desenho livre: molduras e setas ---------- */
const FRAME_COLORS = ['c4', 'c1', 'c2', 'c3', 'c0', 'mute'];
function renderFrames() {
  $('#frames').innerHTML = st.iso ? '' : st.frames.map(f => `<div class="frame fc-${f.c}" data-frame="${f.id}" style="left:${f.x}px;top:${f.y}px;width:${f.w}px;height:${f.h}px">
    <div class="frame-head"><span class="frame-grip" title="Arraste para mover a área e o que está dentro">⠿</span><button class="frame-dot" data-fdot="${f.id}" aria-label="Trocar cor da moldura"></button><input class="frame-title" data-ftitle="${f.id}" value="${esc(f.title)}" aria-label="Título da moldura" spellcheck="false"><button class="frame-x" data-fdel="${f.id}" aria-label="Apagar moldura">×</button></div>
    <div class="frame-resize" data-fres="${f.id}" title="Arraste para redimensionar"></div></div>`).join('');
}
function addFrame(x, y, w, h, title) {
  const f = { id: 'f' + Date.now().toString(36), x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), title: title || 'Nova área', c: FRAME_COLORS[st.frames.length % FRAME_COLORS.length] };
  st.frames.push(f); renderFrames(); save();
  const inp = document.querySelector(`[data-ftitle="${f.id}"]`); if (inp) { inp.focus(); inp.select(); }
  return f;
}
function frameAroundSelection() {
  const b = bbox(st.selSet); if (!b) return false;
  addFrame(b.x1 - 30, b.y1 - 30, b.x2 - b.x1 + 60, b.y2 - b.y1 + 60);
  return true;
}
function refRect(r) {
  if (r.t === 'node') {
    const v = visId(r.id); if (!v) return null; const n = st.g.N.get(v); if (!document.querySelector(`#nodes [data-id="${CSS.escape(v)}"]`)) return null;
    const p = pos(v); return { x: p.x, y: p.y, w: nodeW(n), h: nodeH(n) };
  }
  if (r.t === 'note') {
    const n = st.notes.find(x => x.id === r.id); if (!n) return null;
    const el = document.querySelector(`[data-note="${n.id}"]`); return { x: n.x, y: n.y, w: 220, h: el ? el.offsetHeight : 140 };
  }
  return null;
}
function edgePoint(R, tx, ty, pad) {
  const cx = R.x + R.w / 2, cy = R.y + R.h / 2; const dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const s = Math.min(dx ? (R.w / 2 + pad) / Math.abs(dx) : Infinity, dy ? (R.h / 2 + pad) / Math.abs(dy) : Infinity);
  return { x: cx + dx * s, y: cy + dy * s };
}
function arrowGeom() {
  if (st.iso) return [];
  const out = [];
  st.arrows.forEach(a => {
    const A = refRect(a.from), B = refRect(a.to); if (!A || !B) return;
    const p1 = edgePoint(A, B.x + B.w / 2, B.y + B.h / 2, 3), p2 = edgePoint(B, A.x + A.w / 2, A.y + A.h / 2, 7);
    out.push({ a, p1, p2, mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } });
  });
  return out;
}
function drawArrows() {
  const G = arrowGeom();
  $('#uarrows').innerHTML = `<defs><marker id="au" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M1,1 L9,5 L1,9 Z" class="uah"/></marker></defs>` +
    G.map(g => `<g class="ua${st.selArrow === g.a.id ? ' sel' : ''}"><line class="ua-hit" data-arrow="${g.a.id}" x1="${g.p1.x}" y1="${g.p1.y}" x2="${g.p2.x}" y2="${g.p2.y}"/><line class="ua-line" x1="${g.p1.x}" y1="${g.p1.y}" x2="${g.p2.x}" y2="${g.p2.y}" marker-end="url(#au)"/></g>`).join('');
  // redesenhar não pode descartar o campo de texto que a pessoa está editando
  const ed = document.querySelector('#alabels .alabel-edit');
  if (ed) { const ga = G.find(g => g.a.id === ed.dataset.arrow); if (ga) { ed.style.left = ga.mid.x + 'px'; ed.style.top = ga.mid.y + 'px'; } ed.dataset.moving = '1'; ed.remove(); }
  $('#alabels').innerHTML = G.map(g => {
    const sel = st.selArrow === g.a.id;
    if (!g.a.label && !sel) return '';
    return `<div class="alabel${sel ? ' sel' : ''}${g.a.label ? '' : ' notext'}" data-alabel="${g.a.id}" style="left:${g.mid.x}px;top:${g.mid.y}px">${g.a.label ? esc(g.a.label) : 'Dois cliques para escrever'}${sel ? `<button class="adel" data-adel="${g.a.id}" aria-label="Apagar seta">×</button>` : ''}</div>`;
  }).join('');
  if (ed) { $('#alabels').appendChild(ed); ed.focus(); delete ed.dataset.moving; }
}
function editArrowLabel(id) {
  const a = st.arrows.find(x => x.id === id); if (!a) return;
  const g = arrowGeom().find(x => x.a.id === id); if (!g) return;
  const inp = document.createElement('input'); inp.className = 'alabel-edit'; inp.value = a.label || ''; inp.placeholder = 'Texto da seta'; inp.dataset.arrow = id;
  inp.style.left = g.mid.x + 'px'; inp.style.top = g.mid.y + 'px';
  $('#alabels').appendChild(inp); inp.focus(); inp.select();
  let closed = false;
  const done = keep => { if (closed) return; closed = true; if (keep) { a.label = inp.value.trim(); save(); } inp.remove(); drawArrows(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); e.stopPropagation(); });
  inp.addEventListener('blur', () => { if (!inp.dataset.moving) done(true); });
}
function setTool(t) {
  st.tool = t; updateToolUi();
  if (t === 'frame') { if (st.selSet.size && frameAroundSelection()) { setTool('select'); toast('Moldura criada em volta da seleção. Dê um nome a ela.'); } else toast('Arraste na malha para desenhar a moldura.'); }
  if (t === 'arrow') toast('Arraste de um bloco ou anotação até outro para ligar.');
  if (t === 'note') toast('Clique na malha onde a anotação deve ficar.');
}
function updateToolUi() {
  document.querySelectorAll('#toolbox [data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === st.tool));
  const vp = $('#vp'); ['select', 'arrow', 'frame', 'note'].forEach(t => vp.classList.toggle('tool-' + t, st.tool === t));
  $('#toolbox').hidden = !!st.iso;
  const br = $('#btnRels'); if (br) { br.setAttribute('aria-pressed', st.showRels); br.title = st.showRels ? 'Ocultar as linhas de relacionamento' : 'Mostrar as linhas de relacionamento entre tabelas'; }
}
