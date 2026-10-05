/* =========================================================================
   ui-compos.js — Éditeur des compositions (mltc/data/circulations.js).

   Repris du constructeur de rames de MathLooTraffic, mais branché
   directement sur le fichier du site : on choisit un train dans la liste,
   on le modifie avec des champs et des vignettes, et l'enregistrement
   réécrit le fichier après une relecture du diff.

   Variantes : quand une variante est sélectionnée, les champs montrent le
   train tel qu'il circule dans cette variante (base + remplacements).
   Chaque champ modifié n'est écrit que dans la variante ; une valeur
   identique à la base retire le remplacement.
   ========================================================================= */
(function () {
    'use strict';

    const K = window.LvKit, el = K.el;
    const Fs = window.LvFs, C = window.LvCirc, D = window.LvDiff, Compo = window.MltcCompo;
    const $ = id => document.getElementById(id);

    const PX_PER_M = 10;                 // échelle du moteur Trafic (js/rames.js)
    const IMG = 'livrees_img/';          // préfixe de l'index d'images de LvFs
    const TITLE = 'Admin Compositions — MLTC';

    const S = {
        file: null,          // { prefix, data, suffix }
        text: '',            // fichier tel que lu sur le disque
        roundtrip: true,     // relu puis réécrit à l'identique ?
        origin: new WeakMap(),
        sel: null,           // { service, train }
        variant: 0,          // 0 = base, n = n-ième variante
        panel: null,         // 'services' ou null
        dir: 'L',            // sens de l'aperçu
        query: '',
        folded: new Set(),
        open: new Set(), closed: new Set(),
        lastFolder: null,
        assets: [],          // png de mltc/assets (attelages)
        tracks: [],          // png de mltc/assets/voies
        decors: [],          // png de mltc/assets/decors (caténaires, 3e rail)
        fgs: [],             // 'premiers-plans/x.png' (mltc/assets/premiers-plans)
        quais: [],           // png de mltc/assets/quais
        gares: [],           // png de mltc/assets/gares
        assetsLoaded: false,
        railList: null,
        titleEl: null,
        preview: null,
        pvToken: 0
    };

    /* ---------------------------------------------------------------------
       Images (lues sur le disque, servies en blob:)
       --------------------------------------------------------------------- */
    const urls = new Map(), imgs = new Map();

    function fileURL(path) {
        if (!urls.has(path)) {
            urls.set(path, Fs.fileHandle(path).then(h => h.getFile())
                .then(f => URL.createObjectURL(f)).catch(() => null));
        }
        return urls.get(path);
    }

    function loadImage(path) {
        if (!imgs.has(path)) {
            imgs.set(path, fileURL(path).then(u => u && new Promise(res => {
                const im = new Image();
                im.onload = () => res(im);
                im.onerror = () => res(null);
                im.src = u;
            })));
        }
        return imgs.get(path);
    }

    /* Vignette d'un véhicule ('dossier/fichier.png'). */
    function thumb(ref) {
        const im = el('img', { alt: '' });
        fileURL(Compo.LIVREES + ref).then(u => { if (u) im.src = u; else im.classList.add('missing'); });
        return im;
    }

    function hasRef(ref) { return !Fs.images() || Fs.hasImage(IMG + ref); }
    function companion(ref) {
        const r = Fs.companionR(IMG + ref);
        return r ? r.slice(IMG.length) : '';
    }
    function shortName(ref) { return String(ref || '').split('/').pop().replace(/\.png$/i, ''); }

    /* ---------------------------------------------------------------------
       Connexion et chargement
       --------------------------------------------------------------------- */
    async function boot() {
        if (!Fs.isSupported()) {
            $('welcome').innerHTML = '<p class="err"><strong>Navigateur non compatible.</strong></p>'
                + '<p class="dim">Cet outil utilise la File System Access API : ouvrez-le dans Chrome ou Edge.</p>';
            $('btn-connect').disabled = true;
            return;
        }
        wire();
        try {
            const name = await Fs.restore();
            if (name) await afterConnect(name);
        } catch (e) { /* pas de dossier mémorisé */ }
    }

    function wire() {
        $('btn-connect').onclick = async () => {
            try { await afterConnect(await Fs.connect()); }
            catch (err) {
                if (err && err.name === 'AbortError') return;
                K.toast('Connexion impossible : ' + err.message, 'bad');
            }
        };
        $('btn-save').onclick = save;
        $('btn-revert').onclick = revert;
        $('btn-check').onclick = showCheck;
        $('btn-assets').onclick = () => {
            S.panel = 'assets';
            S.sel = null;
            drawRailList();
            renderEditor(true);
        };
        $('btn-services').onclick = () => {
            S.panel = 'services';
            S.sel = null;
            drawRailList();
            renderEditor(true);
        };
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
        });
        window.addEventListener('beforeunload', e => {
            if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
        });
    }

    async function afterConnect(name) {
        $('dot').classList.add('on');
        $('dot').title = 'Connecté';
        $('rootname').textContent = name;
        $('btn-connect').textContent = 'Changer de dossier';
        ['btn-check', 'btn-services'].forEach(i => { $(i).disabled = false; });

        K.toast('Indexation des images…');
        try { await Fs.indexImages(); } catch (e) { K.toast('Index des images : ' + e.message, 'bad'); }
        await loadAssetLists();
        $('btn-assets').disabled = false;
        await load();
    }

    async function listPng(dir) {
        try { return await Fs.listDir(dir, '.png'); } catch (e) { return []; }
    }

    async function loadAssetLists() {
        S.assets = await listPng('mltc/assets');
        S.tracks = await listPng('mltc/assets/voies');
        S.decors = await listPng('mltc/assets/decors');
        S.fgs = (await listPng('mltc/assets/premiers-plans')).map(n => 'premiers-plans/' + n);
        S.quais = await listPng('mltc/assets/quais');
        S.gares = await listPng('mltc/assets/gares');
        S.assetsLoaded = true;
    }

    async function load(keep) {
        let text;
        try {
            text = await Fs.readText(C.PATH);
            S.file = C.split(text);
        } catch (err) {
            S.file = null;
            K.clear($('editor'));
            $('editor').appendChild(el('div.empty', {}, [
                el('p.err', { text: 'Lecture de ' + C.PATH + ' impossible : ' + err.message }),
                el('p.dim', { text: 'Le fichier doit rester du JSON strict après « window.MLTC_CIRCULATIONS = ».' })
            ]));
            return;
        }
        S.text = text;
        S.roundtrip = C.build(S.file, S.file.data) === text;
        snapshot();
        S.sel = null;
        S.variant = 0;
        if (keep) {
            const t = (services()[keep.service] || [])[keep.index];
            if (t) S.sel = { service: keep.service, train: t };
        }
        drawRail();
        renderEditor(true);
        refreshChrome();
        if (!S.roundtrip) {
            K.toast('Mise en forme inhabituelle : le premier enregistrement remettra tout le fichier en forme (voir Contrôle).', 'bad');
        }
    }

    function snapshot() {
        S.origin = new WeakMap();
        Compo.trains(S.file.data).forEach(e => S.origin.set(e.train, JSON.stringify(e.train)));
    }

    function services() {
        const d = S.file.data;
        if (!d.services || typeof d.services !== 'object') C.put(d, 'services', {}, ['_aide', 'historiques', 'defaults', 'services']);
        return d.services;
    }

    function isDirty() { return !!S.file && C.build(S.file, S.file.data) !== S.text; }

    function refreshChrome() {
        const d = isDirty();
        $('btn-save').disabled = !d;
        $('btn-revert').disabled = !d;
        document.title = (d ? '• ' : '') + TITLE;
    }

    /* ---------------------------------------------------------------------
       Contrôles d'un train
       --------------------------------------------------------------------- */
    function issuesOf(t) {
        const errors = [], warns = [];
        if (!Array.isArray(t.composition) || !t.composition.length) {
            errors.push('Composition vide : ce train ne circule nulle part.');
        }
        C.imageRefs(t).forEach(ref => { if (!hasRef(ref)) errors.push('Image introuvable : ' + ref); });
        (function walk(v) {
            if (Array.isArray(v)) { v.forEach(walk); return; }
            if (!v || typeof v !== 'object') return;
            if (typeof v.coupler === 'string' && S.assets.length && S.assets.indexOf(v.coupler) < 0) {
                errors.push('Attelage introuvable dans mltc/assets : ' + v.coupler);
            }
            Object.keys(v).forEach(k => walk(v[k]));
        })(t);
        [t].concat(Array.isArray(t.variants) ? t.variants : []).forEach(c => {
            const bg = c && c.background;
            if (bg && typeof bg === 'object' && (!Array.isArray(bg.composition) || !bg.composition.length)) {
                warns.push('Train d’arrière-plan sans composition : il ne s’affichera pas.');
            }
            const fg = c && c.foreground;
            if (fg && typeof fg === 'object' && !fg.image) errors.push('Premier plan sans image.');
            if (!fg || typeof fg !== 'object' || !fg.image) return;
            const ok = fg.is_vehicle ? hasRef(fg.image) : (!S.assets.length || S.assets.indexOf(fg.image) >= 0);
            if (!ok) errors.push('Image de premier plan introuvable : ' + fg.image);
        });
        (Array.isArray(t.countries) ? t.countries : []).forEach(c => {
            if (C.COUNTRIES.indexOf(c) < 0) warns.push('Pays inconnu de la carte : ' + c);
        });
        if (S.assetsLoaded) {
            [t].concat(Array.isArray(t.variants) ? t.variants : []).forEach(c => {
                if (!c) return;
                if (typeof c.decor === 'string' && c.decor && S.decors.indexOf(c.decor) < 0) {
                    errors.push('Décor introuvable dans mltc/assets/decors : ' + c.decor);
                }
                if (typeof c.track === 'string' && c.track && S.tracks.indexOf(c.track) < 0) {
                    errors.push('Voie introuvable dans mltc/assets/voies : ' + c.track);
                }
                const st = c.station;
                if (st && typeof st === 'object') {
                    const pf = st.platform || 'quai.png';
                    if (S.quais.indexOf(pf) < 0) errors.push('Quai introuvable dans mltc/assets/quais : ' + pf);
                    if (st.building && S.gares.indexOf(st.building) < 0) errors.push('Bâtiment introuvable dans mltc/assets/gares : ' + st.building);
                }
            });
        }
        return { errors: errors, warns: warns };
    }

    /* ---------------------------------------------------------------------
       Colonne de gauche
       --------------------------------------------------------------------- */
    function drawRail() {
        const rail = $('rail');
        K.clear(rail);
        const search = el('input', {
            type: 'text',
            placeholder: 'Chercher : nom, gare, image…',
            value: S.query,
            oninput: () => { S.query = search.value.trim().toLowerCase(); drawRailList(); }
        });
        rail.appendChild(el('div.cp-search', {}, [search]));
        S.railList = el('div');
        rail.appendChild(S.railList);
        drawRailList();
    }

    function matches(service, t) {
        if (!S.query) return true;
        return (service + ' ' + JSON.stringify(t)).toLowerCase().indexOf(S.query) >= 0;
    }

    function drawRailList() {
        const box = S.railList;
        if (!box || !S.file) return;
        const rail = $('rail'), top = rail.scrollTop;
        K.clear(box);
        const svc = services();
        const hist = Array.isArray(S.file.data.historiques) ? S.file.data.historiques : [];
        Object.keys(svc).forEach(service => {
            if (service.charAt(0) === '_') return;
            const list = Array.isArray(svc[service]) ? svc[service] : [];
            const shown = list.filter(t => matches(service, t));
            if (S.query && !shown.length) return;
            const folded = S.folded.has(service) && !S.query;
            box.appendChild(el('div.cp-svc', {}, [
                el('button.cp-fold', {
                    text: (folded ? '▸ ' : '▾ ') + service,
                    title: folded ? 'Déplier' : 'Replier',
                    onclick: () => { if (folded) S.folded.delete(service); else S.folded.add(service); drawRailList(); }
                }),
                hist.indexOf(service) >= 0 ? el('span.badge', { text: 'hist.' , title: 'Service historique' }) : null,
                el('span.cp-n', { text: String(list.length) }),
                el('button.btn.icon', { text: '+', title: 'Nouveau train ' + service, onclick: () => addTrain(service) })
            ]));
            if (folded) return;
            shown.forEach(t => box.appendChild(railItem(service, t)));
            if (!list.length) box.appendChild(el('div.cp-none', { text: 'Aucun train' }));
        });
        rail.scrollTop = top;
    }

    function railItem(service, t) {
        const iss = issuesOf(t);
        const active = S.sel && S.sel.train === t;
        const mod = !S.origin.has(t) || S.origin.get(t) !== JSON.stringify(t);
        const sub = [];
        sub.push(Array.isArray(t.countries) && t.countries.length ? t.countries.join(', ') : 'Trafic seulement');
        const nv = Array.isArray(t.variants) ? t.variants.length : 0;
        if (nv) sub.push(nv + (nv > 1 ? ' variantes' : ' variante'));
        return el('button.pageitem' + (active ? '.active' : '') + (mod ? '.mod' : ''), {
            onclick: () => select(service, t)
        }, [
            el('div.nm', {}, [
                el('span.flag'),
                el('span.cp-t', { text: C.title(t) }),
                iss.errors.length ? K.badge('error', String(iss.errors.length)) : null
            ]),
            el('div.sub', { text: sub.join(' · ') })
        ]);
    }

    function select(service, t) {
        S.sel = { service: service, train: t };
        S.variant = 0;
        S.panel = null;
        drawRailList();
        renderEditor(true);
    }

    /* ---------------------------------------------------------------------
       Modifications
       --------------------------------------------------------------------- */
    function curVariant() {
        if (!S.sel || !S.variant) return null;
        const vs = S.sel.train.variants;
        return Array.isArray(vs) ? vs[S.variant - 1] || null : null;
    }

    /* Le train tel qu'il circule dans la version choisie. */
    function view() {
        const t = S.sel.train;
        const vv = curVariant();
        if (!vv) return t;
        const out = Object.assign({}, t);
        delete out.variants;
        Object.keys(vv).forEach(k => { if (vv[k] === null) delete out[k]; else out[k] = vv[k]; });
        return out;
    }

    /* Écrit une clé ; undefined la retire. */
    function set(k, val) {
        const t = S.sel.train;
        const vv = curVariant();
        if (!vv) {
            if (val === undefined) delete t[k];
            else C.put(t, k, val);
            return;
        }
        const b = t[k];
        if (val === undefined) {
            if (b !== undefined) C.put(vv, k, null);
            else delete vv[k];
        } else if (b !== undefined && C.same(val, b)) {
            delete vv[k];
        } else {
            C.put(vv, k, val);
        }
    }

    function changed(redraw) {
        refreshChrome();
        drawRailList();
        if (redraw) { renderEditor(); return; }
        if (S.titleEl) S.titleEl.textContent = C.title(view());
        drawIssues();
        if (S.vkeysEl && curVariant()) S.vkeysEl.textContent = vkeysText(curVariant());
        if (S.jsonEl && document.activeElement !== S.jsonEl) S.jsonEl.value = JSON.stringify(S.sel.train, null, 2);
        schedulePreview();
    }

    function setc(k, val, redraw) { set(k, val); changed(redraw); }

    function overrides(k) {
        const vv = curVariant();
        return !!vv && Object.prototype.hasOwnProperty.call(vv, k);
    }

    function resetBtn(k) {
        return el('button.btn.sm', {
            text: '↺ base',
            title: 'Reprendre la valeur de la base pour cette variante',
            onclick: () => { delete curVariant()[k]; changed(true); }
        });
    }

    function addTrain(service) {
        const list = services()[service];
        const t = { composition: [] };
        list.push(t);
        S.folded.delete(service);
        select(service, t);
        changed(false);
        K.toast('Train ajouté : choisissez ses véhicules avec « + Véhicules ».');
    }

    function moveBy(d) {
        const list = services()[S.sel.service];
        const i = list.indexOf(S.sel.train), j = i + d;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        changed(true);
    }

    function moveToService(target) {
        const svc = services();
        if (target === S.sel.service || !svc[target]) return;
        const from = svc[S.sel.service];
        from.splice(from.indexOf(S.sel.train), 1);
        svc[target].push(S.sel.train);
        S.sel.service = target;
        S.folded.delete(target);
        changed(true);
    }

    function duplicate() {
        const list = services()[S.sel.service];
        const copy = C.clone(S.sel.train);
        list.splice(list.indexOf(S.sel.train) + 1, 0, copy);
        select(S.sel.service, copy);
        changed(false);
        K.toast('Copie créée juste en dessous.');
    }

    async function removeTrain() {
        const t = S.sel.train;
        if (!await K.confirm('Supprimer ce train ?',
            '<strong>' + esc(C.title(t)) + '</strong> (' + esc(S.sel.service) + ') sera retiré du fichier '
            + 'au prochain enregistrement.', 'Supprimer', true)) return;
        const list = services()[S.sel.service];
        list.splice(list.indexOf(t), 1);
        S.sel = null;
        changed(true);
    }

    function addVariant() {
        const t = S.sel.train;
        if (!Array.isArray(t.variants)) C.put(t, 'variants', []);
        t.variants.push({});
        S.variant = t.variants.length;
        changed(true);
    }

    async function removeVariant() {
        if (!await K.confirm('Supprimer la variante ' + S.variant + ' ?',
            'Ses remplacements seront perdus ; la base ne change pas.', 'Supprimer', true)) return;
        const t = S.sel.train;
        t.variants.splice(S.variant - 1, 1);
        if (!t.variants.length) delete t.variants;
        S.variant = 0;
        changed(true);
    }

    function esc(s) {
        return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    }

    /* ---------------------------------------------------------------------
       Petits contrôles
       --------------------------------------------------------------------- */
    function textInput(value, ph, cb) {
        const i = el('input', { type: 'text', value: value == null ? '' : String(value), placeholder: ph || '' });
        i.addEventListener('input', () => cb(i.value.trim()));
        return i;
    }

    function numInput(value, ph, cb, live) {
        const i = el('input.cp-num', { type: 'number', value: value == null ? '' : String(value), placeholder: ph || '' });
        i.addEventListener(live ? 'input' : 'change', () => {
            const s = i.value.trim();
            const n = s === '' ? undefined : Number(s);
            cb(n === undefined || isNaN(n) ? undefined : n);
        });
        return i;
    }

    /* Position : pixels (1600) ou pourcentage de l'écran ("40%"). */
    function atInput(value, ph, cb) {
        const i = el('input.cp-at', { type: 'text', value: value == null ? '' : String(value), placeholder: ph || '50%' });
        i.addEventListener('input', () => {
            const s = i.value.replace(/\s/g, '');
            let v;
            if (s === '') v = undefined;
            else if (/^\d+(\.\d+)?%$/.test(s)) v = s;
            else if (/^-?\d+$/.test(s)) v = parseInt(s, 10);
            else { i.classList.add('bad'); return; }
            i.classList.remove('bad');
            cb(v);
        });
        return i;
    }

    function selectInput(options, value, cb) {
        const s = el('select', {}, options.map(o => el('option', { value: o[0], text: o[1] })));
        s.value = value == null ? '' : value;
        s.addEventListener('change', () => cb(s.value));
        return s;
    }

    function checkInput(checked, label, cb) {
        const i = el('input', { type: 'checkbox', checked: !!checked });
        i.addEventListener('change', () => cb(i.checked));
        return el('label.check', {}, [i, label]);
    }

    /* Champ, avec repère « variante » si la clé y est remplacée. */
    function fld(key, label, control, hint) {
        const f = K.field(label, control, hint);
        if (key && overrides(key)) {
            const lab = f.querySelector('label');
            lab.classList.add('cp-over');
            lab.appendChild(el('button.cp-reset', {
                text: '↺ base',
                title: 'Reprendre la valeur de la base',
                onclick: e => { e.preventDefault(); delete curVariant()[key]; changed(true); }
            }));
        }
        return f;
    }

    function card(key, title, meta, body, opts) {
        opts = opts || {};
        const open = S.open.has(key) || (!S.closed.has(key) && !!opts.open);
        const c = el('div.card.cp-card' + (open ? '' : '.cp-closed'));
        c.appendChild(el('header', {
            onclick: e => {
                if (e.target.closest('button, input, select, label')) return;
                const closed = c.classList.toggle('cp-closed');
                (closed ? S.closed : S.open).add(key);
                (closed ? S.open : S.closed).delete(key);
            }
        }, [
            el('span.cp-caret'),
            el('span.title', { text: title }),
            el('span.meta', { text: meta || '' }),
            el('div.spacer')
        ].concat(opts.actions || [])));
        c.appendChild(el('div.body', {}, [body]));
        return c;
    }

    /* ---------------------------------------------------------------------
       Éditeur de composition (composition, attelage d'un arrêt, arrière-plan)
       --------------------------------------------------------------------- */
    function compoEditor(initial, onChange) {
        const list = Array.isArray(initial) ? C.clone(initial) : [];
        const box = el('div.cp-compo');

        function commit() { onChange(C.clone(list)); draw(); }

        function swap(i, j) {
            [list[i], list[j]] = [list[j], list[i]];
            commit();
        }

        async function addVehicles(at) {
            const picks = await pickVehicles({ multi: true, title: 'Ajouter des véhicules' });
            if (!picks || !picks.length) return;
            let pos = at;
            picks.forEach(mb => {
                const prev = pos > 0 ? C.parseItem(list[pos - 1]) : null;
                if (prev && prev.kind === 'single' && /^\d*$/.test(prev.count)
                    && C.memberText(prev.members[0]) === C.memberText(mb)) {
                    prev.count = String((parseInt(prev.count, 10) || 1) + 1);
                    list[pos - 1] = C.compose(prev);
                } else {
                    list.splice(pos, 0, C.compose({ kind: 'single', count: '', members: [mb] }));
                    pos++;
                }
            });
            commit();
        }

        async function addGroup(kind) {
            const picks = await pickVehicles({
                multi: true,
                title: kind === 'shuffle' ? 'Lot mélangé : choisissez ses véhicules' : 'Au choix : choisissez les images possibles'
            });
            if (!picks || !picks.length) return;
            list.push(C.compose({ kind: kind, count: '', members: picks }));
            commit();
        }

        function imageRow(it, upd) {
            const count = el('input.cp-count', {
                type: 'text', value: it.count, placeholder: '1',
                title: 'Nombre : 3, ou 2-4 pour un nombre tiré au sort'
            });
            count.addEventListener('change', () => {
                let c = count.value.replace(/\s/g, '');
                if (c && !/^\d+(-\d+)?$/.test(c)) {
                    K.toast('Nombre : un entier (3) ou une plage (2-4).', 'bad');
                    count.value = it.count;
                    return;
                }
                const m = /^(\d+)-(\d+)$/.exec(c);
                if (m && +m[1] > +m[2]) c = m[2] + '-' + m[1];
                if (m && m[1] === m[2]) c = m[1];
                it.count = c === '1' ? '' : c;
                upd();
            });
            const kind = selectInput([
                ['single', 'Véhicule'],
                ['choice', 'Au choix (A|B)'],
                ['shuffle', 'Mélange (SHUFFLE)']
            ], it.kind, v => {
                it.kind = v;
                if (v === 'single') it.members = it.members.slice(0, 1);
                upd();
            });
            kind.classList.add('cp-kind');
            const members = el('div.cp-members', {}, it.members.map((mb, j) => memberChip(mb, {
                replace: async () => {
                    const r = await pickVehicles({ title: 'Remplacer ' + shortName(mb.l) });
                    if (r && r[0]) { it.members[j] = r[0]; upd(); }
                },
                swap: () => { const l = mb.l; mb.l = mb.r; mb.r = l; upd(); },
                remove: it.members.length > 1 ? () => { it.members.splice(j, 1); upd(); } : null
            })));
            if (it.kind !== 'single') {
                members.appendChild(el('button.btn.sm', {
                    text: '+ image',
                    onclick: async () => {
                        const r = await pickVehicles({ multi: true, title: 'Ajouter au groupe' });
                        if (r && r.length) { it.members.push.apply(it.members, r); upd(); }
                    }
                }));
            }
            return el('div.cp-main', {}, [count, el('span.cp-x', { text: '×' }), kind, members]);
        }

        function couplerRow(it, upd) {
            const opts = S.assets.filter(a => /couple/i.test(a));
            if (it.coupler && opts.indexOf(it.coupler) < 0) opts.unshift(it.coupler);
            const sel = selectInput(opts.map(a => [a, a]), it.coupler, v => { it.coupler = v; upd(); });
            const im = el('img.cp-coupler', { alt: '' });
            fileURL(Compo.ASSETS + it.coupler).then(u => { if (u) im.src = u; });
            return el('div.cp-main', {}, [
                el('span.cp-tag', { text: 'Attelage' }), im, sel,
                el('label.cp-inline', { title: 'Pixels recouverts de chaque côté (défaut 3)' }, ['recouvrement ',
                    numInput(it.overlap, '3', v => { it.overlap = v; upd(); })]),
                el('label.cp-inline', { title: 'Hauteur au-dessus du rail, en pixels (défaut 7)' }, ['hauteur ',
                    numInput(it.bottom, '7', v => { it.bottom = v; upd(); })])
            ]);
        }

        function rawRow(it, i) {
            const inp = el('input.cp-raw', { type: 'text', value: it.text });
            inp.addEventListener('change', () => {
                it.text = inp.value;
                list[i] = C.compose(it);
                commit();
            });
            return el('div.cp-main', {}, [
                el('span.cp-tag', { text: 'Texte', title: 'Élément écrit à la main, que l’éditeur ne sait pas découper. Syntaxe : clé _aide du fichier.' }),
                inp
            ]);
        }

        function row(i) {
            const it = C.parseItem(list[i]);
            const upd = () => { list[i] = C.compose(it); commit(); };
            let main;
            if (it.kind === 'coupler') main = couplerRow(it, upd);
            else if (it.kind === 'raw') main = rawRow(it, i);
            else main = imageRow(it, upd);
            return el('div.cp-row.cp-k-' + it.kind, {}, [
                el('div.cp-ctl', {}, [
                    el('span.cp-idx', { text: String(i + 1) }),
                    el('button.btn.icon', { text: '↑', title: 'Vers la tête', disabled: i === 0, onclick: () => swap(i, i - 1) }),
                    el('button.btn.icon', { text: '↓', title: 'Vers la queue', disabled: i === list.length - 1, onclick: () => swap(i, i + 1) })
                ]),
                main,
                el('div.cp-ctl', {}, [
                    el('button.btn.icon', { text: '+', title: 'Insérer des véhicules juste après', onclick: () => addVehicles(i + 1) }),
                    el('button.btn.icon', { text: '⧉', title: 'Dupliquer cette ligne', onclick: () => { list.splice(i + 1, 0, C.clone(list[i])); commit(); } }),
                    el('button.btn.icon.danger', { text: '✕', title: 'Retirer', onclick: () => { list.splice(i, 1); commit(); } })
                ])
            ]);
        }

        function draw() {
            K.clear(box);
            if (!list.length) box.appendChild(el('div.cp-none', { text: 'Aucun véhicule.' }));
            list.forEach((x, i) => box.appendChild(row(i)));
            box.appendChild(el('div.cp-addbar', {}, [
                el('button.btn.sm.primary', { text: '+ Véhicules', title: 'Un ou plusieurs véhicules, dans l’ordre (tête en premier)', onclick: () => addVehicles(list.length) }),
                el('button.btn.sm', { text: '+ Au choix', title: 'Une image tirée au sort parmi plusieurs (A|B)', onclick: () => addGroup('choice') }),
                el('button.btn.sm', { text: '+ Mélange', title: 'Lot mélangé : SHUFFLE{A, B, C}', onclick: () => addGroup('shuffle') }),
                el('button.btn.sm', {
                    text: '+ Attelage',
                    title: 'Attelage entre deux rames (image de mltc/assets)',
                    onclick: () => {
                        const c = S.assets.filter(a => /couple/i.test(a));
                        list.push({ coupler: c.indexOf('TGVcouple.png') >= 0 ? 'TGVcouple.png' : (c[0] || 'TGVcouple.png') });
                        commit();
                    }
                })
            ]));
        }

        draw();
        return box;
    }

    function memberChip(mb, acts) {
        const missing = !hasRef(mb.l) || (mb.r && !hasRef(mb.r));
        return el('div.cp-mb' + (missing ? '.missing' : ''), { title: C.memberText(mb) }, [
            el('button.cp-thumb', { title: 'Remplacer l’image', onclick: acts.replace }, [thumb(mb.l)]),
            el('div.cp-mtext', {}, [
                el('div.cp-mname', { text: shortName(mb.l) }),
                mb.r ? el('div.cp-msub', { text: '↔ ' + shortName(mb.r), title: 'Image quand le train roule vers la droite' }) : null
            ]),
            mb.r && acts.swap ? el('button.btn.icon', {
                text: '⇄',
                title: 'Échanger les deux sens (véhicule tourné vers l’arrière, en queue de rame)',
                onclick: acts.swap
            }) : null,
            acts.remove ? el('button.btn.icon', { text: '✕', title: 'Retirer du groupe', onclick: acts.remove }) : null
        ]);
    }

    /* ---------------------------------------------------------------------
       Sélecteur de véhicules (images de livrees_img)
       multi : chaque clic ajoute au panier, dans l'ordre.
       Résultat : [{ l, r }] (r = compagnon _R s'il existe) ou null.
       --------------------------------------------------------------------- */
    function pickVehicles(opts) {
        opts = opts || {};
        return new Promise(resolve => {
            const index = Fs.images();
            if (!index) { K.toast('Index des images absent : reconnectez le dossier.', 'bad'); return resolve(null); }
            let done = false;
            let folder = S.lastFolder && index.has(S.lastFolder) ? S.lastFolder : index.keys().next().value;
            const basket = [];

            const folders = el('div.folders');
            const grid = el('div.grid');
            const search = el('input', { type: 'text', placeholder: 'Chercher dans tous les dossiers…' });
            const info = el('div.dim', { style: 'font-size:11.5px;white-space:nowrap' });
            const basketEl = el('div.cp-basket');
            const okBtn = el('button.btn.primary', { text: 'Ajouter', disabled: true, onclick: () => finish(basket.slice()) });

            const io = new IntersectionObserver(entries => {
                for (const e of entries) {
                    if (!e.isIntersecting) continue;
                    io.unobserve(e.target);
                    Fs.imageURL(e.target.dataset.rel).then(u => { if (u) e.target.src = u; });
                }
            }, { root: grid, rootMargin: '160px' });

            /* Les _R sont repris automatiquement : on ne montre que leur base. */
            const visible = files => files.filter(f => !/_R\.png$/i.test(f.name)
                || !Fs.hasImage(f.rel.replace(/_R\.png$/i, '.png')));

            function drawFolders() {
                K.clear(folders);
                for (const [name, files] of index) {
                    folders.appendChild(el('button' + (name === folder && !search.value.trim() ? '.active' : ''), {
                        onclick: () => { folder = name; search.value = ''; drawFolders(); drawGrid(); }
                    }, [name + ' ', el('span.n', { text: visible(files).length })]));
                }
            }

            function drawGrid() {
                K.clear(grid);
                grid.scrollTop = 0;
                const q = search.value.trim().toLowerCase();
                let files = [];
                if (q) { for (const [, fl] of index) visible(fl).forEach(f => { if (f.rel.toLowerCase().indexOf(q) >= 0) files.push(f); }); }
                else files = visible(index.get(folder) || []);
                info.textContent = files.length + ' image(s)' + (q ? ', tous dossiers' : ' · ' + folder);
                if (!files.length) { grid.appendChild(el('div.empty', { text: 'Aucune image' })); return; }
                const frag = document.createDocumentFragment();
                for (const f of files) {
                    const ref = f.rel.slice(IMG.length);
                    const r = companion(ref);
                    const img = el('img', { alt: '', dataset: { rel: f.rel } });
                    frag.appendChild(el('div.item', { title: ref, onclick: () => pick({ l: ref, r: r }) }, [
                        el('div.fr', {}, [img]),
                        el('div.nm', { text: q ? ref : f.name }),
                        el('div.tags', {}, [r ? K.badge('info', '↔ R') : null])
                    ]));
                    io.observe(img);
                }
                grid.appendChild(frag);
            }

            function pick(mb) {
                if (!opts.multi) { finish([mb]); return; }
                basket.push(mb);
                drawBasket();
            }

            function drawBasket() {
                K.clear(basketEl);
                if (!basket.length) {
                    basketEl.appendChild(el('span.dim', { text: 'Cliquez les images dans l’ordre de la rame, tête en premier. Un clic sur une vignette ici la retire.' }));
                }
                basket.forEach((mb, i) => basketEl.appendChild(el('button.cp-bitem', {
                    title: shortName(mb.l) + ' (retirer)',
                    onclick: () => { basket.splice(i, 1); drawBasket(); }
                }, [thumb(mb.l)])));
                basketEl.scrollLeft = basketEl.scrollWidth;
                okBtn.disabled = !basket.length;
                okBtn.textContent = basket.length ? 'Ajouter (' + basket.length + ')' : 'Ajouter';
            }

            function finish(val) {
                done = true;
                io.disconnect();
                S.lastFolder = folder;
                m.close();
                resolve(val);
            }

            search.addEventListener('input', () => { drawFolders(); drawGrid(); });

            const m = K.modal({
                title: opts.title || 'Choisir un véhicule',
                width: '1180px',
                onclose: () => { if (!done) { io.disconnect(); S.lastFolder = folder; resolve(null); } },
                body: el('div', {}, [
                    el('div.row', { style: 'margin-bottom:10px;align-items:center' }, [el('div.grow', {}, [search]), info]),
                    el('div.pick', {}, [folders, grid])
                ]),
                footer: opts.multi
                    ? [basketEl, okBtn]
                    : [el('div.dim', { style: 'font-size:12px', text: 'Clic : choisir. ↔ R : image miroir détectée, utilisée quand le train roule vers la droite.' }), el('div.spacer')]
            });

            drawFolders();
            drawGrid();
            if (opts.multi) drawBasket();
            search.focus();
        });
    }

    /* ---------------------------------------------------------------------
       Aperçu : la rame dessinée comme sur la page Trafic
       --------------------------------------------------------------------- */
    /* Décor de l'aperçu, comme sur la page Trafic : voie, caténaire ou
       troisième rail (bas calé sur le bas de la voie), ou fil automatique. */
    async function sceneOf(cfg) {
        const track = await loadImage('mltc/assets/voies/' + (cfg.track || 'voie_bois.png'));
        const ds = Compo.decorSrc(cfg);
        const st = Compo.station(cfg);
        return {
            track: track,
            decor: ds ? await loadImage(ds) : null,
            onTrack: Compo.decorOnTrack(S.file.data, cfg.decor),
            wire: cfg.decor === undefined,
            station: st ? {
                platform: await loadImage(st.platform),
                building: st.building ? await loadImage(st.building) : null,
                length: st.length,
                buildingX: st.buildingX
            } : null
        };
    }

    function tileH(ctx, im, y, W) {
        for (let x = 0; x < W; x += im.width) ctx.drawImage(im, x, y);
    }

    function stationWidth(st) {
        if (!st) return 0;
        return st.platform ? st.platform.width * st.length : (st.building ? st.building.width : 0);
    }

    /* Hauteur du décor et de la gare au-dessus du haut de la voie. */
    function sceneRise(scene) {
        const trackH = scene.track ? scene.track.height : 8;
        let r = scene.decor ? scene.decor.height - trackH : 0;
        const st = scene.station;
        if (st) r = Math.max(r, (st.platform ? st.platform.height : 0) + (st.building ? st.building.height : 0));
        return r;
    }

    /* Plans du fond, dans l'ordre de js/rames.js (Track.draw) : bâtiment de
       gare, caténaire, quai (atténués), voie, troisième rail. La gare est
       centrée dans l'aperçu ; trackY = haut de la voie. */
    function drawBack(ctx, W, scene, trackY) {
        const trackH = scene.track ? scene.track.height : 8;
        const st = scene.station;
        const qw = stationWidth(st);
        const qx = Math.round((W - qw) / 2);
        ctx.globalAlpha = Compo.ALPHA.station;
        if (st && st.building) {
            const qh = st.platform ? st.platform.height : 0;
            ctx.drawImage(st.building, qx + Math.round((qw - st.building.width) / 2) + st.buildingX, trackY - qh - st.building.height);
        }
        ctx.globalAlpha = Compo.ALPHA.catenary;
        if (scene.decor && !scene.onTrack) tileH(ctx, scene.decor, trackY + trackH - scene.decor.height, W);
        ctx.globalAlpha = Compo.ALPHA.station;
        if (st && st.platform) {
            for (let i = 0; i < st.length; i++) ctx.drawImage(st.platform, qx + i * st.platform.width, trackY - st.platform.height);
        }
        ctx.globalAlpha = 1;
        if (scene.track) tileH(ctx, scene.track, trackY, W);
        if (scene.decor && scene.onTrack) tileH(ctx, scene.decor, trackY + trackH - scene.decor.height, W);
    }

    async function renderStrip(list, dir, scene) {
        scene = scene || {};
        const ims = await Promise.all(list.map(it => loadImage(it.src)));
        const vs = [], missing = [];
        list.forEach((it, i) => {
            if (ims[i]) vs.push({ img: ims[i], coupler: !!it.coupler, overlap: it.overlap || 0, bottom: it.bottom || 0 });
            else missing.push(it.src);
        });
        if (!vs.length) {
            return { node: el('div.cp-nostrip', { text: list.length ? 'Images introuvables.' : 'Composition vide.' }), width: 0, count: 0, missing: missing };
        }
        const vw = v => v.coupler ? v.img.width - 2 * v.overlap : v.img.width;
        const width = vs.reduce((s, v) => s + vw(v), 0);
        const trainH = vs.reduce((h, v) => Math.max(h, v.img.height + (v.coupler ? v.bottom : 0)), 0);
        const PAD = 30;
        const trackH = scene.track ? scene.track.height : 0;
        const height = Math.max(trainH + 6, sceneRise(scene)) + trackH;
        const ground = height - trackH;          // haut de la voie = sol des trains
        const cv = el('canvas.cp-cv');
        cv.width = Math.max(1, width + 2 * PAD, stationWidth(scene.station) + 2 * PAD);
        cv.height = height;
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        drawBack(ctx, cv.width, scene, ground);
        if (scene.wire && trainH === 58) {
            ctx.fillStyle = '#646464';
            ctx.fillRect(0, ground - 59, cv.width, 1);
        }
        const couplers = [];
        const left0 = Math.round((cv.width - width) / 2);
        let x = dir === 'R' ? left0 + width : left0;
        vs.forEach(v => {
            const w = vw(v);
            let left;
            if (dir === 'R') { x -= w; left = x; } else { left = x; x += w; }
            if (v.coupler) couplers.push([v, left - v.overlap]);
            else ctx.drawImage(v.img, left, ground - v.img.height);
        });
        couplers.forEach(([v, left]) => ctx.drawImage(v.img, left, ground - v.img.height - v.bottom));
        return { node: cv, width: width, count: vs.filter(v => !v.coupler).length, missing: missing };
    }

    let pvTimer = null;
    function schedulePreview(ms) {
        clearTimeout(pvTimer);
        pvTimer = setTimeout(drawPreview, ms == null ? 160 : ms);
    }

    function stopChanges(stop) {
        return !!(stop && (stop.loco_change || (stop.attach && stop.attach.length) || stop.detach_count));
    }

    async function drawPreview() {
        const P = S.preview;
        if (!P || !S.sel || !P.strip.isConnected) return;
        const token = ++S.pvToken;
        const cfg = Compo.scenario(S.file.data, S.sel.service, S.sel.train, S.variant);
        const opts = { direction: S.dir };
        const scene = await sceneOf(cfg);
        const list = Compo.resolve(cfg.composition || [], opts);
        const a = await renderStrip(list, S.dir, scene);
        const b = stopChanges(cfg.stop) ? await renderStrip(Compo.afterStop(list, cfg.stop, opts), S.dir, scene) : null;
        const bg = cfg.background && Array.isArray(cfg.background.composition) && cfg.background.composition.length
            ? await renderStrip(Compo.resolve(cfg.background.composition, opts), S.dir, scene) : null;
        if (token !== S.pvToken) return;

        const put = (box, r) => {
            K.clear(box);
            box.appendChild(r.node);
            box.scrollLeft = S.dir === 'R' ? box.scrollWidth : 0;
        };
        put(P.strip, a);
        P.afterWrap.hidden = !b;
        if (b) put(P.after, b);
        P.bgWrap.hidden = !bg;
        if (bg) put(P.bg, bg);
        const bits = [a.count + (a.count > 1 ? ' éléments' : ' élément'), '≈ ' + Math.round(a.width / PX_PER_M) + ' m'];
        if (a.missing.length) bits.push(a.missing.length + ' image(s) introuvable(s)');
        P.info.textContent = bits.join(' · ');
    }

    function previewCard() {
        const strip = el('div.cp-strip'), after = el('div.cp-strip'), bg = el('div.cp-strip.cp-ghost');
        const afterWrap = el('div', { hidden: true }, [el('div.cp-lbl', { text: 'Après l’arrêt' }), after]);
        const bgWrap = el('div', { hidden: true }, [el('div.cp-lbl', { text: 'Train d’arrière-plan' }), bg]);
        const info = el('span.dim.cp-pvinfo');
        S.preview = { strip: strip, after: after, afterWrap: afterWrap, bg: bg, bgWrap: bgWrap, info: info };
        const dirBtn = d => el('button.cp-tab' + (S.dir === d ? '.active' : ''), {
            text: d === 'L' ? '◀ Vers la gauche' : 'Vers la droite ▶',
            title: d === 'L' ? 'Sens montré par la carte Circulations' : 'Images _R, comme sur la page Trafic',
            onclick: e => {
                S.dir = d;
                e.target.parentNode.querySelectorAll('.cp-tab').forEach(b => b.classList.toggle('active', b === e.target));
                drawPreview();
            }
        });
        const body = el('div', {}, [
            el('div.cp-pvbar', {}, [
                el('div.cp-tabs', {}, [dirBtn('L'), dirBtn('R')]),
                el('button.btn.sm', { text: 'Nouveau tirage', title: 'Refait les tirages au sort (A|B, 2-4*, SHUFFLE)', onclick: () => drawPreview() }),
                info,
                el('div.spacer'),
                el('button.btn.sm.primary', { text: '▶ Tester en animation', onclick: testRun })
            ]),
            strip, afterWrap, bgWrap
        ]);
        schedulePreview(0);
        return card('preview', 'Aperçu', '', body, { open: true });
    }

    /* Le moteur de la page Trafic, dans un cadre, avec ce seul train. */
    function testRun() {
        const service = S.sel.service;
        const cfg = Compo.scenario(S.file.data, service, S.sel.train, S.variant);
        if (!Array.isArray(cfg.composition) || !cfg.composition.length) {
            K.toast('Composition vide : rien à faire circuler.', 'bad');
            return;
        }
        const svc = {};
        svc[service] = [cfg];
        const json = JSON.stringify({ historiques: [], defaults: {}, services: svc }).replace(/</g, '\\u003c');
        const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>'
            + 'html,body{margin:0;height:100%;background:#000;color:#fff;font:13px "Segoe UI",system-ui,sans-serif}'
            + '#trafic-stage{display:flex;flex-direction:column;height:100%}'
            + '.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 12px;background:#141020;border-bottom:1px solid #2b2342}'
            + 'button,select{background:#1c1630;color:#fff;border:1px solid #2b2342;border-radius:5px;padding:3px 10px;font:inherit;cursor:pointer}'
            + 'button:disabled{opacity:.4;cursor:default}output{min-width:1.5em;text-align:center}'
            + '#trafic-status{margin-left:auto;color:#9a92b4}#trafic-canvas{flex:1;width:100%;min-height:0;display:block}'
            + '</style></head><body><div id="trafic-stage" data-tracks="2"><div class="bar">'
            + '<button id="trafic-play">Pause</button>'
            + '<span>Voies</span><button id="trafic-tracks-minus">−</button><output id="trafic-tracks">2</output><button id="trafic-tracks-plus">+</button>'
            + '<select id="trafic-speed"><option value="0.5">×0,5</option><option value="1" selected>×1</option><option value="2">×2</option></select>'
            + '<button id="trafic-clear">Relancer</button><span id="trafic-status"></span></div>'
            + '<canvas id="trafic-canvas"></canvas></div>'
            + '<script>window.MLTC_CIRCULATIONS = ' + json + ';<\/script>'
            + '<script src="../js/compositions.js"><\/script><script src="../js/rames.js"><\/script>'
            + '</body></html>';
        const frame = el('iframe.cp-test', { title: 'Test en animation' });
        frame.srcdoc = html;
        K.modal({
            title: 'Test : ' + (C.title(cfg) || service) + (S.variant ? ' (variante ' + S.variant + ')' : ''),
            width: '1400px',
            body: el('div', {}, [
                frame,
                el('p.dim', { style: 'font-size:12px;margin:8px 0 0', text: 'Moteur de la page Trafic, avec ce seul train tel qu’il est dans l’éditeur (même non enregistré). Clic sur la scène : pause.' })
            ])
        });
    }

    /* ---------------------------------------------------------------------
       Éditeur d'un train
       --------------------------------------------------------------------- */
    function renderEditor(top) {
        const ed = $('editor');
        const y = ed.scrollTop;
        K.clear(ed);
        S.preview = null;
        S.titleEl = null;
        S.jsonEl = null;
        S.vkeysEl = null;
        S.issuesEl = null;
        if (!S.file) return;
        if (S.panel === 'services') ed.appendChild(servicesPanel());
        else if (S.panel === 'assets') ed.appendChild(assetsPanel());
        else if (S.sel) trainEditor(ed);
        else ed.appendChild(welcome());
        ed.scrollTop = top ? 0 : y;
    }

    function welcome() {
        const all = Compo.trains(S.file.data);
        const onMap = all.filter(e => Array.isArray(e.train.countries) && e.train.countries.length).length;
        const nv = all.reduce((n, e) => n + (Array.isArray(e.train.variants) ? e.train.variants.length : 0), 0);
        return el('div.empty', {}, [
            el('p', {}, [el('strong', { text: all.length + ' trains' }), ' dont ' + onMap + ' sur la carte, ' + nv + ' variantes.']),
            el('p.dim', { text: 'Choisissez un train à gauche, ou ajoutez-en un avec le + de son service.' }),
            S.roundtrip ? null : el('p.warn', { text: 'Le fichier n’a pas la mise en forme attendue : le premier enregistrement le remettra en forme en entier.' })
        ]);
    }

    function trainEditor(ed) {
        const train = S.sel.train;
        const variants = Array.isArray(train.variants) ? train.variants : [];
        if (S.variant > variants.length) S.variant = 0;
        const v = view();
        ed.appendChild(headerBlock(train));
        ed.appendChild(variantBar(variants));
        ed.appendChild(previewCard());
        ed.appendChild(mapCard(v));
        ed.appendChild(compoCard(v));
        ed.appendChild(runCard(v));
        ed.appendChild(stopCard(v));
        ed.appendChild(stationCard(v));
        ed.appendChild(stationaryCard(v));
        ed.appendChild(bgCard(v));
        ed.appendChild(fgCard(v));
        ed.appendChild(jsonCard(train));
    }

    function headerBlock(train) {
        const service = S.sel.service;
        const list = services()[service];
        const i = list.indexOf(train);
        S.issuesEl = el('ul.cp-issues');
        drawIssues();
        const svcSel = selectInput(Object.keys(services()).filter(s => s.charAt(0) !== '_').map(s => [s, s]), service, moveToService);
        const titleEl = el('h2.cp-title', { text: C.title(view()) });
        S.titleEl = titleEl;
        return el('div.cp-head', {}, [
            el('div.cp-head-row', {}, [
                titleEl,
                el('div.spacer'),
                el('label.cp-inline', { title: 'Déplacer le train dans un autre service' }, ['Service ', svcSel]),
                el('button.btn.sm', { text: '↑', title: 'Monter dans la liste', disabled: i <= 0, onclick: () => moveBy(-1) }),
                el('button.btn.sm', { text: '↓', title: 'Descendre dans la liste', disabled: i >= list.length - 1, onclick: () => moveBy(1) }),
                el('button.btn.sm', { text: 'Dupliquer', onclick: duplicate }),
                el('button.btn.sm.danger', { text: 'Supprimer', onclick: removeTrain })
            ]),
            S.issuesEl
        ]);
    }

    /* Problèmes du train affiché, recalculés à chaque modification. */
    function drawIssues() {
        if (!S.issuesEl || !S.sel) return;
        const iss = issuesOf(S.sel.train);
        K.clear(S.issuesEl);
        iss.errors.forEach(m => S.issuesEl.appendChild(el('li.err', { text: m })));
        iss.warns.forEach(m => S.issuesEl.appendChild(el('li.warn', { text: m })));
        S.issuesEl.hidden = !(iss.errors.length || iss.warns.length);
    }

    function variantBar(variants) {
        const tab = (i, label) => el('button.cp-tab' + (S.variant === i ? '.active' : ''), {
            text: label,
            onclick: () => { S.variant = i; renderEditor(); }
        });
        const tabs = el('div.cp-tabs', {}, [tab(0, 'Base')].concat(variants.map((x, i) => tab(i + 1, 'Variante ' + (i + 1)))));
        const bar = el('div.cp-vbar', {}, [
            tabs,
            el('button.btn.sm', {
                text: '+ Variante',
                title: 'Autre version du même train : la page Trafic tire au sort entre la base et ses variantes',
                onclick: addVariant
            }),
            el('div.spacer')
        ]);
        const vv = curVariant();
        S.vkeysEl = null;
        if (vv) {
            S.vkeysEl = el('span.dim.cp-vkeys', { text: vkeysText(vv) });
            bar.appendChild(S.vkeysEl);
            bar.appendChild(el('button.btn.sm.danger', { text: 'Supprimer la variante', onclick: removeVariant }));
        }
        return el('div.cp-vwrap' + (vv ? '.on' : ''), {}, [
            bar,
            vv ? el('div.cp-vhint', { text: 'Vous modifiez la variante ' + S.variant + ' : un champ changé ici ne vaut que pour elle (repère violet, ↺ pour revenir à la base). Sur la carte, elle n’apparaît que si elle a ses propres pays, avec sa rame d’après l’arrêt si celui-ci la change.' }) : null
        ]);
    }

    function vkeysText(vv) {
        const keys = Object.keys(vv);
        return keys.length ? 'Remplace : ' + keys.map(k => vv[k] === null ? k + ' (retiré)' : k).join(', ')
            : 'Identique à la base pour l’instant';
    }

    function mapCard(v) {
        const countries = Array.isArray(v.countries) ? v.countries : [];
        const box = el('div.cp-countries');
        C.COUNTRIES.concat(countries.filter(c => C.COUNTRIES.indexOf(c) < 0)).forEach(c => {
            box.appendChild(checkInput(countries.indexOf(c) >= 0, c, on => {
                let arr = (Array.isArray(view().countries) ? view().countries : []).slice();
                if (on) { if (arr.indexOf(c) < 0) arr.push(c); } else arr = arr.filter(x => x !== c);
                setc('countries', arr.length ? arr : undefined);
                meta.textContent = arr.length ? arr.join(', ') : 'page Trafic seulement';
            }));
        });
        const body = el('div', {}, [
            el('div.cp-grid2', {}, [
                fld('name', 'Nom', textInput(v.name, 'Facultatif, ex. « Nordstern »', s => setc('name', s || undefined))),
                fld('detail', 'Matériel', textInput(v.detail, 'ex. « Class 91 + Mk4 »', s => setc('detail', s || undefined)))
            ]),
            fld('route', 'Gares', textInput(Array.isArray(v.route) ? v.route.join(', ') : '', 'ex. Paris, Reims, Metz', s => {
                const arr = s.split(',').map(x => x.trim()).filter(Boolean);
                setc('route', arr.length ? arr : undefined);
            }), 'Dans l’ordre du trajet, séparées par des virgules. La carte affiche départ → terminus et la liste complète au clic.'),
            fld('countries', 'Pays', box, 'Pays où la carte montre ce train. Sans pays, il ne circule que sur la page Trafic.'),
            isHistoricService() ? epochField(v) : null
        ]);
        const meta = el('span');
        meta.textContent = countries.length ? countries.join(', ') : 'page Trafic seulement';
        const c = card('map', 'Carte Circulations', '', body, { open: true });
        c.querySelector('.meta').appendChild(meta);
        return c;
    }

    function isHistoricService() {
        const hist = S.file && Array.isArray(S.file.data.historiques) ? S.file.data.historiques : [];
        return !!(S.sel && hist.indexOf(S.sel.service) >= 0);
    }

    /* Époques où la carte montre un train historique ; aucune cochée = les quatre. */
    function epochField(v) {
        const cur = Array.isArray(v.epoques) ? v.epoques : [];
        const box = el('div.cp-countries');
        C.EPOQUES.concat(cur.filter(x => C.EPOQUES.indexOf(x) < 0)).forEach(ep => {
            box.appendChild(checkInput(cur.indexOf(ep) >= 0, ep, on => {
                let arr = (Array.isArray(view().epoques) ? view().epoques : []).slice();
                if (on) { if (arr.indexOf(ep) < 0) arr.push(ep); } else arr = arr.filter(x => x !== ep);
                arr = C.EPOQUES.filter(x => arr.indexOf(x) >= 0).concat(arr.filter(x => C.EPOQUES.indexOf(x) < 0));
                setc('epoques', arr.length ? arr : undefined);
            }));
        });
        return fld('epoques', 'Époques', box, 'Période historique de la carte. Aucune cochée : le train apparaît dans les quatre.');
    }

    function compoCard(v) {
        const comp = Array.isArray(v.composition) ? v.composition : [];
        const body = el('div', {}, [
            compoEditor(comp, list => {
                setc('composition', list);
                const meta = c.querySelector('.meta');
                if (meta) meta.textContent = list.length + ' ligne(s)';
            }),
            el('div.cp-hint', { text: 'Ligne 1 = tête du train. ↔ : le véhicule a une image miroir (_R) utilisée vers la droite ; ⇄ échange les deux pour un véhicule tourné vers l’arrière.' })
        ]);
        const c = card('compo', 'Composition', comp.length + ' ligne(s)', body, {
            open: true,
            actions: overrides('composition') ? [resetBtn('composition')] : []
        });
        return c;
    }

    function runCard(v) {
        const def = ((S.file.data.defaults || {})[S.sel.service]) || {};
        const tracks = S.tracks.slice();
        if (v.track && tracks.indexOf(v.track) < 0) tracks.push(v.track);
        const body = el('div', {}, [
            el('div.cp-grid3', {}, [
                fld('direction', 'Sens', selectInput([
                    ['', 'Au hasard'], ['L', 'Vers la gauche (L)'], ['R', 'Vers la droite (R)']
                ], v.direction === 'L' || v.direction === 'R' ? v.direction : '', s => setc('direction', s || undefined))),
                fld('speed', 'Vitesse (km/h)', numInput(v.speed, def.speed != null ? String(def.speed) : '100', n => setc('speed', n), true),
                    'Vide : ' + (def.speed != null ? def.speed + ' km/h (défaut du service)' : '100 km/h')),
                fld('starting_speed', 'Vitesse d’entrée (km/h)', numInput(v.starting_speed, '', n => setc('starting_speed', n), true),
                    'Entre lentement puis accélère'),
                fld('track', 'Voie', selectInput([['', 'Défaut' + (def.track ? ' du service (' + def.track + ')' : ' (voie_bois.png)')]]
                    .concat(tracks.map(t => [t, t])), v.track || '', s => setc('track', s || undefined))),
                fld('decor', 'Décor', selectInput([
                    ['', def.decor ? 'Défaut du service (' + def.decor + ')' : 'Automatique : fil au-dessus des engins de 58 px'],
                    ['__none', 'Aucun']
                ].concat(decorsWith(v.decor).map(d => [d, d])), v.decor === false ? '__none' : (v.decor || ''),
                    s => setc('decor', s === '' ? undefined : s === '__none' ? false : s)),
                    'Caténaire ou troisième rail le long de la voie (mltc/assets/decors)'),
                fld('y_offset', 'Décalage vertical (px)', numInput(v.y_offset, '0', n => setc('y_offset', n || undefined), true),
                    'Positif : plus bas sur la voie')
            ]),
            el('div.cp-checks', {}, [
                fld('reverse_composition', '', checkInput(v.reverse_composition, 'Rame retournée une fois sur deux (tête et queue échangées)',
                    on => setc('reverse_composition', on || undefined))),
                fld('reverse_departure', '', checkInput(v.reverse_departure, 'Repart en sens inverse après un arrêt',
                    on => setc('reverse_departure', on || undefined)))
            ])
        ]);
        const meta = [v.speed != null ? v.speed + ' km/h' : (def.speed != null ? def.speed + ' km/h (défaut)' : ''),
            v.direction === 'L' ? 'vers la gauche' : v.direction === 'R' ? 'vers la droite' : ''].filter(Boolean).join(' · ');
        return card('run', 'Marche', meta, body, { open: true });
    }

    function decorsWith(cur) {
        const list = S.decors.slice();
        if (typeof cur === 'string' && cur && list.indexOf(cur) < 0) list.push(cur);
        return list;
    }

    function sput(o, k, val, order) {
        if (val === undefined || val === null || val === '') delete o[k];
        else C.put(o, k, val, order);
    }

    function stopCard(v) {
        const st = v.stop && typeof v.stop === 'object' ? v.stop : null;
        const edit = (mut, redraw) => {
            const s = C.clone(view().stop) || {};
            mut(s);
            setc('stop', s, redraw);
        };
        const so = (s, k, val) => sput(s, k, val, C.STOP_ORDER);
        const kids = [checkInput(!!st, 'Le train marque un arrêt', on => setc('stop', on ? { at: '50%', duration: 5 } : undefined, true))];

        if (st) {
            const mode = st.loco_change ? 'loco' : ((st.attach && st.attach.length) || st.detach_count) ? 'manoeuvre' : 'none';
            const clearOps = s => ['loco_change', 'detach_count', 'detach_position', 'attach', 'attach_position', 'attach_self_detach_count']
                .forEach(k => { delete s[k]; });
            const modeSel = selectInput([
                ['none', 'Aucune manœuvre'],
                ['loco', 'Changement de locomotive'],
                ['manoeuvre', 'Dételage et/ou attelage']
            ], mode, async m => {
                if (m === 'loco') {
                    const r = await pickVehicles({ title: 'Nouvelle locomotive' });
                    if (!r || !r[0]) { modeSel.value = mode; return; }
                    edit(s => { clearOps(s); so(s, 'loco_change', C.memberText(r[0])); so(s, 'detach_count', 1); }, true);
                } else if (m === 'manoeuvre') {
                    edit(s => { clearOps(s); so(s, 'detach_count', 1); }, true);
                } else {
                    edit(clearOps, true);
                }
            });

            kids.push(el('div.cp-grid3', {}, [
                K.field('Position', atInput(st.at, '50%', val => edit(s => so(s, 'at', val))),
                    '40% : centre du train à 40 % de l’écran ; 1600 : bord avant à 1600 px'),
                K.field('Durée (s)', numInput(st.duration, '3', n => edit(s => so(s, 'duration', n)), true))
            ]));
            kids.push(K.field('Manœuvre', modeSel));

            if (mode === 'loco') {
                const it = C.parseItem(st.loco_change);
                const mb = it.members ? it.members[0] : { l: String(st.loco_change), r: '' };
                kids.push(el('div.cp-grid3', {}, [
                    K.field('Nouvelle locomotive (attelée en tête)', memberChip(mb, {
                        replace: async () => {
                            const r = await pickVehicles({ title: 'Nouvelle locomotive' });
                            if (r && r[0]) edit(s => so(s, 'loco_change', C.memberText(r[0])), true);
                        },
                        swap: () => edit(s => so(s, 'loco_change', C.memberText({ l: mb.r, r: mb.l })), true)
                    })),
                    K.field('Véhicules dételés en tête', numInput(st.detach_count, '1', n => edit(s => so(s, 'detach_count', n)), true),
                        'L’ancienne locomotive (1 par défaut)')
                ]));
            } else if (mode === 'manoeuvre') {
                const posSel = (val, cb) => selectInput([['', 'En tête'], ['back', 'En queue']], val === 'back' ? 'back' : '', cb);
                kids.push(el('div.cp-grid3', {}, [
                    K.field('Véhicules dételés', numInput(st.detach_count, '0', n => edit(s => so(s, 'detach_count', n || undefined)), true)),
                    K.field('Dételés', posSel(st.detach_position, val => edit(s => so(s, 'detach_position', val || undefined)))),
                    K.field('Attelés', posSel(st.attach_position, val => edit(s => so(s, 'attach_position', val || undefined))))
                ]));
                kids.push(K.field('Véhicules attelés', compoEditor(st.attach || [], list => edit(s => so(s, 'attach', list.length ? list : undefined)))));
                kids.push(el('div.cp-grid3', {}, [
                    K.field('Puis repartent seuls', numInput(st.attach_self_detach_count, '0',
                        n => edit(s => so(s, 'attach_self_detach_count', n || undefined)), true),
                    'Parmi les véhicules attelés, combien se dételent ensuite (une locomotive de manœuvre, par exemple)')
                ]));
            }
        }
        const meta = st ? ['à ' + (st.at != null ? st.at : '?'), st.duration != null ? st.duration + ' s' : '',
            st.loco_change ? 'changement de loco' : ''].filter(Boolean).join(' · ') : 'aucun';
        return card('stop', 'Arrêt', meta, el('div', {}, kids), {
            open: !!st,
            actions: overrides('stop') ? [resetBtn('stop')] : []
        });
    }

    function stationCard(v) {
        const st = v.station && typeof v.station === 'object' ? v.station : null;
        const edit = (mut, redraw) => {
            const s = C.clone(view().station) || {};
            mut(s);
            setc('station', s, redraw);
        };
        const so = (s, k, val) => sput(s, k, val, C.STATION_ORDER);
        const kids = [checkInput(!!st, 'Le train longe un quai, avec ou sans bâtiment de gare',
            on => setc('station', on ? { at: '50%', length: 3 } : undefined, true))];
        if (st) {
            const quais = S.quais.filter(q => q !== 'quai.png' || st.platform === 'quai.png');
            if (st.platform && quais.indexOf(st.platform) < 0) quais.push(st.platform);
            const gares = S.gares.slice();
            if (st.building && gares.indexOf(st.building) < 0) gares.push(st.building);
            kids.push(el('div.cp-grid3', {}, [
                K.field('Position', atInput(st.at, '50%', val => edit(s => so(s, 'at', val))),
                    '50% : centre du quai à mi-écran ; 300 : bord gauche à 300 px'),
                K.field('Longueur (tronçons)', numInput(st.length, '1', n => edit(s => so(s, 'length', n && n > 0 ? Math.round(n) : undefined)), true),
                    'Nombre de quais alignés, ex. 3'),
                K.field('Quai', selectInput([['', 'quai.png (défaut)']].concat(quais.map(q => [q, q])), st.platform || '',
                    val => edit(s => so(s, 'platform', val || undefined))))
            ]));
            kids.push(el('div.cp-grid3', {}, [
                K.field('Bâtiment', selectInput([['', 'Aucun']].concat(gares.map(g => [g, g])), st.building || '',
                    val => edit(s => so(s, 'building', val || undefined)))),
                K.field('Décalage du bâtiment (px)', numInput(st.building_x, '0', n => edit(s => so(s, 'building_x', n || undefined)), true),
                    'Depuis le centre du quai ; positif vers la droite')
            ]));
            kids.push(el('div.cp-hint', { text: 'Quai et bâtiment sont au fond, atténués, derrière les trains d’arrière-plan. '
                + 'Pour que le train s’arrête en gare, donnez la même position à son Arrêt.' }));
        }
        const meta = st ? [(st.length || 1) + ' × ' + (st.platform || 'quai.png'), st.building || 'sans bâtiment', 'à ' + (st.at != null ? st.at : '50%')].join(' · ') : 'aucune';
        return card('station', 'Gare et quai', meta, el('div', {}, kids), {
            open: !!st,
            actions: overrides('station') ? [resetBtn('station')] : []
        });
    }

    function stationaryCard(v) {
        const ss = v.start_stationary && typeof v.start_stationary === 'object' ? v.start_stationary : null;
        const edit = mut => { const s = C.clone(view().start_stationary) || {}; mut(s); setc('start_stationary', s); };
        const kids = [checkInput(!!ss, 'Le train est déjà à l’arrêt quand il apparaît (en gare, en manœuvre)',
            on => setc('start_stationary', on ? { at: '50%' } : undefined, true))];
        if (ss) {
            kids.push(el('div.cp-grid3', {}, [
                K.field('Position', atInput(ss.at, '50%', val => edit(s => sput(s, 'at', val, ['at', 'duration'])))),
                K.field('Durée (s)', numInput(ss.duration, 'sans fin', n => edit(s => sput(s, 'duration', n, ['at', 'duration'])), true),
                    'Vide : reste à l’arrêt jusqu’au vidage des voies')
            ]));
        }
        return card('stationary', 'Départ à l’arrêt', ss ? 'à ' + (ss.at != null ? ss.at : '50%') : 'non', el('div', {}, kids), {
            open: !!ss,
            actions: overrides('start_stationary') ? [resetBtn('start_stationary')] : []
        });
    }

    function bgCard(v) {
        const bg = v.background && typeof v.background === 'object' ? v.background : null;
        const edit = (mut, redraw) => { const s = C.clone(view().background) || {}; mut(s); setc('background', s, redraw); };
        const bo = (s, k, val) => sput(s, k, val, C.BG_ORDER);
        const kids = [checkInput(!!bg, 'Un second train passe derrière, à demi transparent, sur la même voie',
            on => setc('background', on ? { composition: [], speed: 80 } : undefined, true))];
        if (bg) {
            const sub = (key, obj, order) => {
                const o = obj && typeof obj === 'object' ? obj : null;
                return el('div.cp-grid3', {}, [
                    K.field(key === 'stop' ? 'Arrêt : position' : 'À l’arrêt au départ : position',
                        atInput(o ? o.at : '', 'aucun', val => edit(s => {
                            const x = Object.assign({}, s[key] || {});
                            sput(x, 'at', val, order);
                            bo(s, key, Object.keys(x).length && x.at !== undefined ? x : undefined);
                        }))),
                    K.field('Durée (s)', numInput(o ? o.duration : '', key === 'stop' ? '3' : 'sans fin', n => edit(s => {
                        const x = Object.assign({}, s[key] || {});
                        sput(x, 'duration', n, order);
                        if (x.at !== undefined) bo(s, key, x);
                    }), true))
                ]);
            };
            kids.push(el('div.cp-grid3', {}, [
                K.field('Probabilité (%)', numInput(bg.chance, '100', n => edit(s => bo(s, 'chance', n === 100 ? undefined : n)), true)),
                K.field('Sens', selectInput([['', 'Au hasard'], ['L', 'Vers la gauche (L)'], ['R', 'Vers la droite (R)']],
                    bg.direction === 'L' || bg.direction === 'R' ? bg.direction : '', s2 => edit(s => bo(s, 'direction', s2 || undefined)))),
                K.field('Vitesse (km/h)', numInput(bg.speed, '100', n => edit(s => bo(s, 'speed', n)), true))
            ]));
            kids.push(K.field('Composition', compoEditor(bg.composition || [], list => edit(s => { s.composition = list; }))));
            kids.push(sub('stop', bg.stop, ['at', 'duration']));
            kids.push(sub('start_stationary', bg.start_stationary, ['at', 'duration']));
        }
        return card('bg', 'Train d’arrière-plan', bg ? ((bg.composition || []).length + ' ligne(s)') : 'aucun', el('div', {}, kids), {
            open: !!bg,
            actions: overrides('background') ? [resetBtn('background')] : []
        });
    }

    function fgCard(v) {
        let fg = v.foreground;
        if (typeof fg === 'string') fg = { image: fg };
        fg = fg && typeof fg === 'object' ? fg : null;
        const order = ['image', 'is_vehicle', 'at', 'y'];
        const edit = (mut, redraw) => {
            let s = view().foreground;
            s = typeof s === 'string' ? { image: s } : (C.clone(s) || {});
            mut(s);
            setc('foreground', s, redraw);
        };
        const kids = [checkInput(!!fg, 'Une image passe devant la voie (quai, panneau, autre véhicule)',
            on => setc('foreground', on ? { image: '', is_vehicle: true, at: 0, y: 0 } : undefined, true))];
        if (fg) {
            const isVeh = !!fg.is_vehicle;
            let pickerEl;
            if (isVeh) {
                pickerEl = fg.image
                    ? memberChip({ l: fg.image, r: '' }, {
                        replace: async () => {
                            const r = await pickVehicles({ title: 'Image du premier plan' });
                            if (r && r[0]) edit(s => { s.image = r[0].l; }, true);
                        }
                    })
                    : el('button.btn.sm', {
                        text: 'Choisir une image…',
                        onclick: async () => {
                            const r = await pickVehicles({ title: 'Image du premier plan' });
                            if (r && r[0]) edit(s => { s.image = r[0].l; }, true);
                        }
                    });
            } else {
                const opts = S.fgs.slice();
                if (fg.image && opts.indexOf(fg.image) < 0) opts.unshift(fg.image);
                pickerEl = selectInput([['', '(choisir)']].concat(opts.map(a => [a, a])), fg.image || '', s2 => edit(s => { s.image = s2; }, true));
            }
            kids.push(el('div.cp-grid3', {}, [
                K.field('Source', selectInput([['v', 'Véhicule (livrees_img)'], ['a', 'Image de mltc/assets/premiers-plans']], isVeh ? 'v' : 'a',
                    s2 => edit(s => { s.image = ''; sput(s, 'is_vehicle', s2 === 'v' ? true : undefined, order); }, true))),
                K.field('Image', pickerEl),
                el('div')
            ]));
            kids.push(el('div.cp-grid3', {}, [
                K.field('Position (px)', numInput(fg.at, '0', n => edit(s => sput(s, 'at', n === undefined ? 0 : n, order)), true), 'Bord gauche, depuis le bord de l’écran'),
                K.field('Décalage vertical (px)', numInput(fg.y, '0', n => edit(s => sput(s, 'y', n === undefined ? 0 : n, order)), true))
            ]));
        }
        return card('fg', 'Premier plan', fg ? (fg.image || 'image à choisir') : 'aucun', el('div', {}, kids), {
            open: !!fg,
            actions: overrides('foreground') ? [resetBtn('foreground')] : []
        });
    }

    function jsonCard(train) {
        const ta = el('textarea.cp-json', { spellcheck: false });
        ta.value = JSON.stringify(train, null, 2);
        S.jsonEl = ta;
        const apply = () => {
            let obj;
            try { obj = JSON.parse(ta.value); }
            catch (err) { K.toast('JSON invalide : ' + err.message, 'bad'); return; }
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { K.toast('Il faut un objet { … }.', 'bad'); return; }
            Object.keys(train).forEach(k => { delete train[k]; });
            Object.keys(obj).forEach(k => { train[k] = obj[k]; });
            S.variant = 0;
            changed(true);
            K.toast('JSON appliqué.', 'good');
        };
        return card('json', 'JSON du train', 'base et variantes, pour les cas que les champs ne couvrent pas', el('div', {}, [
            ta,
            el('div.row', { style: 'margin-top:8px' }, [
                el('div.cp-hint.grow', { text: 'Syntaxe complète : clé « _aide » en tête de circulations.js.' }),
                el('button.btn.sm', { text: 'Appliquer', onclick: apply })
            ])
        ]), { open: false });
    }

    /* ---------------------------------------------------------------------
       Services, défauts et période historique
       --------------------------------------------------------------------- */
    const TOP_ORDER = ['_aide', 'historiques', 'decors', 'defaults', 'services'];

    function servicesPanel() {
        const data = S.file.data;
        const svc = services();
        const names = Object.keys(svc).filter(s => s.charAt(0) !== '_');
        const hist = Array.isArray(data.historiques) ? data.historiques : [];

        const reorder = (i, j) => {
            const keys = Object.keys(svc);
            const a = keys.indexOf(names[i]), b = keys.indexOf(names[j]);
            [keys[a], keys[b]] = [keys[b], keys[a]];
            const saved = keys.map(k => [k, svc[k]]);
            keys.forEach(k => delete svc[k]);
            saved.forEach(([k, val]) => { svc[k] = val; });
            changed(true);
        };
        const setDefault = (s, k, val) => {
            if (!data.defaults) C.put(data, 'defaults', {}, TOP_ORDER);
            const d = Object.assign({}, data.defaults[s] || {});
            sput(d, k, val, ['speed', 'track', 'decor']);
            if (Object.keys(d).length) data.defaults[s] = d;
            else delete data.defaults[s];
            changed(false);
        };
        const setHist = (s, on) => {
            let arr = hist.slice();
            if (on) { if (arr.indexOf(s) < 0) arr.push(s); } else arr = arr.filter(x => x !== s);
            C.put(data, 'historiques', arr, TOP_ORDER);
            changed(true);
        };

        const rows = names.map((s, i) => {
            const d = (data.defaults || {})[s] || {};
            const n = (svc[s] || []).length;
            return el('tr', {}, [
                el('td', {}, [el('strong', { text: s })]),
                el('td', { text: String(n) }),
                el('td', {}, [checkInput(hist.indexOf(s) >= 0, '', on => setHist(s, on))]),
                el('td', {}, [numInput(d.speed, '100', v => setDefault(s, 'speed', v), true)]),
                el('td', {}, [selectInput([['', 'voie_bois.png (défaut)']].concat(S.tracks.filter(t => t !== 'voie_bois.png').map(t => [t, t]))
                    .concat(d.track === 'voie_bois.png' ? [['voie_bois.png', 'voie_bois.png']] : []), d.track || '', v => setDefault(s, 'track', v || undefined))]),
                el('td', {}, [selectInput([['', 'Automatique'], ['__none', 'Aucun']].concat(decorsWith(d.decor).map(x => [x, x])),
                    d.decor === false ? '__none' : (d.decor || ''),
                    v => setDefault(s, 'decor', v === '' ? undefined : v === '__none' ? false : v))]),
                el('td', {}, [
                    el('button.btn.icon', { text: '↑', disabled: i === 0, onclick: () => reorder(i, i - 1) }),
                    el('button.btn.icon', { text: '↓', disabled: i === names.length - 1, onclick: () => reorder(i, i + 1) }),
                    el('button.btn.icon.danger', {
                        text: '✕',
                        title: n ? 'Videz d’abord ce service' : 'Supprimer ce service',
                        disabled: n > 0,
                        onclick: () => {
                            delete svc[s];
                            if (data.defaults) delete data.defaults[s];
                            if (hist.indexOf(s) >= 0) C.put(data, 'historiques', hist.filter(x => x !== s), TOP_ORDER);
                            changed(true);
                        }
                    })
                ])
            ]);
        });

        const newName = el('input', { type: 'text', placeholder: 'Nom du service, ex. « Boréale »' });
        const add = () => {
            const s = newName.value.trim();
            if (!s) return;
            if (svc[s]) { K.toast('Ce service existe déjà.', 'bad'); return; }
            svc[s] = [];
            changed(true);
            K.toast('Service ajouté : ' + s);
        };

        return el('div', {}, [
            el('div.cp-head', {}, [el('div.cp-head-row', {}, [el('h2.cp-title', { text: 'Services' })])]),
            el('div.card', {}, [el('div.body', {}, [
                el('table.rep.cp-svc-table', {}, [
                    el('thead', {}, [el('tr', {}, ['Service', 'Trains', 'Historique', 'Vitesse par défaut', 'Voie par défaut', 'Décor par défaut', ''].map(h => el('th', { text: h })))]),
                    el('tbody', {}, rows)
                ]),
                el('div.row', { style: 'margin-top:12px;align-items:center' }, [
                    el('div.grow', {}, [newName]),
                    el('button.btn', { text: 'Ajouter le service', onclick: add })
                ]),
                el('p.cp-hint', { text: 'Historique : services d’avant 2001 (CCFM, WME, MSER), visibles seulement avec le filtre Historique. '
                    + 'Les défauts s’appliquent aux trains qui ne précisent pas leur vitesse ou leur voie. '
                    + 'Un nouveau service va dans l’onglet MLTC Railways de la carte ; pour le ranger dans Autres opérateurs ou Fret et infra, '
                    + 'ajoutez-le à OPERATOR_SERVICES dans js/circulations.js.' })
            ])])
        ]);
    }

    /* ---------------------------------------------------------------------
       Images de mltc/assets : décors, voies, attelages, premiers plans.
       Importées et supprimées directement sur le disque (hors Enregistrer).
       --------------------------------------------------------------------- */
    const ASSET_KINDS = [
        {
            key: 'decors', title: 'Décors', sub: 'caténaires, troisième rail', dir: 'mltc/assets/decors',
            hint: 'Répété le long de la voie, le bas de l’image calé sur le bas de la voie. Une caténaire passe derrière la voie, atténuée ; '
                + 'un troisième rail est posé sur la voie (réglage « Plan », à enregistrer). '
                + 'Pour toucher les pantographes des engins de 58 px, le fil de contact doit passer 67 px au-dessus du bas de l’image.'
        },
        {
            key: 'tracks', title: 'Voies', dir: 'mltc/assets/voies',
            hint: 'Répétée sur toute la largeur ; les trains roulent sur son bord haut. Hauteur habituelle : 8 px.'
        },
        {
            key: 'quais', title: 'Quais', dir: 'mltc/assets/quais',
            hint: 'Tronçon de quai répété autant de fois que voulu (Longueur, carte Gare et quai d’un train), posé sur le haut de la voie. Au fond, atténué.'
        },
        {
            key: 'gares', title: 'Gares', dir: 'mltc/assets/gares',
            hint: 'Bâtiment voyageurs posé sur le quai, au fond, atténué, derrière les trains d’arrière-plan.'
        },
        {
            key: 'couplers', title: 'Attelages', dir: 'mltc/assets', match: n => /couple/i.test(n),
            hint: 'Pièce posée entre deux rames (« + Attelage » d’une composition). Le nom du fichier doit contenir « couple ».'
        },
        {
            key: 'fgs', title: 'Premiers plans', dir: 'mltc/assets/premiers-plans',
            hint: 'Image dessinée devant la voie (quai, panneau…), choisie dans la carte « Premier plan » d’un train.'
        }
    ];

    function assetNames(kind) {
        if (kind.key === 'decors') return S.decors;
        if (kind.key === 'tracks') return S.tracks;
        if (kind.key === 'couplers') return S.assets.filter(kind.match);
        if (kind.key === 'quais') return S.quais;
        if (kind.key === 'gares') return S.gares;
        return S.fgs.map(x => x.slice('premiers-plans/'.length));
    }

    /* Trains (et défauts de service) qui utilisent une image. */
    function assetUsers(kind, name) {
        const out = [];
        if (!S.file) return out;
        const fgName = 'premiers-plans/' + name;
        const hit = c => {
            if (!c || typeof c !== 'object') return false;
            if (kind === 'decors') return c.decor === name;
            if (kind === 'tracks') return c.track === name;
            if (kind === 'quais') return !!c.station && typeof c.station === 'object' && (c.station.platform || 'quai.png') === name;
            if (kind === 'gares') return !!c.station && typeof c.station === 'object' && c.station.building === name;
            if (kind === 'fgs') {
                const f = c.foreground;
                return !!f && typeof f === 'object' && !f.is_vehicle && f.image === fgName;
            }
            return JSON.stringify(c).indexOf('"coupler":' + JSON.stringify(name)) >= 0;
        };
        Compo.trains(S.file.data).forEach(e => {
            const vs = Array.isArray(e.train.variants) ? e.train.variants : [];
            if (hit(e.train) || vs.some(hit)) out.push(e.service + ' · ' + C.title(e.train));
        });
        const defs = S.file.data.defaults || {};
        Object.keys(defs).forEach(sv => { if (hit(defs[sv])) out.push('défaut ' + sv); });
        return out;
    }

    /* Engin de 58 px pour juger l'alignement d'une voie ou d'une caténaire. */
    let locoP = null;
    function sampleLoco() {
        if (!locoP) {
            locoP = (async () => {
                for (const ref of ['nocrail/A-NRBB25500.png', 'boreale/A-BLBR192.png', 'xpress/A-XBB26000.png']) {
                    if (!hasRef(ref)) continue;
                    const im = await loadImage(Compo.LIVREES + ref);
                    if (im && im.height === 58) return im;
                }
                return null;
            })();
        }
        return locoP;
    }

    /* Hauteur du fil de contact par rapport aux pantographes : la ligne
       pleine la plus basse au-dessus des 30 px du bas. */
    function wireInfo(img) {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        let data;
        try { data = x.getImageData(0, 0, img.width, img.height).data; } catch (e) { return ''; }
        let wire = -1;
        for (let y = img.height - 31; y >= 0 && wire < 0; y--) {
            let n = 0;
            for (let i = 0; i < img.width; i++) if (data[(y * img.width + i) * 4 + 3] > 40) n++;
            if (n > img.width * 0.6) wire = y;
        }
        if (wire < 0) return 'pas de fil de contact';
        const d = (img.height - 67) - wire;
        return d === 0 ? 'fil au contact des pantographes'
            : 'fil ' + Math.abs(d) + ' px ' + (d > 0 ? 'au-dessus' : 'en dessous') + ' des pantographes';
    }

    async function renderAsset(kind, path) {
        const im = await loadImage(path);
        if (!im) return { node: el('div.cp-nostrip', { text: 'Image illisible.' }), meta: '' };
        let meta = im.width + ' × ' + im.height + ' px';
        if (kind.key === 'quais' || kind.key === 'gares') {
            const track = await loadImage('mltc/assets/voies/voie_bois.png');
            const loco = await sampleLoco();
            const platform = kind.key === 'quais' ? im : await loadImage(Compo.QUAIS + 'quai.png');
            const building = kind.key === 'gares' ? im : null;
            const scene = {
                track: track,
                station: { platform: platform, building: building, buildingX: 0,
                    length: building && platform ? Math.max(1, Math.ceil(building.width / platform.width)) : 2 }
            };
            const trackH = track ? track.height : 8;
            const H = Math.max(loco ? loco.height + 12 : 40, sceneRise(scene)) + trackH;
            const cv = el('canvas.cp-cv');
            cv.width = Math.max(620, stationWidth(scene.station) + 60);
            cv.height = H;
            const ctx = cv.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            drawBack(ctx, cv.width, scene, H - trackH);
            if (loco) ctx.drawImage(loco, 30, H - trackH - loco.height);
            return { node: cv, meta: meta };
        }
        if (kind.key !== 'decors' && kind.key !== 'tracks') {
            const cv = el('canvas.cp-cv');
            cv.width = im.width + 40;
            cv.height = im.height + 12;
            const ctx = cv.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(im, 20, 6);
            return { node: cv, meta: meta };
        }
        const track = kind.key === 'tracks' ? im : await loadImage('mltc/assets/voies/voie_bois.png');
        const decor = kind.key === 'decors' ? im : null;
        const loco = await sampleLoco();
        const scene = { track: track, decor: decor, onTrack: decor ? Compo.decorOnTrack(S.file.data, path.split('/').pop()) : false };
        const trackH = track ? track.height : 8;
        const H = Math.max(loco ? loco.height + 12 : 40, sceneRise(scene)) + trackH;
        const ground = H - trackH;
        const cv = el('canvas.cp-cv');
        cv.width = 620;
        cv.height = H;
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        drawBack(ctx, cv.width, scene, ground);
        if (loco) ctx.drawImage(loco, 90, ground - loco.height);
        if (decor && !scene.onTrack) meta += ' · ' + wireInfo(decor);
        return { node: cv, meta: meta };
    }

    function forgetImage(path) {
        const u = urls.get(path);
        urls.delete(path);
        imgs.delete(path);
        if (u) u.then(x => { if (x) URL.revokeObjectURL(x); });
    }

    async function afterAssetChange() {
        await loadAssetLists();
        drawRailList();
        renderEditor();
    }

    async function importAssets(kind, files) {
        for (const f of files) {
            if (!/\.png$/i.test(f.name)) { K.toast(f.name + ' : seules les images PNG sont acceptées.', 'bad'); continue; }
            const name = f.name.replace(/\s+/g, '_');
            if (kind.match && !kind.match(name)) {
                K.toast(name + ' : le nom d’un attelage doit contenir « couple ».', 'bad');
                continue;
            }
            const path = kind.dir + '/' + name;
            if ((await listPng(kind.dir)).indexOf(name) >= 0 && !await K.confirm('Remplacer ' + name + ' ?',
                '<code>' + esc(path) + '</code> existe déjà : l’image sera remplacée sur le disque.', 'Remplacer', true)) continue;
            try {
                await Fs.writeBinary(path, f);
                forgetImage(path);
                K.toast('Importé : ' + path, 'good');
            } catch (err) {
                K.toast('Import impossible : ' + err.message, 'bad');
            }
        }
        await afterAssetChange();
    }

    /* Plan d'un décor : clé "decors" du fichier (à enregistrer). */
    function setDecorPlan(name, onTrack) {
        const d = S.file.data;
        if (onTrack) {
            if (!d.decors || typeof d.decors !== 'object') C.put(d, 'decors', {}, TOP_ORDER);
            d.decors[name] = Object.assign({}, d.decors[name], { on_track: true });
        } else if (d.decors && d.decors[name]) {
            const x = Object.assign({}, d.decors[name]);
            delete x.on_track;
            if (Object.keys(x).length) d.decors[name] = x;
            else delete d.decors[name];
            if (!Object.keys(d.decors).length) delete d.decors;
        }
        changed(true);
    }

    async function deleteAsset(kind, name) {
        const path = kind.dir + '/' + name;
        if (!await K.confirm('Supprimer ' + name + ' ?',
            '<code>' + esc(path) + '</code> sera supprimé du disque. Aucun train de circulations.js ne l’utilise.',
            'Supprimer', true)) return;
        try {
            await Fs.removeFile(path);
            forgetImage(path);
            K.toast('Supprimé : ' + path);
        } catch (err) {
            K.toast('Suppression impossible : ' + err.message, 'bad');
            return;
        }
        await afterAssetChange();
    }

    function assetRow(kind, name) {
        const path = kind.dir + '/' + name;
        const users = assetUsers(kind.key, name);
        const isDefault = (kind.key === 'tracks' && name === 'voie_bois.png') || (kind.key === 'quais' && name === 'quai.png');
        const strip = el('div.cp-strip.cp-asset-pv');
        const meta = el('div.cp-asset-meta');
        renderAsset(kind, path).then(r => { K.clear(strip); strip.appendChild(r.node); meta.textContent = r.meta; });
        const usage = users.length
            ? (users.length > 1 ? users.length + ' utilisations : ' : 'Utilisé par ') + users.slice(0, 3).join(', ') + (users.length > 3 ? '…' : '')
            : (isDefault ? 'Image par défaut' : 'Inutilisé');
        return el('div.cp-asset', {}, [
            strip,
            el('div.cp-asset-side', {}, [
                el('div.cp-mname', { text: name, title: path }),
                meta,
                el('div.cp-asset-users' + (users.length || isDefault ? '' : '.unused'), { text: usage, title: users.join('\n') }),
                kind.key === 'decors' ? el('label.cp-inline', { title: 'Réglage enregistré dans circulations.js (clé decors)' }, ['Plan ',
                    selectInput([['', 'caténaire, derrière la voie'], ['on_track', 'posé sur la voie (3e rail)']],
                        Compo.decorOnTrack(S.file.data, name) ? 'on_track' : '', v => setDecorPlan(name, v === 'on_track'))]) : null,
                el('button.btn.sm.danger', {
                    text: 'Supprimer',
                    disabled: users.length > 0 || isDefault,
                    title: users.length ? 'Utilisé : retirez-le d’abord des trains concernés' : isDefault ? 'Voie par défaut' : 'Supprimer du disque',
                    onclick: () => deleteAsset(kind, name)
                })
            ])
        ]);
    }

    function assetCard(kind) {
        const names = assetNames(kind);
        const input = el('input', { type: 'file', accept: 'image/png', multiple: true, hidden: true });
        input.addEventListener('change', () => {
            const files = Array.from(input.files || []);
            input.value = '';
            if (files.length) importAssets(kind, files);
        });
        const list = el('div.cp-assets');
        if (!names.length) list.appendChild(el('div.cp-none', { text: 'Aucune image pour l’instant.' }));
        names.forEach(n => list.appendChild(assetRow(kind, n)));
        return card('asset-' + kind.key, kind.title, (kind.sub ? kind.sub + ' · ' : '') + kind.dir + '/', el('div', {}, [
            el('p.cp-hint', { text: kind.hint, style: 'margin:0 0 10px' }),
            list,
            el('div.cp-addbar', {}, [
                el('button.btn.sm.primary', { text: 'Importer des images…', onclick: () => input.click() }),
                input
            ])
        ]), { open: true });
    }

    function assetsPanel() {
        return el('div', {}, [
            el('div.cp-head', {}, [
                el('div.cp-head-row', {}, [el('h2.cp-title', { text: 'Assets' })]),
                el('p.cp-hint', { text: 'Images de mltc/assets utilisées par la page Trafic et la carte. Les imports et suppressions sont écrits '
                    + 'tout de suite sur le disque, sans passer par Enregistrer : relisez git status ensuite. Une image utilisée par un train ne peut pas être supprimée.' })
            ])
        ].concat(ASSET_KINDS.map(assetCard)));
    }

    /* ---------------------------------------------------------------------
       Contrôle d'ensemble
       --------------------------------------------------------------------- */
    function showCheck() {
        if (!S.file) return;
        const all = Compo.trains(S.file.data);
        const bad = all.map(e => ({ e: e, iss: issuesOf(e.train) })).filter(x => x.iss.errors.length || x.iss.warns.length);
        const list = el('div.cp-check');
        bad.forEach(x => {
            list.appendChild(el('button.cp-check-item', {
                onclick: () => { m.close(); S.folded.delete(x.e.service); select(x.e.service, x.e.train); }
            }, [
                el('strong', { text: x.e.service + ' · ' + C.title(x.e.train) }),
                el('ul', {}, x.iss.errors.map(t => el('li.err', { text: t })).concat(x.iss.warns.map(t => el('li.warn', { text: t }))))
            ]));
        });
        const onMap = all.filter(e => Array.isArray(e.train.countries) && e.train.countries.length).length;
        const m = K.modal({
            title: 'Contrôle de ' + C.PATH,
            body: el('div', {}, [
                el('p', {}, [
                    S.roundtrip ? el('span.ok', { text: '✓ Relu et réécrit à l’identique' })
                        : el('span.err', { text: '✗ Mise en forme inhabituelle : le prochain enregistrement réécrira tout le fichier' }),
                    ' · ' + all.length + ' trains, ' + onMap + ' sur la carte'
                ]),
                bad.length ? list : el('p.ok', { text: 'Aucune image manquante, aucun pays inconnu, aucune composition vide.' })
            ]),
            footer: [el('div.spacer')]
        });
    }

    /* ---------------------------------------------------------------------
       Enregistrement
       --------------------------------------------------------------------- */
    async function save() {
        if (!isDirty()) return;
        const out = C.build(S.file, S.file.data);
        try {
            const back = C.split(out);
            if (!C.same(back.data, S.file.data) || back.prefix !== S.file.prefix || back.suffix !== S.file.suffix) {
                throw new Error('la relecture du résultat diffère');
            }
        } catch (err) {
            K.toast('Rendu invalide, rien n’a été écrit : ' + err.message, 'bad');
            return;
        }

        const errs = [];
        Compo.trains(S.file.data).forEach(e => issuesOf(e.train).errors.forEach(t => errs.push(e.service + ' · ' + C.title(e.train) + ' : ' + t)));

        const diff = D.diffLines(S.text, out);
        const rows = D.withContext(diff, S.text, out, 3);
        const diffView = el('div.diff');
        for (const r of rows) {
            if (r === null) { diffView.appendChild(el('div.fold', { text: '⋯' })); continue; }
            const cls = r.op === '+' ? '.add' : r.op === '-' ? '.del' : '';
            diffView.appendChild(el('div' + cls, {}, [
                el('span.ln', { text: r.op === '+' ? '+' + r.b : r.op === '-' ? '-' + r.a : ' ' + r.a }),
                r.text.replace(/\r$/, '')
            ]));
        }
        const m = K.modal({
            title: 'Modifications de ' + C.PATH,
            body: el('div', {}, [
                errs.length ? el('div.cp-issues-box', {}, [
                    el('p.warn', { text: errs.length + ' problème(s) : ces trains ne s’afficheront pas correctement.' }),
                    el('ul', {}, errs.slice(0, 12).map(t => el('li', { text: t })))
                ]) : null,
                el('p', { html: '<strong class="err">−' + diff.removed + '</strong> / <strong class="ok">+' + diff.added + '</strong> ligne(s)' }),
                diffView
            ]),
            footer: [
                el('div.spacer'),
                el('button.btn', { text: 'Annuler', onclick: () => m.close() }),
                el('button.btn.primary', { text: errs.length ? 'Écrire quand même' : 'Écrire le fichier', onclick: () => { m.close(); write(out); } })
            ]
        });
    }

    async function write(out) {
        try {
            await Fs.writeText(C.PATH, out);
        } catch (err) {
            if (err.code === 'STALE') {
                const reload = await K.confirm('Fichier modifié sur le disque',
                    '<code>' + C.PATH + '</code> a changé depuis son ouverture (édité dans VS Code ?).<br><br>'
                    + '<strong>Rien n’a été écrit.</strong> Le recharger ? Vos modifications en cours seront perdues.',
                    'Recharger', true);
                if (reload) await load(selKey());
                return;
            }
            K.toast('Écriture impossible : ' + err.message, 'bad');
            return;
        }
        S.text = out;
        S.roundtrip = true;
        snapshot();
        drawRailList();
        refreshChrome();
        K.toast('Enregistré : ' + C.PATH + ' — vérifiez git diff', 'good');
    }

    function selKey() {
        if (!S.sel) return null;
        return { service: S.sel.service, index: (services()[S.sel.service] || []).indexOf(S.sel.train) };
    }

    async function revert() {
        if (!isDirty()) return;
        if (!await K.confirm('Annuler les modifications ?',
            'Toutes les modifications non enregistrées seront perdues ; le fichier est relu sur le disque.',
            'Annuler les modifications', true)) return;
        await load(selKey());
        K.toast('Modifications annulées');
    }

    boot();
})();
