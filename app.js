(function () {
  const MIN = 16, HANDLE = 10, KNOB = 7, KNOB_INSET = 20, RAD = Math.PI / 180;
  const canvas = document.getElementById('stageCanvas');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const empty = document.getElementById('empty');
  const statusEl = document.getElementById('status');
  const fileShared = document.getElementById('fileShared');
  const fileOwn = document.getElementById('fileOwn');
  const linkSize = document.getElementById('linkSize');
  const linkRot = document.getElementById('linkRot');
  const outSize = document.getElementById('outSize');
  const maskOpacityEl = document.getElementById('maskOpacity');
  const zoomLevelEl = document.getElementById('zoomLevel');
  const cards = [...document.querySelectorAll('.card[data-i]')];
  const tabs = [...document.querySelectorAll('.tabs button')];

  let shared = null;
  const crops = [
    { own: null, cx: 0, cy: 0, s: 0, base: 0, rot: 0, flip: false, flipV: false },
    { own: null, cx: 0, cy: 0, s: 0, base: 0, rot: 0, flip: false, flipV: false }
  ];
  let active = 0;
  let baseScale = 1, zoom = 1, panX = 0, panY = 0;
  let drag = null, isPanning = false, panStart = null, spaceDown = false, mouseOverCanvas = false;
  let ownTarget = 0, sideSwapped = false, maskOpacity = 0.6;

  function ts() { return baseScale * zoom; }

  const dl = {
    save({ filename, data }) {
      const url = URL.createObjectURL(data);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return Promise.resolve();
    }
  };

  const imgOf = i => crops[i].own || shared;

  // When one flip is active rotation direction inverts; two flips cancel each other out
  function frameAngle(c) { return (c.flip !== c.flipV ? 1 : -1) * c.rot * RAD; }
  function fitFactor(c) { const a = frameAngle(c); return Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)); }
  function normDeg(d) { return ((d + 180) % 360 + 360) % 360 - 180; }
  function toWorld(c, lx, ly) {
    const a = frameAngle(c), co = Math.cos(a), si = Math.sin(a);
    return [c.cx + lx * co - ly * si, c.cy + lx * si + ly * co];
  }
  function toLocal(c, p) {
    const a = frameAngle(c), co = Math.cos(a), si = Math.sin(a);
    const dx = p.x - c.cx, dy = p.y - c.cy;
    return { x: dx * co + dy * si, y: -dx * si + dy * co };
  }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function setStatus(t) { statusEl.textContent = t; }
  function updateZoomUI() { zoomLevelEl.textContent = Math.round(zoom * 100) + '%'; }

  function loadFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) { reject(new Error('That file is not an image.')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, name: file.name || 'pasted image' });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be read.')); };
      img.src = url;
    });
  }

  function defaultCrops(img, which) {
    const w = img.naturalWidth, h = img.naturalHeight;
    let s, centres;
    if (w >= h) { s = Math.min(w / 2, h) * 0.92; centres = [[w / 4, h / 2], [3 * w / 4, h / 2]]; }
    else { s = Math.min(h / 2, w) * 0.92; centres = [[w / 2, h / 4], [w / 2, 3 * h / 4]]; }
    which.forEach(i => { const c = crops[i]; c.s = c.base = Math.max(MIN, Math.round(s)); c.cx = centres[i][0]; c.cy = centres[i][1]; clamp(i); });
  }

  function centreFull(i) {
    const img = imgOf(i).img;
    const c = crops[i];
    c.s = c.base = Math.round(Math.min(img.naturalWidth, img.naturalHeight) * 0.9);
    c.cx = img.naturalWidth / 2; c.cy = img.naturalHeight / 2; clamp(i);
  }

  function clamp(i) {
    const src = imgOf(i); if (!src) return;
    const w = src.img.naturalWidth, h = src.img.naturalHeight, c = crops[i];
    const f = fitFactor(c);
    c.s = Math.max(MIN, Math.min(c.s, Math.min(w, h) / f));
    const e = c.s * f / 2;
    c.cx = Math.max(e, Math.min(c.cx, w - e));
    c.cy = Math.max(e, Math.min(c.cy, h - e));
  }

  function setRotation(i, deg) {
    const c = crops[i];
    c.rot = normDeg(Math.round(deg)); c.s = c.base; clamp(i);
    const mode = linkRot.value;
    if (mode !== 'independent') { const o = crops[1 - i]; o.rot = mode === 'linked' ? c.rot : normDeg(-c.rot); o.s = o.base; clamp(1 - i); }
    updateRotUI(); draw();
  }

  function updateRotUI() {
    cards.forEach((card, i) => {
      const r = crops[i].rot;
      card.querySelector('[data-rot]').value = String(r);
      card.querySelector('[data-rot-out]').textContent = r + '°';
    });
  }

  async function setShared(file) {
    try { shared = await loadFile(file); defaultCrops(shared.img, [0, 1].filter(i => !crops[i].own)); showStage(true); setStatus(''); }
    catch (e) { setStatus(e.message); }
  }

  async function setOwn(i, file) {
    try { crops[i].own = await loadFile(file); centreFull(i); setActive(i); showStage(true); setStatus(''); }
    catch (e) { setStatus(e.message); }
  }

  function showStage(resetView) {
    const any = imgOf(0) || imgOf(1);
    empty.hidden = !!any; canvas.hidden = !any;
    updateButtons(); layoutCanvas(resetView);
  }

  function layoutCanvas(resetView) {
    const src = imgOf(active) || imgOf(1 - active); if (!src) return;
    const img = src.img, dpr = window.devicePixelRatio || 1;
    const sw = stage.clientWidth, sh = stage.clientHeight; if (!sw || !sh) return;
    canvas.style.width = sw + 'px'; canvas.style.height = sh + 'px';
    canvas.width = Math.round(sw * dpr); canvas.height = Math.round(sh * dpr);
    const oldBase = baseScale;
    baseScale = Math.min(sw / img.naturalWidth, sh / img.naturalHeight) * 0.95;
    if (resetView || !oldBase) {
      zoom = 1;
      panX = (sw - img.naturalWidth * baseScale) / 2;
      panY = (sh - img.naturalHeight * baseScale) / 2;
    } else if (oldBase && oldBase !== baseScale) {
      const r = baseScale / oldBase;
      panX *= r; panY *= r;
    }
    updateZoomUI(); draw();
  }

  let raf = 0;
  function draw() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; render(); }); }

  function stageSource() { return imgOf(active) || imgOf(1 - active); }
  function shownIndices() { const s = stageSource(); return [0, 1].filter(i => imgOf(i) === s); }

  function render() {
    const src = stageSource(); if (!src || !canvas.width) return;
    const dpr = window.devicePixelRatio || 1, k = ts() * dpr, img = src.img;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k, 0, 0, k, panX * dpr, panY * dpr);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = `rgba(8,10,20,${maskOpacity})`;
    ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
    const order = shownIndices().sort((a, b) => (a === active) - (b === active));
    order.forEach(i => {
      const c = crops[i]; ctx.save();
      ctx.translate(c.cx, c.cy); ctx.rotate(frameAngle(c));
      ctx.beginPath(); ctx.rect(-c.s / 2, -c.s / 2, c.s, c.s); ctx.clip();
      ctx.rotate(-frameAngle(c)); ctx.translate(-c.cx, -c.cy);
      ctx.drawImage(img, 0, 0); ctx.restore();
    });
    order.forEach(i => {
      const c = crops[i], h = c.s / 2, col = css(i === 0 ? '--a' : '--b');
      ctx.save(); ctx.translate(c.cx, c.cy); ctx.rotate(frameAngle(c));
      ctx.lineWidth = (i === active ? 3 : 2) / ts(); ctx.strokeStyle = col; ctx.setLineDash([]);
      ctx.globalAlpha = i === active ? 1 : 0.75; ctx.strokeRect(-h, -h, c.s, c.s); ctx.globalAlpha = 1;
      if (i === active) {
        ctx.setLineDash([6 / ts(), 5 / ts()]); ctx.lineWidth = 1.5 / ts();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(0, 0, h, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        const hs = HANDLE / ts();
        [[-h,-h],[h,-h],[-h,h],[h,h]].forEach(([px,py]) => {
          ctx.fillStyle = '#fff'; ctx.fillRect(px-hs/2, py-hs/2, hs, hs);
          ctx.lineWidth = 2/ts(); ctx.strokeStyle = col; ctx.strokeRect(px-hs/2, py-hs/2, hs, hs);
        });
        const ky = -h + KNOB_INSET / ts();
        ctx.lineWidth = 2/ts(); ctx.strokeStyle = col;
        ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, ky - KNOB/ts()); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, ky, KNOB/ts(), 0, Math.PI*2);
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
      }
      const tag = 22/ts();
      const outside = [[-h,-h-tag],[-h+tag,-h-tag]].every(([lx,ly]) => {
        const [tx,ty] = toWorld(c,lx,ly);
        return tx>=0&&ty>=0&&tx<=img.naturalWidth&&ty<=img.naturalHeight;
      });
      const top = outside ? -h-tag : -h;
      ctx.fillStyle = col; ctx.globalAlpha = i===active?1:0.75;
      ctx.fillRect(-h, top, tag, tag); ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.font = `700 ${14/ts()}px "Bricolage Grotesque",system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i+1), -h+tag/2, top+tag/2); ctx.restore();
    });
    renderPreviews();
  }

  function corners(c) { const h=c.s/2; return [[-h,-h],[h,-h],[-h,h],[h,h]].map(([x,y])=>toWorld(c,x,y)); }

  function paintCrop(i, target) {
    const t = target.getContext('2d');
    t.setTransform(1,0,0,1,0,0); t.clearRect(0,0,target.width,target.height);
    const src = imgOf(i); if (!src) return;
    const c = crops[i], n = target.width;
    t.imageSmoothingQuality = 'high';
    t.translate(n/2, n/2); t.rotate(c.rot*RAD);
    if (c.flip) t.scale(-1,1); if (c.flipV) t.scale(1,-1);
    t.scale(n/c.s, n/c.s); t.translate(-c.cx,-c.cy); t.drawImage(src.img,0,0);
  }

  function renderPreviews() {
    cards.forEach((card,i) => card.querySelectorAll('.previews canvas').forEach(cv => paintCrop(i,cv)));
    const [l,r] = sideSwapped ? [1,0] : [0,1];
    paintCrop(l, document.getElementById('sideA')); paintCrop(r, document.getElementById('sideB'));
    paintCrop(l, document.getElementById('rowA')); paintCrop(r, document.getElementById('rowB'));
  }

  function toImage(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX-r.left-panX)/ts(), y: (e.clientY-r.top-panY)/ts() };
  }
  function hitCorner(i,p) {
    const c=crops[i], tol=(HANDLE+8)/ts(), cs=corners(c);
    for (let k=0;k<4;k++) if (Math.abs(p.x-cs[k][0])<=tol&&Math.abs(p.y-cs[k][1])<=tol) return k;
    return -1;
  }
  function inside(i,p) { const c=crops[i],l=toLocal(c,p); return Math.abs(l.x)<=c.s/2&&Math.abs(l.y)<=c.s/2; }
  function hitKnob(i,p) { const c=crops[i],[kx,ky]=toWorld(c,0,-c.s/2+KNOB_INSET/ts()); return Math.hypot(p.x-kx,p.y-ky)<=(KNOB+6)/ts(); }
  function hitTest(p) {
    const shown=shownIndices();
    if (shown.includes(active)) {
      if (hitKnob(active,p)) return {i:active,mode:'rotate'};
      const k=hitCorner(active,p); if (k>=0) return {i:active,mode:'resize',corner:k};
      if (inside(active,p)) return {i:active,mode:'move'};
    }
    for (const i of shown) if (i!==active&&inside(i,p)) return {i,mode:'move'};
    return null;
  }
  function cursorFor(i,k) { const c=crops[i],[x,y]=corners(c)[k]; return (x-c.cx)*(y-c.cy)>0?'nwse-resize':'nesw-resize'; }

  // Zoom with mouse wheel toward cursor
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = Math.pow(1.12, -e.deltaY/100);
    const r = canvas.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top, curTs=ts();
    const ix=(mx-panX)/curTs, iy=(my-panY)/curTs;
    zoom = Math.max(0.1, Math.min(30, zoom*factor));
    panX=mx-ix*ts(); panY=my-iy*ts();
    updateZoomUI(); draw();
  }, {passive:false});

  canvas.addEventListener('mouseenter', () => mouseOverCanvas=true);
  canvas.addEventListener('mouseleave', () => mouseOverCanvas=false);

  canvas.addEventListener('pointerdown', e => {
    if (!stageSource()) return;
    if (e.button===1 || (e.button===0&&spaceDown)) {
      e.preventDefault(); isPanning=true;
      panStart={x:e.clientX,y:e.clientY,px:panX,py:panY};
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor='grabbing'; return;
    }
    if (e.button!==0) return;
    const p=toImage(e), hit=hitTest(p); if (!hit) return;
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    if (hit.i!==active) setActive(hit.i,true);
    const c=crops[hit.i];
    if (hit.mode==='move') { drag={mode:'move',i:hit.i,dx:p.x-c.cx,dy:p.y-c.cy}; }
    else if (hit.mode==='rotate') { drag={mode:'rotate',i:hit.i}; canvas.style.cursor='grabbing'; }
    else {
      const k=hit.corner, sx=(k===1||k===3)?1:-1, sy=(k===2||k===3)?1:-1;
      drag={mode:'resize',i:hit.i,sx,sy};
    }
  });

  canvas.addEventListener('pointermove', e => {
    if (!stageSource()) return;
    if (isPanning) { panX=panStart.px+(e.clientX-panStart.x); panY=panStart.py+(e.clientY-panStart.y); draw(); return; }
    const p=toImage(e);
    if (!drag) {
      if (spaceDown) { canvas.style.cursor='grab'; return; }
      const hit=hitTest(p);
      canvas.style.cursor=!hit?'default':hit.mode==='move'?'move':hit.mode==='rotate'?'grab':cursorFor(hit.i,hit.corner);
      return;
    }
    const c=crops[drag.i], src=imgOf(drag.i).img, w=src.naturalWidth, h=src.naturalHeight;
    if (drag.mode==='move') { c.cx=p.x-drag.dx; c.cy=p.y-drag.dy; clamp(drag.i); }
    else if (drag.mode==='rotate') {
      const a=Math.atan2(p.y-c.cy,p.x-c.cx)+Math.PI/2;
      let deg=(c.flip!==c.flipV?1:-1)*a/RAD;
      if (e.shiftKey) deg=Math.round(deg/15)*15;
      setRotation(drag.i,deg); return;
    } else {
      const l=toLocal(c,p);
      const half=Math.max(drag.sx*l.x, drag.sy*l.y, MIN/2);
      c.s=c.base=half*2; clamp(drag.i); syncSize(drag.i);
    }
    draw();
  });

  function endDrag() {
    if (isPanning) { isPanning=false; panStart=null; canvas.style.cursor=spaceDown?'grab':'default'; return; }
    if (drag&&drag.mode==='rotate') canvas.style.cursor='grab'; drag=null;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', e => {
    if (e.key===' '&&!e.repeat) { spaceDown=true; if (mouseOverCanvas&&!isPanning) canvas.style.cursor='grab'; if (mouseOverCanvas) e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { if (e.key===' ') { spaceDown=false; if (!isPanning) canvas.style.cursor='default'; } });

  canvas.addEventListener('keydown', e => {
    const c=crops[active]; if (!imgOf(active)) return;
    const step=e.shiftKey?10:1, unit=step/Math.max(ts(),0.0001);
    let used=true;
    switch(e.key) {
      case 'ArrowLeft': c.cx-=unit; break; case 'ArrowRight': c.cx+=unit; break;
      case 'ArrowUp': c.cy-=unit; break; case 'ArrowDown': c.cy+=unit; break;
      case '+': case '=': c.s+=unit*2; clamp(active); c.base=c.s; syncSize(active); break;
      case '-': case '_': c.s-=unit*2; clamp(active); c.base=c.s; syncSize(active); break;
      case '[': setRotation(active,c.rot-1); break; case '{': setRotation(active,c.rot-15); break;
      case ']': setRotation(active,c.rot+1); break; case '}': setRotation(active,c.rot+15); break;
      case '1': setActive(0); break; case '2': setActive(1); break;
      default: used=false;
    }
    if (used) { e.preventDefault(); clamp(active); draw(); }
  });

  function syncSize(from) {
    if (!linkSize.checked) return;
    const o=1-from; if (!imgOf(o)) return;
    const c=crops[o]; c.s=c.base=crops[from].s; clamp(o);
  }

  linkRot.addEventListener('change', () => { if (linkRot.value!=='independent') setRotation(active,crops[active].rot); });
  linkSize.addEventListener('change', () => { if (linkSize.checked) { syncSize(active); draw(); } });
  maskOpacityEl.addEventListener('input', () => { maskOpacity=parseFloat(maskOpacityEl.value); draw(); });

  function setActive(i, keepLayout) {
    const before=stageSource(); active=i;
    tabs.forEach((t,k) => t.setAttribute('aria-pressed',String(k===i)));
    cards.forEach((c,k) => c.classList.toggle('active',k===i));
    if (!keepLayout&&stageSource()!==before) layoutCanvas(true); else draw();
  }
  tabs.forEach((t,k) => t.addEventListener('click',()=>setActive(k)));

  cards.forEach((card,i) => {
    card.querySelector('[data-pick]').addEventListener('click',()=>setActive(i));
    card.querySelector('[data-flip]').addEventListener('click',e => {
      crops[i].flip=!crops[i].flip;
      e.currentTarget.setAttribute('aria-pressed',String(crops[i].flip));
      e.currentTarget.textContent=crops[i].flip?'Mirrored':'Mirror';
      draw();
    });
    card.querySelector('[data-flipv]').addEventListener('click',e => {
      crops[i].flipV=!crops[i].flipV;
      e.currentTarget.setAttribute('aria-pressed',String(crops[i].flipV));
      e.currentTarget.textContent=crops[i].flipV?'Flipped V':'Flip V';
      draw();
    });
    card.querySelector('[data-centre]').addEventListener('click',()=>{ if (!imgOf(i)) return; centreFull(i); draw(); });
    card.querySelector('[data-rot]').addEventListener('input',e=>{ if (active!==i) setActive(i); setRotation(i,parseFloat(e.target.value)); });
    card.querySelectorAll('[data-rot-step]').forEach(b=>b.addEventListener('click',()=>{ if (active!==i) setActive(i); setRotation(i,crops[i].rot+parseInt(b.dataset.rotStep,10)); }));
    card.querySelector('[data-rot-reset]').addEventListener('click',()=>{ if (active!==i) setActive(i); setRotation(i,0); });
    card.querySelector('[data-own]').addEventListener('click',()=>{ ownTarget=i; fileOwn.click(); });
    card.querySelector('[data-reset]').addEventListener('click',()=>{ crops[i].own=null; if (shared) defaultCrops(shared.img,[i]); setActive(i); showStage(false); });
    card.querySelector('[data-dl]').addEventListener('click',()=>downloadOne(i));
  });

  function updateButtons() {
    cards.forEach((card,i) => {
      const has=!!imgOf(i);
      card.querySelector('[data-reset]').hidden=!crops[i].own;
      card.querySelector('[data-own]').textContent=crops[i].own?'Change its image':'Use a different image';
      card.querySelector('[data-dl]').disabled=!has;
      card.querySelector('[data-centre]').disabled=!has;
      card.querySelectorAll('[data-rot],[data-rot-step],[data-rot-reset]').forEach(el=>el.disabled=!has);
      card.querySelector('[data-src]').textContent=crops[i].own?'own image':(shared?'shared image':'');
    });
    const both=!!imgOf(0)&&!!imgOf(1);
    document.getElementById('dlBoth').disabled=!both;
    document.getElementById('copyPreview').disabled=!both;
  }

  document.getElementById('openBtn').addEventListener('click',()=>fileShared.click());
  document.getElementById('emptyBtn').addEventListener('click',()=>fileShared.click());
  fileShared.addEventListener('change',()=>{ if (fileShared.files[0]) setShared(fileShared.files[0]); fileShared.value=''; });
  fileOwn.addEventListener('change',()=>{ if (fileOwn.files[0]) setOwn(ownTarget,fileOwn.files[0]); fileOwn.value=''; });

  // Zoom buttons
  function zoomToward(factor) {
    const sw=stage.clientWidth, sh=stage.clientHeight, mx=sw/2, my=sh/2, curTs=ts();
    const ix=(mx-panX)/curTs, iy=(my-panY)/curTs;
    zoom=Math.max(0.1,Math.min(30,zoom*factor));
    panX=mx-ix*ts(); panY=my-iy*ts(); updateZoomUI(); draw();
  }
  document.getElementById('zoomIn').addEventListener('click',()=>zoomToward(1.25));
  document.getElementById('zoomOut').addEventListener('click',()=>zoomToward(1/1.25));
  document.getElementById('zoomFit').addEventListener('click',()=>{
    const src=stageSource(); if (!src) return;
    const img=src.img, sw=stage.clientWidth, sh=stage.clientHeight;
    zoom=1; panX=(sw-img.naturalWidth*baseScale)/2; panY=(sh-img.naturalHeight*baseScale)/2;
    updateZoomUI(); draw();
  });

  // Swap sides
  document.getElementById('swapSides').addEventListener('click',()=>{ sideSwapped=!sideSwapped; renderPreviews(); });

  // Drag and drop, paste
  ['dragenter','dragover'].forEach(ev=>stage.addEventListener(ev,e=>{e.preventDefault();stage.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>stage.addEventListener(ev,e=>{e.preventDefault();stage.classList.remove('drag');}));
  stage.addEventListener('drop',e=>{ const f=e.dataTransfer?.files?.[0]; if (f) setShared(f); });
  window.addEventListener('paste',e=>{ const it=[...e.clipboardData?.items||[]].find(x=>x.type.startsWith('image/')); if (it){e.preventDefault();setShared(it.getAsFile());} });

  // Export
  function cropBlob(i) {
    return new Promise((resolve,reject)=>{
      const n=parseInt(outSize.value,10), cv=document.createElement('canvas');
      cv.width=n; cv.height=n; paintCrop(i,cv);
      cv.toBlob(b=>b?resolve(b):reject(new Error('Export failed.')),'image/png');
    });
  }
  function errText(err) {
    const code=err?.code;
    if (code==='declined') return 'Download cancelled.';
    if (code==='rate_limited') return 'A save prompt is already open.';
    return err?.message||'Download failed.';
  }
  function trackDownload(filename) {
    if (window.gtag) gtag('event', 'file_download', {file_name: filename});
  }
  async function downloadOne(i) {
    try {
      setStatus('Preparing avatar '+(i+1)+'...');
      const filename = `avatar-${i+1}-${outSize.value}px.png`;
      const b = await cropBlob(i);
      await dl.save({filename, data: b});
      trackDownload(filename);
      setStatus('Downloaded avatar '+(i+1)+'.');
    } catch(err){setStatus(errText(err));}
  }
  document.getElementById('dlBoth').addEventListener('click',async()=>{
    try {
      setStatus('Downloading both avatars...');
      const f1 = `avatar-1-${outSize.value}px.png`, f2 = `avatar-2-${outSize.value}px.png`;
      await dl.save({filename: f1, data: await cropBlob(0)});
      trackDownload(f1);
      await dl.save({filename: f2, data: await cropBlob(1)});
      trackDownload(f2);
      setStatus('Downloaded both avatars.');
    } catch(err){setStatus(errText(err));}
  });

  // Preview for sharing
  function previewBlob() {
    return new Promise((resolve,reject)=>{
      const D=256,OV=40,PAD=32,RING=8;
      const cv=document.createElement('canvas'); cv.width=PAD*2+D*2-OV; cv.height=PAD*2+D;
      const t=cv.getContext('2d'), bg='#2B2D31'; t.fillStyle=bg; t.fillRect(0,0,cv.width,cv.height);
      const [l,r]=sideSwapped?[1,0]:[0,1];
      [l,r].forEach((idx,pos)=>{
        const tmp=document.createElement('canvas'); tmp.width=D; tmp.height=D; paintCrop(idx,tmp);
        const x=PAD+pos*(D-OV),y=PAD,cx=x+D/2,cy=y+D/2;
        if (pos===1){t.fillStyle=bg;t.beginPath();t.arc(cx,cy,D/2+RING,0,Math.PI*2);t.fill();}
        t.save();t.beginPath();t.arc(cx,cy,D/2,0,Math.PI*2);t.clip();t.drawImage(tmp,x,y);t.restore();
      });
      cv.toBlob(b=>b?resolve(b):reject(new Error('Preview failed.')),'image/png');
    });
  }

  const copyBtn=document.getElementById('copyPreview'), copyStatus=document.getElementById('copyStatus');
  copyBtn.addEventListener('click',async()=>{
    const canClip=window.isSecureContext&&navigator.clipboard?.write&&window.ClipboardItem;
    if (!canClip) { try{await dl.save({filename:'matching-avatars-preview.png',data:await previewBlob()});copyStatus.textContent='Preview downloaded (browser cannot copy images).';} catch(e){copyStatus.textContent=e.message;} return; }
    try { await navigator.clipboard.write([new ClipboardItem({'image/png':previewBlob()})]); copyStatus.textContent='Copied. Paste into a chat to share.'; }
    catch(e) { try{await dl.save({filename:'matching-avatars-preview.png',data:await previewBlob()});copyStatus.textContent='Copying blocked, downloaded instead.';} catch(e2){copyStatus.textContent=e2.message;} }
  });

  // Resize handling
  new ResizeObserver(()=>{ if (stageSource()) layoutCanvas(false); }).observe(stage);
  if (window.matchMedia) { const mq=window.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change',draw); }
  new MutationObserver(draw).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

})();
