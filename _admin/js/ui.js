/* =========================================================================
   ui.js — Interface de l'outil admin.
   ========================================================================= */
(function () {
    'use strict';

    const K = window.LvKit, el = K.el;
    const Fs = window.LvFs, P = window.LvParse, Ser = window.LvSer;
    const M = window.LvModel, V = window.LvValidate, D = window.LvDiff;
    const Pv = window.LvPreview, Ig = window.LvIntegrity, X = window.LvExtra;
    const Rc = window.LvRecent;

    const DIR = 'mltc/livrees_pages';
    const INDEX_PAGE = 'mltc/livrees.html';

    const S = {
        files: [],            // noms de fichiers de livrees_pages
        pages: new Map(),     // path -> page (chargees)
        current: null,        // page active
        issues: null,
        open: new Set(),      // cartes depliees (cles stables)
        previewOn: false
    };

    const $ = id => document.getElementById(id);

    /* ---------------------------------------------------------------------
       Connexion
       --------------------------------------------------------------------- */
    async function boot() {
        if (!Fs.isSupported()) {
            $('welcome').innerHTML = '<p class="err"><strong>Navigateur non compatible.</strong></p>'
                + '<p class="dim">Cet outil utilise la File System Access API : '
                + 'ouvrez-le dans Chrome ou Edge.</p>';
            $('btn-connect').disabled = true;
            return;
        }
        wire();
        try {
            const name = await Fs.restore();
            if (name) await afterConnect(name);
        } catch (e) { /* pas de handle memorise */ }
    }

    function wire() {
        $('btn-connect').onclick = async () => {
            try {
                const name = await Fs.connect();
                await afterConnect(name);
            } catch (err) {
                if (err && err.name === 'AbortError') return;
                K.toast('Connexion impossible : ' + err.message, 'bad');
            }
        };
        $('btn-save').onclick = saveCurrent;
        $('btn-revert').onclick = revertCurrent;
        $('btn-autotest').onclick = runAutoTest;
        $('btn-integrity').onclick = showIntegrity;
        $('btn-recent').onclick = showRecent;
        $('btn-preview').onclick = togglePreview;
        $('pv-refresh').onclick = () => Pv.render(S.current, $('pv-frame'), $('pv-status'));

        window.addEventListener('beforeunload', e => {
            if (dirtyPages().length) { e.preventDefault(); e.returnValue = ''; }
        });
    }

    async function afterConnect(name) {
        $('dot').classList.add('on');
        $('dot').title = 'Connecté';
        $('rootname').textContent = name;
        $('btn-connect').textContent = 'Changer de dossier';
        ['btn-autotest', 'btn-integrity', 'btn-recent', 'btn-preview'].forEach(i => { $(i).disabled = false; });

        S.files = await Fs.listDir(DIR, '.html');
        K.toast('Indexation des images…');
        try { await Fs.indexImages(); } catch (e) { K.toast('Index des images : ' + e.message, 'bad'); }
        Ig.collect().catch(() => { });
        drawRail();
        $('welcome').innerHTML = '<p class="dim">Choisissez une page dans la colonne de gauche.</p>';
    }

    /* ---------------------------------------------------------------------
       Rail gauche
       --------------------------------------------------------------------- */
    function drawRail() {
        const rail = $('rail');
        K.clear(rail);

        rail.appendChild(el('h3', { text: 'Page index' }));
        rail.appendChild(pageItem(INDEX_PAGE, 'livrees.html', 'grille d\'icônes'));

        rail.appendChild(el('h3', { text: 'Pages de livrées (' + S.files.length + ')' }));
        for (const f of S.files) {
            const path = DIR + '/' + f;
            const p = S.pages.get(path);
            const sub = p && !p.readOnly
                ? p.engineCount + ' engins · ' + p.sectionCount + ' sections'
                : 'non chargée';
            rail.appendChild(pageItem(path, f, sub));
        }

        rail.appendChild(el('h3', { text: 'Actions' }));
        rail.appendChild(el('button.btn.sm', {
            text: '+ Nouvelle page de livrée',
            style: 'width:100%',
            onclick: () => X.newPageWizard(async path => {
                S.files = await Fs.listDir(DIR, '.html');
                X.forgetAnchors();
                drawRail();
                openPage(path);
            })
        }));
    }

    function pageItem(path, label, sub) {
        const p = S.pages.get(path);
        let cls = '.pageitem';
        if (S.current && S.current.path === path) cls += '.active';
        if (p && p.dirty) cls += '.mod';
        return el('button' + cls, { onclick: () => openPage(path) }, [
            el('div.nm', {}, [el('span.flag'), el('span', { text: label })]),
            el('div.sub', { text: sub })
        ]);
    }

    /* ---------------------------------------------------------------------
       Ouverture d'une page
       --------------------------------------------------------------------- */
    async function openPage(path) {
        try {
            let page = S.pages.get(path);
            if (!page) {
                page = P.parse(await Fs.readText(path), path);
                S.pages.set(path, page);
            }
            S.current = page;
            S.open.clear();
            drawRail();
            renderEditor();
            if (S.previewOn) Pv.schedule(page, $('pv-frame'), $('pv-status'), 10);
        } catch (err) {
            K.toast('Ouverture impossible : ' + err.message, 'bad');
        }
    }

    function dirtyPages() {
        return [...S.pages.values()].filter(p => p.dirty);
    }

    function markDirty() {
        const page = S.current;
        if (page) page.dirty = true;
        refreshChrome();
    }

    function refreshChrome() {
        const page = S.current;
        const n = page ? Ser.dirtyCount(page) : 0;
        $('btn-save').disabled = !page || !page.dirty || page.readOnly;
        $('btn-save').textContent = page && page.dirty
            ? 'Enregistrer (' + Math.max(n, 1) + ')' : 'Enregistrer';
        $('btn-revert').disabled = !page || !page.dirty;
        drawRail();
    }

    function schedulePreview() {
        if (S.previewOn) Pv.schedule(S.current, $('pv-frame'), $('pv-status'));
    }

    function togglePreview() {
        S.previewOn = !S.previewOn;
        $('layout').classList.toggle('no-preview', !S.previewOn);
        $('btn-preview').classList.toggle('primary', S.previewOn);
        if (S.previewOn) Pv.render(S.current, $('pv-frame'), $('pv-status'));
    }

    /* ---------------------------------------------------------------------
       Rendu de l'editeur
       --------------------------------------------------------------------- */
    function renderEditor() {
        const host = $('editor');
        /* Un reordonnancement reconstruit tout l'editeur : sans cela, la vue
           saute en haut de page a chaque glissement. */
        const scroll = host.scrollTop;
        K.clear(host);
        const page = S.current;
        if (!page) {
            host.appendChild(el('div.empty', { html: '<p class="dim">Choisissez une page.</p>' }));
            return;
        }
        if (page.readOnly) {
            host.appendChild(el('div.empty', {
                html: '<p class="err"><strong>Page non modifiable</strong></p><p class="dim">'
                    + page.parseError + '</p>'
            }));
            return;
        }

        S.issues = V.issuesFor(page);
        host.appendChild(pageHeaderCard(page));

        for (const node of page.root) {
            if (node.type === 'text' || node.type === 'comment') continue;
            const c = blockCard(node, page.root, page);
            if (c) host.appendChild(c);
        }

        host.appendChild(addBlockBar(page.root, page, true));
        host.scrollTop = scroll;
        refreshChrome();
    }

    /* --- carte « reglages de la page » ---------------------------------- */
    function pageHeaderCard(page) {
        const themeSel = el('select', {
            onchange: e => {
                const base = page.kind === 'index' ? '' : 'lv-page';
                page.mainClass = (base + (e.target.value ? ' ' + e.target.value : '')).trim();
                page.theme = e.target.value || null;
                markDirty();
                schedulePreview();
            }
        }, [
            el('option', { value: '', text: 'Aucun (violet par défaut)' }),
            el('option', { value: 'lv-theme-red', text: 'Rouge' }),
            el('option', { value: 'lv-theme-orange', text: 'Orange' }),
            el('option', { value: 'lv-theme-cfp', text: 'CFP' })
        ]);
        themeSel.value = page.theme || '';

        const body = el('div.body', {}, [
            el('div.row', {}, [
                el('div.grow', {}, [K.field('Thème de couleur', themeSel)]),
                el('div.grow', {}, [K.field('Fichier',
                    el('input', { type: 'text', value: page.path, readOnly: true }))])
            ])
        ]);

        const issues = (S.issues.list || []).filter(i => !i.node);
        return card('Réglages de la page', page.engineCount + ' engins · '
            + page.sectionCount + ' sections', body, { open: false, issues: issues, key: 'pagehdr' });
    }

    /* --- carte generique ------------------------------------------------- */
    function card(title, meta, bodyNode, opts) {
        opts = opts || {};
        const key = opts.key;
        const isOpen = key ? S.open.has(key) : !!opts.open;
        const box = el('div.card' + (opts.opaque ? '.opaque' : ''));
        const badges = [];
        for (const lv of ['error', 'warn', 'info']) {
            const k = (opts.issues || []).filter(i => i.level === lv).length;
            if (k) badges.push(K.badge(lv, k + (lv === 'error' ? ' erreur' : lv === 'warn' ? ' alerte' : ' info') + (k > 1 ? 's' : '')));
        }
        /* Reference explicite : la poignee de glissement sera inseree avant
           le chevron, donc head.firstChild ne pointe plus dessus. */
        const chev = el('span', { text: isOpen ? '▾' : '▸', style: 'color:#9a92b4;width:12px' });
        const head = el('header', {}, [
            chev,
            el('span.title', { text: title }),
            meta ? el('span.meta', { text: meta }) : null,
            el('div.spacer')
        ].concat(badges).concat(opts.actions || []));

        const body = bodyNode;
        body.style.display = isOpen ? '' : 'none';
        head.addEventListener('click', e => {
            if (e.target.closest('.grip')) return;
            if (e.target.closest('button') && e.target.closest('button') !== head) return;
            const now = body.style.display === 'none';
            body.style.display = now ? '' : 'none';
            chev.textContent = now ? '▾' : '▸';
            if (key) { if (now) S.open.add(key); else S.open.delete(key); }
        });
        box.appendChild(head);
        box.appendChild(body);
        return box;
    }

    function issuesOf(node) {
        return (S.issues && S.issues.byNode.get(node)) || [];
    }
    function issueLines(node) {
        const is = issuesOf(node);
        if (!is.length) return null;
        return el('div', { style: 'margin-bottom:8px' },
            is.map(i => el('div.' + (i.level === 'error' ? 'err' : i.level),
                { text: '• ' + i.msg, style: 'font-size:12px' })));
    }

    /* ---------------------------------------------------------------------
       Glisser-deposer, mecanisme unique

       Sert aux blocs (sections, titres, listes…) ET aux lignes d'engin : un
       engin, une separation et une description appartiennent au meme tableau
       `children`, ils se reordonnent donc librement entre eux.

       Le depot n'est accepte qu'entre freres du MEME conteneur : chaque
       tableau `children` recoit une cle stable, et un survol dont la cle ne
       correspond pas laisse l'evenement remonter au parent. C'est ce qui
       permet aux cartes imbriquees de cohabiter sans se voler les depots, et
       a une section tiree au-dessus d'une ligne d'engin de ne pas y etre
       capturee.
       --------------------------------------------------------------------- */
    let dragging = null;          // {key, from} pendant un glissement
    let containerSeq = 0;

    function containerKey(arr) {
        if (!arr.__lvKey) {
            Object.defineProperty(arr, '__lvKey', {
                value: 'c' + (++containerSeq), enumerable: false, configurable: true
            });
        }
        return arr.__lvKey;
    }

    function clearDropMarks() {
        document.querySelectorAll('.drop-before, .drop-after')
            .forEach(n => n.classList.remove('drop-before', 'drop-after'));
    }

    function attachDrag(box, node, siblings, page) {
        const key = containerKey(siblings);
        const indexOf = () => M.elementPositions(siblings).indexOf(siblings.indexOf(node));

        const grip = el('span.grip', {
            text: '⠿', draggable: true, title: 'Glisser pour réordonner',
            style: 'cursor:grab;color:#9a92b4;width:12px;user-select:none'
        });

        grip.addEventListener('dragstart', e => {
            e.stopPropagation();
            dragging = { key: key, from: indexOf() };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', 'bloc');
            box.style.opacity = '.45';
        });
        grip.addEventListener('dragend', () => {
            box.style.opacity = '';
            dragging = null;
            clearDropMarks();
        });

        box.addEventListener('dragover', e => {
            if (!dragging || dragging.key !== key) return;   // laisser remonter
            e.preventDefault();
            e.stopPropagation();
            const r = box.getBoundingClientRect();
            const after = e.clientY > r.top + r.height / 2;
            box.classList.toggle('drop-after', after);
            box.classList.toggle('drop-before', !after);
        });
        box.addEventListener('dragleave', e => {
            if (e.target !== box) return;
            box.classList.remove('drop-before', 'drop-after');
        });
        box.addEventListener('drop', e => {
            if (!dragging || dragging.key !== key) return;
            e.preventDefault();
            e.stopPropagation();
            box.classList.remove('drop-before', 'drop-after');
            const r = box.getBoundingClientRect();
            const here = indexOf();
            const to = e.clientY > r.top + r.height / 2 ? here + 1 : here;
            const from = dragging.from;
            dragging = null;
            if (from === to || from === to - 1) return;      // sur place
            const container = findContainerOf(page, siblings);
            if (!container) return;
            M.moveBlock(container, from, to, page);
            markDirty(); renderEditor(); schedulePreview();
        });

        return grip;
    }

    /* --- aiguillage par type -------------------------------------------- */
    let keySeq = 0;
    function blockCard(node, siblings, page) {
        node._key = node._key || ('k' + (++keySeq));
        const box = dispatchCard(node, siblings, page);
        /* Seules les vraies cartes sont deplacables : `groupCard` renvoie un
           simple conteneur transparent, ses enfants gerent leur propre glissement. */
        if (box && box.classList && box.classList.contains('card')) {
            const head = box.querySelector(':scope > header');
            if (head) head.insertBefore(attachDrag(box, node, siblings, page), head.firstChild);
        }
        return box;
    }

    function dispatchCard(node, siblings, page) {
        switch (node.type) {
            case 'wrap': return wrapCard(node, siblings, page);
            case 'section': return sectionCard(node, siblings, page);
            case 'category': return categoryCard(node, siblings, page);
            case 'group':
            case 'lastmod': return groupCard(node, siblings, page);
            case 'h2': return h2Card(node, siblings, page);
            case 'catbar': return textCard(node, siblings, page, 'Barre de catégorie');
            case 'sep': return textCard(node, siblings, page, 'Séparation');
            case 'sub': return textCard(node, siblings, page, 'Sous-titre');
            case 'catTitle': return textCard(node, siblings, page, 'Titre de catégorie');
            case 'lastmodText': return textCard(node, siblings, page, 'Dernière mise à jour');
            case 'desc': return descCard(node, siblings, page);
            case 'btns': return btnsCard(node, siblings, page);
            case 'list': return listCard(node, siblings, page);
            case 'icons': return iconsCard(node, siblings, page);
            case 'engine': return null;   // rendu par listCard
            default: return opaqueCard(node, siblings, page);
        }
    }

    function removeBtn(node, siblings, page, label) {
        return el('button.btn.sm.danger', {
            text: '✕',
            title: 'Supprimer ' + (label || 'ce bloc'),
            onclick: async e => {
                e.stopPropagation();
                const pos = M.elementPositions(siblings).indexOf(siblings.indexOf(node));
                if (pos < 0) return;
                if (!await K.confirm('Supprimer ?',
                    'Ce bloc sera retiré de la page. <br><span class="dim">Rien n\'est écrit sur le disque avant l\'enregistrement.</span>',
                    'Supprimer', true)) return;
                const container = findContainerOf(page, siblings);
                if (container) M.removeChild(container, pos, page);
                else { siblings.splice(siblings.indexOf(node), 1); page.dirty = true; }
                markDirty(); renderEditor(); schedulePreview();
            }
        });
    }

    /* Retrouve le noeud conteneur dont `children` est ce tableau. */
    function findContainerOf(page, arr) {
        if (arr === page.root) return { children: page.root, dirty: false };
        let found = null;
        P.walk(page, n => { if (n.children === arr) found = n; });
        return found;
    }

    /* --- en-tete de page (lv-wrap) --------------------------------------- */
    function wrapCard(node, siblings, page) {
        const body = el('div.body');
        for (const c of node.children) {
            if (c.type === 'text' || c.type === 'comment') continue;
            const sub = blockCard(c, node.children, page);
            if (sub) body.appendChild(sub);
        }
        body.appendChild(addBlockBar(node.children, page, false, ['topbar', 'desc', 'btns']));
        return card('En-tête de page', '', body, { key: node._key, open: true });
    }

    /* --- section --------------------------------------------------------- */
    function sectionCard(node, siblings, page) {
        const body = el('div.body');

        const idInput = el('input', {
            type: 'text', value: node.id || '',
            onchange: e => onIdChange(node, page, e.target.value)
        });
        body.appendChild(el('div.row', {}, [
            el('div.grow', {}, [K.field('Identifiant (ancre)', idInput,
                'Utilisé par les boutons du haut de page et par les liens de livrees.html')])
        ]));
        const il = issueLines(node);
        if (il) body.appendChild(il);

        for (const c of node.children) {
            if (c.type === 'text' || c.type === 'comment') continue;
            const sub = blockCard(c, node.children, page);
            if (sub) body.appendChild(sub);
        }
        body.appendChild(addBlockBar(node.children, page, false));

        const cb = node.children.find(c => c.type === 'catbar');
        let count = 0;
        (function rec(list) { for (const c of list) { if (c.type === 'engine') count++; if (c.children) rec(c.children); } })(node.children);

        return card('Section' + (cb ? ' — ' + cb.text : (node.id ? ' #' + node.id : '')),
            count + ' engins', body, {
            key: node._key,
            issues: issuesOf(node),
            actions: [removeBtn(node, siblings, page, 'cette section')]
        });
    }

    function onIdChange(node, page, value) {
        const old = node.id;
        const v = M.slugify(value);
        M.setField(node, page, n => {
            n.id = v;
            if (n.openTagRaw) {
                const r = window.LvScan.attrRange(n.openTagRaw, 'id');
                if (r) n.openTagRaw = n.openTagRaw.slice(0, r.start) + Ser.escAttr(v) + n.openTagRaw.slice(r.end);
            }
        });
        /* Reporter le changement sur les boutons d'ancre de la page. */
        if (old && old !== v) {
            P.walk(page, n => {
                if (n.type !== 'btns') return;
                let hit = false;
                for (const b of n.buttons) if (b.href === '#' + old) { b.href = '#' + v; hit = true; }
                if (hit) M.setField(n, page, () => { });
            });
            const users = Ig.anchorUsers(page.slug, old);
            if (users.length) {
                K.toast('Attention : ' + users.length + ' lien(s) de livrees.html pointent encore vers #' + old, 'bad');
            }
        }
        markDirty(); renderEditor(); schedulePreview();
    }

    /* --- categorie de l'index -------------------------------------------- */
    function categoryCard(node, siblings, page) {
        const body = el('div.body');
        for (const c of node.children) {
            if (c.type === 'text' || c.type === 'comment') continue;
            const sub = blockCard(c, node.children, page);
            if (sub) body.appendChild(sub);
        }
        body.appendChild(addBlockBar(node.children, page, false, ['sub', 'icons']));
        const t = node.children.find(c => c.type === 'catTitle');
        return card('Catégorie' + (t ? ' — ' + t.text : ''), '', body, {
            key: node._key,
            actions: [removeBtn(node, siblings, page, 'cette catégorie')]
        });
    }

    /* --- conteneur neutre (div.lv-container, section.last-modified) ------ */
    function groupCard(node, siblings, page) {
        const kids = node.children.filter(c => c.type !== 'text' && c.type !== 'comment');
        const known = kids.filter(c => c.type !== 'unknown');
        if (!known.length) return opaqueCard(node, siblings, page);

        const frag = document.createDocumentFragment();
        for (const c of kids) {
            const sub = blockCard(c, node.children, page);
            if (sub) frag.appendChild(sub);
        }
        const wrap = el('div');
        wrap.appendChild(frag);
        return wrap;
    }

    /* --- titres et textes courts ----------------------------------------- */
    function h2Card(node, siblings, page) {
        const body = el('div.body', {}, [
            el('div.row', {}, [
                el('div.grow', {}, [K.field('Titre', el('input', {
                    type: 'text', value: node.text,
                    oninput: e => { M.setField(node, page, n => { n.text = e.target.value; }); markDirty(); schedulePreview(); }
                }))]),
                el('div.grow', {}, [K.field('Identifiant (ancre)', el('input', {
                    type: 'text', value: node.id || '',
                    onchange: e => onIdChange(node, page, e.target.value)
                }))])
            ]),
            issueLines(node)
        ]);
        return card('Titre d\'époque — ' + node.text, '', body, {
            key: node._key, issues: issuesOf(node),
            actions: [removeBtn(node, siblings, page)]
        });
    }

    function textCard(node, siblings, page, label) {
        const input = el('input', {
            type: 'text', value: node.text,
            oninput: e => {
                M.setField(node, page, n => { n.text = e.target.value; });
                head.querySelector('.title').textContent = label + ' — ' + e.target.value;
                markDirty(); schedulePreview();
            }
        });
        const body = el('div.body', {}, [K.field('Texte', input)]);
        const c = card(label + ' — ' + node.text, '', body, {
            key: node._key,
            actions: node.type === 'lastmodText' ? [] : [removeBtn(node, siblings, page)]
        });
        const head = c;
        return c;
    }

    function descCard(node, siblings, page) {
        const ta = el('textarea', {
            value: node.html,
            style: 'min-height:90px',
            oninput: e => { M.setField(node, page, n => { n.html = e.target.value; }); markDirty(); schedulePreview(); }
        });
        const body = el('div.body', {}, [
            K.field('Contenu HTML', ta, 'Balises autorisées (<p>, <strong>, <br>…)')
        ]);
        const plain = node.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return card('Description', plain.slice(0, 70) + (plain.length > 70 ? '…' : ''), body, {
            key: node._key, actions: [removeBtn(node, siblings, page)]
        });
    }

    /* --- boutons d'ancre -------------------------------------------------- */
    function btnsCard(node, siblings, page) {
        const body = el('div.body');
        const list = el('div');

        function draw() {
            K.clear(list);
            const ids = [];
            P.walk(page, n => { if (n.id != null) ids.push(n.id); });

            node.buttons.forEach((b, i) => {
                const sel = el('select', {
                    onchange: e => {
                        b.href = e.target.value;
                        M.setField(node, page, () => { });
                        markDirty(); schedulePreview();
                    }
                }, ids.map(id => el('option', { value: '#' + id, text: '#' + id })));
                if (!ids.includes((b.href || '').slice(1))) {
                    sel.appendChild(el('option', { value: b.href, text: b.href + ' (introuvable)' }));
                }
                sel.value = b.href;

                list.appendChild(el('div.row', { style: 'margin-bottom:6px' }, [
                    el('div.grow', {}, [el('input', {
                        type: 'text', value: b.label,
                        oninput: e => {
                            b.label = e.target.value;
                            M.setField(node, page, () => { });
                            markDirty(); schedulePreview();
                        }
                    })]),
                    el('div.grow', {}, [sel]),
                    el('button.btn.sm.danger', {
                        text: '✕', onclick: () => {
                            node.buttons.splice(i, 1);
                            node.raw = node.raw;      // rendu niveau 3 (nombre change)
                            M.setField(node, page, () => { });
                            node.dirty = true;
                            markDirty(); draw(); schedulePreview();
                        }
                    })
                ]));
            });

            list.appendChild(el('button.btn.sm', {
                text: '+ Ajouter un bouton',
                onclick: () => {
                    const ids2 = [];
                    P.walk(page, n => { if (n.id != null) ids2.push(n.id); });
                    node.buttons.push({ label: 'Nouveau', href: ids2.length ? '#' + ids2[0] : '#' });
                    node.dirty = true;
                    markDirty(); draw(); schedulePreview();
                }
            }));
        }
        draw();
        body.appendChild(list);
        const il = issueLines(node);
        if (il) body.appendChild(il);

        return card('Boutons d\'ancre', node.buttons.length + ' boutons', body, {
            key: node._key, issues: issuesOf(node),
            actions: [removeBtn(node, siblings, page)]
        });
    }

    /* --- grille d'icones de l'index --------------------------------------- */
    function iconsCard(node, siblings, page) {
        const body = el('div.body');
        const list = el('div');

        async function drawRow(l, i) {
            const file = (l.href || '').split('#')[0].replace(/^livrees_pages\//, '');
            const pageSel = el('select', {}, [el('option', { value: '', text: '— page —' })]
                .concat(S.files.map(f => el('option', { value: f, text: f }))));
            pageSel.value = file;

            const anchorSel = el('select');
            async function fillAnchors() {
                K.clear(anchorSel);
                anchorSel.appendChild(el('option', { value: '', text: '— aucune ancre —' }));
                const anchors = pageSel.value ? await X.anchorsOf(pageSel.value) : [];
                for (const a of anchors) {
                    anchorSel.appendChild(el('option', { value: a.id, text: '#' + a.id + ' — ' + a.label }));
                }
                anchorSel.value = (l.href || '').split('#')[1] || '';
            }
            await fillAnchors();

            function apply() {
                l.href = pageSel.value
                    ? 'livrees_pages/' + pageSel.value + (anchorSel.value ? '#' + anchorSel.value : '')
                    : '';
                M.setField(node, page, () => { });
                markDirty(); schedulePreview();
            }
            pageSel.onchange = async () => { await fillAnchors(); apply(); };
            anchorSel.onchange = apply;

            const thumb = el('img', { style: 'height:34px;image-rendering:pixelated' });
            try {
                const fh = await Fs.fileHandle('mltc/' + l.img);
                thumb.src = URL.createObjectURL(await fh.getFile());
            } catch (e) { thumb.replaceWith(el('span.dim', { text: '?' })); }

            return el('div.row', { style: 'margin-bottom:6px;align-items:center' }, [
                el('div', { style: 'width:44px;text-align:center' }, [thumb]),
                el('div.grow', {}, [pageSel]),
                el('div.grow', {}, [anchorSel]),
                el('div.grow', {}, [el('input', {
                    type: 'text', value: l.alt, placeholder: 'texte alternatif',
                    oninput: e => { l.alt = e.target.value; M.setField(node, page, () => { }); markDirty(); }
                })]),
                el('button.btn.sm.danger', {
                    text: '✕', onclick: () => {
                        node.links.splice(i, 1);
                        node.dirty = true;
                        markDirty(); draw(); schedulePreview();
                    }
                })
            ]);
        }

        async function draw() {
            K.clear(list);
            for (let i = 0; i < node.links.length; i++) list.appendChild(await drawRow(node.links[i], i));
            list.appendChild(el('button.btn.sm', {
                text: '+ Ajouter une icône',
                onclick: () => {
                    node.links.push({ href: '', img: 'icones_liv/wip.png', alt: 'Nouvelle livrée' });
                    node.dirty = true;
                    markDirty(); draw(); schedulePreview();
                }
            }));
        }
        draw();
        body.appendChild(list);

        return card('Grille d\'icônes', node.links.length + ' icônes', body, {
            key: node._key, actions: [removeBtn(node, siblings, page)]
        });
    }

    /* --- bloc conserve tel quel ------------------------------------------ */
    function opaqueCard(node, siblings, page) {
        const ta = el('textarea', {
            value: node.raw || '',
            style: 'min-height:130px',
            onchange: e => {
                node.raw = e.target.value;
                node.dirty = false;   // le raw EST la sortie
                page.dirty = true;
                markDirty(); schedulePreview();
            }
        });
        const body = el('div.body', {}, [
            el('p.dim', {
                text: 'Ce bloc n\'est pas reconnu par l\'éditeur : il est réémis exactement '
                    + 'tel quel. Vous pouvez le modifier en HTML brut.',
                style: 'margin-top:0;font-size:12px'
            }),
            ta
        ]);
        const first = (node.raw || '').trim().slice(0, 60).replace(/\s+/g, ' ');
        return card('Bloc conservé tel quel', first + '…', body, {
            key: node._key, opaque: true,
            actions: [removeBtn(node, siblings, page)]
        });
    }

    /* ---------------------------------------------------------------------
       Liste d'engins
       --------------------------------------------------------------------- */
    function listCard(node, siblings, page) {
        const body = el('div.body', { style: 'padding:0' });
        const rows = el('div.englist');
        drawRows();
        body.appendChild(rows);
        body.appendChild(el('div', { style: 'padding:9px' }, [
            el('button.btn.sm', {
                text: '+ Ajouter un engin',
                onclick: async () => {
                    const folder = M.folderOf(node);
                    const pick = await X.pickImage({ folder: folder });
                    const e = M.newEngine(node, page, pick
                        ? { src: pick.src, dataR: pick.dataR, name: guessName(pick.src), alt: guessName(pick.src) }
                        : {});
                    M.insertChild(node, 1e9, e, page);
                    e._key = 'k' + (++keySeq);
                    S.open.add(e._key);          // ouvrir la fiche du nouvel engin
                    markDirty(); renderEditor(); schedulePreview();
                }
            }),
            el('button.btn.sm', {
                text: '+ Séparation',
                style: 'margin-left:6px',
                onclick: () => {
                    M.insertChild(node, 1e9, M.newSep('Nouveau groupe'), page);
                    markDirty(); renderEditor(); schedulePreview();
                }
            }),
            /* Texte intercalé dans la liste, comme le paragraphe qui présente
               le TGV Turboméca Duplex dans xpress.html. */
            el('button.btn.sm', {
                text: '+ Description',
                style: 'margin-left:6px',
                title: 'Paragraphe intercalé entre les engins',
                onclick: () => {
                    const d = M.newListDesc(node, page);
                    M.insertChild(node, 1e9, d, page);
                    d._key = 'k' + (++keySeq);
                    S.open.add(d._key);
                    markDirty(); renderEditor(); schedulePreview();
                }
            })
        ]));

        function drawRows() {
            K.clear(rows);
            const kids = node.children.filter(c => c.type !== 'text' && c.type !== 'comment');
            kids.forEach((c, i) => {
                if (c.type === 'engine') rows.appendChild(engineRow(c, node, page, i, drawRows));
                else {
                    const sub = blockCard(c, node.children, page);
                    if (sub) rows.appendChild(el('div', { style: 'padding:8px 9px 0' }, [sub]));
                }
            });
            if (!kids.length) rows.appendChild(el('div.empty', { text: 'Liste vide' }));
        }

        const count = node.children.filter(c => c.type === 'engine').length;
        return card('Liste d\'engins', count + ' engins', body, {
            key: node._key, open: true,
            actions: [removeBtn(node, siblings, page, 'cette liste')]
        });
    }

    function guessName(src) {
        const base = (src || '').split('/').pop().replace(/\.png$/i, '');
        return base.replace(/^[ABC]-/, '').replace(/^[A-Z]+\d{4}-[ABC]-/, '')
            .replace(/_/g, ' ').trim() || 'Nouvel engin';
    }

    function engineRow(node, list, page, index, redraw) {
        node._key = node._key || ('k' + (++keySeq));
        const isOpen = S.open.has(node._key);
        const is = issuesOf(node);

        const thumb = el('div.thumb');
        const img = el('img', { alt: '' });
        thumb.appendChild(img);
        if (node.img.src) Fs.imageURL(node.img.src).then(u => { if (u) img.src = u; });

        const nm = el('div.nm', { text: node.name || '(sans nom)' });
        const dt = el('div.dt', { text: (node.meta || '').replace(/^Dernière MAJ\s*:\s*/, '') });

        const row = el('div.eng' + (isOpen ? '.open' : '') + (node.dirty ? '.mod' : ''));

        /* Même mécanisme de glissement que les blocs, sur le même conteneur
           (list.children) : engins, séparations et descriptions se
           réordonnent donc librement entre eux. */
        const grip = attachDrag(row, node, list.children, page);

        const head = el('div.head', {}, [
            grip, thumb, nm, dt,
            el('div', { style: 'display:flex;gap:4px' },
                (node.flip ? [K.badge('info', 'R')] : []).concat(
                    is.filter(i => i.level === 'error').length ? [K.badge('error', '!')] : [],
                    is.filter(i => i.level === 'warn').length ? [K.badge('warn', '?')] : []
                ))
        ]);
        head.addEventListener('click', e => {
            if (e.target.closest('.grip')) return;
            if (S.open.has(node._key)) S.open.delete(node._key); else S.open.add(node._key);
            redraw();
        });
        row.appendChild(head);

        if (!isOpen) return row;

        /* --- corps deplie --- */
        const body = el('div.body');

        const nameInput = el('input', {
            type: 'text', value: node.name,
            oninput: e => {
                M.setField(node, page, n => { n.name = e.target.value; });
                nm.textContent = e.target.value || '(sans nom)';
                row.classList.toggle('mod', node.dirty);
                markDirty();
                if (!Pv.pokeEngine($('pv-frame'), page, node, 'name')) schedulePreview();
            }
        });
        const altInput = el('input', {
            type: 'text', value: node.img.alt,
            oninput: e => { M.setField(node, page, n => { n.img.alt = e.target.value; }); markDirty(); }
        });
        const sync = el('button.btn.sm', {
            text: '= nom', title: 'Recopier le nom dans le texte alternatif',
            onclick: () => {
                altInput.value = node.name;
                M.setField(node, page, n => { n.img.alt = n.name; });
                markDirty();
            }
        });

        const hasMeta = el('input', { type: 'checkbox', checked: node.meta != null });
        const metaInput = el('input', {
            type: 'text', value: (node.meta || '').replace(/^Dernière MAJ\s*:\s*/, ''),
            placeholder: 'jj/mm/aaaa',
            disabled: node.meta == null,
            oninput: e => {
                M.setField(node, page, n => { n.meta = 'Dernière MAJ : ' + e.target.value; });
                dt.textContent = e.target.value;
                markDirty();
                if (!Pv.pokeEngine($('pv-frame'), page, node, 'meta')) schedulePreview();
            }
        });
        hasMeta.addEventListener('change', () => {
            if (hasMeta.checked) {
                if (!metaInput.value) metaInput.value = M.todayFR();
                M.setField(node, page, n => { n.meta = 'Dernière MAJ : ' + metaInput.value; });
            } else {
                M.setField(node, page, n => { n.meta = null; });
            }
            metaInput.disabled = !hasMeta.checked;
            dt.textContent = hasMeta.checked ? metaInput.value : '';
            markDirty(); schedulePreview();
        });
        const today = el('button.btn.sm', {
            text: 'aujourd\'hui',
            onclick: () => {
                hasMeta.checked = true; metaInput.disabled = false;
                metaInput.value = M.todayFR();
                M.setField(node, page, n => { n.meta = 'Dernière MAJ : ' + metaInput.value; });
                dt.textContent = metaInput.value;
                markDirty(); schedulePreview();
            }
        });

        /* image */
        const bigImg = el('img', { alt: '' });
        if (node.img.src) Fs.imageURL(node.img.src).then(u => { if (u) bigImg.src = u; });
        const pathTxt = el('div.path', { text: node.img.src || '(aucune image)' });
        const rInfo = el('div.dim', { style: 'font-size:11.5px' });
        function refreshR() {
            rInfo.textContent = node.img.dataR
                ? 'Version retournée : ' + node.img.dataR
                : (Fs.companionR(node.img.src) ? 'Une version _R existe sur le disque' : 'Pas de version retournée');
        }
        refreshR();

        const flipCheck = el('input', { type: 'checkbox', checked: !!node.flip });
        flipCheck.addEventListener('change', () => {
            M.setField(node, page, n => {
                if (flipCheck.checked) {
                    n.img.dataR = n.img.dataR || Fs.companionR(n.img.src);
                    n.flip = n.img.dataR ? { kind: M.flipKindOf(list) } : null;
                    if (!n.img.dataR) K.toast('Aucun fichier _R trouvé pour cette image', 'bad');
                } else {
                    n.img.dataR = null; n.flip = null;
                }
            });
            flipCheck.checked = !!node.flip;
            refreshR(); markDirty(); schedulePreview();
        });

        const pickBtn = el('button.btn.sm', {
            text: 'Choisir…',
            onclick: async () => {
                const before = node.img.src;
                const r = await X.pickImage({ current: node.img.src, folder: M.folderOf(list) });
                if (!r) return;
                const users = Ig.circUsers(before);
                if (users.length && r.src !== before) {
                    const ok = await K.confirm('Image référencée ailleurs',
                        '<p><code>' + before + '</code> est utilisée par <strong>' + users.length
                        + '</strong> composition(s) de <code>circulations.json</code> :</p><ul>'
                        + users.slice(0, 8).map(u => '<li>' + u + '</li>').join('')
                        + (users.length > 8 ? '<li>…</li>' : '')
                        + '</ul><p class="dim">Le changer ici ne casse rien immédiatement — '
                        + 'circulations.json continue de pointer vers le fichier, qui existe toujours. '
                        + 'Mais si vous supprimez ce PNG, l\'animation de train et la page Circulations casseront.</p>',
                        'J\'ai compris, continuer');
                    if (!ok) return;
                }
                M.setField(node, page, n => {
                    n.img.src = r.src;
                    n.img.dataR = r.dataR || null;
                    if (!r.dataR) n.flip = null;
                    else if (!n.flip) n.flip = { kind: M.flipKindOf(list) };
                });
                markDirty(); renderEditor(); schedulePreview();
            }
        });

        const boxTa = el('textarea', {
            value: node.boxHtml,
            placeholder: 'Description affichée à droite (HTML autorisé)',
            oninput: e => {
                M.setField(node, page, n => { n.boxHtml = e.target.value; });
                markDirty();
                if (!Pv.pokeEngine($('pv-frame'), page, node, 'box')) schedulePreview();
            }
        });

        const moveSel = el('select');
        moveSel.appendChild(el('option', { value: '', text: '— déplacer vers… —' }));
        const targets = moveTargets(page, list, node);
        targets.forEach((t, i) => {
            moveSel.appendChild(el('option', { value: String(i), text: t.label }));
        });
        moveSel.onchange = () => {
            if (moveSel.value === '') return;
            const t = targets[parseInt(moveSel.value, 10)];
            const from = node_positionIn(list, node);
            if (t.list === list) M.moveBlock(list, from, t.index, page);
            else M.transferChild(list, from, t.list, t.index, page);
            markDirty(); renderEditor(); schedulePreview();
        };

        body.appendChild(issueLines(node) || el('span'));
        body.appendChild(el('div.row', {}, [
            el('div.grow', {}, [K.field('Nom affiché', nameInput)]),
            el('div.grow', {}, [K.field('Texte alternatif',
                el('div.row', {}, [el('div.grow', {}, [altInput]), sync]))])
        ]));
        body.appendChild(K.field('Date de mise à jour', el('div.row', {}, [
            el('label.check', {}, [hasMeta, 'afficher']),
            el('div.grow', {}, [metaInput]), today
        ])));
        body.appendChild(K.field('Image', el('div', {}, [
            el('div.imgpick', {}, [
                el('div.frame', {}, [bigImg]),
                el('div.grow', {}, [pathTxt, rInfo]),
                pickBtn
            ]),
            el('div', { style: 'margin-top:6px' }, [
                el('label.check', {}, [flipCheck, 'bouton R (image retournable)'])
            ])
        ])));
        body.appendChild(K.field('Description', boxTa));
        body.appendChild(el('div.row', {}, [
            el('div.grow', {}, [moveSel]),
            el('button.btn.sm.danger', {
                text: 'Supprimer cet engin',
                onclick: async () => {
                    if (!await K.confirm('Supprimer l\'engin ?',
                        '<strong>' + (node.name || '(sans nom)') + '</strong> sera retiré de la page.',
                        'Supprimer', true)) return;
                    M.removeChild(list, node_positionIn(list, node), page);
                    markDirty(); renderEditor(); schedulePreview();
                }
            })
        ]));

        row.appendChild(body);
        return row;
    }

    function node_positionIn(list, node) {
        return M.elementPositions(list.children).indexOf(list.children.indexOf(node));
    }

    /* Destinations du menu « Déplacer vers… » : chaque liste de la page, plus
       chacun des groupes qu'y délimitent les séparations. Déplacer « dans »
       une séparation revient à s'insérer juste après elle. */
    function moveTargets(page, current, node) {
        const out = [];
        P.walk(page, n => {
            if (n.type !== 'list') return;
            const label = listLabel(n, page);
            const kids = M.elementPositions(n.children).map(p => n.children[p]);
            const seps = kids.filter(c => c.type === 'sep');

            /* Une liste sans séparation, et qui est déjà la nôtre, n'offre
               aucune destination utile. */
            if (!(n === current && !seps.length)) {
                out.push({
                    list: n, index: 1e9,
                    label: label + (seps.length ? ' › (fin de liste)' : '')
                });
            }
            kids.forEach((c, i) => {
                if (c.type !== 'sep') return;
                /* Déjà juste après cette séparation : rien à proposer. */
                if (n === current && kids[i + 1] === node) return;
                out.push({ list: n, index: i + 1, label: label + ' › ' + c.text });
            });
        });
        return out;
    }

    function listLabel(list, page) {
        let label = 'liste';
        P.walk(page, n => {
            if (!n.children || n.children.indexOf(list) < 0) return;
            const cb = n.children.find(c => c.type === 'catbar');
            if (cb) label = cb.text;
            else if (n.id) label = '#' + n.id;
        });
        return label + ' (' + list.children.filter(c => c.type === 'engine').length + ')';
    }

    /* ---------------------------------------------------------------------
       Barre « ajouter un bloc »
       --------------------------------------------------------------------- */
    function addBlockBar(siblings, page, isRoot, allowed) {
        const kinds = allowed || (isRoot
            ? ['section', 'h2', 'desc', 'btns']
            : ['catbar', 'list', 'desc', 'sep', 'btns', 'section']);
        const labels = {
            section: '+ Section', h2: '+ Titre d\'époque', desc: '+ Description',
            btns: '+ Boutons d\'ancre', catbar: '+ Barre de catégorie',
            list: '+ Liste d\'engins', sep: '+ Séparation', topbar: '+ Titre',
            sub: '+ Sous-titre', icons: '+ Grille d\'icônes'
        };
        return el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:4px' },
            kinds.map(k => el('button.btn.sm', {
                text: labels[k] || ('+ ' + k),
                onclick: () => {
                    const container = isRoot ? null : findContainerOf(page, siblings);
                    const node = makeNode(k, page, container);
                    if (!node) return;
                    if (isRoot) M.appendRootBlock(page, node);
                    else M.insertChild(container, 1e9, node, page);
                    markDirty(); renderEditor(); schedulePreview();
                }
            })));
    }

    function makeNode(kind, page, container) {
        switch (kind) {
            case 'section': return M.newSection(page, 'Nouvelle catégorie');
            case 'h2': return M.newH2(page, 'Nouvelle époque');
            case 'desc': return M.newDesc('<p>À compléter.</p>');
            case 'catbar': return M.newCatbar('Nouvelle catégorie');
            case 'sep': return M.newSep('Nouveau groupe');
            case 'list': return M.newList(container && container.openTagRaw ? '      ' : '      ');
            case 'btns': {
                const n = M.newCatbar('');
                n.type = 'btns'; n.tag = 'div'; n.buttons = [];
                n.openTagRaw = '<div class="lv-btns">'; n.closeTagRaw = '</div>';
                delete n.text;
                n.raw = null; n.dirty = true;
                n._orig = P.snapshot(n);
                return n;
            }
            case 'sub': { const n = M.newSep('Nouveau sous-titre'); n.type = 'sub'; n.tag = 'span'; return n; }
            default: return null;
        }
    }

    /* ---------------------------------------------------------------------
       Enregistrement
       --------------------------------------------------------------------- */
    async function saveCurrent() {
        const page = S.current;
        if (!page || !page.dirty) return;

        S.issues = V.issuesFor(page);
        if (S.issues.blocking) {
            const errs = S.issues.list.filter(i => i.level === 'error');
            K.modal({
                title: 'Enregistrement bloqué',
                body: el('div', {}, [
                    el('p', { text: 'Corrigez ces erreurs avant d\'enregistrer :' }),
                    el('ul', {}, errs.map(e => el('li', { text: e.msg })))
                ]),
                footer: [el('div.spacer')]
            });
            return;
        }

        let out;
        try { out = Ser.build(page); }
        catch (err) { return K.toast('Rendu impossible : ' + err.message, 'bad'); }

        const problems = Ser.verify(page, out);
        if (problems.length) {
            K.modal({
                title: 'Vérification échouée — rien n\'a été écrit',
                body: el('div', {}, [
                    el('p.err', { text: 'Le résultat ne satisfait pas les invariants de sécurité :' }),
                    el('ul', {}, problems.map(p => el('li', { text: p })))
                ]),
                footer: [el('div.spacer')]
            });
            return;
        }

        const diff = D.diffLines(page.originalText, out);
        showDiff(page, out, diff);
    }

    function showDiff(page, out, diff) {
        const rows = D.withContext(diff, page.originalText, out, 3);
        const view = el('div.diff');
        for (const r of rows) {
            if (r === null) { view.appendChild(el('div.fold', { text: '⋯' })); continue; }
            const cls = r.op === '+' ? '.add' : r.op === '-' ? '.del' : '';
            view.appendChild(el('div' + cls, {}, [
                el('span.ln', { text: r.op === '+' ? '+' + r.b : r.op === '-' ? '-' + r.a : ' ' + r.a }),
                r.text.replace(/\r$/, '')
            ]));
        }

        const okBtn = el('button.btn.primary', {
            text: 'Écrire le fichier',
            onclick: async () => {
                m.close();
                await write(page, out);
            }
        });

        const m = K.modal({
            title: 'Modifications de ' + page.path,
            body: el('div', {}, [
                el('p', {
                    html: '<strong class="err">−' + diff.removed + '</strong> / '
                        + '<strong class="ok">+' + diff.added + '</strong> ligne(s)'
                }),
                view
            ]),
            footer: [
                el('div.spacer'),
                el('button.btn', { text: 'Annuler', onclick: () => m.close() }),
                okBtn
            ]
        });
    }

    async function write(page, out) {
        try {
            await Fs.writeText(page.path, out);
        } catch (err) {
            if (err.code === 'STALE') {
                const reload = await K.confirm('Fichier modifié sur le disque',
                    'Le fichier <code>' + page.path + '</code> a changé depuis son ouverture '
                    + '(édité dans VS Code ?).<br><br><strong>Rien n\'a été écrit.</strong> '
                    + 'Voulez-vous le recharger ? Vos modifications en cours seront perdues.',
                    'Recharger', true);
                if (reload) { S.pages.delete(page.path); await openPage(page.path); }
                return;
            }
            K.toast('Écriture impossible : ' + err.message, 'bad');
            return;
        }

        const fresh = P.parse(out, page.path);
        S.pages.set(page.path, fresh);
        S.current = fresh;
        X.forgetAnchors(page.path.split('/').pop());
        Ig.collect().catch(() => { });
        renderEditor();
        K.toast('Enregistré : ' + page.path + ' — vérifiez git diff', 'good');
    }

    async function revertCurrent() {
        const page = S.current;
        if (!page || !page.dirty) return;
        if (!await K.confirm('Annuler les modifications ?',
            'Toutes les modifications non enregistrées de <code>' + page.path
            + '</code> seront perdues.', 'Annuler les modifications', true)) return;
        const fresh = M.revert(page);
        S.pages.set(page.path, fresh);
        S.current = fresh;
        renderEditor();
        schedulePreview();
        K.toast('Modifications annulées');
    }

    /* ---------------------------------------------------------------------
       Auto-test : parse + rebuild de toutes les pages, identite octet a octet
       --------------------------------------------------------------------- */
    async function runAutoTest() {
        const body = el('div');
        const m = K.modal({ title: 'Auto-test — fidélité de lecture/écriture', body: body });
        body.appendChild(el('p.dim', {
            text: 'Chaque page est analysée puis réécrite sans aucune modification. '
                + 'Le résultat doit être identique à l\'octet près.'
        }));
        const tbl = el('table.rep', {}, [el('thead', {}, [el('tr', {}, [
            el('th', { text: 'Fichier' }), el('th', { text: 'Résultat' }),
            el('th', { text: 'Engins' }), el('th', { text: 'Sections' }), el('th', { text: 'Détail' })
        ])])]);
        const tb = el('tbody');
        tbl.appendChild(tb);
        body.appendChild(tbl);
        const summary = el('p');
        body.appendChild(summary);

        const paths = [INDEX_PAGE].concat(S.files.map(f => DIR + '/' + f));
        let ok = 0, bad = 0;
        for (const path of paths) {
            let cls = 'ok', label = 'identique', detail = '', eng = '', sec = '';
            try {
                const text = await Fs.readText(path);
                const page = P.parse(text, path);
                if (page.readOnly) { cls = 'err'; label = 'non analysable'; detail = page.parseError; }
                else {
                    eng = page.engineCount; sec = page.sectionCount;
                    const out = Ser.build(page);
                    if (out !== text) {
                        cls = 'err'; label = 'DIVERGENCE';
                        let i = 0;
                        while (i < Math.min(out.length, text.length) && out[i] === text[i]) i++;
                        detail = 'ligne ' + (text.slice(0, i).split('\n').length);
                    }
                }
            } catch (err) { cls = 'err'; label = 'erreur'; detail = err.message; }
            if (cls === 'ok') ok++; else bad++;
            tb.appendChild(el('tr', {}, [
                el('td.mono', { text: path.split('/').pop() }),
                el('td', {}, [el('span.' + cls, { text: label })]),
                el('td', { text: String(eng) }), el('td', { text: String(sec) }),
                el('td.dim', { text: detail })
            ]));
        }
        summary.innerHTML = bad === 0
            ? '<strong class="ok">' + ok + '/' + (ok + bad) + ' — aucune divergence.</strong> '
              + '<span class="dim">L\'éditeur peut réécrire ces pages sans effet de bord.</span>'
            : '<strong class="err">' + bad + ' divergence(s).</strong> '
              + '<span class="dim">N\'enregistrez rien tant que ce n\'est pas corrigé.</span>';
    }

    /* ---------------------------------------------------------------------
       Onglet integrite
       --------------------------------------------------------------------- */
    async function showIntegrity() {
        const body = el('div', {}, [el('p.dim', { text: 'Analyse…' })]);
        const m = K.modal({ title: 'Intégrité inter-fichiers', body: body });

        await Ig.collect();
        const r = Ig.report();
        K.clear(body);

        body.appendChild(el('p.dim', {
            text: 'Ces contrôles sont en lecture seule : l\'outil n\'écrit jamais '
                + 'circulations.json ni services-page.js, il se contente d\'avertir.'
        }));
        body.appendChild(el('p', {
            html: r.counts.total + ' images sur le disque · ' + r.counts.used + ' utilisées par les pages · '
                + r.counts.circ + ' référencées par circulations.json · '
                + r.counts.liveries + ' liens depuis services-page.js · '
                + r.counts.indexLinks + ' icônes sur livrees.html'
        }));

        section('Erreurs dures', r.circMissing.map(p =>
            'circulations.json référence ' + p + ' — fichier absent du disque (casse train-anim.js)')
            .concat(r.badLiveries.map(l => 'services-page.js pointe vers ' + l + ' — page inexistante'))
            .concat(r.badIndex.map(l => 'livrees.html pointe vers ' + l.href + ' — page inexistante'))
            .concat(r.errors), 'err');

        section('Pages sans engin (squelettes)',
            r.skeletons.map(p => p.file), 'dim');

        section('Images orphelines (' + r.orphans.length + ')',
            r.orphans.slice(0, 200), 'dim',
            'Présentes sur le disque mais référencées ni par une page ni par circulations.json. '
            + 'Purement informatif.');

        function section(title, items, cls, hint) {
            body.appendChild(el('h3', { text: title, style: 'margin:16px 0 4px' }));
            if (hint) body.appendChild(el('p.dim', { text: hint, style: 'font-size:12px;margin:0 0 6px' }));
            if (!items.length) { body.appendChild(el('p.ok', { text: 'Rien à signaler.' })); return; }
            body.appendChild(el('ul', { style: 'margin:0' },
                items.map(i => el('li', {}, [el('span.' + cls, { text: String(i) })]))));
        }
    }

    /* ---------------------------------------------------------------------
       Onglet Nouveautes : edition manuelle du bloc "Dernieres nouveautes"
       de livrees.html (voir js/recent.js pour la lecture/ecriture du bloc).
       Formulaire libre, sans detection automatique : chaque champ est tape
       ou choisi a la main, dans l'esprit du reste de l'outil.
       --------------------------------------------------------------------- */
    async function showRecent() {
        const openIndex = S.pages.get(Rc.INDEX_PAGE);
        if (openIndex && openIndex.dirty) {
            return K.toast('Enregistrez ou annulez d\'abord vos modifications en cours sur livrees.html.', 'bad');
        }

        let loaded;
        try { loaded = await Rc.loadItems(); }
        catch (err) { return K.toast(err.message, 'bad'); }

        const rows = loaded.items.map(it => Object.assign({}, it));
        const tb = el('tbody');

        function fieldInput(value, ph, onInput) {
            const inp = el('input', { type: 'text', value: value || '', placeholder: ph || '' });
            inp.addEventListener('input', () => onInput(inp.value));
            return inp;
        }

        function renderRows() {
            K.clear(tb);
            rows.forEach((it, i) => {
                const thumb = el('img', {
                    src: '', alt: '', style: 'width:44px;height:30px;object-fit:cover;background:var(--bg3);cursor:pointer;display:block'
                });
                if (it.img) Fs.imageURL(it.img.replace(/^livrees_pages\//, '')).then(u => { if (u) thumb.src = u; });
                thumb.addEventListener('click', async () => {
                    const r = await X.pickImage({ current: (it.img || '').replace(/^livrees_pages\//, '') });
                    if (!r) return;
                    it.img = r.src ? 'livrees_pages/' + r.src : '';
                    renderRows();
                });

                const sel = el('select', {}, [
                    el('option', { value: 'new', text: 'Nouveauté', selected: it.status === 'new' }),
                    el('option', { value: 'update', text: 'Modification', selected: it.status === 'update' })
                ]);
                sel.addEventListener('change', () => { it.status = sel.value; });

                tb.appendChild(el('tr', {}, [
                    el('td', {}, [thumb]),
                    el('td', {}, [fieldInput(it.name, 'Nom', v => it.name = v)]),
                    el('td', {}, [fieldInput(it.meta, 'Page · date', v => it.meta = v)]),
                    el('td', {}, [fieldInput(it.href, 'livrees_pages/…', v => it.href = v)]),
                    el('td', {}, [sel]),
                    el('td', { style: 'white-space:nowrap' }, [
                        el('button.btn.sm', { text: '↑', disabled: i === 0, onclick: () => { rows.splice(i - 1, 0, rows.splice(i, 1)[0]); renderRows(); } }),
                        el('button.btn.sm', { text: '↓', disabled: i === rows.length - 1, onclick: () => { rows.splice(i + 1, 0, rows.splice(i, 1)[0]); renderRows(); } }),
                        el('button.btn.sm.danger', { text: '×', onclick: () => { rows.splice(i, 1); renderRows(); } })
                    ])
                ]));
            });
        }
        renderRows();

        const m = K.modal({
            title: 'Dernières nouveautés',
            width: '900px',
            body: el('div', {}, [
                el('p.dim', {
                    text: 'Édition manuelle du bloc affiché en haut de livrees.html. Le champ « Page · date » est '
                        + 'le texte affiché tel quel (ex. « Services urbains · 13 septembre 2026 »). Cliquez sur la '
                        + 'vignette pour choisir l\'image.'
                }),
                el('table.rep', {}, [
                    el('thead', {}, [el('tr', {}, [
                        el('th', { text: 'Image' }), el('th', { text: 'Nom' }), el('th', { text: 'Page · date' }),
                        el('th', { text: 'Lien' }), el('th', { text: 'Statut' }), el('th', { text: '' })
                    ])]),
                    tb
                ]),
                el('div', { style: 'margin-top:10px' }, [
                    el('button.btn.sm', {
                        text: '+ Ajouter une entrée',
                        onclick: () => { rows.push({ img: '', name: '', meta: '', href: '', status: 'new' }); renderRows(); }
                    })
                ])
            ]),
            footer: [
                el('div.spacer'),
                el('button.btn', { text: 'Annuler', onclick: () => m.close() }),
                el('button.btn.primary', {
                    text: 'Prévisualiser le diff',
                    onclick: () => {
                        let after;
                        try { after = Rc.applyItems(loaded.text, rows); }
                        catch (err) { return K.toast(err.message, 'bad'); }
                        m.close();
                        showRecentDiff(loaded.text, after);
                    }
                })
            ]
        });
    }

    function showRecentDiff(before, after) {
        const diff = D.diffLines(before, after);
        const rowsD = D.withContext(diff, before, after, 3);
        const view = el('div.diff');
        for (const r of rowsD) {
            if (r === null) { view.appendChild(el('div.fold', { text: '⋯' })); continue; }
            const cls = r.op === '+' ? '.add' : r.op === '-' ? '.del' : '';
            view.appendChild(el('div' + cls, {}, [
                el('span.ln', { text: r.op === '+' ? '+' + r.b : r.op === '-' ? '-' + r.a : ' ' + r.a }),
                r.text.replace(/\r$/, '')
            ]));
        }

        const m = K.modal({
            title: 'Modifications de ' + Rc.INDEX_PAGE,
            body: el('div', {}, [
                el('p', { html: '<strong class="err">−' + diff.removed + '</strong> / <strong class="ok">+' + diff.added + '</strong> ligne(s)' }),
                view
            ]),
            footer: [
                el('div.spacer'),
                el('button.btn', { text: 'Annuler', onclick: () => m.close() }),
                el('button.btn.primary', {
                    text: 'Écrire',
                    onclick: async () => {
                        try { await Fs.writeText(Rc.INDEX_PAGE, after); }
                        catch (err) { m.close(); return K.toast('Écriture impossible : ' + err.message, 'bad'); }
                        m.close();
                        K.toast('livrees.html mis à jour.');
                        /* La copie en memoire de livrees.html, si l'onglet est
                           ouvert, ne connait pas cette ecriture directe sur
                           disque : on la purge pour forcer une relecture au
                           prochain acces, plutot que de risquer un futur
                           "Enregistrer" qui reecrirait par-dessus l'ancien bloc. */
                        if (S.pages.has(Rc.INDEX_PAGE)) {
                            const wasCurrent = S.current && S.current.path === Rc.INDEX_PAGE;
                            S.pages.delete(Rc.INDEX_PAGE);
                            if (wasCurrent) await openPage(Rc.INDEX_PAGE); else drawRail();
                        }
                    }
                })
            ]
        });
    }

    boot();
})();
