# MathLoo - Portfolio Créatif

Site portfolio personnel rassemblant mes projets créatifs : worldbuilding, pixel art, modélisation 3D et plus.

## Contenu du site

- **Accueil** - Présentation générale et vue d'ensemble des projets
- **MLTC** - MathLy Travel Company, univers ferroviaire fictif développé depuis 2020 (histoire, livrées, circulations)
- **3D** - Hub des travaux en trois dimensions : modélisations voxel (MagicaVoxel) et autres projets 3D
- **Design** - Projets graphiques présentés un par un, du contexte au résultat final
- **Divers** - Fangame et dessins sans projet d'attache (masqué pour l'instant : liens commentés et pages redirigées vers l'accueil tant que la rubrique est vide)
- **Liens** - Ressources et sites externes

## Stack technique

- HTML / CSS / JavaScript (vanilla), sans build ni framework
- Thème clair / sombre avec persistance (`localStorage`)
- Polices : [DM Sans](https://fonts.google.com/specimen/DM+Sans) & [Syne](https://fonts.google.com/specimen/Syne)
- Design responsive

La navbar et le footer sont dupliqués en dur dans chaque page : toute modification
de la navigation doit être répercutée sur l'ensemble des fichiers HTML, y compris
`mltc/livrees_pages/boreale.html`, qui sert de modèle au back-office `_admin/`
pour créer de nouvelles pages de livrées.

## Structure

```
├── index.html               # Accueil : présentation + section Projets
├── liens.html               # Liens externes
├── css/                     # Feuilles de style
│   ├── style.css            #   socle : jetons, navbar, footer, boutons
│   ├── pages.css            #   pages intérieures : hero, grilles, lightbox, galerie
│   ├── hub-cards.css        #   cartes de hub, partagées par l'accueil, MLTC et Divers
│   ├── story.css            #   pages « article long » (récit illustré)
│   ├── design-hub.css       #   page d'entrée Design (hero, bande, cartes de projet)
│   ├── 3d-hub.css           #   page d'entrée 3D (fenêtre de vue isométrique, cartes)
│   └── mltc.css, ...        #   feuilles propres à la section MLTC
├── js/                      # Scripts
│   ├── main.js              #   thème, menu mobile, sous-menu MLTC, apparitions
│   └── story.js             #   lightbox et révélation au défilement (pages story)
├── mltc/                    # Section MLTC (histoire, livrées, circulations, opérateurs)
├── 3D/                      # Hub 3D
│   ├── index.html           #   hub
│   ├── voxel.html           #   modélisations voxel
│   ├── voxel/               #   images de la page voxel
│   └── projets-3d.html      #   autres projets 3D (masquée : aucun lien, en attente de contenu)
├── design/                  # Hub Design
│   ├── index.html           #   hub
│   ├── gabarit-projet.html  #   modèle de page projet, à dupliquer
│   ├── la-cour-des-grands.html  # projet de rentrée 2026 à Strate Lyon
│   └── lcdg/                #   images de La cour des grands (un dossier par projet, versions web)
├── divers/                  # Hub Divers (masqué temporairement)
│   ├── index.html           #   hub
│   ├── fangame.html         #   fangame Undertale (inachevé)
│   ├── dessins.html         #   galerie de dessins divers
│   ├── fangame/             #   images et audio du fangame
│   └── dessins_img/         #   images de la galerie
└── _admin/                  # Back-office local des livrées MLTC (Chrome / Edge)
```

### Ajouter un projet

- **Projet de design** : dupliquer `design/gabarit-projet.html`, déposer ses images dans un dossier dédié (comme `design/lcdg/`), remplir ses sections,
  puis remplacer un emplacement libre (`.dz-slot`) de `design/index.html` par une carte `.dz-project` (modèle en commentaire dans la page), avec son tag de domaine.
- **Projet 3D non voxel** : rendre à nouveau accessible `3D/projets-3d.html` (ajouter sa carte dans le hub 3D, retirer son `noindex`), y ajouter une carte, et une page
  dédiée si le projet le mérite (partir de `design/gabarit-projet.html`).

Toute page qui charge `css/story.css` doit aussi charger `js/story.js` : sans lui,
les blocs `.reveal` restent invisibles.

## Contact

mathloo.site@gmail.com

## Licence

© 2026 MathLoo. Tous droits réservés.
Site développé à l'aide d'une IA, pour le code uniquement. Les textes et les images sont créées par mes soins.
