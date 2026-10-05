# Outil admin — pages Livrées

Éditeur graphique local pour `mltc/livrees.html` et les pages de
`mltc/livrees_pages/`. Pas de Node, pas de `package.json`, pas d'étape de build :
c'est du HTML/CSS/JS vanilla qui écrit directement les fichiers du dépôt via la
File System Access API.

## Lancer

Le dossier commence par `_`, donc **Jekyll l'exclut du build GitHub Pages** :
l'outil est versionné dans git mais jamais publié.

**Recommandé** — via le serveur local déjà nécessaire au site (Live Server VS Code,
`python -m http.server`) :

    http://localhost:xxxx/_admin/

Sur `localhost`, IndexedDB fonctionne et l'autorisation du dossier est mémorisée
d'une session à l'autre.

**Alternative** — ouvrir `_admin/index.html` directement (`file://`). Fonctionne
aussi, mais IndexedDB est désactivé sur `file://` : il faut re-sélectionner le
dossier à chaque ouverture.

Navigateur : **Chrome ou Edge**. Firefox et Safari n'implémentent pas
`showDirectoryPicker`.

## Avant d'éditer

Committez ou stashez. **Git est le seul mécanisme d'annulation** — l'outil ne
crée aucun `.bak`. Après chaque enregistrement, relisez `git diff`.

## Principe

> Ce qui n'est pas édité est réémis octet pour octet.

Chaque nœud du modèle conserve sa chaîne source d'origine. Un nœud non modifié
est réécrit sans être regardé ; un scalaire modifié est corrigé par offsets à
l'intérieur de sa propre ligne ; seul un changement structurel déclenche un rendu
depuis le modèle, avec un format de sortie **hérité des nœuds frères** (un engin
ajouté dans `ccfm.html` sort minifié sur une ligne, le même dans `boreale.html`
sort indenté sur 18 lignes).

Conséquences directes :

- le head, la navbar, le sous-menu et le footer sont découpés comme des chaînes
  opaques et recollés tels quels — ils ne peuvent structurellement pas être
  modifiés (ce qui est indispensable : ils diffèrent d'une page à l'autre) ;
- l'encodage est préservé à l'identique — le dépôt est uniformisé en **CRLF
  sans BOM**, et l'outil réécrit exactement ce qu'il a lu quel que soit l'état ;
- éditer un engin dans une page de 76 engins produit un diff d'une seule ligne.

Tout markup non reconnu par le parseur devient un « bloc conservé tel quel » :
il round-trip intact et reste éditable en HTML brut.

## Auto-test

Le bouton **Auto-test** relit et réécrit les 21 pages sans aucune modification et
vérifie l'identité à l'octet près. **Il doit être vert avant toute session
d'édition** — c'est le test d'acceptation du parseur et du sérialiseur.

## Garde-fous à l'enregistrement

1. Les erreurs bloquantes (image introuvable, `id` dupliqué, ancre morte)
   empêchent l'écriture.
2. Le résultat est vérifié : head/footer intacts, HTML valide, re-parse cohérent
   (nombre d'engins et de sections), rendu idempotent.
3. Une **modale de diff** montre toutes les lignes changées avant l'écriture,
   sans seuil ni case à cocher : une réécriture volontaire et massive (on
   change beaucoup de choses d'un coup) n'est jamais bloquée, on peut juste
   relire le diff avant de confirmer.
4. Si le fichier a changé sur le disque depuis son ouverture (édité dans VS Code),
   l'écriture est refusée.
5. Après écriture, le fichier est relu et comparé octet pour octet.

## Intégrité inter-fichiers

Le bouton **Intégrité** croise les pages avec `mltc/data/circulations.js`,
`js/services-page.js` et les liens de `mltc/livrees.html`. **Lecture seule** :
l'éditeur Livrées n'écrit jamais ces fichiers, il se contente d'avertir. Le
rayon d'explosion d'un bug reste confiné au HTML des livrées.
`circulations.js` s'édite à part, dans l'éditeur Compositions (voir plus bas).

## Dernières nouveautés

Le bouton **Nouveautés** ouvre un éditeur manuel pour le bloc "Dernières
nouveautés" en haut de `mltc/livrees.html` (la liste à puces avec vignette,
nom, page/date, badge Nouveauté/Modification et lien). Chaque champ est
tapé ou choisi à la main — aucune détection automatique de date ou de
statut : ce bloc n'est pas modélisé par le parseur (comme le head ou la
navbar, `lv-changelog` n'existe pas dans `classify()`), il est donc lu et
réécrit comme un simple remplacement de texte, avec le même aperçu de diff
avant écriture que le reste de l'outil.

## Compositions

`compositions.html` (bouton **Compositions** de la barre du haut) édite
`mltc/data/circulations.js`, le fichier des trains de la carte Circulations,
de la page Trafic et des bandeaux. Même dossier connecté, même modale de diff
avant écriture, même refus si le fichier a changé sur le disque.

- **Liste** : les trains par service, avec recherche (nom, gare, image).
  Point jaune : modifié ; pastille rouge : image introuvable ou composition vide.
- **Composition** : une ligne par élément, la première est la tête du train.
  « + Véhicules » ouvre le catalogue de `livrees_img` : chaque clic ajoute au
  panier, dans l'ordre, et deux clics sur le même véhicule donnent « 2* ».
  Le nombre accepte `3` ou `2-4` ; une ligne peut devenir « Au choix » (`A|B`)
  ou « Mélange » (`SHUFFLE{…}`). Les images `_R` sont reprises toutes seules
  (`G>D`), ⇄ les échange pour un véhicule tourné vers l'arrière.
- **Aperçu** dans les deux sens, avec la rame après l'arrêt (changement de
  locomotive, dételage, attelage) ; **Tester en animation** fait tourner le
  moteur de la page Trafic avec ce seul train, sans enregistrer.
- **Variantes** : onglets Base / Variante n. Dans une variante, un champ
  modifié n'est écrit que dans la variante (repère violet, ↺ pour revenir à
  la base).
- **Services** : vitesse, voie et décor par défaut, période historique, ordre.
- **Décor** (carte Marche d'un train) : image de `mltc/assets/decors/`
  répétée le long de la voie, ou « Aucun ». Une caténaire passe derrière la
  voie, atténuée ; un troisième rail est posé sur la voie (réglage « Plan »
  du panneau Assets, clé `decors` du fichier). Sans décor, la page Trafic
  trace un simple fil au-dessus des engins de 58 px, comme avant.
- **Gare et quai** : quai de `mltc/assets/quais/` répété N fois (tronçons
  de 400 px) et posé sur le haut de la voie, bâtiment de `mltc/assets/gares/`
  posé sur le quai. Plans, du fond vers l'avant : bâtiment, caténaire, quai
  (tous trois atténués), voie, troisième rail, trains d'arrière-plan, train,
  premier plan. Les opacités sont dans `ALPHA` de `js/compositions.js`.
- **Assets** : les images de `mltc/assets` rangées par usage (décors, voies,
  quais, gares, attelages, premiers plans), avec un aperçu sur la voie et un engin de 58 px,
  la hauteur du fil de contact par rapport aux pantographes et la liste des
  trains qui les utilisent. « Importer des images… » copie des PNG dans le bon
  dossier ; « Supprimer » n'est possible que pour une image inutilisée. Ces
  deux actions écrivent directement sur le disque, sans passer par
  Enregistrer : relire `git status` ensuite.
- **Contrôle** : vérifie que le fichier se relit et se réécrit à l'identique,
  liste les images manquantes et les pays inconnus.

La mise en forme du JSON est celle du fichier d'origine (une valeur par
ligne au-delà de 110 colonnes) : un enregistrement ne touche que les trains
modifiés. Le commentaire d'en-tête et la ligne `window.MLTC_CIRCULATIONS =`
sont recollés tels quels.

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/scan.js` | scanner de source par offsets (aucun DOM) |
| `js/parse.js` | scan + DOMParser → modèle Page |
| `js/serialize.js` | modèle → texte, 3 niveaux, vérifications |
| `js/model.js` | mutations, fabriques de nœuds, formatage |
| `js/fs.js` | disque, BOM/CRLF, index des 1072 images |
| `js/diff.js` | diff ligne à ligne (LCS) |
| `js/validate.js` | contrôles intra-page |
| `js/integrity.js` | contrôles inter-fichiers (lecture seule) |
| `js/recent.js` | lecture/écriture manuelle du bloc "Dernières nouveautés" |
| `js/preview.js` | aperçu iframe à CSS et images inlinés |
| `js/kit.js` | briques d'interface |
| `js/ui.js`, `js/ui-extra.js` | interface |
| `js/circ-data.js` | lecture, mise en forme et syntaxe de `circulations.js` |
| `js/ui-compos.js` | interface de l'éditeur de compositions |
