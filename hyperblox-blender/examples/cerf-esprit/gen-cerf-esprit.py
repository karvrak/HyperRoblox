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
    g = {"__file__": GEN, "__name__": "__main__"}
    exec(compile(open(GEN, encoding="utf-8").read(), GEN, "exec"), g)

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
    ((0, 2.75, 5.04), 0.14, 0.15),    # museau
    ((0, 2.92, 5.02), 0.08, 0.09),    # nez — dans l'axe du museau, sinon il « tombe »
])

# Quatre pattes : longues et fines — mais JAMAIS plus fines que le voxel de la
# fusion, sinon elles fondent en fils. Chaque chaîne plonge dans le corps
# (z=3.1) pour se souder à la fusion.
# Des pattes avec de la MATIÈRE : cuisse charnue, canon net, et le bout qui
# plonge jusque dans le sabot (z=0.10) — la détente de la fusion rétracte les
# extrémités fines, le sabot avale ce qui reste.
pattes = hb.squelette("_pattes", [
    [( 0.34, 1.00, 3.10, 0.24), ( 0.36, 1.03, 2.00, 0.17), ( 0.36, 0.98, 1.10, 0.15), ( 0.36, 1.02, 0.10, 0.14)],
    [(-0.34, 1.00, 3.10, 0.24), (-0.36, 1.03, 2.00, 0.17), (-0.36, 0.98, 1.10, 0.15), (-0.36, 1.02, 0.10, 0.14)],
    [( 0.36, -1.30, 3.10, 0.27), ( 0.39, -1.50, 1.90, 0.17), ( 0.39, -1.38, 1.05, 0.15), ( 0.39, -1.45, 0.10, 0.14)],
    [(-0.36, -1.30, 3.10, 0.27), (-0.39, -1.50, 1.90, 0.17), (-0.39, -1.38, 1.05, 0.15), (-0.39, -1.45, 0.10, 0.14)],
])

# ------------------------------------------------- la fusion, puis les volumes
# Le geste qui sépare une créature d'un bonhomme de neige : une seule peau.
corps = hb.fusionner("Corps", [torse, cou, tete, pattes], voxel=0.11, lissage=6)

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
    hb.cylindre("_s1", 0.165, 0.45, ( 0.36, 1.02, 0.225), segments=12),
    hb.cylindre("_s2", 0.165, 0.45, (-0.36, 1.02, 0.225), segments=12),
    hb.cylindre("_s3", 0.165, 0.45, ( 0.39, -1.45, 0.225), segments=12),
    hb.cylindre("_s4", 0.165, 0.45, (-0.39, -1.45, 0.225), segments=12),
])
hb.piece(sabots, couleur=NOIR, materiau="SmoothPlastic", groupe="Cerf")

# ------------------------------------------------------------------- les bois
# Une maîtresse + des branches qui démarrent sur ses points, côté DROIT
# seulement — le miroir donne l'autre. Fusion simple : c'est UNE pièce Neon.
# Un bois n'est PAS un cône : c'est une courbe en S qui garde du corps sur
# toute sa longueur (rayons), part DE DANS le crâne (base sous la surface,
# sinon il flotte), balaie vers l'arrière et remonte. Les andouillers
# démarrent SUR des points de la maîtresse.
bois = hb.fusionner("Bois", [
    hb.corne("_b0", [(0.08, 2.30, 5.30), (0.20, 2.05, 5.95), (0.28, 1.90, 6.55), (0.46, 1.98, 7.15)],
             0, rayons=[0.13, 0.11, 0.09, 0.03]),
    hb.corne("_b1", [(0.20, 2.05, 5.95), (0.16, 2.45, 6.45), (0.14, 2.62, 6.85)], 0, rayons=[0.08, 0.06, 0.02]),
    hb.corne("_b2", [(0.28, 1.90, 6.55), (0.50, 2.12, 7.00)], 0, rayons=[0.075, 0.02]),
    hb.corne("_b3", [(0.28, 1.90, 6.55), (0.30, 1.52, 7.20)], 0, rayons=[0.075, 0.02]),
    hb.corne("_b4", [(0.11, 2.28, 5.50), (0.09, 2.58, 5.92)], 0, rayons=[0.065, 0.02]),
])
hb.miroir(bois, "X")
hb.facetter(bois, cible=1400)
hb.piece(bois, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Cerf")

# --------------------------------------------------------------- la crinière
# Des mèches VENTRUES (`rayons` : fine, grosse, pointue) qui se CHEVAUCHENT,
# puis leur propre fusion voxel : les fuseaux fondent en une masse touffue qui
# épouse le cou — une crinière, pas une crête de dragon. Idem pour la queue.
criniere = hb.fusionner("Criniere", [
    # LA CRÊTE D'ABORD : un bourrelet continu qui court sur toute la nuque,
    # moitié dans le cou moitié dehors. C'est lui qui soude les mèches en UNE
    # masse — sans crête, une rangée de mèches reste une rangée d'ailerons.
    hb.corne("_cr", [(0.00, 1.00, 3.55), (0.00, 1.33, 4.30), (0.00, 1.70, 4.95), (0.00, 2.00, 5.35)],
             0, rayons=[0.17, 0.19, 0.17, 0.12]),
    # puis les mèches qui s'en échappent, vers le bas et l'arrière
    hb.corne("_m1", [( 0.00, 1.15, 3.60), ( 0.05, 0.80, 3.75), ( 0.00, 0.42, 3.66)], 0, rayons=[0.15, 0.17, 0.04]),
    hb.corne("_m2", [( 0.00, 1.42, 4.10), (-0.05, 1.02, 4.28), ( 0.00, 0.62, 4.20)], 0, rayons=[0.14, 0.16, 0.04]),
    hb.corne("_m3", [( 0.00, 1.70, 4.70), ( 0.05, 1.32, 4.85), ( 0.00, 0.95, 4.78)], 0, rayons=[0.13, 0.15, 0.03]),
    hb.corne("_m4", [( 0.00, 1.95, 5.20), (-0.04, 1.52, 5.30), ( 0.00, 1.15, 5.22)], 0, rayons=[0.11, 0.13, 0.03]),
    hb.corne("_m5", [( 0.08, 1.45, 4.15), ( 0.17, 1.05, 4.32), ( 0.12, 0.72, 4.24)], 0, rayons=[0.10, 0.12, 0.03]),
    hb.corne("_m6", [(-0.08, 1.45, 4.15), (-0.17, 1.05, 4.32), (-0.12, 0.72, 4.24)], 0, rayons=[0.10, 0.12, 0.03]),
    # la touffe de poitrail : courte et plaquée — trop longue, elle pend
    # entre les pattes avant et se lit comme un pis
    hb.corne("_m7", [( 0.00, 1.25, 3.30), ( 0.06, 1.58, 3.05), ( 0.00, 1.55, 2.78)], 0, rayons=[0.16, 0.16, 0.06]),
    # la queue en panache, qui balaie vers le haut
    hb.corne("_q1", [( 0.00, -1.60, 3.30), ( 0.06, -2.50, 3.70), ( 0.00, -3.20, 3.60)], 0, rayons=[0.16, 0.26, 0.06]),
    hb.corne("_q2", [( 0.00, -1.65, 3.15), (-0.08, -2.55, 3.15), ( 0.00, -3.10, 2.85)], 0, rayons=[0.13, 0.20, 0.05]),
    hb.corne("_q3", [( 0.00, -1.60, 3.40), ( 0.04, -2.30, 3.95), ( 0.00, -2.90, 4.10)], 0, rayons=[0.11, 0.17, 0.04]),
], voxel=0.09, lissage=4)
hb.facetter(criniere, cible=1800)
hb.piece(criniere, couleur=BLANC, materiau="SmoothPlastic", collision=False,
         groupe="Cerf")

# ----------------------------------------------------- oreilles, yeux, marques
# Plus fins que le voxel : ils resteraient dans la fusion, donc ils vivent
# dehors. Les oreilles sont des lofts APLATIS (rx >> rz).
# La base de l'oreille est SOUS la surface du crâne (x=0.10 pour un crâne de
# rayon 0.26) : une oreille posée « au bord » finit toujours par flotter.
# Et elle pointe de CÔTÉ à ~45°, pas au zénith — au zénith c'est une licorne.
oreilles = hb.fusionner("Oreilles", [
    hb.loft("_og", [(( 0.10, 2.00, 5.15), 0.11, 0.06), (( 0.32, 1.88, 5.48), 0.08, 0.03),
                    (( 0.50, 1.80, 5.72), 0.02, 0.01)]),
    hb.loft("_od", [((-0.10, 2.00, 5.15), 0.11, 0.06), ((-0.32, 1.88, 5.48), 0.08, 0.03),
                    ((-0.50, 1.80, 5.72), 0.02, 0.01)]),
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
