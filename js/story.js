/* ========================================
   story.js : pages « article long »
   ----------------------------------------
   Deux mécanismes, facultatifs sur une page donnée :

   1. Lightbox : toute <figure onclick="openLightbox(this)"> ouvre
      son image en grand. Attend #lightbox, #lightbox-img et
      #lightbox-caption dans le document.
   2. Apparition au défilement : chaque .reveal reçoit .is-visible
      quand il entre dans la fenêtre. Sans ce script, les .reveal
      restent en opacity: 0 : toute page qui charge css/story.css
      doit aussi charger ce fichier.
   ======================================== */

(function () {
    'use strict';

    // ---- Lightbox ----
    // Fonctions globales : le HTML les appelle via onclick.
    window.openLightbox = function (element) {
        const lightbox = document.getElementById('lightbox');
        const target = document.getElementById('lightbox-img');
        if (!lightbox || !target) return;

        const img = element.querySelector('img');
        if (!img) return;
        const caption = element.querySelector('figcaption');
        const captionEl = document.getElementById('lightbox-caption');

        target.src = img.src;
        target.alt = img.alt;
        if (captionEl) {
            captionEl.textContent = caption ? caption.textContent : '';
        }

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    window.closeLightbox = function () {
        const lightbox = document.getElementById('lightbox');
        if (!lightbox) return;
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    };

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            window.closeLightbox();
        }
    });

    // Un clic sur l'image elle-même ne referme pas la lightbox.
    const lightboxImg = document.getElementById('lightbox-img');
    if (lightboxImg) {
        lightboxImg.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    }

    // ---- Apparition au défilement ----
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
        // Sans IntersectionObserver, tout afficher plutôt que laisser la page vide.
        Array.prototype.forEach.call(els, function (el) {
            el.classList.add('is-visible');
        });
        return;
    }

    const observer = new IntersectionObserver(function (entries) {
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
