"""Cerf-esprit — exemple de créature organique ARTICULÉE HyperBlox/Blender.

Le gabarit de la méthode `references/organique.md`, version riggée : le corps
n'est plus UNE fusion mais un ensemble de segments articulés — torse, tête+cou,
quatre pattes, queue — chacun dans son GROUPE, animé autour d'un pivot
d'articulation par le player.

Proportions (celles qui « font vrai », vérifiées contre la référence) :
  - les pattes VISIBLES font ~55-60 % de la hauteur au garrot — l'air sous le
    ventre est ce qui sépare un cerf d'un hippopotame ;
  - le corps est COMPACT : sa longueur ≈ la hauteur au garrot, pas plus ;
  - le cou prolonge le POITRAIL (il part du haut-avant du torse, presque
    vertical), il ne pousse pas du milieu du dos.

Règles du découpage articulé :
  - chaque segment PLONGE dans son parent (rotule de cuisse dans le ventre,
    base du cou dans les épaules) : la jointure reste couverte à tous les
    angles d'animation ;
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
# COMPACT et haut perché (centre à z≈3.6) : ventre à ~2.85, garrot à ~4.35.
torse = hb.loft("_torse", [
    ((0, -1.65, 3.60), 0.50, 0.58),   # croupe
    ((0, -1.10, 3.62), 0.62, 0.72),   # hanches
    ((0, -0.10, 3.55), 0.52, 0.62),   # taille
    ((0,  0.70, 3.62), 0.64, 0.80),   # poitrail — le plus large
    ((0,  1.25, 3.75), 0.48, 0.62),   # épaules
])
corps = hb.fusionner("Corps", [torse], voxel=0.11, lissage=4)
hb.sculpter(corps, centre=(0, 0.80, 3.40), rayon=1.10, gonfle=0.15)    # poitrail
hb.sculpter(corps, centre=(0, -1.20, 3.80), rayon=0.90, gonfle=0.12)   # croupe
hb.sculpter(corps, centre=(0, -0.10, 3.55), rayon=0.65, gonfle=-0.05)  # taille
hb.facetter(corps, cible=2800)
hb.piece(corps, couleur=BLANC, materiau="SmoothPlastic", fidelite="Hull",
         groupe="Corps")

# --------------------------------------------------------------- tête + cou
# Le cou part du HAUT-AVANT du poitrail et monte presque vertical — comme la
# référence. Un seul segment articulé, rotule enfouie dans les épaules.
cou = hb.squelette("_cou", [
    [(0, 1.25, 3.70, 0.40), (0, 1.75, 4.60, 0.31), (0, 2.00, 5.35, 0.26)],
])
crane = hb.loft("_crane", [
    ((0, 1.95, 5.45), 0.30, 0.32),    # nuque
    ((0, 2.35, 5.58), 0.28, 0.29),    # crâne
    ((0, 2.78, 5.40), 0.15, 0.16),    # museau
    ((0, 2.98, 5.38), 0.09, 0.10),    # nez — dans l'axe du museau, sinon il « tombe »
])
tete = hb.fusionner("Tete", [cou, crane], voxel=0.10, lissage=5)
hb.sculpter(tete, centre=(0, 2.40, 5.60), rayon=0.50, gonfle=0.05)           # joues
hb.sculpter(tete, centre=(0, 2.98, 5.38), rayon=0.35, vecteur=(0, 0.10, 0))  # museau tiré
hb.facetter(tete, cible=1600)
hb.piece(tete, couleur=BLANC, materiau="SmoothPlastic", fidelite="Hull",
         groupe="Tete")

# ---------------------------------------------------------------- les pattes
# LONGUES (hanche à 3.55, sol à 0) et charnues en haut : l'air sous le ventre
# fait le port altier. Rotule enfouie, sabot dans le même groupe.
PATTES = [
    ("AvG", [( 0.38, 1.00, 3.55, 0.36), ( 0.40, 1.03, 2.20, 0.22), ( 0.40, 0.96, 1.15, 0.185), ( 0.40, 1.02, 0.12, 0.18)]),
    ("AvD", [(-0.38, 1.00, 3.55, 0.36), (-0.40, 1.03, 2.20, 0.22), (-0.40, 0.96, 1.15, 0.185), (-0.40, 1.02, 0.12, 0.18)]),
    ("ArG", [( 0.42, -1.25, 3.55, 0.40), ( 0.45, -1.45, 2.05, 0.23), ( 0.45, -1.32, 1.10, 0.19), ( 0.45, -1.40, 0.12, 0.18)]),
    ("ArD", [(-0.42, -1.25, 3.55, 0.40), (-0.45, -1.45, 2.05, 0.23), (-0.45, -1.32, 1.10, 0.19), (-0.45, -1.40, 0.12, 0.18)]),
]
for nom, chaine in PATTES:
    jambe = hb.squelette("Jambe" + nom, [chaine])
    hb.facetter(jambe, cible=650)
    hb.piece(jambe, couleur=BLANC, materiau="SmoothPlastic", groupe="Patte" + nom)
    bout = chaine[-1]
    sabot = hb.cylindre("Sabot" + nom, 0.21, 0.55, (bout[0], bout[1], 0.275), segments=12)
    hb.piece(sabot, couleur=NOIR, materiau="SmoothPlastic", groupe="Patte" + nom)

# ------------------------------------------------------------------- la queue
# Segment articulé à la croupe. Un PANACHE de renard, LONG. Lobes SERRÉS :
# ils doivent se chevaucher pour que la fonte les soude.
queue = hb.fusionner("Queue", [
    hb.corne("_q1", [( 0.00, -1.40, 3.65), ( 0.05, -2.55, 4.10), ( 0.00, -3.75, 3.85)], 0, rayons=[0.24, 0.38, 0.08]),
    hb.corne("_q2", [( 0.00, -1.45, 3.45), (-0.08, -2.55, 3.45), ( 0.00, -3.55, 3.10)], 0, rayons=[0.19, 0.30, 0.06]),
    hb.corne("_q3", [( 0.00, -1.40, 3.80), ( 0.05, -2.35, 4.35), ( 0.00, -3.35, 4.45)], 0, rayons=[0.16, 0.26, 0.05]),
    hb.corne("_q4", [( 0.10, -1.50, 3.60), ( 0.26, -2.40, 3.82), ( 0.16, -3.25, 3.60)], 0, rayons=[0.15, 0.22, 0.05]),
    hb.corne("_q5", [(-0.10, -1.50, 3.60), (-0.26, -2.40, 3.82), (-0.16, -3.25, 3.60)], 0, rayons=[0.15, 0.22, 0.05]),
], voxel=0.09, lissage=4)
hb.facetter(queue, cible=1600)
hb.piece(queue, couleur=BLANC, materiau="SmoothPlastic", collision=False)

# ------------------------------------------------------------------- les bois
# Une courbe en S qui part DE DANS le crâne, andouillers SUR la maîtresse.
bois = hb.fusionner("Bois", [
    hb.corne("_b0", [(0.08, 2.30, 5.68), (0.20, 2.02, 6.32), (0.28, 1.88, 6.92), (0.46, 1.96, 7.52)],
             0, rayons=[0.14, 0.12, 0.09, 0.03]),
    hb.corne("_b1", [(0.20, 2.02, 6.32), (0.16, 2.42, 6.82), (0.14, 2.60, 7.22)], 0, rayons=[0.085, 0.06, 0.02]),
    hb.corne("_b2", [(0.28, 1.88, 6.92), (0.50, 2.10, 7.37)], 0, rayons=[0.075, 0.02]),
    hb.corne("_b3", [(0.28, 1.88, 6.92), (0.30, 1.50, 7.57)], 0, rayons=[0.075, 0.02]),
    hb.corne("_b4", [(0.11, 2.28, 5.86), (0.09, 2.58, 6.29)], 0, rayons=[0.065, 0.02]),
])
hb.miroir(bois, "X")
hb.facetter(bois, cible=1400)
hb.piece(bois, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Tete")

# --------------------------------------------------------------- la crinière
# Crête continue + mèches ventrues qui la chevauchent (voir organique.md).
criniere = hb.fusionner("Criniere", [
    hb.corne("_cr", [(0.00, 1.05, 3.90), (0.00, 1.40, 4.70), (0.00, 1.75, 5.35), (0.00, 2.02, 5.75)],
             0, rayons=[0.20, 0.24, 0.20, 0.14]),
    hb.corne("_m1", [( 0.00, 1.20, 3.95), ( 0.05, 0.80, 4.12), ( 0.00, 0.38, 4.02)], 0, rayons=[0.18, 0.21, 0.05]),
    hb.corne("_m2", [( 0.00, 1.48, 4.50), (-0.05, 1.05, 4.70), ( 0.00, 0.62, 4.60)], 0, rayons=[0.17, 0.20, 0.04]),
    hb.corne("_m3", [( 0.00, 1.75, 5.08), ( 0.05, 1.32, 5.24), ( 0.00, 0.92, 5.15)], 0, rayons=[0.15, 0.18, 0.04]),
    hb.corne("_m4", [( 0.00, 1.98, 5.58), (-0.04, 1.52, 5.66), ( 0.00, 1.12, 5.58)], 0, rayons=[0.12, 0.15, 0.03]),
    hb.corne("_m5", [( 0.12, 1.50, 4.52), ( 0.22, 1.06, 4.72), ( 0.15, 0.72, 4.62)], 0, rayons=[0.12, 0.14, 0.03]),
    hb.corne("_m6", [(-0.12, 1.50, 4.52), (-0.22, 1.06, 4.72), (-0.15, 0.72, 4.62)], 0, rayons=[0.12, 0.14, 0.03]),
], voxel=0.09, lissage=4)
hb.facetter(criniere, cible=1800)
hb.piece(criniere, couleur=BLANC, materiau="SmoothPlastic", collision=False,
         groupe="Tete")

# ----------------------------------------------------- oreilles, yeux, marques
oreilles = hb.fusionner("Oreilles", [
    hb.loft("_og", [(( 0.12, 2.00, 5.54), 0.12, 0.06), (( 0.34, 1.86, 5.86), 0.09, 0.03),
                    (( 0.55, 1.78, 6.10), 0.02, 0.01)]),
    hb.loft("_od", [((-0.12, 2.00, 5.54), 0.12, 0.06), ((-0.34, 1.86, 5.86), 0.09, 0.03),
                    ((-0.55, 1.78, 6.10), 0.02, 0.01)]),
])
hb.piece(oreilles, couleur=BLANC, materiau="SmoothPlastic", collision=False,
         groupe="Tete")

yeux = hb.fusionner("Yeux", [
    hb.sphere("_yg", 0.08, ( 0.22, 2.50, 5.56), segments=14, anneaux=8),
    hb.sphere("_yd", 0.08, (-0.22, 2.50, 5.56), segments=14, anneaux=8),
])
hb.piece(yeux, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Tete")

marques = hb.fusionner("Marques", [
    hb.boite("_lg", (0.05, 0.28, 0.28), ( 0.72, -1.05, 3.80), rotation=(45, 0, 0)),
    hb.boite("_ld", (0.05, 0.28, 0.28), (-0.72, -1.05, 3.80), rotation=(45, 0, 0)),
])
hb.piece(marques, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Corps")

# ---------------------------------------------------------------- animations
# Le rig : chaque groupe est un segment articulé. `pivot` en coordonnées
# BLENDER = le centre de la rotule enfouie. `rotation` en degrés ROBLOX
# (le cerf regarde -Z : +X = nez qui se lève, position Z négative = en avant).
SEGMENTS = ["Corps", "Tete", "PatteAvG", "PatteAvD", "PatteArG", "PatteArD", "Queue"]
PIV_HANCHE = {"AvG": (0.39, 1.01, 3.50), "AvD": (-0.39, 1.01, 3.50),
              "ArG": (0.43, -1.32, 3.50), "ArD": (-0.43, -1.32, 3.50)}
PIV_COU = (0, 1.35, 3.90)
PIV_QUEUE = (0, -1.55, 3.65)


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


# La respiration du boss : tout flotte, la queue et la tête suivent avec un
# temps de retard — le décalage fait « vivant ».
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
], pivot=(0, -1.40, 0.28)) + [
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
], pivot=(0, 0.0, 2.2)) + [
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
