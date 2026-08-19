/* Faida - automa cellulare a relazioni arbitrarie
   M[a][d] = probabilita' (0-100) che un vicino di colore `a` converta una cella di colore `d`.
   La ruota ciclica dell'originale e' solo uno degli schemi possibili. */
(() => {
'use strict';

const MAXN = 12;
const WALL = 12;          // stato speciale: non attacca, non e' attaccabile
const NSTATE = MAXN + 1;  // 0..11 colori + muro
const LEVELS = 6;         // livelli di dissolvenza precalcolati

const $ = (id) => document.getElementById(id);

/* ---------------------------------------------------------------- stato */
const S = {
  n: 8,
  colors: [],
  M: new Uint8Array(MAXN * MAXN),
  size: 80,
  w: 80, h: 80,
  grid: null, next: null, prev: null,
  neigh8: false,
  wrap: true,
  fade: true,
  stopOnStasis: true,
  speed: 20,
  running: false,
  step: 0,
  churn: 0,
  brush: 0,
  brushSize: 3,
  selA: 0, selB: 1,
};

/* ------------------------------------------------------------ tavolozza */
const HUE_NAMES = [
  [18,'Rosso'],[52,'Arancio'],[70,'Giallo'],[100,'Lime'],[145,'Verde'],
  [172,'Smeraldo'],[196,'Ciano'],[218,'Turchese'],[250,'Blu'],[300,'Viola'],
  [325,'Magenta'],[361,'Rosa']
];
function hueName(h){ for(const [lim,nm] of HUE_NAMES) if(h < lim) return nm; return 'Rosso'; }

function hsl2hex(h,s,l){
  s/=100; l/=100;
  const k = n => (n + h/30) % 12;
  const a = s * Math.min(l, 1-l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)))));
  return '#' + [f(0),f(8),f(4)].map(v => v.toString(16).padStart(2,'0')).join('');
}
function defaultPalette(n){
  const out = [];
  const used = {};
  for(let i=0;i<n;i++){
    const h = Math.round(i*360/n);
    let nm = hueName(h);
    if(used[nm]) nm += ' ' + (++used[nm]); else used[nm] = 1;
    out.push({ name: nm, hex: hsl2hex(h, 82, 56) });
  }
  return out;
}
const WALL_HEX = '#6b7280';

/* --------------------------------------------------------- colori a 32b */
let pal32 = new Uint32Array(NSTATE);
let mixLUT = new Uint32Array(LEVELS * NSTATE * NSTATE);
function hexRGB(hex){
  const v = parseInt(hex.slice(1), 16);
  return [(v>>16)&255, (v>>8)&255, v&255];
}
function buildPalette(){
  const rgb = [];
  for(let i=0;i<MAXN;i++){
    const c = S.colors[i];
    rgb.push(c ? hexRGB(c.hex) : [24,26,30]);
  }
  rgb.push(hexRGB(WALL_HEX));
  for(let i=0;i<NSTATE;i++){
    const [r,g,b] = rgb[i];
    pal32[i] = (255<<24) | (b<<16) | (g<<8) | r;   // little endian ABGR
  }
  for(let L=0;L<LEVELS;L++){
    const t = (L+1)/LEVELS;
    for(let p=0;p<NSTATE;p++){
      for(let c=0;c<NSTATE;c++){
        const [pr,pg,pb] = rgb[p], [cr,cg,cb] = rgb[c];
        const r = (pr + (cr-pr)*t)|0, g = (pg + (cg-pg)*t)|0, b = (pb + (cb-pb)*t)|0;
        mixLUT[(L*NSTATE + p)*NSTATE + c] = (255<<24) | (b<<16) | (g<<8) | r;
      }
    }
  }
}

/* ------------------------------------------------------------- il mondo */
const MAXCELLS = 130000;

// lo spazio davvero disponibile per il mondo, al netto del padding
function worldBox(){
  const st = $('stage');
  const cs = getComputedStyle(st);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  return {
    W: Math.max(60, st.clientWidth  - padX),
    H: Math.max(60, st.clientHeight - padY)
  };
}
// il mondo non e' quadrato: prende la forma dello spazio che ha.
// `size` e' il numero di caselle sul lato corto.
function gridDims(size){
  const { W, H } = worldBox();
  let w, h;
  if(W <= H){ w = size; h = Math.round(size * H / W); }
  else      { h = size; w = Math.round(size * W / H); }
  while(w*h > MAXCELLS){ w = Math.max(8, (w*0.92)|0); h = Math.max(8, (h*0.92)|0); }
  return [Math.max(8,w), Math.max(8,h)];
}

let off, offCtx, offImg, offBuf;
function allocWorld(size, keep){
  const old = S.grid, ow = S.w, oh = S.h;
  const [w, h] = gridDims(size);
  S.w = w; S.h = h; S.size = size;
  const len = w*h;
  S.grid = new Uint8Array(len);
  S.next = new Uint8Array(len);
  S.prev = new Uint8Array(len);
  if(keep && old){
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        S.grid[y*w+x] = (x<ow && y<oh) ? old[y*ow+x] : (Math.random()*S.n)|0;
      }
    }
    S.prev.set(S.grid);
  } else {
    seed();
  }
  off = document.createElement('canvas');
  off.width = w; off.height = h;
  offCtx = off.getContext('2d');
  offImg = offCtx.createImageData(w, h);
  offBuf = new Uint32Array(offImg.data.buffer);
}
function seed(){
  const g = S.grid, n = S.n;
  for(let i=0;i<g.length;i++) g[i] = (Math.random()*n)|0;
  S.prev.set(g);
  S.step = 0; S.churn = 0; stasisRun = 0;
}

/* ---------------------------------------------------------- simulazione */
const atkS = new Uint8Array(8), atkP = new Uint8Array(8);

function doStep(){
  const { w, h, grid, next, M, n, wrap } = S;
  const d8 = S.neigh8;
  next.set(grid);
  let changed = 0;

  for(let y=0; y<h; y++){
    const yUp = y>0 ? y-1 : (wrap ? h-1 : -1);
    const yDn = y<h-1 ? y+1 : (wrap ? 0 : -1);
    for(let x=0; x<w; x++){
      const i = y*w + x;
      const d = grid[i];
      if(d === WALL) continue;

      const xLf = x>0 ? x-1 : (wrap ? w-1 : -1);
      const xRt = x<w-1 ? x+1 : (wrap ? 0 : -1);

      let cnt = 0, survive = 1;
      // --- vicinato di von Neumann
      if(xLf >= 0){ const s = grid[y*w+xLf];   if(s !== WALL){ const p = M[s*MAXN+d]; if(p){ atkS[cnt]=s; atkP[cnt++]=p; survive *= 1 - p/100; } } }
      if(xRt >= 0){ const s = grid[y*w+xRt];   if(s !== WALL){ const p = M[s*MAXN+d]; if(p){ atkS[cnt]=s; atkP[cnt++]=p; survive *= 1 - p/100; } } }
      if(yUp >= 0){ const s = grid[yUp*w+x];   if(s !== WALL){ const p = M[s*MAXN+d]; if(p){ atkS[cnt]=s; atkP[cnt++]=p; survive *= 1 - p/100; } } }
      if(yDn >= 0){ const s = grid[yDn*w+x];   if(s !== WALL){ const p = M[s*MAXN+d]; if(p){ atkS[cnt]=s; atkP[cnt++]=p; survive *= 1 - p/100; } } }
      // --- diagonali
      if(d8){
        if(xLf>=0 && yUp>=0){ const s = grid[yUp*w+xLf]; if(s !== WALL){ const p = M[s*MAXN+d]; if(p){ atkS[cnt]=s; atkP[cnt++]=p; survive *= 1 - p/100; } } }
        if(xRt>=0 && yUp>=0){ const s = grid[yUp*w+xRt]; if(s !== WALL){ const p = M[s*MAXN+d]; if(p){ atkS[cnt]=s; atkP[cnt++]=p; survive *= 1 - p/100; } } }
        if(xLf>=0 && yDn>=0){ const s = grid[yDn*w+xLf]; if(s !== WALL){ const p = M[s*MAXN+d]; if(p){ atkS[cnt]=s; atkP[cnt++]=p; survive *= 1 - p/100; } } }
        if(xRt>=0 && yDn>=0){ const s = grid[yDn*w+xRt]; if(s !== WALL){ const p = M[s*MAXN+d]; if(p){ atkS[cnt]=s; atkP[cnt++]=p; survive *= 1 - p/100; } } }
      }
      if(cnt === 0) continue;
      if(survive > 0 && Math.random() < survive) continue;   // il difensore regge

      let tot = 0;
      for(let k=0;k<cnt;k++) tot += atkP[k];
      let r = Math.random() * tot, win = atkS[0];
      for(let k=0;k<cnt;k++){ r -= atkP[k]; if(r <= 0){ win = atkS[k]; break; } }
      if(win !== d){ next[i] = win; changed++; }
    }
  }

  const t = S.prev; S.prev = S.grid; S.grid = next; S.next = t;
  S.step++; S.churn = changed;
  return changed;
}

/* ------------------------------------------------------------ rendering */
const cv = $('board');
const ctx = cv.getContext('2d', { alpha: false });
let needsDraw = true;

function fitSheet(){
  const bar = $('bar').getBoundingClientRect();
  document.documentElement.style.setProperty('--barH', Math.round(bar.height) + 'px');
}
function fitCanvas(){
  fitSheet();
  const { W, H } = worldBox();
  const scale = Math.min(W / S.w, H / S.h);
  const cssW = Math.max(60, Math.floor(S.w * scale));
  const cssH = Math.max(60, Math.floor(S.h * scale));
  cv.style.width = cssW + 'px';
  cv.style.height = cssH + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.floor(cssW * dpr);
  cv.height = Math.floor(cssH * dpr);
  ctx.imageSmoothingEnabled = false;
  needsDraw = true;
}
// il mondo segue la forma della finestra: se cambia molto, si rialloca tenendo il contenuto
function relayout(){
  const [w, h] = gridDims(S.size);
  if(w !== S.w || h !== S.h) allocWorld(S.size, true);
  fitCanvas();
}

function render(t){
  const g = S.grid, p = S.prev, len = g.length;
  if(S.fade && t < 1){
    const L = Math.min(LEVELS-1, Math.max(0, (t*LEVELS)|0));
    const base = L * NSTATE * NSTATE;
    for(let i=0;i<len;i++){
      const c = g[i], q = p[i];
      offBuf[i] = (c === q) ? pal32[c] : mixLUT[base + q*NSTATE + c];
    }
  } else {
    for(let i=0;i<len;i++) offBuf[i] = pal32[g[i]];
  }
  offCtx.putImageData(offImg, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, S.w, S.h, 0, 0, cv.width, cv.height);
}

/* ------------------------------------------------------------ statistiche */
const counts = new Int32Array(NSTATE);
let lastStatsAt = 0;
function updateStats(now){
  counts.fill(0);
  const g = S.grid;
  for(let i=0;i<g.length;i++) counts[g[i]]++;
  const total = g.length - counts[WALL];
  let alive = 0;
  for(let i=0;i<S.n;i++) if(counts[i] > 0) alive++;

  $('statStep').textContent = S.step;
  $('statChurn').textContent = total ? (100*S.churn/total).toFixed(0) + '%' : '—';
  $('statAlive').textContent = alive + '/' + S.n;

  const pop = $('pop');
  while(pop.children.length < S.n) pop.appendChild(document.createElement('i'));
  while(pop.children.length > S.n) pop.removeChild(pop.lastChild);
  for(let i=0;i<S.n;i++){
    const el = pop.children[i];
    el.style.background = S.colors[i].hex;
    el.style.width = (total ? 100*counts[i]/total : 0) + '%';
  }
  lastStatsAt = now;
}

/* ------------------------------------------------------------- il ciclo */
let acc = 0, lastT = 0, stasisRun = 0, stoppedByStasis = false;
function frame(now){
  if(!lastT) lastT = now;
  let dt = now - lastT; lastT = now;
  if(dt > 250) dt = 250;

  const per = 1000 / S.speed;
  let stepped = false;
  if(S.running){
    acc += dt;
    let guard = 0;
    while(acc >= per && guard < 6){
      acc -= per;
      const ch = doStep();
      stepped = true;
      guard++;
      if(S.stopOnStasis){
        if(ch === 0){ if(++stasisRun >= 2){ setRunning(false); stoppedByStasis = true; toast('Quiete: nessuno si muove più'); break; } }
        else stasisRun = 0;
      }
    }
    if(acc > per*6) acc = 0;
  }

  if(S.running || stepped || needsDraw || S.fade){
    render(S.running ? Math.min(1, acc/per) : 1);
    needsDraw = false;
  }
  if(stepped || now - lastStatsAt > 220) updateStats(now);
  requestAnimationFrame(frame);
}

function setRunning(v){
  S.running = v;
  if(v) stoppedByStasis = false;
  acc = 0;
  const b = $('btnPlay');
  b.querySelector('i').innerHTML = v ? '&#10074;&#10074;' : '&#9654;';
  b.querySelector('span').textContent = v ? 'pausa' : 'avvia';
  if(v) stasisRun = 0;
}

// se si era fermata da sola nella quiete, un mondo nuovo la fa ripartire;
// una pausa chiesta dall'utente invece si rispetta
function wakeIfStalled(){ if(stoppedByStasis && !S.running) setRunning(true); }

let toastTimer = 0;
function toast(msg){
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1900);
}

/* --------------------------------------------------------- gli schemi */
function clearM(){ S.M.fill(0); }
function setM(a,d,p){ if(a!==d && a<S.n && d<S.n) S.M[a*MAXN+d] = p; }
function getM(a,d){ return S.M[a*MAXN+d]; }

const PRESETS = {
  wheel(){ clearM(); for(let i=0;i<S.n;i++) setM(i,(i+1)%S.n,100); },
  double(){ clearM(); for(let i=0;i<S.n;i++){ setM(i,(i+1)%S.n,100); setM(i,(i+2)%S.n,100); } },
  rps(){ setN(3); clearM(); for(let i=0;i<3;i++) setM(i,(i+1)%3,100); },
  rpsls(){ setN(5); clearM(); for(let i=0;i<5;i++){ setM(i,(i+1)%5,100); setM(i,(i+2)%5,100); } },
  hierarchy(){ clearM(); for(let i=0;i<S.n;i++) for(let j=i+1;j<S.n;j++) setM(i,j,100); },
  factions(){
    clearM();
    const half = Math.ceil(S.n/2);
    for(let i=0;i<S.n;i++) for(let j=0;j<S.n;j++){
      if((i<half) !== (j<half)) setM(i,j,70);
    }
  },
  mutual(){ clearM(); for(let i=0;i<S.n;i++) for(let j=0;j<S.n;j++) if(i!==j) setM(i,j,45); },
  random(){
    clearM();
    for(let i=0;i<S.n;i++) for(let j=i+1;j<S.n;j++){
      const r = Math.random();
      const p = 25 + ((Math.random()*4)|0)*25;   // 25 50 75 100
      if(r < 0.34) { /* indifferenti */ }
      else if(r < 0.62) setM(i,j,p);
      else if(r < 0.90) setM(j,i,p);
      else { setM(i,j,p); setM(j,i,25 + ((Math.random()*3)|0)*25); }
    }
  },
  empty(){ clearM(); }
};

/* ------------------------------------------------------------- matrice */
function buildMatrix(){
  const box = $('matrix');
  const n = S.n;
  box.style.gridTemplateColumns = `repeat(${n+1}, 1fr)`;
  box.innerHTML = '';
  const frag = document.createDocumentFragment();

  const corner = document.createElement('div');
  corner.className = 'mc hd corner';
  corner.innerHTML = '&#9876;';
  corner.title = 'la riga attacca la colonna';
  frag.appendChild(corner);

  for(let d=0; d<n; d++) frag.appendChild(headCell(d));

  for(let a=0; a<n; a++){
    frag.appendChild(headCell(a));
    for(let d=0; d<n; d++){
      const cell = document.createElement('div');
      cell.className = 'mc';
      cell.dataset.a = a; cell.dataset.d = d;
      if(a === d){
        cell.classList.add('diag');
        cell.textContent = '–';
      } else {
        const fill = document.createElement('span');
        fill.className = 'fill';
        const num = document.createElement('span');
        num.className = 'num';
        cell.appendChild(fill); cell.appendChild(num);
      }
      frag.appendChild(cell);
    }
  }
  box.appendChild(frag);
  paintMatrix();
}
function headCell(i){
  const el = document.createElement('div');
  el.className = 'mc hd';
  el.title = S.colors[i].name;
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = S.colors[i].hex;
  el.appendChild(dot);
  return el;
}
function paintMatrix(){
  const box = $('matrix');
  for(const cell of box.querySelectorAll('.mc[data-a]')){
    const a = +cell.dataset.a, d = +cell.dataset.d;
    cell.classList.toggle('sel', a === S.selA && d === S.selB);
    cell.classList.toggle('selpair', a === S.selB && d === S.selA);
    if(a === d) continue;
    const p = getM(a,d);
    const fill = cell.firstChild, num = cell.lastChild;
    fill.style.background = S.colors[a].hex;
    fill.style.opacity = p ? (0.16 + 0.84*p/100).toFixed(2) : '0';
    num.textContent = (p > 0 && p < 100) ? p : '';
  }
  // le pastiglie di intestazione seguono la tavolozza
  const heads = box.querySelectorAll('.mc.hd .dot');
  heads.forEach((dot, k) => { dot.style.background = S.colors[k % S.n].hex; });
}

/* -------------------------------------------------------------- duello */
function verdictText(a, b, A, B){
  const na = S.colors[A].name, nb = S.colors[B].name;
  if(!a && !b) return 'Indifferenti: si sfiorano e non succede nulla.';
  if(a && !b) return `<b>${na}</b> conquista <b>${nb}</b>` + (a === 100 ? ' a ogni contatto.' : ` nel ${a}% dei contatti.`);
  if(!a && b) return `<b>${nb}</b> conquista <b>${na}</b>` + (b === 100 ? ' a ogni contatto.' : ` nel ${b}% dei contatti.`);
  if(a === b) return `Si divorano a vicenda, alla pari (${a}%).`;
  const [w, l, pw, pl] = a > b ? [na, nb, a, b] : [nb, na, b, a];
  return `Si divorano a vicenda: <b>${w}</b> ha la meglio (${pw}% contro ${pl}%).`;
}
function refreshDuel(){
  const A = S.selA, B = S.selB;
  const ab = getM(A,B), ba = getM(B,A);
  const ca = S.colors[A], cb = S.colors[B];

  const chipA = $('duelA'), chipB = $('duelB');
  chipA.querySelector('.sw').style.background = ca.hex;
  chipA.querySelector('b').textContent = ca.name;
  chipB.querySelector('.sw').style.background = cb.hex;
  chipB.querySelector('b').textContent = cb.name;

  $('labAB').textContent = `${ca.name} → ${cb.name}`;
  $('labBA').textContent = `${cb.name} → ${ca.name}`;
  $('rngAB').value = ab; $('outAB').textContent = ab + '%';
  $('rngBA').value = ba; $('outBA').textContent = ba + '%';
  $('duelVerdict').innerHTML = '<span>' + verdictText(ab, ba, A, B) + '</span>';
}
function selectPair(a, d){
  if(a === d) return;
  S.selA = a; S.selB = d;
  paintMatrix(); paintPicks(); refreshDuel();
}
function pickCols(n){
  if(n <= 6) return n;
  return Math.min(6, Math.ceil(n/2));
}
function buildPicks(){
  const cols = pickCols(S.n);
  for(const [box, sel] of [[$('pickA'),'selA'], [$('pickB'),'selB']]){
    box.innerHTML = '';
    box.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    for(let i=0;i<S.n;i++){
      const b = document.createElement('button');
      b.className = 'pk';
      b.dataset.i = i;
      b.title = S.colors[i].name;
      b.setAttribute('aria-label', S.colors[i].name);
      b.innerHTML = `<span class="sw" style="background:${S.colors[i].hex}"></span>`;
      box.appendChild(b);
    }
  }
  paintPicks();
}
function paintPicks(){
  for(const [box, cur, other] of [[$('pickA'), S.selA, S.selB], [$('pickB'), S.selB, S.selA]]){
    for(const b of box.children){
      const i = +b.dataset.i;
      b.classList.toggle('on', i === cur);
      b.classList.toggle('dim', i === other);
      const sw = b.firstChild;
      if(sw) sw.style.background = S.colors[i].hex;
    }
  }
}

/* ------------------------------------------------------ pennelli, tavolozza */
function buildBrushes(){
  const box = $('brushes');
  box.innerHTML = '';
  const mk = (val, name, hex) => {
    const b = document.createElement('button');
    b.className = 'bch' + (S.brush === val ? ' on' : '');
    b.dataset.brush = val;
    b.innerHTML = `<span class="sw" style="background:${hex}"></span><span>${name}</span>`;
    box.appendChild(b);
  };
  for(let i=0;i<S.n;i++) mk(i, S.colors[i].name, S.colors[i].hex);
  mk(WALL, 'Muro', WALL_HEX);
}
function buildPaletteUI(){
  const box = $('palette');
  box.innerHTML = '';
  for(let i=0;i<S.n;i++){
    const w = document.createElement('div');
    w.className = 'pch';
    w.style.background = S.colors[i].hex;
    w.innerHTML = `<input type="color" value="${S.colors[i].hex}" data-ci="${i}"><span>${S.colors[i].name}</span>`;
    box.appendChild(w);
  }
}

/* --------------------------------------------------------- disegno a dito */
function cellFromEvent(ev){
  const r = cv.getBoundingClientRect();
  const x = Math.floor((ev.clientX - r.left) / r.width  * S.w);
  const y = Math.floor((ev.clientY - r.top)  / r.height * S.h);
  if(x < 0 || y < 0 || x >= S.w || y >= S.h) return null;
  return [x, y];
}
function paintAt(x, y){
  const rad = S.brushSize - 1, g = S.grid, v = S.brush;
  for(let dy=-rad; dy<=rad; dy++){
    for(let dx=-rad; dx<=rad; dx++){
      if(dx*dx + dy*dy > rad*rad + rad) continue;
      let px = x+dx, py = y+dy;
      if(S.wrap){ px = (px + S.w) % S.w; py = (py + S.h) % S.h; }
      else if(px < 0 || py < 0 || px >= S.w || py >= S.h) continue;
      g[py*S.w + px] = v;
    }
  }
  S.prev.set(g);
  needsDraw = true;
}
let painting = false, lastCell = null;
cv.addEventListener('pointerdown', ev => {
  const c = cellFromEvent(ev);
  if(!c) return;
  painting = true; lastCell = c;
  cv.setPointerCapture(ev.pointerId);
  paintAt(c[0], c[1]);
  ev.preventDefault();
});
cv.addEventListener('pointermove', ev => {
  if(!painting) return;
  const c = cellFromEvent(ev);
  if(!c) return;
  // interpola fra l'ultimo punto e questo, cosi' il tratto non ha buchi
  if(lastCell){
    const [x0,y0] = lastCell, [x1,y1] = c;
    const steps = Math.max(Math.abs(x1-x0), Math.abs(y1-y0));
    for(let k=1; k<=steps; k++){
      paintAt(Math.round(x0 + (x1-x0)*k/steps), Math.round(y0 + (y1-y0)*k/steps));
    }
  }
  paintAt(c[0], c[1]);
  lastCell = c;
  ev.preventDefault();
});
const endPaint = () => { painting = false; lastCell = null; };
cv.addEventListener('pointerup', endPaint);
cv.addEventListener('pointercancel', endPaint);

/* ------------------------------------------------------------ persistenza */
const KEY = 'faida.v1';
function save(){
  try{
    localStorage.setItem(KEY, JSON.stringify({
      n: S.n, colors: S.colors, M: Array.from(S.M), size: S.size,
      neigh8: S.neigh8, wrap: S.wrap, fade: S.fade,
      stopOnStasis: S.stopOnStasis, speed: S.speed
    }));
  }catch(e){}
}
function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return false;
    const d = JSON.parse(raw);
    if(!d || !d.colors || !Array.isArray(d.M)) return false;
    S.n = Math.min(MAXN, Math.max(2, d.n|0 || 8));
    S.colors = d.colors.slice(0, S.n);
    while(S.colors.length < S.n) S.colors.push(defaultPalette(S.n)[S.colors.length]);
    S.M.set(d.M.slice(0, MAXN*MAXN));
    S.size = Math.min(240, Math.max(20, d.size|0 || 80));
    S.neigh8 = !!d.neigh8; S.wrap = d.wrap !== false;
    S.fade = d.fade !== false; S.stopOnStasis = d.stopOnStasis !== false;
    S.speed = Math.min(60, Math.max(1, d.speed|0 || 20));
    return true;
  }catch(e){ return false; }
}

/* ------------------------------------------------------------- controlli */
function setN(n){
  n = Math.min(MAXN, Math.max(2, n));
  if(n === S.n) return;
  S.n = n;
  S.colors = defaultPalette(n);
  // taglia le relazioni verso colori non piu' esistenti
  for(let a=0;a<MAXN;a++) for(let d=0;d<MAXN;d++) if(a>=n || d>=n) S.M[a*MAXN+d] = 0;
  if(S.selA >= n) S.selA = 0;
  if(S.selB >= n) S.selB = 1 % n;
  if(S.brush !== WALL && S.brush >= n) S.brush = 0;
  const g = S.grid;
  if(g) for(let i=0;i<g.length;i++) if(g[i] !== WALL && g[i] >= n) g[i] = (Math.random()*n)|0;
  buildPalette(); buildMatrix(); buildPicks(); refreshDuel(); buildBrushes(); buildPaletteUI();
  $('rngN').value = n; $('nColorsVal').textContent = n;
  needsDraw = true;
}

function openPanel(which){
  const map = { rules:['panelRules','Regole'], draw:['panelDraw','Disegna'], world:['panelWorld','Mondo'] };
  const cur = $('sheet').dataset.open;
  if(cur === which){ closePanel(); return; }
  $('sheet').hidden = false;
  $('sheet').dataset.open = which;
  $('sheetTitle').textContent = map[which][1];
  for(const k in map) $(map[k][0]).hidden = (k !== which);
  document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('on', b.dataset.panel === which));
}
function closePanel(){
  $('sheet').hidden = true;
  $('sheet').dataset.open = '';
  document.querySelectorAll('[data-panel]').forEach(b => b.classList.remove('on'));
}

function wire(){
  $('btnPlay').onclick = () => setRunning(!S.running);
  $('btnStep').onclick = () => { setRunning(false); doStep(); needsDraw = true; updateStats(performance.now()); };
  $('btnSeed').onclick = () => { seed(); wakeIfStalled(); needsDraw = true; toast('Mondo rimescolato'); };
  document.querySelectorAll('[data-panel]').forEach(b => b.onclick = () => openPanel(b.dataset.panel));
  $('sheetClose').onclick = closePanel;

  $('matrix').addEventListener('click', ev => {
    const cell = ev.target.closest('.mc[data-a]');
    if(!cell || cell.classList.contains('diag')) return;
    selectPair(+cell.dataset.a, +cell.dataset.d);
  });

  $('pickA').addEventListener('click', ev => {
    const b = ev.target.closest('.pk'); if(!b) return;
    const a = +b.dataset.i;
    selectPair(a, a === S.selB ? (a + 1) % S.n : S.selB);
  });
  $('pickB').addEventListener('click', ev => {
    const b = ev.target.closest('.pk'); if(!b) return;
    const d = +b.dataset.i;
    selectPair(d === S.selA ? (d + 1) % S.n : S.selA, d);
  });

  const onSlider = (which) => (ev) => {
    const v = +ev.target.value;
    if(which === 'ab') setM(S.selA, S.selB, v); else setM(S.selB, S.selA, v);
    paintMatrix(); refreshDuel(); save();
  };
  $('rngAB').addEventListener('input', onSlider('ab'));
  $('rngBA').addEventListener('input', onSlider('ba'));

  document.querySelectorAll('.quick button').forEach(b => b.onclick = () => {
    const k = b.dataset.set;
    if(k === 'ab'){ setM(S.selA,S.selB,100); setM(S.selB,S.selA,0); }
    if(k === 'ba'){ setM(S.selB,S.selA,100); setM(S.selA,S.selB,0); }
    if(k === 'both'){ setM(S.selA,S.selB,50); setM(S.selB,S.selA,50); }
    if(k === 'none'){ setM(S.selA,S.selB,0); setM(S.selB,S.selA,0); }
    paintMatrix(); refreshDuel(); save();
  });

  $('btnApplyPreset').onclick = () => {
    const k = $('selPreset').value;
    (PRESETS[k] || PRESETS.wheel)();
    paintMatrix(); refreshDuel(); save();
    toast('Schema applicato');
  };

  $('brushes').addEventListener('click', ev => {
    const b = ev.target.closest('.bch');
    if(!b) return;
    S.brush = +b.dataset.brush;
    buildBrushes();
  });
  $('rngBrush').addEventListener('input', ev => {
    S.brushSize = +ev.target.value;
    $('brushSizeVal').textContent = S.brushSize;
  });
  $('btnFill').onclick = () => { S.grid.fill(S.brush); S.prev.set(S.grid); needsDraw = true; toast('Riempito'); };
  $('btnBox').onclick = () => {
    const { w, h, grid } = S;
    for(let x=0;x<w;x++){ grid[x] = WALL; grid[(h-1)*w+x] = WALL; }
    for(let y=0;y<h;y++){ grid[y*w] = WALL; grid[y*w+w-1] = WALL; }
    S.prev.set(grid); needsDraw = true; toast('Cornice di muri');
  };
  $('btnBlob').onclick = () => {
    const { w, h, grid, n } = S;
    grid.fill(0);
    const blobs = 6 + n*2;
    for(let k=0;k<blobs;k++){
      const c = (Math.random()*n)|0;
      const cx = (Math.random()*w)|0, cy = (Math.random()*h)|0;
      const r = 3 + Math.random()*Math.max(4, w/8);
      for(let y=-r; y<=r; y++) for(let x=-r; x<=r; x++){
        if(x*x + y*y > r*r) continue;
        grid[(((cy+y)%h+h)%h)*w + (((cx+x)%w+w)%w)] = c;
      }
    }
    S.prev.set(grid); S.step = 0; wakeIfStalled(); needsDraw = true; toast('Seminate ' + blobs + ' macchie');
  };

  $('rngN').addEventListener('input', ev => { $('nColorsVal').textContent = ev.target.value; });
  $('rngN').addEventListener('change', ev => { setN(+ev.target.value); save(); });
  $('rngSize').addEventListener('input', ev => { $('sizeVal').textContent = ev.target.value; });
  $('rngSize').addEventListener('change', ev => {
    allocWorld(+ev.target.value, false);
    fitCanvas(); save();
  });
  $('rngSpeed').addEventListener('input', ev => {
    S.speed = +ev.target.value; $('speedVal').textContent = S.speed; save();
  });
  $('chkMoore').addEventListener('change', ev => { S.neigh8 = ev.target.checked; save(); });
  $('chkWrap').addEventListener('change', ev => { S.wrap = ev.target.checked; save(); });
  $('chkFade').addEventListener('change', ev => { S.fade = ev.target.checked; needsDraw = true; save(); });
  $('chkStasis').addEventListener('change', ev => { S.stopOnStasis = ev.target.checked; save(); });

  $('palette').addEventListener('input', ev => {
    const inp = ev.target.closest('input[data-ci]');
    if(!inp) return;
    const i = +inp.dataset.ci;
    S.colors[i].hex = inp.value;
    inp.parentElement.style.background = inp.value;
    buildPalette(); paintMatrix(); paintPicks(); refreshDuel(); buildBrushes(); needsDraw = true; save();
  });

  $('btnReset').onclick = () => {
    try{ localStorage.removeItem(KEY); }catch(e){}
    S.n = 8; S.colors = defaultPalette(8);
    PRESETS.wheel();
    S.neigh8 = false; S.wrap = true; S.fade = true; S.stopOnStasis = true; S.speed = 20;
    S.selA = 0; S.selB = 1; S.brush = 0;
    allocWorld(80, false); fitCanvas();
    syncUI(); buildPalette(); buildMatrix(); buildPicks(); refreshDuel(); buildBrushes(); buildPaletteUI();
    needsDraw = true; toast('Tutto ripristinato');
  };

  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', () => setTimeout(relayout, 150));

  document.addEventListener('keydown', ev => {
    if(ev.target.matches('input,select,textarea')) return;
    if(ev.code === 'Space'){ ev.preventDefault(); setRunning(!S.running); }
    if(ev.key === 'n' || ev.key === 'ArrowRight'){ setRunning(false); doStep(); needsDraw = true; }
    if(ev.key === 'r'){ seed(); needsDraw = true; }
    if(ev.key === 'Escape') closePanel();
  });
}

function syncUI(){
  $('rngN').value = S.n;          $('nColorsVal').textContent = S.n;
  $('rngSize').value = S.size;    $('sizeVal').textContent = S.size;
  $('rngSpeed').value = S.speed;  $('speedVal').textContent = S.speed;
  $('rngBrush').value = S.brushSize; $('brushSizeVal').textContent = S.brushSize;
  $('chkMoore').checked = S.neigh8;
  $('chkWrap').checked = S.wrap;
  $('chkFade').checked = S.fade;
  $('chkStasis').checked = S.stopOnStasis;
}

/* ------------------------------------------------------------------ via */
function boot(){
  if(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()){
    document.body.classList.add('capacitor');
  }
  const restored = load();
  if(!restored){
    S.colors = defaultPalette(S.n);
    PRESETS.wheel();
  }
  buildPalette();
  allocWorld(S.size, false);
  fitCanvas();
  syncUI();
  buildMatrix(); buildPicks(); refreshDuel(); buildBrushes(); buildPaletteUI();
  wire();
  setRunning(true);
  requestAnimationFrame(frame);
  window.__faida = S;   // per il debug
}
boot();
})();
