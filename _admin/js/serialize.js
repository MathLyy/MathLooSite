/* =========================================================================
   serialize.js — Modele Page -> texte source.

   Principe directeur : ce qui n'est pas edite est reemis octet pour octet.
     Niveau 1 : noeud intact                  -> n.raw
     Niveau 2 : scalaire modifie              -> patch par offsets dans n.raw
     Niveau 3 : changement structurel / neuf  -> rendu depuis le modele,
                avec un profil de formatage herite des freres.
   ========================================================================= */
(function () {
    'use strict';

    const S = window.LvScan;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escAttr(s) {
        return esc(s).replace(/"/g, '&quot;');
    }

    /* Applique des remplacements {start,end,text} (offsets dans `src`). */
    function applyEdits(src, edits) {
        const list = edits.slice().sort((a, b) => b.start - a.start);
        let out = src;
        for (const e of list) out = out.slice(0, e.start) + e.text + out.slice(e.end);
        return out;
    }
    function ed(range, text) {
        return { start: range.start, end: range.end, text: text };
    }

    /* ---- niveau 2 : quels scalaires ont bouge ? ------------------------- */

    /* Edits situes dans la balise ouvrante seule (containers). */
    function openTagEdits(n) {
        const e = [];
        if (n._orig.id !== n.id && n.id != null && n.r.id) e.push(ed(n.r.id, escAttr(n.id)));
        return e;
    }

    function engineEdits(n) {
        const o = n._orig, e = [];

        /* Changements structurels -> niveau 3. */
        if ((o.meta != null) !== (n.meta != null)) return null;
        if ((o.img.dataR != null) !== (n.img.dataR != null)) return null;
        if ((o.flipKind != null) !== (n.flip != null)) return null;
        if (n.flip && o.flipKind !== n.flip.kind) return null;

        if (o.name !== n.name) {
            if (!n.r.name) return null;
            e.push(ed(n.r.name, esc(n.name)));
        }
        if (n.meta != null && o.meta !== n.meta) {
            if (!n.r.meta) return null;
            e.push(ed(n.r.meta, esc(n.meta)));
        }
        if (o.boxHtml !== n.boxHtml) {
            if (!n.r.box) return null;
            e.push(ed(n.r.box, n.boxHtml));
        }
        if (o.img.src !== n.img.src) {
            if (!n.r.imgSrc) return null;
            e.push(ed(n.r.imgSrc, escAttr(n.img.src)));
        }
        if (o.img.alt !== n.img.alt) {
            if (!n.r.imgAlt) return null;
            e.push(ed(n.r.imgAlt, escAttr(n.img.alt)));
        }
        if (n.img.dataR != null && o.img.dataR !== n.img.dataR) {
            if (!n.r.imgDataR) return null;
            e.push(ed(n.r.imgDataR, escAttr(n.img.dataR)));
        }
        if (o.id !== n.id) {
            if (n.id == null || !n.r.id) return null;
            e.push(ed(n.r.id, escAttr(n.id)));
        }
        return e;
    }

    function leafEdits(n) {
        if (n.type === 'engine') return engineEdits(n);
        const o = n._orig, e = [];

        if (o.id !== n.id) {
            if (n.id == null || !n.r.id) return null;
            e.push(ed(n.r.id, escAttr(n.id)));
        }
        if (n.text !== undefined && o.text !== n.text) {
            if (!n.r.text) return null;
            e.push(ed(n.r.text, esc(n.text)));
        }
        if (n.html !== undefined && o.html !== n.html) {
            if (!n.r.html) return null;
            e.push(ed(n.r.html, n.html));
        }
        if (n.buttons) {
            const cur = JSON.stringify(n.buttons.map(b => [b.href, b.label]));
            if (cur !== o.buttons) {
                if (n.buttons.length !== JSON.parse(o.buttons).length) return null;
                const prev = JSON.parse(o.buttons);
                for (let i = 0; i < n.buttons.length; i++) {
                    const b = n.buttons[i];
                    if (prev[i][0] !== b.href) {
                        if (!b.rHref) return null;
                        e.push(ed(b.rHref, escAttr(b.href)));
                    }
                    if (prev[i][1] !== b.label) {
                        if (!b.rLabel) return null;
                        e.push(ed(b.rLabel, esc(b.label)));
                    }
                }
            }
        }
        if (n.links) {
            const cur = JSON.stringify(n.links.map(l => [l.href, l.img, l.alt]));
            if (cur !== o.links) {
                const prev = JSON.parse(o.links);
                if (n.links.length !== prev.length) return null;
                for (let i = 0; i < n.links.length; i++) {
                    const l = n.links[i];
                    if (prev[i][0] !== l.href) {
                        if (!l.rHref) return null;
                        e.push(ed(l.rHref, escAttr(l.href)));
                    }
                    if (prev[i][1] !== l.img) {
                        if (!l.rImg) return null;
                        e.push(ed(l.rImg, escAttr(l.img)));
                    }
                    if (prev[i][2] !== l.alt) {
                        if (!l.rAlt) return null;
                        e.push(ed(l.rAlt, escAttr(l.alt)));
                    }
                }
            }
        }
        return e;
    }

    /* ---- profils de formatage, herites du conteneur --------------------- */

    function mode(arr) {
        const c = new Map();
        let best = null, n = 0;
        for (const v of arr) {
            const k = (c.get(v) || 0) + 1;
            c.set(v, k);
            if (k > n) { n = k; best = v; }
        }
        return best;
    }

    /* Separateur (noeud texte) le plus frequent entre les enfants.
       Conteneur vide : on descend d'un niveau depuis l'indentation de la
       balise fermante, pour que le premier enfant tombe au bon endroit. */
    function profileOf(container, page) {
        const kids = container.children || [];
        const elems = kids.filter(c => c.type !== 'text' && c.type !== 'comment');
        const seps = kids.filter(c => c.type === 'text' && /\n/.test(c.raw)).map(c => c.raw);
        let sep;
        if (elems.length === 0) {
            sep = (seps.length ? seps[seps.length - 1] : '\r\n      ') + '  ';
        } else {
            sep = mode(seps) || '\r\n        ';
        }
        const eng = kids.find(c => c.type === 'engine');
        const m = /\n([ \t]*)$/.exec(sep);
        return {
            sep: sep,
            indent: m ? m[1] : '        ',
            nl: sep.indexOf('\r\n') >= 0 ? '\r\n' : '\n',
            multiline: eng ? eng.multiline : true
        };
    }

    /* Profil de rendu d'un noeud : celui attache a l'insertion (model.js),
       sinon deduit du `raw` du noeud lui-meme — indispensable pour qu'un
       engin existant qui devient structurel garde SON format d'origine. */
    function profileFor(n, page) {
        if (n._profile) return n._profile;
        const raw = n.raw || '';
        const multiline = n.multiline !== undefined ? n.multiline : /\n/.test(raw);
        const m = /\n([ \t]*)<\/[a-zA-Z]+>\s*$/.exec(raw);
        const indent = m ? m[1] : '        ';
        const nl = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\r\n';
        return { sep: nl + indent, indent: indent, nl: nl, multiline: multiline };
    }

    /* ---- niveau 3 : rendu depuis le modele ------------------------------ */

    function renderImg(im) {
        const iR = im.order.indexOf('data-r'), iA = im.order.indexOf('alt');
        let s = '<img src="' + escAttr(im.src) + '"';
        if (im.dataR && iR >= 0 && iA >= 0 && iR < iA) {
            s += ' data-r="' + escAttr(im.dataR) + '" alt="' + escAttr(im.alt) + '"';
        } else {
            s += ' alt="' + escAttr(im.alt) + '"';
            if (im.dataR) s += ' data-r="' + escAttr(im.dataR) + '"';
        }
        if (im.styleAttr) s += ' style="' + escAttr(im.styleAttr) + '"';
        /* Attributs non geres par le modele (data-vars…), reemis verbatim. */
        if (im.extraAttrs) s += ' ' + im.extraAttrs;
        return s + ' />';
    }

    function renderFlip(flip) {
        if (!flip) return '';
        return flip.kind === 'aria'
            ? '<button class="lv-flip-btn" aria-label="Retourner">R</button>'
            : '<button class="lv-flip-btn" title="Inverser">R</button>';
    }

    function renderEngine(n, page) {
        const p = profileFor(n, page);
        const attrs = n.articleAttrs ? ' ' + n.articleAttrs : ' class="lv-engine"';
        const img = renderImg(n.img);
        const flip = renderFlip(n.flip);
        const varBtn = n.varBtnRaw || '';
        const meta = n.meta != null
            ? '<div class="lv-meta">' + esc(n.meta) + '</div>' : '';

        if (!p.multiline) {
            return '<article' + attrs + '><div class="lv-left"><div class="lv-leftrow">'
                + '<div class="lv-leftcol"><div class="lv-title">'
                + '<div class="lv-name">' + esc(n.name) + '</div>' + meta
                + '</div></div><div class="lv-imgframe">' + img + flip + varBtn + '</div>'
                + '</div></div><div class="lv-right"><div class="lv-box">'
                + n.boxHtml + '</div></div></article>';
        }

        const nl = p.nl, i0 = p.indent;
        const I = k => nl + i0 + '  '.repeat(k);
        let s = '<article' + attrs + '>';
        s += I(1) + '<div class="lv-left">';
        s += I(2) + '<div class="lv-leftrow">';
        s += I(3) + '<div class="lv-leftcol">';
        s += I(4) + '<div class="lv-title">';
        s += I(5) + '<div class="lv-name">' + esc(n.name) + '</div>';
        if (meta) s += I(5) + meta;
        s += I(4) + '</div>';
        s += I(3) + '</div>';
        s += I(3) + '<div class="lv-imgframe">';
        s += I(4) + img + (flip ? I(4) + flip : '') + (varBtn ? I(4) + varBtn : '');
        s += I(3) + '</div>';
        s += I(2) + '</div>';
        s += I(1) + '</div>';
        s += I(1) + '<div class="lv-right">';
        s += I(2) + '<div class="lv-box">' + n.boxHtml + '</div>';
        s += I(1) + '</div>';
        s += nl + i0 + '</article>';
        return s;
    }

    /* Separateur interne d'un conteneur a enfants simples (<a>, ...). */
    function innerSep(raw, childTag, fallback) {
        const m = new RegExp('(\\r?\\n[ \\t]*)<' + childTag + '\\b').exec(raw);
        return m ? m[1] : fallback;
    }
    function innerCloseSep(raw, fallback) {
        const m = /(\r?\n[ \t]*)<\/[a-zA-Z]+>\s*$/.exec(raw);
        return m ? m[1] : fallback;
    }

    function renderBtns(n) {
        const sep = innerSep(n.raw, 'a', '\r\n        ');
        const close = innerCloseSep(n.raw, '\r\n      ');
        if (!n.buttons.length) return n.openTagRaw + n.closeTagRaw;
        return n.openTagRaw
            + n.buttons.map(b => sep + '<a class="lv-btn" href="'
                + escAttr(b.href) + '">' + esc(b.label) + '</a>').join('')
            + close + n.closeTagRaw;
    }

    function renderIcons(n) {
        const sep = innerSep(n.raw, 'a', '\r\n                        ');
        const close = innerCloseSep(n.raw, '\r\n                    ');
        if (!n.links.length) return n.openTagRaw + n.closeTagRaw;
        return n.openTagRaw
            + n.links.map(l => sep + '<a href="' + escAttr(l.href) + '"><img src="'
                + escAttr(l.img) + '" alt="' + escAttr(l.alt) + '" /></a>').join('')
            + close + n.closeTagRaw;
    }

    function renderNode(n, page) {
        switch (n.type) {
            case 'engine': return renderEngine(n, page);
            case 'topbar': return '<div class="lv-topbar">' + esc(n.text) + '</div>';
            case 'catbar': return '<div class="lv-catbar">' + esc(n.text) + '</div>';
            case 'sep': return '<div class="lv-country-sep">' + esc(n.text) + '</div>';
            case 'sub': return '<span class="lv-sub">' + esc(n.text) + '</span>';
            case 'catTitle': return '<h2 class="lv-category-title">' + esc(n.text) + '</h2>';
            case 'lastmodText': return '<p>' + esc(n.text) + '</p>';
            case 'h2': return '<h2' + (n.id != null ? ' id="' + escAttr(n.id) + '"' : '')
                + '>' + esc(n.text) + '</h2>';
            case 'desc': return '<' + n.tag + ' class="lv-desc">' + n.html + '</' + n.tag + '>';
            case 'btns': return renderBtns(n);
            case 'icons': return renderIcons(n);
            default: return n.raw;
        }
    }

    /* ---- rendu recursif -------------------------------------------------- */

    function render(n, page) {
        if (n.children) {
            /* Les conteneurs sont toujours reassembles : les enfants intacts
               renvoient leur raw, donc le resultat est identique a l'original
               quand rien n'a bouge. Les blancs entre enfants sont des noeuds
               texte, preserves verbatim. */
            let open = n.openTagRaw;
            const e = openTagEdits(n);
            if (e.length) open = applyEdits(open, e);
            return open + n.children.map(c => render(c, page)).join('') + n.closeTagRaw;
        }
        if (!n.dirty) return n.raw;
        if (n.raw != null) {
            const edits = leafEdits(n);
            if (edits !== null) return applyEdits(n.raw, edits);
        }
        return renderNode(n, page);
    }

    function renderMainOpen(page) {
        const cur = S.attrValue(page.mainOpenTag, 'class');
        if (cur === page.mainClass) return page.mainOpenTag;
        const r = S.attrRange(page.mainOpenTag, 'class');
        if (!r) return page.mainOpenTag;
        return page.mainOpenTag.slice(0, r.start) + escAttr(page.mainClass)
            + page.mainOpenTag.slice(r.end);
    }

    function build(page) {
        if (page.readOnly) return page.originalText;
        return page.head
            + renderMainOpen(page)
            + page.root.map(n => render(n, page)).join('')
            + page.tail;
    }

    /* ---- verification avant ecriture ------------------------------------- */

    function verify(page, out) {
        const problems = [];
        if (!out.startsWith(page.head)) problems.push('Le <head> / la navbar a ete modifie');
        if (!out.endsWith(page.tail)) problems.push('Le footer a ete modifie');

        const doc = new DOMParser().parseFromString(out, 'text/html');
        if (doc.querySelector('parsererror')) problems.push('HTML invalide apres rendu');

        let re = null;
        try { re = window.LvParse.parse(out, page.path); }
        catch (err) { problems.push('Re-parse impossible : ' + err.message); }

        if (re && !re.readOnly) {
            const want = countLive(page);
            const got = { engines: re.engineCount, sections: re.sectionCount };
            if (want.engines !== got.engines) {
                problems.push('Nombre d\'engins incoherent : ' + got.engines
                    + ' au lieu de ' + want.engines);
            }
            if (want.sections !== got.sections) {
                problems.push('Nombre de sections incoherent : ' + got.sections
                    + ' au lieu de ' + want.sections);
            }
            if (build(re) !== out) problems.push('Rendu non idempotent');
        } else if (re && re.readOnly) {
            problems.push('Le resultat n\'est plus analysable : ' + re.parseError);
        }
        return problems;
    }

    function countLive(page) {
        let engines = 0, sections = 0;
        window.LvParse.walk(page, n => {
            if (n.type === 'engine') engines++;
            if (n.type === 'section') sections++;
        });
        return { engines: engines, sections: sections };
    }

    function dirtyCount(page) {
        let k = 0;
        window.LvParse.walk(page, n => { if (n.dirty) k++; });
        return k;
    }

    window.LvSer = {
        esc: esc,
        escAttr: escAttr,
        applyEdits: applyEdits,
        build: build,
        render: render,
        renderNode: renderNode,
        renderEngine: renderEngine,
        renderImg: renderImg,
        profileOf: profileOf,
        verify: verify,
        countLive: countLive,
        dirtyCount: dirtyCount
    };
})();
