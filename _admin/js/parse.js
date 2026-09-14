/* =========================================================================
   parse.js — Texte source -> modele Page.
   Le scanner (scan.js) fournit les offsets ; DOMParser n'est JAMAIS utilise
   pour resserialiser, uniquement pour decoder du texte. Chaque noeud garde
   sa chaine source d'origine dans `raw`.
   ========================================================================= */
(function () {
    'use strict';

    const S = window.LvScan;

    /* ---- decodage d'entites (lecture seule) ---------------------------- */
    const _dec = document.createElement('textarea');
    function decodeText(s) {
        if (s.indexOf('&') < 0) return s;
        _dec.innerHTML = s;
        return _dec.value;
    }

    /* ---- helpers de plages relatives au `raw` du noeud ------------------ */
    function innerRange(base, k) {
        return { start: k.innerStart - base, end: k.innerEnd - base };
    }
    function attrRangeIn(src, base, k, name) {
        const openTag = src.slice(k.start, k.openEnd);
        const r = S.attrRange(openTag, name);
        if (!r) return null;
        const off = k.start - base;
        return { start: off + r.start, end: off + r.end, value: r.value };
    }

    /* ---- classification d'un element scanne ---------------------------- */
    function classify(k, cls, inLastMod) {
        if (k.tag === 'article' && cls.has('lv-engine')) return 'engine';
        if (k.tag === 'section') return cls.has('last-modified') ? 'lastmod' : 'section';
        /* Bloc « Derniere mise a jour » de la page index. */
        if (inLastMod) {
            if (k.tag === 'div') return 'group';
            if (k.tag === 'p' && cls.size === 0) return 'lastmodText';
        }
        if (k.tag === 'div') {
            if (cls.has('lv-container')) return 'group';
            if (cls.has('lv-list')) return 'list';
            if (cls.has('lv-wrap')) return 'wrap';
            if (cls.has('lv-topbar')) return 'topbar';
            if (cls.has('lv-catbar')) return 'catbar';
            if (cls.has('lv-country-sep')) return 'sep';
            if (cls.has('lv-btns')) return 'btns';
            if (cls.has('lv-desc')) return 'desc';
            if (cls.has('lv-figure')) return 'figure';
            if (cls.has('lv-category')) return 'category';
            if (cls.has('lv-icons')) return 'icons';
        }
        if (k.tag === 'p' && cls.has('lv-desc')) return 'desc';
        if (k.tag === 'span' && cls.has('lv-sub')) return 'sub';
        if (k.tag === 'h2') return cls.has('lv-category-title') ? 'catTitle' : 'h2';
        return 'unknown';
    }

    /* Types dont on descend les enfants. */
    const CONTAINER = new Set(['section', 'list', 'wrap', 'category', 'group', 'lastmod']);

    /* ---- construction recursive des noeuds ------------------------------ */
    function buildNodes(src, from, to, ctx, inLastMod) {
        const kids = S.childNodesOf(src, from, to);
        if (!S.verifyCoverage(src, from, to, kids)) {
            throw new Error('Scan non contigu entre ' + from + ' et ' + to);
        }
        return kids.map(k => buildNode(src, k, ctx, inLastMod));
    }

    function buildNode(src, k, ctx, inLastMod) {
        const raw = src.slice(k.start, k.end);

        if (k.type === 'text') return { type: 'text', raw: raw, dirty: false };
        if (k.type === 'comment') return { type: 'comment', raw: raw, dirty: false };

        const openTag = src.slice(k.start, k.openEnd);
        const cls = S.classListOf(openTag);
        const type = classify(k, cls, inLastMod);
        const base = k.start;

        const n = {
            type: type, raw: raw, dirty: false, tag: k.tag,
            openTagRaw: openTag,
            closeTagRaw: src.slice(k.innerEnd, k.end),
            r: {}
        };

        const id = S.attrValue(openTag, 'id');
        if (id != null) {
            n.id = id;
            const ar = attrRangeIn(src, base, k, 'id');
            if (ar) n.r.id = ar;
            if (ctx) ctx.ids.push(id);
        }

        switch (type) {
            case 'engine':
                parseEngine(src, k, n, ctx);
                break;

            case 'topbar':
            case 'catbar':
            case 'sep':
            case 'h2':
            case 'catTitle':
            case 'sub':
            case 'lastmodText':
                n.text = decodeText(src.slice(k.innerStart, k.innerEnd));
                n.r.text = innerRange(base, k);
                break;

            case 'desc':
            case 'figure':
                n.html = src.slice(k.innerStart, k.innerEnd);
                n.r.html = innerRange(base, k);
                break;

            case 'btns':
                n.buttons = [];
                S.walkElements(src, k.innerStart, k.innerEnd, (a, at) => {
                    if (a.tag !== 'a') return;
                    n.buttons.push({
                        href: S.attrValue(at, 'href') || '',
                        label: decodeText(src.slice(a.innerStart, a.innerEnd)),
                        rHref: attrRangeIn(src, base, a, 'href'),
                        rLabel: innerRange(base, a)
                    });
                    return false;
                });
                break;

            case 'icons':
                n.links = [];
                S.walkElements(src, k.innerStart, k.innerEnd, (a, at) => {
                    if (a.tag !== 'a') return;
                    const link = {
                        href: S.attrValue(at, 'href') || '',
                        rHref: attrRangeIn(src, base, a, 'href'),
                        img: '', alt: ''
                    };
                    S.walkElements(src, a.innerStart, a.innerEnd, (im, imt) => {
                        if (im.tag !== 'img' || link.rImg) return;
                        link.img = S.attrValue(imt, 'src') || '';
                        link.alt = S.attrValue(imt, 'alt') || '';
                        link.rImg = attrRangeIn(src, base, im, 'src');
                        link.rAlt = attrRangeIn(src, base, im, 'alt');
                    });
                    n.links.push(link);
                    return false;
                });
                break;
        }

        if (CONTAINER.has(type)) {
            n.children = buildNodes(src, k.innerStart, k.innerEnd, ctx,
                inLastMod || type === 'lastmod');
        }

        n._orig = snapshot(n);
        return n;
    }

    /* Attributs de l'<img> que le modele connait et sait re-emettre. Tous les
       autres (data-vars des variantes d'usure, etc.) sont conserves verbatim :
       sans cela un re-rendu de niveau 3 les perdrait silencieusement. */
    const IMG_KNOWN = new Set(['src', 'alt', 'data-r', 'style']);

    function extraImgAttrs(openTag) {
        const body = openTag.replace(/^<img\s*/i, '').replace(/\s*\/?>$/, '');
        const re = /([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"[^"]*"|'[^']*')|([a-zA-Z_:][-\w:.]*)/g;
        const out = [];
        let m;
        while ((m = re.exec(body))) {
            const name = (m[1] || m[2] || '').toLowerCase();
            if (!name || IMG_KNOWN.has(name)) continue;
            out.push(m[0]);
        }
        return out.length ? out.join(' ') : null;
    }

    /* ---- l'unite atomique : <article class="lv-engine"> ----------------- */
    function parseEngine(src, k, n, ctx) {
        const base = k.start;
        n.articleAttrs = n.openTagRaw.replace(/^<article\s*/i, '').replace(/\s*\/?>$/, '');
        n.multiline = n.raw.indexOf('\n') >= 0;

        const f = {};
        S.walkElements(src, k.innerStart, k.innerEnd, (el, ot) => {
            const c = S.classListOf(ot);
            if (el.tag === 'div' && c.has('lv-name') && !f.name) f.name = el;
            else if (el.tag === 'div' && c.has('lv-meta') && !f.meta) f.meta = el;
            else if (el.tag === 'div' && c.has('lv-box') && !f.box) { f.box = el; return false; }
            else if (el.tag === 'img' && !f.img) { f.img = el; f.imgTag = ot; }
            else if (el.tag === 'button' && c.has('lv-flip-btn') && !f.flip) { f.flip = el; f.flipTag = ot; }
            else if (el.tag === 'button' && c.has('lv-var-btn') && !f.varBtn) {
                f.varBtn = src.slice(el.start, el.end);
            }
        });

        /* Bouton de variantes conserve tel quel : son libelle et son titre
           dependent des variantes declarees, l'editeur n'a pas a les recalculer. */
        n.varBtnRaw = f.varBtn || null;

        n.name = f.name ? decodeText(src.slice(f.name.innerStart, f.name.innerEnd)) : '';
        if (f.name) n.r.name = innerRange(base, f.name);

        n.meta = f.meta ? decodeText(src.slice(f.meta.innerStart, f.meta.innerEnd)) : null;
        if (f.meta) n.r.meta = innerRange(base, f.meta);

        n.boxHtml = f.box ? src.slice(f.box.innerStart, f.box.innerEnd) : '';
        if (f.box) n.r.box = innerRange(base, f.box);

        n.img = { src: '', alt: '', dataR: null, styleAttr: null, order: [] };
        if (f.img) {
            n.img.src = S.attrValue(f.imgTag, 'src') || '';
            n.img.alt = S.attrValue(f.imgTag, 'alt') || '';
            n.img.dataR = S.attrValue(f.imgTag, 'data-r');
            n.img.styleAttr = S.attrValue(f.imgTag, 'style');
            n.img.order = S.attrOrder(f.imgTag);
            n.img.extraAttrs = extraImgAttrs(f.imgTag);
            n.r.imgSrc = attrRangeIn(src, base, f.img, 'src');
            n.r.imgAlt = attrRangeIn(src, base, f.img, 'alt');
            n.r.imgDataR = attrRangeIn(src, base, f.img, 'data-r');
        }

        n.flip = f.flip
            ? { kind: /aria-label/i.test(f.flipTag) ? 'aria' : 'title' }
            : null;

        if (ctx) ctx.engines++;
    }

    /* ---- snapshot des champs editables, pour detecter les changements --- */
    function snapshot(n) {
        const o = {
            text: n.text, html: n.html, name: n.name, meta: n.meta,
            boxHtml: n.boxHtml, id: n.id,
            flipKind: n.flip ? n.flip.kind : null,
            childCount: n.children ? n.children.length : -1
        };
        if (n.img) o.img = { src: n.img.src, alt: n.img.alt, dataR: n.img.dataR };
        if (n.buttons) o.buttons = JSON.stringify(n.buttons.map(b => [b.href, b.label]));
        if (n.links) o.links = JSON.stringify(n.links.map(l => [l.href, l.img, l.alt]));
        return o;
    }

    /* ---- point d'entree ------------------------------------------------- */
    function parse(text, path) {
        const page = {
            path: path || '',
            slug: (path || '').split('/').pop().replace(/\.html$/i, ''),
            originalText: text,
            readOnly: false,
            parseError: null,
            dirty: false
        };

        const mainOpenStart = text.indexOf('<main');
        const mainCloseStart = text.indexOf('</main>');
        if (mainOpenStart < 0 || mainCloseStart < 0) {
            page.readOnly = true;
            page.parseError = 'Balise <main> introuvable';
            return page;
        }
        if (text.indexOf('</main>', mainCloseStart + 1) >= 0) {
            page.readOnly = true;
            page.parseError = 'Plusieurs </main> — decoupe ambigue';
            return page;
        }

        const mainOpenEnd = text.indexOf('>', mainOpenStart) + 1;
        page.head = text.slice(0, mainOpenStart);
        page.mainOpenTag = text.slice(mainOpenStart, mainOpenEnd);
        page.tail = text.slice(mainCloseStart);

        const mainCls = S.classListOf(page.mainOpenTag);
        page.mainClass = S.attrValue(page.mainOpenTag, 'class') || '';
        page.theme = ['lv-theme-red', 'lv-theme-orange', 'lv-theme-cfp']
            .find(t => mainCls.has(t)) || null;
        page.kind = mainCls.has('lv-page') ? 'subpage' : 'index';

        const ctx = { ids: [], engines: 0 };
        try {
            page.root = buildNodes(text, mainOpenEnd, mainCloseStart, ctx);
        } catch (err) {
            page.readOnly = true;
            page.parseError = err.message;
            return page;
        }

        page.ids = ctx.ids;
        page.engineCount = ctx.engines;
        page.sectionCount = countType(page.root, 'section');
        return page;
    }

    function countType(nodes, type) {
        let n = 0;
        (function walk(list) {
            for (const x of list) {
                if (x.type === type) n++;
                if (x.children) walk(x.children);
            }
        })(nodes || []);
        return n;
    }

    /* Parcours de tous les noeuds (profondeur d'abord). */
    function walk(page, fn, parent) {
        (function rec(list, par) {
            for (const n of list) {
                fn(n, par);
                if (n.children) rec(n.children, n);
            }
        })(page.root || [], parent || null);
    }

    window.LvParse = {
        parse: parse,
        walk: walk,
        countType: countType,
        snapshot: snapshot,
        decodeText: decodeText,
        CONTAINER: CONTAINER
    };
})();
