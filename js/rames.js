/* ═══════════════════════════════════════════════════
   MLTC - Trafic : les trains de mltc/data/circulations.js
   circulent sur des voies superposées (canvas).

   Moteur repris de MathLooTraffic : freinage et accélération,
   arrêts, changements de locomotive, dételages et attelages,
   départ en sens inverse, trains d'arrière-plan. Les images
   sont chargées à la demande, train par train.

   Nommé rames.js et non trafic.js : la règle « /trafic.js »
   d'EasyPrivacy (uBlock Origin, Adblock) bloque ce nom de
   fichier sur tous les sites servis en http.
   ═══════════════════════════════════════════════════ */

(function () {
    'use strict';

    const Compo  = window.MltcCompo;
    const stage  = document.getElementById('trafic-stage');
    const canvas = document.getElementById('trafic-canvas');
    if (!Compo || !stage || !canvas) return;
    const ctx = canvas.getContext('2d');

    /* ---- Réglages (repris de MathLooTraffic) ---- */
    const BASE = '../';                       // racine du site depuis mltc/
    const PIXELS_PER_METER = 10;
    const KMH_TO_PX_S = 0.27778 * PIXELS_PER_METER;
    const TRACK_OFFSET_Y = 8;                 // les roues mordent sur la voie
    const BG_LABEL_ALPHA = 0.5;               // intitulé du fond, à côté de celui du principal
    const BG_TRAIN_DIM = 0.5;                // train d'arrière-plan assombri (opaque), pour la profondeur
    const THIRD_RAIL_DIM = 0.45;              // troisième rail assombri (opaque)
    const WIRE_COLOR = '#646464';
    const TRACKS = {
        'voie_bois.png': 'mltc/assets/voies/voie_bois.png',
        'voie_beton.png': 'mltc/assets/voies/voie_beton.png'
    };
    const DEFAULT_TRACK = 'voie_bois.png';
    const TOP_SPACE = 70;                     // au-dessus de la voie la plus haute
    const LABEL_SPACE = 24;                   // libellé sous la voie la plus basse
    const TRACKS_MIN = 1, TRACKS_MAX = 10;
    const SERVICE_COLORS = { 'SanGo!': '#ff9a85', 'CFP': '#ff7a8a' };
    const SERVICE_COLOR = '#b794ff';

    /* ---- Utilitaires ---- */
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function randFloat(min, max) { return Math.random() * (max - min) + min; }

    /* Position "50%" : le centre du train tombe à 50 % de la largeur ;
       un nombre est la position du bord avant, en pixels. */
    function resolveAnchoredPosition(raw, screenWidth, trainWidth, direction) {
        if (typeof raw === 'string' && raw.trim().endsWith('%')) {
            const centerX = parseFloat(raw) / 100 * screenWidth;
            return direction === 'R' ? centerX + trainWidth / 2 : centerX - trainWidth / 2;
        }
        return raw;
    }

    /* ---- Images, chargées une fois à la demande ---- */
    const loads = new Map();    // src -> Promise
    const images = new Map();   // src -> image chargée
    function load(src) {
        if (!loads.has(src)) {
            loads.set(src, new Promise(resolve => {
                const im = new Image();
                im.onload = () => { images.set(src, im); resolve(im); };
                im.onerror = () => {
                    console.warn('[Trafic] image introuvable : ' + src);
                    resolve(null);
                };
                im.src = BASE + src;
            }));
        }
        return loads.get(src);
    }

    /* Éléments résolus { src, coupler, overlap, bottom } -> véhicules dessinables. */
    function toVehicles(list) {
        const out = [];
        list.forEach(it => {
            const im = images.get(it.src);
            if (im) out.push({ img: im, coupler: !!it.coupler, overlap: it.overlap || 0, bottom: it.bottom || 0 });
        });
        return out;
    }
    /* Un attelage chevauche ses deux voisins : il n'allonge la rame que de sa partie visible. */
    function vw(v) { return v.coupler ? v.img.width - 2 * v.overlap : v.img.width; }
    function groupWidth(list) { return list.reduce((s, v) => s + vw(v), 0); }

    /* ---- Dessin ---- */
    let W = 0, H = 0, dpr = 1;
    let FONT = 'sans-serif';

    function blit(im, x, y) {
        ctx.drawImage(im, Math.round(x * dpr) / dpr, Math.round(y * dpr) / dpr);
    }

    /* Copie de l'image assombrie de `dim` (0 à 1), en gardant sa silhouette.
       Dessinée opaque, elle donne l'impression de profondeur d'une
       transparence sur fond noir, sans laisser voir ce qui est derrière
       (caténaire, bâtiment). Mise en cache par image et par valeur. */
    const dimCache = new WeakMap();
    function dimmed(im, dim) {
        if (!dim) return im;
        let byDim = dimCache.get(im);
        if (!byDim) { byDim = new Map(); dimCache.set(im, byDim); }
        let c = byDim.get(dim);
        if (!c) {
            c = document.createElement('canvas');
            c.width = im.width; c.height = im.height;
            const g = c.getContext('2d');
            g.drawImage(im, 0, 0);
            g.globalCompositeOperation = 'source-atop';
            g.fillStyle = 'rgba(0,0,0,' + dim + ')';
            g.fillRect(0, 0, c.width, c.height);
            byDim.set(dim, c);
        }
        return c;
    }

    /* Suite de véhicules, la tête (indice 0) à droite si headRight.
       Les attelages sont dessinés par-dessus. */
    function drawGroup(list, x, headRight, groundY, dim) {
        const couplers = [];
        let drawX = headRight ? x + groupWidth(list) : x;
        list.forEach(v => {
            const w = vw(v);
            let left;
            if (headRight) { drawX -= w; left = drawX; }
            else { left = drawX; drawX += w; }
            if (v.coupler) couplers.push([v, left - v.overlap]);
            else blit(dimmed(v.img, dim), left, groundY - v.img.height);
        });
        couplers.forEach(([v, left]) => blit(dimmed(v.img, dim), left, groundY - v.img.height - v.bottom));
    }

    /* ---- Voie et son décor ---- */
    /* Plans, du plus éloigné au plus proche (les trains viennent ensuite) :
       bâtiment de gare, caténaire, quai (tous trois atténués), voie, puis
       troisième rail posé sur la voie. La caténaire et le troisième rail
       sont répétés sur toute la largeur (la caténaire calée sur le bas de
       la voie, le troisième rail sur le haut du rail) ; le quai est posé sur le haut de la voie, le bâtiment sur
       le quai. */
    class Track {
        constructor(image, decor, onTrack, station) {
            this.image = image;
            this.decor = decor || null;
            this.onTrack = !!onTrack;
            this.station = station || null;   // { platform, building, at, length, buildingX }
            this.height = image ? image.height : 8;
            this.y = 0;
        }
        /* Hauteur occupée au-dessus du sol par le décor et la gare. */
        rise() {
            let r = this.decor ? this.decor.height - this.height : 0;
            if (this.decor && this.onTrack) r = this.decor.height - 1;
            const st = this.station;
            if (st) {
                const h = (st.platform ? st.platform.height : 0) + (st.building ? st.building.height : 0);
                r = Math.max(r, h + this.height - TRACK_OFFSET_Y);
            }
            return r;
        }
        tile(im, y, screenWidth) {
            for (let x = 0; x < screenWidth; x += im.width) ctx.drawImage(im, x, y);
        }
        /* Bâtiment, caténaire et quai : assombris et opaques (plus de
           transparence), chaque plan cachant celui qui est derrière. */
        draw(screenWidth) {
            const y = Math.round(this.y * dpr) / dpr;
            const st = this.station;
            const dimStation = 1 - Compo.ALPHA.station, dimCat = 1 - Compo.ALPHA.catenary;
            let qx = 0, qw = 0;
            if (st) {
                qw = st.platform ? st.platform.width * st.length : (st.building ? st.building.width : 0);
                qx = resolveAnchoredPosition(st.at, screenWidth, qw, 'L');
            }
            if (st && st.building) {
                const qh = st.platform ? st.platform.height : 0;
                blit(dimmed(st.building, dimStation), qx + (qw - st.building.width) / 2 + st.buildingX, y - qh - st.building.height);
            }
            if (this.decor && !this.onTrack) this.tile(dimmed(this.decor, dimCat), y + this.height - this.decor.height, screenWidth);
            if (st && st.platform) {
                const p = dimmed(st.platform, dimStation);
                for (let i = 0; i < st.length; i++) blit(p, qx + i * st.platform.width, y - st.platform.height);
            }
            if (this.image) this.tile(this.image, y, screenWidth);
            /* Troisième rail : la dernière ligne de l'image est transparente,
               la dernière ligne opaque repose sur le haut du rail. */
            if (this.decor && this.onTrack) this.tile(dimmed(this.decor, THIRD_RAIL_DIM), y - this.decor.height + 1, screenWidth);
        }
        groundY() { return this.y + this.height - TRACK_OFFSET_Y; }
    }

    /* ---- Train ---- */
    class Train {
        constructor(cfg, screenWidth) {
            this.cfg = cfg;
            this.service = cfg.service || '';
            this.label = Compo.label(cfg);
            this.yOffset = cfg.y_offset || 0;
            this.groundY = 0;

            this.direction = cfg.direction || 'any';
            if (this.direction !== 'L' && this.direction !== 'R') this.direction = Math.random() < 0.5 ? 'L' : 'R';
            this.speedKmh = cfg.speed !== undefined ? cfg.speed : 100;
            this.speedPx = this.speedKmh * KMH_TO_PX_S;
            this.startingSpeedKmh = cfg.starting_speed !== undefined ? cfg.starting_speed : null;

            this.isReversed = !!cfg.reverse_composition && Math.random() < 0.5;
            this.vehicles = this.resolveList(cfg.composition);
            if (this.isReversed) this.vehicles.reverse();
            this.width = groupWidth(this.vehicles);
            this.height = this.vehicles.reduce((h, v) => v.coupler ? h : Math.max(h, v.img.height), 0);

            const spawnOffset = 300;
            this.startStationary = cfg.start_stationary || null;
            if (this.startStationary) {
                /* Déjà à l'arrêt sur la voie (manœuvre, train en gare...). */
                const posRaw = this.startStationary.at !== undefined ? this.startStationary.at : '50%';
                const frontX = resolveAnchoredPosition(posRaw, screenWidth, this.width, this.direction);
                if (this.direction === 'R') { this.velocity = this.speedPx; this.x = frontX - this.width; }
                else { this.velocity = -this.speedPx; this.x = frontX; }
            } else if (this.direction === 'R') {
                this.velocity = this.speedPx;
                this.x = -this.width - spawnOffset;
            } else {
                this.velocity = -this.speedPx;
                this.x = screenWidth + spawnOffset;
            }
            this.targetSpeed = Math.abs(this.velocity);
            this.cleanupTimer = 0;
            this.wait = 0;   // secondes avant d'apparaître (décalage du fond ou du principal)

            this.stopConfig = cfg.stop || null;
            this.hasStopped = false;
            this.brakingStartSpeed = 0;
            this.brakingStartDist = 0;

            /* stop.at : bord avant en pixels, ou "50%" pour le centre du train. */
            this.resolvedStopAt = null;
            if (this.stopConfig && this.stopConfig.at !== undefined) {
                this.resolvedStopAt = resolveAnchoredPosition(this.stopConfig.at, screenWidth, this.width, this.direction);
            }

            /* loco_change = dételage d'un véhicule en tête + attelage de la
               nouvelle locomotive ; sinon dételage et attelage indépendants,
               chacun à l'avant ou à l'arrière. */
            this.stopEvent = null;
            if (this.stopConfig) {
                const hasLocoChange = !!this.stopConfig.loco_change;
                const detachCount = this.stopConfig.detach_count || (hasLocoChange ? 1 : 0);
                const attachRaw = hasLocoChange ? [this.stopConfig.loco_change] : (this.stopConfig.attach || []);
                const needsDetach = detachCount > 0;
                const needsAttach = attachRaw.length > 0;
                if (needsDetach || needsAttach) {
                    this.stopEvent = {
                        needsDetach, needsAttach, detachCount,
                        detachPosition: this.stopConfig.detach_position === 'back' ? 'back' : 'front',
                        attachRaw,
                        attachPosition: this.stopConfig.attach_position === 'back' ? 'back' : 'front',
                        selfDetachCount: this.stopConfig.attach_self_detach_count || 0,
                        phase: 'idle',
                        timer: 0,
                        detachGroup: null,
                        attachGroup: null
                    };
                }
            }

            this.stopTimer = 0;
            if (this.startStationary) {
                this.currentSpeed = 0;
                this.hasEntered = true;
                if (this.stopEvent) {
                    /* Le train ne passera jamais « en marche » avant ce point :
                       la manœuvre commence tout de suite. */
                    this.enterStoppedState();
                } else {
                    this.state = 'stopped';
                    const dur = this.startStationary.duration;
                    this.stopTimer = (dur === undefined || dur === null || dur === 'infinite') ? Infinity : dur;
                }
            } else {
                if (this.startingSpeedKmh !== null && this.startingSpeedKmh < this.speedKmh) {
                    this.currentSpeed = Math.abs(this.startingSpeedKmh * KMH_TO_PX_S);
                    this.state = 'accelerating';
                } else {
                    this.currentSpeed = Math.abs(this.velocity);
                    this.state = 'moving';
                }
                this.hasEntered = false;
            }

            this.foreground = null;
            let fg = cfg.foreground;
            if (typeof fg === 'string') fg = { image: fg, at: 0 };
            if (fg && typeof fg === 'object') {
                const im = images.get(Compo.foregroundSrc(fg));
                if (im) this.foreground = { image: im, at: fg.at || 0, yOffset: fg.y || 0 };
            }

            this.ACCEL_FACTOR = 1.2;
            this.MAX_ACCEL = 25.0;
            this.accelTimer = 0.0;
            this.NOMINAL_DECELERATION = 20.0;
        }

        resolveList(items) {
            return toVehicles(Compo.resolve(items, { direction: this.direction, reversed: this.isReversed }));
        }

        update(dt, screenWidth) {
            if (this.wait > 0) { this.wait -= dt; return; }
            /* 1. Déclenchement du freinage */
            if (this.stopConfig && !this.hasStopped && this.state === 'moving' && this.resolvedStopAt !== null) {
                const distToStop = this.direction === 'R'
                    ? this.resolvedStopAt - (this.x + this.width)
                    : this.x - this.resolvedStopAt;
                const triggerDecel = this.NOMINAL_DECELERATION * 0.95;
                const nominalBrakingDist = (this.currentSpeed ** 2) / (2 * triggerDecel);
                if (distToStop > 0 && distToStop <= nominalBrakingDist) {
                    this.state = 'stopping';
                    this.brakingStartSpeed = this.currentSpeed;
                    this.brakingStartDist = distToStop > 0 ? distToStop : 1.0;
                }
            }

            if (this.state === 'stopping') {
                const distToStop = this.direction === 'R'
                    ? this.resolvedStopAt - (this.x + this.width)
                    : this.x - this.resolvedStopAt;
                if (distToStop <= 0) {
                    this.currentSpeed = 0;
                } else {
                    const progress = Math.max(0, Math.min(1, distToStop / this.brakingStartDist));
                    this.currentSpeed = this.brakingStartSpeed * Math.pow(progress, 0.45);
                }
                if (this.currentSpeed <= 0.5) {
                    this.currentSpeed = 0;
                    this.enterStoppedState();
                }
            } else if (this.state === 'stopped') {
                if (this.stopEvent) {
                    this.updateStopEvent(dt, screenWidth);
                } else {
                    this.stopTimer -= dt;
                    if (this.stopTimer <= 0) {
                        this.state = 'accelerating';
                        this.accelTimer = 0;
                        this.hasStopped = true;
                        if (this.cfg.reverse_departure) {
                            if (this.direction === 'R') { this.direction = 'L'; this.velocity = -this.speedPx; }
                            else { this.direction = 'R'; this.velocity = this.speedPx; }
                            this.vehicles.reverse();
                        }
                    }
                }
            } else if (this.state === 'accelerating') {
                this.accelTimer += dt;
                const speedDiff = this.targetSpeed - this.currentSpeed;
                let accel = Math.min(speedDiff * this.ACCEL_FACTOR, this.MAX_ACCEL);
                accel *= Math.min(1, this.accelTimer / 0.3);
                if (this.accelTimer > 0.1) accel = Math.max(accel, 1.0);
                this.currentSpeed += accel * dt;
                if (this.currentSpeed >= this.targetSpeed - 1.0) {
                    this.currentSpeed = this.targetSpeed;
                    this.state = 'moving';
                }
            }

            const moveAmount = this.currentSpeed * dt;
            if (this.direction === 'R') this.x += moveAmount;
            else this.x -= moveAmount;

            if (!this.hasEntered) {
                if (this.direction === 'R' && this.x + this.width > 0) this.hasEntered = true;
                else if (this.direction === 'L' && this.x < screenWidth) this.hasEntered = true;
            }
            if (this.hasEntered) {
                const isOff = (this.direction === 'R' && this.x > screenWidth)
                    || (this.direction === 'L' && this.x + this.width < 0);
                if (isOff) this.cleanupTimer += dt;
                else this.cleanupTimer = 0;
            }
        }

        /* « Avant » (front) agit sur la tête logique du train (vehicles[0]),
           « arrière » (back) sur la queue, quel que soit le sens de marche. */
        isRightSide(position) {
            return (position === 'front') === (this.direction === 'R');
        }

        enterStoppedState() {
            this.state = 'stopped';
            this.stopTimer = (this.stopConfig && this.stopConfig.duration) || 3;
            if (this.stopEvent) {
                this.stopEvent.phase = this.stopEvent.needsDetach ? 'waiting_to_detach' : 'waiting_to_attach';
                this.stopEvent.timer = 1.5;
            }
        }

        performDetach(count, position) {
            const n = Math.min(count, this.vehicles.length);
            if (n <= 0) return null;
            const detached = position === 'back'
                ? this.vehicles.splice(this.vehicles.length - n, n)
                : this.vehicles.splice(0, n);
            if (!detached.length) return null;

            const detachedWidth = groupWidth(detached);
            const rightSide = this.isRightSide(position);
            let startX;
            if (rightSide) {
                startX = this.x + this.width - detachedWidth;
            } else {
                startX = this.x;
                this.x += detachedWidth;
            }
            this.width -= detachedWidth;
            return { vehicles: detached, x: startX, rightSide };
        }

        spawnAttachGroup(ev, screenWidth) {
            const resolved = this.resolveList(ev.attachRaw);
            if (!resolved.length) { ev.attachGroup = null; return; }
            const width = groupWidth(resolved);
            const approachSpeed = this.speedPx / 1.2;
            const rightDock = this.isRightSide(ev.attachPosition);
            const spawnX = rightDock ? screenWidth + 300 : -300 - width;
            const velocity = rightDock ? -approachSpeed : approachSpeed;
            ev.attachGroup = { vehicles: resolved, x: spawnX, velocity, brakingStartDist: 0, rightDock };
        }

        /* Groupe qui s'éloigne en accélérant (dételage, ou locotracteur qui
           repart après l'attelage). Vrai une fois sorti de l'écran. */
        animateDepartingGroup(grp, dt, screenWidth) {
            grp.accelTimer += dt;
            let accel = Math.min((grp.targetSpeed - grp.currentSpeed) * this.ACCEL_FACTOR, this.MAX_ACCEL);
            accel *= Math.min(1, grp.accelTimer / 0.3);
            if (grp.accelTimer > 0.1) accel = Math.max(accel, 1.0);
            grp.currentSpeed = Math.min(grp.currentSpeed + accel * dt, grp.targetSpeed);
            grp.x += grp.currentSpeed * grp.dir * dt;
            const width = groupWidth(grp.vehicles);
            if (grp.dir > 0 && grp.x > screenWidth + 100) return true;
            if (grp.dir < 0 && grp.x + width < -100) return true;
            return false;
        }

        departingGroup(group) {
            /* Le groupe s'éloigne du côté où il se trouve, sans traverser le reste du train. */
            return {
                vehicles: group.vehicles, x: group.x,
                currentSpeed: 0, targetSpeed: this.speedPx,
                dir: group.rightSide ? 1 : -1, accelTimer: 0
            };
        }

        finishStopEvent() {
            this.stopTimer = 0;
            this.stopEvent = null;
        }

        /* Manœuvre à l'arrêt : dételage (facultatif) puis attelage (facultatif). */
        updateStopEvent(dt, screenWidth) {
            const ev = this.stopEvent;

            if (ev.phase === 'waiting_to_detach') {
                ev.timer -= dt;
                if (ev.timer <= 0) {
                    const group = this.performDetach(ev.detachCount, ev.detachPosition);
                    if (group) {
                        ev.detachGroup = this.departingGroup(group);
                        ev.phase = 'detaching';
                    } else if (ev.needsAttach) {
                        ev.phase = 'waiting_to_attach';
                        ev.timer = 1.0;
                    } else {
                        this.finishStopEvent();
                    }
                }
            } else if (ev.phase === 'detaching') {
                if (this.animateDepartingGroup(ev.detachGroup, dt, screenWidth)) {
                    ev.detachGroup = null;
                    if (ev.needsAttach) {
                        ev.phase = 'waiting_to_attach';
                        ev.timer = 1.0;
                    } else {
                        this.finishStopEvent();
                    }
                }
            } else if (ev.phase === 'waiting_to_attach') {
                ev.timer -= dt;
                if (ev.timer <= 0) {
                    this.spawnAttachGroup(ev, screenWidth);
                    if (!ev.attachGroup) this.finishStopEvent();
                    else ev.phase = 'approaching';
                }
            } else if (ev.phase === 'approaching') {
                const grp = ev.attachGroup;
                const width = groupWidth(grp.vehicles);
                let targetX, dist;
                if (grp.rightDock) { targetX = this.x + this.width + 3; dist = grp.x - targetX; }
                else { targetX = this.x - 5 - width; dist = targetX - grp.x; }

                if (grp.brakingStartDist === 0) grp.brakingStartDist = dist;
                const startSpeed = Math.abs(grp.velocity);
                const startDist = grp.brakingStartDist <= 0 ? 1.0 : grp.brakingStartDist;
                const progress = Math.max(0, Math.min(1, dist / startDist));
                const speed = Math.max(startSpeed * Math.pow(progress, 0.5), 5.0);

                if (dist <= 1) {
                    grp.x = targetX;
                    ev.phase = 'docking';
                    ev.timer = 1.5;
                } else if (grp.rightDock) {
                    grp.x -= speed * dt;
                } else {
                    grp.x += speed * dt;
                }
            } else if (ev.phase === 'docking') {
                if (ev.timer > 0) {
                    ev.timer -= dt;
                } else {
                    const grp = ev.attachGroup;
                    const width = groupWidth(grp.vehicles);
                    let targetX, dist;
                    if (grp.rightDock) { targetX = this.x + this.width; dist = grp.x - targetX; }
                    else { targetX = this.x - width; dist = targetX - grp.x; }

                    const step = 6 * dt;   // approche au pas
                    if (dist <= step) {
                        grp.x = targetX;
                        ev.phase = 'attached';
                        ev.timer = 4.0;
                        if (ev.attachPosition === 'front') this.vehicles = grp.vehicles.concat(this.vehicles);
                        else this.vehicles = this.vehicles.concat(grp.vehicles);
                        if (!grp.rightDock) this.x -= width;
                        this.width += width;
                        ev.attachGroup = null;
                    } else if (grp.rightDock) {
                        grp.x -= step;
                    } else {
                        grp.x += step;
                    }
                }
            } else if (ev.phase === 'attached') {
                ev.timer -= dt;
                if (ev.timer <= 0) {
                    const group = ev.selfDetachCount > 0 ? this.performDetach(ev.selfDetachCount, ev.attachPosition) : null;
                    if (group) {
                        /* Une partie de ce qui vient d'être attelé repart aussitôt. */
                        ev.detachGroup = this.departingGroup(group);
                        ev.phase = 'self_detaching';
                    } else {
                        this.finishStopEvent();
                    }
                }
            } else if (ev.phase === 'self_detaching') {
                if (this.animateDepartingGroup(ev.detachGroup, dt, screenWidth)) {
                    ev.detachGroup = null;
                    this.finishStopEvent();
                }
            }
        }

        /* dim : assombrissement opaque (train d'arrière-plan), 0 sinon. */
        draw(screenWidth, dim) {
            if (this.wait > 0) return;
            /* Sans décor choisi (clé decor absente), un simple fil au-dessus
               des engins de 58 px (pantographes levés). decor: false l'ôte. */
            if (!dim && this.height === 58 && this.cfg.decor === undefined) {
                ctx.fillStyle = WIRE_COLOR;
                ctx.fillRect(0, Math.round(this.groundY - this.height - 1), screenWidth, 1);
            }
            const ev = this.stopEvent;
            if (ev && ev.detachGroup) drawGroup(ev.detachGroup.vehicles, ev.detachGroup.x, ev.detachGroup.dir > 0, this.groundY, dim);
            if (ev && ev.attachGroup) drawGroup(ev.attachGroup.vehicles, ev.attachGroup.x, this.direction === 'R', this.groundY, dim);
            drawGroup(this.vehicles, this.x, this.direction === 'R', this.groundY, dim);

            if (this.foreground) {
                const fg = this.foreground;
                blit(dimmed(fg.image, dim), fg.at, this.groundY - fg.image.height - fg.yOffset);
            }
        }

        shouldRemove() {
            return this.cleanupTimer >= 0.5;
        }

        /* Un train d'arrière-plan encore en route retient la voie, sauf
           s'il reste arrêté sans fin. */
        lingers() {
            return !this.shouldRemove() && this.stopTimer !== Infinity;
        }
    }

    /* ---- Simulation ---- */
    const playBtn    = document.getElementById('trafic-play');
    const tracksOut  = document.getElementById('trafic-tracks');
    const minusBtn   = document.getElementById('trafic-tracks-minus');
    const plusBtn    = document.getElementById('trafic-tracks-plus');
    const speedSel   = document.getElementById('trafic-speed');
    const serviceSel = document.getElementById('trafic-service');
    const periodSel  = document.getElementById('trafic-period');
    const clearBtn   = document.getElementById('trafic-clear');
    const fullBtn    = document.getElementById('trafic-fullscreen');
    const statusEl   = document.getElementById('trafic-status');

    let DATA = null;
    let entries = [];           // [{ service, train }]
    let filter = '';            // service affiché ('' = tous)
    let historic = false;       // période : services d'avant 2001 (CCFM, WME, MSER)
    let active = [];            // [{ train, track, bg }] sur les voies
    let ready = [];             // réglages chargés, en attente d'une voie libre
    let loading = 0;            // trains en cours de chargement
    let bag = [];
    let generation = 0;         // change quand on vide les voies ou change de service
    let spawnTimer = 0;
    let paused = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let speedMul = 1;
    let maxTracks = parseInt(stage.dataset.tracks, 10) || 7;   // data-tracks : voies au départ
    let last = performance.now();

    function setStatus(text) { if (statusEl) statusEl.textContent = text || ''; }

    /* Trains de la période choisie, filtrés par service. */
    function pool() {
        return entries.filter(e => Compo.isHistoric(DATA, e.service) === historic
            && (!filter || e.service === filter));
    }

    function nextEntry() {
        const list = pool();
        if (!list.length) return null;
        if (!bag.length) bag = Compo.shuffle(list);
        return bag.pop();
    }

    /* Tire le prochain train et charge ses images ; il attend ensuite une voie libre. */
    function request() {
        const e = nextEntry();
        if (!e) return;
        const cfg = Compo.scenario(DATA, e.service, e.train);
        const srcs = Compo.sources(cfg);
        /* Une voie absente de TRACKS (ajoutée depuis l'admin) se lit dans mltc/assets/voies/. */
        if (cfg.track && !TRACKS[cfg.track]) TRACKS[cfg.track] = 'mltc/assets/voies/' + cfg.track;
        srcs.push(TRACKS[cfg.track] || TRACKS[DEFAULT_TRACK]);
        loading++;
        const token = generation;
        Promise.all(srcs.map(load)).then(() => {
            loading--;
            if (token === generation) ready.push(cfg);
        });
    }

    /* Pose le train sur une voie qui ne chevauche aucune autre (15 essais). */
    function place(cfg) {
        const train = new Train(cfg, W);
        if (!train.vehicles.length) return true;   // aucune image : on l'abandonne
        const decorSrc = Compo.decorSrc(cfg);
        const st = Compo.station(cfg);
        const track = new Track(images.get(TRACKS[cfg.track] || TRACKS[DEFAULT_TRACK]) || null,
            decorSrc ? images.get(decorSrc) : null,
            Compo.decorOnTrack(DATA, cfg.decor),
            st ? {
                platform: images.get(st.platform) || null,
                building: st.building ? images.get(st.building) || null : null,
                at: st.at, length: st.length, buildingX: st.buildingX
            } : null);
        /* Hauteur au-dessus de la voie : le train, ou le décor s'il est plus haut. */
        const rise = it => Math.max(it.train.height + 10, it.track.rise());
        const mine = { train, track };
        for (let attempt = 0; attempt < 15; attempt++) {
            const minY = Math.max(TOP_SPACE, track.rise() + 8);
            const maxY = Math.max(minY, H - track.height - LABEL_SPACE);
            const y = randInt(minY, maxY);
            const top = y + track.height - TRACK_OFFSET_Y - rise(mine);
            const bottom = y + track.height + LABEL_SPACE;
            const clash = active.some(it => {
                const eTop = it.track.y + it.track.height - TRACK_OFFSET_Y - rise(it);
                const eBottom = it.track.y + it.track.height + LABEL_SPACE;
                return top < eBottom && bottom > eTop;
            });
            if (clash) continue;

            track.y = y;
            train.groundY = track.groundY() + train.yOffset;
            let bg = null;
            if (cfg.background) {
                const chance = cfg.background.chance !== undefined ? cfg.background.chance : 100;
                if (Math.random() * 100 < chance) {
                    const bgCfg = Object.assign({ service: cfg.service }, cfg.background);
                    /* "opposite" : roule à contresens du train principal, quel que soit son tirage. */
                    if (bgCfg.direction === 'opposite') bgCfg.direction = train.direction === 'R' ? 'L' : 'R';
                    bg = new Train(bgCfg, W);
                    bg.ownService = !!cfg.background.service;   // service propre : son libellé peut s'afficher seul
                    bg.groundY = track.groundY() + bg.yOffset;
                    /* delay : secondes de décalage (négatif : le fond passe avant le principal). */
                    const raw = cfg.background.delay;
                    const delay = raw === 'random' ? randFloat(-3, 3) : (Number(raw) || 0);
                    if (delay > 0) bg.wait = delay;
                    else if (delay < 0) train.wait = -delay;
                }
            }
            active.push({ train, track, bg });
            return true;
        }
        return false;
    }

    function reset() {
        generation++;
        active = [];
        ready = [];
        bag = [];
        spawnTimer = 0;
    }

    function step(dt) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            if (ready.length) {
                if (active.length < maxTracks && place(ready[0])) {
                    ready.shift();
                    spawnTimer = randFloat(0.5, 2.5);
                } else {
                    spawnTimer = 0.5;
                }
            } else if (!loading && active.length < maxTracks) {
                request();
            }
        }
        active.forEach(it => {
            it.train.update(dt, W);
            if (it.bg) it.bg.update(dt, W);
        });
        active = active.filter(it => !it.train.shouldRemove() || (it.bg && it.bg.lingers()));
    }

    /* Service puis intitulé, à partir de x0 ; renvoie le bord droit. Le fond
       n'affiche son service que s'il en a un propre (background.service). */
    function drawLabel(train, y, x0, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textBaseline = 'top';
        let x = x0;
        if (train.ownService !== false) {
            ctx.font = '700 11px ' + FONT;
            if ('letterSpacing' in ctx) ctx.letterSpacing = '0.06em';
            const svc = train.service.toUpperCase();
            ctx.fillStyle = SERVICE_COLORS[train.service] || SERVICE_COLOR;
            ctx.fillText(svc, x, y);
            x += ctx.measureText(svc).width + 8;
            if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        }
        if (train.label) {
            ctx.font = '400 12px ' + FONT;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
            ctx.fillText(train.label, x, y - 1);
            x += ctx.measureText(train.label).width;
        }
        ctx.restore();
        return x;
    }

    function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        active.sort((a, b) => a.track.y - b.track.y);
        active.forEach(it => {
            it.track.draw(W);
            if (it.bg) it.bg.draw(W, BG_TRAIN_DIM);
            it.train.draw(W);
            /* Intitulé du fond à la suite de celui du principal, assombri. */
            const y = it.track.y + it.track.height + 5;
            const end = drawLabel(it.train, y, 12, 1);
            const bg = it.bg;
            if (bg && (bg.label || bg.ownService) && !bg.shouldRemove()) drawLabel(bg, y, end + 28, BG_LABEL_ALPHA);
        });
    }

    function frame(now) {
        const raw = Math.min((now - last) / 1000, 0.05);   // pas de saut au retour sur l'onglet
        last = now;
        if (!paused && DATA) step(raw * speedMul);
        draw();
        requestAnimationFrame(frame);
    }

    function resize() {
        const r = canvas.getBoundingClientRect();
        dpr = Math.max(1, window.devicePixelRatio || 1);
        W = Math.max(1, Math.round(r.width));
        H = Math.max(1, Math.round(r.height));
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
    }

    /* ---- Commandes ---- */
    function setPaused(p) {
        paused = p;
        if (playBtn) {
            playBtn.textContent = paused ? 'Lecture' : 'Pause';
            playBtn.setAttribute('aria-label', paused ? 'Reprendre l\'animation' : 'Mettre l\'animation en pause');
        }
        refreshStatus();
    }

    function refreshStatus() {
        if (!DATA) return;
        if (!pool().length) setStatus(historic ? 'Aucune composition historique pour l’instant.' : 'Aucun train pour ce service.');
        else setStatus(paused ? 'En pause' : '');
    }

    function setTracks(n) {
        maxTracks = Math.max(TRACKS_MIN, Math.min(TRACKS_MAX, n));
        if (tracksOut) tracksOut.textContent = String(maxTracks);
        if (minusBtn) minusBtn.disabled = maxTracks <= TRACKS_MIN;
        if (plusBtn) plusBtn.disabled = maxTracks >= TRACKS_MAX;
    }

    function wire() {
        if (playBtn) playBtn.addEventListener('click', () => setPaused(!paused));
        canvas.addEventListener('click', () => setPaused(!paused));
        if (minusBtn) minusBtn.addEventListener('click', () => setTracks(maxTracks - 1));
        if (plusBtn) plusBtn.addEventListener('click', () => setTracks(maxTracks + 1));
        if (speedSel) speedSel.addEventListener('change', () => { speedMul = parseFloat(speedSel.value) || 1; });
        if (serviceSel) {
            serviceSel.addEventListener('change', () => {
                filter = serviceSel.value;
                reset();
                refreshStatus();
            });
        }
        if (periodSel) {
            periodSel.addEventListener('change', () => {
                historic = periodSel.value === 'historique';
                filter = '';
                fillServices();
                reset();
                refreshStatus();
            });
        }
        if (clearBtn) clearBtn.addEventListener('click', reset);

        if (fullBtn) {
            if (!stage.requestFullscreen) {
                fullBtn.hidden = true;
            } else {
                fullBtn.addEventListener('click', () => {
                    if (document.fullscreenElement) document.exitFullscreen();
                    else stage.requestFullscreen().catch(() => {});
                });
                document.addEventListener('fullscreenchange', () => {
                    fullBtn.textContent = document.fullscreenElement ? 'Quitter le plein écran' : 'Plein écran';
                });
            }
        }

        /* Espace : pause, sauf quand une commande a le focus. */
        document.addEventListener('keydown', e => {
            if (e.key !== ' ' || e.repeat) return;
            const t = e.target;
            if (t !== document.body && t !== canvas) return;
            e.preventDefault();
            setPaused(!paused);
        });

        if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
        else window.addEventListener('resize', resize);
    }

    /* Services de la période choisie qui ont des trains. */
    function fillServices() {
        if (!serviceSel) return;
        while (serviceSel.options.length > 1) serviceSel.remove(1);
        serviceSel.value = '';
        const seen = [];
        entries.forEach(e => {
            if (Compo.isHistoric(DATA, e.service) === historic && seen.indexOf(e.service) < 0) seen.push(e.service);
        });
        seen.forEach(s => {
            const o = document.createElement('option');
            o.value = s;
            o.textContent = s;
            serviceSel.appendChild(o);
        });
    }

    async function init() {
        FONT = getComputedStyle(document.body).fontFamily || 'sans-serif';
        resize();
        wire();
        setTracks(maxTracks);
        setPaused(paused);
        setStatus('Chargement des trains…');
        requestAnimationFrame(frame);
        try {
            DATA = await Compo.load(BASE);
            entries = Compo.trains(DATA).filter(e => Array.isArray(e.train.composition) && e.train.composition.length);
            fillServices();
            setPaused(paused);
        } catch (err) {
            console.error('[Trafic]', err);
            setStatus('Impossible de charger les circulations.');
        }
    }

    init();
})();
