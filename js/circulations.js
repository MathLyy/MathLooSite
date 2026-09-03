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
        [203, 'Rép. Tchèque'],  [756, 'Suisse']
    ]);

    /* ---- Operator groupings (used by the operator tab strip) ---- */
    const OPERATOR_SERVICES = {
        mltc:   ['HSX', 'Xpress', 'TransRegio', 'Vivarail', 'Nocrail', 'Urbahn', 'Intracity'],
        prives: ['SanGo!', 'CFP'],
        fret:   ['MLCC', 'MLUP']
    };
    const OPERATOR_LABELS = {
        mltc:   'MLTC Railways',
        prives: 'Opérateurs privés',
        fret:   'Fret & Postal'
    };
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
    const opTabs   = Array.from(document.querySelectorAll('.circ-op-tab'));

    const DEFAULT_TITLE = 'Sélectionnez un pays';
    const DEFAULT_DESC = 'Choisissez un territoire sur la carte pour afficher les services, compositions et variantes associées.';
    const DEFAULT_HINT = 'Cliquez sur un pays pour ouvrir le panneau des circulations sans quitter la carte.';
    const ACTIVE_HINT = 'La carte reste active : cliquez sur un autre pays, ou dans le vide de la carte pour revenir à la vue d\'ensemble.';

    let shapes = [];
    let DATA = {};
    let activeCountry = null;
    let crossCountry = {};
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
        if (hintEl) hintEl.textContent = active ? ACTIVE_HINT : DEFAULT_HINT;
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

    function getCountryEntries(name) {
        const entry = DATA[name];
        if (!entry) return [];
        const local = (entry.compositions || []).map(item => ({ item, origin: null }));
        const cross = (crossCountry[name] || []).map(c => ({ item: c.item, origin: c.originCountry }));
        const all = local.concat(cross);
        return all
            .filter(e => operatorOf(e.item) === activeOperator)
            .sort((a, b) => a.item.service.localeCompare(b.item.service));
    }

    function operatorOf(item) {
        return SERVICE_TO_OPERATOR[item.service] || 'mltc';
    }

    function refreshServiceFilter() {
        if (!filterEl) return;
        const previous = filterEl.value;
        const services = OPERATOR_SERVICES[activeOperator] || [];
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
                listEl.innerHTML = entries.map(e => itemHTML(e.item, e.origin || e.country)).join('');
                wireScrollSync();
                wireRouteExpand();
            }

            requestAnimationFrame(() => {
                if (token !== renderToken) return;
                if (compsEl) compsEl.classList.remove('is-updating');
            });
        }, 120);
    }

    /** Build cross-country index: trains serving stations in a foreign country */
    function buildCrossCountryIndex() {
        crossCountry = {};
        Object.keys(DATA).forEach(origin => {
            (DATA[origin].compositions || []).forEach(item => {
                const list = item.countries || [];
                list.forEach(c => {
                    if (c !== origin) {
                        if (!crossCountry[c]) crossCountry[c] = [];
                        crossCountry[c].push({ item, originCountry: origin });
                    }
                });
            });
        });
    }

    /* shared onload: size to native pixels, then update scroll spacer */
    const IMG_ONLOAD = `this.style.width=this.naturalWidth+'px';this.style.height=this.naturalHeight+'px';var el=this;requestAnimationFrame(function(){var w=el.closest('.circ-consist-wrap');if(w){var s=w.querySelector('.circ-scroll-spacer');if(s)s.style.width=el.closest('.circ-consist').scrollWidth+'px'}})`;

    function buildVehicleRow(vehicles) {
        const total = vehicles.length;
        const imgs = vehicles.map((v, i) => {
            if (typeof v === 'object' && v.coupler) {
                const mb = typeof v.bottom === 'number' ? v.bottom : 7;
                const ol = typeof v.overlap === 'number' ? v.overlap : 3;
                const z = total + 1;
                return `<img class="circ-coupler-img" style="z-index:${z};margin-bottom:${mb}px;margin-left:-${ol}px;margin-right:-${ol}px" draggable="false" src="${esc(v.coupler)}" alt="" onload="${IMG_ONLOAD}">`;
            }
            const z = total - i;
            if (typeof v === 'object' && v.src) {
                const flip = v.flip ? 'transform:scaleX(-1);' : '';
                return `<img class="circ-train-img" style="z-index:${z};${flip}" draggable="false" src="${esc(v.src)}" alt="" onload="${IMG_ONLOAD}">`;
            }
            return `<img class="circ-train-img" style="z-index:${z}" draggable="false" src="${esc(v)}" alt="" onload="${IMG_ONLOAD}">`;
        }).join('');
        return `<div class="circ-vehicle-row">${imgs}</div>`;
    }

    function buildConsistBlock(trainContent, label) {
        const labelHTML = label ? `<span class="circ-segment-label">${esc(label)}</span>` : '';
        return `<div class="circ-consist-wrap">
                    ${labelHTML}
                    <div class="circ-consist">
                        <div class="circ-consist-inner">
                            ${trainContent}
                            <div class="circ-track"></div>
                        </div>
                    </div>
                    <div class="circ-scroll"><div class="circ-scroll-spacer"></div></div>
                </div>`;
    }

    function itemHTML(item, showCountry) {
        const hasImg      = item.img && item.img.trim();
        const hasVehicles = Array.isArray(item.vehicles) && item.vehicles.length;
        const hasSegments = Array.isArray(item.segments) && item.segments.length;

        let consistBlocks = '';
        if (hasSegments) {
            const segHTML = item.segments.map(seg => {
                const segVehicles = Array.isArray(seg.vehicles) ? seg.vehicles : [];
                const content = segVehicles.length ? buildVehicleRow(segVehicles) : '';
                return buildConsistBlock(content, seg.label);
            }).join('');
            consistBlocks = `<div class="circ-segments-group">${segHTML}</div>`;
        } else if (hasVehicles) {
            consistBlocks = buildConsistBlock(buildVehicleRow(item.vehicles), null);
        } else if (hasImg) {
            const imgContent = `<div class="circ-vehicle-row"><img class="circ-train-img" draggable="false" src="${esc(item.img)}" alt="${esc(item.name)}" onload="${IMG_ONLOAD}"></div>`;
            consistBlocks = buildConsistBlock(imgContent, null);
        }

        /* Route: show departure → terminus, expandable to full */
        const stops = item.name.split(/\s*→\s*/);
        let routeHTML;
        if (stops.length > 2) {
            const mid = stops.slice(1, -1).map(s => '<span class="circ-route-mid">' + esc(s) + '</span>').join(' → ');
            routeHTML = `<h4 class="circ-route">`
                + `<span class="circ-route-origin">${esc(stops[0])}&ensp;\u2192&ensp;</span>`
                + `<span class="circ-route-stops" hidden>${mid}&ensp;\u2192&ensp;</span>`
                + `<span class="circ-route-dest">${esc(stops[stops.length - 1])}</span>`
                + `<button class="circ-route-toggle" aria-label="Afficher le trajet complet" title="Trajet complet">`
                + `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`
                + `</button></h4>`;
        } else {
            routeHTML = `<h4>${esc(item.name)}</h4>`;
        }

        return `
            <li class="circ-item">
                <div class="circ-item-head">
                    <span class="circ-item-service" data-service="${esc(item.service)}">${esc(item.service)}</span>
                    ${routeHTML}
                    <span class="circ-item-detail">${esc(item.detail)}</span>
                </div>
                ${consistBlocks}
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
        const entry = DATA[name];
        if (!entry) return new Set();
        const local = (entry.compositions || []).map(item => ({ item }));
        const cross = (crossCountry[name] || []).map(c => ({ item: c.item }));
        const ops = new Set();
        local.concat(cross).forEach(e => ops.add(operatorOf(e.item)));
        return ops;
    }

    function updateOperatorTabsVisibility(name) {
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

    function selectCountry(name) {
        const entry = DATA[name];
        if (!entry) return;
        clearActive();
        activeCountry = name;
        const shape = shapes.find(s => s.dataset.country === name);
        if (shape) shape.classList.add('active');
        updateOperatorTabsVisibility(name);
        renderEntries(getCountryEntries(name), {
            active: true,
            title: name,
            description: entry.description || 'Consultez les circulations associées à ce territoire.',
            emptyMessage: 'Aucune circulation ' + OPERATOR_LABELS[activeOperator] + ' n\'est renseignée pour ce pays.'
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
        const results = getCountryEntries(activeCountry).filter(entry => {
            const blob = (activeCountry + ' ' + entry.item.name + ' ' + entry.item.service + ' ' + entry.item.detail).toLowerCase();
            return (!q || blob.includes(q)) && (!service || entry.item.service.toLowerCase() === service);
        });
        const entry = DATA[activeCountry] || {};
        const baseDescription = entry.description || 'Consultez les circulations associées à ce territoire.';
        renderEntries(results, {
            active: true,
            title: activeCountry,
            description: results.length
                ? baseDescription + ' ' + results.length + ' circulation(s) correspondent au filtre.'
                : 'Aucune circulation ne correspond aux filtres en cours.',
            emptyMessage: 'Aucun résultat pour cette sélection.'
        });
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
        const r = await fetch('data/circulations.json');
        if (!r.ok) throw new Error('Données : HTTP ' + r.status);
        DATA = await r.json() || {};
        buildCrossCountryIndex();
        wireShapes();
        searchEl.addEventListener('input', applyFilter);
        filterEl.addEventListener('change', applyFilter);
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
