/* =========================================================================
   fs.js — Acces disque via la File System Access API.

   Point critique : `Blob.text()` supprimerait silencieusement un BOM UTF-8,
   ce qui le ferait disparaitre a la reecriture. On decode donc nous-memes
   avec {ignoreBOM:true} : un eventuel BOM fait partie de la chaine et est
   reecrit tel quel. Le depot est aujourd'hui uniformise en CRLF sans BOM,
   mais l'outil preserve a l'identique ce qu'il lit, quel que soit l'etat.
   Les CRLF sont preserves car on n'y touche jamais.
   ========================================================================= */
(function () {
    'use strict';

    let root = null;                 // FileSystemDirectoryHandle du depot
    const dirCache = new Map();      // 'mltc/livrees_pages' -> handle
    const stat = new Map();          // path -> {size, lastModified}

    const DEC = new TextDecoder('utf-8', { ignoreBOM: true });
    const ENC = new TextEncoder();

    /* ---- persistance du handle (IndexedDB, indisponible en file://) ----- */
    const DB = 'lv-admin', STORE = 'handles';

    function idb() {
        return new Promise((res, rej) => {
            let rq;
            try { rq = indexedDB.open(DB, 1); }
            catch (e) { return rej(e); }
            rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
            rq.onsuccess = () => res(rq.result);
            rq.onerror = () => rej(rq.error);
        });
    }
    async function idbSet(key, val) {
        try {
            const db = await idb();
            await new Promise((res, rej) => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).put(val, key);
                tx.oncomplete = res; tx.onerror = () => rej(tx.error);
            });
            return true;
        } catch (e) { return false; }
    }
    async function idbGet(key) {
        try {
            const db = await idb();
            return await new Promise((res, rej) => {
                const tx = db.transaction(STORE, 'readonly');
                const rq = tx.objectStore(STORE).get(key);
                rq.onsuccess = () => res(rq.result);
                rq.onerror = () => rej(rq.error);
            });
        } catch (e) { return null; }
    }

    async function ensurePermission(handle, write) {
        const opts = { mode: write ? 'readwrite' : 'read' };
        if ((await handle.queryPermission(opts)) === 'granted') return true;
        return (await handle.requestPermission(opts)) === 'granted';
    }

    /* ---- connexion ------------------------------------------------------ */

    function isSupported() {
        return typeof window.showDirectoryPicker === 'function';
    }

    async function connect() {
        const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'lv-admin-root' });
        await adopt(h);
        await idbSet('root', h);
        return h.name;
    }

    async function restore() {
        const h = await idbGet('root');
        if (!h) return null;
        if (!(await ensurePermission(h, true))) return null;
        await adopt(h);
        return h.name;
    }

    async function adopt(h) {
        /* Verification minimale : c'est bien le depot du site. */
        await h.getDirectoryHandle('mltc');
        root = h;
        dirCache.clear();
        stat.clear();
    }

    function isConnected() { return root != null; }
    function rootName() { return root ? root.name : null; }

    /* ---- navigation ----------------------------------------------------- */

    async function dirHandle(path, create) {
        if (!root) throw new Error('Dossier non connecte');
        if (!path) return root;
        if (dirCache.has(path)) return dirCache.get(path);
        let h = root;
        for (const part of path.split('/')) {
            if (!part) continue;
            h = await h.getDirectoryHandle(part, { create: !!create });
        }
        dirCache.set(path, h);
        return h;
    }

    async function fileHandle(path, create) {
        const i = path.lastIndexOf('/');
        const dir = await dirHandle(i < 0 ? '' : path.slice(0, i), create);
        return dir.getFileHandle(i < 0 ? path : path.slice(i + 1), { create: !!create });
    }

    async function exists(path) {
        try { await fileHandle(path); return true; }
        catch (e) { return false; }
    }

    async function listDir(path, ext) {
        const dir = await dirHandle(path);
        const out = [];
        for await (const [name, h] of dir.entries()) {
            if (h.kind !== 'file') continue;
            if (ext && !name.toLowerCase().endsWith(ext)) continue;
            out.push(name);
        }
        return out.sort((a, b) => a.localeCompare(b, 'fr'));
    }

    /* ---- lecture / ecriture --------------------------------------------- */

    async function readText(path) {
        const fh = await fileHandle(path);
        const f = await fh.getFile();
        stat.set(path, { size: f.size, lastModified: f.lastModified });
        return DEC.decode(await f.arrayBuffer());
    }

    /* Le fichier a-t-il change sur le disque depuis sa lecture ? */
    async function isStale(path) {
        const s = stat.get(path);
        if (!s) return false;
        const f = await (await fileHandle(path)).getFile();
        return f.size !== s.size || f.lastModified !== s.lastModified;
    }

    async function writeText(path, text, opts) {
        opts = opts || {};
        if (!opts.force && await isStale(path)) {
            const e = new Error('Le fichier a ete modifie sur le disque depuis son ouverture');
            e.code = 'STALE';
            throw e;
        }
        const fh = await fileHandle(path, !!opts.create);
        const w = await fh.createWritable();
        await w.write(ENC.encode(text));
        await w.close();

        /* Verification apres ecriture : relecture et comparaison stricte. */
        const f = await fh.getFile();
        const back = DEC.decode(await f.arrayBuffer());
        if (back !== text) {
            const e = new Error('Verification apres ecriture echouee sur ' + path);
            e.code = 'VERIFY';
            throw e;
        }
        stat.set(path, { size: f.size, lastModified: f.lastModified });
        return true;
    }

    /* ---- images ---------------------------------------------------------- */

    const IMG_BASE = 'mltc/livrees_pages/livrees_img';
    let imgIndex = null;             // Map folder -> [{name, path, rel}]
    let imgByPath = null;            // 'livrees_img/xx/y.png' -> {name, folder, handle}
    const urlCache = new Map();

    async function indexImages(onProgress) {
        const base = await dirHandle(IMG_BASE);
        const byFolder = new Map();
        const byPath = new Map();
        for await (const [folder, dh] of base.entries()) {
            if (dh.kind !== 'directory') continue;
            const files = [];
            for await (const [name, fh] of dh.entries()) {
                if (fh.kind !== 'file' || !/\.png$/i.test(name)) continue;
                const rel = 'livrees_img/' + folder + '/' + name;
                const rec = { name: name, folder: folder, rel: rel, handle: fh };
                files.push(rec);
                byPath.set(rel, rec);
            }
            files.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
            byFolder.set(folder, files);
            if (onProgress) onProgress(folder, files.length);
        }
        imgIndex = new Map([...byFolder.entries()].sort((a, b) => a[0].localeCompare(b[0])));
        imgByPath = byPath;
        return imgIndex;
    }

    function images() { return imgIndex; }
    function imageRec(rel) { return imgByPath ? imgByPath.get(rel) || null : null; }
    function hasImage(rel) { return !!imageRec(rel); }

    /* Compagnon miroir : <base>_R.png */
    function companionR(rel) {
        if (!rel || /_R\.png$/i.test(rel)) return null;
        const cand = rel.replace(/\.png$/i, '_R.png');
        return hasImage(cand) ? cand : null;
    }

    async function imageURL(rel) {
        if (urlCache.has(rel)) return urlCache.get(rel);
        const rec = imageRec(rel);
        if (!rec) return null;
        const url = URL.createObjectURL(await rec.handle.getFile());
        urlCache.set(rel, url);
        return url;
    }
    function releaseURLs() {
        for (const u of urlCache.values()) URL.revokeObjectURL(u);
        urlCache.clear();
    }

    window.LvFs = {
        isSupported: isSupported,
        connect: connect,
        restore: restore,
        isConnected: isConnected,
        rootName: rootName,
        dirHandle: dirHandle,
        fileHandle: fileHandle,
        exists: exists,
        listDir: listDir,
        readText: readText,
        writeText: writeText,
        isStale: isStale,
        indexImages: indexImages,
        images: images,
        imageRec: imageRec,
        hasImage: hasImage,
        companionR: companionR,
        imageURL: imageURL,
        releaseURLs: releaseURLs,
        IMG_BASE: IMG_BASE
    };
})();
