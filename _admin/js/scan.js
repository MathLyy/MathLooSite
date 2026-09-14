/* =========================================================================
   scan.js — Scanner de source HTML par offsets.
   Ne construit AUCUN DOM : retourne les enfants directs d'une region du
   texte source sous forme de plages [start, end). C'est ce qui permet de
   reemettre verbatim tout ce qui n'est pas edite.
   ========================================================================= */
(function () {
    'use strict';

    const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img',
        'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    const RAWTEXT = new Set(['script', 'style', 'textarea', 'title']);

    /* Index juste apres le '>' qui ferme la balise commencant a `lt`.
       Ignore les '>' a l'interieur des valeurs d'attributs entre guillemets. */
    function endOfTag(src, lt) {
        let i = lt + 1, q = 0;
        while (i < src.length) {
            const c = src[i];
            if (q) { if (c === q) q = 0; }
            else if (c === '"' || c === "'") q = c;
            else if (c === '>') return i + 1;
            i++;
        }
        return src.length;
    }

    /* Index du '<' de la balise fermante correspondant a l'element dont la
       balise ouvrante se termine a `openEnd`. -1 si non trouvee avant `limit`. */
    function matchClose(src, openEnd, tag, limit) {
        const re = new RegExp('<(/?)' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\s/>])', 'gi');
        re.lastIndex = openEnd;
        const stop = limit == null ? src.length : limit;
        let depth = 1, m;
        while ((m = re.exec(src))) {
            if (m.index >= stop) break;
            depth += m[1] ? -1 : 1;
            if (depth === 0) return m.index;
        }
        return -1;
    }

    /* Enfants directs de src[from, to).
       -> [{type:'text'|'comment', start, end}
           {type:'element', tag, start, end, openEnd, innerStart, innerEnd}]
       Les noeuds sont contigus et couvrent exactement la region. */
    function childNodesOf(src, from, to) {
        const out = [];
        let i = from, textStart = from;

        const pushText = end => {
            if (end > textStart) out.push({ type: 'text', start: textStart, end: end });
        };

        while (i < to) {
            const lt = src.indexOf('<', i);
            if (lt < 0 || lt >= to) break;

            if (src.startsWith('<!--', lt)) {
                const c = src.indexOf('-->', lt);
                const end = (c < 0 || c + 3 > to) ? to : c + 3;
                pushText(lt);
                out.push({ type: 'comment', start: lt, end: end });
                i = textStart = end;
                continue;
            }

            const m = /^<([a-zA-Z][-\w:]*)/.exec(src.slice(lt, lt + 64));
            if (!m) { i = lt + 1; continue; }   // '<' litteral -> reste du texte

            const tag = m[1].toLowerCase();
            const openEnd = endOfTag(src, lt);
            if (openEnd > to) break;            // balise tronquee par la region

            const selfClosed = src[openEnd - 2] === '/';
            pushText(lt);

            let end, innerStart = openEnd, innerEnd = openEnd;

            if (VOID.has(tag) || selfClosed) {
                end = openEnd;
            } else if (RAWTEXT.has(tag)) {
                const c = src.toLowerCase().indexOf('</' + tag, openEnd);
                if (c < 0 || c >= to) { innerEnd = to; end = to; }
                else { innerEnd = c; end = endOfTag(src, c); }
            } else {
                const closeLt = matchClose(src, openEnd, tag, to);
                if (closeLt < 0) { innerEnd = to; end = to; }
                else { innerEnd = closeLt; end = endOfTag(src, closeLt); }
            }

            out.push({
                type: 'element', tag: tag, start: lt, end: end,
                openEnd: openEnd, innerStart: innerStart, innerEnd: innerEnd
            });
            i = textStart = end;
        }

        pushText(to);
        return out;
    }

    /* Garde-fou : les noeuds doivent recouvrir la region octet pour octet. */
    function verifyCoverage(src, from, to, nodes) {
        let cursor = from;
        for (const n of nodes) {
            if (n.start !== cursor) return false;
            if (n.end < n.start) return false;
            cursor = n.end;
        }
        return cursor === to;
    }

    /* Parcours en profondeur des elements de src[from, to).
       fn(node, openTag) ; retourner false pour ne pas descendre dedans. */
    function walkElements(src, from, to, fn) {
        const kids = childNodesOf(src, from, to);
        for (const k of kids) {
            if (k.type !== 'element') continue;
            const openTag = src.slice(k.start, k.openEnd);
            if (fn(k, openTag) === false) continue;
            if (k.innerEnd > k.innerStart) walkElements(src, k.innerStart, k.innerEnd, fn);
        }
    }

    /* Plage de la VALEUR d'un attribut dans une balise ouvrante.
       -> {start, end, value} en offsets relatifs a `openTag`, ou null. */
    function attrRange(openTag, name) {
        const re = new RegExp('[\\s]' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*(["\'])', 'i');
        const m = re.exec(openTag);
        if (!m) return null;
        const q = m[1];
        const vs = m.index + m[0].length;
        const ve = openTag.indexOf(q, vs);
        if (ve < 0) return null;
        return { start: vs, end: ve, value: openTag.slice(vs, ve) };
    }

    function attrValue(openTag, name) {
        const r = attrRange(openTag, name);
        return r ? r.value : null;
    }

    /* Set des classes d'une balise ouvrante. */
    function classListOf(openTag) {
        const v = attrValue(openTag, 'class');
        const s = new Set();
        if (v) v.trim().split(/\s+/).forEach(c => { if (c) s.add(c); });
        return s;
    }

    /* Ordre d'apparition des attributs, pour restituer fidelement. */
    function attrOrder(openTag) {
        const names = [];
        const re = /[\s]([a-zA-Z_:][-\w:.]*)\s*=/g;
        let m;
        while ((m = re.exec(openTag))) names.push(m[1].toLowerCase());
        return names;
    }

    window.LvScan = {
        VOID: VOID,
        endOfTag: endOfTag,
        matchClose: matchClose,
        childNodesOf: childNodesOf,
        verifyCoverage: verifyCoverage,
        walkElements: walkElements,
        attrRange: attrRange,
        attrValue: attrValue,
        classListOf: classListOf,
        attrOrder: attrOrder
    };
})();
