/* ============================================================
   story.js - comportements des pages « article long »
   ------------------------------------------------------------
   Deux mecanismes, tous deux facultatifs sur une page donnee :

   1. Lightbox : toute <figure onclick="openLightbox(this)"> ouvre
      son image en grand. Attend #lightbox, #lightbox-img et
      #lightbox-caption dans le document.
   2. Revelation au defilement : chaque .reveal recoit .is-visible
      quand il entre dans le viewport. Sans ce script, les .reveal
      restent en opacity: 0 et la page parait vide, donc toute page
      qui charge css/story.css doit aussi charger ce fichier.
   ============================================================ */

(function () {
    'use strict';

    // ── Lightbox ──
    // Exposees en global : le HTML les appelle via onclick.
    window.openLightbox = function (element) {
        var lightbox = document.getElementById('lightbox');
        var target = document.getElementById('lightbox-img');
        if (!lightbox || !target) return;

        var img = element.querySelector('img');
        if (!img) return;
        var caption = element.querySelector('figcaption');
        var captionEl = document.getElementById('lightbox-caption');

        target.src = img.src;
        target.alt = img.alt;
        if (captionEl) {
            captionEl.textContent = caption ? caption.textContent : '';
        }

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    window.closeLightbox = function () {
        var lightbox = document.getElementById('lightbox');
        if (!lightbox) return;
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    };

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            window.closeLightbox();
        }
    });

    // Cliquer sur l'image elle-meme ne doit pas refermer la lightbox.
    var lightboxImg = document.getElementById('lightbox-img');
    if (lightboxImg) {
        lightboxImg.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    }

    // ── Revelation au defilement ──
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
        // Sans observer, tout afficher plutot que de laisser la page vide.
        Array.prototype.forEach.call(els, function (el) {
            el.classList.add('is-visible');
        });
        return;
    }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    Array.prototype.forEach.call(els, function (el) {
        observer.observe(el);
    });
})();
