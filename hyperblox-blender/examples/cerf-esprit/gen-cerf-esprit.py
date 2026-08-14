"""Cerf-esprit — exemple de créature organique HyperBlox/Blender.

Le gabarit de la méthode `references/organique.md` : torse lofté, membres au
squelette, fusion voxel (les jointures fondent), volumes sculptés, bois Neon
ramifiés en miroir, crinière crête+mèches, finition facettée « anime Roblox ».

Gabarit CHEVAL DE GUERRE, pas biche : poitrail et croupe massifs, cou épais,
pattes charnues à canons nets, queue en panache de renard. La version maigre
lisait « cerf malade » — l'exagération du style va vers la masse, pas vers
l'étique.

    # dans Blender, via mcp__blender__execute_blender_code
    import sys, importlib
    LIB = r"<...>/.claude/skills/hyperblox-blender/lib"
    if LIB not in sys.path: sys.path.insert(0, LIB)
    import hyperblox as hb; importlib.reload(hb)
    GEN = r"<...>/hyperblox-blender/examples/cerf-esprit/gen-cerf-esprit.py"
    g = {"__file__": GEN, "__name__": "__main__"}
    exec(compile(open(GEN, encoding="utf-8").read(), GEN, "exec"), g)

Repère Blender : Z en haut, le cerf regarde vers **+Y**. Garrot à ~4,1 studs,
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
# Torse : LARGE. Le galbe se contrôle section par section — poitrail et
# hanches massifs, taille marquée mais pas creusée à l'os.
torse = hb.loft("_torse", [
    ((0, -1.85, 3.20), 0.55, 0.62),   # croupe
    ((0, -1.25, 3.25), 0.68, 0.80),   # hanches — la masse arrière
    ((0, -0.15, 3.15), 0.58, 0.70),   # taille
    ((0,  0.75, 3.25), 0.70, 0.88),   # poitrail — le plus large
    ((0,  1.35, 3.40), 0.52, 0.68),   # épaules
])

# Cou épais (la crinière l'habillera) et tête portée haut.
cou = hb.squelette("_cou", [
    [(0, 1.25, 3.45, 0.42), (0, 1.72, 4.32, 0.34), (0, 2.02, 5.00, 0.28)],
])
tete = hb.loft("_tete", [
    ((0, 1.95, 5.10), 0.32, 0.34),    # nuque
    ((0, 2.38, 5.22), 0.30, 0.31),    # crâne
    ((0, 2.80, 5.06), 0.16, 0.17),    # museau
    ((0, 3.00, 5.04), 0.10, 0.11),    # nez — dans l'axe du museau, sinon il « tombe »
])

# Des pattes avec de la MATIÈRE : cuisse charnue, canon net, et le bout qui
# plonge jusque dans le sabot (z=0.10) — la détente de la fusion rétracte les
# extrémités fines, le sabot avale ce qui reste. Jamais plus fin que le voxel.
pattes = hb.squelette("_pattes", [
    [( 0.38, 1.05, 3.20, 0.30), ( 0.40, 1.08, 2.05, 0.20), ( 0.40, 1.00, 1.10, 0.17), ( 0.40, 1.05, 0.10, 0.16)],
    [(-0.38, 1.05, 3.20, 0.30), (-0.40, 1.08, 2.05, 0.20), (-0.40, 1.00, 1.10, 0.17), (-0.40, 1.05, 0.10, 0.16)],
    [( 0.42, -1.35, 3.20, 0.34), ( 0.45, -1.55, 1.95, 0.21), ( 0.45, -1.40, 1.05, 0.17), ( 0.45, -1.48, 0.10, 0.16)],
    [(-0.42, -1.35, 3.20, 0.34), (-0.45, -1.55, 1.95, 0.21), (-0.45, -1.40, 1.05, 0.17), (-0.45, -1.48, 0.10, 0.16)],
])

# ------------------------------------------------- la fusion, puis les volumes
# Le geste qui sépare une créature d'un bonhomme de neige : une seule peau.
corps = hb.fusionner("Corps", [torse, cou, tete, pattes], voxel=0.11, lissage=6)

hb.sculpter(corps, centre=(0, 0.85, 3.00), rayon=1.20, gonfle=0.16)          # poitrail
hb.sculpter(corps, centre=(0, -1.35, 3.40), rayon=0.95, gonfle=0.13)         # cuisses/croupe
hb.sculpter(corps, centre=(0, -0.15, 3.15), rayon=0.70, gonfle=-0.05)        # taille
hb.sculpter(corps, centre=(0, 2.42, 5.25), rayon=0.50, gonfle=0.05)          # joues
hb.sculpter(corps, centre=(0, 3.00, 5.04), rayon=0.35, vecteur=(0, 0.10, 0)) # museau tiré

# Le style : facettes assumées, ombrage plat. EN DERNIER.
hb.facetter(corps, cible=4600)
hb.piece(corps, couleur=BLANC, materiau="SmoothPlastic", fidelite="Hull",
         groupe="Cerf")

# ------------------------------------------------------------------ les sabots
# Hors fusion (autre couleur), simples cylindres réunis en UNE pièce.
sabots = hb.fusionner("Sabots", [
    hb.cylindre("_s1", 0.19, 0.50, ( 0.40, 1.05, 0.25), segments=12),
    hb.cylindre("_s2", 0.19, 0.50, (-0.40, 1.05, 0.25), segments=12),
    hb.cylindre("_s3", 0.19, 0.50, ( 0.45, -1.48, 0.25), segments=12),
    hb.cylindre("_s4", 0.19, 0.50, (-0.45, -1.48, 0.25), segments=12),
])
hb.piece(sabots, couleur=NOIR, materiau="SmoothPlastic", groupe="Cerf")

# ------------------------------------------------------------------- les bois
# Un bois n'est PAS un cône : une courbe en S qui garde du corps (rayons),
# part DE DANS le crâne (base sous la surface, sinon il flotte), balaie vers
# l'arrière et remonte. Les andouillers démarrent SUR des points de la
# maîtresse. Côté droit seulement — le miroir donne l'autre.
bois = hb.fusionner("Bois", [
    hb.corne("_b0", [(0.08, 2.32, 5.32), (0.20, 2.05, 5.98), (0.28, 1.90, 6.58), (0.46, 1.98, 7.18)],
             0, rayons=[0.14, 0.12, 0.09, 0.03]),
    hb.corne("_b1", [(0.20, 2.05, 5.98), (0.16, 2.45, 6.48), (0.14, 2.62, 6.88)], 0, rayons=[0.085, 0.06, 0.02]),
    hb.corne("_b2", [(0.28, 1.90, 6.58), (0.50, 2.12, 7.03)], 0, rayons=[0.075, 0.02]),
    hb.corne("_b3", [(0.28, 1.90, 6.58), (0.30, 1.52, 7.23)], 0, rayons=[0.075, 0.02]),
    hb.corne("_b4", [(0.11, 2.30, 5.52), (0.09, 2.60, 5.95)], 0, rayons=[0.065, 0.02]),
])
hb.miroir(bois, "X")
hb.facetter(bois, cible=1400)
hb.piece(bois, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Cerf")

# --------------------------------------------------------------- la crinière
# LA CRÊTE D'ABORD : un bourrelet continu sur toute la nuque, moitié dans le
# cou moitié dehors — c'est lui qui soude les mèches en UNE masse. Puis des
# mèches VENTRUES (rayons : fine, grosse, pointue) qui s'en échappent.
criniere = hb.fusionner("Criniere", [
    hb.corne("_cr", [(0.00, 1.02, 3.62), (0.00, 1.36, 4.38), (0.00, 1.75, 5.02), (0.00, 2.05, 5.40)],
             0, rayons=[0.20, 0.24, 0.20, 0.14]),
    hb.corne("_m1", [( 0.00, 1.18, 3.65), ( 0.05, 0.78, 3.85), ( 0.00, 0.35, 3.75)], 0, rayons=[0.18, 0.21, 0.05]),
    hb.corne("_m2", [( 0.00, 1.45, 4.15), (-0.05, 1.02, 4.38), ( 0.00, 0.58, 4.28)], 0, rayons=[0.17, 0.20, 0.04]),
    hb.corne("_m3", [( 0.00, 1.75, 4.75), ( 0.05, 1.32, 4.92), ( 0.00, 0.92, 4.83)], 0, rayons=[0.15, 0.18, 0.04]),
    hb.corne("_m4", [( 0.00, 2.00, 5.25), (-0.04, 1.55, 5.35), ( 0.00, 1.15, 5.28)], 0, rayons=[0.12, 0.15, 0.03]),
    hb.corne("_m5", [( 0.12, 1.48, 4.20), ( 0.22, 1.05, 4.40), ( 0.15, 0.70, 4.30)], 0, rayons=[0.12, 0.14, 0.03]),
    hb.corne("_m6", [(-0.12, 1.48, 4.20), (-0.22, 1.05, 4.40), (-0.15, 0.70, 4.30)], 0, rayons=[0.12, 0.14, 0.03]),
    # (pas de touffe de poitrail : isolée de la crête, la fonte en fait un
    # kyste collé sous le cou — le poitrail musclé suffit)
    # la queue : un PANACHE de renard — cinq lobes SERRÉS (ils doivent se
    # chevaucher pour que la fonte les soude ; écartés, la queue se déchiquette)
    hb.corne("_q1", [( 0.00, -1.60, 3.30), ( 0.05, -2.50, 3.75), ( 0.00, -3.30, 3.65)], 0, rayons=[0.22, 0.34, 0.07]),
    hb.corne("_q2", [( 0.00, -1.65, 3.10), (-0.08, -2.55, 3.15), ( 0.00, -3.15, 2.85)], 0, rayons=[0.18, 0.27, 0.06]),
    hb.corne("_q3", [( 0.00, -1.60, 3.45), ( 0.05, -2.30, 4.00), ( 0.00, -2.95, 4.12)], 0, rayons=[0.15, 0.23, 0.05]),
    hb.corne("_q4", [( 0.10, -1.70, 3.25), ( 0.24, -2.40, 3.45), ( 0.15, -2.95, 3.30)], 0, rayons=[0.14, 0.20, 0.04]),
    hb.corne("_q5", [(-0.10, -1.70, 3.25), (-0.24, -2.40, 3.45), (-0.15, -2.95, 3.30)], 0, rayons=[0.14, 0.20, 0.04]),
], voxel=0.09, lissage=4)
hb.facetter(criniere, cible=2400)
hb.piece(criniere, couleur=BLANC, materiau="SmoothPlastic", collision=False,
         groupe="Cerf")

# ----------------------------------------------------- oreilles, yeux, marques
# Plus fins que le voxel : ils vivent HORS de la fusion du corps. La base de
# l'oreille est SOUS la surface du crâne (une oreille posée « au bord » finit
# toujours par flotter) et pointe de CÔTÉ à ~45° — au zénith c'est une licorne.
oreilles = hb.fusionner("Oreilles", [
    hb.loft("_og", [(( 0.12, 2.02, 5.18), 0.12, 0.06), (( 0.34, 1.88, 5.50), 0.09, 0.03),
                    (( 0.55, 1.80, 5.75), 0.02, 0.01)]),
    hb.loft("_od", [((-0.12, 2.02, 5.18), 0.12, 0.06), ((-0.34, 1.88, 5.50), 0.09, 0.03),
                    ((-0.55, 1.80, 5.75), 0.02, 0.01)]),
])
hb.piece(oreilles, couleur=BLANC, materiau="SmoothPlastic", collision=False,
         groupe="Cerf")

yeux = hb.fusionner("Yeux", [
    hb.sphere("_yg", 0.08, ( 0.22, 2.52, 5.20), segments=14, anneaux=8),
    hb.sphere("_yd", 0.08, (-0.22, 2.52, 5.20), segments=14, anneaux=8),
])
hb.piece(yeux, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Cerf")

# Le losange lumineux sur la hanche : une boîte fine tournée de 45°, posée
# À la surface (hanches 0.68 + gonfle des cuisses ≈ 0.78) — trop enfoncée,
# il n'en dépasse qu'un coin.
marques = hb.fusionner("Marques", [
    hb.boite("_lg", (0.05, 0.28, 0.28), ( 0.78, -1.20, 3.45), rotation=(45, 0, 0)),
    hb.boite("_ld", (0.05, 0.28, 0.28), (-0.78, -1.20, 3.45), rotation=(45, 0, 0)),
])
hb.piece(marques, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Cerf")

# ---------------------------------------------------------------- animations
# Pas de rig dans ce pipeline : les anims déplacent le groupe entier et les
# pièces par CFrame. `pivot` en coordonnées BLENDER, `rotation` en degrés
# ROBLOX (Y vertical ; le cerf regarde -Z, donc +X = nez qui se lève,
# position Z négative = bond en avant).

# La respiration du boss : le corps flotte, la crinière suit avec un temps
# de retard — c'est le décalage qui fait « vivant ».
hb.animation("Flotter", 3.2, [
    {"target": "Cerf",
     "keyframes": [
         {"t": 0.0, "position": [0, 0, 0], "easing": "easeInOut"},
         {"t": 1.6, "position": [0, 0.15, 0], "easing": "easeInOut"},
         {"t": 3.2, "position": [0, 0, 0]},
     ]},
    {"target": "Criniere", "pivot": (0, 1.25, 3.45),
     "keyframes": [
         {"t": 0.3, "rotation": [0, 0, 0], "easing": "easeInOut"},
         {"t": 1.9, "rotation": [3, 0, 0], "easing": "easeInOut"},
         {"t": 3.2, "rotation": [0, 0, 0]},
     ]},
], boucle=True)

# L'invocation : il tombe du ciel sur le cercle, amortit, se pose.
hb.animation("Apparaitre", 1.3, [
    {"target": "Cerf",
     "keyframes": [
         {"t": 0.0, "position": [0, 6, 0], "easing": "easeIn"},
         {"t": 0.7, "position": [0, 0, 0], "easing": "easeOut"},
         {"t": 0.95, "position": [0, 0.18, 0], "easing": "easeInOut"},
         {"t": 1.3, "position": [0, 0, 0]},
     ]},
])

# Le cabré d'intimidation : pivot sur les sabots ARRIÈRE, nez vers le ciel.
hb.animation("Cabrer", 2.0, [
    {"target": "Cerf", "pivot": (0, -1.48, 0.25),
     "keyframes": [
         {"t": 0.0, "rotation": [0, 0, 0], "easing": "easeOutBack"},
         {"t": 0.7, "rotation": [24, 0, 0], "easing": "linear"},
         {"t": 1.2, "rotation": [24, 0, 0], "easing": "easeIn"},
         {"t": 2.0, "rotation": [0, 0, 0]},
     ]},
])

# Le coup de boule : bond en avant, nez baissé, retour.
hb.animation("Charger", 1.0, [
    {"target": "Cerf", "pivot": (0, 0.0, 2.0),
     "keyframes": [
         {"t": 0.0, "rotation": [0, 0, 0], "position": [0, 0, 0], "easing": "easeOut"},
         {"t": 0.35, "rotation": [-8, 0, 0], "position": [0, 0, -1.4], "easing": "easeInOut"},
         {"t": 1.0, "rotation": [0, 0, 0], "position": [0, 0, 0]},
     ]},
])

# -------------------------------------------------------------------- sortie
hb.rapport()
hb.export()
hb.sauver()
