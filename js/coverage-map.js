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
        [250, { name: 'France',        coverage: 0.85, group: 'fondateur', flag: '\u{1F1EB}\u{1F1F7}',
                desc: 'Coeur historique du réseau. La quasi-totalité du territoire est desservie par la MLTC, permise par un maillage dense avec des services à toute échelle.',
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity'] }],
        [276, { name: 'Allemagne',     coverage: 0.75, group: 'fondateur', flag: '\u{1F1E9}\u{1F1EA}',
                desc: "Forte implantation, concentrée dans les régions de l'Ouest (ancien périmètre WME). L'Est, intégré plus tardivement, est moins densément couvert à l'échelle plus locale.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Urbahn','Intracity'] }],
        [56,  { name: 'Belgique',      coverage: 0.75, group: 'fondateur', flag: '\u{1F1E7}\u{1F1EA}',
                desc: "Couverture dense héritée de la CCFM, sur l'ensemble du territoire belge. Les services grandes lignes et régionaux sont largement assurés par la MLTC, tandis que les dessertes périurbaines restent majoritairement aux opérateurs locaux.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity'] }],
        [528, { name: 'Pays-Bas',      coverage: 0.70, group: 'fondateur', flag: '\u{1F1F3}\u{1F1F1}',
                desc: 'Couverture héritée de la CCFM (connue localement sous le nom MSVM, Maatschappij der Spoorwegen van het Mathlyens) sur les grandes lignes et le régional. La plupart des services périurbains restent gérés par les opérateurs locaux.',
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity'] }],
        [442, { name: 'Luxembourg',    coverage: 0.90, group: 'fondateur', flag: '\u{1F1F1}\u{1F1FA}',
                desc: 'Le réseau ferré du Luxembourg est celui le plus intégré à la MLTC, qui y opère tous les services principaux.',
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity'] }],
        [826, { name: 'Royaume-Uni',   coverage: 0.60, group: 'fondateur', flag: '\u{1F1EC}\u{1F1E7}',
                desc: "Présence concentrée dans l'Angleterre (héritage MSER). Une grande partie des services urbains restent opérés sous franchises locales, idem pour les services régionaux dans le nord.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity'] }],
        [380, { name: 'Italie',        coverage: 0.55, group: 'fondateur', flag: '\u{1F1EE}\u{1F1F9}',
                desc: "Seul pays fondateur où la compagnie nationale est restée dominante. La MLTC y est implantée principalement sur les grandes lignes et quelques services régionaux, tandis que les lignes secondaires restent sous opérateurs locaux.",
                services: ['HSX','Xpress','TransRegio','Nocrail','Intracity'] }],
        [40,  { name: 'Autriche',      coverage: 0.65, group: 'expansion', flag: '\u{1F1E6}\u{1F1F9}',
                desc: 'Couverture étendue, sur les corridors internationaux comme sur les lignes intérieures.',
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Urbahn','Intracity'] }],
        [756, { name: 'Suisse',        coverage: 0.65, group: 'expansion', flag: '\u{1F1E8}\u{1F1ED}',
                desc: "Bonne couverture des lignes à écartement standard. Les lignes métriques (réseaux alpins) restent confiées aux opérateurs spécialisés.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Urbahn','Intracity'] }],
        [208, { name: 'Danemark',      coverage: 0.45, group: 'expansion', flag: '\u{1F1E9}\u{1F1F0}',
                desc: "Desserte de la partie sud du pays, du Schleswig jusqu'à Copenhague. Les lignes au nord restent sous l'opérateur national.",
                services: ['HSX','Xpress','Vivarail','Nocrail'] }],
        [203, { name: 'Tchéquie',      coverage: 0.40, group: 'expansion', flag: '\u{1F1E8}\u{1F1FF}',
                desc: "Implantation concentrée dans les régions de l'Ouest, principalement en Bohême. L'est du pays reste sous opérateurs locaux.",
                services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity'] }],
        [724, { name: 'Espagne',       coverage: 0.40, group: 'expansion', flag: '\u{1F1EA}\u{1F1F8}',
                desc: "Desserte concentrée au nord du pays, de la frontière française jusqu'à Madrid. Hormis un axe allant jusqu'à Séville, le sud reste majoritairement sous l'opérateur national.",
                services: ['HSX','Xpress','Vivarail','Nocrail'] }],
    ]);

    /* ---- Échelle de couverture ------------------------------------------
       Cinq paliers discrets plutôt qu'un dégradé d'opacité continu : sur fond
       sombre, les faibles opacités devenaient indiscernables du fond et la
       légende « Faible / Forte » n'était rattachable à aucune forme précise.
       Chaque palier est une couleur pleine, nommée, reprise telle quelle dans
       la légende, qui est construite depuis ce tableau pour ne pas dériver.

       Le plus sombre tient 3,45:1 contre le fond de page (l'ancien dégradé
       tombait à 1,51:1 pour l'Espagne et la Tchéquie, quasi invisibles), et
       deux paliers voisins restent nettement séparés à l'oeil. */
    const LEVELS = [
        { max: 0.50, label: 'Ciblée',    fill: '#6a6096' },
        { max: 0.62, label: 'Partielle', fill: '#7a63c4' },
        { max: 0.72, label: 'Étendue',   fill: '#8f74e6' },
        { max: 0.82, label: 'Dense',     fill: '#a98ef8' },
        { max: 1.01, label: 'Intégrale', fill: '#c9bcfd' }
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
