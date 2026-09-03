// Services page - featured immersif + track de cartes + carte interactive
(function () {
    'use strict';

        /* ----- Pays et services associés ----- */
    const COUNTRIES = new Map([
        [250, { name: 'France',      services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Frail','Intracity','MLCC','MLUP','MLTCI'] }],
        [276, { name: 'Allemagne',   services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Urbahn','Intracity','MLCC','MLUP','MLTCI'] }],
        [56,  { name: 'Belgique',    services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity','MLCC','MLUP','MLTCI'] }],
        [528, { name: 'Pays-Bas',    services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity','MLCC','MLUP','MLTCI'] }],
        [442, { name: 'Luxembourg',  services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity','MLCC','MLUP','MLTCI'] }],
        [826, { name: 'Royaume-Uni', services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity','MLCC','MLUP','MLTCI'] }],
        [380, { name: 'Italie',      services: ['HSX','Xpress','TransRegio','Nocrail','Intracity','MLCC','MLUP','MLTCI'] }],
        [40,  { name: 'Autriche',    services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Urbahn','Intracity','MLCC','MLUP','MLTCI'] }],
        [756, { name: 'Suisse',      services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Urbahn','Intracity','MLCC','MLUP','MLTCI'] }],
        [208, { name: 'Danemark',    services: ['HSX','Xpress','Vivarail','Nocrail','MLCC','MLUP','MLTCI'] }],
        [203, { name: 'Tchéquie',    services: ['HSX','Xpress','TransRegio','Vivarail','Nocrail','Intracity','MLCC','MLUP','MLTCI'] }],
        [724, { name: 'Espagne',     services: ['HSX','Xpress','Vivarail','Nocrail','MLCC','MLUP','MLTCI'] }],
    ]);

        /* ----- Données services ----- */
    const SERVICES = {
        HSX: {
            name: 'HighSpeedXpress', abbr: 'HSX', cat: 'Grande vitesse',
            tagline: "Le réseau à grande vitesse du Mathlyens",
            desc: "Service à grande vitesse de la MLTC, le HSX exploite l'ensemble des LGV du réseau à 300 km/h et au-delà. Il assure aussi bien des liaisons nationales (Paris-Lyon, Londres-Birmingham) qu'internationales (Paris-Londres, Bruxelles-Amsterdam, Munich-Vienne). Cœur de l'offre voyageurs longue distance.",
            icon: 'icones_liv/hsx.png',
            color: '#7c3aed', accent: '#a78bfa',
            livery: 'livrees_pages/hsx.html'
        },
        Xpress: {
            name: 'Xpress', abbr: 'XP', cat: 'Grandes lignes',
            tagline: "Les liaisons rapides nationales",
            desc: "Le Xpress relie les grandes villes à 160-200 km/h sur voie classique et voie rapide. Il constitue l'épine dorsale de l'offre nationale, complémentaire au HSX sur les axes non équipés en LGV, et assure également des liaisons transfrontalières de proximité.",
            icon: 'icones_liv/xpress.png',
            color: '#2563eb', accent: '#60a5fa',
            livery: 'livrees_pages/xpress.html'
        },
        Vivarail: {
            name: 'Vivarail', abbr: 'VR', cat: 'Grandes lignes premium',
            tagline: "Le voyage longue distance international",
            desc: "Positionné entre le Xpress et le HSX, le Vivarail est un service premium de grandes lignes internationales. Il relie les capitales et grandes villes de pays différents avec un confort accru : voitures panoramiques, restauration à bord et espaces de travail.",
            icon: 'icones_liv/vivarail.png',
            color: '#0891b2', accent: '#22d3ee',
            livery: 'livrees_pages/vivarail.html'
        },
        Nocrail: {
            name: 'Nocrail', abbr: 'NR', cat: 'Trains de nuit',
            tagline: "Voyager la nuit, arriver le matin",
            desc: "Successeur du NightLine, le Nocrail propose une offre complète de trains de nuit : sièges inclinables, couchettes et cabines privatives. Il couvre l'ensemble du Mathlyens et constitue une alternative écologique au transport aérien sur les trajets moyens et longs.",
            icon: 'icones_liv/nocrail.png',
            color: '#4338ca', accent: '#818cf8',
            livery: 'livrees_pages/nocrail.html'
        },
        TransRegio: {
            name: 'TransRegio', abbr: 'TR', cat: 'Régional',
            tagline: "Le maillage régional du réseau",
            desc: "Seul service à avoir conservé son nom lors de la refonte de 2012, le TransRegio assure la desserte régionale fine. Les correspondances avec le Xpress et le HSX sont optimisées dans les nœuds principaux.",
            icon: 'icones_liv/tr.png',
            color: '#0d9488', accent: '#5eead4',
            livery: 'livrees_pages/transregio.html'
        },
        Frail: {
            name: 'Frail', abbr: 'FR', cat: 'Express régional',
            tagline: "Le RER des métropoles françaises",
            desc: "Réseau express régional dédié aux grandes métropoles françaises, le Frail assure une desserte cadencée entre les centres-villes et leurs couronnes périurbaines selon une logique de RER renforcé sur Paris, Lyon, Marseille et Lille.",
            icon: 'icones_liv/frail.png',
            color: '#db2777', accent: '#f472b6',
            livery: 'livrees_pages/services-urbains.html'
        },
        Urbahn: {
            name: 'Urbahn', abbr: 'UB', cat: 'Express régional',
            tagline: "Le S-Bahn des métropoles germanophones",
            desc: "Équivalent germanophone du Frail, l'Urbahn dessert les grandes métropoles allemandes, autrichiennes et suisses dans une logique de S-Bahn renforcé sur Berlin, Munich, Hambourg, Vienne et Zurich.",
            icon: 'icones_liv/urbahn.png',
            color: '#ea580c', accent: '#fb923c',
            livery: 'livrees_pages/services-urbains.html'
        },
        Intracity: {
            name: 'Intracity', abbr: 'IAC', cat: 'Urbain',
            tagline: "La desserte fine des agglomérations",
            desc: "Service ferroviaire intra-urbain présent dans la majorité des pays membres, l'Intracity renforce les liaisons internes d'une même ville ou entre communes limitrophes, avec du matériel léger adapté aux dessertes fines et fréquentes.",
            icon: 'icones_liv/intracity.png',
            color: '#16a34a', accent: '#4ade80',
            livery: 'livrees_pages/services-urbains.html'
        },
        MLCC: {
            name: 'Mathly Cargo Company', abbr: 'MLCC', cat: 'Fret ferroviaire',
            tagline: "Le transport de marchandises du Mathlyens",
            desc: "Filiale fret du groupe MLTC, la MLCC assure le transport de marchandises par rail à travers les 12 États membres. Elle opère des flux longue distance ainsi que des dessertes locales via son service RegioCargo, lancé en 2015.",
            icon: 'icones_liv/mlcc.png',
            color: '#b45309', accent: '#f59e0b',
            livery: 'livrees_pages/mlcc.html'
        },
        MLUP: {
            name: 'Mathly Universal Post', abbr: 'MLUP', cat: 'Services postaux',
            tagline: "Le courrier par rail à travers le Mathlyens",
            desc: "Branche postale du groupe MLTC, la MLUP est chargée de l'acheminement du courrier et des colis par voie ferroviaire. Elle exploite des trains postaux dédiés sur l'ensemble du réseau, en complément des services de fret de la MLCC.",
            icon: 'icones_liv/mlup.png',
            color: '#dc2626', accent: '#f87171',
            livery: 'livrees_pages/mlup.html'
        },
        MLTCI: {
            name: 'MLTC Infrastructures', abbr: 'MLTCI', cat: 'Infrastructure',
            tagline: "Le gestionnaire du réseau ferré",
            desc: "Filiale du groupe chargée de la gestion, de l'entretien et du développement de l'infrastructure ferroviaire : voies, gares, signalisation et alimentation électrique à travers les 12 États membres du Mathlyens.",
            icon: 'icones_liv/mltci.png',
            color: '#475569', accent: '#94a3b8',
            livery: 'livrees_pages/mltci.html'
        }
    };

    const ORDER = ['HSX','Xpress','Vivarail','Nocrail','TransRegio','Frail','Urbahn','Intracity','MLCC','MLUP','MLTCI'];

    /* ----- DOM ----- */
    const stage     = document.querySelector('.sv-stage');
    const trackEl   = document.querySelector('.sv-track');
    const svgEl     = document.querySelector('.sv-map');
    if (!stage || !trackEl || !svgEl) return;

    const elName     = stage.querySelector('.sv-stage-name');
    const elTagline  = stage.querySelector('.sv-stage-tagline');
    const elDesc     = stage.querySelector('.sv-stage-desc');
    const elCat      = stage.querySelector('.sv-stat-cat');
    const elAbbr     = stage.querySelector('.sv-stat-abbr');
    const elCountries= stage.querySelector('.sv-stat-countries');
    const elCta      = stage.querySelector('.sv-stage-cta');
    const elTrain    = stage.querySelector('.sv-stage-icon');

    const elCovTitleSvc = document.querySelector('.sv-coverage-svc');
    const elCovServed   = document.querySelector('.sv-counter-served');

    let activeKey = 'HSX';
    let countryGroups = [];

    /* ----- Track de cartes ----- */
    function buildTrack() {
        ORDER.forEach((key, i) => {
            const s = SERVICES[key];
            const card = document.createElement('button');
            card.className = 'sv-card';
            card.dataset.service = key;
            card.style.setProperty('--svc-color', s.color);
            card.style.setProperty('--svc-accent', s.accent);
            card.setAttribute('role', 'tab');
            card.style.animationDelay = (i * 60) + 'ms';
                        card.innerHTML = `
                <div class="sv-card-bg"></div>
                <img class="sv-card-icon" src="${s.icon}" alt="" loading="lazy">
                <div class="sv-card-grad"></div>
                <div class="sv-card-info">
                    <span class="sv-card-cat">${s.cat}</span>
                    <span class="sv-card-name">${s.name}</span>
                </div>
                <span class="sv-card-abbr">${s.abbr}</span>
            `;
            card.addEventListener('click', () => setActive(key, true));
            trackEl.appendChild(card);
        });
    }

    /* ----- Featured ----- */
    function setActive(key, scroll) {
        activeKey = key;
        const s = SERVICES[key];
        const countries = [...COUNTRIES.values()].filter(c => c.services.includes(key));

        stage.style.setProperty('--svc-color', s.color);
        stage.style.setProperty('--svc-accent', s.accent);

        // Crossfade animation
        stage.classList.remove('is-fading');
        void stage.offsetWidth;
        stage.classList.add('is-fading');

        elName.textContent      = s.name;
        elTagline.textContent   = s.tagline;
        elDesc.textContent      = s.desc;
        elCat.textContent       = s.cat;
        elAbbr.textContent      = s.abbr;
        elCountries.textContent = countries.length;
        elCta.href              = s.livery;
        const ctaLabel = elCta.querySelector('.sv-stage-cta-label');
        if (ctaLabel) ctaLabel.textContent = `Découvrir la livrée ${s.name}`;
        elTrain.src = s.icon;
        elTrain.alt = s.name;

        if (elCovTitleSvc) elCovTitleSvc.textContent = s.name;
        if (elCovServed)   elCovServed.textContent   = countries.length;

        document.querySelectorAll('.sv-card').forEach(c => {
            c.classList.toggle('is-active', c.dataset.service === key);
        });

        updateMap(key);

        if (scroll) {
            const active = trackEl.querySelector('.sv-card.is-active');
            if (active && active.scrollIntoView) {
                active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }

    /* ----- Carte ----- */
    const NS = 'http://www.w3.org/2000/svg';
    const W = 800, H = 650, PAD = 24;

    function mercY(lat) {
        const r = lat * Math.PI / 180;
        return Math.log(Math.tan(Math.PI / 4 + r / 2));
    }
    function europeanOnly(feature) {
        const inEurope = (ring) => {
            let sLon = 0, sLat = 0;
            ring.forEach(c => { sLon += c[0]; sLat += c[1]; });
            const aLon = sLon / ring.length, aLat = sLat / ring.length;
            return aLat > 34 && aLat < 65 && aLon > -12 && aLon < 25;
        };
        const g = feature.geometry;
        if (g.type === 'MultiPolygon') {
            const coords = g.coordinates.filter(poly => inEurope(poly[0]));
            if (!coords.length) return null;
            return { ...feature, geometry: { ...g, coordinates: coords } };
        }
        if (!inEurope(g.coordinates[0])) return null;
        return feature;
    }
    function geoBounds(features) {
        let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
        const scan = coords => coords.forEach(([lon, lat]) => {
            if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        });
        features.forEach(f => {
            const g = f.geometry;
            if (g.type === 'Polygon') g.coordinates.forEach(scan);
            else g.coordinates.forEach(p => p.forEach(scan));
        });
        return { minLon, maxLon, minLat, maxLat };
    }
    function fitProjection(b) {
        const toR = Math.PI / 180;
        const myMin = mercY(b.minLat), myMax = mercY(b.maxLat);
        const geoW = (b.maxLon - b.minLon) * toR, geoH = myMax - myMin;
        const uw = W - 2 * PAD, uh = H - 2 * PAD;
        const s = Math.min(uw / geoW, uh / geoH);
        const mw = geoW * s, mh = geoH * s;
        const ox = PAD + (uw - mw) / 2, oy = PAD + (uh - mh) / 2;
        return (lon, lat) => [
            (lon * toR - b.minLon * toR) * s + ox,
            (myMax - mercY(lat)) * s + oy
        ];
    }
    function ringD(ring, proj) {
        return ring.map((c, i) => {
            const [x, y] = proj(c[0], c[1]);
            return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
        }).join('') + 'Z';
    }
    function featureD(f, proj) {
        const g = f.geometry;
        const rings = g.type === 'MultiPolygon'
            ? g.coordinates.flatMap(p => p) : g.coordinates;
        return rings.map(r => ringD(r, proj)).join('');
    }
    function updateMap(key) {
        countryGroups.forEach(({ g, services }) => {
            const served = services.includes(key);
            g.classList.toggle('sv-served', served);
            g.classList.toggle('sv-unserved', !served);
        });
    }
    async function buildMap() {
        const resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        if (!resp.ok) throw new Error('Carte : HTTP ' + resp.status);
        const world = await resp.json();
        const all = topojson.feature(world, world.objects.countries);
        const features = all.features
            .filter(f => COUNTRIES.has(Number(f.id)))
            .map(europeanOnly).filter(Boolean);
        const bounds = geoBounds(features);
        const proj = fitProjection(bounds);
        svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

        const tip = document.querySelector('.sv-map-tip');
        features.forEach(f => {
            const info = COUNTRIES.get(Number(f.id));
            if (!info) return;
            const g = document.createElementNS(NS, 'g');
            g.classList.add('sv-country');
            g.dataset.country = info.name;
            const path = document.createElementNS(NS, 'path');
            path.classList.add('sv-shape');
            path.setAttribute('d', featureD(f, proj));
            g.appendChild(path);
            const title = document.createElementNS(NS, 'title');
            title.textContent = info.name;
            g.appendChild(title);
            if (tip) {
                g.addEventListener('mouseenter', () => {
                    tip.textContent = info.name;
                    tip.classList.add('visible');
                });
                g.addEventListener('mouseleave', () => {
                    tip.classList.remove('visible');
                });
            }
            svgEl.appendChild(g);
            countryGroups.push({ g, services: info.services, name: info.name });
        });
        updateMap(activeKey);
    }

    /* ----- Init ----- */
    buildTrack();
    setActive(activeKey, false);
    buildMap().catch(err => console.error('[ServicesPage]', err));
})();
