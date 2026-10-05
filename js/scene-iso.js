/* ========================================
   Vue isometrique du hub 3D
   Construit en SVG le modele decrit dans 3D/scene-modele.js, puis l'assemble
   cube par cube. Chaque cube porte ses trois faces visibles (dessus, gauche,
   droite) : un cube qui arrive avant ses voisins reste entier. Une face
   collee a un voisin deja pose est masquee, pour garder un rendu net.

   Ordre d'affichage : les cubes poses sont tries du fond vers l'avant
   (x + y + z croissant). Un cube en vol est dessine par-dessus, dans un
   calque a part : les ordres de montage proposes posent toujours un cube
   devant ou au-dessus de ceux deja en place, donc il ne doit jamais etre
   recouvert pendant sa chute. Il rejoint le calque trie a l'atterrissage.
   ======================================== */

(function () {
    const M = window.TD_SCENE;
    const svg = document.querySelector('.td-scene');
    if (!M || !svg) return;

    const NS = 'http://www.w3.org/2000/svg';
    const R = M.rendu || {};
    const A = M.animation || {};

    // Un cube : 20 unites de haut, ses aretes au sol penchent a 30 degres
    const DX = 20 * Math.cos(Math.PI / 6);
    const DY = 10;
    const DZ = 20;
    const proj = (x, y, z) => [(x - y) * DX, (x + y) * DY - z * DZ];
    const pts = list => list.map(p => proj(...p).map(n => n.toFixed(1)).join(',')).join(' ');

    // ── Lecture du modele ──
    const palette = M.palette || {};
    let cubes = [];
    (M.couches || []).forEach((couche, z) => couche.forEach((ligne, y) => [...ligne].forEach((c, x) => {
        if (c === '.' || c === ' ') return;
        if (!palette[c]) {
            console.warn('scene-iso : lettre "' + c + '" absente de la palette, cube ignore');
            return;
        }
        cubes.push({ x, y, z, c });
    })));
    if (!cubes.length) return;

    // Recadrage sur le modele, avec sa marge de sol
    const marge = R.margeSol ?? 2;
    const minX = Math.min(...cubes.map(v => v.x));
    const minY = Math.min(...cubes.map(v => v.y));
    cubes.forEach(v => { v.x += marge - minX; v.y += marge - minY; });
    const nx = Math.max(...cubes.map(v => v.x)) + 1 + marge;
    const ny = Math.max(...cubes.map(v => v.y)) + 1 + marge;

    // ── Couleurs ──
    const rgb = hex => {
        const h = hex.replace('#', '');
        const f = h.length === 3 ? h.split('').map(d => d + d).join('') : h;
        return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16));
    };
    const css = c => '#' + c.map(n => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')).join('');
    const teintes = {};
    Object.entries(palette).forEach(([k, hex]) => {
        const base = rgb(hex);
        const clair = R.dessus ?? 0.22;
        const sombre = R.droite ?? 0.7;
        teintes[k] = {
            top: css(base.map(n => n + (255 - n) * clair)),
            left: css(base),
            right: css(base.map(n => n * sombre))
        };
    });

    // ── Construction ──
    const el = (tag, attrs) => {
        const n = document.createElementNS(NS, tag);
        Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
        return n;
    };

    svg.textContent = '';
    const viewport = svg.closest('.td-viewport');
    const fond = getComputedStyle(viewport || svg).backgroundColor;
    const filaire = R.style === 'filaire';

    // Sol quadrille
    let d = '';
    for (let x = 0; x <= nx; x++) d += 'M' + pts([[x, 0, 0]]) + 'L' + pts([[x, ny, 0]]);
    for (let y = 0; y <= ny; y++) d += 'M' + pts([[0, y, 0]]) + 'L' + pts([[nx, y, 0]]);
    svg.appendChild(el('path', { class: 'td-floor', d }));

    // Ombre : une case de sol sous chaque colonne occupee, decalee vers le bas
    if (R.ombre !== false) {
        const colonnes = new Set(cubes.map(v => v.x + ',' + v.y));
        let o = '';
        colonnes.forEach(k => {
            const [x, y] = k.split(',').map(Number);
            o += 'M' + pts([[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]]) + 'Z';
        });
        svg.appendChild(el('path', { class: 'td-shadow', d: o, transform: 'translate(0 ' + DZ * 0.7 + ')' }));
    }

    const calquePose = el('g', { class: 'td-cubes' });
    const calqueVol = el('g', { class: 'td-cubes' });
    svg.append(calquePose, calqueVol);

    const grille = new Map();
    const cle = (x, y, z) => x + ',' + y + ',' + z;

    cubes.forEach(v => {
        const { x, y, z } = v;
        const t = teintes[v.c];
        const faces = {
            top: [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]],
            left: [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]],
            right: [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]]
        };
        v.node = el('g', { class: 'td-voxel' });
        v.faces = {};
        Object.entries(faces).forEach(([nom, coins]) => {
            const p = el('polygon', { points: pts(coins) });
            if (filaire) {
                p.style.fill = fond;
                p.style.stroke = t[nom];
                p.style.strokeWidth = '1';
            } else {
                p.style.fill = t[nom];
                // Sans contours, un trait de la couleur de la face bouche les jours entre faces
                if (R.contours === false) p.style.stroke = t[nom];
            }
            v.faces[nom] = p;
            v.node.appendChild(p);
        });
        v.prof = x + y + z;
        v.pose = false;
        v.node.addEventListener('animationend', () => poser(v));
        grille.set(cle(x, y, z), v);
    });

    // ── Ordre de montage ──
    const ordres = {
        couches: (a, b) => a.z - b.z || a.x - b.x || a.y - b.y,
        longueur: (a, b) => a.x - b.x || a.z - b.z || a.y - b.y,
        largeur: (a, b) => a.y - b.y || a.z - b.z || a.x - b.x
    };
    cubes.sort(ordres[A.ordre] || ordres.couches);

    // Masque les faces collees a un voisin pose : celles de ce cube, et celles
    // des voisins de derriere qui touchent ce cube
    const voisins = [['top', 0, 0, 1], ['left', 0, 1, 0], ['right', 1, 0, 0]];
    function masquer(v) {
        voisins.forEach(([face, dx, dy, dz]) => {
            const devant = grille.get(cle(v.x + dx, v.y + dy, v.z + dz));
            if (devant && devant.pose) v.faces[face].classList.add('is-hidden');
            const derriere = grille.get(cle(v.x - dx, v.y - dy, v.z - dz));
            if (derriere && derriere.pose) derriere.faces[face].classList.add('is-hidden');
        });
    }

    // Range le cube a sa place dans le calque trie
    function poser(v) {
        if (v.pose) return;
        v.pose = true;
        v.node.classList.add('is-posed');
        let avant = null;
        for (const n of calquePose.children) {
            if (+n.dataset.prof > v.prof) { avant = n; break; }
        }
        v.node.dataset.prof = v.prof;
        calquePose.insertBefore(v.node, avant);
        masquer(v);
    }

    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    svg.classList.toggle('is-pop', A.effet === 'pop');
    svg.style.setProperty('--td-chute', -(A.hauteur ?? 1.8) * DZ + 'px');
    svg.style.setProperty('--td-duree', (A.duree ?? 550) + 'ms');
    svg.style.setProperty('--td-ecart', (A.ecart ?? 24) + 'ms');

    function monter(depart) {
        cubes.forEach(v => {
            v.pose = false;
            v.node.classList.remove('is-posed');
            Object.values(v.faces).forEach(p => p.classList.remove('is-hidden'));
        });
        if (calme) {
            cubes.forEach(poser);
            return;
        }
        svg.style.setProperty('--td-depart', depart + 'ms');
        // Reinserer chaque cube relance son animation
        cubes.forEach((v, i) => {
            v.node.style.setProperty('--i', i);
            calqueVol.appendChild(v.node);
        });
    }

    // Cadrage : le sol et le sommet du modele, plus une marge
    const coins = [[0, 0, 0], [nx, 0, 0], [nx, ny, 0], [0, ny, 0]].map(p => proj(...p));
    const haut = Math.min(...cubes.map(v => proj(v.x, v.y, v.z + 1)[1]));
    const pad = 14;
    const x0 = coins[3][0] - pad;
    const x1 = coins[1][0] + pad;
    const y0 = Math.min(haut, coins[0][1]) - pad;
    const y1 = coins[2][1] + pad;
    svg.setAttribute('viewBox', [x0, y0, x1 - x0, y1 - y0].map(n => n.toFixed(1)).join(' '));

    // Textes de la fenetre
    if (M.description) svg.setAttribute('aria-label', M.description);
    if (viewport) {
        const compteur = viewport.querySelector('[data-td-count]');
        if (compteur) compteur.textContent = cubes.length + (cubes.length > 1 ? ' cubes' : ' cube');
        const rejouer = viewport.querySelector('[data-td-replay]');
        if (rejouer) {
            if (calme) rejouer.hidden = true;
            rejouer.addEventListener('click', () => monter(100));
        }
    }

    monter(A.depart ?? 500);
})();
