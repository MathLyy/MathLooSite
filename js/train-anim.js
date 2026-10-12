/* ========================================
   Bandeau animé : des rames passent une à une,
   de droite à gauche, sur une voie.

   Options (attributs data-* du conteneur) :
     data-base     préfixe vers la racine du site
     data-source   fichier JSON de compositions, relatif à la
                   racine (sans lui : mltc/data/circulations.js,
                   lu par js/compositions.js, à charger avant
                   ce script)
     data-group    clé d'un groupe de compositions dans ce
                   fichier ({ "groupe": [compositions] })
     data-order    "sequence" pour garder l'ordre du fichier
                   (défaut : ordre aléatoire)
     data-caption  id d'un élément qui affiche le nom de la
                   composition en cours

   Avec le fichier des circulations, chaque passage tire une
   rame au hasard ; avec data-caption, seuls les trains qui
   ont un nom ou un trajet passent.
   ======================================== */

(function () {
    const container = document.getElementById('train-animation-container');
    if (!container) return;

    /* ---- Réglages ---- */
    const SPEED         = 280;         // px/s, vitesse constante
    const GAP_MIN_MS    = 2000;        // intervalle minimal entre deux trains
    const GAP_MAX_MS    = 5000;        // intervalle maximal
    const FRAME_H       = 68;          // hauteur du cadre (comme sur la carte Circulations)
    const TRACK_H       = 8;           // hauteur de la voie

    const base    = container.dataset.base || '';
    const source  = container.dataset.source || '';
    const group   = container.dataset.group || '';
    const inOrder = container.dataset.order === 'sequence';
    const caption = container.dataset.caption ? document.getElementById(container.dataset.caption) : null;

    /* ---- État ---- */
    let compositions = [];
    let compIndex = 0;
    let trainWrap = null;
    let circData = null;          // fichier des circulations (clé "services")

    function randBetween(a, b) { return a + Math.random() * (b - a); }

    /* ---- Structure ---- */
    function buildDOM() {
        container.style.position  = 'relative';
        container.style.width     = '100%';
        container.style.height    = FRAME_H + 'px';
        container.style.overflow  = 'hidden';
        container.style.pointerEvents = 'none';

        /* Voie, en bas du cadre */
        const track = document.createElement('div');
        track.style.cssText =
            `position:absolute;bottom:0;left:0;width:100%;height:${TRACK_H}px;` +
            `background:url(${base}mltc/assets/1-Voie_Bois.png) repeat-x left center;` +
            `background-size:auto ${TRACK_H}px;image-rendering:pixelated;z-index:2;`;
        container.appendChild(track);

        /* Conteneur de la rame */
        trainWrap = document.createElement('div');
        trainWrap.style.cssText =
            'position:absolute;bottom:' + TRACK_H + 'px;left:0;' +
            'display:flex;align-items:flex-end;white-space:nowrap;' +
            'will-change:transform;z-index:1;';
        container.appendChild(trainWrap);
    }

    /* ---- Chargement des compositions ---- */
    async function loadCompositions() {
        try {
            if (source) {
                const res  = await fetch(base + source);
                const data = await res.json();
                compositions = (group ? data[group] || [] : []).slice();
            } else {
                const Compo = window.MltcCompo;
                if (!Compo) {
                    console.warn('[TrainAnim] js/compositions.js doit être chargé avant train-anim.js');
                    return;
                }
                circData = await Compo.load(base);
                compositions = Compo.trains(circData)
                    .filter(e => !Compo.isHistoric(circData, e.service))
                    .filter(e => Array.isArray(e.train.composition) && e.train.composition.length)
                    .filter(e => !caption || Compo.label(e.train))
                    .map(e => ({ entry: e }));
            }
            /* Mélange (sauf data-order="sequence") */
            for (let i = inOrder ? 0 : compositions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [compositions[i], compositions[j]] = [compositions[j], compositions[i]];
            }
        } catch (e) {
            console.warn('[TrainAnim] chargement impossible : ' + (source || 'mltc/data/circulations.js'), e);
        }
    }

    /* Train du fichier des circulations : rame tirée au hasard, vue dans
       le sens gauche (le bandeau défile vers la gauche). */
    function fromEntry(e) {
        const Compo = window.MltcCompo;
        const cfg = Compo.scenario(circData, e.service, e.train, 0);
        const label = Compo.label(cfg);
        return {
            name: label ? e.service + ' · ' + label : e.service,
            detail: cfg.detail || '',
            items: Compo.resolve(cfg.composition, { direction: 'L' })
        };
    }

    /* ---- Images de la rame (même logique que circulations.js) ---- */
    function buildTrain(comp) {
        trainWrap.innerHTML = '';
        if (comp.items) {
            const total = comp.items.length;
            comp.items.forEach((v, i) => {
                const img = document.createElement('img');
                img.draggable = false;
                img.src = base + v.src;
                img.style.cssText =
                    'display:block;max-width:none;image-rendering:pixelated;' +
                    'user-select:none;-webkit-user-drag:none;pointer-events:none;position:relative;' +
                    (v.coupler
                        ? `z-index:${total + 1};margin-bottom:${v.bottom}px;margin-left:-${v.overlap}px;margin-right:-${v.overlap}px;`
                        : `z-index:${total - i};`);
                trainWrap.appendChild(img);
            });
            return;
        }
        const vehicles = comp.vehicles || (comp.img ? [comp.img] : []);
        const total = vehicles.length;

        vehicles.forEach((v, i) => {
            const img = document.createElement('img');
            img.draggable = false;

            const baseStyle =
                'display:block;max-width:none;image-rendering:pixelated;' +
                'user-select:none;-webkit-user-drag:none;pointer-events:none;position:relative;';

            if (typeof v === 'string') {
                const z = total - i;
                img.src = base + 'mltc/' + v;
                img.style.cssText = baseStyle + `z-index:${z};`;
            } else if (v && v.coupler) {
                const mb = typeof v.bottom  === 'number' ? v.bottom  : 7;
                const ol = typeof v.overlap === 'number' ? v.overlap : 3;
                const z  = total + 1;
                img.src = base + 'mltc/' + v.coupler;
                img.style.cssText = baseStyle +
                    `z-index:${z};margin-bottom:${mb}px;margin-left:-${ol}px;margin-right:-${ol}px;`;
            } else if (v && v.src) {
                const z = total - i;
                const flip = v.flip ? 'transform:scaleX(-1);' : '';
                img.src = base + 'mltc/' + v.src;
                img.style.cssText = baseStyle + `z-index:${z};${flip}`;
            }

            trainWrap.appendChild(img);
        });
    }

    /* ---- Passage d'une rame ---- */
    function runComposition() {
        if (!compositions.length) return;

        const next = compositions[compIndex];
        const comp = next.entry ? fromEntry(next.entry) : next;
        compIndex = (compIndex + 1) % compositions.length;

        buildTrain(comp);
        if (caption) caption.textContent = comp.detail ? comp.name + ' · ' + comp.detail : comp.name;

        /* Attendre le chargement de toutes les images */
        const imgs  = trainWrap.querySelectorAll('img');
        let loaded  = 0;
        const total = imgs.length;
        const onReady = () => { if (++loaded >= total) startMotion(); };
        imgs.forEach(im => {
            if (im.complete && im.naturalWidth > 0) onReady();
            else { im.onload = onReady; im.onerror = onReady; }
        });
        if (total === 0) scheduleNext();
    }

    function scheduleNext() {
        setTimeout(runComposition, randBetween(GAP_MIN_MS, GAP_MAX_MS));
    }

    /* ---- Déplacement, de droite à gauche ---- */
    function startMotion() {
        const trainW = trainWrap.scrollWidth;
        const contW  = container.offsetWidth;

        /* Départ hors cadre à droite, arrivée hors cadre à gauche */
        const startX = contW + 10;
        const exitX  = -trainW - 10;

        let pos  = startX;
        let last = null;

        function frame(ts) {
            if (!last) last = ts;
            const dt = Math.min((ts - last) / 1000, 0.05);
            last = ts;

            pos -= SPEED * dt;

            if (pos < exitX) {
                scheduleNext();
                return;
            }

            trainWrap.style.transform = `translateX(${pos}px)`;
            requestAnimationFrame(frame);
        }

        requestAnimationFrame(frame);
    }

    /* ---- Lancement ---- */
    buildDOM();
    loadCompositions().then(() => {
        if (compositions.length) setTimeout(runComposition, 1500);
    });
})();
