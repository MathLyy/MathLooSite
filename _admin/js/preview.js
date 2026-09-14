/* =========================================================================
   preview.js — Apercu fidele dans une iframe.

   Ni <link> ni <base> : sous une origine http://localhost, un <base> ferait
   afficher les images du site DEPLOYE au lieu de l'arbre de travail. Tout
   est inline — CSS lu sur le disque, images en blob:, et le vrai
   js/livrees-subpages.js pour que le bouton R et l'auto-stack soient exacts.
   ========================================================================= */
(function () {
    'use strict';

    const Fs = window.LvFs;
    const Ser = window.LvSer;

    let cssText = null;
    let subpagesJs = null;
    let timer = null;

    async function loadAssets() {
        if (cssText != null) return;
        const files = ['css/style.css', 'css/livrees-subpages.css', 'css/mltc.css'];
        const parts = [];
        for (const f of files) {
            try { parts.push(await Fs.readText(f)); }
            catch (e) { /* feuille absente : on continue */ }
        }
        cssText = parts.join('\n');
        try { subpagesJs = await Fs.readText('js/livrees-subpages.js'); }
        catch (e) { subpagesJs = ''; }
    }

    /* Remplace les chemins d'images locaux par des blob: lisibles en iframe. */
    async function rewriteImages(html) {
        const paths = new Set();
        html.replace(/(?:src|data-r)="(livrees_img\/[^"]+)"/g, (m, p) => { paths.add(p); return m; });
        const map = new Map();
        for (const p of paths) {
            const u = await Fs.imageURL(p);
            if (u) map.set(p, u);
        }
        return html.replace(/((?:src|data-r)=")(livrees_img\/[^"]+)(")/g,
            (m, a, p, b) => map.has(p) ? a + map.get(p) + b : m);
    }

    function mainBodyOf(built, page) {
        const i = built.indexOf(page.mainOpenTag);
        const start = i < 0 ? built.indexOf('<main') : i;
        const open = built.indexOf('>', start) + 1;
        const close = built.indexOf('</main>');
        return built.slice(open, close);
    }

    async function render(page, frame, statusEl) {
        if (!page || page.readOnly) {
            frame.srcdoc = '<body style="background:#0f0a1a;color:#9a92b4;font:14px sans-serif;padding:24px">'
                + 'Aperçu indisponible pour cette page.</body>';
            return;
        }
        await loadAssets();
        if (statusEl) statusEl.textContent = 'rendu…';

        const built = Ser.build(page);
        const inner = await rewriteImages(mainBodyOf(built, page));
        const cls = page.mainClass || 'lv-page';

        frame.srcdoc = '<!DOCTYPE html><html lang="fr" data-theme="dark" data-theme-forced="dark">'
            + '<head><meta charset="utf-8"><style>'
            + 'html,body{background:#0f0a1a;color:#f5f5f5;margin:0}'
            + '.lv-page{padding-top:24px !important}'
            + cssText
            + '</style></head><body><main class="' + cls + '">'
            + inner
            + '</main><script>' + subpagesJs.replace(/<\/script>/gi, '<\\/script>') + '<\/script></body></html>';

        if (statusEl) statusEl.textContent = '';
    }

    /* Rendu debounce, position de defilement preservee. */
    function schedule(page, frame, statusEl, delay) {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            let y = 0;
            try { y = frame.contentWindow.scrollY || 0; } catch (e) { }
            await render(page, frame, statusEl);
            frame.addEventListener('load', function once() {
                frame.removeEventListener('load', once);
                try { frame.contentWindow.scrollTo(0, y); } catch (e) { }
            });
        }, delay == null ? 260 : delay);
    }

    /* Edition d'un scalaire : on retouche le DOM de l'iframe sans reconstruire. */
    function pokeEngine(frame, page, node, field) {
        try {
            const doc = frame.contentDocument;
            if (!doc) return false;
            const all = doc.querySelectorAll('.lv-engine');
            let idx = -1, k = 0, found = -1;
            window.LvParse.walk(page, n => {
                if (n.type !== 'engine') return;
                if (n === node) found = k;
                k++;
            });
            idx = found;
            if (idx < 0 || idx >= all.length) return false;
            const art = all[idx];
            if (field === 'name') {
                const t = art.querySelector('.lv-name');
                if (!t) return false;
                t.textContent = node.name;
                return true;
            }
            if (field === 'meta') {
                const t = art.querySelector('.lv-meta');
                if (!t) return false;
                t.textContent = node.meta;
                return true;
            }
            if (field === 'box') {
                const t = art.querySelector('.lv-box');
                if (!t) return false;
                t.innerHTML = node.boxHtml;
                return true;
            }
            return false;
        } catch (e) { return false; }
    }

    function invalidate() { cssText = null; subpagesJs = null; }

    window.LvPreview = {
        render: render,
        schedule: schedule,
        pokeEngine: pokeEngine,
        invalidate: invalidate
    };
})();
