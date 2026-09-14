/* =========================================================================
   validate.js — Controles intra-page, rejoues en continu.
   Severites : 'error' (bloque la sauvegarde), 'warn', 'info'.
   ========================================================================= */
(function () {
    'use strict';

    const P = window.LvParse;
    const Fs = window.LvFs;

    function issuesFor(page) {
        const list = [];
        const byNode = new Map();
        const add = (node, level, msg) => {
            const it = { node: node, level: level, msg: msg };
            list.push(it);
            if (node) {
                if (!byNode.has(node)) byNode.set(node, []);
                byNode.get(node).push(it);
            }
        };

        if (page.readOnly) {
            add(null, 'error', 'Page non analysable : ' + page.parseError);
            return { list: list, byNode: byNode, blocking: true };
        }

        /* --- identifiants ------------------------------------------------ */
        const seen = new Map();
        P.walk(page, n => {
            if (n.id == null) return;
            if (seen.has(n.id)) add(n, 'error', 'Identifiant « ' + n.id + ' » déjà utilisé sur la page');
            else seen.set(n.id, n);
            if (!/^[a-zA-Z0-9][-\w]*$/.test(n.id)) {
                add(n, 'warn', 'Identifiant « ' + n.id + ' » non conforme (lettres, chiffres, tirets)');
            }
        });

        /* --- ancres des boutons ------------------------------------------ */
        P.walk(page, n => {
            if (n.type !== 'btns') return;
            for (const b of n.buttons) {
                if (b.href && b.href.startsWith('#') && !seen.has(b.href.slice(1))) {
                    add(n, 'error', 'Le bouton « ' + b.label + ' » pointe vers #'
                        + b.href.slice(1) + ' qui n\'existe pas sur la page');
                }
            }
        });

        /* --- images ------------------------------------------------------ */
        const indexed = Fs.images() != null;
        P.walk(page, (n, parent) => {
            if (n.type !== 'engine') return;
            const im = n.img;
            if (!im.src) { add(n, 'error', 'Aucune image'); return; }
            if (indexed) {
                if (!Fs.hasImage(im.src)) add(n, 'error', 'Image introuvable : ' + im.src);
                if (im.dataR && !Fs.hasImage(im.dataR)) {
                    add(n, 'error', 'Image retournée introuvable : ' + im.dataR);
                }
                if (!im.dataR && Fs.companionR(im.src)) {
                    add(n, 'info', 'Une version retournée existe (_R) mais n\'est pas utilisée');
                }
            }
            if (im.dataR && !n.flip) add(n, 'warn', 'data-r présent mais pas de bouton R');
            if (!im.dataR && n.flip) add(n, 'warn', 'Bouton R présent mais pas de data-r');
            if (!im.alt) add(n, 'info', 'Texte alternatif vide');
        });

        /* --- dossier d'images coherent au sein d'une liste ---------------- */
        P.walk(page, n => {
            if (n.type !== 'list') return;
            const count = new Map();
            const engines = [];
            for (const c of n.children) {
                if (c.type !== 'engine' || !c.img.src) continue;
                const m = /^livrees_img\/([^/]+)\//.exec(c.img.src);
                if (!m) continue;
                engines.push([c, m[1]]);
                count.set(m[1], (count.get(m[1]) || 0) + 1);
            }
            if (count.size < 2) return;
            let major = null, best = 0;
            for (const [f, k] of count) if (k > best) { best = k; major = f; }
            for (const [c, f] of engines) {
                if (f !== major && count.get(f) <= 2) {
                    add(c, 'info', 'Image du dossier « ' + f + ' » alors que la liste utilise « ' + major + ' »');
                }
            }
        });

        return {
            list: list,
            byNode: byNode,
            blocking: list.some(i => i.level === 'error')
        };
    }

    /* Hauteur naturelle attendue des sprites. Asynchrone : appele par l'UI
       apres chargement des vignettes. */
    const SPRITE_H = 58;

    window.LvValidate = { issuesFor: issuesFor, SPRITE_H: SPRITE_H };
})();
