// ========================================
// Chronique du Mathlyens - interactions des 5 pages Histoire
//
// Remplace les blocs .ht-figure / .ht-service-deck / .ht-evt de main.js,
// devenus orphelins depuis la refonte (nouvelles classes .chr-*). Reprend
// les mêmes techniques (défilement de sprite non redimensionné, tablist
// accessible, scroll-spy) sous les nouveaux noms, et ajoute l'intégration
// de la chronologie d'expansion à la carte de couverture existante
// (js/coverage-map.js, non modifié : on ne fait que déclencher ses propres
// gestionnaires de survol).
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
    // Les images de mltc/icones_lore/ font 1077px de large et ne sont jamais
    // réduites (contrainte : le pixel art ne doit ni être redimensionné, ni
    // étiré). En dessous de cette largeur, .chr-strip défile horizontalement,
    // et il faut que cela se voie.
    function assessStrips(root) {
        (root || document).querySelectorAll('.chr-strip').forEach(strip => {
            if (!strip.clientWidth) return; // panneau masqué, largeur nulle
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
    }
    assessStrips();
    window.addEventListener('resize', () => assessStrips());

    // ── Codex des marques : tablist accessible partagée (Origines, Services) ──
    document.querySelectorAll('.chr-codex').forEach((codex, ci) => {
        const tabs = Array.from(codex.querySelectorAll('.chr-codex-tab'));
        const panels = Array.from(codex.querySelectorAll('.chr-codex-panel'));
        const nav = codex.querySelector('.chr-codex-nav');
        if (!tabs.length) return;

        if (nav) nav.setAttribute('role', 'tablist');
        tabs.forEach((tab, i) => {
            const target = tab.getAttribute('data-codex-target');
            const panel = codex.querySelector('[data-codex-index="' + target + '"]');
            const tid = 'codex-' + ci + '-tab-' + i;
            tab.id = tid;
            tab.type = 'button';
            tab.setAttribute('role', 'tab');
            if (panel) {
                panel.id = 'codex-' + ci + '-panel-' + i;
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', tid);
                tab.setAttribute('aria-controls', panel.id);
            }
        });

        function select(tab) {
            const target = tab.getAttribute('data-codex-target');
            tabs.forEach(t => {
                const on = t === tab;
                t.classList.toggle('active', on);
                t.setAttribute('aria-selected', on ? 'true' : 'false');
                t.tabIndex = on ? 0 : -1;
            });
            panels.forEach(p => p.classList.remove('active'));
            const panel = codex.querySelector('[data-codex-index="' + target + '"]');
            if (panel) {
                panel.classList.add('active');
                assessStrips(panel);
            }
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', () => select(tab));
            tab.addEventListener('keydown', e => {
                const i = tabs.indexOf(tab);
                let j = -1;
                if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
                else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
                else if (e.key === 'Home') j = 0;
                else if (e.key === 'End') j = tabs.length - 1;
                if (j < 0) return;
                e.preventDefault();
                select(tabs[j]);
                tabs[j].focus();
            });
        });

        select(tabs.find(t => t.classList.contains('active')) || tabs[0]);
    });

    // ── Chronologie d'expansion : accordéon + lien vers la carte ──
    const evtItems = Array.from(document.querySelectorAll('.chr-evt[data-index]'));
    if (evtItems.length) {
        let activeIndex = -1;
        let scrollLocked = false;

        function highlightMapCountry(evt) {
            const countries = (evt.dataset.country || '').split(',').map(s => s.trim()).filter(Boolean);
            if (!countries.length) return;
            const shape = document.querySelector('.cov-country[data-country="' + countries[0] + '"]');
            if (shape) shape.dispatchEvent(new Event('mouseenter'));
        }

        function setActive(idx) {
            activeIndex = idx;
            evtItems.forEach(item => {
                const isActive = Number(item.dataset.index) === idx;
                item.classList.toggle('active', isActive);
                if (isActive) highlightMapCountry(item);
            });
        }

        evtItems.forEach((evt, i) => {
            const btn = evt.querySelector('.chr-evt-title');
            const body = evt.querySelector('.chr-evt-body');
            if (!btn || !body) return;
            body.id = 'chr-evt-body-' + i;
            btn.type = 'button';
            btn.setAttribute('aria-controls', body.id);
            btn.setAttribute('aria-expanded', 'false');

            evt.addEventListener('click', () => {
                const isOpen = body.classList.contains('chr-visible');
                evtItems.forEach(other => {
                    if (other === evt) return;
                    const ob = other.querySelector('.chr-evt-body');
                    const obtn = other.querySelector('.chr-evt-title');
                    if (ob) ob.classList.remove('chr-visible');
                    if (obtn) obtn.setAttribute('aria-expanded', 'false');
                });
                body.classList.toggle('chr-visible', !isOpen);
                btn.setAttribute('aria-expanded', (!isOpen).toString());

                setActive(Number(evt.dataset.index));
                scrollLocked = true;
                setTimeout(() => { scrollLocked = false; }, 600);
            });
        });

        if (!reduceMotion) {
            const spy = new IntersectionObserver(entries => {
                if (scrollLocked) return;
                let best = null;
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const idx = Number(entry.target.dataset.index);
                        if (best === null || idx > best) best = idx;
                    }
                });
                if (best !== null && best !== activeIndex) setActive(best);
            }, { rootMargin: '-40% 0px -40% 0px', threshold: 0 });
            evtItems.forEach(item => spy.observe(item));
        } else {
            setActive(0);
        }
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
