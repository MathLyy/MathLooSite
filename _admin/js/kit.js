/* =========================================================================
   kit.js — Briques d'interface partagees (DOM, modales, notifications).
   ========================================================================= */
(function () {
    'use strict';

    /* el('div.card', {onclick}, [enfants]) */
    function el(spec, props, kids) {
        const m = /^([a-z0-9]+)?((?:[.#][-\w]+)*)$/i.exec(spec) || [];
        const node = document.createElement(m[1] || 'div');
        if (m[2]) {
            for (const tok of m[2].match(/[.#][-\w]+/g) || []) {
                if (tok[0] === '.') node.classList.add(tok.slice(1));
                else node.id = tok.slice(1);
            }
        }
        if (props) for (const k of Object.keys(props)) {
            const v = props[k];
            if (v == null || v === false) continue;
            if (k === 'text') node.textContent = v;
            else if (k === 'html') node.innerHTML = v;
            else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
            else if (k === 'dataset') Object.assign(node.dataset, v);
            else if (k in node && k !== 'title' && k !== 'list') node[k] = v;
            else node.setAttribute(k, v);
        }
        if (kids) for (const c of [].concat(kids)) {
            if (c == null || c === false) continue;
            node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        }
        return node;
    }

    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

    let toastTimer = null;
    function toast(msg, kind, ms) {
        const old = document.querySelector('.toast');
        if (old) old.remove();
        clearTimeout(toastTimer);
        const t = el('div.toast', { text: msg });
        if (kind) t.classList.add(kind);
        document.body.appendChild(t);
        toastTimer = setTimeout(() => t.remove(), ms || (kind === 'bad' ? 7000 : 3200));
    }

    /* modal({title, body:Node, footer:[Node], wide}) -> {close} */
    function modal(opts) {
        const bg = el('div.modal-bg');
        const box = el('div.modal');
        if (opts.width) box.style.maxWidth = opts.width;

        const close = () => {
            bg.remove();
            document.removeEventListener('keydown', onKey);
            if (opts.onclose) opts.onclose();
        };
        const onKey = e => { if (e.key === 'Escape') close(); };

        box.appendChild(el('header', {}, [
            el('h2', { text: opts.title || '' }),
            el('div.spacer'),
            el('button.btn.sm', { text: 'Fermer', onclick: close })
        ]));
        const body = el('div.body');
        if (opts.body) body.appendChild(opts.body);
        box.appendChild(body);
        if (opts.footer) box.appendChild(el('footer', {}, opts.footer));

        bg.appendChild(box);
        bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(bg);
        return { close: close, body: body, box: box };
    }

    function confirmModal(title, message, okLabel, danger) {
        return new Promise(res => {
            let done = false;
            const m = modal({
                title: title,
                body: el('div', { html: message }),
                onclose: () => { if (!done) res(false); },
                footer: [
                    el('div.spacer'),
                    el('button.btn', { text: 'Annuler', onclick: () => { done = true; m.close(); res(false); } }),
                    el('button.btn' + (danger ? '.danger' : '.primary'), {
                        text: okLabel || 'Confirmer',
                        onclick: () => { done = true; m.close(); res(true); }
                    })
                ]
            });
        });
    }

    function field(label, control, hint) {
        return el('div.field', {}, [
            el('label', { text: label }),
            control,
            hint ? el('div.dim', { text: hint, style: 'font-size:11.5px;margin-top:3px' }) : null
        ]);
    }

    function badge(level, text) {
        return el('span.badge.' + (level === 'error' ? 'err' : level), { text: text });
    }

    window.LvKit = {
        el: el, clear: clear, toast: toast, modal: modal,
        confirm: confirmModal, field: field, badge: badge
    };
})();
