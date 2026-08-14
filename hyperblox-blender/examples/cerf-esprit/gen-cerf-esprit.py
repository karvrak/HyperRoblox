"""Cerf-esprit — exemple de créature organique HyperBlox/Blender.

Le gabarit de la méthode `references/organique.md` : torse lofté, membres au
squelette, fusion voxel (les jointures fondent), volumes sculptés, bois Neon
ramifiés en miroir, crinière en mèches, finition facettée « anime Roblox ».

    # dans Blender, via mcp__blender__execute_blender_code
    import sys, importlib
    LIB = r"<...>/.claude/skills/hyperblox-blender/lib"
    if LIB not in sys.path: sys.path.insert(0, LIB)
    import hyperblox as hb; importlib.reload(hb)
    GEN = r"<...>/hyperblox-blender/examples/cerf-esprit/gen-cerf-esprit.py"
    exec(compile(open(GEN, encoding="utf-8").read(), GEN, "exec"))

Repère Blender : Z en haut, le cerf regarde vers **+Y**. Garrot à ~3,9 studs,
bois jusqu'à ~7,6 : un boss, pas un mob.
"""

import os
import hyperblox as hb

DOSSIER = os.path.dirname(os.path.abspath(__file__))

# palette : deux teintes de corps + UN accent Neon
BLANC = (243, 244, 250)
NOIR = (38, 38, 44)
CYAN = (120, 235, 255)

hb.scene("CerfEsprit", DOSSIER)

# ---------------------------------------------------------------- les masses
# Torse : le galbe se contrôle section par section — poitrail large, taille
# creuse, croupe ronde. C'est ici que vit la « ligne » de l'animal.
torse = hb.loft("_torse", [
    ((0, -1.80, 3.15), 0.40, 0.50),   # croupe
    ((0, -1.20, 3.20), 0.52, 0.64),   # hanches
    ((0, -0.20, 3.10), 0.46, 0.56),   # taille — PLUS étroite, c'est elle qui dessine
    ((0,  0.70, 3.20), 0.56, 0.72),   # poitrail — le plus large
    ((0,  1.30, 3.35), 0.40, 0.54),   # épaules
])

# Cou et tête : des chaînes de squelette. Le cou DÉMARRE dans le torse pour
# que la fusion le soude ; la tête s'affine vers le museau.
cou = hb.squelette("_cou", [
    [(0, 1.20, 3.40, 0.34), (0, 1.70, 4.30, 0.27), (0, 2.00, 5.00, 0.23)],
])
tete = hb.loft("_tete", [
    ((0, 1.95, 5.10), 0.28, 0.30),    # nuque
    ((0, 2.35, 5.20), 0.26, 0.27),    # crâne
    ((0, 2.75, 5.00), 0.14, 0.15),    # museau
    ((0, 2.95, 4.95), 0.09, 0.10),    # nez
])

# Quatre pattes : longues et FINES — l'exagération fait le style. Chaque
# chaîne plonge dans le corps (z=3.1) pour se souder à la fusion.
pattes = hb.squelette("_pattes", [
    [( 0.32, 1.00, 3.10, 0.18), ( 0.35, 1.05, 2.00, 0.11), ( 0.35, 0.95, 1.10, 0.09), ( 0.35, 1.02, 0.35, 0.08)],
    [(-0.32, 1.00, 3.10, 0.18), (-0.35, 1.05, 2.00, 0.11), (-0.35, 0.95, 1.10, 0.09), (-0.35, 1.02, 0.35, 0.08)],
    [( 0.34, -1.30, 3.10, 0.20), ( 0.37, -1.55, 1.90, 0.11), ( 0.37, -1.35, 1.05, 0.09), ( 0.37, -1.45, 0.35, 0.08)],
    [(-0.34, -1.30, 3.10, 0.20), (-0.37, -1.55, 1.90, 0.11), (-0.37, -1.35, 1.05, 0.09), (-0.37, -1.45, 0.35, 0.08)],
])

# ------------------------------------------------- la fusion, puis les volumes
# Le geste qui sépare une créature d'un bonhomme de neige : une seule peau.
corps = hb.fusionner("Corps", [torse, cou, tete, pattes], voxel=0.11)

hb.sculpter(corps, centre=(0, 0.80, 2.95), rayon=1.00, gonfle=0.14)         # poitrail
hb.sculpter(corps, centre=(0, -0.25, 3.10), rayon=0.75, gonfle=-0.07)       # taille creuse
hb.sculpter(corps, centre=(0, -1.35, 3.35), rayon=0.75, gonfle=0.08)        # cuisses
hb.sculpter(corps, centre=(0, 2.40, 5.25), rayon=0.45, gonfle=0.05)         # joues
hb.sculpter(corps, centre=(0, 2.95, 4.95), rayon=0.35, vecteur=(0, 0.10, 0))  # museau tiré

# Le style : facettes assumées, ombrage plat. EN DERNIER.
hb.facetter(corps, cible=4200)
hb.piece(corps, couleur=BLANC, materiau="SmoothPlastic", fidelite="Hull",
         groupe="Cerf")

# ------------------------------------------------------------------ les sabots
# Hors fusion (autre couleur), simples cylindres réunis en UNE pièce.
sabots = hb.fusionner("Sabots", [
    hb.cylindre("_s1", 0.11, 0.36, ( 0.35, 1.02, 0.18), segments=12),
    hb.cylindre("_s2", 0.11, 0.36, (-0.35, 1.02, 0.18), segments=12),
    hb.cylindre("_s3", 0.11, 0.36, ( 0.37, -1.45, 0.18), segments=12),
    hb.cylindre("_s4", 0.11, 0.36, (-0.37, -1.45, 0.18), segments=12),
])
hb.piece(sabots, couleur=NOIR, materiau="SmoothPlastic", groupe="Cerf")

# ------------------------------------------------------------------- les bois
# Une maîtresse + des branches qui démarrent sur ses points, côté DROIT
# seulement — le miroir donne l'autre. Fusion simple : c'est UNE pièce Neon.
bois = hb.fusionner("Bois", [
    hb.corne("_b0", [(0.16, 2.15, 5.40), (0.30, 1.95, 6.30), (0.44, 1.65, 7.10)], 0.075),
    hb.corne("_b1", [(0.22, 2.05, 5.90), (0.10, 2.40, 6.60), (0.06, 2.60, 7.00)], 0.050),
    hb.corne("_b2", [(0.30, 1.95, 6.30), (0.52, 2.20, 6.90)], 0.045),
    hb.corne("_b3", [(0.38, 1.78, 6.80), (0.32, 1.40, 7.55)], 0.045),
])
hb.miroir(bois, "X")
hb.facetter(bois, cible=1400)
hb.piece(bois, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Cerf")

# --------------------------------------------------------------- la crinière
# Quelques mèches épaisses qui ondulent et se chevauchent — jamais cent poils.
# Nuque, poitrail, et la queue en panache : même pièce, même couleur.
criniere = hb.fusionner("Criniere", [
    hb.corne("_m1", [(0.00, 1.30, 3.80), ( 0.06, 0.85, 3.95), ( 0.02, 0.40, 3.80)], 0.16),
    hb.corne("_m2", [(0.00, 1.62, 4.40), (-0.06, 1.15, 4.60), (-0.02, 0.75, 4.45)], 0.14),
    hb.corne("_m3", [(0.00, 1.90, 4.95), ( 0.05, 1.50, 5.20), ( 0.00, 1.12, 5.10)], 0.12),
    hb.corne("_m4", [(0.00, 1.55, 3.05), ( 0.05, 1.95, 2.60), ( 0.00, 1.88, 2.10)], 0.15),
    hb.corne("_q1", [(0.00, -1.85, 3.30), ( 0.08, -2.60, 3.50), ( 0.02, -3.30, 3.30)], 0.20),
    hb.corne("_q2", [(0.00, -1.90, 3.15), (-0.10, -2.70, 3.00), (-0.04, -3.20, 2.60)], 0.16),
    hb.corne("_q3", [(0.00, -1.85, 3.40), ( 0.05, -2.40, 3.90), ( 0.00, -3.00, 4.10)], 0.13),
])
hb.facetter(criniere, cible=1800)
hb.piece(criniere, couleur=BLANC, materiau="SmoothPlastic", collision=False,
         groupe="Cerf")

# ----------------------------------------------------- oreilles, yeux, marques
# Plus fins que le voxel : ils resteraient dans la fusion, donc ils vivent
# dehors. Les oreilles sont des lofts APLATIS (rx >> rz).
oreilles = hb.fusionner("Oreilles", [
    hb.loft("_og", [(( 0.20, 1.95, 5.30), 0.10, 0.05), (( 0.34, 1.82, 5.70), 0.08, 0.03),
                    (( 0.44, 1.74, 5.95), 0.02, 0.01)]),
    hb.loft("_od", [((-0.20, 1.95, 5.30), 0.10, 0.05), ((-0.34, 1.82, 5.70), 0.08, 0.03),
                    ((-0.44, 1.74, 5.95), 0.02, 0.01)]),
])
hb.piece(oreilles, couleur=BLANC, materiau="SmoothPlastic", collision=False,
         groupe="Cerf")

yeux = hb.fusionner("Yeux", [
    hb.sphere("_yg", 0.075, ( 0.19, 2.48, 5.18), segments=14, anneaux=8),
    hb.sphere("_yd", 0.075, (-0.19, 2.48, 5.18), segments=14, anneaux=8),
])
hb.piece(yeux, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Cerf")

# Le losange lumineux sur la hanche : une boîte fine tournée de 45°.
marques = hb.fusionner("Marques", [
    hb.boite("_lg", (0.05, 0.26, 0.26), ( 0.50, -1.15, 3.35), rotation=(45, 0, 0)),
    hb.boite("_ld", (0.05, 0.26, 0.26), (-0.50, -1.15, 3.35), rotation=(45, 0, 0)),
])
hb.piece(marques, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Cerf")

# ---------------------------------------------------------------- l'animation
# Pas de rig dans ce pipeline : l'esprit FLOTTE — la respiration d'un boss de
# menu. `position` en studs Roblox (Y = vertical).
hb.animation("Flotter", 3.0, [
    {"target": "Cerf",
     "keyframes": [
         {"t": 0.0, "position": [0, 0, 0], "easing": "easeInOut"},
         {"t": 1.5, "position": [0, 0.12, 0], "easing": "easeInOut"},
         {"t": 3.0, "position": [0, 0, 0]},
     ]},
], boucle=True)

# -------------------------------------------------------------------- sortie
hb.rapport()
hb.export()
hb.sauver()
