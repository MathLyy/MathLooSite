// Shared behaviors for livrées subpages
// - Flip handling (R button)
// - Auto stacked layout assessment for long sprites

(function(){
  // Flip handling for liveries: swaps to data-r image when available, else CSS mirror
  document.addEventListener('click', function(e){
    const btn = e.target.closest('.lv-flip-btn');
    if(!btn) return;
    const card = btn.closest('.lv-engine');
    const img = card?.querySelector('.lv-imgframe img');
    if(!img) return;
    const hasR = img.getAttribute('data-r');
    const current = img.getAttribute('src');
    const target = hasR;
    // Toggle between normal and R versions if provided
    if(target) {
      if(current === target) {
        // try to find non-R by stripping _R
        const normal = target.replace('_R', '');
        img.setAttribute('src', normal);
      } else {
        img.setAttribute('src', target);
      }
      img.classList.remove('flip-x');
    } else {
      // Fallback: CSS mirror
      img.classList.toggle('flip-x');
    }

    // Re-evaluate stacked layout after image changes
    const recalc = () => {
      try { window._lvAssessStack && window._lvAssessStack(card); } catch(_) {}
    };
  if (img.complete) recalc(); else img.addEventListener('load', recalc, { once: true });
  });

  // ─── Variantes d'un même engin : usure, graffiti, chargement ──────────
  // Déclaré sur l'image, dans le même esprit que data-r :
  //   data-vars="USÉ|livrees_img/…/D-MLCC_PUcs.png;TAGS|…/D-MLCC_PGUcs.png"
  // L'image de départ compte comme première variante (« NEUF » par défaut,
  // ou data-var0 si un autre libellé est voulu). Le libellé du bouton
  // affiche toujours l'état courant.
  function variantsOf(img){
    if(img._lvVars !== undefined) return img._lvVars;
    const raw = img.getAttribute('data-vars');
    if(!raw){ img._lvVars = null; return null; }
    const list = [{ code: img.getAttribute('data-var0') || 'NEUF', src: img.getAttribute('src') }];
    raw.split(';').forEach(function(part){
      const i = part.indexOf('|');
      if(i < 0) return;
      const code = part.slice(0, i).trim();
      const src = part.slice(i + 1).trim();
      if(code && src) list.push({ code: code, src: src });
    });
    img._lvVars = list.length > 1 ? list : null;
    return img._lvVars;
  }

  document.addEventListener('click', function(e){
    const btn = e.target.closest('.lv-var-btn');
    if(!btn) return;
    const card = btn.closest('.lv-engine');
    const img = card && card.querySelector('.lv-imgframe img');
    if(!img) return;
    const vars = variantsOf(img);
    if(!vars) return;

    const next = (parseInt(btn.dataset.index || '0', 10) + 1) % vars.length;
    btn.dataset.index = String(next);
    btn.textContent = vars[next].code;
    btn.setAttribute('aria-label', 'Variante affichée : ' + vars[next].code);
    img.setAttribute('src', vars[next].src);
    img.classList.remove('flip-x');

    // Les variantes chargées ou patinées n'ont pas toujours la même hauteur
    // (bâche, chargement qui dépasse) : il faut réévaluer la mise en page.
    const recalc = () => { try { window._lvAssessStack && window._lvAssessStack(card); } catch(_) {} };
    if(img.complete) recalc(); else img.addEventListener('load', recalc, { once: true });
  });

  // Préchargement au survol du cadre : évite le clignotement au premier clic.
  document.addEventListener('pointerover', function(e){
    const frame = e.target.closest && e.target.closest('.lv-imgframe');
    if(!frame || frame._lvPrefetched) return;
    const img = frame.querySelector('img');
    const vars = img && variantsOf(img);
    if(!vars) return;
    frame._lvPrefetched = true;
    vars.slice(1).forEach(function(v){ const p = new Image(); p.src = v.src; });
  });

  // Auto stacked layout for very long sprites
  function isStackNeeded(img){
    const nw = img.naturalWidth || 0;
    const nh = img.naturalHeight || 1;
    const ratio = nw / nh;
    const forced = img.dataset.stack === 'true' || img.closest('.lv-engine')?.dataset.stack === 'true';
    // Long sprites: wide or extreme aspect ratio
    return forced || nw >= 360 || ratio >= 18;
  }
  function syncScrollTrack(card, frame) {
    const hasScroll = frame.scrollWidth > frame.clientWidth;
    card.classList.toggle('has-scroll', hasScroll);
    if (hasScroll) {
      let track = card.querySelector('.lv-scroll-track');
      if (!track) {
        track = document.createElement('div');
        track.className = 'lv-scroll-track';
        const spacer = document.createElement('div');
        track.appendChild(spacer);
        frame.parentNode.insertBefore(track, frame);
        // Sync: track → image
        let syncingFromTrack = false;
        let syncingFromFrame = false;
        track.addEventListener('scroll', () => {
          if (syncingFromFrame) return;
          syncingFromTrack = true;
          frame.scrollLeft = track.scrollLeft;
          syncingFromTrack = false;
        });
        // Sync: image → track (wheel / touch on image)
        frame.addEventListener('scroll', () => {
          if (syncingFromTrack) return;
          syncingFromFrame = true;
          track.scrollLeft = frame.scrollLeft;
          syncingFromFrame = false;
        });
      }
      // Update spacer width to match content
      track.firstElementChild.style.width = frame.scrollWidth + 'px';
    } else {
      const track = card.querySelector('.lv-scroll-track');
      if (track) track.remove();
    }
  }

  window._lvAssessStack = function(card){
    const frame = card?.querySelector('.lv-imgframe');
    const img = frame?.querySelector('img');
    if(!img || !frame) return;
    // Stack when the sprite is explicitly large OR when the image actually overflows the frame
    const need = isStackNeeded(img) || (frame.scrollWidth > frame.clientWidth);
    card.classList.toggle('stack', need);
    // Clear any background-image - we now use the visible <img> with scroll
    frame.style.backgroundImage = '';
    // Detect if the image overflows and needs a scrollbar
    if (need) {
      requestAnimationFrame(() => {
        syncScrollTrack(card, frame);
      });
    } else {
      card.classList.remove('has-scroll');
      const track = card.querySelector('.lv-scroll-track');
      if (track) track.remove();
    }
  };
  function init(){
    document.querySelectorAll('.lv-engine').forEach(card => {
      const frame = card.querySelector('.lv-imgframe');
      const img = frame?.querySelector('img');
      if(!img) return;
      const assess = () => window._lvAssessStack(card);
      if (img.complete) assess(); else img.addEventListener('load', assess, { once: true });
    });
    // Inject mobile touch-scroll hint after lv-wrap if present
    var wrap = document.querySelector('.lv-wrap');
    if (wrap && !document.querySelector('.lv-touch-hint')) {
      var hint = document.createElement('div');
      hint.className = 'lv-touch-hint';
      hint.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7L3 11L7 15"/><path d="M3 11h18"/><path d="M17 7L21 11L17 15"/></svg> Sur mobile, les images larges peuvent être parcourues au toucher';
      wrap.parentNode.insertBefore(hint, wrap.nextSibling);
    }
    // Re-evaluate scroll overflow on window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        document.querySelectorAll('.lv-engine.stack').forEach(card => {
          const frame = card.querySelector('.lv-imgframe');
          if (frame) syncScrollTrack(card, frame);
        });
      }, 150);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ==========================================================
  // Cross-page fade transition (unified for livrees.html + subpages)
  // ==========================================================
  var inLivreesSection = document.querySelector('.lv-page') || document.querySelector('.lv-page-section');
  if (inLivreesSection) {
    // Fade IN on arrival: body.lv-entering added inline in <head>, removed after first paint
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.remove('lv-entering');
      });
    });

    // Fade OUT on leaving
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href) return;
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || link.target === '_blank') return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;

      var dest;
      try { dest = new URL(link.href, window.location.href); } catch (err) { return; }
      if (dest.origin !== window.location.origin) return;
      // Same page, only hash differs → let native smooth scroll handle it
      if (dest.pathname === window.location.pathname && dest.search === window.location.search) return;

      e.preventDefault();
      document.body.classList.add('lv-leaving');
      setTimeout(function () {
        window.location.href = link.href;
      }, 280);
    });

    // Restore on browser back/forward cache (bfcache)
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        document.body.classList.remove('lv-leaving');
        document.body.classList.remove('lv-entering');
      }
    });
  }
})();

