// Histoire - Carte de couverture du réseau MLTC
//
// Le fond de carte vient de js/coverage-map-data.js, versé dans le dépôt :
// aucun appel réseau, aucune bibliothèque externe, fonctionne hors ligne et
// en file://. La projection Mercator reste celle de circulations.js.
(function () {
    'use strict';

    const svgEl = document.querySelector('.cov-map');
    if (!svgEl) return;
    const wrap = svgEl.closest('.cov-map-wrap');

    /* ---- Country data (ISO numeric → info) ---- */
    const COUNTRIES = new Map([
        [250, { name: 'France',      coverage: 0.85, group: 'fondateur',
                desc: "Cœur historique du réseau, hérité de la CCFM. La MLTC y assure la quasi-totalité des services ; la SNCF garde quelques lignes secondaires et une part du fret que la MLCC ne couvre pas.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity'] }],
        [276, { name: 'Allemagne',   coverage: 0.75, group: 'fondateur',
                desc: "Implantation dense à l'Ouest, ancien périmètre de la WME. L'Est, intégré à partir de 2001, reste moins couvert à l'échelle locale.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Urbahn','Intracity'] }],
        [56,  { name: 'Belgique',    coverage: 0.75, group: 'fondateur',
                desc: "Héritage de la CCFM, présente depuis 1962. La SNCB conserve quelques dessertes locales et périurbaines.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity'] }],
        [528, { name: 'Pays-Bas',    coverage: 0.70, group: 'fondateur',
                desc: "Héritage de la CCFM, connue ici sous le nom de MSVM jusqu'en 2001. Les NS conservent une partie des dessertes périurbaines.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity'] }],
        [442, { name: 'Luxembourg',  coverage: 0.90, group: 'fondateur',
                desc: "Le réseau le plus intégré à la MLTC, qui y assure tous les services principaux. Héritage de la CCFM, connue ici sous le nom de GEVM jusqu'en 2001.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity'] }],
        [826, { name: 'Royaume-Uni', coverage: 0.60, group: 'fondateur',
                desc: "Héritage de la MSER dans le sud de l'Angleterre, étendu en 2007 jusqu'aux grandes villes écossaises. Les compagnies privées issues de la privatisation de British Rail subsistent, avec un rôle bien moindre.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity'] }],
        [380, { name: 'Italie',      coverage: 0.55, group: 'fondateur',
                desc: "Seul pays fondateur où la compagnie nationale reste dominante. La MLTC est implantée dans le nord (Lombardie, Piémont, Vénétie), sur les liaisons rapides et régionales ; Trenitalia garde le centre et le sud.",
                services: ['HSX','Xpress','TransRegio','Nocrail','Intracity'] }],
        [40,  { name: 'Autriche',    coverage: 0.65, group: 'expansion',
                desc: "Présence sur les corridors internationaux comme sur de nombreuses lignes intérieures, depuis 2005.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Urbahn','Intracity'] }],
        [756, { name: 'Suisse',      coverage: 0.65, group: 'expansion',
                desc: "Présence sur les lignes à écartement standard depuis 2005. Les réseaux métriques des Alpes restent aux opérateurs spécialisés.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Urbahn','Intracity'] }],
        [208, { name: 'Danemark',    coverage: 0.45, group: 'expansion',
                desc: "Présence surtout dans le sud du pays et sur les grands axes jusqu'à Copenhague, prolongés vers la Suède par le pont de l'Øresund. Le reste du réseau reste à la DSB.",
                services: ['HSX','Xpress','Vivarail','Nocrail'] }],
        [203, { name: 'Tchéquie',    coverage: 0.40, group: 'expansion',
                desc: "Implantation concentrée à l'ouest du pays, principalement en Bohême. L'est reste aux České dráhy.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity'] }],
        [724, { name: 'Espagne',     coverage: 0.40, group: 'expansion',
                desc: "Présence concentrée dans le nord, de la frontière française à Barcelone et Madrid, avec un axe jusqu'à Séville. Le reste du réseau reste à la Renfe.",
                services: ['HSX','Xpress','Vivarail','Nocrail'] }],
    ]);

    /* ---- Échelle de couverture ------------------------------------------
       Quatre paliers d'une seule teinte, du plus clair (couverture ciblée)
       au plus foncé (quasi totale) ; le sens s'inverse en thème sombre. Les
       couleurs vivent dans css/histoire.css (--cov-l1 à --cov-l4), pour
       suivre le thème : ici, seulement le seuil, le nom et la variable.
       Paliers vérifiés : luminosité monotone, palier le plus faible au-dessus
       de 2:1 contre le fond de page dans les deux thèmes. */
    const LEVELS = [
        { max: 0.50, label: 'Ciblée',      fill: 'var(--cov-l1)' },
        { max: 0.68, label: 'Partielle',   fill: 'var(--cov-l2)' },
        { max: 0.82, label: 'Étendue',     fill: 'var(--cov-l3)' },
        { max: 1.01, label: 'Quasi totale', fill: 'var(--cov-l4)' }
    ];
    const levelOf = r => LEVELS.find(l => r < l.max) || LEVELS[LEVELS.length - 1];

    /* ---- Panneau de détail ---- */
    const panel  = document.getElementById('cov-tooltip');
    const ttName = document.getElementById('cov-tt-name');
    const ttBar  = document.getElementById('cov-tt-bar');
    const ttDesc = document.getElementById('cov-tt-desc');
    const ttSvc  = document.getElementById('cov-tt-services');
    const ttGroup = document.getElementById('cov-tt-group');
    const ttLevel = document.getElementById('cov-tt-level');

    let activeShape = null;

    function showDetail(info, shape) {
        if (activeShape && activeShape !== shape) activeShape.classList.remove('cov-active');
        activeShape = shape || null;
        if (shape) shape.classList.add('cov-active');

        const lvl = levelOf(info.coverage);
        ttName.textContent  = info.name;
        ttBar.style.width   = (info.coverage * 100) + '%';
        ttBar.style.background = lvl.fill;
        ttDesc.textContent  = info.desc;
        ttGroup.textContent = info.group === 'fondateur' ? 'Pays fondateur' : "Pays d'expansion";
        ttLevel.textContent = 'Couverture ' + lvl.label.toLowerCase();
        ttSvc.innerHTML = '';
        info.services.forEach(s => {
            const pill = document.createElement('span');
            pill.className = 'ht-svc-pill';
            pill.textContent = s;
            ttSvc.appendChild(pill);
        });
        panel.classList.add('cov-has-country');
    }

    /* ---- Projection (même logique Mercator que circulations.js) ---- */
    const NS  = 'http://www.w3.org/2000/svg';
    const W   = 800, H = 650, PAD = 24;

    function mercY(lat) {
        const r = lat * Math.PI / 180;
        return Math.log(Math.tan(Math.PI / 4 + r / 2));
    }

    function geoBounds(geoms) {
        let minLon = Infinity, maxLon = -Infinity,
            minLat = Infinity, maxLat = -Infinity;
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
        const rings = g.type === 'MultiPolygon'
            ? g.coordinates.flatMap(p => p) : g.coordinates;
        return rings.map(r => ringD(r, proj)).join('');
    }

    /* ---- Légende, construite depuis LEVELS ---- */
    function buildLegend() {
        const host = wrap.querySelector('.cov-legend-scale');
        if (!host) return;
        host.innerHTML = '';
        LEVELS.forEach(l => {
            const item = document.createElement('span');
            item.className = 'cov-legend-item';
            const sw = document.createElement('span');
            sw.className = 'cov-legend-swatch';
            sw.style.background = l.fill;
            item.appendChild(sw);
            item.appendChild(document.createTextNode(l.label));
            host.appendChild(item);
        });
    }

    /* ---- États ---- */
    function setStatus(state, message) {
        wrap.dataset.state = state;
        const box = wrap.querySelector('.cov-status');
        if (box) box.textContent = message || '';
    }

    /* ---- Construction ---- */
    function buildMap() {
        const geo = window.COV_GEO;
        if (!geo || !geo.membres) {
            setStatus('error', "Le fond de carte n'a pas pu être chargé.");
            return;
        }

        const members = [];
        COUNTRIES.forEach((info, id) => {
            const g = geo.membres[id];
            if (g) members.push({ id: id, info: info, geom: g });
        });
        if (!members.length) {
            setStatus('error', "Le fond de carte ne contient aucun pays membre.");
            return;
        }

        /* Le cadrage est calculé sur les seuls pays membres : les voisins
           dessinés en fond débordent volontairement et sont rognés. */
        const proj = fitProjection(geoBounds(members.map(m => m.geom)));
        svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

        const gContext = document.createElementNS(NS, 'g');
        gContext.setAttribute('class', 'cov-layer-context');
        gContext.setAttribute('aria-hidden', 'true');
        (geo.contexte || []).forEach(g => {
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('class', 'cov-context-shape');
            p.setAttribute('d', pathD(g, proj));
            gContext.appendChild(p);
        });
        svgEl.appendChild(gContext);

        const gMembers = document.createElementNS(NS, 'g');
        gMembers.setAttribute('class', 'cov-layer-members');
        svgEl.appendChild(gMembers);

        members.forEach(m => {
            const lvl = levelOf(m.info.coverage);

            const g = document.createElementNS(NS, 'g');
            g.setAttribute('class', 'cov-country');
            g.dataset.country = m.info.name;
            /* Le survol était le seul moyen d'atteindre un pays : le groupe
               devient focusable et annonce son nom, pour que la carte soit
               utilisable au clavier et par un lecteur d'écran. */
            g.setAttribute('tabindex', '0');
            g.setAttribute('role', 'button');
            g.setAttribute('aria-label',
                m.info.name + ', couverture ' + lvl.label.toLowerCase());

            const path = document.createElementNS(NS, 'path');
            path.setAttribute('class', 'cov-shape');
            path.setAttribute('d', pathD(m.geom, proj));
            path.style.fill = lvl.fill;
            g.appendChild(path);

            const activate = () => showDetail(m.info, g);
            g.addEventListener('mouseenter', activate);
            g.addEventListener('focus', activate);
            g.addEventListener('click', activate);
            g.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
            });

            gMembers.appendChild(g);
        });

        buildLegend();
        setStatus('ready', '');
    }

    setStatus('loading', 'Chargement de la carte...');
    try {
        buildMap();
    } catch (err) {
        console.error('[CoverageMap]', err);
        setStatus('error', "La carte n'a pas pu être affichée.");
    }
})();
