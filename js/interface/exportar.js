/* Fluxo do Power BI · exportar PNG/SVG e salvar ou abrir o desenho (.json) */
/* ---------- exportar imagem e desenho ---------- */
async function offerFile(filename, data) {
  let dl = null;
  try { if (window.claude && typeof window.claude.use === 'function') dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename, data }); toast('Arquivo salvo: ' + filename); }
    catch (e) { if (e && e.code === 'declined') return; toast(e && e.code === 'too_large' ? 'O arquivo ficou grande demais. Tente o formato SVG ou isole uma parte do canvas.' : 'Não foi possível salvar o arquivo aqui.'); }
    return;
  }
  const ext = (filename.match(/\.(\w+)$/) || [])[1]; const mime = { svg: 'image/svg+xml', json: 'application/json', md: 'text/markdown' }[ext];
  const blob = data instanceof Blob ? data : new Blob([data], mime ? { type: mime } : {});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function baseName() { return (st.file || 'modelo').replace(/\.pbit$/i, ''); }
let measureCtx = null;
function fitText(t, px, weight, maxW) {
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  measureCtx.font = `${weight} ${px}px "IBM Plex Sans", "Segoe UI", system-ui, sans-serif`;
  t = String(t || ''); if (measureCtx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && measureCtx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
function wrapText(t, px, maxW) {
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  measureCtx.font = `400 ${px}px "IBM Plex Sans", "Segoe UI", system-ui, sans-serif`;
  const lines = []; String(t || '').split('\n').forEach(par => {
    let line = ''; par.split(/\s+/).forEach(w => { const tryL = line ? line + ' ' + w : w; if (measureCtx.measureText(tryL).width > maxW && line) { lines.push(line); line = w; } else line = tryL; });
    lines.push(line);
  }); return lines;
}
function buildSvg() {
  const cs = getComputedStyle(document.documentElement); const v = n => cs.getPropertyValue(n).trim();
  const C = { paper: v('--paper'), grid: v('--grid'), ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), surface: v('--surface'), surface2: v('--surface-2'), line: v('--line'), edge: v('--edge'), warn: v('--warn'), warnbg: v('--warn-bg'), mute: v('--mute-bg'), hot: v('--hot'),
    c: [v('--c0'), v('--c1'), v('--c2'), v('--c3'), v('--c4')] };
  const typeColor = t => C.c[{ origem: 0, consulta: 1, tabela: 2, pasta: 3, medida: 3, pagina: 4, visual: 4 }[t]];
  const nodes = visibleNodes(); const Vf = focusVisible();
  let b = bbox(); if (!b) b = { x1: 0, y1: 0, x2: 100, y2: 100 };
  st.frames.forEach(f => { if (st.iso) return; b.x1 = Math.min(b.x1, f.x); b.y1 = Math.min(b.y1, f.y - 40); b.x2 = Math.max(b.x2, f.x + f.w); b.y2 = Math.max(b.y2, f.y + f.h); });
  const pad = 40; const X = b.x1 - pad, Y = b.y1 - pad, SW = Math.ceil(b.x2 - b.x1 + pad * 2), SH = Math.ceil(b.y2 - b.y1 + pad * 2);
  const F = `font-family='"IBM Plex Sans","Segoe UI",system-ui,sans-serif'`;
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="${X} ${Y} ${SW} ${SH}">`);
  o.push(`<defs><pattern id="g" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="${C.grid}" stroke-width="1"/></pattern>
    <marker id="a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1,1 L7,4 L1,7" fill="none" stroke="${C.edge}" stroke-width="1.4"/></marker>
    <marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1,1 L7,4 L1,7" fill="none" stroke="${C.hot}" stroke-width="1.4"/></marker>
    <marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1,1 L7,4 L1,7" fill="none" stroke="${C.c[2]}" stroke-width="1.6"/></marker>
    <marker id="au" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M1,1 L9,5 L1,9 Z" fill="${C.c[4]}"/></marker></defs>`);
  o.push(`<rect x="${X}" y="${Y}" width="${SW}" height="${SH}" fill="${C.paper}"/><rect x="${X}" y="${Y}" width="${SW}" height="${SH}" fill="url(#g)"/>`);
  if (st.manual && !st.iso) { let maxY = 0; for (const n of st.g.N.values()) maxY = Math.max(maxY, pos(n.id).y + nodeH(n)); const lh = Math.max(560, maxY + 120);
    [0, 1, 2, 3, 4].forEach(i => o.push(`<rect x="${i * COLW - 18}" y="-20" width="${W + 36}" height="${lh}" rx="12" fill="${C.c[i]}" fill-opacity="0.04" stroke="${C.c[i]}" stroke-opacity="0.35" stroke-dasharray="6 5"/>`)); }
  if (!st.iso) st.frames.forEach(f => {
    const fc = f.c === 'mute' ? C.ink3 : C.c[['c0', 'c1', 'c2', 'c3', 'c4'].indexOf(f.c)] || C.c[4];
    o.push(`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="10" fill="${fc}" fill-opacity="0.06" stroke="${fc}" stroke-width="1.5"/><text x="${f.x + 6}" y="${f.y - 12}" ${F} font-size="16" font-weight="600" fill="${fc}">${esc(f.title)}</text>`);
  });
  const heads = [...$('#heads').children];
  heads.forEach((h, i) => { o.push(`<rect x="${i * COLW}" y="-66" width="11" height="11" rx="3" fill="${C.c[i]}"/><text x="${i * COLW + 19}" y="-56" ${F} font-size="15" font-weight="600" fill="${C.ink}">${esc(h.childNodes[1] ? h.childNodes[1].textContent.trim() : '')} <tspan fill="${C.ink3}" font-weight="400">${esc(h.querySelector('.cnt') ? h.querySelector('.cnt').textContent : '')}</tspan></text>`); });
  edgeGeom().forEach(g => {
    if (g.kind === 'rel') { o.push(`<g opacity="${/dim/.test(g.state) ? 0.12 : 1}"><path d="${g.d}" fill="none" stroke="${C.c[2]}" stroke-width="${/hot/.test(g.state) ? 2.4 : 1.8}"${/inactive/.test(g.state) ? ' stroke-dasharray="6 5"' : ''} marker-end="url(#ar)"/><text x="${g.l1.x}" y="${g.l1.y}" ${F} font-size="12" font-weight="600" fill="${C.c[2]}">${g.l1.t}</text><text x="${g.l2.x}" y="${g.l2.y}" ${F} font-size="12" font-weight="600" fill="${C.c[2]}">${g.l2.t}</text></g>`); return; }
    const hot = g.state === 'hot'; const op = g.state === 'dim' ? 0.08 : g.state === 'faint' ? 0.18 : hot ? 1 : 0.75;
    const col = hot ? C.hot : g.kind === 'ref' ? C.c[1] : g.kind === 'dep' ? C.c[3] : C.edge;
    o.push(`<path d="${g.d}" fill="none" stroke="${col}" stroke-width="${hot ? 2 : 1.4}" stroke-opacity="${op}"${g.kind === 'ref' ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#${hot ? 'ah' : 'a'})"/>`);
  });
  nodes.forEach(n => {
    const p = pos(n.id), w = nodeW(n), h = nodeH(n), col = typeColor(n.type);
    const dim = (Vf && !Vf.has(n.id)) || (st.flag && !st.flag.has(n.id));
    const isM = isSmall(n);
    o.push(`<g opacity="${dim ? 0.22 : 1}"><rect x="${p.x}" y="${p.y}" width="${w}" height="${h}" rx="6" fill="${isM ? C.surface2 : C.surface}" stroke="${st.selSet.has(n.id) ? C.hot : C.line}" stroke-width="${st.selSet.has(n.id) ? 2 : 1}"${isM && n.data.unused ? ' stroke-dasharray="4 3"' : ''}/><rect x="${p.x}" y="${p.y}" width="${isM ? 3 : 5}" height="${h}" rx="1.5" fill="${col}"/>`);
    const tx = p.x + (isM ? 10 : 13);
    o.push(`<text x="${tx}" y="${p.y + (isM ? 17 : 22)}" ${F} font-size="${isM ? 12.5 : 13.5}" font-weight="${isM ? 500 : 600}" fill="${C.ink}">${esc(fitText(n.label, isM ? 12.5 : 13.5, isM ? 500 : 600, w - (n.type === 'pasta' ? 48 : 22)))}</text>`);
    let bx = p.x + w - 10 - (n.type === 'pasta' ? 30 : 0); const by = p.y + (isM ? 26 : 38);
    const badges = n.badges.slice().reverse(); let subMax = w - 26;
    badges.forEach(bd => {
      measureCtx = measureCtx || document.createElement('canvas').getContext('2d'); measureCtx.font = `400 11px "IBM Plex Sans","Segoe UI",sans-serif`;
      const bw = measureCtx.measureText(bd.t).width + 12; bx -= bw; if (isM) bx = Math.max(bx, tx);
      const bg = bd.k === 'warn' ? C.warnbg : bd.k === 'new' ? C.c[1] : bd.k === 'chg' ? C.c[4] : C.mute;
      const fg = bd.k === 'warn' ? C.warn : bd.k === 'new' ? C.c[1] : bd.k === 'chg' ? C.c[4] : C.ink2;
      const bxx = isM ? tx + (badges.length > 1 ? 0 : 0) : bx;
      o.push(`<rect x="${bxx}" y="${by}" width="${bw}" height="16" rx="8" fill="${bg}"${bd.k === 'new' || bd.k === 'chg' ? ' fill-opacity="0.16"' : ''}/><text x="${bxx + 6}" y="${by + 11.5}" ${F} font-size="11" fill="${fg}">${esc(bd.t)}</text>`);
      if (isM) return; bx -= 6; subMax = bx - tx;
    });
    if (!isM && n.sub) o.push(`<text x="${tx}" y="${by + 12}" ${F} font-size="12" fill="${C.ink2}">${esc(fitText(n.sub, 12, 400, Math.max(30, subMax)))}</text>`);
    if (n.type === 'visual' && !badges.length) o.push(`<text x="${tx}" y="${by + 11}" ${F} font-size="11" fill="${C.ink2}">${esc(fitText(n.sub, 11, 400, w - 22))}</text>`);
    o.push('</g>');
  });
  if (!st.iso) st.notes.forEach(n => {
    const lines = wrapText(n.text || '', 13, 200); const h = Math.max(70, 34 + lines.length * 19);
    o.push(`<rect x="${n.x}" y="${n.y}" width="220" height="${h}" rx="4" fill="#FFF6CC" stroke="#E8D88A"/><text x="${n.x + 9}" y="${n.y + 16}" ${F} font-size="11.5" fill="#7A6B2E">Anotação</text>`);
    lines.forEach((l, i) => o.push(`<text x="${n.x + 9}" y="${n.y + 40 + i * 19}" ${F} font-size="13" fill="#3B3420">${esc(l)}</text>`));
  });
  arrowGeom().forEach(g => {
    o.push(`<line x1="${g.p1.x}" y1="${g.p1.y}" x2="${g.p2.x}" y2="${g.p2.y}" stroke="${C.c[4]}" stroke-width="2.2" marker-end="url(#au)"/>`);
    if (g.a.label) { const tw = fitText(g.a.label, 12.5, 500, 400); measureCtx.font = `500 12.5px "IBM Plex Sans","Segoe UI",sans-serif`; const ww = measureCtx.measureText(tw).width + 14;
      o.push(`<rect x="${g.mid.x - ww / 2}" y="${g.mid.y - 11}" width="${ww}" height="22" rx="11" fill="${C.surface}" stroke="${C.c[4]}"/><text x="${g.mid.x}" y="${g.mid.y + 4.5}" text-anchor="middle" ${F} font-size="12.5" font-weight="500" fill="${C.c[4]}">${esc(tw)}</text>`); }
  });
  o.push('</svg>');
  return { svg: o.join('\n').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''), W: SW, H: SH };
}
async function exportSvg() { const { svg } = buildSvg(); await offerFile(baseName() + ' - fluxo.svg', svg); }
async function exportPng() {
  const { svg, W, H } = buildSvg();
  let scale = 2; const maxSide = 16000, maxPx = 16e6;
  scale = Math.min(scale, maxSide / W, maxSide / H, Math.sqrt(maxPx / (W * H)));
  const img = new Image(); const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  toast('Gerando a imagem…');
  try {
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const cv = document.createElement('canvas'); cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
    const ctx = cv.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, W, H);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png')); if (!blob) throw new Error('canvas');
    await offerFile(baseName() + ' - fluxo.png', blob);
  } catch (e) { console.error(e); toast('Não consegui gerar o PNG. Tente exportar em SVG.'); }
  finally { URL.revokeObjectURL(url); }
}
async function saveDrawing() {
  const data = Object.assign({ app: 'fluxo-power-bi', versao: 1, arquivo: st.file, salvoEm: new Date().toISOString() }, drawingState());
  await offerFile(baseName() + ' - desenho.json', JSON.stringify(data, null, 2));
}
async function openDrawing(file) {
  try {
    const r = JSON.parse(await file.text());
    if (r.app !== 'fluxo-power-bi') throw new Error('formato');
    if (r.manual) { if (!st.manual && savedManual() && !confirm('Isso substitui o fluxo próprio salvo neste navegador. Continuar?')) return; openManual(r); save(); toast('Fluxo aberto: ' + (r.name || 'Meu fluxo') + '.'); return; }
    if (!st.g || st.manual) throw new Error('precisa-pbit');
    applyDrawing(r); st.isoPos = {}; save(); render(); fit(null, true);
    toast(r.arquivo && r.arquivo !== st.file ? 'Desenho aplicado. Ele foi feito para ' + r.arquivo + '; blocos que não existem aqui foram ignorados.' : 'Desenho aplicado.');
  } catch (e) { toast(e.message === 'precisa-pbit' ? 'Este desenho é de um .pbit. Abra o .pbit primeiro e depois aplique o desenho.' : 'Este arquivo não é um desenho salvo pelo Fluxo do Power BI.'); }
}
