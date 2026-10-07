/* ═══════════════════════════════════════════════════
   MLTC - Compositions : lecture de mltc/data/circulations.js,
   partagée par la carte (circulations.js), la page Trafic
   (rames.js) et le bandeau animé (train-anim.js).

   La syntaxe des compositions est décrite dans la clé "_aide"
   du fichier de données. Les chemins renvoyés (src) partent de
   la racine du site : chaque page y ajoute son propre préfixe.
   ═══════════════════════════════════════════════════ */

(function () {
    'use strict';

    const LIVREES = 'mltc/livrees_pages/livrees_img/';
    const ASSETS  = 'mltc/assets/';
    const DECORS  = ASSETS + 'decors/';      // caténaires, troisième rail
    const QUAIS   = ASSETS + 'quais/';       // quais, tronçons de 400 px à aligner
    const GARES   = ASSETS + 'gares/';       // bâtiments voyageurs, posés sur le quai
    const QUAI_DEFAULT = 'quai.png';

    /* Opacité des plans du fond (page Trafic et aperçus de l'admin). */
    const ALPHA = { station: 0.4, catenary: 0.6 };
    const DATA_FILE = 'mltc/data/circulations.js';

    /* Données : chargées par une balise <script>, et non par fetch, pour
       fonctionner aussi en file:// (page ouverte par double-clic).
       base : préfixe de la page vers la racine du site. */
    let pending = null;
    function load(base) {
        if (window.MLTC_CIRCULATIONS) return Promise.resolve(window.MLTC_CIRCULATIONS);
        if (!pending) {
            pending = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = (base || '') + DATA_FILE;
                s.onload = () => {
                    if (window.MLTC_CIRCULATIONS) resolve(window.MLTC_CIRCULATIONS);
                    else reject(new Error(DATA_FILE + ' illisible (erreur de syntaxe ?)'));
                };
                s.onerror = () => reject(new Error(DATA_FILE + ' introuvable'));
                document.head.appendChild(s);
            });
        }
        return pending;
    }

    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function choice(arr) { return arr[randInt(0, arr.length - 1)]; }
    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = randInt(0, i);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /* Trains du fichier, à plat et dans l'ordre : [{ service, train }]. */
    function trains(data) {
        const out = [];
        const services = (data && data.services) || {};
        Object.keys(services).forEach(service => {
            if (service.charAt(0) === '_') return;
            (services[service] || []).forEach(train => {
                if (train && typeof train === 'object') out.push({ service, train });
            });
        });
        return out;
    }

    /* Service d'avant 2001 (liste "historiques" du fichier) : ses trains ne
       s'affichent qu'avec le filtre Historique. */
    function isHistoric(data, service) {
        return !!(data && Array.isArray(data.historiques) && data.historiques.indexOf(service) >= 0);
    }

    /* Copie les clés de b sur a ; une valeur null retire la clé. */
    function assign(a, b) {
        Object.keys(b || {}).forEach(k => {
            if (k.charAt(0) === '_') return;
            if (b[k] === null) delete a[k];
            else a[k] = b[k];
        });
        return a;
    }

    /* Réglages d'un passage : défauts du service, puis la base, puis une
       variante. variant : 0 = la base, n = la n-ième variante, absent =
       tirage au sort entre la base et ses variantes. */
    function scenario(data, service, train, variant) {
        const variants = Array.isArray(train.variants) ? train.variants : [];
        const pick = variant == null ? randInt(0, variants.length) : variant;
        const cfg = assign({}, ((data && data.defaults) || {})[service]);
        assign(cfg, train);
        delete cfg.variants;
        if (pick > 0 && variants[pick - 1]) assign(cfg, variants[pick - 1]);
        cfg.service = service;
        return cfg;
    }

    /* "A|B" : l'un ou l'autre au hasard. "G>D" : G quand le train roule
       vers la gauche, D vers la droite (inversé si la rame l'est). */
    function pickRef(raw, direction, reversed) {
        let ref = raw;
        if (ref.indexOf('|') >= 0) ref = choice(ref.split('|').map(s => s.trim()));
        if (ref.indexOf('>') >= 0) {
            const parts = ref.split('>');
            if (parts.length === 2) {
                let left = parts[0], right = parts[1];
                if (reversed) [left, right] = [right, left];
                ref = direction === 'R' ? right : left;
            }
        }
        return ref.trim();
    }

    /* Résout une composition (N*, N-M*, SHUFFLE{}, attelages) en éléments
       { src } ou { src, coupler: true, overlap, bottom }. opts.direction
       vaut "L" (défaut) ou "R" ; opts.reversed inverse les "G>D". */
    function resolve(items, opts) {
        const direction = (opts && opts.direction) || 'L';
        const reversed = !!(opts && opts.reversed);
        const out = [];
        /* Un attelage n'est posé que s'il relie deux rames : il attend le
           prochain véhicule. Si la rame suivante est tirée à 0 (« 0-1* »),
           l'attelage disparaît avec elle ; en tête ou en fin de composition,
           ou à la suite d'un autre attelage, il disparaît aussi. */
        let pending = null;
        const push = v => {
            if (pending && out.length) out.push(pending);
            pending = null;
            out.push(v);
        };
        (items || []).forEach(item => {
            if (item && typeof item === 'object') {
                if (item.coupler && !pending) {
                    pending = {
                        src: ASSETS + item.coupler,
                        coupler: true,
                        overlap: typeof item.overlap === 'number' ? item.overlap : 3,
                        bottom: typeof item.bottom === 'number' ? item.bottom : 7
                    };
                }
                return;
            }
            if (typeof item !== 'string') return;

            let count = 1;
            let content = item.trim();
            const star = content.indexOf('*');
            if (star >= 0) {
                const countPart = content.slice(0, star).trim();
                content = content.slice(star + 1).trim();
                if (countPart.indexOf('-') >= 0) {
                    const bounds = countPart.split('-').map(n => parseInt(n, 10));
                    count = isNaN(bounds[0]) || isNaN(bounds[1]) ? 1 : randInt(bounds[0], bounds[1]);
                } else {
                    const c = parseInt(countPart, 10);
                    count = isNaN(c) ? 1 : c;
                }
            }

            let batch = [content];
            let isShuffle = false;
            if (content.indexOf('SHUFFLE{') === 0 && content.charAt(content.length - 1) === '}') {
                isShuffle = true;
                batch = content.slice(8, -1).split(',').map(s => s.trim()).filter(Boolean);
            }

            /* Avec SHUFFLE, le nombre est le total tiré du lot mélangé. */
            let pool = [];
            for (let i = 0; i < count; i++) {
                if (!pool.length) {
                    pool = isShuffle ? shuffle(batch) : batch.slice();
                    if (!pool.length) break;
                }
                const ref = pickRef(pool.shift(), direction, reversed);
                if (ref) push({ src: LIVREES + ref });
            }
        });
        return out;
    }

    /* Image d'un premier plan : véhicule (is_vehicle) ou image de mltc/assets/. */
    function foregroundSrc(fg) {
        if (!fg || !fg.image) return null;
        return (fg.is_vehicle ? LIVREES : ASSETS) + fg.image;
    }

    /* Décor le long de la voie (caténaire, troisième rail) : nom de fichier
       de mltc/assets/decors/, ou false pour aucun. Absent : null, et le
       moteur trace seulement un fil au-dessus des engins de 58 px. */
    function decorSrc(cfg) {
        return cfg && typeof cfg.decor === 'string' && cfg.decor ? DECORS + cfg.decor : null;
    }

    /* Décor posé sur la voie (troisième rail) plutôt que derrière elle
       (caténaire) : clé "decors" du fichier, { "3R.png": { "on_track": true } }. */
    function decorOnTrack(data, name) {
        const d = data && data.decors && typeof name === 'string' ? data.decors[name] : null;
        return !!(d && d.on_track);
    }

    /* Gare le long de la voie : { at, length, platform, building, building_x }.
       Le quai (platform, défaut quai.png) est répété length fois ; le bâtiment
       (building, facultatif) est centré dessus, décalé de building_x pixels.
       at : "50%" place le centre du quai, un nombre son bord gauche. */
    function station(cfg) {
        const s = cfg && cfg.station;
        if (!s || typeof s !== 'object') return null;
        return {
            at: s.at !== undefined ? s.at : '50%',
            length: Math.max(1, parseInt(s.length, 10) || 1),
            platform: QUAIS + (s.platform || QUAI_DEFAULT),
            building: s.building ? GARES + s.building : null,
            buildingX: typeof s.building_x === 'number' ? s.building_x : 0
        };
    }

    /* Tous les fichiers qu'un réglage peut afficher, pour les précharger :
       composition, arrêt (locomotive, attelage), arrière-plan, premier plan. */
    function sources(cfg) {
        const set = new Set();
        function scanList(list) {
            (list || []).forEach(item => {
                if (item && typeof item === 'object') {
                    if (item.coupler) set.add(ASSETS + item.coupler);
                    return;
                }
                if (typeof item !== 'string') return;
                item.replace(/SHUFFLE\{|\}/g, ' ').split(/[|>,]/).forEach(tok => {
                    const name = tok.trim().replace(/^\d+(?:-\d+)?\s*\*/, '').trim();
                    if (name) set.add(LIVREES + name);
                });
            });
        }
        function scan(c) {
            if (!c) return;
            scanList(c.composition);
            if (c.stop) {
                if (c.stop.loco_change) scanList([c.stop.loco_change]);
                scanList(c.stop.attach);
            }
            if (c.foreground) {
                const fg = typeof c.foreground === 'string' ? { image: c.foreground } : c.foreground;
                const src = foregroundSrc(fg);
                if (src) set.add(src);
            }
            if (c.background) scan(c.background);
        }
        scan(cfg);
        const decor = decorSrc(cfg);
        if (decor) set.add(decor);
        const st = station(cfg);
        if (st) {
            set.add(st.platform);
            if (st.building) set.add(st.building);
        }
        return Array.from(set);
    }

    /* Texte d'un train : son nom, puis départ → terminus. */
    function label(cfg) {
        const parts = [];
        if (cfg.name) parts.push(cfg.name);
        const r = Array.isArray(cfg.route) ? cfg.route : [];
        if (r.length > 1) parts.push(r[0] + ' → ' + r[r.length - 1]);
        else if (r.length === 1) parts.push(r[0]);
        return parts.join(' · ');
    }

    /* Rame après un arrêt, comme sur la page Trafic : dételage, attelage,
       puis départ éventuel d'une partie de ce qui vient d'être attelé. */
    function afterStop(list, stop, opts) {
        let out = list.slice();
        const loco = !!stop.loco_change;
        const detach = stop.detach_count || (loco ? 1 : 0);
        if (detach > 0) {
            out = stop.detach_position === 'back'
                ? out.slice(0, Math.max(0, out.length - detach))
                : out.slice(detach);
        }
        const added = resolve(loco ? [stop.loco_change] : (stop.attach || []), opts);
        const back = stop.attach_position === 'back';
        out = back ? out.concat(added) : added.concat(out);
        const self = stop.attach_self_detach_count || 0;
        if (added.length && self > 0) {
            out = back ? out.slice(0, Math.max(0, out.length - self)) : out.slice(self);
        }
        return out;
    }

    window.MltcCompo = {
        LIVREES: LIVREES,
        ASSETS: ASSETS,
        DECORS: DECORS,
        QUAIS: QUAIS,
        GARES: GARES,
        ALPHA: ALPHA,
        decorSrc: decorSrc,
        decorOnTrack: decorOnTrack,
        station: station,
        load: load,
        shuffle: shuffle,
        trains: trains,
        isHistoric: isHistoric,
        scenario: scenario,
        resolve: resolve,
        sources: sources,
        foregroundSrc: foregroundSrc,
        label: label,
        afterStop: afterStop
    };
})();
