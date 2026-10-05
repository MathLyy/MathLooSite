// MLTC - Circulations : carte géographique du Mathlyens
// Renders 12 member countries from world-atlas TopoJSON with Mercator projection
(function () {
    'use strict';

    /* ---- ISO 3166-1 numeric → Mathlyens display name ---- */
    const COUNTRY_IDS = new Map([
        [250, 'France'],        [826, 'Royaume-Uni'],
        [56,  'Belgique'],      [528, 'Pays-Bas'],
        [442, 'Luxembourg'],    [276, 'Allemagne'],
        [208, 'Danemark'],      [724, 'Espagne'],
        [380, 'Italie'],        [40,  'Autriche'],
        [203, 'République tchèque'], [756, 'Suisse']
    ]);

    /* ---- Historique : quatre époques, sur neuf pays seulement ---- */
    const EPOCHS = ['1958-1973', '1973-1984', '1984-1997', '1997-2001'];
    const HISTORIC_COUNTRIES = new Set(['France', 'Royaume-Uni', 'Belgique', 'Pays-Bas', 'Luxembourg',
        'Allemagne', 'Danemark', 'Suisse', 'Italie']);

    /* ---- Operator groupings (used by the operator tab strip) ---- */
    const OPERATOR_SERVICES = {
        mltc:   ['HSX', 'Xpress', 'TransRegio', 'Vivarail', 'Nocrail', 'Frail', 'Urbahn', 'Intracity'],
        prives: ['SanGo!', 'CFP'],
        fret:   ['MLCC', 'MLUP', 'MLTC Infrastructures']
    };
    const OPERATOR_LABELS = {
        mltc:   'MLTC Railways',
        prives: 'Autres opérateurs',
        fret:   'Fret et infra'
    };
    /* Onglets toujours présents ; « Autres opérateurs » n'apparaît que dans
       les pays qui en ont (la France aujourd'hui). */
    const ALWAYS_TABS = ['mltc', 'fret'];
    const SERVICE_TO_OPERATOR = (() => {
        const map = {};
        Object.keys(OPERATOR_SERVICES).forEach(op => {
            OPERATOR_SERVICES[op].forEach(s => { map[s] = op; });
        });
        return map;
    })();
    let activeOperator = 'mltc';

    /* ---- DOM refs ---- */
    const svgEl    = document.querySelector('.circ-map');
    const layoutEl = document.getElementById('circ-layout');
    const panelEl  = document.getElementById('circ-panel');
    const titleEl  = document.getElementById('circ-country-name');
    const descEl   = document.getElementById('circ-country-desc');
    const listEl   = document.getElementById('circ-list');
    const emptyEl  = document.getElementById('circ-empty');
    const compsEl  = document.querySelector('.circ-compositions');
    const searchEl = document.getElementById('circ-search');
    const filterEl = document.getElementById('circ-filter');
    const hintEl   = document.getElementById('circ-map-hint');
    const rerollEl = document.getElementById('circ-reroll');
    const opTabs   = Array.from(document.querySelectorAll('.circ-op-tab'));
    const tabsEl   = document.querySelector('.circ-operator-tabs');
    const periodBtns = Array.from(document.querySelectorAll('.circ-period-btn[data-period]'));
    const epochsEl   = document.querySelector('.circ-epochs');
    const epochBtns  = Array.from(document.querySelectorAll('.circ-period-btn[data-epoch]'));

    /* Compositions (js/compositions.js) : chemins depuis la racine du site,
       rames vues dans le sens gauche, 3 tirées au hasard par service. */
    const Compo       = window.MltcCompo;
    const BASE        = '../';
    const MAP_OPTS    = { direction: 'L', reversed: false };
    const PER_SERVICE = 3;

    const DEFAULT_TITLE = 'Sélectionnez un pays';
    const DEFAULT_DESC = 'Choisissez un territoire sur la carte pour afficher les services, compositions et variantes associées.';
    const HISTORIC_HINT = 'Historique : France, Royaume-Uni, Benelux, Allemagne, Danemark, Suisse et Italie.';

    let shapes = [];
    let DATA = {};
    let activeCountry = null;
    let byCountry = {};         // pays -> [{ service, train }]
    let historic = false;       // période : services d'avant 2001 (CCFM, WME, MSER)
    let epoch = EPOCHS[0];      // époque affichée en historique
    let renderToken = 0;

    /* ---- Helpers ---- */
    const esc = s => (s || '').replace(/[&<>"]/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

    function setEmpty(vis) {
        if (emptyEl) emptyEl.classList.toggle('hidden', !vis);
    }

    function setLayoutState(active) {
        if (layoutEl) {
            layoutEl.classList.toggle('is-active', active);
            layoutEl.dataset.state = active ? 'active' : 'idle';
        }
        if (panelEl) {
            panelEl.setAttribute('aria-hidden', String(!active));
            if ('inert' in panelEl) panelEl.inert = !active;
        }
        updateHint(active);
    }

    function updateHint(active) {
        if (!hintEl) return;
        if (active || !historic) hintEl.textContent = '';
        else hintEl.textContent = Object.keys(byCountry).some(countryHasData)
            ? HISTORIC_HINT : epoch + ' : aucune composition renseignée pour l’instant.';
    }

    function clearList() {
        listEl.innerHTML = '';
        setEmpty(false);
    }

    function resetView() {
        clearActive();
        searchEl.value = '';
        filterEl.value = '';
        titleEl.textContent = DEFAULT_TITLE;
        clearList();
        setLayoutState(false);
    }

    /* Circulations du pays pour la période choisie : [{ service, train }].
       En historique, un train sans « epoques » vaut pour les quatre. */
    function periodEntries(name) {
        if (historic && !HISTORIC_COUNTRIES.has(name)) return [];
        return (byCountry[name] || []).filter(e => Compo.isHistoric(DATA, e.service) === historic
            && (!historic || inEpoch(e.train)));
    }

    function inEpoch(t) {
        return !Array.isArray(t.epoques) || !t.epoques.length || t.epoques.indexOf(epoch) >= 0;
    }

    function isOff(name) {
        return historic && !HISTORIC_COUNTRIES.has(name);
    }

    /* ... et, aujourd'hui, pour l'onglet actif. */
    function getCountryEntries(name) {
        return periodEntries(name).filter(e => historic || operatorOf(e.service) === activeOperator);
    }

    function countryHasData(name) {
        return periodEntries(name).length > 0;
    }

    /* Pays qui ont des circulations pour la période : en couleur sur la carte.
       En historique, les pays hors période s'estompent et ne se cliquent plus. */
    function paintCountries() {
        shapes.forEach(s => {
            const off = isOff(s.dataset.country);
            s.classList.toggle('has-data', countryHasData(s.dataset.country));
            s.classList.toggle('is-off', off);
            s.setAttribute('tabindex', off ? '-1' : '0');
            s.setAttribute('aria-disabled', String(off));
        });
    }

    function operatorOf(service) {
        return SERVICE_TO_OPERATOR[service] || 'mltc';
    }

    /* Regroupe par service (ordre alphabétique) et mélange chaque groupe.
       limit : nombre gardé par service (0 = tous). */
    function pickEntries(entries, limit) {
        const groups = new Map();
        entries.forEach(e => {
            if (!groups.has(e.service)) groups.set(e.service, []);
            groups.get(e.service).push(e);
        });
        const out = [];
        Array.from(groups.keys()).sort((a, b) => a.localeCompare(b)).forEach(service => {
            const list = Compo.shuffle(groups.get(service));
            out.push.apply(out, limit ? list.slice(0, limit) : list);
        });
        return out;
    }

    function refreshServiceFilter() {
        if (!filterEl) return;
        const previous = filterEl.value;
        const services = historic ? (DATA.historiques || []) : (OPERATOR_SERVICES[activeOperator] || []);
        const opts = ['<option value="">Tous les services</option>']
            .concat(services.map(s => '<option value="' + esc(s) + '">' + esc(s) + '</option>'));
        filterEl.innerHTML = opts.join('');
        // Preserve previous selection only if still valid in the new operator group
        if (previous && services.indexOf(previous) !== -1) {
            filterEl.value = previous;
        } else {
            filterEl.value = '';
        }
    }

    function setActiveOperator(op) {
        if (!OPERATOR_SERVICES[op] || op === activeOperator) return;
        activeOperator = op;
        opTabs.forEach(t => {
            const on = t.dataset.operator === op;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        refreshServiceFilter();
        if (activeCountry) {
            applyFilter();
        }
    }

    function renderEntries(entries, options) {
        const opts = options || {};
        const token = ++renderToken;
        titleEl.textContent = opts.title || DEFAULT_TITLE;
        setLayoutState(Boolean(opts.active));

        if (compsEl) compsEl.classList.add('is-updating');

        window.setTimeout(() => {
            if (token !== renderToken) return;

            if (!entries.length) {
                listEl.innerHTML = '';
                if (emptyEl && opts.emptyMessage) emptyEl.textContent = opts.emptyMessage;
                setEmpty(true);
            } else {
                setEmpty(false);
                listEl.innerHTML = entries.map(itemHTML).join('');
                wireScrollSync();
                wireRouteExpand();
            }

            requestAnimationFrame(() => {
                if (token !== renderToken) return;
                if (compsEl) compsEl.classList.remove('is-updating');
            });
        }, 120);
    }

    /* Versions d'un train montrées sur la carte : la base, et chaque
       variante qui a ses propres pays (une rame par tronçon du trajet, par
       exemple avant et après un changement de locomotive). Chaque version
       est le train tel qu'il circule : { service, train: réglages fusionnés }. */
    function mapVersions(e) {
        const out = [{ service: e.service, train: Compo.scenario(DATA, e.service, e.train, 0) }];
        (Array.isArray(e.train.variants) ? e.train.variants : []).forEach((v, i) => {
            if (v && Array.isArray(v.countries)) {
                out.push({ service: e.service, train: Compo.scenario(DATA, e.service, e.train, i + 1) });
            }
        });
        return out;
    }

    /* Index pays -> circulations. Un train sans pays ne circule que sur la
       page Trafic ; un nom de pays inconnu de la carte est signalé. */
    function buildCountryIndex() {
        byCountry = {};
        const known = new Set(COUNTRY_IDS.values());
        Compo.trains(DATA).forEach(e => mapVersions(e).forEach(v => {
            (Array.isArray(v.train.countries) ? v.train.countries : []).forEach(c => {
                if (!known.has(c)) console.warn('[Circulations] pays inconnu de la carte : ' + c);
                if (!byCountry[c]) byCountry[c] = [];
                if (byCountry[c].indexOf(v) < 0) byCountry[c].push(v);
            });
        }));
    }

    /* shared onload: size to native pixels, then update scroll spacer */
    const IMG_ONLOAD = `this.style.width=this.naturalWidth+'px';this.style.height=this.naturalHeight+'px';var el=this;requestAnimationFrame(function(){var w=el.closest('.circ-consist-wrap');if(w){var s=w.querySelector('.circ-scroll-spacer');if(s)s.style.width=el.closest('.circ-consist').scrollWidth+'px'}})`;

    /* Rame résolue ({ src } ou attelage { src, coupler, overlap, bottom }). */
    function buildVehicleRow(list) {
        const total = list.length;
        const imgs = list.map((v, i) => {
            const src = esc(BASE + v.src);
            if (v.coupler) {
                return `<img class="circ-coupler-img" style="z-index:${total + 1};margin-bottom:${v.bottom}px;margin-left:-${v.overlap}px;margin-right:-${v.overlap}px" draggable="false" src="${src}" alt="" onload="${IMG_ONLOAD}">`;
            }
            return `<img class="circ-train-img" style="z-index:${total - i}" draggable="false" src="${src}" alt="" onload="${IMG_ONLOAD}">`;
        }).join('');
        return `<div class="circ-vehicle-row">${imgs}</div>`;
    }

    function buildConsistBlock(trainContent) {
        return `<div class="circ-consist-wrap">
                    <div class="circ-consist">
                        <div class="circ-consist-inner">
                            ${trainContent}
                            <div class="circ-track"></div>
                        </div>
                    </div>
                    <div class="circ-scroll"><div class="circ-scroll-spacer"></div></div>
                </div>`;
    }

    /* Rame d'une circulation, tirée au hasard à chaque affichage. Si son
       arrêt change la rame (changement de locomotive, dételage, attelage),
       c'est la rame d'après l'arrêt qui circule dans les pays de la version. */
    function consistHTML(e) {
        const cfg = e.train;
        let list = Compo.resolve(cfg.composition, MAP_OPTS);
        const st = cfg.stop;
        if (st && (st.loco_change || (st.attach && st.attach.length) || st.detach_count)) {
            list = Compo.afterStop(list, st, MAP_OPTS);
        }
        return list.length ? buildConsistBlock(buildVehicleRow(list)) : '';
    }

    function itemHTML(e) {
        const t = e.train;
        const stops = Array.isArray(t.route) ? t.route : [];
        const nameHTML = t.name ? `<span class="circ-route-name">${esc(t.name)}</span>` : '';

        /* Route: show departure → terminus, expandable to full */
        let routeHTML;
        if (stops.length > 2) {
            const mid = stops.slice(1, -1).map(s => '<span class="circ-route-mid">' + esc(s) + '</span>').join(' → ');
            routeHTML = `<h4 class="circ-route">${nameHTML}`
                + `<span class="circ-route-origin">${esc(stops[0])}&ensp;→&ensp;</span>`
                + `<span class="circ-route-stops" hidden>${mid}&ensp;→&ensp;</span>`
                + `<span class="circ-route-dest">${esc(stops[stops.length - 1])}</span>`
                + `<button class="circ-route-toggle" aria-label="Afficher le trajet complet" title="Trajet complet">`
                + `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`
                + `</button></h4>`;
        } else if (stops.length) {
            routeHTML = `<h4>${nameHTML}${esc(stops.join(' → '))}</h4>`;
        } else {
            routeHTML = `<h4>${esc(t.name || e.service)}</h4>`;
        }
        const detailHTML = t.detail ? `<span class="circ-item-detail">${esc(t.detail)}</span>` : '';

        return `
            <li class="circ-item">
                <div class="circ-item-head">
                    <span class="circ-item-service" data-service="${esc(e.service)}">${esc(e.service)}</span>
                    ${routeHTML}
                    ${detailHTML}
                </div>
                ${consistHTML(e)}
            </li>`;
    }

    /* ---- Rendering ---- */

    /** Toggle collapsed/expanded route on click */
    function wireRouteExpand() {
        document.querySelectorAll('.circ-route-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const h4 = btn.closest('.circ-route');
                const stops = h4.querySelector('.circ-route-stops');
                const open  = !stops.hidden;
                if (open) {
                    stops.classList.add('circ-route-leaving');
                    stops.addEventListener('transitionend', function handler() {
                        stops.removeEventListener('transitionend', handler);
                        stops.hidden = true;
                        stops.classList.remove('circ-route-leaving');
                    });
                } else {
                    stops.hidden = false;
                    stops.classList.add('circ-route-entering');
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            stops.classList.remove('circ-route-entering');
                        });
                    });
                }
                btn.classList.toggle('circ-route-open', !open);
            });
        });
    }

    /** Wire scroll-sync between hidden-overflow frame and visible scrollbar below */
    function wireScrollSync() {
        document.querySelectorAll('.circ-consist-wrap').forEach(wrap => {
            const frame = wrap.querySelector('.circ-consist');
            const bar   = wrap.querySelector('.circ-scroll');
            if (!frame || !bar) return;
            bar.addEventListener('scroll', () => { frame.scrollLeft = bar.scrollLeft; });
        });
    }

    function clearActive() {
        shapes.forEach(s => s.classList.remove('active'));
        activeCountry = null;
    }

    function getAvailableOperators(name) {
        const ops = new Set(ALWAYS_TABS);
        periodEntries(name).forEach(e => ops.add(operatorOf(e.service)));
        return ops;
    }

    function updateOperatorTabsVisibility(name) {
        /* Historique : pas d'onglets, les compagnies d'avant 2001 seulement. */
        if (tabsEl) tabsEl.hidden = historic;
        const available = getAvailableOperators(name);
        opTabs.forEach(t => {
            const op = t.dataset.operator;
            const show = available.has(op);
            t.hidden = !show;
        });
        if (!available.has(activeOperator)) {
            const fallback = available.has('mltc') ? 'mltc' : (Array.from(available)[0] || 'mltc');
            if (fallback !== activeOperator) {
                activeOperator = fallback;
                opTabs.forEach(t => {
                    const on = t.dataset.operator === fallback;
                    t.classList.toggle('active', on);
                    t.setAttribute('aria-selected', on ? 'true' : 'false');
                });
                refreshServiceFilter();
            }
        }
    }

    /* Vue par défaut d'un pays : au plus PER_SERVICE circulations par
       service, tirées au hasard à chaque affichage. */
    function selectCountry(name) {
        clearActive();
        activeCountry = name;
        const shape = shapes.find(s => s.dataset.country === name);
        if (shape) shape.classList.add('active');
        updateOperatorTabsVisibility(name);
        renderEntries(pickEntries(getCountryEntries(name), PER_SERVICE), {
            active: true,
            title: name,
            emptyMessage: historic
                ? 'Aucune composition n’est renseignée pour ce pays en ' + epoch + '.'
                : 'Aucune circulation ' + OPERATOR_LABELS[activeOperator] + ' n’est renseignée pour ce pays.'
        });
        if (window.innerWidth < 768) {
            panelEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /* ---- Search / filter ---- */

    function applyFilter() {
        const q       = (searchEl.value || '').toLowerCase().trim();
        const service = (filterEl.value || '').toLowerCase().trim();
        if (!activeCountry) {
            resetView();
            return;
        }
        if (!q && !service) {
            selectCountry(activeCountry);
            return;
        }
        /* Recherche et filtre portent sur toutes les circulations du pays. */
        const results = getCountryEntries(activeCountry).filter(e => {
            const t = e.train;
            const blob = [activeCountry, e.service, t.name, (t.route || []).join(' '), t.detail]
                .filter(Boolean).join(' ').toLowerCase();
            return (!q || blob.includes(q)) && (!service || e.service.toLowerCase() === service);
        });
        renderEntries(pickEntries(results, 0), {
            active: true,
            title: activeCountry,
            emptyMessage: 'Aucun résultat pour cette sélection.'
        });
    }

    /* ---- Période : aujourd'hui ou historique, et son époque ---- */

    function pressOne(btns, isOn) {
        btns.forEach(b => {
            const on = isOn(b);
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    function periodChanged() {
        searchEl.value = '';
        refreshServiceFilter();
        paintCountries();
        if (activeCountry && !isOff(activeCountry)) selectCountry(activeCountry);
        else if (activeCountry) resetView();
        else updateHint(false);
    }

    function setPeriod(period) {
        const next = period === 'historique';
        if (next === historic) return;
        historic = next;
        pressOne(periodBtns, b => (b.dataset.period === 'historique') === historic);
        if (epochsEl) epochsEl.hidden = !historic;
        periodChanged();
    }

    function setEpoch(next) {
        if (next === epoch || EPOCHS.indexOf(next) < 0) return;
        epoch = next;
        pressOne(epochBtns, b => b.dataset.epoch === epoch);
        periodChanged();
    }

    /* ---- Wire SVG shapes ---- */

    function wireShapes() {
        shapes.forEach(s => {
            const country = s.dataset.country;
            if (!country) return;
            s.setAttribute('tabindex', '0');
            s.setAttribute('role', 'button');
            s.setAttribute('aria-label', country + ' - voir les compositions');
            s.addEventListener('click', (e) => {
                if (isOff(country)) return;     // comme un clic dans le vide
                e.stopPropagation();
                searchEl.value = '';
                filterEl.value = '';
                selectCountry(country);
            });
            s.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.click(); }
            });
        });
        svgEl.addEventListener('click', () => {
            resetView();
        });
    }

    /* ==========================================================
       MAP BUILDER - Mercator projection of TopoJSON world-atlas
       ========================================================== */

    const NS  = 'http://www.w3.org/2000/svg';
    const W   = 800;
    const H   = 650;
    const PAD = 24;

    function mercY(lat) {
        const r = lat * Math.PI / 180;
        return Math.log(Math.tan(Math.PI / 4 + r / 2));
    }

    /** Keep only polygon rings whose centroid falls in Europe */
    function europeanOnly(feature) {
        const inEurope = (ring) => {
            let sLon = 0, sLat = 0;
            ring.forEach(c => { sLon += c[0]; sLat += c[1]; });
            const aLon = sLon / ring.length, aLat = sLat / ring.length;
            return aLat > 34 && aLat < 65 && aLon > -12 && aLon < 25;
        };
        const g = feature.geometry;
        let coords;
        if (g.type === 'MultiPolygon') {
            coords = g.coordinates.filter(poly => inEurope(poly[0]));
            if (!coords.length) return null;
        } else {
            if (!inEurope(g.coordinates[0])) return null;
            coords = g.coordinates;
        }
        return { ...feature, geometry: { ...g, coordinates: coords } };
    }

    /** Compute geographic bounding box of features */
    function geoBounds(features) {
        let minLon = Infinity, maxLon = -Infinity,
            minLat = Infinity, maxLat = -Infinity;
        const scan = coords => coords.forEach(([lon, lat]) => {
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        });
        features.forEach(f => {
            const g = f.geometry;
            if (g.type === 'Polygon') g.coordinates.forEach(scan);
            else g.coordinates.forEach(p => p.forEach(scan));
        });
        return { minLon, maxLon, minLat, maxLat };
    }

    /** Build a Mercator projection function that fits bounds into the SVG */
    function fitProjection(bounds) {
        const { minLon, maxLon, minLat, maxLat } = bounds;
        const toR = Math.PI / 180;
        const myMin = mercY(minLat), myMax = mercY(maxLat);
        const geoW = (maxLon - minLon) * toR;
        const geoH = myMax - myMin;
        const uw = W - 2 * PAD, uh = H - 2 * PAD;
        const s = Math.min(uw / geoW, uh / geoH);
        const mw = geoW * s, mh = geoH * s;
        const ox = PAD + (uw - mw) / 2;
        const oy = PAD + (uh - mh) / 2;
        return (lon, lat) => [
            (lon * toR - minLon * toR) * s + ox,
            (myMax - mercY(lat)) * s + oy
        ];
    }

    /** Convert a coordinate ring to SVG path d string */
    function ringD(ring, proj) {
        return ring.map((c, i) => {
            const [x, y] = proj(c[0], c[1]);
            return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
        }).join('') + 'Z';
    }

    /** Convert a GeoJSON feature geometry to a full SVG path d */
    function featureD(f, proj) {
        const g = f.geometry;
        const rings = g.type === 'MultiPolygon'
            ? g.coordinates.flatMap(p => p)
            : g.coordinates;
        return rings.map(r => ringD(r, proj)).join('');
    }

    /** Fetch TopoJSON, project to Mercator, render SVG country shapes */
    async function buildMap() {
        const resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        if (!resp.ok) throw new Error('Carte : HTTP ' + resp.status);
        const world = await resp.json();

        // TopoJSON → GeoJSON
        const all = topojson.feature(world, world.objects.countries);

        // Keep only Mathlyens members, European territories only
        let features = all.features
            .filter(f => COUNTRY_IDS.has(Number(f.id)))
            .map(europeanOnly)
            .filter(Boolean);

        // Projection
        const bounds = geoBounds(features);
        const proj   = fitProjection(bounds);
        svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

        // Render each country as a <g><path/></g>
        features.forEach(f => {
            const name = COUNTRY_IDS.get(Number(f.id));

            const g = document.createElementNS(NS, 'g');
            g.classList.add('circ-country');
            g.dataset.country = name;

            const title = document.createElementNS(NS, 'title');
            title.textContent = name;
            g.appendChild(title);

            const path = document.createElementNS(NS, 'path');
            path.classList.add('circ-shape');
            path.setAttribute('d', featureD(f, proj));
            g.appendChild(path);

            svgEl.appendChild(g);
        });

        // Populate shapes reference
        shapes = Array.from(svgEl.querySelectorAll('.circ-country'));

        // Tighten the viewBox to the actual rendered content, removing
        // empty gutters on the sides (purely visual - country geometry unchanged).
        try {
            const bbox = svgEl.getBBox();
            const pad = 8;
            const vx = Math.max(0, bbox.x - pad);
            const vy = Math.max(0, bbox.y - pad);
            const vw = Math.min(W - vx, bbox.width + pad * 2);
            const vh = Math.min(H - vy, bbox.height + pad * 2);
            svgEl.setAttribute('viewBox', vx + ' ' + vy + ' ' + vw + ' ' + vh);
        } catch (e) { /* getBBox unsupported - leave default */ }
    }

    /* ---- Init ---- */

    async function init() {
        setLayoutState(false);
        await buildMap();
        DATA = await Compo.load(BASE) || {};
        buildCountryIndex();
        refreshServiceFilter();
        paintCountries();
        wireShapes();
        periodBtns.forEach(b => b.addEventListener('click', () => setPeriod(b.dataset.period)));
        epochBtns.forEach(b => b.addEventListener('click', () => setEpoch(b.dataset.epoch)));
        /* Les pays en couleur clignotent deux fois au chargement, pour montrer
           que la carte se clique (sauf si le visiteur réduit les animations). */
        svgEl.classList.add('is-inviting');
        svgEl.addEventListener('animationend', () => svgEl.classList.remove('is-inviting'), { once: true });
        searchEl.addEventListener('input', applyFilter);
        filterEl.addEventListener('change', applyFilter);
        if (rerollEl) rerollEl.addEventListener('click', applyFilter);
        opTabs.forEach(t => {
            t.addEventListener('click', () => setActiveOperator(t.dataset.operator));
        });
        resetView();
        var skel = document.getElementById('circ-skeleton');
        if (skel) skel.classList.add('hidden');
    }

    init().catch(err => {
        titleEl.textContent = 'Erreur de chargement';
        console.error('[Circulations]', err);
    });
})();
