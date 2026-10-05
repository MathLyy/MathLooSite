/* MLTC - Circulations : fichier unique de la carte (mltc/circulations.html),
   de la page Trafic (mltc/trafic.html) et des bandeaux animés.

   Livré en .js et non en .json pour fonctionner aussi quand une page est
   ouverte par double-clic (file://), où le navigateur bloque la lecture
   des fichiers .json. Garder la première ligne de code et le point-virgule
   final tels quels ; entre les deux, c'est du JSON strict : guillemets
   droits, aucune virgule après le dernier élément d'une liste.
   Mode d'emploi : clé "_aide" juste en dessous. */
window.MLTC_CIRCULATIONS = {
  "_aide": [
    "Fichier unique de la carte Circulations (mltc/circulations.html) et de la page Trafic (mltc/trafic.html). Les clés qui commencent par _ sont ignorées.",
    "Images : chemins relatifs à mltc/livrees_pages/livrees_img/, dossier compris (ex. \"nocrail/A-NRBR186.png\").",
    "Nombre : \"2*X.png\" ajoute 2 fois X ; \"2-4*X.png\" en ajoute 2, 3 ou 4 au hasard.",
    "Choix : \"A.png|B.png\" prend A ou B au hasard.",
    "Sens : \"G.png>D.png\" prend G quand le train roule vers la gauche, D vers la droite (la carte montre le sens gauche).",
    "Mélange : \"SHUFFLE{A.png, B.png}\" mélange le lot ; avec un nombre, c'est le nombre total tiré du lot. Combinable : \"2-3*SHUFFLE{A.png>A_R.png|B.png, C.png}\".",
    "Attelage entre deux rames : {\"coupler\": \"TGVcouple.png\"} (image de mltc/assets/, options overlap et bottom en pixels).",
    "Carte : name, route (liste des gares), detail (matériel) et countries sont facultatifs. Sans countries, le train ne circule que sur la page Trafic.",
    "Pays reconnus : France, Royaume-Uni, Belgique, Pays-Bas, Luxembourg, Allemagne, Danemark, Espagne, Italie, Autriche, République tchèque, Suisse.",
    "Animation : direction (L, R ou any, défaut any), speed (km/h), track (image de mltc/assets/voies/, défaut voie_bois.png), decor, reverse_composition, reverse_departure, start_stationary, starting_speed, y_offset, background, foreground.",
    "Décor : decor est une image de mltc/assets/decors/ répétée le long de la voie. Une caténaire passe derrière la voie, atténuée ; un troisième rail est posé sur la voie (réglage \"on_track\" dans la clé decors ci-dessous). false pour aucun décor ; sans decor, un simple fil passe au-dessus des engins de 58 px. Se règle aussi par service dans defaults.",
    "Gare : station {at, length, platform, building, building_x}. Le quai (platform, image de mltc/assets/quais/, défaut quai.png) est répété length fois et posé sur la voie ; le bâtiment (building, image de mltc/assets/gares/) est centré sur le quai, décalé de building_x pixels. at : \"50%\" place le centre du quai, un nombre son bord gauche. Quai et bâtiment sont atténués, au fond, derrière les trains d'arrière-plan.",
    "decors : réglages des images de décor. \"on_track\": true pour un décor posé sur la voie (troisième rail) plutôt que derrière elle (caténaire).",
    "Arrêt : stop {at (pixels ou \"40%\"), duration, loco_change, detach_count, detach_position, attach, attach_position, attach_self_detach_count}.",
    "variants : autres versions du même train. La page Trafic tire au sort entre la base et ses variantes. Chaque clé d'une variante remplace celle de la base, null la supprime. Sur la carte, une variante n'apparaît que si elle a ses propres countries : on découpe ainsi un trajet en tronçons (ex. Class 92 jusqu'à Lille, puis BR 186). Si son arrêt change la rame (loco_change, detach_count, attach), la carte montre la rame d'après l'arrêt.",
    "historiques : services d'avant 2001 (CCFM, WME, MSER). Leurs trains ne s'affichent qu'avec le filtre Historique, sur la carte comme sur la page Trafic. Sur la carte, la période historique ne couvre que France, Royaume-Uni, Benelux, Allemagne, Danemark, Suisse et Italie, et se découpe en quatre époques : epoques (ex. [\"1958-1973\", \"1973-1984\"]) dit lesquelles ; sans epoques, le train apparaît dans les quatre.",
    "defaults : réglages par service, appliqués quand un train ne les précise pas."
  ],
  "historiques": ["CCFM", "WME", "MSER"],
  "decors": {"3R.png": {"on_track": true}},
  "defaults": {
    "HSX": {"speed": 320, "track": "voie_beton.png"},
    "Xpress": {"speed": 170},
    "Nocrail": {"speed": 160},
    "TransRegio": {"speed": 100},
    "Vivarail": {"speed": 300},
    "Frail": {"speed": 140},
    "Urbahn": {"speed": 130},
    "Intracity": {"speed": 100},
    "SanGo!": {"speed": 140},
    "CFP": {"speed": 120},
    "MLCC": {"speed": 100},
    "MLUP": {"speed": 130},
    "MLTC Infrastructures": {"speed": 100}
  },
  "services": {
    "HSX": [
      {
        "route": ["Paris", "Reims", "Metz", "Luxembourg"],
        "detail": "TGV M",
        "countries": ["France", "Luxembourg"],
        "composition": ["hsx/B-HSXTGVM.png"],
        "speed": 320,
        "track": "voie_beton.png"
      },
      {
        "route": ["Lille", "Paris", "Tours", "Poitiers", "Bordeaux"],
        "detail": "TGV RD + TGV POS",
        "countries": ["France"],
        "composition": [
          "SHUFFLE{hsx/B-HSXTGVDuplex.png, hsx/B-HSXTGVRD.png}",
          {"coupler": "TGVcouple.png"},
          "SHUFFLE{hsx/B-HSXTGVDuplex.png, hsx/B-HSXTGVR.png, hsx/B-HSXTGVPOS.png, hsx/B-HSXTGVRD.png}"
        ],
        "reverse_composition": true
      },
      {
        "route": ["Madrid", "Córdoba", "Sevilla"],
        "detail": "S-112",
        "countries": ["Espagne"],
        "composition": ["hsx/B-HSXS112.png"]
      },
      {
        "route": ["Amsterdam", "Rotterdam", "Antwerp", "Bruxelles"],
        "detail": "ICE 3 Neo",
        "countries": ["Belgique", "Pays-Bas"],
        "composition": ["hsx/B-HSXICE3Neo.png"]
      },
      {
        "route": [
          "Hamburg",
          "Lüneburg",
          "Hanover",
          "Göttingen",
          "Kassel",
          "Fulda",
          "Würzburg",
          "Nuremberg",
          "Ingolstadt",
          "Munich"
        ],
        "detail": "ICE Duplex",
        "countries": ["Allemagne"],
        "composition": ["hsx/B-HSXET.png", {"coupler": "ICE2couple.png"}, "hsx/B-HSXET.png"],
        "speed": 270
      },
      {
        "route": ["Aachen", "Köln", "Frankfurt", "Mannheim", "Karlsruhe", "Baden-Baden", "Freiburg", "Basel"],
        "detail": "ICE 1",
        "countries": ["Allemagne"],
        "composition": ["hsx/B-HSXICE1.png"],
        "speed": 280
      }
    ],
    "Xpress": [
      {
        "name": "Xpress s'Elsass 220",
        "route": ["Basel", "Mulhouse", "Colmar", "Strasbourg"],
        "detail": "Class 91 Alsace + Mk4 Alsace \"Intercity 225\"",
        "countries": ["Suisse", "France"],
        "composition": [
          "xpress/A-XCL91als.png>xpress/A-XCL91als_R.png",
          "2*xpress/C-XMk4FOals.png",
          "xpress/C-XMk4RFMals.png",
          "5*xpress/C-XMk4TSOals.png",
          "xpress/C-XMk4DVTals_R.png>xpress/C-XMk4DVTals.png"
        ],
        "speed": 220,
        "reverse_composition": true
      },
      {
        "route": ["Avignon", "Arles", "Marseille"],
        "detail": "Z 2000",
        "countries": ["France"],
        "composition": ["1-2*xpress/B-XZ2000.png"],
        "speed": 200,
        "track": "voie_beton.png"
      },
      {
        "route": ["Amsterdam", "Zwolle"],
        "detail": "Z 2000",
        "countries": ["Pays-Bas"],
        "composition": ["1-2*xpress/B-XZ2000.png"],
        "speed": 160,
        "track": "voie_beton.png"
      },
      {
        "route": ["Bordeaux", "Limoges", "Clermont-Ferrand", "Saint-Étienne", "Lyon"],
        "detail": "TGV Turboméca Duplex",
        "countries": ["France"],
        "composition": [
          "xpress/A-XMotriceTGVTM.png>xpress/A-XMotriceTGVTM_R.png",
          "xpress/C-XTronçonTGVDC.png",
          "xpress/A-XMotriceTGVTM_R.png>xpress/A-XMotriceTGVTM.png"
        ],
        "speed": 160
      },
      {
        "route": ["Angers", "Nantes", "Saint-Nazaire", "Pornichet", "Le Croisic"],
        "detail": "IC4",
        "countries": ["France"],
        "composition": ["2*xpress/B-XIR4.png"],
        "speed": 160
      },
      {
        "composition": ["1-2*xpress/B-XBR403(I).png"],
        "speed": 200
      },
      {
        "composition": [
          "xpress/A-XRh1044.5.png",
          "3*xpress/C-XNG88A10.png",
          "xpress/C-XNG88B5r.png",
          "5*xpress/C-XNG88B11.png",
          "xpress/C-XNG88B7Dx_R.png>xpress/C-XNG88B7Dx.png"
        ],
        "speed": 180,
        "reverse_composition": true
      },
      {
        "composition": [
          "xpress/A-XE464.png>xpress/A-XE464_R.png",
          "2*xpress/C-XNG88A10.png",
          "xpress/C-XNG88B5r.png",
          "4*xpress/C-XNG88B11.png",
          "xpress/C-XNG88B7Dx_R.png>xpress/C-XNG88B7Dx.png"
        ],
        "speed": 160,
        "reverse_composition": true
      },
      {
        "name": "Paris - Strasbourg",
        "countries": ["France"],
        "composition": [
          "xpress/A-XBB26000.png",
          "2*xpress/C-XVE2NA13.png",
          "xpress/C-XVE2NB8rtux.png",
          "4*xpress/C-XVE2NB15.png",
          "xpress/C-XVE2NB12Dux_R.png>xpress/C-XVE2NB12Dux.png"
        ],
        "speed": 160,
        "reverse_composition": true
      },
      {
        "route": ["Newcastle", "Carlisle", "Dumfries", "Kilmarnock", "Glasgow"],
        "detail": "Class 68 + Mk4",
        "countries": ["Royaume-Uni"],
        "composition": [
          "xpress/A-XCL68.png",
          "2*xpress/C-XMk4FO.png",
          "xpress/C-XMk4RFM.png",
          "4*xpress/C-XMk4TSO.png",
          "xpress/C-XMk4DVT_R.png>xpress/C-XMk4DVT.png"
        ],
        "speed": 120,
        "variants": [
          {
            "composition": [
              "xpress/A-XCL89.png",
              "2*xpress/C-XMk4FO.png",
              "xpress/C-XMk4RFM.png",
              "4*xpress/C-XMk4TSO.png",
              "xpress/C-XMk4DVT_R.png>xpress/C-XMk4DVT.png"
            ],
            "stop": {"at": 400, "duration": 3, "loco_change": "xpress/A-XCL68.png"}
          }
        ]
      },
      {
        "composition": [
          "xpress/A-XVectronMS_U.png>xpress/A-XVectronMS_U_R.png",
          "xpress/C-XIC2000AD.png>xpress/C-XIC2000AD_R.png",
          "2*xpress/C-XIC2000A.png",
          "xpress/C-XIC2000WRB.png",
          "5*xpress/C-XIC2000B.png",
          "xpress/C-XIC2000Bt_R.png>xpress/C-XIC2000Bt.png"
        ],
        "speed": 200,
        "reverse_composition": true
      },
      {
        "route": [
          "London",
          "Peterborough",
          "Grantham",
          "Doncaster",
          "York",
          "Darlington",
          "Durham",
          "Newcastle",
          "Edinburgh"
        ],
        "detail": "Class 91 + Mk4 \"Intercity 225\"",
        "countries": ["Royaume-Uni"],
        "composition": [
          "xpress/A-XCL91.png>xpress/A-XCL91_R.png",
          "2*xpress/C-XMk4FO.png",
          "xpress/C-XMk4RFM.png",
          "5*xpress/C-XMk4TSO.png",
          "xpress/C-XMk4DVT_R.png>xpress/C-XMk4DVT.png"
        ],
        "reverse_composition": true
      },
      {
        "route": ["Bruxelles", "Aalst", "Gent", "Aalter", "Brugge", "Oostende"],
        "detail": "E401 + Voitures allemandes + USI II",
        "countries": ["Belgique"],
        "composition": [
          "xpress/A-XE401.png>xpress/A-XE401_R.png",
          "xpress/C-XApmz123.png",
          "xpress/C-XAvmz109.png",
          "xpress/C-XUSI2A5B5.png",
          "xpress/C-XUSI2B5r.png",
          "3*xpress/C-XUSI2B10.png",
          "xpress/C-XBpmbdzf_R.png>xpress/C-XBpmbdzf.png"
        ],
        "reverse_composition": true
      },
      {
        "route": ["Terneuzen", "Gent"],
        "detail": "UM IC3",
        "countries": ["Belgique", "Pays-Bas"],
        "composition": ["2*xpress/B-XIC3.png"]
      },
      {
        "route": ["Maastricht", "Liège", "Namur", "Charleroi", "La Louvière", "Mons", "Tournai", "Lille"],
        "detail": "BB 36000 + Corail VU",
        "countries": ["Belgique", "Pays-Bas", "France"],
        "composition": [
          "xpress/A-XBB36000.png",
          "3*xpress/C-XNG88A10.png",
          "xpress/C-XViaggioAR.png",
          "xpress/C-XViaggioB.png",
          "5*xpress/C-XVE2NB15.png"
        ]
      }
    ],
    "Nocrail": [
      {
        "name": "Hambourg - Le Grau du Roi / Montpellier",
        "countries": ["Allemagne", "France"],
        "composition": [
          "nocrail/A-NRBR186.png",
          "2*nocrail/C-NRWLABmz76.94.png",
          "4*nocrail/C-NRVE2NSuperT2.png",
          "nocrail/C-NRWRmz88.png",
          "nocrail/C-NRCorailVUA9c9ux.png",
          "nocrail/C-NRCorailVUB10c10ux.png",
          "nocrail/C-NRCorailVUB7Suh.png",
          "nocrail/C-NRCorailVUA9c9ux.png"
        ],
        "direction": "R",
        "speed": 160,
        "variants": [
          {
            "name": "Hambourg - Le Grau du Roi / Montpellier (dissociation tranche Nimes - Le Grau du Roi)",
            "speed": 120,
            "stop": {"at": 3200, "duration": 3, "loco_change": "nocrail/A-NRD445.png", "detach_count": 10}
          },
          {
            "name": "Hambourg - Le Grau du Roi (tranche Nimes)",
            "composition": [
              "nocrail/A-NRD445.png",
              "nocrail/C-NRCorailVUB7Suh.png",
              "nocrail/C-NRCorailVUA9c9ux.png"
            ],
            "speed": 60
          }
        ]
      },
      {
        "name": "Calais - Perpignan",
        "countries": ["France"],
        "composition": ["nocrail/B-NRTGVPSEN.png"],
        "speed": 300,
        "track": "voie_beton.png"
      },
      {
        "name": "Paris - Briançon",
        "countries": ["France"],
        "composition": [
          "2*nocrail/A-NRD445.png",
          "2*nocrail/D-NRUass.png",
          "3-5*nocrail/C-NRCorailVUA9c9ux.png",
          "SHUFFLE{nocrail/C-NRWRmz88.png, nocrail/C-NRCorailVUB7Suh.png}",
          "4*nocrail/C-NRCorailVUB10c10ux.png"
        ],
        "speed": 100,
        "track": "voie_beton.png"
      },
      {
        "name": "Strasbourg - Bordeaux",
        "countries": ["France"],
        "composition": [
          "nocrail/A-NRCL43.png>nocrail/A-NRCL43_R.png",
          "4*nocrail/C-NRMk4NS.png",
          "nocrail/C-NRMk3RFM.png",
          "6*nocrail/C-NRMk3SLEP.png",
          "nocrail/A-NRCL43_R.png>nocrail/A-NRCL43.png"
        ],
        "speed": 200
      },
      {
        "name": "Amsterdam - Brest / Arcachon",
        "countries": ["Pays-Bas", "France"],
        "composition": [
          "nocrail/B-NRBmx.png>nocrail/B-NRBmx_R.png",
          "6*SHUFFLE{nocrail/C-NRWLABmz76.94.png, nocrail/C-NRWLABmz76.94_R.png}",
          "nocrail/B-NRBmx_R.png>nocrail/B-NRBmx.png",
          "nocrail/B-NRBmx.png>nocrail/B-NRBmx_R.png",
          "6*SHUFFLE{nocrail/C-NRWLABmz76.94.png, nocrail/C-NRWLABmz76.94_R.png}",
          "nocrail/B-NRBmx_R.png>nocrail/B-NRBmx.png"
        ],
        "speed": 200,
        "variants": [
          {
            "name": "Amsterdam - Brest / Arcachon (dissociation rame Paris - Arcachon)",
            "speed": 120,
            "stop": {"at": "45%", "duration": 5, "detach_count": 8}
          }
        ]
      },
      {
        "name": "Paris - Hendaye (via Toulouse)",
        "countries": ["France"],
        "composition": [
          "nocrail/B-NRmDDM.png>nocrail/B-NRmDDM_R.png",
          "6*nocrail/C-NRVE2NSuperT2.png",
          "nocrail/B-NRmDDM_R.png>nocrail/B-NRmDDM.png"
        ],
        "speed": 140
      },
      {
        "name": "Luxembourg - Hendaye (via Lyon)",
        "countries": ["Luxembourg", "France"],
        "composition": [
          "nocrail/A-NRBB20006.png",
          "2*nocrail/D-NRDDm915.png",
          "4*nocrail/C-NRUICFB8c.png",
          "nocrail/C-NRWRmz88.png",
          "4*nocrail/C-NRUICFVL.png",
          "nocrail/C-NRCorailVUB10c10ux.png"
        ],
        "speed": 100
      },
      {
        "name": "Glasgow - Strasbourg",
        "countries": ["Royaume-Uni", "France"],
        "composition": [
          "nocrail/A-NRCL92.png",
          "nocrail/C-NRMk3RFM.png",
          "4*nocrail/C-NRMk4NS.png",
          "nocrail/C-NRMk4NSvs.png",
          "6*nocrail/C-NRMk4NSvl.png"
        ],
        "speed": 140,
        "variants": [
          {
            "name": "Glasgow - Strasbourg (changement de locomotive)",
            "stop": {"at": "40%", "duration": 3, "loco_change": "nocrail/A-NRBB25500.png", "detach_count": 1}
          }
        ]
      },
      {
        "name": "Amsterdam - Dresden",
        "countries": ["Pays-Bas", "Allemagne"],
        "composition": [
          "SHUFFLE{boreale/A-BLVectronDM.png, boreale/A-BLEuroDual.png}",
          "nocrail/C-NRTalgoVI.png"
        ],
        "speed": 160
      },
      {
        "name": "Paris - Dusseldorf",
        "countries": ["France", "Allemagne"],
        "composition": [
          "nocrail/A-NRBR181.2.png",
          "5*nocrail/C-NRCorailVUA9c9ux.png",
          "nocrail/C-NRWRmz88.png",
          "4*nocrail/C-NRCorailVUB10c10ux.png",
          "nocrail/C-NRCorailVUB7Suh.png"
        ],
        "speed": 160
      },
      {
        "name": "Napoli - Bordeaux",
        "countries": ["Italie", "France"],
        "composition": [
          "nocrail/A-NRE464.png>nocrail/A-NRE464_R.png",
          "4*SHUFFLE{nocrail/C-NRCorailVUA9c9ux.png, nocrail/C-NRUICFVL.png, nocrail/C-NRMk3SLEP.png}",
          "nocrail/C-NRMk3RFM.png",
          "4*SHUFFLE{nocrail/C-NRUICFB8c.png, nocrail/C-NRCorailVUB10c10ux.png, nocrail/C-NRVE2NSuperT2.png}",
          "nocrail/C-NRCorailVUB7Suh.png"
        ],
        "speed": 140,
        "variants": [
          {
            "name": "Napoli - Bordeaux (changement de locomotive)",
            "stop": {"at": "40%", "duration": 3, "loco_change": "nocrail/A-NRBB36000.png", "detach_count": 1}
          }
        ]
      },
      {
        "route": [
          "København",
          "Hamburg",
          "Hannover",
          "Frankfurt",
          "Strasbourg",
          "Dijon",
          "Lyon",
          "Nîmes",
          "Montpellier",
          "Toulouse",
          "Bordeaux"
        ],
        "detail": "BB 36000 + Talgo VI",
        "countries": ["Danemark", "France", "Allemagne"],
        "composition": ["nocrail/A-NRBB36000.png", "nocrail/C-NRTalgoVI.png"],
        "speed": 160,
        "track": "voie_beton.png"
      },
      {
        "name": "Reggio de Calabre - Ljubljana",
        "countries": ["Italie"],
        "composition": [
          "nocrail/A-NRE464.png>nocrail/A-NRE464_R.png",
          "nocrail/C-NRTalgoVI.png",
          "nocrail/A-NRE464_R.png>nocrail/A-NRE464.png"
        ],
        "speed": 160
      },
      {
        "name": "Hendaye - Stuttgart",
        "countries": ["France", "Allemagne"],
        "composition": [
          "nocrail/A-NRBR181.2.png",
          "nocrail/A-NRCL43.png>nocrail/A-NRCL43_R.png",
          "5*nocrail/C-NRMk3SLEP.png",
          "nocrail/C-NRMk3RFM.png",
          "3*nocrail/C-NRMk4NS.png",
          "nocrail/A-NRCL43_R.png"
        ],
        "speed": 160,
        "variants": [
          {
            "composition": [
              "nocrail/A-NRCL43.png>nocrail/A-NRCL43_R.png",
              "5*nocrail/C-NRMk3SLEP.png",
              "nocrail/C-NRMk3RFM.png",
              "3*nocrail/C-NRMk4NS.png",
              "nocrail/A-NRCL43_R.png"
            ]
          }
        ]
      },
      {
        "name": "Nordstern",
        "route": [
          "Edinburgh",
          "York",
          "Doncaster",
          "Peterborough",
          "London",
          "Lille",
          "Bruxelles",
          "Antwerp",
          "Rotterdam",
          "Amsterdam",
          "Bremen",
          "Hamburg"
        ],
        "detail": "Class 92 (→ Lille) / BR 186 (Lille →) + UIC-F + Mk3 + Mk4",
        "countries": ["Royaume-Uni", "France"],
        "composition": [
          "nocrail/A-NRCL92.png",
          "5*nocrail/C-NRUICFVL.png",
          "nocrail/C-NRMk3RFM.png",
          "4*nocrail/C-NRUICFB8c.png",
          "nocrail/C-NRMk4NSvs.png",
          "2*nocrail/C-NRMk4NSvl.png"
        ],
        "speed": 140,
        "variants": [
          {
            "countries": ["Pays-Bas", "Allemagne", "Belgique", "France"],
            "stop": {"at": "40%", "duration": 3, "loco_change": "nocrail/A-NRBR186.png", "detach_count": 1}
          }
        ]
      },
      {
        "route": [
          "Brest",
          "Rennes",
          "Le Mans",
          "Paris",
          "Strasbourg",
          "Karlsruhe",
          "Stuttgart",
          "Nürnberg",
          "Leipzig",
          "Berlin"
        ],
        "detail": "UM TGV PSE Tritension Nocturne",
        "countries": ["France", "Allemagne"],
        "composition": ["nocrail/B-NRTGVPSEN.png", {"coupler": "TGVcouple.png"}, "nocrail/B-NRTGVPSEN.png"],
        "speed": 300,
        "track": "voie_beton.png"
      }
    ],
    "TransRegio": [
      {
        "route": [
          "Strasbourg",
          "Kehl",
          "Offenburg",
          "Lahr",
          "Emmendingen",
          "Freiburg",
          "Bad Krozingen",
          "Müllheim",
          "Weil am Rhein",
          "Basel"
        ],
        "detail": "BB 20200 + DBvq",
        "countries": ["France", "Allemagne", "Suisse"],
        "composition": [
          "tr/A-TRBB20200_V.png",
          "2*tr/C-TRDBvq_R.png>tr/C-TRDBvq.png|tr/C-TRDBvq2s_R.png>tr/C-TRDBvq2s.png"
        ],
        "speed": 100,
        "reverse_composition": true,
        "stop": {"at": 1500, "duration": 3}
      },
      {
        "composition": ["1-3*tr/B-TRValado_2C.png|tr/B-TRValado_3C.png"],
        "speed": 100
      },
      {
        "route": [
          "Manchester",
          "Salford Crescent",
          "Eccles",
          "Patricroft",
          "Urmston",
          "Chassen Road",
          "Flixton",
          "Humphrey Park",
          "Trafford Park",
          "West Kirby"
        ],
        "detail": "Class 377/7",
        "countries": ["Royaume-Uni"],
        "composition": ["2*tr/B-TRCL377.7.png"],
        "speed": 160
      },
      {
        "route": ["Liège", "Flémalle", "Huy", "Andenne", "Namur", "Gembloux", "Fleurus", "Charleroi"],
        "detail": "ETR 521",
        "countries": ["Belgique"],
        "composition": ["2*tr/B-TRETR521.png"],
        "speed": 160
      },
      {
        "composition": ["1-2*tr/B-TRRSp1.png"],
        "speed": 100
      },
      {
        "composition": ["1-4*tr/B-TRZ23000.png"],
        "speed": 100
      },
      {
        "composition": ["1-2*tr/B-TRBR798.png", "0-1*tr/C-TRVB141.png"],
        "speed": 100
      },
      {
        "composition": [
          "tr/A-TRBB73000_U.png>tr/A-TRBB73000_U_R.png",
          "3-5*tr/C-TRDPCnB.png",
          "0-1*tr/C-TRDPCnAB.png",
          "tr/C-TRDPCnpB_R.png>tr/C-TRDPCnpB.png"
        ],
        "speed": 140
      },
      {
        "composition": ["2*tr/B-TRAMR.png"],
        "speed": 140
      },
      {
        "composition": ["1-2*tr/B-TRBR640.png"],
        "speed": 100
      },
      {
        "route": [
          "Cuneo",
          "Borgo San Dalmazzo",
          "Robilante",
          "Vernante",
          "Limone Piemonte",
          "Vievola",
          "Saint-Dalmas-de-Tende",
          "Fontan-Saorge",
          "Breil-sur-Roya",
          "Sospel",
          "L'Escarène",
          "Peille",
          "Nice"
        ],
        "detail": "ER 20 + N-wagen",
        "countries": ["France", "Italie"],
        "composition": [
          "tr/A-TROER20.png",
          "0-2*tr/C-TRNWAB.png",
          "2-4*tr/C-TRNWB.png",
          "tr/C-TRNWBdnrzf_R.png>tr/C-TRNWBdnrzf.png"
        ],
        "speed": 140
      },
      {
        "name": "Bremen - Bremerhaven",
        "route": [
          "Bremerhaven",
          "Lunestedt",
          "Stubben",
          "Lübberstedt",
          "Oldenbüttel",
          "Osterholz-Scharmbeck",
          "Ritterhude",
          "Bremen"
        ],
        "detail": "BR 143 + RIO",
        "countries": ["Allemagne"],
        "composition": ["tr/A-TRBR143.png", "tr/C-TRRIO_R.png>tr/C-TRRIO.png"],
        "speed": 80,
        "reverse_composition": true,
        "stop": {"at": 500, "duration": 3}
      },
      {
        "composition": ["tr/B-TRBR670.png"],
        "speed": 100,
        "track": "voie_beton.png"
      },
      {
        "composition": ["1-3*tr/B-TRBR620.png"],
        "speed": 140
      },
      {
        "composition": ["1-3*tr/B-TRCL150.png"],
        "speed": 140
      },
      {
        "name": "Pwllheli - Llandudno Junction",
        "countries": ["Royaume-Uni"],
        "composition": ["1-3*tr/B-TRCL132.png"],
        "speed": 72
      },
      {
        "composition": ["2*tr/B-TRBR515.png"],
        "speed": 72
      },
      {
        "route": ["Edinburgh", "Linlithgow", "Falkirk", "Glasgow"],
        "detail": "Class 377/7",
        "countries": ["Royaume-Uni"],
        "composition": ["tr/B-TRCL377.7.png"]
      },
      {
        "route": ["London", "Woking", "Guildford", "Haslemere", "Petersfield", "Havant", "Portsmouth"],
        "detail": "UM Class 377/3",
        "countries": ["Royaume-Uni"],
        "composition": ["3*tr/B-TRCL377.3.png"]
      },
      {
        "route": [
          "Exeter",
          "Dawlish",
          "Teignmouth",
          "Totnes",
          "Ivybridge",
          "Plymouth",
          "Liskeard",
          "Bodmin",
          "St Austell",
          "Truro",
          "Redruth",
          "Camborne",
          "Penzance"
        ],
        "detail": "Class 57 + Mk2",
        "countries": ["Royaume-Uni"],
        "composition": [
          "tr/A-TRCL57.png",
          "tr/C-TRMk2FO.png",
          "3*tr/C-TRMk2TSO.png",
          "tr/C-TRMk2DBSO_R.png>tr/C-TRMk2DBSO.png"
        ],
        "reverse_composition": true
      }
    ],
    "Vivarail": [
      {
        "detail": "Série 1600 Benelux + Voitures Grand Confort",
        "countries": ["Pays-Bas", "Luxembourg", "Belgique"],
        "composition": [
          "vivarail/A-VNS1600BNL.png",
          "6*vivarail/C-VA2t6u.png",
          "vivarail/C-VA3rtux.png",
          "4*vivarail/C-VA9½tu.png",
          "vivarail/C-VB5Dux_R.png>vivarail/C-VB5Dux.png"
        ],
        "speed": 180,
        "reverse_composition": true
      },
      {
        "name": "Strasbourg - Londres",
        "countries": ["France", "Royaume-Uni"],
        "composition": ["vivarail/B-Ve300.png"],
        "speed": 300,
        "track": "voie_beton.png"
      },
      {
        "route": ["Bruxelles", "Lille", "Paris", "Le Mans", "Rennes"],
        "detail": "TGV PBA",
        "countries": ["France", "Belgique"],
        "composition": ["vivarail/B-VTGVPBA.png"],
        "speed": 320,
        "reverse_composition": true
      }
    ],
    "Frail": [
      {
        "name": "Perpignan",
        "countries": ["France"],
        "composition": ["2-3*frail/B-FRMS61.png"],
        "speed": 100
      },
      {
        "name": "Nîmes",
        "countries": ["France"],
        "composition": ["2*frail/B-FRProtos.png"],
        "speed": 140,
        "stop": {"at": 1800, "duration": 3}
      },
      {
        "name": "Saint-Etienne",
        "countries": ["France"],
        "composition": ["2*frail/B-FRB83500.png"],
        "speed": 160
      },
      {
        "countries": ["France"],
        "composition": [
          "frail/C-FRVB2N_Bx.png>frail/C-FRVB2N_Bx_R.png",
          "4-6*frail/C-FRVB2N_B.png",
          "frail/A-FRBB25500.png"
        ]
      }
    ],
    "Urbahn": [
      {
        "name": "Lausanne",
        "countries": ["Suisse"],
        "composition": ["2*urbahn/B-UBRe450NDW.png|urbahn/B-UBRe450NDW_R.png"],
        "speed": 130
      }
    ],
    "Intracity": [
      {
        "name": "Limoges",
        "detail": "RegioShuttle 1",
        "countries": ["France"],
        "composition": ["1-2*intracity/B-ICRS1.png"],
        "speed": 80,
        "reverse_departure": true,
        "stop": {"at": 1200, "duration": 5}
      },
      {
        "name": "Poitiers - Futuroscope",
        "detail": "Bem 550",
        "countries": ["France"],
        "composition": ["2*intracity/B-ICBem550.png"],
        "direction": "L",
        "speed": 100,
        "reverse_departure": true,
        "stop": {"at": 260, "duration": 5}
      },
      {
        "name": "Reims",
        "route": ["Reims", "Franchet d'Esperey", "Reims Maison Blanche", "Champagne-Ardenne TGV"],
        "composition": ["2*intracity/B-IC250.png"],
        "direction": "L",
        "speed": 100,
        "stop": {"at": "22%", "duration": 5},
        "station": {"at": "20%", "length": 3},
        "background": {
          "composition": ["2*intracity/B-IC250.png"],
          "direction": "R",
          "speed": 60,
          "start_stationary": {"at": "20%", "duration": 3}
        }
      },
      {
        "composition": ["intracity/B-ICTTFS.png"],
        "speed": 100
      }
    ],
    "SanGo!": [
      {
        "name": "Grandes Lignes",
        "route": ["Nîmes", "Avignon", "Orange", "Montélimar", "Valence"],
        "detail": "BB 9200 + Corail VTU",
        "countries": ["France"],
        "composition": [
          "SHUFFLE{sango/A-SanGoBB9300.png, sango/A-SanGoBB9200.png, sango/A-SanGoBB9200_site.png}",
          "0-1*sango/C-SanGoCorailMC76.png",
          "5-6*SHUFFLE{sango/C-SanGoCorailVTU_site.png, sango/C-SanGoCorailVTU.png, sango/C-SanGoCorailVU_site.png, sango/C-SanGoCorailVU.png}",
          "sango/C-SanGoCorailVTUB10r.png",
          "sango/C-SanGoCorailVUB6Dux_R.png>sango/C-SanGoCorailVUB6Dux.png"
        ],
        "speed": 160,
        "reverse_composition": true
      },
      {
        "composition": [
          "sango/A-SanGoBB67400.png",
          "0-1*sango/C-SanGoCorailMC76.png",
          "3-4*SHUFFLE{sango/C-SanGoCorailVTU_site.png, sango/C-SanGoCorailVTU.png, sango/C-SanGoCorailVU_site.png, sango/C-SanGoCorailVU.png}",
          "sango/C-SanGoCorailVTUB10r.png"
        ],
        "speed": 140
      },
      {
        "name": "Grandes Lignes",
        "route": ["Clermont-Ferrand", "Ussel", "Brive-la-Gaillarde", "Cahors", "Montauban", "Toulouse"],
        "detail": "CC 72000 + Corail",
        "countries": ["France"],
        "composition": [
          "sango/A-SanGoCC72100.png",
          "sango/C-SanGoCorailMC76.png",
          "sango/C-SanGoCorailVTUB10r.png",
          "5-7*SHUFFLE{sango/C-SanGoCorailVTU_site.png, sango/C-SanGoCorailVTU.png, sango/C-SanGoCorailVU_site.png, sango/C-SanGoCorailVU.png}"
        ],
        "speed": 160
      },
      {
        "name": "Régional",
        "route": [
          "Clermont-Ferrand",
          "Clermont La Pardieu",
          "Issoire",
          "Le Breuil-sur-Couze",
          "Brassac-les-Mines - Sainte-Florine",
          "Arvant",
          "Massiac - Blesle",
          "Neussargues",
          "Murat",
          "Le Lioran",
          "Vic-sur-Cère",
          "Aurillac"
        ],
        "detail": "X 2200 + remorques",
        "countries": ["France"],
        "composition": [
          "sango/B-SanGoX2200.png",
          "1-2*sango/C-SanGoXR6100.png",
          "sango/C-SanGoXRx6200_R.png>sango/C-SanGoXRx6200.png"
        ],
        "speed": 120,
        "reverse_composition": true,
        "starting_speed": 75
      },
      {
        "name": "Régional",
        "route": [
          "Nîmes",
          "Saint-Cézaire",
          "Générac",
          "Beauvoisin",
          "Vauvert",
          "Le Cailar",
          "Aimargues",
          "Saint-Laurent-D'aigouze",
          "Aigues-Mortes",
          "Le Grau-du-Roi"
        ],
        "detail": "X 2200 + Remorques",
        "countries": ["France"],
        "composition": [
          "sango/B-SanGoX2200.png",
          "2*sango/C-SanGoXR6100PRD.png",
          "sango/C-SanGoXRx6200PRD_R.png>sango/C-SanGoXRx6200PRD.png"
        ],
        "speed": 60,
        "reverse_composition": true
      },
      {
        "name": "Régional",
        "route": [
          "Perpignan",
          "Le Soler",
          "Saint-Féliu-d'Avall",
          "Millas",
          "Ille-sur-Têt",
          "Vinça",
          "Marquixanes",
          "Prades - Molitg-les-Bains",
          "Ria",
          "Villefranche - Vernet-les-Bains"
        ],
        "countries": ["France"],
        "composition": ["2-3*sango/B-SanGoZ7300.png"],
        "speed": 100,
        "stop": {"at": "40%", "duration": 5},
        "station": {"at": "50%", "length": 4, "building": "3-BV_PLM_4e.png", "building_x": 300}
      },
      {
        "composition": [
          "SHUFFLE{sango/A-SanGoBB67400.png, sango/A-SanGoBB8500.png}",
          "1-2*SHUFFLE{sango/C-SanGoRRR_R.png>sango/C-SanGoRRR.png, sango/C-SanGoRIO88_R.png>sango/C-SanGoRIO88.png, sango/C-SanGoRIO_R.png>sango/C-SanGoRIO.png}"
        ],
        "speed": 120,
        "reverse_composition": true
      },
      {
        "name": "Régional",
        "route": [
          "Nîmes",
          "Nîmes Pont du Gard",
          "Tarascon",
          "Arles",
          "Saint-Martin-de-Crau",
          "Miramas",
          "Vitrolles",
          "Marseille"
        ],
        "detail": "BB 8500 + N-Wagen",
        "countries": ["France"],
        "composition": [
          "sango/A-SanGoBB8500.png",
          "4-6*sango/C-SanGoNWB.png",
          "sango/C-SanGoNWBdnrzf_R.png>sango/C-SanGoNWBdnrzf.png"
        ],
        "speed": 140,
        "reverse_composition": true,
        "stop": {"at": 1000, "duration": 3}
      },
      {
        "name": "TGV",
        "route": ["Lyon", "Valence", "Nîmes", "Montpellier", "Béziers", "Narbonne", "Carcassonne", "Toulouse"],
        "detail": "TGV PSE",
        "countries": ["France"],
        "composition": ["2*sango/B-SanGoTGVPSE.png"],
        "speed": 160
      },
      {
        "name": "TGV",
        "route": ["Montpellier", "Nîmes", "Valence", "Lyon", "Paris"],
        "detail": "TGV PSE",
        "countries": ["France"],
        "composition": ["2*SHUFFLE{sango/B-SanGoTGVPSE_H.png, sango/B-SanGoTGVPSE.png}"],
        "speed": 300,
        "track": "voie_beton.png"
      }
    ],
    "CFP": [
      {
        "route": ["Arreau-Cadéac", "Sarrancolin", "Hèches", "La Barthe-Azevac", "Lannemezan"],
        "detail": "Z 7100",
        "countries": ["France"],
        "composition": ["1-2*cfp/B-CFPZ7100.png>cfp/B-CFPZ7100_R.png"],
        "speed": 140
      },
      {
        "route": ["Foix", "Saint-Girons", "Salies-du-Salat", "Boussens"],
        "detail": "Aln 776 + Remorques",
        "countries": ["France"],
        "composition": [
          "cfp/B-CFPALn776.png>cfp/B-CFPALn776_R.png",
          "0-1*cfp/C-CFPXR6100.png",
          "cfp/C-CFPBbd499.png",
          "0-1*cfp/B-CFPALn776.png>cfp/B-CFPALn776_R.png"
        ],
        "speed": 70
      },
      {
        "route": ["Elne", "Le Boulou", "Céret", "Amélie-les-Bains", "Arles-sur-Tech"],
        "detail": "Z 7100 + Remorques",
        "countries": ["France"],
        "composition": [
          "SHUFFLE{cfp/B-CFPZ7100.png, cfp/B-CFPZ7100_R.png}",
          "0-2*cfp/C-CFPXR6100.png",
          "cfp/C-CFPBbd499.png",
          "cfp/B-CFPZ7100_R.png>cfp/B-CFPZ7100.png"
        ],
        "speed": 120
      },
      {
        "name": "Fret de proximité Ariège",
        "detail": "G 1000 + Laais",
        "countries": ["France"],
        "composition": ["cfp/A-CFPG1000.png", "3-6*cfp/D-CFPLaais.png"],
        "speed": 100
      },
      {
        "name": "Acheminement",
        "composition": [
          "cfp/A-CFPG1000.png",
          "1-2*cfp/B-CFPALn776.png>cfp/B-CFPALn776_R.png",
          "1-3*cfp/C-CFPXR6100.png"
        ],
        "speed": 100
      }
    ],
    "MLCC": [
      {
        "composition": ["mlcc/A-MLCCRh1064.png", "3-5*mlcc/D-MLCCFcs6541.png", "0-1*mlcc/D-MLCCS58_Gris.png"],
        "speed": 80
      },
      {
        "composition": ["mlcc/A-MLCCTmII_2.png", "0-2*mlcc/D-MLCCUerdingen30m3.png"],
        "speed": 30
      },
      {
        "composition": ["mlcc/A-MLCC2CC261000.png", "8-10*mlcc/D-MLCCFalrrs152.png"],
        "speed": 100
      },
      {
        "composition": [
          "SHUFFLE{mlcc/A-MLCCBB7200.png, mlcc/A-MLCCBR152.png, mlcc/A-MLCCBR156.png, mlcc/A-MLCCBR186.png, mlcc/A-MLCCBR189.png, mlcc/A-MLCCBR240.png, mlcc/A-MLCCBR285.png, mlcc/A-MLCCCC65500.png, mlcc/A-MLCCCC72000.png, mlcc/A-MLCCCL60.png, mlcc/A-MLCCEG.png, mlcc/A-MLCCE652.png, mlcc/A-MLCCRh1110.5.png}",
          "16-24*SHUFFLE{mlcc/D-MLCC_PGS58_Blanc.png, mlcc/D-MLCC_PGS58_Bleu.png, mlcc/D-MLCC_PGS58_BleuMarine.png, mlcc/D-MLCC_PGS58_Cyan.png, mlcc/D-MLCC_PGS58_Fuschia.png, mlcc/D-MLCC_PGS58_Gris.png, mlcc/D-MLCC_PGS58_Jaune.png, mlcc/D-MLCC_PGS58_Marron.png, mlcc/D-MLCC_PGS58_Noir.png, mlcc/D-MLCC_PGS58_Orange.png, mlcc/D-MLCC_PGS58_Pourpre.png, mlcc/D-MLCC_PGS58_Rose.png, mlcc/D-MLCC_PGS58_Rouge.png, mlcc/D-MLCC_PGS58_Vert.png, mlcc/D-MLCC_PGS58_VertForet.png, mlcc/D-MLCC_PGS58_Violet.png, mlcc/D-MLCC_PS58_Blanc.png, mlcc/D-MLCC_PS58_Bleu.png, mlcc/D-MLCC_PS58_BleuMarine.png, mlcc/D-MLCC_PS58_Cyan.png, mlcc/D-MLCC_PS58_Fuschia.png, mlcc/D-MLCCS58_Orange.png, mlcc/D-MLCCS58_Noir.png, mlcc/D-MLCCS58_Marron.png, mlcc/D-MLCCS58_Jaune.png, mlcc/D-MLCCS58_Gris.png, mlcc/D-MLCCS58_Fuschia.png, mlcc/D-MLCCS58_Cyan.png, mlcc/D-MLCCS58_BleuMarine.png, mlcc/D-MLCCS58_Bleu.png, mlcc/D-MLCCS58_Blanc.png, mlcc/D-MLCC_PS58_Violet.png, mlcc/D-MLCC_PS58_VertForet.png, mlcc/D-MLCC_PS58_Vert.png, mlcc/D-MLCC_PS58_Rouge.png, mlcc/D-MLCC_PS58_Rose.png, mlcc/D-MLCC_PS58_Pourpre.png, mlcc/D-MLCC_PS58_Orange.png, mlcc/D-MLCC_PS58_Noir.png, mlcc/D-MLCC_PS58_Marron.png, mlcc/D-MLCC_PS58_Jaune.png, mlcc/D-MLCC_PS58_Gris.png, mlcc/D-MLCCS58_Pourpre.png, mlcc/D-MLCCS58_Rose.png, mlcc/D-MLCCS58_Rouge.png, mlcc/D-MLCCS58_Vert.png, mlcc/D-MLCCS58_VertForet.png, mlcc/D-MLCCS58_Violet.png}"
        ],
        "speed": 100
      },
      {
        "composition": ["mlcc/A-MLCCBR204.png", "10-13*mlcc/D-MLCCZans.png"],
        "speed": 100
      },
      {
        "name": "Remonte rame Xpress",
        "detail": "Ee 922 + Voitures Xpress",
        "composition": [
          "mlcc/A-MLCCEe922.png",
          "xpress/C-XBpmbdzf.png>xpress/C-XBpmbdzf_R.png",
          "4-7*SHUFFLE{xpress/C-XBpmz291.png, xpress/C-XBpmz292.png, xpress/C-XBpmz295.png, xpress/C-XBvmz185.png, xpress/C-XApmz123.png, xpress/C-XApmz123.png, xpress/C-XCorailVTUB11.png}"
        ],
        "speed": 80
      },
      {
        "name": "Ferraille",
        "detail": "CC 65500 + Tombereaux",
        "countries": ["Allemagne"],
        "composition": [
          "mlcc/A-MLCCCC65500.png",
          "9-16*SHUFFLE{mlcc/D-MLCC_PEaos_2.png, mlcc/D-MLCC_PEaos_1.png, mlcc/D-MLCCEaos.png}"
        ],
        "speed": 80
      },
      {
        "composition": ["mlcc/A-MLCCEem923.png", "9*mlcc/D-MLCCUces.png"],
        "speed": 100
      },
      {
        "name": "Ciment",
        "detail": "BB 67400 + Wagons silos",
        "countries": ["France"],
        "composition": [
          "SHUFFLE{mlcc/A-MLCCBB75000.png, mlcc/A-MLCCBB67400.png, mlcc/A-MLCCG2000.png}",
          "15-20*SHUFFLE{mlcc/D-MLCCUces.png, mlcc/D-MLCC_PUces.png, mlcc/D-MLCCUcs.png, mlcc/D-MLCC_PUcs.png}"
        ],
        "speed": 100
      },
      {
        "composition": ["mlcc/A-MLCCCL67_s.png", "10*mlcc/D-MLCCRC4.png"],
        "speed": 100
      },
      {
        "composition": ["mlcc/A-MLCCG400.png", "1-3*mlcc/D-MLCC_PLaais.png"],
        "speed": 100
      },
      {
        "composition": [
          "SHUFFLE{mlcc/A-MLCCBB8500.png, mlcc/A-MLCCBR150.png, mlcc/A-MLCCBR155.png, mlcc/A-MLCCCL58.png, mlcc/A-MLCCCL37.png, mlcc/A-MLCCNS1200.png, mlcc/A-MLCCBB37000.png, mlcc/A-MLCCBB27000.png, mlcc/A-MLCCBB26000.png, mlcc/A-MLCCBB25500.png}",
          "12-16*SHUFFLE{mlcc/D-MLCC_PEaos_1.png, mlcc/D-MLCC_PEaos_2.png, mlcc/D-MLCC_PFcs6541_1.png, mlcc/D-MLCC_PFcs6541_2.png, mlcc/D-MLCCFcs6541.png, mlcc/D-MLCC_PKs70.6.png}"
        ],
        "speed": 100
      },
      {
        "composition": ["mlcc/A-MLCCCL60.png", "10-14*SHUFFLE{mlcc/D-MLCC_PKIA.png, mlcc/D-MLCCKIA.png}"],
        "speed": 100
      },
      {
        "composition": ["mlcc/A-MLCCCL77.png", "13-20*SHUFFLE{mlcc/D-MLCC_PJNA.png, mlcc/D-MLCCJNA.png}"],
        "speed": 100
      },
      {
        "composition": [
          "SHUFFLE{mlcc/A-MLCCCL90.png, boreale/A-BLCL57.png, mlcc/A-MLCCCL37.png, mlcc/A-MLCCCL58.png, mlcc/A-MLCCCL60.png, mlcc/A-MLCCCL67.png, mlcc/A-MLCCCL67_s.png}",
          "14-22*SHUFFLE{mlcc/D-MLCCHYA.png, mlcc/D-MLCC_PHYA.png}"
        ],
        "speed": 100
      }
    ],
    "MLUP": [
      {
        "name": "HighSpeedPost",
        "route": ["Hamburg", "Frankfurt"],
        "detail": "TGV Postal tritension",
        "countries": ["Allemagne"],
        "composition": ["mlup/B-MLUPTGVP_DE.png"],
        "speed": 160
      },
      {
        "composition": ["mlup/B-MLUPX2200P.png"],
        "speed": 130
      },
      {
        "composition": [
          "mlup/B-MLUPmP3000.png",
          "1-3*SHUFFLE{mlup/D-MLUPHbbkkss.png, mlup/D-MLUPZ350_R.png, mlup/D-MLUPZ350.png>mlup/D-MLUPZ350_R.png}"
        ],
        "speed": 120
      },
      {
        "composition": ["1-3*mlup/B-MLUPAMP.png"],
        "speed": 120
      },
      {
        "name": "MLUP Isère",
        "detail": "BB 25500 + PE26 + PA26",
        "countries": ["France"],
        "composition": ["mlup/A-MLUPBB25500PRD.png", "5-10*SHUFFLE{mlup/C-MLUPPE26.png, mlup/C-MLUPPA26.png}"],
        "speed": 140
      },
      {
        "composition": ["mlup/A-MLUPD445.png", "4-6*mlup/D-MLUPHbbkkss.png"],
        "speed": 100
      },
      {
        "composition": ["SHUFFLE{mlup/B-MLUPTGVP_DE.png, mlup/B-MLUPTGVP_FR.png, mlup/B-MLUPTGVP_NL.png}"],
        "speed": 300,
        "track": "voie_beton.png"
      }
    ],
    "MLTC Infrastructures": [
      {
        "composition": ["mltci/B-MLTCIDU84.png>mltci/B-MLTCIDU84_R.png", "0-1*mltci/C-MLTCIMauzinette.png"],
        "speed": 60
      },
      {
        "name": "Contrôle de l'infrastructure",
        "detail": "HST \"New Measurement Train\"",
        "countries": ["Royaume-Uni"],
        "composition": ["mltci/B-MLTCINMT.png"],
        "speed": 160
      },
      {
        "name": "Train de ballast",
        "detail": "BB 62400 + Fanps",
        "countries": ["Belgique"],
        "composition": ["mltci/A-MLTCIBB62400.png", "8-10*mltci/D-MLTCIFanps.png"],
        "speed": 100
      },
      {
        "name": "Chasse-neige",
        "detail": "CNS +  BB 62400",
        "countries": ["France"],
        "composition": ["mltci/A-MLTCICNS.png", "mltci/A-MLTCIBB62400.png"],
        "direction": "L",
        "speed": 80
      },
      {
        "name": "Contrôle de l'infrastructure",
        "detail": "Class 153 Infra",
        "countries": ["Royaume-Uni"],
        "composition": ["mltci/B-MLTCICL153.png"],
        "speed": 100
      },
      {
        "name": "Contrôle LGV",
        "detail": "Iris 320",
        "countries": ["France"],
        "composition": ["mltci/B-MLTCIIRIS320.png"],
        "speed": 320,
        "track": "voie_beton.png"
      }
    ],
    "CCFM": [],
    "WME": [],
    "MSER": []
  }
};
