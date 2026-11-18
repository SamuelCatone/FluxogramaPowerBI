/* Fluxo do Power BI · mouse, teclado e botões */
/* ---------- eventos ---------- */
function setup() {
  const vp = $('#vp');
  const pick = () => $('#file').click();
  $('#pick').addEventListener('click', pick);
  $('#btnFile').addEventListener('click', pick);
  $('#file').addEventListener('change', e => { const f = e.target.files[0]; if (f) loadFile(f); e.target.value = ''; });
  ['dragover', 'dragenter'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); document.body.classList.add('dropping'); }));
  ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { if (ev === 'dragleave' && e.relatedTarget) return; document.body.classList.remove('dropping'); }));
  document.addEventListener('drop', e => { e.preventDefault(); if ([...e.dataTransfer.types].includes('application/x-fluxo-card')) return; const f = e.dataTransfer.files[0]; if (!f) return; if (/\.json$/i.test(f.name)) openDrawing(f); else loadFile(f); });

  let drag = null;
  const mq = $('#marquee');
  vp.addEventListener('contextmenu', e => { if (st.g) e.preventDefault(); });
  vp.addEventListener('pointerdown', e => {
    if (!st.g) return;
    if (e.target.closest('textarea') || e.target.closest('.note-x')) return;
    const r = vp.getBoundingClientRect();
    const base = { sx: e.clientX, sy: e.clientY, moved: false, target: e.target, add: e.shiftKey || e.ctrlKey || e.metaKey };
    const onThing = e.target.closest('.node, .note-grip, .frame-head, .frame-resize, [data-arrow]');
    if (e.target.closest('input, .frame-x, .frame-dot, .adel, .alabel, #ltools, #lpop, [data-link]')) return;
    if (e.button === 2 || e.button === 1 || (e.button === 0 && e.pointerType === 'touch' && !onThing)) {
      e.preventDefault();
      drag = Object.assign(base, { mode: 'pan', ox: st.view.x, oy: st.view.y });
    } else if (e.button === 0) {
      const grip = e.target.closest('.note-grip'); const nodeEl = e.target.closest('.node');
      const fres = e.target.closest('.frame-resize'), fhead = e.target.closest('.frame-head'), arr = e.target.closest('[data-arrow]');
      const toolTarget = nodeEl ? { t: 'node', id: nodeEl.dataset.id } : (e.target.closest('.note') ? { t: 'note', id: e.target.closest('.note').dataset.note } : null);
      const port = e.target.closest('.port-out');
      if (port && nodeEl) {
        drag = Object.assign(base, { mode: 'conn', from: { t: 'node', id: nodeEl.dataset.id }, fromPort: true });
        $('#tmpline').setAttribute('d', ''); vp.classList.add('connecting');
      } else if (st.tool === 'arrow' && toolTarget) {
        drag = Object.assign(base, { mode: 'conn', from: toolTarget });
        $('#tmpline').setAttribute('d', '');
      } else if (st.tool === 'frame' && !fres && !fhead) {
        const { x, y, k } = st.view;
        drag = Object.assign(base, { mode: 'fdraw', x0: e.clientX - r.left, y0: e.clientY - r.top, wx: (e.clientX - r.left - x) / k, wy: (e.clientY - r.top - y) / k });
      } else if (st.tool === 'note' && !nodeEl && !grip) {
        e.preventDefault(); const { x, y, k } = st.view; addNote(Math.round((e.clientX - r.left - x) / k), Math.round((e.clientY - r.top - y) / k)); setTool('select'); return;
      } else if (fres) {
        const f = st.frames.find(x => x.id === fres.dataset.fres); drag = Object.assign(base, { mode: 'fres', frame: f, ow: f.w, oh: f.h, el: fres.parentElement });
      } else if (fhead) {
        const el = fhead.parentElement; const f = st.frames.find(x => x.id === el.dataset.frame);
        const inside = (x, y, w, h) => x >= f.x && y >= f.y && x + w <= f.x + f.w && y + h <= f.y + f.h;
        const inNodes = visibleNodes().filter(n => { const p = pos(n.id); return inside(p.x, p.y, nodeW(n), nodeH(n)); }).map(n => ({ id: n.id, o: Object.assign({}, pos(n.id)) }));
        const inNotes = st.notes.filter(n => inside(n.x, n.y, 220, 60)).map(n => ({ n, o: { x: n.x, y: n.y } }));
        drag = Object.assign(base, { mode: 'fmove', frame: f, ox: f.x, oy: f.y, el, inNodes, inNotes });
      } else if (arr) {
        drag = Object.assign(base, { mode: 'arrowsel', id: arr.dataset.arrow });
      } else if (grip) { const id = grip.parentElement.dataset.note; const n = st.notes.find(x => x.id === id); drag = Object.assign(base, { mode: 'note', id, ox: n.x, oy: n.y, el: grip.parentElement }); }
      else if (nodeEl) {
        const id = nodeEl.dataset.id;
        const ids = st.selSet.has(id) && st.selSet.size > 1 && !base.add ? [...st.selSet] : [id];
        drag = Object.assign(base, { mode: 'node', id, group: ids.map(g => ({ id: g, o: Object.assign({}, pos(g)) })) });
      } else {
        drag = Object.assign(base, { mode: 'box', x0: e.clientX - r.left, y0: e.clientY - r.top, prev: new Set(st.selSet) });
      }
    } else return;
    vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; vp.classList.add(drag.mode === 'pan' ? 'grabbing' : drag.mode === 'box' ? 'boxing' : 'moving'); }
    if (!drag.moved) return;
    const k = st.view.k;
    if (drag.mode === 'pan') { st.view.x = drag.ox + dx; st.view.y = drag.oy + dy; applyView(); }
    else if (drag.mode === 'node') {
      const P = st.iso ? st.isoPos : st.pos;
      drag.group.forEach(g => { P[g.id] = { x: Math.round(g.o.x + dx / k), y: Math.round(g.o.y + dy / k) }; });
      schedule();
    } else if (drag.mode === 'note') {
      const n = st.notes.find(x => x.id === drag.id); n.x = Math.round(drag.ox + dx / k); n.y = Math.round(drag.oy + dy / k);
      drag.el.style.left = n.x + 'px'; drag.el.style.top = n.y + 'px';
      drawArrows();
    } else if (drag.mode === 'fmove') {
      const f = drag.frame; f.x = Math.round(drag.ox + dx / k); f.y = Math.round(drag.oy + dy / k);
      drag.el.style.left = f.x + 'px'; drag.el.style.top = f.y + 'px';
      drag.inNodes.forEach(g => { st.pos[g.id] = { x: Math.round(g.o.x + dx / k), y: Math.round(g.o.y + dy / k) }; });
      drag.inNotes.forEach(g => { g.n.x = Math.round(g.o.x + dx / k); g.n.y = Math.round(g.o.y + dy / k); const el = document.querySelector(`[data-note="${g.n.id}"]`); if (el) { el.style.left = g.n.x + 'px'; el.style.top = g.n.y + 'px'; } });
      schedule();
    } else if (drag.mode === 'fres') {
      const f = drag.frame; f.w = Math.max(120, Math.round(drag.ow + dx / k)); f.h = Math.max(80, Math.round(drag.oh + dy / k));
      drag.el.style.width = f.w + 'px'; drag.el.style.height = f.h + 'px';
    } else if (drag.mode === 'fdraw' || drag.mode === 'conn') {
      const r = vp.getBoundingClientRect(); const { x, y } = st.view;
      const wx = (e.clientX - r.left - x) / k, wy = (e.clientY - r.top - y) / k;
      if (drag.mode === 'fdraw') {
        const x1 = Math.min(drag.wx, wx), y1 = Math.min(drag.wy, wy);
        mq.hidden = false; mq.classList.add('fdraw');
        const sx1 = Math.min(drag.x0, e.clientX - r.left), sy1 = Math.min(drag.y0, e.clientY - r.top);
        mq.style.left = sx1 + 'px'; mq.style.top = sy1 + 'px'; mq.style.width = Math.abs(e.clientX - r.left - drag.x0) + 'px'; mq.style.height = Math.abs(e.clientY - r.top - drag.y0) + 'px';
        drag.rect = { x: x1, y: y1, w: Math.abs(wx - drag.wx), h: Math.abs(wy - drag.wy) };
      } else {
        const A = refRect(drag.from);
        if (A && drag.fromPort) { const x1 = A.x + A.w + 6, y1 = A.y + A.h / 2; const dx = Math.max(40, Math.abs(wx - x1) / 2); $('#tmpline').setAttribute('d', `M${x1},${y1} C${x1 + dx},${y1} ${wx - dx},${wy} ${wx},${wy}`); }
        else if (A) { const p1 = edgePoint(A, wx, wy, 3); $('#tmpline').setAttribute('d', `M${p1.x},${p1.y} L${wx},${wy}`); }
        const over = document.elementFromPoint(e.clientX, e.clientY); const tn = over && over.closest('.node, .note');
        const tid = tn ? (tn.dataset.id || tn.dataset.note) : null;
        if (drag.hover !== tid) { document.querySelectorAll('.drop-ok').forEach(x => x.classList.remove('drop-ok')); if (tn && tid !== drag.from.id) tn.classList.add('drop-ok'); drag.hover = tid; }
      }
    } else if (drag.mode === 'box') {
      const r = vp.getBoundingClientRect();
      const x1 = Math.min(drag.x0, e.clientX - r.left), y1 = Math.min(drag.y0, e.clientY - r.top);
      const x2 = Math.max(drag.x0, e.clientX - r.left), y2 = Math.max(drag.y0, e.clientY - r.top);
      mq.hidden = false; mq.style.left = x1 + 'px'; mq.style.top = y1 + 'px'; mq.style.width = (x2 - x1) + 'px'; mq.style.height = (y2 - y1) + 'px';
      const { x, y } = st.view;
      const wx1 = (x1 - x) / k, wy1 = (y1 - y) / k, wx2 = (x2 - x) / k, wy2 = (y2 - y) / k;
      const hits = visibleNodes().filter(n => { const p = pos(n.id); return p.x < wx2 && p.x + nodeW(n) > wx1 && p.y < wy2 && p.y + nodeH(n) > wy1; }).map(n => n.id);
      st.selSet = new Set(drag.add ? [...drag.prev, ...hits] : hits);
      document.querySelectorAll('#nodes .node').forEach(el => el.classList.toggle('sel', st.selSet.has(el.dataset.id)));
    }
  });
  const end = e => {
    if (!drag) return; vp.classList.remove('grabbing', 'boxing', 'moving'); mq.hidden = true; mq.classList.remove('fdraw');
    const d = drag; drag = null;
    if (d.mode === 'conn') {
      $('#tmpline').setAttribute('d', ''); vp.classList.remove('connecting'); document.querySelectorAll('.drop-ok').forEach(x => x.classList.remove('drop-ok'));
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const tn = el && el.closest('.node'), tt = el && el.closest('.note');
      const to = tn ? { t: 'node', id: tn.dataset.id } : tt ? { t: 'note', id: tt.dataset.note } : null;
      if (to && st.manual && to.t === 'node' && d.from.t === 'node' && to.id !== d.from.id) {
        if (!st.g.L.some(l => l.s === d.from.id && l.t === to.id)) { st.g.L.push({ s: d.from.id, t: to.id, kind: 'man' }); rebuildAdj(); save(); drawEdges(); }
        if (!d.fromPort) { setTool('select'); toast('Cards ligados. Para desfazer a ligação, abra o card e use o × ao lado dela.'); }
        if (st.sel === d.from.id || st.sel === to.id) showPanel(st.sel);
        return;
      }
      if (to && !(to.t === d.from.t && to.id === d.from.id)) {
        const a = { id: 'a' + Date.now().toString(36), from: d.from, to, label: '' };
        st.arrows.push(a); st.selArrow = a.id; save(); drawArrows();
        if (!d.fromPort) { setTool('select'); toast('Seta criada. Dê dois cliques nela para escrever um texto.'); }
      }
      return;
    }
    if (d.mode === 'fdraw') {
      if (d.rect && d.rect.w > 40 && d.rect.h > 30) { addFrame(d.rect.x, d.rect.y, d.rect.w, d.rect.h); setTool('select'); }
      return;
    }
    if (d.mode === 'arrowsel') { st.selArrow = d.id; drawArrows(); return; }
    if (d.mode === 'fmove' || d.mode === 'fres') { if (d.moved) save(); return; }
    if (st.selArrow) { st.selArrow = null; drawArrows(); }
    if (d.moved) {
      if ((d.mode === 'node' && !st.iso) || d.mode === 'note') save();
      if (d.mode === 'box') applySelection();
      return;
    }
    if (d.mode === 'node') {
      if (d.target.closest('[data-act="toggle"]')) { toggleNode(d.id); return; }
      if (d.add) { if (st.selSet.has(d.id)) st.selSet.delete(d.id); else st.selSet.add(d.id); }
      else st.selSet = new Set([d.id]);
      applySelection();
    } else if (d.mode === 'box') { if (!d.add && (st.selSet.size || st.flag)) { st.selSet = new Set(); applySelection(); } }
  };
  vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
  vp.addEventListener('wheel', e => {
    if (!st.g) return;
    // dentro de listas e campos que rolam, a rodinha rola o conteúdo em vez de dar zoom
    const sc = e.target.closest('#lpop, textarea, .note textarea');
    if (sc && !e.ctrlKey) { e.stopPropagation(); const canUp = sc.scrollTop > 0, canDown = sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1; if ((e.deltaY < 0 && canUp) || (e.deltaY > 0 && canDown)) return; e.preventDefault(); return; }
    e.preventDefault();
    const r = vp.getBoundingClientRect();
    if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top);
    else { st.view.x -= e.deltaX; applyView(); }
  }, { passive: false });
  vp.addEventListener('dblclick', e => {
    if (!st.g) return;
    const ar = e.target.closest('[data-arrow], [data-alabel]'); if (ar) { editArrowLabel(ar.dataset.arrow || ar.dataset.alabel); return; }
    const mnode = e.target.closest('.node'); if (mnode && st.manual) { const n = st.g.N.get(mnode.dataset.id); if (n && n.manual) { st.selSet = new Set([n.id]); applySelection(); const inp = document.querySelector('[data-mf="label"]'); if (inp) { inp.focus(); inp.select(); } return; } }
    if (e.target.closest('.node, .note, .frame-head, .frame-resize, input')) return;
    const r = vp.getBoundingClientRect(); const { x, y, k } = st.view;
    addNote(Math.round((e.clientX - r.left - x) / k), Math.round((e.clientY - r.top - y) / k));
  });
  vp.addEventListener('keydown', e => {
    const el = e.target.closest && e.target.closest('.node');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (e.shiftKey || e.ctrlKey) { if (st.selSet.has(el.dataset.id)) st.selSet.delete(el.dataset.id); else st.selSet.add(el.dataset.id); applySelection(); } else select(el.dataset.id); }
  });
  $('#notes').addEventListener('input', e => {
    const id = e.target.dataset.ta; if (!id) return;
    const n = st.notes.find(x => x.id === id); n.text = e.target.value; clearTimeout(n._t); n._t = setTimeout(save, 400);
  });
  $('#notes').addEventListener('click', e => {
    const id = e.target.dataset.del; if (!id) return;
    st.notes = st.notes.filter(x => x.id !== id); renderNotes(); save();
  });
  $('#pbody').addEventListener('click', e => {
    const go = e.target.closest('[data-go]'); if (go) { select(go.dataset.go, { reveal: true, keep: true }); return; }
    if (e.target.closest('[data-act="togglesel"]')) { toggleFolder(st.g.N.get(st.sel).label); showPanel(st.sel); }
    if (e.target.closest('[data-act="mdel"]')) { deleteManual([st.sel]); return; }
    if (e.target.closest('[data-act="mdup"]')) { duplicateManual(st.sel); return; }
    const ul = e.target.closest('[data-unlink]'); if (ul) { const [s, t] = ul.dataset.unlink.split('>'); st.g.L = st.g.L.filter(l => !(l.s === s && l.t === t)); rebuildAdj(); save(); computeFocus(); drawEdges(); updateClasses(); showManualPanel(st.sel); return; }
    const cb = e.target.closest('[data-col]'); if (cb && st.sel && st.sel.startsWith('t:')) { showColumn(st.g.N.get(st.sel).label, cb.dataset.col); return; }
    const bo = e.target.closest('[data-bpopen]'); if (bo) { openBp(bo.dataset.bpopen); return; }
    if (e.target.closest('[data-act="togglepage"]')) { togglePage(st.g.N.get(st.sel).data.pg.id); }
    const ck = e.target.closest('[data-chk]'); if (ck) { setCheck(ck.dataset.chk, ck.dataset.s); }
    if (e.target.closest('[data-act="markresolved"]')) { st.cmp.diagD.resolved.forEach(x => { st.checks[x.key] = { s: 'resolvido', em: new Date().toISOString(), t: x.title, sev: x.sev }; }); saveChecks(); updateDiagBtn(); showCompare(); toast('Pontos resolvidos marcados no checklist.'); }
    if (e.target.closest('[data-act="clearsel"]')) { st.selSet = new Set(); applySelection(); }
    if (e.target.closest('[data-act="diag"]')) showDiag();
    if (e.target.closest('[data-act="cmp"]')) showCompare();
    if (e.target.closest('[data-act="iso"]')) { if (st.iso) exitIso(); else isolate(); }
    if (e.target.closest('[data-act="swap"]')) swapCompare();
    if (e.target.closest('[data-act="cmpshow"]')) selectMany(cmpIds());
    const di = e.target.closest('[data-diagiso]'); if (di) { st.selSet = new Set(); st.flagIds = st.diag[+di.dataset.diagiso].ids.slice(); isolate(); }
    const ds = e.target.closest('[data-diagsel]'); if (ds) selectMany(st.diag[+ds.dataset.diagsel].ids);
  });
  $('#pbody').addEventListener('input', e => { const f = e.target.dataset.mf; if (f && st.sel) updateManualField(st.sel, f, e.target.value); });
  $('#pbody').addEventListener('change', e => { const f = e.target.dataset.mf; if (f === 'type' && st.sel) updateManualField(st.sel, f, e.target.value); });
  $('#newBlank').addEventListener('click', () => startManual('blank'));
  $('#newExample').addEventListener('click', () => startManual('example'));
  $('#resumeManual').addEventListener('click', () => startManual('resume'));
  $('#openJson').addEventListener('click', () => $('#file3').click());
  if (savedManual()) $('#resumeRow').hidden = false;
  const twice = (btn, kind) => { if (st.manual && st.g.N.size && btn.dataset.armed !== '1') { btn.dataset.armed = '1'; const t = btn.textContent; btn.textContent = 'Clique de novo para substituir o fluxo atual'; setTimeout(() => { btn.dataset.armed = ''; btn.textContent = t; }, 3500); return; } btn.dataset.armed = ''; closeMenu(); startManual(kind); };
  $('#mNewBlank').addEventListener('click', e => twice(e.currentTarget, 'blank'));
  $('#mNewExample').addEventListener('click', e => twice(e.currentTarget, 'example'));
  $('#palOpen').addEventListener('click', () => setPalette(true));
  try { setPalette(localStorage.getItem('fluxo-pbi:paleta') !== 'recolhida' && innerWidth > 760); } catch (e) { setPalette(innerWidth > 760); }
  $('#palette').addEventListener('dragstart', e => { const t = e.target.closest('[data-tpl]'); if (!t) return; e.dataTransfer.setData('application/x-fluxo-card', t.dataset.tpl); e.dataTransfer.effectAllowed = 'copy'; });
  $('#palette').addEventListener('click', e => { const t = e.target.closest('[data-tpl]'); if (t) addFromTemplate(t.dataset.tpl); });
  $('#palette').addEventListener('keydown', e => { const t = e.target.closest('[data-tpl]'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); addFromTemplate(t.dataset.tpl); } });
  vp.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('application/x-fluxo-card')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  vp.addEventListener('drop', e => { const k = e.dataTransfer && e.dataTransfer.getData('application/x-fluxo-card'); if (!k || !st.manual) return; e.preventDefault(); e.stopPropagation(); document.body.classList.remove('dropping'); const r = vp.getBoundingClientRect(); const { x, y, k: z } = st.view; addFromTemplate(k, (e.clientX - r.left - x) / z, (e.clientY - r.top - y) / z); });
  renderLinkPop();
  $('#edges').addEventListener('mouseover', e => { const p = e.target.closest('[data-link]'); if (p && st.manual) showLinkTools(p.dataset.link); });
  $('#edges').addEventListener('mouseout', e => { if (e.target.closest('[data-link]')) hideLinkTools(); });
  $('#edges').addEventListener('click', e => { const p = e.target.closest('[data-link]'); if (p && st.manual) { showLinkTools(p.dataset.link); } });
  $('#ltools').addEventListener('mouseenter', () => clearTimeout(linkHideT));
  $('#ltools').addEventListener('mouseleave', () => hideLinkTools());
  $('#lpop').addEventListener('mouseenter', () => clearTimeout(linkHideT));
  $('#ltools').addEventListener('click', e => {
    if (!st.linkHover) return;
    if (e.target.closest('[data-lact="del"]')) removeLink(st.linkHover);
    else if (e.target.closest('[data-lact="add"]')) { st.linkPop = !st.linkPop; placeLinkTools(); }
  });
  $('#lpop').addEventListener('click', e => { const b = e.target.closest('[data-ins]'); if (b && st.linkHover) insertOnLink(st.linkHover, b.dataset.ins); });
  document.addEventListener('pointerdown', e => { if (st.linkPop && !e.target.closest('#lpop, #ltools')) { st.linkPop = false; hideLinkTools(true); } });
  $('#pclose').addEventListener('click', () => { st.panelMode = ''; select(null); hidePanel(); });
  $('#btnIso').addEventListener('click', () => { if (st.iso) exitIso(); else isolate(); });
  $('#isoexit').addEventListener('click', () => exitIso());
  $('#btnCmp').addEventListener('click', () => { if (st.cmp && !(st.panelMode === 'cmp' && panelOpen())) showCompare(); else $('#file2').click(); });
  $('#file2').addEventListener('change', e => { const f = e.target.files[0]; if (f) compareWith(f); e.target.value = ''; });
  $('#cmpNew').addEventListener('click', () => { closeMenu(); $('#file2').click(); });
  // os dois "Novo fluxo" pedem um segundo clique; o menu precisa ficar aberto para mostrar o aviso
  document.querySelectorAll('#moremenu button:not(#mNewBlank):not(#mNewExample)').forEach(b => b.addEventListener('click', closeMenu));
  $('#btnDiag').addEventListener('click', () => { if (st.panelMode === 'diag' && panelOpen()) { st.panelMode = ''; hidePanel(); } else showDiag(); });
  $('#zin').addEventListener('click', () => zoomBy(1.2));
  $('#zfit').addEventListener('click', () => fit());
  $('#mFit').addEventListener('click', () => { closeMenu(); fit(); });
  $('#mFold').addEventListener('click', () => { closeMenu(); $('#btnFold').click(); });
  $('#mCmp').addEventListener('click', () => { closeMenu(); $('#btnCmp').click(); });
  $('#mIso').addEventListener('click', () => { closeMenu(); if (!$('#btnIso').disabled) $('#btnIso').click(); else toast('Selecione um ou mais blocos antes de isolar.'); });
  $('#mRels').addEventListener('click', () => { closeMenu(); $('#btnRels').click(); });
  $('#zout').addEventListener('click', () => zoomBy(1 / 1.2));
  $('#btnFit').addEventListener('click', () => fit());
  $('#btnReset').addEventListener('click', () => { st.pos = {}; save(); render(); fit(null, true); toast('Blocos reorganizados. As anotações continuam onde estavam.'); });
  $('#btnAuto').addEventListener('click', () => { st.showAuto = !st.showAuto; save(); computeFocus(); render(); });
  $('#btnFold').addEventListener('click', () => {
    const fs = [...st.g.N.values()].filter(n => n.type === 'pasta');
    const allExp = fs.every(f => st.exp.has(f.label));
    st.exp = allExp ? new Set() : new Set(fs.map(f => f.label)); save(); render();
  });
  $('#q').addEventListener('input', e => { st.search = e.target.value; updateClasses(); });
  $('#q').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = norm(st.search.trim()); if (!q) return;
      const order = ['tabela', 'medida', 'consulta', 'pagina', 'visual', 'pasta', 'origem'];
      const hits = [...st.g.N.values()].filter(n => !(n.auto && !st.showAuto) && norm(n.label).includes(q)).sort((a, b) => (norm(a.label) === q ? -1 : 0) - (norm(b.label) === q ? -1 : 0) || order.indexOf(a.type) - order.indexOf(b.type));
      if (hits.length) select(hits[0].id, { reveal: true, keep: true }); else toast('Nada encontrado com esse nome.');
    }
    if (e.key === 'Escape') { e.target.value = ''; st.search = ''; updateClasses(); }
  });
  document.addEventListener('keydown', e => {
    if (!st.g || e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (st.mode === 'bp') return;
    if (!$('#tour').hidden) return;
    if (e.key === 'Escape' && (st.linkHover || st.linkPop)) { st.linkPop = false; hideLinkTools(true); return; }
    if (e.key === 'Escape') { if (st.tool !== 'select') { setTool('select'); return; } if (st.selArrow) { st.selArrow = null; drawArrows(); return; } if (!st.selSet.size && !st.flag && st.iso) exitIso(); else select(null); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && st.manual && !st.selArrow && [...st.selSet].some(id => st.g.N.get(id) && st.g.N.get(id).manual)) { e.preventDefault(); deleteManual([...st.selSet]); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && st.manual && st.undo) { e.preventDefault(); undoManual(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selArrow) { st.arrows = st.arrows.filter(a => a.id !== st.selArrow); st.selArrow = null; save(); drawArrows(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); st.selSet = new Set(visibleNodes().map(n => n.id)); applySelection(); }
    else if (e.key === '+' || e.key === '=') zoomBy(1.2);
    else if (e.key === '-') zoomBy(1 / 1.2);
    else if (e.key === '0') fit();
    else if (e.key === '/') { e.preventDefault(); $('#q').focus(); }
  });
  $('#frames').addEventListener('input', e => { const id = e.target.dataset.ftitle; if (!id) return; const f = st.frames.find(x => x.id === id); f.title = e.target.value; clearTimeout(f._t); f._t = setTimeout(save, 400); });
  $('#frames').addEventListener('keydown', e => { if (e.target.dataset.ftitle && (e.key === 'Enter' || e.key === 'Escape')) e.target.blur(); });
  $('#frames').addEventListener('click', e => {
    const del = e.target.closest('[data-fdel]'); if (del) { st.frames = st.frames.filter(f => f.id !== del.dataset.fdel); renderFrames(); save(); return; }
    const dot = e.target.closest('[data-fdot]'); if (dot) { const f = st.frames.find(x => x.id === dot.dataset.fdot); f.c = FRAME_COLORS[(FRAME_COLORS.indexOf(f.c) + 1) % FRAME_COLORS.length]; renderFrames(); save(); }
  });
  $('#alabels').addEventListener('click', e => { const d = e.target.closest('[data-adel]'); if (d) { st.arrows = st.arrows.filter(a => a.id !== d.dataset.adel); st.selArrow = null; save(); drawArrows(); } });
  document.querySelectorAll('#toolbox [data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  const setTb = c => { $('#toolbox').classList.toggle('collapsed', c); const t = $('#tbToggle'); t.setAttribute('aria-expanded', !c); t.title = c ? 'Expandir ferramentas' : 'Recolher ferramentas'; t.setAttribute('aria-label', t.title); };
  try { setTb(localStorage.getItem('fluxo-pbi:toolbox') === 'recolhida'); } catch (e) {}
  $('#tbToggle').addEventListener('click', () => { const c = !$('#toolbox').classList.contains('collapsed'); setTb(c); try { localStorage.setItem('fluxo-pbi:toolbox', c ? 'recolhida' : 'aberta'); } catch (e) {} });
  $('#btnRels').addEventListener('click', () => { st.showRels = !st.showRels; save(); drawEdges(); updateToolUi(); if (st.showRels) toast('Relacionamentos: * é o lado muitos, 1 é o lado um. Tracejado é inativo.'); });
  $('#dictXlsx').addEventListener('click', () => { closeMenu(); exportDictXlsx(); });
  $('#dictMd').addEventListener('click', () => { closeMenu(); exportDictMd(); });
  $('#expPng').addEventListener('click', () => { closeMenu(); exportPng(); });
  $('#expSvg').addEventListener('click', () => { closeMenu(); exportSvg(); });
  $('#saveDraw').addEventListener('click', () => { closeMenu(); saveDrawing(); });
  $('#openDraw').addEventListener('click', () => { closeMenu(); $('#file3').click(); });
  $('#file3').addEventListener('change', e => { const f = e.target.files[0]; if (f) openDrawing(f); e.target.value = ''; });
  $('#btnHelp').addEventListener('click', () => startTour());
  document.querySelectorAll('#views [data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#bpRules').addEventListener('click', e => { const b = e.target.closest('[data-rule]'); if (!b || b.disabled) return; st.bpRule = b.dataset.rule; renderBp(); });
  $('#bpq').addEventListener('input', () => renderBpList());
  $('#bpList').addEventListener('click', e => {
    const t = e.target.closest('[data-bptoggle]'); if (t) { const nm = t.dataset.bptoggle; if (st.bpOpen.has(nm)) st.bpOpen.delete(nm); else st.bpOpen.add(nm); renderBpList(); return; }
    const g2 = e.target.closest('[data-goflow]'); if (g2) { setView('fluxo'); const id = g2.dataset.goflow; select(id, { reveal: true, keep: true }); if (g2.dataset.gocol) showColumn(st.g.N.get(id).label, g2.dataset.gocol); }
  });
  $('#tourNext').addEventListener('click', () => tourGo(1));
  $('#tourPrev').addEventListener('click', () => tourGo(-1));
  $('#tourSkip').addEventListener('click', endTour);
  document.addEventListener('keydown', e => { if ($('#tour').hidden) return; if (e.key === 'Escape') { e.stopImmediatePropagation(); endTour(); } else if (e.key === 'ArrowRight') tourGo(1); else if (e.key === 'ArrowLeft') tourGo(-1); }, true);
  addEventListener('resize', () => { if (!$('#tour').hidden) tourShow(); });
  addEventListener('resize', () => { if (st.g) applyView(); });
}
function isolate() {
  let F = null;
  if (st.selSet.size) { computeFocus(); F = new Set(st.focusF); }
  else if (st.flagIds) { F = new Set(st.flagIds); }
  if (!F || !F.size) { toast('Selecione um ou mais blocos antes de isolar.'); return; }
  if (!st.iso) st.viewBefore = Object.assign({}, st.view);
  st.iso = F; st.isoPos = {}; st.flag = null; st.flagIds = null;
  render(); fit();
  updateIsoUi(); refreshPanel();
}
function exitIso(silent) {
  if (!st.iso) return;
  st.iso = null; st.isoPos = {};
  render();
  if (!silent) { if (st.viewBefore) { st.view = st.viewBefore; applyView(); } else fit(null, true); }
  updateIsoUi(); refreshPanel();
}
function refreshPanel() {
  if (!panelOpen()) return;
  if (st.panelMode === 'node' && st.sel) showPanel(st.sel);
  else if (st.selSet.size > 1 && st.panelMode !== 'diag' && st.panelMode !== 'cmp') showMulti();
}
function updateIsoUi() {
  const on = !!st.iso;
  $('#isobar').hidden = !on;
  if (on) $('#isotxt').textContent = 'Mostrando só o caminho isolado: ' + visibleNodes().length + ' blocos.';
  $('#btnIso').textContent = on ? 'Mostrar tudo' : 'Isolar';
  $('#btnIso').setAttribute('aria-pressed', on);
  $('#btnFold').disabled = on;
  $('#btnIso').disabled = on ? false : !(st.selSet.size || st.flagIds);
}
function closeMenu() { const d = $('#more'); if (d) d.open = false; }
document.addEventListener('pointerdown', e => { const d = $('#more'); if (d && d.open && !e.target.closest('#more')) d.open = false; });
