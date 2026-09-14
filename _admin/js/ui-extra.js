/* =========================================================================
   ui-extra.js — Selecteur d'images, assistant « nouvelle page »,
   enumeration des ancres d'une page cible.
   ========================================================================= */
(function () {
    'use strict';

    const K = window.LvKit, el = K.el;
    const Fs = window.LvFs;
    const P = window.LvParse;

    /* ---------------------------------------------------------------------
       Selecteur d'images
       Les fichiers _R sont masques de la grille : ils apparaissent comme un
       badge « ↔ R » sur leur image de base, et sont repris automatiquement
       dans data-r a la selection.
       --------------------------------------------------------------------- */
    function pickImage(opts) {
        opts = opts || {};
        return new Promise(resolve => {
            const index = Fs.images();
            if (!index) {
                K.toast('Index des images non construit — reconnectez le dossier', 'bad');
                return resolve(null);
            }

            let done = false;
            let folder = opts.folder && index.has(opts.folder)
                ? opts.folder
                : (opts.current && /^livrees_img\/([^/]+)\//.exec(opts.current) || [])[1]
                || index.keys().next().value;
            let selected = opts.current || null;

            const folders = el('div.folders');
            const grid = el('div.grid');
            const search = el('input', { type: 'text', placeholder: 'Filtrer…' });
            const info = el('div.dim', { style: 'font-size:11.5px' });

            const io = new IntersectionObserver(entries => {
                for (const e of entries) {
                    if (!e.isIntersecting) continue;
                    const img = e.target;
                    io.unobserve(img);
                    Fs.imageURL(img.dataset.rel).then(u => { if (u) img.src = u; });
                }
            }, { root: grid, rootMargin: '160px' });

            function drawFolders() {
                K.clear(folders);
                for (const [name, files] of index) {
                    const visible = files.filter(f => !/_R\.png$/i.test(f.name)).length;
                    folders.appendChild(el('button' + (name === folder ? '.active' : ''), {
                        onclick: () => { folder = name; drawFolders(); drawGrid(); }
                    }, [name + ' ', el('span.n', { text: visible })]));
                }
            }

            function drawGrid() {
                K.clear(grid);
                const q = search.value.trim().toLowerCase();
                const files = (index.get(folder) || []).filter(f => !/_R\.png$/i.test(f.name));
                const shown = q ? files.filter(f => f.name.toLowerCase().includes(q)) : files;
                info.textContent = shown.length + ' image(s) — dossier ' + folder;

                if (!shown.length) {
                    grid.appendChild(el('div.empty', { text: 'Aucune image' }));
                    return;
                }
                for (const f of shown) {
                    const hasR = !!Fs.companionR(f.rel);
                    const img = el('img', { alt: '', dataset: { rel: f.rel } });
                    const item = el('div.item' + (f.rel === selected ? '.sel' : ''), {
                        onclick: () => {
                            selected = f.rel;
                            grid.querySelectorAll('.item.sel').forEach(x => x.classList.remove('sel'));
                            item.classList.add('sel');
                        },
                        ondblclick: () => choose()
                    }, [
                        el('div.fr', {}, [img]),
                        el('div.nm', { text: f.name, title: f.name }),
                        el('div.tags', {}, [
                            hasR ? K.badge('info', '↔ R') : null,
                            el('span.badge.dimtag', { text: '', style: 'display:none' })
                        ])
                    ]);
                    /* Avertissement hauteur non canonique (58 px). */
                    img.addEventListener('load', () => {
                        if (img.naturalHeight && img.naturalHeight !== window.LvValidate.SPRITE_H) {
                            item.querySelector('.tags').appendChild(
                                K.badge('warn', img.naturalHeight + ' px'));
                        }
                    });
                    io.observe(img);
                    grid.appendChild(item);
                }
            }

            function choose() {
                if (!selected) return;
                done = true;
                io.disconnect();
                m.close();
                resolve({ src: selected, dataR: Fs.companionR(selected) });
            }

            search.addEventListener('input', drawGrid);

            const m = K.modal({
                title: 'Choisir une image',
                onclose: () => { if (!done) { io.disconnect(); resolve(null); } },
                body: el('div', {}, [
                    el('div.row', { style: 'margin-bottom:10px' }, [
                        el('div.grow', {}, [search]), info
                    ]),
                    el('div.pick', {}, [folders, grid])
                ]),
                footer: [
                    el('div.dim', {
                        text: 'Double-clic pour valider. Les variantes _R sont détectées automatiquement.',
                        style: 'font-size:12px'
                    }),
                    el('div.spacer'),
                    opts.current ? el('button.btn.danger', {
                        text: 'Retirer l\'image',
                        onclick: () => { done = true; io.disconnect(); m.close(); resolve({ src: '', dataR: null }); }
                    }) : null,
                    el('button.btn.primary', { text: 'Choisir', onclick: choose })
                ]
            });

            drawFolders();
            drawGrid();
            search.focus();
        });
    }

    /* ---------------------------------------------------------------------
       Ancres disponibles dans une page cible (pour les liens de l'index)
       --------------------------------------------------------------------- */
    const anchorCache = new Map();
    async function anchorsOf(relPath) {
        if (anchorCache.has(relPath)) return anchorCache.get(relPath);
        let out = [];
        try {
            const page = P.parse(await Fs.readText('mltc/livrees_pages/' + relPath), relPath);
            if (!page.readOnly) {
                P.walk(page, n => {
                    if (n.id == null) return;
                    let label = n.id;
                    if (n.type === 'h2' && n.text) label = n.text;
                    else if (n.children) {
                        const cb = n.children.find(c => c.type === 'catbar');
                        if (cb) label = cb.text;
                    }
                    out.push({ id: n.id, label: label });
                });
            }
        } catch (e) { /* page absente */ }
        anchorCache.set(relPath, out);
        return out;
    }
    function forgetAnchors(relPath) {
        if (relPath) anchorCache.delete(relPath); else anchorCache.clear();
    }

    /* ---------------------------------------------------------------------
       Assistant « nouvelle page »
       Le boilerplate est decoupe dans boreale.html a l'execution : les
       classes `active` de la navbar et du sous-menu y sont correctes, et
       le head/footer ne peut jamais diverger des vraies pages.
       --------------------------------------------------------------------- */
    const DONOR = 'mltc/livrees_pages/boreale.html';

    async function createPage(fields) {
        const donor = await Fs.readText(DONOR);
        const head = donor.slice(0, donor.indexOf('<main'));
        const tail = donor.slice(donor.indexOf('</main>'));
        const esc = window.LvSer.esc, escAttr = window.LvSer.escAttr;

        const title = fields.title || fields.topbar;
        const newHead = head.replace(/<title>[^<]*<\/title>/,
            '<title>' + esc(title) + ' - Livrées | MathLoo</title>');

        const cls = 'lv-page' + (fields.theme ? ' ' + fields.theme : '');
        const NL = '\r\n';
        const body = NL + '<div class="lv-wrap">'
            + NL + '      <div class="lv-topbar">' + esc(fields.topbar) + '</div>'
            + (fields.desc ? NL + '      <p class="lv-desc">' + esc(fields.desc) + '</p>' : '')
            + NL + '      <div class="lv-btns">'
            + NL + '      </div>'
            + NL + '    </div>'
            + NL + '    ';

        const text = newHead + '<main class="' + escAttr(cls) + '">' + body + tail;
        const path = 'mltc/livrees_pages/' + fields.slug + '.html';
        if (await Fs.exists(path)) throw new Error('Le fichier ' + fields.slug + '.html existe déjà');
        await Fs.writeText(path, text, { create: true, force: true });
        return path;
    }

    function newPageWizard(onCreated) {
        const slug = el('input', { type: 'text', placeholder: 'ma-livree' });
        const topbar = el('input', { type: 'text', placeholder: 'Ma Livrée' });
        const title = el('input', { type: 'text', placeholder: '(par défaut : le titre affiché)' });
        const desc = el('textarea', { placeholder: 'Description affichée sous le titre (facultatif)' });
        const theme = el('select', {}, [
            el('option', { value: '', text: 'Aucun (violet par défaut)' }),
            el('option', { value: 'lv-theme-red', text: 'Rouge (comme MLCC)' }),
            el('option', { value: 'lv-theme-orange', text: 'Orange (comme SanGo!)' }),
            el('option', { value: 'lv-theme-cfp', text: 'CFP' })
        ]);
        const status = el('div.dim', { style: 'font-size:12px' });

        topbar.addEventListener('input', () => {
            if (!slug.dataset.touched) slug.value = window.LvModel.slugify(topbar.value);
        });
        slug.addEventListener('input', () => { slug.dataset.touched = '1'; });

        async function go() {
            if (!slug.value.trim() || !topbar.value.trim()) {
                status.textContent = 'Le slug et le titre affiché sont obligatoires.';
                return;
            }
            status.textContent = 'Création…';
            try {
                const path = await createPage({
                    slug: window.LvModel.slugify(slug.value),
                    topbar: topbar.value.trim(),
                    title: title.value.trim() || topbar.value.trim(),
                    desc: desc.value.trim(),
                    theme: theme.value
                });
                m.close();
                K.toast('Page créée : ' + path, 'good');
                if (onCreated) onCreated(path);
            } catch (err) {
                status.textContent = 'Échec : ' + err.message;
            }
        }

        const m = K.modal({
            title: 'Nouvelle page de livrée',
            width: '620px',
            body: el('div', {}, [
                el('p.dim', {
                    text: 'Le head, la navbar, le sous-menu et le footer sont repris tels quels '
                        + 'depuis boreale.html — ils ne peuvent donc pas diverger des autres pages.',
                    style: 'margin-top:0;font-size:12.5px'
                }),
                K.field('Nom du fichier (slug)', slug, 'Donnera mltc/livrees_pages/<slug>.html'),
                K.field('Titre affiché (lv-topbar)', topbar),
                K.field('Titre de l\'onglet', title),
                K.field('Description', desc),
                K.field('Thème de couleur', theme),
                status
            ]),
            footer: [
                el('div.spacer'),
                el('button.btn', { text: 'Annuler', onclick: () => m.close() }),
                el('button.btn.primary', { text: 'Créer la page', onclick: go })
            ]
        });
        topbar.focus();
    }

    window.LvExtra = {
        pickImage: pickImage,
        anchorsOf: anchorsOf,
        forgetAnchors: forgetAnchors,
        newPageWizard: newPageWizard,
        createPage: createPage
    };
})();
