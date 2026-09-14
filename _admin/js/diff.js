/* =========================================================================
   diff.js — Diff ligne a ligne pour la modale de pre-sauvegarde.
   Prefixe/suffixe communs elimines d'abord, LCS seulement sur le reste :
   sur une page de 3000 lignes ou 1 ligne change, le LCS porte sur 1 ligne.
   ========================================================================= */
(function () {
    'use strict';

    function lcsMatrix(A, B) {
        const n = A.length, m = B.length;
        const M = [];
        for (let i = 0; i <= n; i++) M.push(new Uint32Array(m + 1));
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                M[i][j] = A[i] === B[j] ? M[i + 1][j + 1] + 1
                    : Math.max(M[i + 1][j], M[i][j + 1]);
            }
        }
        return M;
    }

    /* -> [{op:' '|'-'|'+', a, b, text}] sur la zone divergente uniquement */
    function diffLines(oldText, newText) {
        const A = oldText.split('\n'), B = newText.split('\n');
        let s = 0;
        while (s < A.length && s < B.length && A[s] === B[s]) s++;
        let e = 0;
        while (e < A.length - s && e < B.length - s
            && A[A.length - 1 - e] === B[B.length - 1 - e]) e++;

        const a = A.slice(s, A.length - e), b = B.slice(s, B.length - e);
        const ops = [];

        /* Garde-fou : au-dela de 4000 lignes divergentes, on n'essaie pas
           d'aligner — c'est de toute facon un diff a refuser. */
        if (a.length > 4000 || b.length > 4000) {
            a.forEach((t, i) => ops.push({ op: '-', a: s + i + 1, text: t }));
            b.forEach((t, i) => ops.push({ op: '+', b: s + i + 1, text: t }));
        } else {
            const M = lcsMatrix(a, b);
            let i = 0, j = 0;
            while (i < a.length && j < b.length) {
                if (a[i] === b[j]) { ops.push({ op: ' ', a: s + i + 1, b: s + j + 1, text: a[i] }); i++; j++; }
                else if (M[i + 1][j] >= M[i][j + 1]) { ops.push({ op: '-', a: s + i + 1, text: a[i] }); i++; }
                else { ops.push({ op: '+', b: s + j + 1, text: b[j] }); j++; }
            }
            while (i < a.length) { ops.push({ op: '-', a: s + i + 1, text: a[i] }); i++; }
            while (j < b.length) { ops.push({ op: '+', b: s + j + 1, text: b[j] }); j++; }
        }

        const removed = ops.filter(o => o.op === '-').length;
        const added = ops.filter(o => o.op === '+').length;
        return { ops: ops, removed: removed, added: added, contextStart: s };
    }

    /* Ajoute `ctx` lignes de contexte autour de la zone divergente et
       remplace les longues plages identiques par un marqueur de repli. */
    function withContext(diff, oldText, newText, ctx) {
        ctx = ctx == null ? 3 : ctx;
        const A = oldText.split('\n'), B = newText.split('\n');
        const s = diff.contextStart;

        const head = [];
        for (let i = Math.max(0, s - ctx); i < s; i++) head.push({ op: ' ', a: i + 1, b: i + 1, text: A[i] });

        const lastA = diff.ops.reduce((m, o) => o.a ? o.a : m, s);
        const lastB = diff.ops.reduce((m, o) => o.b ? o.b : m, s);
        const tail = [];
        for (let k = 0; k < ctx && lastA + k < A.length; k++) {
            tail.push({ op: ' ', a: lastA + k + 1, b: lastB + k + 1, text: A[lastA + k] });
        }

        const rows = head.concat(diff.ops, tail);
        const out = [];
        let run = 0;
        for (const r of rows) {
            if (r.op === ' ') {
                run++;
                if (run > ctx * 2) { if (out[out.length - 1] !== null) out.push(null); continue; }
            } else { run = 0; }
            out.push(r);
        }
        return out;   // `null` = repli « … »
    }

    window.LvDiff = { diffLines: diffLines, withContext: withContext };
})();
