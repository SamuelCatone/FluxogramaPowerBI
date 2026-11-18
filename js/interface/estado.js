/* Fluxo do Power BI · constantes, estado da tela e salvamento no navegador */
/* ===== UI ===== */
const W = 248, H = 60, MW = 226, MH = 44, GAPY = 14, COLW = 350;
const COLS = { origem: 0, consulta: 1, tabela: 2, pasta: 3, medida: 3, pagina: 4, visual: 4 };
const HEADS = ['Origens', 'Consultas do Power Query', 'Tabelas do modelo', 'Medidas', 'Páginas e visuais'];
const TYPE_NAMES = { origem: 'Origem', consulta: 'Consulta', tabela: 'Tabela', pasta: 'Pasta de medidas', medida: 'Medida', pagina: 'Página', visual: 'Visual' };
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const st = { g: null, file: '', key: '', pos: {}, auto: {}, notes: [], exp: new Set(), showAuto: false, sel: null, selSet: new Set(), diag: [], panelMode: '', manual: false, linkHover: null, linkPop: false, linkMid: {}, undo: null, colSel: null, bp: null, mode: 'fluxo', bpRule: 'all', bpOpen: new Set(), pexp: new Set(), checks: {}, flag: null, flagIds: null, iso: null, isoPos: {}, viewBefore: null, cur: null, cmp: null, arrows: [], frames: [], tool: 'select', selArrow: null, showRels: false, focusF: null, view: { x: 60, y: 120, k: 0.7 }, search: '', fwd: new Map(), back: new Map() };

/* ---------- persistência (só neste navegador) ---------- */
function save() {
  if (!st.key) return;
  try { localStorage.setItem(st.key, JSON.stringify(drawingState())); } catch (e) {}
}
function restore() {
  try {
    const r = JSON.parse(localStorage.getItem(st.key) || 'null');
    if (r) { applyDrawing(r); return true; }
  } catch (e) {}
  return false;
}

function drawingState() {
  return { pos: st.pos, notes: st.notes.map(n => ({ id: n.id, x: n.x, y: n.y, text: n.text })), exp: [...st.exp], showAuto: st.showAuto,
    arrows: st.arrows, frames: st.frames.map(({ _t, ...f }) => f), showRels: st.showRels, pexp: [...st.pexp], checks: st.checks,
    ...(st.manual ? { manual: true, name: st.file, nodes: [...st.g.N.values()].map(n => ({ id: n.id, type: n.type, label: n.label, sub: n.sub || '', notes: n.data.notes || '' })), links: st.g.L.map(l => ({ s: l.s, t: l.t })) } : {}) };
}
/* tudo que vem de arquivo ou do armazenamento passa por aqui antes de virar HTML */
const safeId = (v, p) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v)) ? v : p + Math.random().toString(36).slice(2, 10);
const num = (v, d = 0) => { const n = Number(v); return isFinite(n) ? Math.round(n) : d; };
// ids repetidos num .json fariam excluir vários itens de uma vez
const uniq = () => { const s = new Set(); return x => !s.has(x.id) && !!s.add(x.id); };
function cleanDrawing(r) {
  r = r && typeof r === 'object' ? r : {}; const out = Object.assign({}, r);
  const pos = Object.create(null); if (r.pos && typeof r.pos === 'object') Object.keys(r.pos).forEach(k => { const p = r.pos[k]; if (p && typeof p === 'object') pos[k] = { x: num(p.x), y: num(p.y) }; }); out.pos = pos;
  out.notes = (Array.isArray(r.notes) ? r.notes : []).filter(n => n && typeof n === 'object').map(n => ({ id: safeId(n.id, 'n'), x: num(n.x), y: num(n.y), text: String(n.text == null ? '' : n.text) })).filter(uniq());
  out.frames = (Array.isArray(r.frames) ? r.frames : []).filter(f => f && typeof f === 'object').map(f => ({ id: safeId(f.id, 'f'), x: num(f.x), y: num(f.y), w: Math.max(120, num(f.w, 300)), h: Math.max(80, num(f.h, 200)), title: String(f.title == null ? 'Nova área' : f.title), c: FRAME_COLORS.includes(f.c) ? f.c : 'c4' })).filter(uniq());
  const ref = x => x && typeof x === 'object' && (x.t === 'node' || x.t === 'note') && typeof x.id === 'string' ? { t: x.t, id: x.id } : null;
  out.arrows = (Array.isArray(r.arrows) ? r.arrows : []).filter(a => a && typeof a === 'object').map(a => ({ id: safeId(a.id, 'a'), from: ref(a.from), to: ref(a.to), label: String(a.label == null ? '' : a.label) })).filter(a => a.from && a.to).filter(uniq());
  out.exp = Array.isArray(r.exp) ? r.exp.map(String) : []; out.pexp = Array.isArray(r.pexp) ? r.pexp.map(String) : [];
  if (r.checks && typeof r.checks === 'object') { const c = {}; Object.keys(r.checks).forEach(k => { const v = r.checks[k]; if (v && ['vou', 'resolvido', 'ignorar'].includes(v.s)) c[k] = { s: v.s, em: typeof v.em === 'string' ? v.em : '', t: String(v.t || k), sev: ['alta', 'media', 'baixa'].includes(v.sev) ? v.sev : 'baixa' }; }); out.checks = c; } else out.checks = null;
  const TYPES = ['origem', 'consulta', 'tabela', 'medida', 'pagina', 'visual']; const seen = new Set();
  out.nodes = (Array.isArray(r.nodes) ? r.nodes : []).filter(n => n && TYPES.includes(n.type)).map(n => ({ id: safeId(n.id, 'c'), type: n.type, label: String(n.label == null ? 'Card' : n.label), sub: String(n.sub == null ? '' : n.sub), notes: String(n.notes == null ? '' : n.notes) })).filter(n => !seen.has(n.id) && seen.add(n.id));
  out.links = (Array.isArray(r.links) ? r.links : []).filter(l => l && typeof l.s === 'string' && typeof l.t === 'string' && l.s !== l.t).map(l => ({ s: l.s, t: l.t }));
  out.name = String(r.name || 'Meu fluxo').slice(0, 120);
  return out;
}
function applyDrawing(r) {
  r = cleanDrawing(r);
  st.pos = r.pos || {}; st.notes = r.notes || []; st.exp = new Set(r.exp || []); st.showAuto = !!r.showAuto;
  st.arrows = Array.isArray(r.arrows) ? r.arrows : []; st.frames = Array.isArray(r.frames) ? r.frames : []; st.showRels = !!r.showRels;
  st.pexp = new Set(r.pexp || []);
  if (r.checks && typeof r.checks === 'object') st.checks = Object.assign({}, st.checks, r.checks);
}
/* checklist fica salvo pelo nome do arquivo, para seguir entre versões exportadas com o mesmo nome */
const checksKey = name => 'fluxo-pbi:checklist:' + String(name || '').replace(/\.pbit$/i, '').toLowerCase();
function loadChecks(name) { try { return JSON.parse(localStorage.getItem(checksKey(name)) || '{}') || {}; } catch (e) { return {}; } }
function saveChecks() { try { localStorage.setItem(checksKey(st.file), JSON.stringify(st.checks)); } catch (e) {} save(); }
