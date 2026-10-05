/* ========================================
   Modele de la vue isometrique du hub 3D (3D/index.html)
   Ce fichier se modifie a la main : la scene est reconstruite a chaque
   chargement par js/scene-iso.js, rien d'autre a toucher.

   Comment lire les couches :
   - une couche = une tranche horizontale du modele, de la plus basse (au sol)
     a la plus haute ;
   - dans une couche, chaque ligne est une rangee dans la longueur :
     la premiere ligne est la rangee du fond, la derniere celle face a vous
     (cote gauche de l'image) ;
   - dans une ligne, chaque caractere est un cube : le premier est a l'arriere,
     le dernier a l'avant (cote droit de l'image) ;
   - un point (.) ou une espace = pas de cube ; toute autre lettre renvoie a
     une couleur de la palette.
   Les lignes et les couches n'ont pas besoin d'avoir la meme longueur.
   ======================================== */

window.TD_SCENE = {
    // Lu par les lecteurs d'ecran a la place de l'image
    description: 'Une voiture IC 2020 assemblée cube par cube',

    // Une lettre = une couleur. C'est la teinte de la face gauche :
    // le dessus est eclairci et la face droite assombrie automatiquement.
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
        // 'plein' : cubes colores ; 'filaire' : aretes seules, faces cachees masquees
        style: 'plein',
        // Liseré sombre autour de chaque face (style 'plein' uniquement)
        contours: true,
        // Ombre portee sous le modele
        ombre: true,
        // Nombre de cases de sol libres autour du modele
        margeSol: 2,
        // Eclairage : part de blanc ajoutee au dessus (0 a 1),
        // luminosite de la face droite (0 a 1)
        dessus: 0.22,
        droite: 0.7
    },

    animation: {
        // Ordre de montage :
        // 'couches'  : de bas en haut, couche par couche
        // 'longueur' : de l'arriere vers l'avant, tranche par tranche
        // 'largeur'  : du fond vers vous, rangee par rangee
        ordre: 'couches',
        // 'chute' : les cubes tombent a leur place ; 'pop' : ils apparaissent en grossissant
        effet: 'chute',
        // Hauteur de chute, en cubes
        hauteur: 1.8,
        // Duree de l'arrivee d'un cube, en millisecondes
        duree: 550,
        // Temps entre deux cubes, en millisecondes
        ecart: 24,
        // Attente avant le premier cube, en millisecondes
        depart: 500
    }
};
