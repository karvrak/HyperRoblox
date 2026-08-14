"""Cerf-esprit — exemple de créature organique ARTICULÉE HyperBlox/Blender.

Le gabarit de la méthode `references/organique.md`, version riggée : torse,
tête+cou, quatre pattes, queue — chacun dans son GROUPE, animé autour d'un
pivot d'articulation par le player.

Proportions (vérifiées contre la référence, dans les deux sens) :
  - pattes visibles ≈ 55-60 % du garrot — moins c'est l'hippopotame, plus
    c'est la girafe ;
  - corps COMPACT (longueur ≈ hauteur au garrot), cou court et dense qui
    prolonge le POITRAIL, pas un périscope ;
  - les ATTACHES de pattes sont des MASSES : l'épaule et la cuisse montent
    haut sur le flanc, larges en haut, et fondent dans la jambe — une patte
    qui sort du ventre comme un tube est une patte de table ;
  - la crinière TOURNE AUTOUR du cou (collerette en anneaux) en plus de la
    crête dorsale ;
  - un œil est une AMANDE inclinée plaquée sur la joue, jamais une bille.

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

import math
import os
import hyperblox as hb

DOSSIER = os.path.dirname(os.path.abspath(__file__))

# palette : deux teintes de corps + UN accent Neon
BLANC = (243, 244, 250)
NOIR = (38, 38, 44)
CYAN = (120, 235, 255)

hb.scene("CerfEsprit", DOSSIER)

# ------------------------------------------------------------------ le torse
# Compact : ventre à ~2.6, garrot à ~4.15.
torse = hb.loft("_torse", [
    ((0, -1.60, 3.35), 0.50, 0.58),   # croupe
    ((0, -1.05, 3.38), 0.62, 0.72),   # hanches
    ((0, -0.10, 3.30), 0.52, 0.62),   # taille
    ((0,  0.70, 3.38), 0.64, 0.80),   # poitrail — le plus large
    ((0,  1.20, 3.50), 0.48, 0.62),   # épaules
])
corps = hb.fusionner("Corps", [torse], voxel=0.11, lissage=4)
hb.sculpter(corps, centre=(0, 0.80, 3.15), rayon=1.10, gonfle=0.15)    # poitrail
hb.sculpter(corps, centre=(0, -1.15, 3.55), rayon=0.90, gonfle=0.12)   # croupe
hb.sculpter(corps, centre=(0, -0.10, 3.30), rayon=0.65, gonfle=-0.05)  # taille
hb.facetter(corps, cible=2800)
hb.piece(corps, couleur=BLANC, materiau="SmoothPlastic", fidelite="Hull",
         groupe="Corps")

# --------------------------------------------------------------- tête + cou
# Cou COURT et dense, qui part du haut-avant du poitrail. La rotule plonge
# dans les épaules.
cou = hb.squelette("_cou", [
    [(0, 1.28, 3.45, 0.36), (0, 1.60, 4.20, 0.30), (0, 1.82, 4.85, 0.26)],
])
crane = hb.loft("_crane", [
    ((0, 1.78, 4.95), 0.31, 0.33),    # nuque
    ((0, 2.20, 5.06), 0.30, 0.31),    # crâne
    ((0, 2.66, 4.88), 0.16, 0.17),    # museau
    ((0, 2.86, 4.86), 0.10, 0.11),    # nez — dans l'axe du museau, sinon il « tombe »
])
tete = hb.fusionner("Tete", [cou, crane], voxel=0.10, lissage=5)
hb.sculpter(tete, centre=(0, 2.22, 5.08), rayon=0.50, gonfle=0.05)           # joues
hb.sculpter(tete, centre=(0, 2.86, 4.86), rayon=0.35, vecteur=(0, 0.10, 0))  # museau tiré
hb.facetter(tete, cible=1600)
hb.piece(tete, couleur=BLANC, materiau="SmoothPlastic", fidelite="Hull",
         groupe="Tete")

# ---------------------------------------------------------------- les pattes
# L'ATTACHE est une MASSE qui monte haut sur le flanc : la boule d'épaule /
# de cuisse (0.34-0.44) est posée au-dessus du centre du corps et déborde sur
# le côté — c'est elle qu'on lit, pas un tube qui sort du ventre. Puis genou,
# canon, et le bout dans le sabot.
PATTES = [
    ("AvG", [( 0.36, 1.00, 3.55, 0.34), ( 0.40, 1.05, 2.45, 0.20), ( 0.40, 0.98, 1.35, 0.17), ( 0.40, 1.03, 0.12, 0.165)]),
    ("AvD", [(-0.36, 1.00, 3.55, 0.34), (-0.40, 1.05, 2.45, 0.20), (-0.40, 0.98, 1.35, 0.17), (-0.40, 1.03, 0.12, 0.165)]),
    # la patte arrière a un JARRET : cuisse en avant, jarret en arrière —
    # c'est cet angle qui dessine l'attache dans la silhouette de profil
    ("ArG", [( 0.38, -1.10, 3.60, 0.44), ( 0.44, -1.32, 2.50, 0.26), ( 0.45, -1.52, 1.70, 0.19), ( 0.45, -1.40, 0.90, 0.17), ( 0.45, -1.45, 0.12, 0.165)]),
    ("ArD", [(-0.38, -1.10, 3.60, 0.44), (-0.44, -1.32, 2.50, 0.26), (-0.45, -1.52, 1.70, 0.19), (-0.45, -1.40, 0.90, 0.17), (-0.45, -1.45, 0.12, 0.165)]),
]
for nom, chaine in PATTES:
    jambe = hb.squelette("Jambe" + nom, [chaine])
    hb.facetter(jambe, cible=700)
    hb.piece(jambe, couleur=BLANC, materiau="SmoothPlastic", groupe="Patte" + nom)
    bout = chaine[-1]
    sabot = hb.cylindre("Sabot" + nom, 0.20, 0.50, (bout[0], bout[1], 0.25), segments=12)
    hb.piece(sabot, couleur=NOIR, materiau="SmoothPlastic", groupe="Patte" + nom)

# ------------------------------------------------------------------- la queue
queue = hb.fusionner("Queue", [
    hb.corne("_q1", [( 0.00, -1.35, 3.45), ( 0.05, -2.50, 3.90), ( 0.00, -3.65, 3.65)], 0, rayons=[0.24, 0.38, 0.08]),
    hb.corne("_q2", [( 0.00, -1.40, 3.25), (-0.08, -2.50, 3.25), ( 0.00, -3.45, 2.95)], 0, rayons=[0.19, 0.30, 0.06]),
    hb.corne("_q3", [( 0.00, -1.35, 3.60), ( 0.05, -2.30, 4.15), ( 0.00, -3.25, 4.25)], 0, rayons=[0.16, 0.26, 0.05]),
    hb.corne("_q4", [( 0.10, -1.45, 3.40), ( 0.26, -2.35, 3.62), ( 0.16, -3.15, 3.40)], 0, rayons=[0.15, 0.22, 0.05]),
    hb.corne("_q5", [(-0.10, -1.45, 3.40), (-0.26, -2.35, 3.62), (-0.16, -3.15, 3.40)], 0, rayons=[0.15, 0.22, 0.05]),
], voxel=0.09, lissage=4)
hb.facetter(queue, cible=1600)
hb.piece(queue, couleur=BLANC, materiau="SmoothPlastic", collision=False)

# ------------------------------------------------------------------- les bois
bois = hb.fusionner("Bois", [
    hb.corne("_b0", [(0.08, 2.14, 5.12), (0.20, 1.88, 5.75), (0.28, 1.73, 6.35), (0.46, 1.81, 6.95)],
             0, rayons=[0.14, 0.12, 0.09, 0.03]),
    hb.corne("_b1", [(0.20, 1.88, 5.75), (0.16, 2.28, 6.25), (0.14, 2.45, 6.65)], 0, rayons=[0.085, 0.06, 0.02]),
    hb.corne("_b2", [(0.28, 1.73, 6.35), (0.50, 1.95, 6.80)], 0, rayons=[0.075, 0.02]),
    hb.corne("_b3", [(0.28, 1.73, 6.35), (0.30, 1.35, 7.00)], 0, rayons=[0.075, 0.02]),
    hb.corne("_b4", [(0.11, 2.12, 5.30), (0.09, 2.42, 5.73)], 0, rayons=[0.065, 0.02]),
])
hb.miroir(bois, "X")
hb.facetter(bois, cible=1400)
hb.piece(bois, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Tete")

# --------------------------------------------------------------- la crinière
# Deux systèmes qui fondent ensemble : la CRÊTE dorsale, et la COLLERETTE —
# des anneaux de mèches AUTOUR du cou, générés autour de son axe. C'est la
# collerette qui fait « la crinière tourne autour du cou » de la référence.
AXE_COU = (0.0, 0.44, 0.90)      # direction du cou, unitaire
_U = (0.0, 0.90, -0.44)          # perpendiculaire à l'axe, dans le plan vertical


def collier(prefixe, centre, echelle, n):
    """n mèches réparties en anneau autour du cou, qui retombent vers le corps.
    GRASSES et COURTES : des fuseaux qui se chevauchent fondent en fraise
    moelleuse ; longs et fins, ils fondent en oursin."""
    cornes = []
    for i in range(n):
        a = 2 * math.pi * i / n
        v = (math.cos(a), math.sin(a) * _U[1], math.sin(a) * _U[2])
        base = tuple(centre[k] + 0.24 * echelle * v[k] for k in range(3))
        mid = tuple(centre[k] + 0.44 * echelle * v[k] - 0.20 * echelle * AXE_COU[k] for k in range(3))
        tip = tuple(centre[k] + 0.56 * echelle * v[k] - 0.48 * echelle * AXE_COU[k] for k in range(3))
        cornes.append(hb.corne("_" + prefixe + str(i), [base, mid, tip], 0,
                               rayons=[0.16 * echelle, 0.19 * echelle, 0.07 * echelle]))
    return cornes


criniere = hb.fusionner("Criniere", [
    # la crête dorsale
    hb.corne("_cr", [(0.00, 1.10, 3.70), (0.00, 1.38, 4.40), (0.00, 1.66, 4.98), (0.00, 1.92, 5.35)],
             0, rayons=[0.21, 0.24, 0.20, 0.13]),
    hb.corne("_m1", [( 0.00, 1.22, 3.75), ( 0.05, 0.82, 3.92), ( 0.00, 0.40, 3.82)], 0, rayons=[0.17, 0.20, 0.05]),
    hb.corne("_m2", [( 0.00, 1.46, 4.35), (-0.05, 1.03, 4.55), ( 0.00, 0.60, 4.45)], 0, rayons=[0.16, 0.19, 0.04]),
    hb.corne("_m3", [( 0.00, 1.70, 4.95), ( 0.05, 1.28, 5.10), ( 0.00, 0.88, 5.02)], 0, rayons=[0.14, 0.17, 0.03]),
    hb.corne("_m4", [( 0.00, 1.88, 5.20), (-0.04, 1.43, 5.28), ( 0.00, 1.03, 5.20)], 0, rayons=[0.11, 0.14, 0.03]),
] + collier("ca", (0, 1.42, 3.95), 1.0, 8)      # collerette basse : la grosse fraise
  + collier("cb", (0, 1.66, 4.55), 0.70, 6),    # collerette haute, plus fine
voxel=0.09, lissage=6)
hb.facetter(criniere, cible=3200)
hb.piece(criniere, couleur=BLANC, materiau="SmoothPlastic", collision=False,
         groupe="Tete")

# ----------------------------------------------------- oreilles, yeux, marques
oreilles = hb.fusionner("Oreilles", [
    hb.loft("_og", [(( 0.12, 1.84, 4.98), 0.12, 0.06), (( 0.34, 1.70, 5.30), 0.09, 0.03),
                    (( 0.55, 1.62, 5.54), 0.02, 0.01)]),
    hb.loft("_od", [((-0.12, 1.84, 4.98), 0.12, 0.06), ((-0.34, 1.70, 5.30), 0.09, 0.03),
                    ((-0.55, 1.62, 5.54), 0.02, 0.01)]),
])
hb.piece(oreilles, couleur=BLANC, materiau="SmoothPlastic", collision=False,
         groupe="Tete")

# L'œil : une AMANDE inclinée plaquée sur la joue (coin externe vers
# l'arrière-haut, comme la référence) — un loft plat, jamais une bille.
yeux = hb.fusionner("Yeux", [
    hb.loft("_yg", [(( 0.30, 2.50, 4.86), 0.035, 0.012), (( 0.315, 2.36, 4.94), 0.040, 0.070),
                    (( 0.30, 2.22, 5.04), 0.035, 0.010)]),
    hb.loft("_yd", [((-0.30, 2.50, 4.86), 0.035, 0.012), ((-0.315, 2.36, 4.94), 0.040, 0.070),
                    ((-0.30, 2.22, 5.04), 0.035, 0.010)]),
])
hb.piece(yeux, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Tete")

marques = hb.fusionner("Marques", [
    hb.boite("_lg", (0.05, 0.28, 0.28), ( 0.53, -0.30, 3.45), rotation=(45, 0, 0)),
    hb.boite("_ld", (0.05, 0.28, 0.28), (-0.53, -0.30, 3.45), rotation=(45, 0, 0)),
])
hb.piece(marques, couleur=CYAN, materiau="Neon", collision=False,
         rendu="Precise", groupe="Corps")

# ---------------------------------------------------------------- animations
SEGMENTS = ["Corps", "Tete", "PatteAvG", "PatteAvD", "PatteArG", "PatteArD", "Queue"]
PIV_HANCHE = {"AvG": (0.37, 1.02, 3.45), "AvD": (-0.37, 1.02, 3.45),
              "ArG": (0.40, -1.20, 3.45), "ArD": (-0.40, -1.20, 3.45)}
PIV_COU = (0, 1.32, 3.65)
PIV_QUEUE = (0, -1.50, 3.45)


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

hb.animation("Apparaitre", 1.3, tous([
    {"t": 0.0, "position": [0, 6, 0], "easing": "easeIn"},
    {"t": 0.7, "position": [0, 0, 0], "easing": "easeOut"},
    {"t": 0.95, "position": [0, 0.18, 0], "easing": "easeInOut"},
    {"t": 1.3, "position": [0, 0, 0]},
]))

hb.animation("Cabrer", 2.0, tous([
    {"t": 0.0, "rotation": [0, 0, 0], "easing": "easeOutBack"},
    {"t": 0.7, "rotation": [24, 0, 0], "easing": "linear"},
    {"t": 1.2, "rotation": [24, 0, 0], "easing": "easeIn"},
    {"t": 2.0, "rotation": [0, 0, 0]},
], pivot=(0, -1.35, 0.25)) + [
    {"target": "PatteAv" + c, "pivot": PIV_HANCHE["Av" + c],
     "keyframes": [
         {"t": 0.0, "rotation": [0, 0, 0], "easing": "easeOutBack"},
         {"t": 0.7, "rotation": [-38, 0, 0], "easing": "linear"},
         {"t": 1.2, "rotation": [-38, 0, 0], "easing": "easeIn"},
         {"t": 2.0, "rotation": [0, 0, 0]},
     ]} for c in ("G", "D")
])

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
