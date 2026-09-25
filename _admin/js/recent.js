/* =========================================================================
   recent.js — Lecture/ecriture du bloc "Dernieres nouveautes" de
   mltc/livrees.html (la <ul class="lv-changelog-list"> de la page index).

   Purement manuel : ce module ne scanne pas les autres pages ni ne devine
   de dates, il se contente de parser les <li> existants pour pre-remplir
   un formulaire dans l'outil admin, et de reserialiser la liste editee.
   Le bloc n'est pas modelise par parse.js (lv-changelog n'existe pas dans
   classify()) : on le traite comme un remplacement de texte brut, au meme
   titre que les blocs "conserves tels quels" du reste de l'outil.
   ========================================================================= */
(function () {
    'use strict';

    const Fs = window.LvFs;

    const INDEX_PAGE = 'mltc/livrees.html';
    const OPEN = '<ul class="lv-changelog-list">';
    const CLOSE = '</ul>';

    const ITEM_RE = /<li class="lv-changelog-item">([\s\S]*?)<\/li>/g;
    const IMG_RE = /<img class="lv-changelog-thumb" src="([^"]*)" alt="([^"]*)"\s*\/>/;
    const NAME_RE = /<span class="lv-changelog-name">([\s\S]*?)<\/span>/;
    const META_RE = /<span class="lv-changelog-meta">([\s\S]*?)<\/span>/;
    const BADGE_RE = /<span class="lv-changelog-badge (lv-badge-new|lv-badge-update)">([\s\S]*?)<\/span>/;
    const LINK_RE = /<a href="([^"]*)" class="lv-changelog-link">/;

    function decode(s) {
        return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    }
    function encode(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function encodeAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

    function parseItem(block) {
        const img = IMG_RE.exec(block);
        const name = NAME_RE.exec(block);
        const meta = META_RE.exec(block);
        const badge = BADGE_RE.exec(block);
        const link = LINK_RE.exec(block);
        return {
            img: img ? img[1] : '',
            name: name ? decode(name[1]) : '',
            meta: meta ? decode(meta[1]) : '',
            status: badge && badge[1] === 'lv-badge-new' ? 'new' : 'update',
            href: link ? link[1] : ''
        };
    }

    function extractBlock(text) {
        const i = text.indexOf(OPEN);
        if (i < 0) throw new Error('Bloc <ul class="lv-changelog-list"> introuvable dans livrees.html');
        const j = text.indexOf(CLOSE, i);
        if (j < 0) throw new Error('</ul> du bloc lv-changelog-list introuvable');
        return { start: i + OPEN.length, end: j };
    }

    async function loadItems() {
        const text = await Fs.readText(INDEX_PAGE);
        const block = extractBlock(text);
        const inner = text.slice(block.start, block.end);
        const items = [];
        let m;
        ITEM_RE.lastIndex = 0;
        while ((m = ITEM_RE.exec(inner))) items.push(parseItem(m[1]));
        return { text: text, items: items };
    }

    function renderItem(it) {
        const I = ' '.repeat(24), I2 = ' '.repeat(28);
        const badgeClass = it.status === 'new' ? 'lv-badge-new' : 'lv-badge-update';
        const badgeText = it.status === 'new' ? 'Nouveauté' : 'Modification';
        return I + '<li class="lv-changelog-item">\n'
            + I2 + '<span class="lv-changelog-thumb-wrap"><img class="lv-changelog-thumb" src="'
            + encodeAttr(it.img) + '" alt="' + encodeAttr(it.name) + '" /></span>\n'
            + I2 + '<div class="lv-changelog-info">\n'
            + I2 + '    <span class="lv-changelog-name">' + encode(it.name) + '</span>\n'
            + I2 + '    <span class="lv-changelog-meta">' + encode(it.meta) + '</span>\n'
            + I2 + '</div>\n'
            + I2 + '<span class="lv-changelog-badge ' + badgeClass + '">' + badgeText + '</span>\n'
            + I2 + '<a href="' + encodeAttr(it.href) + '" class="lv-changelog-link">Voir</a>\n'
            + I + '</li>';
    }

    function applyItems(text, items) {
        const block = extractBlock(text);
        const inner = items.length
            ? '\n' + items.map(renderItem).join('\n') + '\n' + ' '.repeat(20)
            : '';
        return text.slice(0, block.start) + inner + text.slice(block.end);
    }

    window.LvRecent = {
        INDEX_PAGE: INDEX_PAGE,
        loadItems: loadItems,
        applyItems: applyItems
    };
})();
