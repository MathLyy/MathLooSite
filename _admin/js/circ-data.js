/* =========================================================================
   circ-data.js — Lecture et réécriture de mltc/data/circulations.js.

   Le fichier est du JSON strict enveloppé dans
   « window.MLTC_CIRCULATIONS = { ... }; ». Tout ce qui précède la première
   accolade (commentaire d'en-tête compris) et suit la dernière est recollé
   tel quel. Le JSON est remis en forme comme à sa création : une valeur
   tient sur une ligne si elle ne dépasse pas 110 colonnes, sinon elle est
   dépliée. Un fichier relu puis réécrit sans modification est donc
   identique à l'octet près (vérifié par l'auto-test).
   ========================================================================= */
(function () {
    'use strict';

    const PATH = 'mltc/data/circulations.js';
    const WIDTH = 110;

    /* Ordre des clés d'un train, appliqué quand une clé est ajoutée. */
    const ORDER = ['name', 'route', 'detail', 'countries', 'epoques', 'composition', 'direction', 'speed', 'track', 'decor',
        'reverse_composition', 'reverse_departure', 'start_stationary', 'starting_speed', 'y_offset',
        'stop', 'station', 'foreground', 'background', 'variants'];
    const STOP_ORDER = ['at', 'duration', 'loco_change', 'detach_count', 'detach_position',
        'attach', 'attach_position', 'attach_self_detach_count'];
    const STATION_ORDER = ['at', 'length', 'platform', 'building', 'building_x'];
    const BG_ORDER = ['name', 'service', 'composition', 'direction', 'speed', 'chance', 'delay', 'y_offset', 'start_stationary', 'stop'];

    const COUNTRIES = ['France', 'Royaume-Uni', 'Belgique', 'Pays-Bas', 'Luxembourg', 'Allemagne',
        'Danemark', 'Espagne', 'Italie', 'Autriche', 'République tchèque', 'Suisse'];
    /* Époques de la période historique (carte Circulations). */
    const EPOQUES = ['1958-1973', '1973-1984', '1984-1997', '1997-2001'];

    /* ---- découpage ------------------------------------------------------ */

    function split(text) {
        const mark = text.indexOf('MLTC_CIRCULATIONS');
        if (mark < 0) throw new Error('« window.MLTC_CIRCULATIONS = » introuvable');
        const start = text.indexOf('{', mark);
        const end = text.lastIndexOf('}');
        if (start < 0 || end < start) throw new Error('accolades du JSON introuvables');
        const data = JSON.parse(text.slice(start, end + 1));
        return { prefix: text.slice(0, start), data: data, suffix: text.slice(end + 1) };
    }

    /* ---- mise en forme -------------------------------------------------- */

    const q = s => JSON.stringify(s);
    const len = s => Array.from(s).length;    // en caractères, comme Python

    function one(v) {
        if (Array.isArray(v)) return '[' + v.map(one).join(', ') + ']';
        if (v && typeof v === 'object') {
            return '{' + Object.keys(v).map(k => q(k) + ': ' + one(v[k])).join(', ') + '}';
        }
        return JSON.stringify(v);
    }

    function fmt(v, col, ind) {
        const line = one(v);
        const empty = Array.isArray(v) ? !v.length : (v && typeof v === 'object' ? !Object.keys(v).length : true);
        if (col + len(line) <= WIDTH || !v || typeof v !== 'object' || empty) return line;
        const inner = ind + 2, pad = ' '.repeat(inner);
        if (Array.isArray(v)) {
            return '[\n' + v.map(x => pad + fmt(x, inner, inner)).join(',\n') + '\n' + ' '.repeat(ind) + ']';
        }
        return '{\n' + Object.keys(v).map(k => {
            const kk = q(k) + ': ';
            return pad + kk + fmt(v[k], inner + len(kk), inner);
        }).join(',\n') + '\n' + ' '.repeat(ind) + '}';
    }

    function fmtTrain(t, ind) {
        const inner = ind + 2, pad = ' '.repeat(inner);
        return ' '.repeat(ind) + '{\n' + Object.keys(t).map(k => {
            const kk = q(k) + ': ';
            return pad + kk + fmt(t[k], inner + len(kk), inner);
        }).join(',\n') + '\n' + ' '.repeat(ind) + '}';
    }

    function format(data) {
        const parts = Object.keys(data).map(key => {
            const v = data[key];
            const kk = '  ' + q(key) + ': ';
            if (key === '_aide' && Array.isArray(v)) {
                return kk + '[\n' + v.map(a => '    ' + q(a)).join(',\n') + '\n  ]';
            }
            if (key === 'defaults' && v && typeof v === 'object' && !Array.isArray(v)) {
                return kk + '{\n' + Object.keys(v).map(s => '    ' + q(s) + ': ' + one(v[s])).join(',\n') + '\n  }';
            }
            if (key === 'services' && v && typeof v === 'object' && !Array.isArray(v)) {
                return kk + '{\n' + Object.keys(v).map(s => {
                    const list = v[s] || [];
                    if (!list.length) return '    ' + q(s) + ': []';
                    return '    ' + q(s) + ': [\n' + list.map(t => fmtTrain(t, 6)).join(',\n') + '\n    ]';
                }).join(',\n') + '\n  }';
            }
            if (key === 'historiques') return kk + one(v);
            return kk + fmt(v, len(kk), 2);
        });
        return '{\n' + parts.join(',\n') + '\n}';
    }

    function build(file, data) {
        return file.prefix + format(data) + file.suffix;
    }

    /* ---- clés ordonnées ------------------------------------------------- */

    /* Pose obj[k] = v ; une clé nouvelle prend sa place dans `order`. */
    function put(obj, k, v, order) {
        if (k in obj) { obj[k] = v; return; }
        order = order || ORDER;
        const rank = x => { const i = order.indexOf(x); return i < 0 ? order.length : i; };
        const keys = Object.keys(obj);
        let at = keys.findIndex(x => rank(x) > rank(k));
        if (at < 0) { obj[k] = v; return; }
        const saved = keys.map(x => [x, obj[x]]);
        keys.forEach(x => delete obj[x]);
        saved.splice(at, 0, [k, v]);
        saved.forEach(([x, y]) => { obj[x] = y; });
    }

    function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
    function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

    /* ---- syntaxe des compositions -------------------------------------- *
       Un élément de composition devient :
         { kind: 'single' | 'choice' | 'shuffle', count: '' | '2' | '2-4',
           members: [{ l, r }] }      l / r : image vers la gauche / la droite
         { kind: 'coupler', coupler, overlap, bottom }
         { kind: 'raw', text }        ce que l'éditeur ne sait pas découper   */

    function parseMember(tok) {
        tok = tok.trim();
        if (!tok || tok.indexOf('|') >= 0 || tok.indexOf(',') >= 0 || /[{}*]/.test(tok)) return null;
        const p = tok.split('>');
        if (p.length > 2) return null;
        return { l: p[0].trim(), r: p.length === 2 ? p[1].trim() : '' };
    }

    function parseItem(raw) {
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            if (raw.coupler) return { kind: 'coupler', coupler: raw.coupler, overlap: raw.overlap, bottom: raw.bottom, extra: raw };
            return { kind: 'raw', text: JSON.stringify(raw), json: true };
        }
        if (typeof raw !== 'string') return { kind: 'raw', text: JSON.stringify(raw), json: true };
        const fail = { kind: 'raw', text: raw };
        let s = raw.trim(), count = '';
        const m = /^(\d+(?:-\d+)?)\*(.*)$/.exec(s);
        if (m) { count = m[1]; s = m[2].trim(); }
        let kind = 'single', toks = [s];
        if (s.indexOf('SHUFFLE{') === 0 && s.charAt(s.length - 1) === '}') {
            kind = 'shuffle';
            toks = s.slice(8, -1).split(',');
        } else if (s.indexOf('|') >= 0) {
            kind = 'choice';
            toks = s.split('|');
        }
        const members = toks.map(parseMember);
        if (!members.length || members.some(x => !x)) return fail;
        const it = { kind: kind, count: count, members: members };
        return compose(it) === raw ? it : fail;   // forme non canonique : texte brut
    }

    function memberText(mb) { return mb.r ? mb.l + '>' + mb.r : mb.l; }

    function compose(it) {
        if (it.kind === 'raw') {
            if (it.json) { try { return JSON.parse(it.text); } catch (e) { return it.text; } }
            return it.text;
        }
        if (it.kind === 'coupler') {
            const o = Object.assign({}, it.extra || {});
            o.coupler = it.coupler;
            if (typeof it.overlap === 'number') o.overlap = it.overlap; else delete o.overlap;
            if (typeof it.bottom === 'number') o.bottom = it.bottom; else delete o.bottom;
            return o;
        }
        const body = it.members.map(memberText);
        const content = it.kind === 'shuffle' ? 'SHUFFLE{' + body.join(', ') + '}'
            : it.kind === 'choice' ? body.join('|') : body[0];
        const c = String(it.count || '');
        return (c ? c + '*' : '') + content;
    }

    /* Images citées par une valeur (chaîne de composition ou objet entier). */
    const IMG_REF = /[^\s,{}|>*\/"]+\/[^\s,{}|>*\/"]+\.png/gi;
    function imageRefs(v, out) {
        out = out || new Set();
        if (typeof v === 'string') (v.match(IMG_REF) || []).forEach(r => out.add(r));
        else if (v && typeof v === 'object') {
            Object.keys(v).forEach(k => { if (k !== 'coupler' && k !== 'image') imageRefs(v[k], out); });
        }
        return out;
    }

    /* Texte court d'un train, pour la liste. */
    function title(t) {
        if (!t) return '';
        if (t.name) return t.name;
        const r = Array.isArray(t.route) ? t.route : [];
        if (r.length > 1) return r[0] + ' → ' + r[r.length - 1];
        if (r.length === 1) return r[0];
        if (t.detail) return t.detail;
        const first = (t.composition || []).find(x => typeof x === 'string');
        if (first) {
            const it = parseItem(first);
            const ref = it.members ? it.members[0].l : first;
            return ref.split('/').pop().replace(/\.png$/i, '');
        }
        return '(sans composition)';
    }

    window.LvCirc = {
        PATH: PATH,
        ORDER: ORDER,
        STOP_ORDER: STOP_ORDER,
        BG_ORDER: BG_ORDER,
        STATION_ORDER: STATION_ORDER,
        COUNTRIES: COUNTRIES,
        EPOQUES: EPOQUES,
        split: split,
        format: format,
        build: build,
        put: put,
        clone: clone,
        same: same,
        parseItem: parseItem,
        compose: compose,
        memberText: memberText,
        imageRefs: imageRefs,
        title: title
    };
})();
