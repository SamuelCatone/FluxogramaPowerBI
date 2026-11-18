/* Fluxo do Power BI · zoom, enquadramento e posição da tela */
/* ---------- vista ---------- */
let crispT = 0;
function applyView() {
  const { k } = st.view; const x = Math.round(st.view.x), y = Math.round(st.view.y);
  const w = $('#world');
  // durante o movimento usa camada acelerada; parado, redesenha nítido na escala atual
  w.style.willChange = 'transform';
  w.style.transform = `translate(${x}px,${y}px) scale(${k})`;
  clearTimeout(crispT);
  crispT = setTimeout(() => { w.style.willChange = 'auto'; w.style.transform = `translate(${x}px,${y}px) scale(${k + 1e-6})`; requestAnimationFrame(() => { w.style.transform = `translate(${x}px,${y}px) scale(${k})`; }); }, 140);
  const vp = $('#vp'); const s1 = 24 * k, s2 = 120 * k;
  vp.style.backgroundSize = `${s2}px ${s2}px, ${s2}px ${s2}px, ${s1}px ${s1}px, ${s1}px ${s1}px`;
  vp.style.backgroundPosition = `${x}px ${y}px`;
  $('#zoomv').textContent = Math.round(k * 100) + '%';
}
function bbox(onlyIds) {
  let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
  visibleNodes().forEach(n => { if (onlyIds && !onlyIds.has(n.id)) return; const p = pos(n.id); x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y - (onlyIds ? 0 : 70)); x2 = Math.max(x2, p.x + nodeW(n)); y2 = Math.max(y2, p.y + nodeH(n)); });
  if (!onlyIds && !st.iso && st.manual) { x1 = Math.min(x1, -18); y1 = Math.min(y1, -80); x2 = Math.max(x2, 4 * COLW + W + 18); y2 = Math.max(y2, 560); }
  if (!onlyIds && !st.iso) st.frames.forEach(f => { x1 = Math.min(x1, f.x); y1 = Math.min(y1, f.y - 40); x2 = Math.max(x2, f.x + f.w); y2 = Math.max(y2, f.y + f.h); });
  // anotações longas são mais altas que 160 (e somem no modo isolado, como na exportação)
  if (!onlyIds && !st.iso) st.notes.forEach(n => { const el = document.querySelector('[data-note="' + n.id + '"]'); const nh = Math.max(el ? el.offsetHeight : 160, 34 + wrapText(n.text || '', 13, 200).length * 19); x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y); x2 = Math.max(x2, n.x + 220); y2 = Math.max(y2, n.y + nh); });
  return x1 > x2 ? null : { x1, y1, x2, y2 };
}
function leftInset() { return st.manual && innerWidth > 760 ? (document.body.classList.contains('pal-open') ? 330 : 80) : 0; }
function fit(ids, widthOnly) {
  const b = bbox(ids); if (!b) return;
  const r = $('#vp').getBoundingClientRect(); const pw = panelOpen() && innerWidth > 760 ? 380 : 0; const pl = leftInset();
  const aw = r.width - pw - pl - 80, ah = r.height - 80;
  const k = Math.max(0.12, Math.min(1.1, aw / (b.x2 - b.x1), widthOnly ? 9 : ah / (b.y2 - b.y1)));
  if (widthOnly) { st.view = { k, x: pl + 40 + (aw - (b.x2 - b.x1) * k) / 2 - b.x1 * k, y: 40 - b.y1 * k }; applyView(); return; }
  st.view = { k, x: pl + 40 + (aw - (b.x2 - b.x1) * k) / 2 - b.x1 * k, y: 40 + (ah - (b.y2 - b.y1) * k) / 2 - b.y1 * k };
  applyView();
}
function centerOn(id) {
  const n = st.g.N.get(id); const p = pos(id); const r = $('#vp').getBoundingClientRect();
  const pw = panelOpen() && innerWidth > 760 ? 380 : 0; const pl = leftInset(); const k = Math.max(st.view.k, 0.75);
  st.view = { k, x: pl + (r.width - pw - pl) / 2 - (p.x + nodeW(n) / 2) * k, y: r.height / 2 - (p.y + nodeH(n) / 2) * k };
  applyView();
}
function zoomBy(f, cx, cy) {
  const r = $('#vp').getBoundingClientRect(); if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
  const { x, y, k } = st.view; const nk = Math.max(0.12, Math.min(2.2, k * f));
  const wx = (cx - x) / k, wy = (cy - y) / k;
  st.view = { k: nk, x: cx - wx * nk, y: cy - wy * nk }; applyView();
}
