"""Borne d'arcade — exemple de générateur HyperBlox/Blender.

C'est le fichier à lancer en premier pour éprouver l'installation : il touche à
tout le pipeline — formes, biseau, réseau, booléen, tube, miroir, groupes,
animation — sans dépasser quelques milliers de triangles.

    # dans Blender, via mcp__blender__execute_blender_code
    import sys, importlib
    LIB = r"<...>/.claude/skills/hyperblox-blender/lib"
    if LIB not in sys.path: sys.path.insert(0, LIB)
    import hyperblox as hb; importlib.reload(hb)
    GEN = r"<...>/hyperblox-blender/examples/borne-arcade/gen-borne-arcade.py"
    exec(compile(open(GEN, encoding="utf-8").read(), GEN, "exec"))

Repère Blender : Z en haut. La borne regarde vers **+Y**, ce qui la fera
regarder vers -Z (l'avant) dans Roblox.
"""

import os
import hyperblox as hb

DOSSIER = os.path.dirname(os.path.abspath(__file__))

# palette
ANTHRACITE = (44, 44, 52)
ROUGE = (178, 58, 50)
JAUNE = (232, 196, 88)
VERRE = (198, 224, 240)
NEON = (255, 238, 150)
CHROME = (176, 182, 190)

hb.scene("BorneArcade", DOSSIER)

# ---------------------------------------------------------------- le corps
socle = hb.boite("Socle", (3.0, 2.0, 0.4), (0, 0, 0.2))
hb.biseau(socle, 0.04)
hb.piece(socle, couleur=ANTHRACITE, materiau="Metal", fidelite="Box")

caisson = hb.boite("Caisson", (2.6, 1.7, 3.2), (0, 0, 2.0))
# la fente à monnaie : un booléen, et l'outil reste dans la scène — donc
# réglable — parce qu'il n'est jamais déclaré comme pièce.
fente = hb.boite("_fente", (0.5, 0.4, 0.09), (0, 0.9, 1.15))
hb.booleen(caisson, fente)
hb.biseau(caisson, 0.05)
hb.piece(caisson, couleur=ROUGE, materiau="SmoothPlastic", fidelite="Box")

# ------------------------------------------------------------- l'affichage
vitre = hb.boite("Vitre", (1.9, 0.08, 1.4), (0, 0.86, 2.9))
hb.piece(vitre, couleur=VERRE, materiau="Glass", transparence=0.55,
         collision=False, rendu="Precise")

# ------------------------------------------------------------ les commandes
tablette = hb.boite("Tablette", (2.4, 0.7, 0.16), (0, 1.0, 2.05), rotation=(-8, 0, 0))
hb.biseau(tablette, 0.03)
hb.piece(tablette, couleur=ANTHRACITE, materiau="SmoothPlastic")

# le manche : un tube lissé, pas trois cylindres bout à bout
manche = hb.tube("Manche", [(-0.62, 1.02, 2.14), (-0.62, 1.02, 2.36),
                            (-0.60, 1.00, 2.52)], rayon=0.045)
hb.piece(manche, couleur=CHROME, materiau="Metal", collision=False)

boule = hb.sphere("Boule", 0.13, (-0.60, 1.00, 2.58), segments=20, anneaux=12)
hb.piece(boule, couleur=ROUGE, materiau="SmoothPlastic", collision=False)

# trois boutons d'un coup : un réseau, pas trois objets
bouton = hb.cylindre("Boutons", 0.115, 0.07, (0.15, 1.0, 2.16), segments=20)
hb.reseau(bouton, 3, (0.32, 0, 0))
hb.piece(bouton, couleur=JAUNE, materiau="SmoothPlastic", collision=False)

# ------------------------------------------------------------- le capot
# tout ce qui bouge vit dans un groupe : c'est le groupe que l'animation vise.
capot = hb.boite("Capot", (2.62, 1.72, 0.5), (0, 0, 3.9))
hb.biseau(capot, 0.06)
hb.piece(capot, couleur=ANTHRACITE, materiau="Metal", groupe="Capot")

enseigne = hb.boite("Enseigne", (1.6, 0.1, 0.34), (0, 0.82, 4.05))
hb.piece(enseigne, couleur=NEON, materiau="Neon", groupe="Capot",
         collision=False, rendu="Precise")

# ------------------------------------------------------------ l'animation
# `pivot` en coordonnées BLENDER (converti à l'export), `rotation` en degrés
# ROBLOX (l'axe vertical y est Y). Charnière à l'arrière du capot :
# une rotation positive autour de X relève l'avant.
hb.animation("Ouvrir", 1.1, [
    {"target": "Capot",
     "pivot": (0, -0.86, 3.9),
     "keyframes": [
         {"t": 0.0, "rotation": [0, 0, 0], "easing": "easeOutBack"},
         {"t": 1.1, "rotation": [72, 0, 0]},
     ]},
])
hb.animation("Fermer", 0.7, [
    {"target": "Capot",
     "pivot": (0, -0.86, 3.9),
     "keyframes": [
         {"t": 0.0, "rotation": [72, 0, 0], "easing": "easeIn"},
         {"t": 0.7, "rotation": [0, 0, 0]},
     ]},
])

# ------------------------------------------------------------------ sortie
hb.rapport()
hb.export()
hb.sauver()
