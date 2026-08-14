"""Cerf-esprit — exemple de créature organique ARTICULÉE HyperBlox/Blender.

Le gabarit de la méthode `references/organique.md`, version riggée : le corps
n'est plus UNE fusion mais un ensemble de segments articulés — torse, tête+cou,
quatre pattes, queue — chacun dans son GROUPE, animé autour d'un pivot
d'articulation par le player. C'est le style des créatures Roblox pro : les
segments se lisent (regarder les pattes de la référence), et la marche devient
possible sans armature.

Règles du découpage articulé :
  - chaque segment PLONGE dans son parent (la rotule de cuisse entre dans le
    ventre, la base du cou dans les épaules) : la jointure reste couverte
    quel que soit l'angle d'animation ;
  - le pivot d'une anim = le centre de la rotule enfouie ;
  - ce qui bouge ensemble vit dans le même groupe (la jambe ET son sabot).

    # dans Blender, via mcp__blender__execute_blender_code
    import sys, importlib
    LIB = r"<...>/.claude/skills/hyperblox-blender/lib"
    if LIB not in sys.path: sys.path.insert(0, LIB)
    import hyperblox as hb; importlib.reload(hb)
    GEN = r"<...>/hyperblox-blender/examples/cerf-esprit/gen-cerf-esprit.py"
    g = {"__file__": GEN, "__name__": "__main__"}
    exec(compile(open(GEN, encoding="utf-8").read(), GEN, "exec"), g)

Repère Blender : Z en haut, le cerf regarde vers **+Y**.
"""

import os
import hyperblox as hb

DOSSIER = os.path.dirname(os.path.abspath(__file__))

# palette : deux teintes de corps + UN accent Neon
BLANC = (243, 244, 250)
NOIR = (38, 38, 44)
CYAN = (120, 235, 255)

hb.scene("CerfEsprit", DOSSIER)

# ------------------------------------------------------------------ le torse
# Poitrail et hanches massifs — gabarit cheval de guerre, pas biche.
torse = hb.loft("_torse", [
    ((0, -1.85, 3.20), 0.55, 0.62),   # croupe
    ((0, -1.25, 3.25), 0.68, 0.80),   # hanches — la masse arrière
    ((0, -0.15, 3.15), 0.58, 0.70),   # taille
    ((0,  0.75, 3.25), 0.70, 0.88),   # poitrail — le plus large
    ((0,  1.35, 3.40), 0.52, 0.68),   # épaules
])
corps = hb.fusionner("Corps", [torse], voxel=0.11, lissage=4)
hb.sculpter(corps, centre=(0, 0.85, 3.00), rayon=1.20, gonfle=0.16)    # poitrail
hb.sculpter(corps, centre=(0, -1.35, 3.40), rayon=0.95, gonfle=0.13)   # croupe
hb.sculpter(corps, centre=(0, -0.15, 3.15), rayon=0.70, gonfle=-0.05)  # taille
hb.facetter(corps, cible=2800)
hb.piece(corps, couleur=BLANC, materiau="SmoothPlastic", fidelite="Hull",
         groupe="Corps")

# --------------------------------------------------------------- tête + cou
# Un seul segment articulé à la base du cou. La rotule plonge dans les
# épaules : la jointure reste couverte quand la tête s'incline.
cou = hb.squelette("_cou", [
    [(0, 1.15, 3.35, 0.44), (0, 1.72, 4.32, 0.34), (0, 2.02, 5.00, 0.28)],
])
crane = hb.loft("_crane", [
    ((0, 1.95, 5.10), 0.32, 0.34),    # nuque
    ((0, 2.38, 5.22), 0.30, 0.31),    # crâne
    ((0, 2.80, 5.06), 0.16, 0.17),    # museau
    ((0, 3.00, 5.04), 0.10, 0.11),    # nez — dans l'axe du museau, sinon il « tombe »
])
tete = hb.fusionner("Tete", [cou, crane], voxel=0.10, lissage=5)
hb.sculpter(tete, centre=(0, 2.42, 5.25), rayon=0.50, gonfle=0.05)           # joues
hb.sculpter(tete, centre=(0, 3.00, 5.04), rayon=0.35, vecteur=(0, 0.10, 0))  # museau tiré
hb.facetter(tete, cible=1600)
hb.piece(tete, couleur=BLANC, materiau="SmoothPlastic", fidelite="Hull",
         groupe="Tete")

# ---------------------------------------------------------------- les pattes
# Segments articulés : cuisse charnue dont la ROTULE (rayon 0.38-0.42) est
# enfouie dans le ventre, canon net, bout dans le sabot. Le sabot vit dans le
# MÊME groupe que sa jambe : il suit quand elle balance.
PATTES = [
    # nom, chaîne (x, y, z, rayon)
    ("AvG", [( 0.40, 1.05, 3.20, 0.38), ( 0.42, 1.08, 2.05, 0.24), ( 0.42, 1.00, 1.10, 0.20), ( 0.42, 1.05, 0.12, 0.19)]),
    ("AvD", [(-0.40, 1.05, 3.20, 0.38), (-0.42, 1.08, 2.05, 0.24), (-0.42, 1.00, 1.10, 0.20), (-0.42, 1.05, 0.12, 0.19)]),
    ("ArG", [( 0.44, -1.35, 3.20, 0.42), ( 0.47, -1.55, 1.95, 0.25), ( 0.47, -1.40, 1.05, 0.21), ( 0.47, -1.48, 0.12, 0.19)]),
    ("ArD", [(-0.44, -1.35, 3.20, 0.42), (-0.47, -1.55, 1.95, 0.25), (-0.47, -1.40, 1.05, 0.21), (-0.47, -1.48, 0.12, 0.19)]),
]
for nom, chaine in PATTES:
    jambe = hb.squelette("Jambe" + nom, [chaine])
    hb.facetter(jambe, cible=650)
    hb.piece(jambe, couleur=BLANC, materiau="SmoothPlastic", groupe="Patte" + nom)
    bout = chaine[-1]
    sabot = hb.cylindre("Sabot" + nom, 0.225, 0.55, (bout[0], bout[1], 0.275), segments=12)
    hb.piece(sabot, couleur=NOIR, materiau="SmoothPlastic", groupe="Patte" + nom)

# ------------------------------------------------------------------- la queue
# Segment articulé à la croupe. Un PANACHE de renard, LONG — il balaie
# jusqu'à un corps de longueur derrière la croupe. Lobes SERRÉS : ils doivent
# se chevaucher pour que la fonte les soude.
queue = hb.fusionner("Queue", [
    hb.corne("_q1", [( 0.00, -1.55, 3.30), ( 0.05, -2.70, 3.80), ( 0.00, -3.90, 3.55)], 0, rayons=[0.24, 0.38, 0.08]),
    hb.corne("_q2", [( 0.00, -1.60, 3.10), (-0.08, -2.70, 3.10), ( 0.00, -3.70, 2.75)], 0, rayons=[0.19, 0.30, 0.06]),
    hb.corne("_q3", [( 0.00, -1.55, 3.45), ( 0.05, -2.50, 4.05), ( 0.00, -3.50, 4.15)], 0, rayons=[0.16, 0.26, 0.05]),
    hb.corne("_q4", [( 0.10, -1.65, 3.25), ( 0.26, -2.55, 3.50), ( 0.16, -3.40, 3.30)], 0, rayons=[0.15, 0.22, 0.05]),
    hb.corne("_q5", [(-0.10, -1.65, 3.25), (-0.26, -2.55, 3.50), (-0.16, -3.40, 3.30)], 0, rayons=[0.15, 0.22, 0.05]),
], voxel=0.09, lissage=4)
hb.facetter(queue, cible=1600)
hb.piece(queue, couleur=BLANC, materiau="SmoothPlastic", collision=False)

# ------------------------------------------------------------------- les bois
# Une courbe en S qui part DE DANS le crâne, andouillers SUR la maîtresse.
# Groupe Tete : les bois suivent la tête.
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
         rendu="Precise", groupe="Tete")

# --------------------------------------------------------------- la crinière
# Crête continue + mèches ventrues qui la chevauchent (voir organique.md).
# Groupe Tete : elle habille le cou, elle suit la tête.
criniere = hb.fusionner("Criniere", [
    hb.corne("_cr", [(0.00, 1.02, 3.62), (0.00, 1.36, 4.38), (0.00, 1.75, 5.02), (0.00, 2.05, 5.40)],
             0, rayons=[0.20, 0.24, 0.20, 0.14]),
    hb.corne("_m1", [( 0.00, 1.18, 3.65), ( 0.05, 0.78, 3.85), ( 0.00, 0.35, 3.75)], 0, rayons=[0.18, 0.21, 0.05]),
    hb.corne("_m2", [( 0.00, 1.45, 4.15), (-0.05, 1.02, 4.38), ( 0.00, 0.58, 4.28)], 0, rayons=[0.17, 0.20, 0.04]),
    hb.corne("_m3", [( 0.00, 1.75, 4.75), ( 0.05, 1.32, 4.92), ( 0.00, 0.92, 4.83)], 0, rayons=[0.15, 0.18, 0.04]),
    hb.corne("_m4", [( 0.00, 2.00, 5.25), (-0.04, 1.55, 5.35), ( 0.00, 1.15, 5.28)], 0, rayons=[0.12, 0.15, 0.03]),
    hb.corne("_m5", [( 0.12, 1.48, 4.20), ( 0.22, 1.05, 4.40), ( 0.15, 0.70, 4.30)], 0, rayons=[0.12, 0.14, 0.03]),
    hb.corne("_m6", [(-0.12, 1.48, 4.20), (-0.22, 1.05, 4.40), (-0.15, 0.70, 4.30)], 0, rayons=[0.12, 0.14, 0.03]),
], voxel=0.09, lissage=4)
hb.facetter(criniere, cible=1800)
hb.piece(criniere, couleur=BLANC, materiau="SmoothPlastic", collision=False,
         groupe="Tete")

# ----------------------------------------------------- oreilles, yeux, marques
oreilles = hb.fusionner("Oreilles", [
    hb.loft("_og", [(( 0.12, 2.02, 5.18), 0.12, 0.06), (( 0.34, 1.88, 5.50), 0.09, 0.03),
                    (( 0.55, 1.80, 5.75), 0.02, 0.01)]),
    hb.loft("_od", [((-0.12, 2.02, 5.18), 0.12, 0.06), ((-0.34, 1.88, 5.50), 0.09, 0.03),
                    ((-0.55, 1.80, 5.75), 0.02, 0.01)]),
])
hb.piece(oreilles, couleur=BLANC, materiau="SmoothPlastic", collision=False,
         groupe="Tete")

yeux = hb.fusionner("Yeux", [
    hb.sphere("_yg", 0.08, ( 0.22, 2.52, 5.20), segments=14, anneaux=8),
    hb.sphere("_yd", 0.08, (-0.22, 2.52, 5.20), segments=14, anneaux=8),
])
hb.piece(yeux, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Tete")

marques = hb.fusionner("Marques", [
    hb.boite("_lg", (0.05, 0.28, 0.28), ( 0.78, -1.20, 3.45), rotation=(45, 0, 0)),
    hb.boite("_ld", (0.05, 0.28, 0.28), (-0.78, -1.20, 3.45), rotation=(45, 0, 0)),
])
hb.piece(marques, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Corps")

# ---------------------------------------------------------------- animations
# Le rig : chaque groupe est un segment articulé. `pivot` en coordonnées
# BLENDER = le centre de la rotule enfouie. `rotation` en degrés ROBLOX
# (le cerf regarde -Z : +X = nez qui se lève, position Z négative = en avant).
SEGMENTS = ["Corps", "Tete", "PatteAvG", "PatteAvD", "PatteArG", "PatteArD", "Queue"]
PIV_HANCHE = {"AvG": (0.41, 1.06, 3.15), "AvD": (-0.41, 1.06, 3.15),
              "ArG": (0.45, -1.42, 3.15), "ArD": (-0.45, -1.42, 3.15)}
PIV_COU = (0, 1.25, 3.55)
PIV_QUEUE = (0, -1.70, 3.30)


def tous(keyframes, pivot=None):
    """Une track identique sur chaque segment = un transform rigide du corps
    entier (le pivot partagé garde les segments solidaires)."""
    tr = []
    for s in SEGMENTS:
        t = {"target": s, "keyframes": keyframes}
        if pivot:
            t["pivot"] = pivot
        tr.append(t)
    return tr


# La respiration du boss : tout flotte, la queue et la crinière suivent avec
# un temps de retard — le décalage fait « vivant ».
hb.animation("Flotter", 3.2, tous([
    {"t": 0.0, "position": [0, 0, 0], "easing": "easeInOut"},
    {"t": 1.6, "position": [0, 0.15, 0], "easing": "easeInOut"},
    {"t": 3.2, "position": [0, 0, 0]},
]) + [
    {"target": "Queue", "pivot": PIV_QUEUE,
     "keyframes": [
         {"t": 0.4, "rotation": [0, 0, 0], "easing": "easeInOut"},
         {"t": 2.0, "rotation": [5, 0, 0], "easing": "easeInOut"},
         {"t": 3.2, "rotation": [0, 0, 0]},
     ]},
    {"target": "Tete", "pivot": PIV_COU,
     "keyframes": [
         {"t": 0.3, "rotation": [0, 0, 0], "easing": "easeInOut"},
         {"t": 1.9, "rotation": [2.5, 0, 0], "easing": "easeInOut"},
         {"t": 3.2, "rotation": [0, 0, 0]},
     ]},
], boucle=True)

# La marche (sur place — le déplacement est au jeu) : diagonales opposées,
# queue en balancier, tête qui acquiesce.
BAL = 16
_aller = [
    {"t": 0.0, "rotation": [BAL, 0, 0], "easing": "easeInOut"},
    {"t": 0.5, "rotation": [-BAL, 0, 0], "easing": "easeInOut"},
    {"t": 1.0, "rotation": [BAL, 0, 0]},
]
_retour = [
    {"t": 0.0, "rotation": [-BAL, 0, 0], "easing": "easeInOut"},
    {"t": 0.5, "rotation": [BAL, 0, 0], "easing": "easeInOut"},
    {"t": 1.0, "rotation": [-BAL, 0, 0]},
]
hb.animation("Marcher", 1.0, [
    {"target": "PatteAvG", "pivot": PIV_HANCHE["AvG"], "keyframes": _aller},
    {"target": "PatteArD", "pivot": PIV_HANCHE["ArD"], "keyframes": _aller},
    {"target": "PatteAvD", "pivot": PIV_HANCHE["AvD"], "keyframes": _retour},
    {"target": "PatteArG", "pivot": PIV_HANCHE["ArG"], "keyframes": _retour},
    {"target": "Corps",
     "keyframes": [
         {"t": 0.0, "position": [0, 0, 0], "easing": "easeInOut"},
         {"t": 0.25, "position": [0, 0.05, 0], "easing": "easeInOut"},
         {"t": 0.5, "position": [0, 0, 0], "easing": "easeInOut"},
         {"t": 0.75, "position": [0, 0.05, 0], "easing": "easeInOut"},
         {"t": 1.0, "position": [0, 0, 0]},
     ]},
    {"target": "Tete", "pivot": PIV_COU,
     "keyframes": [
         {"t": 0.0, "rotation": [2, 0, 0], "easing": "easeInOut"},
         {"t": 0.5, "rotation": [-2, 0, 0], "easing": "easeInOut"},
         {"t": 1.0, "rotation": [2, 0, 0]},
     ]},
    {"target": "Queue", "pivot": PIV_QUEUE,
     "keyframes": [
         {"t": 0.0, "rotation": [0, 8, 0], "easing": "easeInOut"},
         {"t": 0.5, "rotation": [0, -8, 0], "easing": "easeInOut"},
         {"t": 1.0, "rotation": [0, 8, 0]},
     ]},
], boucle=True)

# L'invocation : il tombe du ciel sur le cercle, amortit, se pose.
hb.animation("Apparaitre", 1.3, tous([
    {"t": 0.0, "position": [0, 6, 0], "easing": "easeIn"},
    {"t": 0.7, "position": [0, 0, 0], "easing": "easeOut"},
    {"t": 0.95, "position": [0, 0.18, 0], "easing": "easeInOut"},
    {"t": 1.3, "position": [0, 0, 0]},
]))

# Le cabré : tout le corps pivote sur les sabots ARRIÈRE, et les pattes avant
# se replient par-dessus (les tracks se composent : segment entier × repli).
hb.animation("Cabrer", 2.0, tous([
    {"t": 0.0, "rotation": [0, 0, 0], "easing": "easeOutBack"},
    {"t": 0.7, "rotation": [24, 0, 0], "easing": "linear"},
    {"t": 1.2, "rotation": [24, 0, 0], "easing": "easeIn"},
    {"t": 2.0, "rotation": [0, 0, 0]},
], pivot=(0, -1.48, 0.28)) + [
    {"target": "PatteAv" + c, "pivot": PIV_HANCHE["Av" + c],
     "keyframes": [
         {"t": 0.0, "rotation": [0, 0, 0], "easing": "easeOutBack"},
         {"t": 0.7, "rotation": [-38, 0, 0], "easing": "linear"},
         {"t": 1.2, "rotation": [-38, 0, 0], "easing": "easeIn"},
         {"t": 2.0, "rotation": [0, 0, 0]},
     ]} for c in ("G", "D")
])

# Le coup de boule : bond en avant, tête baissée, retour.
hb.animation("Charger", 1.0, tous([
    {"t": 0.0, "rotation": [0, 0, 0], "position": [0, 0, 0], "easing": "easeOut"},
    {"t": 0.35, "rotation": [-8, 0, 0], "position": [0, 0, -1.4], "easing": "easeInOut"},
    {"t": 1.0, "rotation": [0, 0, 0], "position": [0, 0, 0]},
], pivot=(0, 0.0, 2.0)) + [
    {"target": "Tete", "pivot": PIV_COU,
     "keyframes": [
         {"t": 0.0, "rotation": [0, 0, 0], "easing": "easeOut"},
         {"t": 0.35, "rotation": [-14, 0, 0], "easing": "easeInOut"},
         {"t": 1.0, "rotation": [0, 0, 0]},
     ]},
])

# -------------------------------------------------------------------- sortie
hb.rapport()
hb.export()
hb.sauver()
