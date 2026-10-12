/* ========================================
   Modèle de la vue isométrique du hub 3D (3D/index.html)
   Ce fichier se modifie à la main : la scène est reconstruite à chaque
   chargement par js/scene-iso.js, rien d'autre à toucher.

   Comment lire les couches :
   - une couche = une tranche horizontale du modèle, de la plus basse (au sol)
     à la plus haute ;
   - dans une couche, chaque ligne est une rangée dans la longueur :
     la première ligne est la rangée du fond, la dernière celle face à vous
     (côté gauche de l'image) ;
   - dans une ligne, chaque caractère est un cube : le premier est à l'arrière,
     le dernier à l'avant (côté droit de l'image) ;
   - un point (.) ou une espace = pas de cube ; toute autre lettre renvoie à
     une couleur de la palette.
   Les lignes et les couches n'ont pas besoin d'avoir la même longueur.
   ======================================== */

window.TD_SCENE = {
    // Lu par les lecteurs d'écran à la place de l'image
    description: 'Une voiture IC 2020 assemblée cube par cube',

    // Une lettre = une couleur. C'est la teinte de la face gauche :
    // le dessus est éclairci et la face droite assombrie automatiquement.
    palette: {
        'B': '#2b282a', // bogies et attelages
        'L': '#d0bfca', // bas de caisse
        'J': '#efb100', // jaune
        'N': '#333645', // bandeau des baies
        'T': '#4a4448'  // toit
    },

    couches: [
        [ // 1 : bogies, attelage au milieu de chaque about
            '.BB.....BB.',
            'BBB.....BBB',
            '.BB.....BB.'
        ],
        [ // 2 : bas de caisse, abouts jaunes
            'JLLLLLLLLLJ',
            'JLLLLLLLLLJ',
            'JLLLLLLLLLJ'
        ],
        [ // 3 : baies, alternance bandeau et jaune
            'NJNJNJNJNJN',
            'NJNJNJNJNJN',
            'NJNJNJNJNJN'
        ],
        [ // 4 : toit, abouts jaunes
            'JTTTTTTTTTJ',
            'JTTTTTTTTTJ',
            'JTTTTTTTTTJ'
        ]
    ],

    rendu: {
        // 'plein' : cubes colorés ; 'filaire' : arêtes seules, faces cachées masquées
        style: 'plein',
        // Liseré sombre autour de chaque face (style 'plein' uniquement)
        contours: true,
        // Ombre portée sous le modèle
        ombre: true,
        // Nombre de cases de sol libres autour du modèle
        margeSol: 2,
        // Éclairage : part de blanc ajoutée au dessus (0 à 1),
        // luminosité de la face droite (0 à 1)
        dessus: 0.22,
        droite: 0.7
    },

    animation: {
        // Ordre de montage :
        // 'couches'  : de bas en haut, couche par couche
        // 'longueur' : de l'arrière vers l'avant, tranche par tranche
        // 'largeur'  : du fond vers vous, rangée par rangée
        ordre: 'couches',
        // 'chute' : les cubes tombent à leur place ; 'pop' : ils apparaissent en grossissant
        effet: 'chute',
        // Hauteur de chute, en cubes
        hauteur: 1.8,
        // Durée de l'arrivée d'un cube, en millisecondes
        duree: 550,
        // Temps entre deux cubes, en millisecondes
        ecart: 24,
        // Attente avant le premier cube, en millisecondes
        depart: 500
    }
};
