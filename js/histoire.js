// ========================================
// Chronique du Mathlyens - interactions des 5 pages Histoire
//
// Révélation au défilement, bandes de livrée (sprite jamais redimensionné),
// sommaire des sous-pages (tracé de ligne qui se remplit à la lecture) et
// silhouette de l'Alliance sur la page d'index.
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Révélation progressive au défilement ──
    const revealTargets = document.querySelectorAll('.chr-reveal');
    if (revealTargets.length) {
        if (reduceMotion) {
            revealTargets.forEach(el => el.classList.add('chr-in'));
        } else {
            const io = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('chr-in');
                        io.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
            revealTargets.forEach(el => io.observe(el));
        }
    }

    // ── Bandes de livrée : signaler le défilement quand le sprite déborde ──
    // Les images de mltc/histoire_pages/img_histoire/ (1077 ou 2154 px de
    // large) ne sont jamais réduites (contrainte : le pixel art ne doit ni être redimensionné, ni
    // étiré). En dessous de cette largeur, .chr-strip défile horizontalement,
    // et il faut que cela se voie.
    function assessStrips(root) {
        (root || document).querySelectorAll('.chr-strip').forEach(strip => {
            if (!strip.clientWidth) return; // panneau masqué, largeur nulle
            if (strip.closest('.chr-versions')) return; // versions : une seule mention, en légende
            const over = strip.scrollWidth > strip.clientWidth + 1;
            const next = strip.nextElementSibling;
            const hasHint = next && next.classList.contains('chr-strip-hint');
            if (over && !hasHint) {
                const hint = document.createElement('p');
                hint.className = 'chr-strip-hint';
                hint.textContent = 'Image à taille réelle, faites défiler pour la voir en entier.';
                strip.after(hint);
            } else if (!over && hasHint) {
                next.remove();
            }
        });
        /* Versions (plusieurs bandes) : la légende commune signale le défilement. */
        (root || document).querySelectorAll('.chr-versions').forEach(fig => {
            const over = Array.from(fig.querySelectorAll('.chr-strip'))
                .some(s => s.clientWidth && s.scrollWidth > s.clientWidth + 1);
            fig.classList.toggle('is-scroll', over);
        });
    }
    assessStrips();
    window.addEventListener('resize', () => assessStrips());

    // ── Valado L : choix de la composition ──
    // Chaque bouton porte son image, sa largeur et sa capacité ; la rame et
    // sa cote changent ensemble. Sans JavaScript, le sélecteur reste masqué
    // et la composition à 3 caisses s'affiche seule.
    document.querySelectorAll('.chr-consist-pick').forEach(pick => {
        const version = pick.closest('.chr-version');
        const figure = version && version.querySelector('[data-consist]');
        if (!figure) return;
        const img = figure.querySelector('img');
        const cote = figure.querySelector('.chr-cote span');
        const name = version.querySelector('h3').textContent;
        const buttons = Array.from(pick.querySelectorAll('button'));
        buttons.forEach(btn => {
            // Précharge les autres compositions pour un changement sans saut
            new Image().src = btn.dataset.src;
            btn.addEventListener('click', () => {
                const n = btn.dataset.caisses;
                buttons.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
                img.src = btn.dataset.src;
                img.width = +btn.dataset.width;
                img.alt = name + ' à ' + n + ' caisses, livrée TransRegio';
                cote.innerHTML = '<strong>' + btn.dataset.places + ' places</strong> &middot; ' + n + ' caisses';
                assessStrips();
            });
        });
        pick.hidden = false;
    });

    // ── Sommaire des périodes : la ligne se remplit au fil de la lecture ──
    // Chaque lien est une gare. La période active est la dernière dont le
    // haut a passé le tiers de l'écran ; la voie parcourue (--rail-fill, lue
    // par css/histoire.css) avance de gare en gare, au prorata de la période
    // en cours. Les gares déjà dépassées sont marquées .is-passed.
    const rail = document.querySelector('.chr-rail');
    const railLinks = Array.from(document.querySelectorAll('.chr-rail-link'));
    if (rail && railLinks.length) {
        const periods = railLinks.map(link => document.querySelector(link.getAttribute('href')));
        function updateRail() {
            const limit = window.innerHeight / 3;
            let current = 0;
            periods.forEach((p, i) => { if (p && p.getBoundingClientRect().top <= limit) current = i; });
            railLinks.forEach((link, i) => {
                link.classList.toggle('is-active', i === current);
                link.classList.toggle('is-passed', i < current);
            });
            const p = periods[current];
            let frac = 0;
            if (p) {
                const r = p.getBoundingClientRect();
                if (r.top <= limit) frac = Math.min(1, (limit - r.top) / Math.max(1, r.height));
            }
            const x0 = railLinks[0].offsetLeft;
            const xi = railLinks[current].offsetLeft;
            const next = railLinks[current + 1];
            const span = next ? next.offsetLeft - xi : 0;
            rail.style.setProperty('--rail-fill', Math.round(xi - x0 + frac * span + 8) + 'px');
        }
        updateRail();
        window.addEventListener('scroll', updateRail, { passive: true });
        window.addEventListener('resize', updateRail);
    }

    // ── Alliance du Mathlyens : silhouette de carte en toile de fond ──
    // Reprend les geometries et la projection de js/coverage-map.js (non
    // modifie) pour dessiner les Etats membres en aplat unique et tres
    // transparent, sans aucune interactivite : un repere geographique, pas
    // une seconde carte de couverture.
    (function buildAllianceMap() {
        const svgEl = document.querySelector('.chr-alliance-map');
        const geo = window.COV_GEO;
        if (!svgEl || !geo || !geo.membres) return;

        const NS = 'http://www.w3.org/2000/svg';
        const W = 800, H = 650, PAD = 24;

        function mercY(lat) {
            const r = lat * Math.PI / 180;
            return Math.log(Math.tan(Math.PI / 4 + r / 2));
        }
        function geoBounds(geoms) {
            let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
            const scan = ring => ring.forEach(([lon, lat]) => {
                if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
                if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
            });
            geoms.forEach(g => {
                if (g.type === 'Polygon') g.coordinates.forEach(scan);
                else g.coordinates.forEach(p => p.forEach(scan));
            });
            return { minLon, maxLon, minLat, maxLat };
        }
        function fitProjection(bounds) {
            const { minLon, maxLon, minLat, maxLat } = bounds;
            const toR = Math.PI / 180;
            const myMin = mercY(minLat), myMax = mercY(maxLat);
            const geoW = (maxLon - minLon) * toR, geoH = myMax - myMin;
            const uw = W - 2 * PAD, uh = H - 2 * PAD;
            const s = Math.min(uw / geoW, uh / geoH);
            const mw = geoW * s, mh = geoH * s;
            const ox = PAD + (uw - mw) / 2, oy = PAD + (uh - mh) / 2;
            return (lon, lat) => [
                (lon * toR - minLon * toR) * s + ox,
                (myMax - mercY(lat)) * s + oy
            ];
        }
        function ringD(ring, proj) {
            return ring.map((c, i) => {
                const [x, y] = proj(c[0], c[1]);
                return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
            }).join('') + 'Z';
        }
        function pathD(g, proj) {
            const rings = g.type === 'MultiPolygon' ? g.coordinates.flatMap(p => p) : g.coordinates;
            return rings.map(r => ringD(r, proj)).join('');
        }

        const members = Object.values(geo.membres);
        if (!members.length) return;
        const proj = fitProjection(geoBounds(members));
        members.forEach(g => {
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('class', 'chr-alliance-shape');
            p.setAttribute('d', pathD(g, proj));
            svgEl.appendChild(p);
        });
    })();
});
