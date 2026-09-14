/* =========================================================================
   model.js — Mutations du modele.

   Les blancs entre enfants SONT des noeuds texte dans `children`. Toute
   insertion ajoute aussi son separateur, toute suppression retire le sien :
   le formatage est traite explicitement, jamais devine au moment du rendu.
   ========================================================================= */
(function () {
    'use strict';

    const P = window.LvParse;
    const Ser = window.LvSer;

    function touch(node, page) {
        node.dirty = true;
        if (page) page.dirty = true;
    }

    /* Le noeud a-t-il reellement change par rapport a son instantane ? */
    function recompute(node) {
        if (node.raw == null) return true;
        const now = P.snapshot(node);
        const o = node._orig;
        for (const k of Object.keys(now)) {
            if (k === 'img') {
                if (!o.img || o.img.src !== now.img.src || o.img.alt !== now.img.alt
                    || o.img.dataR !== now.img.dataR) return true;
            } else if (now[k] !== o[k]) return true;
        }
        return false;
    }

    function setField(node, page, apply) {
        apply(node);
        node.dirty = recompute(node);
        if (node.dirty && page) page.dirty = true;
        return node.dirty;
    }

    /* ---- positions des elements dans un tableau children ---------------- */

    function elementPositions(children) {
        const pos = [];
        for (let i = 0; i < children.length; i++) {
            const t = children[i].type;
            if (t !== 'text' && t !== 'comment') pos.push(i);
        }
        return pos;
    }

    function textNode(raw) {
        return { type: 'text', raw: raw, dirty: false };
    }

    /* Insere `node` a l'index d'element `index` (fin si >= nombre d'elements). */
    function insertChild(container, index, node, page) {
        const kids = container.children;
        const pos = elementPositions(kids);
        const prof = Ser.profileOf(container, page);
        node._profile = prof;
        const sep = textNode(prof.sep);

        if (index >= pos.length) {
            if (pos.length === 0) {
                /* Conteneur vide : le blanc final est l'indentation de la
                   balise fermante — on insere AVANT lui, pas apres. */
                const lastIsText = kids.length && kids[kids.length - 1].type === 'text';
                if (lastIsText) kids.splice(kids.length - 1, 0, sep, node);
                else kids.push(sep, node, textNode(prof.sep.replace(/  $/, '')));
            } else {
                kids.splice(pos[pos.length - 1] + 1, 0, sep, node);
            }
        } else {
            kids.splice(pos[index], 0, node, sep);
        }
        container.dirty = true;
        if (page) page.dirty = true;
        return node;
    }

    /* Retire l'element d'index `index` et son separateur adjacent. */
    function removeChild(container, index, page) {
        const kids = container.children;
        const pos = elementPositions(kids);
        if (index < 0 || index >= pos.length) return null;
        const p = pos[index];
        const removed = kids[p];

        /* Retirer le blanc precedent s'il existe, sinon le suivant. */
        let cut = p, len = 1;
        if (p > 0 && kids[p - 1].type === 'text' && /\n/.test(kids[p - 1].raw)
            && elementPositions(kids).length > 1) {
            cut = p - 1; len = 2;
        } else if (p + 1 < kids.length && kids[p + 1].type === 'text'
            && /\n/.test(kids[p + 1].raw) && elementPositions(kids).length > 1) {
            len = 2;
        }
        kids.splice(cut, len);
        container.dirty = true;
        if (page) page.dirty = true;
        return removed;
    }

    /* Deplace l'element `from` vers l'index d'element `to` dans le meme conteneur. */
    function moveChild(container, from, to, page) {
        if (from === to) return;
        const node = removeChild(container, from, page);
        if (!node) return;
        insertChild(container, from < to ? to - 1 : to, node, page);
    }

    /* ---- deplacement de blocs (reordonnancement) ------------------------ */

    /* Étendue reellement deplacable d'un bloc : l'element PLUS le bandeau de
       commentaires ASCII qui le titre. Les pages suivent une convention nette
       — une ligne vide separe deux blocs, un simple retour a la ligne lie un
       commentaire a l'element qui suit. Sans cela, deplacer une section
       laisserait son bandeau derriere elle, a titrer la mauvaise section. */
    function blockSpan(children, arrayIndex) {
        let start = arrayIndex;
        let i = arrayIndex - 1;
        while (i >= 0) {
            const n = children[i];
            if (n.type === 'comment') { start = i; i--; continue; }
            if (n.type === 'text' && /\n/.test(n.raw) && !/\n[ \t]*\r?\n/.test(n.raw)
                && i - 1 >= 0 && children[i - 1].type === 'comment') { i--; continue; }
            break;
        }
        return { start: start, end: arrayIndex + 1 };
    }

    /* Deplace le bloc d'index d'element `from` vers `to`, bandeau compris,
       en emportant son separateur amont pour preserver l'aeration. */
    function moveBlock(container, from, to, page) {
        const kids = container.children;
        const pos = elementPositions(kids);
        if (from < 0 || from >= pos.length) return;
        if (to === from || to === from + 1) return;         // sur place

        const span = blockSpan(kids, pos[from]);
        let cut = span.start, len = span.end - span.start;

        /* Le blanc amont n'est un separateur que s'il y a un element avant lui ;
           sinon c'est l'indentation d'ouverture du conteneur, a ne pas voler. */
        const hasElementBefore = pos.some(p => p < cut - 1);
        let sepNode = null;
        if (cut > 0 && kids[cut - 1].type === 'text' && /\n/.test(kids[cut - 1].raw)
            && hasElementBefore) {
            sepNode = kids[cut - 1];
            cut--; len++;
        }

        const slice = kids.splice(cut, len);
        const block = sepNode ? slice.slice(1) : slice;
        if (!sepNode) sepNode = textNode(Ser.profileOf(container, page).sep);

        const pos2 = elementPositions(kids);
        const dst = to > from ? to - 1 : to;

        if (dst >= pos2.length) {
            const last = pos2.length ? blockSpan(kids, pos2[pos2.length - 1]).end : kids.length;
            kids.splice.apply(kids, [last, 0, sepNode].concat(block));
        } else {
            const target = blockSpan(kids, pos2[dst]).start;
            kids.splice.apply(kids, [target, 0].concat(block, [sepNode]));
        }

        container.dirty = true;
        if (page) page.dirty = true;
    }

    /* Deplace un element d'un conteneur a un autre. */
    function transferChild(src, index, dst, dstIndex, page) {
        const node = removeChild(src, index, page);
        if (!node) return null;
        /* Le noeud change de contexte de formatage : forcer un rendu neuf
           si le style du conteneur cible differe. */
        const prof = Ser.profileOf(dst, page);
        if (node.type === 'engine' && node.multiline !== prof.multiline) {
            node.raw = null;
            node.dirty = true;
            node.multiline = prof.multiline;
        }
        return insertChild(dst, dstIndex, node, page);
    }

    /* ---- fabriques de noeuds -------------------------------------------- */

    function todayFR() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
    }

    /* Style de bouton flip majoritaire dans le conteneur (pour ne pas
       introduire une troisieme variante d'attribut). */
    function flipKindOf(container) {
        let aria = 0, title = 0;
        for (const c of container.children || []) {
            if (c.type === 'engine' && c.flip) {
                if (c.flip.kind === 'aria') aria++; else title++;
            }
        }
        return title > aria ? 'title' : 'aria';
    }

    /* Dossier d'images utilise par les engins voisins. */
    function folderOf(container) {
        for (const c of (container.children || [])) {
            if (c.type === 'engine' && c.img && c.img.src) {
                const m = /^livrees_img\/([^/]+)\//.exec(c.img.src);
                if (m) return m[1];
            }
        }
        return null;
    }

    function newEngine(container, page, fields) {
        fields = fields || {};
        const prof = Ser.profileOf(container, page);
        const n = {
            type: 'engine', tag: 'article', raw: null, dirty: true, r: {},
            articleAttrs: 'class="lv-engine"',
            multiline: prof.multiline,
            name: fields.name || 'Nouvel engin',
            meta: fields.meta !== undefined ? fields.meta : 'Dernière MAJ : ' + todayFR(),
            boxHtml: fields.boxHtml || '',
            img: {
                src: fields.src || '',
                alt: fields.alt !== undefined ? fields.alt : (fields.name || 'Nouvel engin'),
                dataR: fields.dataR || null,
                styleAttr: null,
                order: ['src', 'alt']
            },
            flip: fields.dataR ? { kind: flipKindOf(container) } : null,
            _profile: prof
        };
        n._orig = P.snapshot(n);
        return n;
    }

    function slugify(s) {
        return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
    }

    function uniqueId(page, base) {
        const taken = new Set();
        P.walk(page, n => { if (n.id != null) taken.add(n.id); });
        let id = slugify(base), k = 2;
        while (taken.has(id)) id = slugify(base) + '-' + (k++);
        return id;
    }

    function mk(type, extra) {
        const n = Object.assign({ type: type, raw: null, dirty: true, r: {} }, extra);
        n._orig = P.snapshot(n);
        return n;
    }

    function newCatbar(text) { return mk('catbar', { tag: 'div', text: text || 'Nouvelle catégorie' }); }
    function newSep(text) { return mk('sep', { tag: 'div', text: text || 'Groupe' }); }
    function newH2(page, text) {
        return mk('h2', { tag: 'h2', text: text || 'Titre', id: uniqueId(page, text || 'titre') });
    }
    function newDesc(html) { return mk('desc', { tag: 'div', html: html || '<p></p>' }); }

    /* Description intercalee DANS une liste d'engins : le corps est indente
       comme ses voisins, sur le modele du paragraphe qui presente le TGV
       Turbomeca Duplex dans xpress.html. */
    function newListDesc(container, page, text) {
        const prof = Ser.profileOf(container, page);
        const n = newDesc(prof.nl + prof.indent + '  '
            + '<p>' + Ser.esc(text || '') + '</p>'
            + prof.nl + prof.indent);
        n._profile = prof;
        return n;
    }

    /* `indent` = indentation de la balise fermante du conteneur cree. */
    function newList(indent) {
        const ind = indent == null ? '      ' : indent;
        const n = mk('list', {
            tag: 'div',
            openTagRaw: '<div class="lv-list">',
            closeTagRaw: '</div>',
            children: [textNode('\r\n' + ind)]
        });
        n.raw = null;
        return n;
    }

    function newSection(page, title, indent) {
        const id = uniqueId(page, title || 'nouvelle-section');
        const ind = indent == null ? '    ' : indent;       // indentation de </section>
        const inner = ind + '  ';                            // catbar / lv-list
        const n = mk('section', {
            tag: 'section',
            id: id,
            openTagRaw: '<section class="lv-cat" id="' + Ser.escAttr(id) + '">',
            closeTagRaw: '</section>',
            children: [
                textNode('\r\n' + inner), newCatbar(title || 'Nouvelle catégorie'),
                textNode('\r\n' + inner), newList(inner),
                textNode('\r\n' + ind)
            ]
        });
        n.raw = null;
        return n;
    }

    /* Ajoute un bloc a la racine de <main>, AVANT le blanc final qui precede
       </main>, avec une ligne vide de separation comme dans les pages. */
    function appendRootBlock(page, node, index) {
        const kids = page.root;
        const pos = elementPositions(kids);
        const sep = textNode('\r\n\r\n    ');
        if (index == null || index >= pos.length) {
            const at = pos.length ? pos[pos.length - 1] + 1 : kids.length;
            kids.splice(at, 0, sep, node);
        } else {
            kids.splice(pos[index], 0, node, sep);
        }
        page.dirty = true;
        return node;
    }

    /* ---- annulation ------------------------------------------------------ */

    function revert(page) {
        return P.parse(page.originalText, page.path);
    }

    window.LvModel = {
        touch: touch,
        setField: setField,
        recompute: recompute,
        elementPositions: elementPositions,
        textNode: textNode,
        insertChild: insertChild,
        removeChild: removeChild,
        moveChild: moveChild,
        moveBlock: moveBlock,
        blockSpan: blockSpan,
        transferChild: transferChild,
        newEngine: newEngine,
        newCatbar: newCatbar,
        newSep: newSep,
        newH2: newH2,
        newDesc: newDesc,
        newListDesc: newListDesc,
        newList: newList,
        newSection: newSection,
        appendRootBlock: appendRootBlock,
        slugify: slugify,
        uniqueId: uniqueId,
        flipKindOf: flipKindOf,
        folderOf: folderOf,
        todayFR: todayFR
    };
})();
