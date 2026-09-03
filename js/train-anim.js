/* ═══════════════════════════════════════════════════
   Train Animation – cycles through circulations.json
   compositions right-to-left on a rail track.
   ═══════════════════════════════════════════════════ */

(function () {
  const container = document.getElementById('train-animation-container');
  if (!container) return;

  /* ── configuration ── */
  const SPEED         = 280;         // px/s constant cruise
  const GAP_MIN_MS    = 2000;        // min gap between trains
  const GAP_MAX_MS    = 5000;        // max gap
  const FRAME_H       = 68;          // frame height (matches circulations)
  const TRACK_H       = 8;           // track strip height

  const base = container.dataset.base || '';

  /* ── state ── */
  let compositions = [];
  let compIndex = 0;
  let trainWrap = null;

  /* ── helpers ── */
  function randBetween(a, b) { return a + Math.random() * (b - a); }

  /* ── build DOM ── */
  function buildDOM() {
    container.style.position  = 'relative';
    container.style.width     = '100%';
    container.style.height    = FRAME_H + 'px';
    container.style.overflow  = 'hidden';
    container.style.pointerEvents = 'none';

    /* track strip at the bottom */
    const track = document.createElement('div');
    track.style.cssText =
      `position:absolute;bottom:0;left:0;width:100%;height:${TRACK_H}px;` +
      `background:url(${base}mltc/assets/1-Voie_Bois.png) repeat-x left center;` +
      `background-size:auto ${TRACK_H}px;image-rendering:pixelated;z-index:2;`;
    container.appendChild(track);

    /* train wrapper */
    trainWrap = document.createElement('div');
    trainWrap.style.cssText =
      'position:absolute;bottom:' + TRACK_H + 'px;left:0;' +
      'display:flex;align-items:flex-end;white-space:nowrap;' +
      'will-change:transform;z-index:1;';
    container.appendChild(trainWrap);
  }

  /* ── load compositions ── */
  async function loadCompositions() {
    try {
      const res  = await fetch(base + 'mltc/data/circulations.json');
      const data = await res.json();
      for (const country of Object.values(data)) {
        if (country.compositions) {
          for (const comp of country.compositions) compositions.push(comp);
        }
      }
      /* shuffle */
      for (let i = compositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [compositions[i], compositions[j]] = [compositions[j], compositions[i]];
      }
    } catch (e) {
      console.warn('train-anim: could not load circulations.json', e);
    }
  }

  /* ── build train images (same logic as circulations.js) ── */
  function buildTrain(comp) {
    trainWrap.innerHTML = '';
    const vehicles = comp.vehicles || (comp.img ? [comp.img] : []);
    const total = vehicles.length;

    vehicles.forEach((v, i) => {
      const img = document.createElement('img');
      img.draggable = false;

      const baseStyle =
        'display:block;max-width:none;image-rendering:pixelated;' +
        'user-select:none;-webkit-user-drag:none;pointer-events:none;position:relative;';

      if (typeof v === 'string') {
        const z = total - i;
        img.src = base + 'mltc/' + v;
        img.style.cssText = baseStyle + `z-index:${z};`;
      } else if (v && v.coupler) {
        const mb = typeof v.bottom  === 'number' ? v.bottom  : 7;
        const ol = typeof v.overlap === 'number' ? v.overlap : 3;
        const z  = total + 1;
        img.src = base + 'mltc/' + v.coupler;
        img.style.cssText = baseStyle +
          `z-index:${z};margin-bottom:${mb}px;margin-left:-${ol}px;margin-right:-${ol}px;`;
      } else if (v && v.src) {
        const z = total - i;
        const flip = v.flip ? 'transform:scaleX(-1);' : '';
        img.src = base + 'mltc/' + v.src;
        img.style.cssText = baseStyle + `z-index:${z};${flip}`;
      }

      trainWrap.appendChild(img);
    });
  }

  /* ── run one composition ── */
  function runComposition() {
    if (!compositions.length) return;

    const comp = compositions[compIndex];
    compIndex = (compIndex + 1) % compositions.length;

    buildTrain(comp);

    /* wait for all images to load */
    const imgs  = trainWrap.querySelectorAll('img');
    let loaded  = 0;
    const total = imgs.length;
    const onReady = () => { if (++loaded >= total) startMotion(); };
    imgs.forEach(im => {
      if (im.complete && im.naturalWidth > 0) onReady();
      else { im.onload = onReady; im.onerror = onReady; }
    });
    if (total === 0) scheduleNext();
  }

  function scheduleNext() {
    setTimeout(runComposition, randBetween(GAP_MIN_MS, GAP_MAX_MS));
  }

  /* ── motion: constant speed right-to-left ── */
  function startMotion() {
    const trainW = trainWrap.scrollWidth;
    const contW  = container.offsetWidth;

    /* Start fully off-screen right, end fully off-screen left */
    const startX = contW + 10;           // fully off-screen right + 10px
    const exitX  = -trainW - 10;         // fully past left edge + 10px

    let pos  = startX;
    let last = null;

    function frame(ts) {
      if (!last) last = ts;
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;

      pos -= SPEED * dt;               // move left

      if (pos < exitX) {
        scheduleNext();
        return;
      }

      trainWrap.style.transform = `translateX(${pos}px)`;
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  /* ── init ── */
  buildDOM();
  loadCompositions().then(() => {
    if (compositions.length) setTimeout(runComposition, 1500);
  });
})();
