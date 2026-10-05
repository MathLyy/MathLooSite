/* =========================================================================
   integrity.js — Controles inter-fichiers, EN LECTURE SEULE.

   L'editeur Livrees n'ecrit jamais circulations.js (c'est le role de
   l'editeur Compositions, compositions.html) ni services-page.js : il se
   contente d'avertir. Le rayon d'explosion d'un bug reste confine au HTML
   des livrees, exactement la zone que git revoque trivialement.
   ========================================================================= */
(function () {
    'use strict';

    const Fs = window.LvFs;
    const P = window.LvParse;

    let refs = null;

    async function collect() {
        const out = {
            circ: new Map(),      // 'livrees_img/x/y.png' -> [noms de compositions]
            circMissing: [],
            liveries: [],         // 'livrees_pages/xpress.html'
            indexLinks: [],       // {href, img, alt}
            usedImages: new Set(),
            pages: [],
            errors: []
        };

        /* --- circulations.js --------------------------------------------- */
        /* Fichier .js (lisible en file://) qui enveloppe du JSON strict :
           window.MLTC_CIRCULATIONS = { ... };. Trains rangés par service ;
           les images y sont écrites « dossier/fichier.png » (relatif à
           livrees_img/), au milieu de la syntaxe des compositions
           (2*, A|B, G>D, SHUFFLE{...}). */
        try {
            const src = await Fs.readText('mltc/data/circulations.js');
            const start = src.indexOf('{', src.indexOf('MLTC_CIRCULATIONS'));
            const data = JSON.parse(src.slice(start, src.lastIndexOf('}') + 1));
            const services = data.services || {};
            const IMG_REF = /[^\s,{}|>*\/"]+\/[^\s,{}|>*\/"]+\.png/gi;
            for (const service of Object.keys(services)) {
                for (const train of (services[service] || [])) {
                    const route = Array.isArray(train.route) ? train.route : [];
                    const label = service + ' — ' + (train.name
                        || (route.length ? route[0] + ' → ' + route[route.length - 1] : '(sans titre)'));
                    (function walk(v) {
                        if (typeof v === 'string') {
                            const refs = v.match(IMG_REF) || [];
                            for (const ref of refs) {
                                const rel = 'livrees_img/' + ref;
                                if (!out.circ.has(rel)) out.circ.set(rel, []);
                                const users = out.circ.get(rel);
                                if (users.indexOf(label) < 0) users.push(label);
                            }
                        } else if (v && typeof v === 'object') {
                            Object.values(v).forEach(walk);
                        }
                    })(train);
                }
            }
        } catch (e) {
            out.errors.push('circulations.js illisible : ' + e.message);
        }

        /* --- services-page.js -------------------------------------------- */
        try {
            const src = await Fs.readText('js/services-page.js');
            const re = /livery:\s*'([^']+)'/g;
            let m;
            while ((m = re.exec(src))) out.liveries.push(m[1]);
        } catch (e) {
            out.errors.push('js/services-page.js illisible : ' + e.message);
        }

        /* --- pages de livrees : images reellement utilisees --------------- */
        const files = await Fs.listDir('mltc/livrees_pages', '.html');
        for (const f of files) {
            const rel = 'mltc/livrees_pages/' + f;
            try {
                const page = P.parse(await Fs.readText(rel), rel);
                let engines = 0;
                if (!page.readOnly) {
                    P.walk(page, n => {
                        if (n.type === 'figure' && n.html) {
                            const m = /<img\b[^>]*\ssrc="([^"]*)"/i.exec(n.html);
                            if (m) out.usedImages.add(m[1]);
                            return;
                        }
                        if (n.type !== 'engine') return;
                        engines++;
                        if (n.img.src) out.usedImages.add(n.img.src);
                        if (n.img.dataR) out.usedImages.add(n.img.dataR);
                    });
                }
                out.pages.push({ file: f, engines: engines, readOnly: page.readOnly });
            } catch (e) {
                out.pages.push({ file: f, engines: 0, readOnly: true });
            }
        }

        /* --- liens de la page index --------------------------------------- */
        try {
            const idx = P.parse(await Fs.readText('mltc/livrees.html'), 'mltc/livrees.html');
            if (!idx.readOnly) {
                P.walk(idx, n => {
                    if (n.type === 'icons') out.indexLinks.push.apply(out.indexLinks, n.links);
                });
            }
        } catch (e) {
            out.errors.push('livrees.html illisible : ' + e.message);
        }

        /* --- chemins de circulations.js absents du disque ---------------- */
        if (Fs.images()) {
            for (const rel of out.circ.keys()) {
                if (!Fs.hasImage(rel)) out.circMissing.push(rel);
            }
        }

        refs = out;
        return out;
    }

    function cached() { return refs; }

    /* Compositions de circulations.js qui referencent cette image. */
    function circUsers(rel) {
        if (!refs || !rel) return [];
        return refs.circ.get(rel) || [];
    }

    /* Pages/services qui pointent vers cette page de livree. */
    function pageUsers(slug) {
        if (!refs) return { liveries: [], index: [] };
        const target = 'livrees_pages/' + slug + '.html';
        return {
            liveries: refs.liveries.filter(l => l === target),
            index: refs.indexLinks.filter(l => (l.href || '').split('#')[0] === target)
        };
    }

    /* Liens de l'index pointant vers une ancre precise d'une page. */
    function anchorUsers(slug, id) {
        if (!refs) return [];
        const target = 'livrees_pages/' + slug + '.html#' + id;
        return refs.indexLinks.filter(l => l.href === target);
    }

    /* Rapport permanent. */
    function report() {
        if (!refs) return null;
        const idx = Fs.images();
        const orphans = [];
        if (idx) {
            for (const [, files] of idx) {
                for (const f of files) {
                    if (!refs.usedImages.has(f.rel) && !refs.circ.has(f.rel)) orphans.push(f.rel);
                }
            }
        }
        const badLiveries = [];
        for (const l of new Set(refs.liveries)) {
            const slug = l.replace(/^livrees_pages\//, '').replace(/\.html$/, '');
            if (!refs.pages.some(p => p.file === slug + '.html')) badLiveries.push(l);
        }
        const badIndex = refs.indexLinks.filter(l => {
            const f = (l.href || '').split('#')[0].replace(/^livrees_pages\//, '');
            return f && !refs.pages.some(p => p.file === f);
        });
        return {
            orphans: orphans,
            circMissing: refs.circMissing,
            badLiveries: badLiveries,
            badIndex: badIndex,
            skeletons: refs.pages.filter(p => p.engines === 0),
            errors: refs.errors,
            counts: {
                circ: refs.circ.size,
                liveries: refs.liveries.length,
                indexLinks: refs.indexLinks.length,
                used: refs.usedImages.size,
                total: idx ? [...idx.values()].reduce((a, b) => a + b.length, 0) : 0
            }
        };
    }

    window.LvIntegrity = {
        collect: collect,
        cached: cached,
        circUsers: circUsers,
        pageUsers: pageUsers,
        anchorUsers: anchorUsers,
        report: report
    };
})();
