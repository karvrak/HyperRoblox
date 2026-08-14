"""HyperBlox Blender — le vocabulaire de modélisation, côté Blender.

Ce module se charge DANS Blender (via le MCP `execute_blender_code`). Il fait
trois choses, et rien d'autre :

  1. un vocabulaire de formes paramétriques (boite, cylindre, revolution, tube…),
     de modificateurs (biseau, lisser, miroir, booleen…) et d'outils ORGANIQUES
     (squelette, loft, corne, sculpter, fusionner, facetter — la méthode :
     references/organique.md) — l'équivalent de `hyperblox/lib/volume.mjs`,
     mais avec un vrai moteur de mesh dessous ;
  2. la déclaration des PIÈCES : chaque pièce deviendra exactement une MeshPart
     dans Roblox, avec sa couleur, son matériau, son groupe ;
  3. l'export : un FBX multi-objets + un `manifest.json` qui mesure tout en
     studs, dans le repère Roblox.

Le manifest est la source de vérité de l'assemblage : `assemble.mjs` en fait un
`assemble.lua` qui REDONNE à chaque MeshPart importée sa taille et sa position
exactes. C'est ce qui rend le pipeline insensible aux conversions d'unités du
3D Importer de Studio — on ne subit pas l'échelle de l'import, on l'écrase.

Unité : 1 unité Blender = 1 stud. Un personnage Roblox fait 5 studs.

Repères :
    Blender  : Z en haut, -Y vers l'avant (vue de Face au pavé numérique 1)
    Roblox   : Y en haut, -Z vers l'avant (LookVector)
    passage  : (bx, by, bz)  ->  (bx, bz, -by)      [rotation, pas de miroir]

C'est exactement ce que fait l'export FBX en `axis_up='Y', axis_forward='-Z'` :
la géométrie et les mesures du manifest suivent donc la même convention.
Conséquence pratique : **modéliser l'objet tourné vers +Y dans Blender** pour
qu'il regarde vers -Z (l'avant) dans Roblox.

Usage type, depuis un `gen-<slug>.py` :

    import hyperblox as hb

    hb.scene("BorneArcade", r"D:/jeu/hyperblox/borne-arcade")

    caisson = hb.boite("Caisson", (2.4, 1.6, 5.2), (0, 0, 2.6))
    hb.biseau(caisson, 0.06)
    hb.piece(caisson, couleur=(38, 38, 48), materiau="Metal", groupe="Corps")

    hb.rapport()
    hb.export()
"""

import bpy
import bmesh
import json
import math
import os
from mathutils import Matrix, Vector

# --------------------------------------------------------------------------
# limites Roblox (create.roblox.com/docs/art/modeling/specifications)
TRIS_MAX = 20000        # une MeshPart au-dessus est refusée à l'import
TRIS_ALERTE = 10000     # au-dessus, on prévient : la pièce se découpe sans doute
BBOX_MAX = 2048.0       # studs, par axe

MATERIAUX = {
    "Plastic", "SmoothPlastic", "Neon", "Metal", "DiamondPlate", "Foil", "Wood",
    "WoodPlanks", "Marble", "Slate", "Concrete", "Brick", "Granite", "Cobblestone",
    "Sand", "Grass", "Fabric", "Glass", "Ice", "ForceField", "CorrodedMetal",
    "Pebble", "Asphalt", "Basalt", "Limestone", "Sandstone",
}
FIDELITES = {"Default", "Hull", "Box", "PreciseConvexDecomposition"}

_CTX = {
    "nom": None,
    "dossier": None,
    "pieces": [],        # objets Blender déclarés, dans l'ordre de déclaration
    "animations": [],
    "alertes": [],
}


# ==========================================================================
#  scène
# ==========================================================================

def scene(nom, dossier, effacer=True):
    """Ouvre une session : nomme le modèle, fixe le dossier de sortie, et
    (par défaut) vide la scène — un `gen-<slug>.py` doit être rejouable de zéro.
    """
    _CTX["nom"] = nom
    _CTX["dossier"] = os.path.abspath(dossier)
    _CTX["pieces"] = []
    _CTX["animations"] = []
    _CTX["alertes"] = []
    os.makedirs(_CTX["dossier"], exist_ok=True)

    # unités brutes : 1 unité Blender = 1 stud, sans conversion métrique qui
    # viendrait réécrire les nombres affichés dans l'interface.
    u = bpy.context.scene.unit_settings
    u.system = "NONE"
    u.scale_length = 1.0

    if effacer:
        reset()
    return _CTX


def reset():
    """Vide la scène de ses objets et purge les données orphelines."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for bloc in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for d in list(bloc):
            if d.users == 0:
                bloc.remove(d)


def _lier(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _obj(nom, me, position=(0, 0, 0), rotation=None):
    obj = bpy.data.objects.new(nom, me)
    obj.location = Vector(position)
    if rotation:
        obj.rotation_euler = tuple(math.radians(a) for a in rotation)
    return _lier(obj)


def _bm_vers_mesh(bm, nom):
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    return me


# ==========================================================================
#  formes  (bmesh uniquement : aucun bpy.ops, donc aucune dépendance au contexte)
# ==========================================================================

def boite(nom, taille, position=(0, 0, 0), rotation=None):
    """Pavé. `taille` = (x, y, z) en studs, `position` = centre."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(taille), verts=bm.verts)
    return _obj(nom, _bm_vers_mesh(bm, nom), position, rotation)


def cylindre(nom, rayon, hauteur, position=(0, 0, 0), rotation=None,
             segments=32, axe="Z", rayon2=None):
    """Cylindre (ou cône tronqué si `rayon2`). Axe par défaut : Z (debout).

    32 segments est le bon défaut : en dessous de 24 un rond de 2 studs se lit
    comme un polygone, au-dessus de 48 on paie des triangles pour rien.
    """
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segments,
        radius1=rayon, radius2=rayon if rayon2 is None else rayon2,
        depth=hauteur, matrix=Matrix.Identity(4),
    )
    me = _bm_vers_mesh(bm, nom)
    rot = {"Z": None, "X": (0, 90, 0), "Y": (90, 0, 0)}[axe.upper()]
    obj = _obj(nom, me, position, rot)
    if rotation:
        obj.rotation_euler = tuple(
            obj.rotation_euler[i] + math.radians(rotation[i]) for i in range(3))
    return obj


def cone(nom, rayon, hauteur, position=(0, 0, 0), rotation=None, segments=32):
    return cylindre(nom, rayon, hauteur, position, rotation, segments, rayon2=0.0)


def sphere(nom, rayon, position=(0, 0, 0), segments=32, anneaux=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(
        bm, u_segments=segments, v_segments=anneaux, radius=rayon,
        matrix=Matrix.Identity(4))
    return _obj(nom, _bm_vers_mesh(bm, nom), position)


def tore(nom, rayon, tube, position=(0, 0, 0), rotation=None,
         segments=32, segments_tube=14):
    """Anneau. `rayon` = du centre à l'axe du tube, `tube` = rayon du tube."""
    bm = bmesh.new()
    grille = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        ca, sa = math.cos(a), math.sin(a)
        anneau = []
        for j in range(segments_tube):
            b = 2 * math.pi * j / segments_tube
            r = rayon + tube * math.cos(b)
            anneau.append(bm.verts.new((r * ca, r * sa, tube * math.sin(b))))
        grille.append(anneau)
    for i in range(segments):
        i2 = (i + 1) % segments
        for j in range(segments_tube):
            j2 = (j + 1) % segments_tube
            bm.faces.new((grille[i][j], grille[i2][j], grille[i2][j2], grille[i][j2]))
    bm.normal_update()
    return _obj(nom, _bm_vers_mesh(bm, nom), position, rotation)


def revolution(nom, profil, position=(0, 0, 0), rotation=None, segments=32,
               axe="Z", fermer=True):
    """Surface de révolution — le `tour` de volume.mjs, en vrai.

    `profil` : liste de (rayon, hauteur) parcourue de bas en haut, dans le plan
    (r, z). Un vase, un fût, un dôme, une cloche, une roue : tout ce qui est
    tourné se décrit comme ça.

        hb.revolution("Vase", [(0.0, 0), (0.9, 0.4), (1.3, 1.6), (0.5, 2.4)])

    `fermer` bouche le haut et le bas quand le profil n'y arrive pas à r = 0.
    """
    pts = [(float(r), float(z)) for r, z in profil]
    if len(pts) < 2:
        raise ValueError("revolution : il faut au moins deux points de profil")

    bm = bmesh.new()
    anneaux = []
    for r, z in pts:
        if abs(r) < 1e-6:
            anneaux.append([bm.verts.new((0.0, 0.0, z))])      # pôle
        else:
            anneau = []
            for i in range(segments):
                a = 2 * math.pi * i / segments
                anneau.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
            anneaux.append(anneau)

    for k in range(len(anneaux) - 1):
        bas, haut = anneaux[k], anneaux[k + 1]
        for i in range(segments):
            i2 = (i + 1) % segments
            if len(bas) == 1:                                   # pôle bas
                bm.faces.new((bas[0], haut[i], haut[i2]))
            elif len(haut) == 1:                                # pôle haut
                bm.faces.new((bas[i], bas[i2], haut[0]))
            else:
                bm.faces.new((bas[i], bas[i2], haut[i2], haut[i]))

    if fermer:
        for anneau in (anneaux[0], anneaux[-1]):
            if len(anneau) > 2:
                bm.faces.new(anneau)
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    me = _bm_vers_mesh(bm, nom)
    rot = {"Z": None, "X": (0, 90, 0), "Y": (90, 0, 0)}[axe.upper()]
    obj = _obj(nom, me, position, rot)
    if rotation:
        obj.rotation_euler = tuple(
            obj.rotation_euler[i] + math.radians(rotation[i]) for i in range(3))
    return obj


def tube(nom, points, rayon, segments=16, resolution=6, fermer=False):
    """Tube le long d'un chemin — câble, tuyau, poignée, branche.

    Passe par une courbe Bézier lissée : c'est ce qui distingue un vrai tube
    d'un empilement de cylindres bout à bout.
    """
    cu = bpy.data.curves.new(nom, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = resolution
    cu.bevel_depth = rayon
    cu.bevel_resolution = max(1, segments // 4 - 1)
    cu.use_fill_caps = True
    spline = cu.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bp, p in zip(spline.bezier_points, points):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    spline.use_cyclic_u = fermer
    obj = bpy.data.objects.new(nom, cu)
    return _lier(obj)


def plan(nom, taille, position=(0, 0, 0), rotation=None, subdivisions=0):
    """Nappe plate, à courber ensuite (simple deform, lattice, shrinkwrap)."""
    bm = bmesh.new()
    n = subdivisions + 2
    bmesh.ops.create_grid(bm, x_segments=n, y_segments=n, size=0.5,
                          matrix=Matrix.Identity(4))
    bmesh.ops.scale(bm, vec=Vector((taille[0], taille[1], 1.0)), verts=bm.verts)
    return _obj(nom, _bm_vers_mesh(bm, nom), position, rotation)


# ==========================================================================
#  modificateurs  (paramétriques : ils restent modifiables jusqu'à l'export)
# ==========================================================================

def biseau(obj, largeur=0.04, segments=2, angle=40):
    """Rabat les arêtes vives. C'est LE modificateur qui fait la différence
    entre un cube et un objet : une arête parfaitement vive n'accroche aucune
    lumière, et se lit comme du carton."""
    m = obj.modifiers.new("Biseau", "BEVEL")
    m.width = largeur
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle)
    m.harden_normals = segments > 1
    lisser(obj)
    return obj


def subdiv(obj, niveaux=2, catmull=True):
    m = obj.modifiers.new("Subdiv", "SUBSURF")
    m.levels = m.render_levels = niveaux
    m.subdivision_type = "CATMULL_CLARK" if catmull else "SIMPLE"
    return obj


def miroir(obj, axe="X", fusion=0.001):
    """Modélise un côté, obtiens l'autre. Exact, et qui reste synchronisé."""
    m = obj.modifiers.new("Miroir", "MIRROR")
    m.use_axis = tuple(a in axe.upper() for a in "XYZ")
    m.use_mirror_merge = True
    m.merge_threshold = fusion
    return obj


def reseau(obj, n, decalage, relatif=False):
    """Répétition régulière — barreaux, marches, créneaux, rivets."""
    m = obj.modifiers.new("Reseau", "ARRAY")
    m.count = n
    m.use_relative_offset = relatif
    m.use_constant_offset = not relatif
    if relatif:
        m.relative_offset_displace = decalage
    else:
        m.constant_offset_displace = decalage
    return obj


def solidifier(obj, epaisseur, decalage=-1.0):
    m = obj.modifiers.new("Epaisseur", "SOLIDIFY")
    m.thickness = epaisseur
    m.offset = decalage
    return obj


def booleen(obj, outil, operation="DIFFERENCE", cacher=True):
    """Perce, creuse, découpe. `outil` disparaît de l'export (il n'est jamais
    déclaré comme pièce) mais reste dans la scène, donc modifiable."""
    m = obj.modifiers.new("Booleen", "BOOLEAN")
    m.operation = operation
    m.object = outil
    m.solver = "EXACT"
    if cacher:
        outil.display_type = "WIRE"
        outil.hide_render = True
    return obj


def lisser(obj, angle=40):
    """Ombrage lisse au-delà d'un angle — les faces plates restent plates."""
    me = obj.data
    if not hasattr(me, "polygons"):
        return obj
    for p in me.polygons:
        p.use_smooth = True
    # `use_auto_smooth` a disparu en Blender 4.1 au profit d'un modificateur
    # « Smooth by Angle » ; on couvre les deux, sans faire échouer le script.
    if hasattr(me, "use_auto_smooth"):
        me.use_auto_smooth = True
        me.auto_smooth_angle = math.radians(angle)
    else:
        try:
            m = obj.modifiers.new("Lissage", "SMOOTH_BY_ANGLE")
            m["Input_1"] = math.radians(angle)
        except Exception:
            pass
    return obj


def deformer(obj, methode="BEND", angle=45, axe="Z"):
    m = obj.modifiers.new("Deform", "SIMPLE_DEFORM")
    m.deform_method = methode
    m.angle = math.radians(angle)
    m.deform_axis = axe.upper()
    return obj


# ==========================================================================
#  organique  (créatures, monstres — la méthode : references/organique.md)
# ==========================================================================

def squelette(nom, os, lissage_branches=0.6, subdivisions=2):
    """Corps organique par squelette gonflé (modificateur Skin).

    `os` : liste de chaînes ; un point = (x, y, z, rayon). Deux chaînes se
    SOUDENT quand elles partagent un point aux mêmes coordonnées — c'est comme
    ça qu'une patte s'attache à une colonne vertébrale :

        hb.squelette("Membres", [
            [(0, -1.6, 3.0, .5), (0, 0.0, 3.1, .55), (0, 1.2, 3.2, .45)],   # colonne
            [(0, 1.2, 3.2, .45), (0, 1.8, 4.6, .28)],                       # cou (soudé)
            [(.4, 1.0, 3.0, .18), (.42, 1.0, 1.6, .11), (.42, 1.0, .4, .09)],  # patte
        ])

    Le résultat est UNE surface continue : les jonctions sont fondues par le
    modificateur, pas des sphères qui s'intersectent. Enchaîner avec
    `fusionner()` (voxel) pour souder au reste du corps, `sculpter()` pour les
    volumes, `facetter()` pour le style.
    """
    verts, aretes = [], []
    index, rayons = {}, []
    for chaine in os:
        if len(chaine) < 2:
            raise ValueError("squelette : chaque chaîne veut au moins deux points")
        prec = None
        for x, y, z, r in chaine:
            cle = (round(x, 4), round(y, 4), round(z, 4))
            i = index.get(cle)
            if i is None:
                i = len(verts)
                index[cle] = i
                verts.append((x, y, z))
                rayons.append(float(r))
            else:
                rayons[i] = max(rayons[i], float(r))   # jonction : le plus épais gagne
            if prec is not None and prec != i:
                aretes.append((prec, i))
            prec = i
    aretes = sorted({tuple(sorted(a)) for a in aretes})

    # une racine par île (le modificateur Skin en veut une) : union-find
    parent = list(range(len(verts)))

    def _rac(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for a, b in aretes:
        parent[_rac(a)] = _rac(b)
    vues, racines = set(), []
    for i in range(len(verts)):
        r = _rac(i)
        if r not in vues:
            vues.add(r)
            racines.append(i)

    me = bpy.data.meshes.new(nom)
    me.from_pydata(verts, aretes, [])
    obj = _obj(nom, me)

    # la couche de données « skin » n'existe pas tant qu'on ne la crée pas
    b2 = bmesh.new()
    b2.from_mesh(me)
    b2.verts.layers.skin.verify()
    b2.to_mesh(me)
    b2.free()
    donnees = me.skin_vertices[0].data
    for i, r in enumerate(rayons):
        donnees[i].radius = (r, r)
    for i in racines:
        donnees[i].use_root = True

    m = obj.modifiers.new("Peau", "SKIN")
    m.branch_smoothing = lissage_branches
    m.use_smooth_shade = True
    if subdivisions:
        subdiv(obj, subdivisions)
    return obj


def loft(nom, sections, segments=24, fermer=True):
    """Volume par sections — LE torse organique contrôlé.

    `sections` : liste de (centre, rayon) ou (centre, rayon_x, rayon_z),
    parcourue d'un bout à l'autre (croupe → poitrail, crâne → museau…). Chaque
    section est une ellipse posée perpendiculairement au chemin ; le volume les
    relie en une surface continue. Là où `revolution()` tourne autour d'un axe,
    `loft()` suit un chemin et change de galbe en route :

        hb.loft("Torse", [
            ((0, -1.8, 3.1), 0.42, 0.52),   # croupe
            ((0, -0.2, 3.1), 0.48, 0.60),   # taille (plus étroite)
            ((0,  0.7, 3.2), 0.58, 0.75),   # poitrail (le plus large)
            ((0,  1.3, 3.3), 0.42, 0.58),   # épaules
        ])

    Écraser `rayon_z` (`rx >> rz`) donne une forme plate : oreille, aile,
    nageoire, langue.
    """
    pts = []
    for s in sections:
        c = Vector(s[0])
        rx = float(s[1])
        rz = float(s[2]) if len(s) > 2 else rx
        pts.append((c, rx, rz))
    if len(pts) < 2:
        raise ValueError("loft : au moins deux sections")

    n = len(pts)
    bm = bmesh.new()
    anneaux = []
    for i, (c, rx, rz) in enumerate(pts):
        t = pts[min(n - 1, i + 1)][0] - pts[max(0, i - 1)][0]
        t = t.normalized() if t.length > 1e-9 else Vector((0, 1, 0))
        ref = Vector((0, 0, 1)) if abs(t.z) < 0.95 else Vector((0, 1, 0))
        cote = t.cross(ref).normalized()
        haut = cote.cross(t).normalized()
        anneau = []
        for k in range(segments):
            a = 2 * math.pi * k / segments
            anneau.append(bm.verts.new(
                c + cote * (rx * math.cos(a)) + haut * (rz * math.sin(a))))
        anneaux.append(anneau)
    for i in range(n - 1):
        bas, haut_ = anneaux[i], anneaux[i + 1]
        for k in range(segments):
            k2 = (k + 1) % segments
            bm.faces.new((bas[k], bas[k2], haut_[k2], haut_[k]))
    if fermer:
        for anneau, c in ((anneaux[0], pts[0][0]), (anneaux[-1], pts[-1][0])):
            pole = bm.verts.new(c)
            for k in range(segments):
                bm.faces.new((anneau[k], anneau[(k + 1) % segments], pole))
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return lisser(_obj(nom, _bm_vers_mesh(bm, nom)))


def corne(nom, points, rayon, pointe=0.0, rayons=None, segments=12, resolution=8):
    """Fuseau effilé le long d'un chemin — corne, bois de cerf, mèche de
    crinière, plume de queue, griffe, croc, petite branche.

    Le rayon file de `rayon` à `pointe` (0 = pointe vive) le long du chemin, ou
    suit `rayons` point par point s'il est donné. Un bois ramifié = une corne
    maîtresse + une corne par branche qui DÉMARRE sur un point de la maîtresse,
    puis un seul `fusionner()` (sans voxel) pour en faire une pièce.
    """
    if len(points) < 2:
        raise ValueError("corne : au moins deux points")
    if rayons is None:
        n = len(points)
        rayons = [pointe + (rayon - pointe) * (1 - i / (n - 1)) for i in range(n)]
    cu = bpy.data.curves.new(nom, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = resolution
    cu.bevel_depth = 1.0                    # le rayon vit sur les points
    cu.bevel_resolution = max(1, segments // 4 - 1)
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, p, r in zip(sp.bezier_points, points, rayons):
        bp.co = Vector(p)
        bp.radius = max(0.0, float(r))
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    return _lier(bpy.data.objects.new(nom, cu))


def sculpter(obj, centre, rayon, vecteur=(0, 0, 0), gonfle=0.0):
    """Le coup de pouce du sculpteur : déplace en douceur ce qui tombe dans la
    sphère d'influence — bomber un poitrail (`gonfle` > 0), creuser une taille
    (`gonfle` < 0), tirer un museau (`vecteur`). Falloff lisse : aucune marche.

        hb.sculpter(corps, centre=(0, 0.9, 3.0), rayon=1.0, gonfle=0.15)

    S'applique au MESH DE BASE : sur un objet fusionné, le remesh repasse
    derrière et la surface reste propre. Sur un `squelette()`, c'est le
    squelette qui bouge (utile pour poser une patte), mais `gonfle` n'y a pas
    de sens — passer par les rayons.
    """
    me = obj.data
    if not hasattr(me, "vertices"):
        raise ValueError("sculpter : il faut un mesh (une corne se fusionne d'abord)")
    inv = obj.matrix_world.inverted()
    c = inv @ Vector(centre)
    vec = inv.to_3x3() @ Vector(vecteur)
    r2 = float(rayon)
    for v in me.vertices:
        d = (v.co - c).length
        if d >= r2:
            continue
        t = 1.0 - d / r2
        f = t * t * (3.0 - 2.0 * t)          # smoothstep
        v.co += vec * f + v.normal * (gonfle * f)
    me.update()
    return obj


def fusionner(nom, objets, voxel=None, lissage=10, garder=False):
    """Fusionne plusieurs objets en UN seul mesh (modificateurs appliqués, les
    ingrédients quittent la scène sauf `garder=True`).

    Sans `voxel` : simple assemblage — réunir quatre sabots, huit mèches, un
    bois ramifié en une seule pièce.

    Avec `voxel` (en studs, p.ex. 0.12) : fusion ORGANIQUE — les surfaces sont
    refondues en une seule peau continue (remesh voxel + détente) et les
    jointures disparaissent. C'est CE QUI SÉPARE une créature d'un bonhomme de
    neige : sphère + cylindre + sphère montre trois objets, la fusion montre un
    corps. ⚠ tout détail plus fin que `voxel` fond ou disparaît : les oreilles
    et les mèches restent DEHORS. Choix du voxel : references/organique.md.
    """
    if not objets:
        raise ValueError("fusionner : aucun objet")
    bm = bmesh.new()
    for o in objets:
        me, _ = _mesh_evalue(o)
        me.transform(o.matrix_world)
        if o.matrix_world.determinant() < 0:
            me.flip_normals()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    obj = _obj(nom, _bm_vers_mesh(bm, nom))
    if not garder:
        for o in objets:
            bpy.data.objects.remove(o, do_unlink=True)
    if voxel:
        m = obj.modifiers.new("Fusion", "REMESH")
        m.mode = "VOXEL"
        m.voxel_size = float(voxel)
        m.use_smooth_shade = True
        s = obj.modifiers.new("Detente", "SMOOTH")
        s.factor = 1.0
        s.iterations = int(lissage)
    return obj


def facetter(obj, cible=3000):
    """Le fini « low-poly stylisé » des créatures d'anime Roblox : réduit le
    maillage vers `cible` triangles et passe l'ombrage à PLAT. Les facettes
    deviennent un choix graphique, plus un défaut de modélisation.

    À appliquer en DERNIER, une fois la forme validée — sculpter après coup
    marche (les modificateurs rejouent), mais se juge sur un maillage qui
    n'est plus celui qu'on livre. Pour un fini lisse, `lisser()` et ne pas
    décimer.
    """
    if obj.type != "MESH":
        raise ValueError("facetter : il faut un mesh — fusionner les courbes d'abord")
    m = _mesures(obj)
    if m is not None:
        me, i = m
        bpy.data.meshes.remove(me)
        if i["tris"] > cible:
            d = obj.modifiers.new("Facettes", "DECIMATE")
            d.ratio = max(0.005, cible / float(i["tris"]))
            d.use_collapse_triangulate = True
    for mod in list(obj.modifiers):
        if mod.type in {"REMESH", "SKIN"}:
            mod.use_smooth_shade = False
        if mod.name == "Lissage":                 # posé par lisser() en Blender 4.1+
            obj.modifiers.remove(mod)
    me = obj.data
    for p in me.polygons:
        p.use_smooth = False
    if hasattr(me, "use_auto_smooth"):
        me.use_auto_smooth = False
    return obj


# ==========================================================================
#  pièces
# ==========================================================================

def piece(obj, nom=None, couleur=(163, 162, 165), materiau="SmoothPlastic",
          groupe=None, transparence=0.0, collision=True, fidelite=None,
          rendu=None):
    """Déclare un objet comme PIÈCE : une pièce = une MeshPart dans Roblox.

    Découper en pièces se décide sur trois critères, dans cet ordre :
      1. **couleur / matériau** — une MeshPart a UNE couleur. Deux teintes,
         deux pièces (tant qu'on n'a pas de texture).
      2. **mouvement** — tout ce qui doit s'animer est une pièce (ou un groupe
         de pièces) à part.
      3. **budget** — 20 000 triangles maximum par MeshPart.

    Un objet non déclaré n'est pas exporté : c'est ce qui permet de laisser
    dans la scène les outils de booléen, les guides et les gabarits.
    """
    nom = nom or obj.name
    _valider_nom(nom)
    if any(p.name == nom for p in _CTX["pieces"] if p is not obj):
        raise ValueError(
            "deux pièces s'appellent « %s » — le 3D Importer de Studio "
            "renommerait la seconde en « %s1 » et l'assemblage ne la "
            "retrouverait plus." % (nom, nom))
    if materiau not in MATERIAUX:
        raise ValueError("matériau Roblox inconnu : %s" % materiau)
    if fidelite is not None and fidelite not in FIDELITES:
        raise ValueError("CollisionFidelity inconnue : %s" % fidelite)

    obj.name = nom
    obj["hb"] = 1
    obj["hb_couleur"] = [int(c) for c in couleur]
    obj["hb_materiau"] = materiau
    obj["hb_groupe"] = groupe or ""
    obj["hb_transparence"] = float(transparence)
    obj["hb_collision"] = 1 if collision else 0
    obj["hb_fidelite"] = fidelite or ("Box" if collision else "Box")
    obj["hb_rendu"] = rendu or "Automatic"

    _materiau_apercu(obj, couleur, transparence)
    if obj not in _CTX["pieces"]:
        _CTX["pieces"].append(obj)
    return obj


def pieces(*objs, **kw):
    """Déclare plusieurs objets d'un coup, même habillage."""
    return [piece(o, **kw) for o in objs]


def _valider_nom(nom):
    ok = nom and (nom[0].isalpha() or nom[0] == "_")
    ok = ok and all(c.isalnum() or c == "_" for c in nom)
    ok = ok and nom.isascii()
    if not ok:
        raise ValueError(
            "« %s » n'est pas un nom de pièce utilisable : le 3D Importer de "
            "Studio réécrit les noms qui contiennent un espace, un point ou un "
            "accent, et l'assemblage retrouve les MeshParts PAR LEUR NOM. "
            "Utiliser [A-Za-z][A-Za-z0-9_]*." % nom)


def _srgb_lineaire(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _materiau_apercu(obj, couleur, transparence):
    """Un matériau Blender à la couleur déclarée : la capture du viewport
    montre alors les vraies couleurs du modèle Roblox, pas du gris."""
    nom = "hb_%d_%d_%d" % tuple(int(c) for c in couleur)
    mat = bpy.data.materials.get(nom)
    if mat is None:
        mat = bpy.data.materials.new(nom)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        rgba = tuple(_srgb_lineaire(c) for c in couleur) + (1.0,)
        if bsdf:
            bsdf.inputs["Base Color"].default_value = rgba
            if "Roughness" in bsdf.inputs:
                bsdf.inputs["Roughness"].default_value = 0.55
        mat.diffuse_color = rgba
    if hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    obj.color = tuple(_srgb_lineaire(c) for c in couleur) + (1.0,)


# ==========================================================================
#  animations  (même schéma que model.json — même player Lua)
# ==========================================================================

def animation(nom, duree, tracks, boucle=False):
    """Ajoute une animation. Une track vise une PIÈCE ou un GROUPE par son nom.

    ⚠ Deux repères se croisent ici, et c'est le seul endroit du pipeline :
      - `pivot` se donne en coordonnées **Blender** (celles que tu lis dans
        l'interface) : il est converti comme le reste de la géométrie ;
      - `rotation` se donne en degrés **Roblox** — l'axe vertical y est Y.
        Charnière de porte = rotation autour de Y. Bascule d'un couvercle vers
        l'arrière = rotation autour de X.

        hb.animation("Ouvrir", 1.2, [
            {"target": "Couvercle",
             "pivot": (0, 1.4, 2.0),                 # coords Blender
             "keyframes": [{"t": 0, "rotation": [0, 0, 0]},
                           {"t": 1.2, "rotation": [-95, 0, 0], "easing": "easeOutBack"}]},
        ])
    """
    _CTX["animations"].append({
        "name": nom, "duration": float(duree), "loop": bool(boucle),
        "tracks": [dict(t) for t in tracks],
    })


# ==========================================================================
#  mesure  (tout se mesure sur le mesh ÉVALUÉ : modificateurs compris)
# ==========================================================================

def _mesh_evalue(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(
        ev, preserve_all_data_layers=True, depsgraph=dg)
    return me, ev


def _mesures(obj):
    me, _ = _mesh_evalue(obj)
    if len(me.vertices) == 0:
        bpy.data.meshes.remove(me)
        return None
    me.transform(obj.matrix_world)
    if obj.matrix_world.determinant() < 0:
        me.flip_normals()                 # un miroir par échelle -1 retourne tout
    me.calc_loop_triangles()
    xs = [v.co for v in me.vertices]
    mn = Vector((min(v.x for v in xs), min(v.y for v in xs), min(v.z for v in xs)))
    mx = Vector((max(v.x for v in xs), max(v.y for v in xs), max(v.z for v in xs)))
    infos = {
        "min_b": mn, "max_b": mx,
        "tris": len(me.loop_triangles), "verts": len(me.vertices),
    }
    return me, infos


def vers_roblox(v):
    """(x, y, z) Blender -> (x, z, -y) Roblox. Rotation pure, aucun miroir."""
    return (round(v[0], 4), round(v[2], 4), round(-v[1], 4))


def _bbox_roblox(mn, mx):
    """AABB Blender -> (taille, centre) Roblox, en studs."""
    taille = (mx.x - mn.x, mx.z - mn.z, mx.y - mn.y)   # x, y=hauteur, z=profondeur
    centre = ((mn.x + mx.x) / 2, (mn.z + mx.z) / 2, -(mn.y + mx.y) / 2)
    return [round(t, 4) for t in taille], [round(c, 4) for c in centre]


# ==========================================================================
#  rapport
# ==========================================================================

def rapport(afficher=True):
    """Mesure tout et rend un état des lieux, SANS rien exporter.

    À lancer avant chaque export, et après chaque grosse modification : c'est
    ici qu'on apprend qu'une pièce pèse 40 000 triangles, pas dans Studio.
    """
    if not _CTX["pieces"]:
        raise RuntimeError("aucune pièce déclarée — appeler hb.piece(obj, …)")

    lignes, total_tris = [], 0
    alertes = []
    mn_g = Vector((1e9, 1e9, 1e9))
    mx_g = Vector((-1e9, -1e9, -1e9))

    for obj in _CTX["pieces"]:
        m = _mesures(obj)
        if m is None:
            alertes.append("%s : mesh vide (0 sommet) — pièce à supprimer ou à corriger" % obj.name)
            continue
        me, i = m
        bpy.data.meshes.remove(me)
        total_tris += i["tris"]
        for a in "xyz":
            setattr(mn_g, a, min(getattr(mn_g, a), getattr(i["min_b"], a)))
            setattr(mx_g, a, max(getattr(mx_g, a), getattr(i["max_b"], a)))
        taille, _ = _bbox_roblox(i["min_b"], i["max_b"])
        drapeau = "!!" if i["tris"] > TRIS_MAX else ("! " if i["tris"] > TRIS_ALERTE else "  ")
        lignes.append("%s %-24s %7d tris  %s studs  %s" % (
            drapeau, obj.name, i["tris"],
            " x ".join("%.2f" % t for t in taille),
            obj.get("hb_groupe") or "-"))
        if i["tris"] > TRIS_MAX:
            alertes.append(
                "%s : %d triangles, au-dessus du plafond Roblox de %d — le 3D "
                "Importer refusera la pièce. La découper, ou baisser subdiv/segments."
                % (obj.name, i["tris"], TRIS_MAX))
        elif i["tris"] > TRIS_ALERTE:
            alertes.append("%s : %d triangles — lourd pour une seule MeshPart." % (obj.name, i["tris"]))
        if min(taille) < 0.05:
            alertes.append("%s : une dimension fait %.3f stud (minimum Roblox 0.05)." % (obj.name, min(taille)))

    taille_g, centre_g = _bbox_roblox(mn_g, mx_g)
    if max(taille_g) > BBOX_MAX:
        alertes.append("modèle de %.0f studs : au-dessus du plafond de %d par axe." % (max(taille_g), BBOX_MAX))

    _CTX["alertes"] = alertes
    txt = ["[HyperBlox/Blender] %s — %d pièces, %d triangles, %s studs" % (
        _CTX["nom"], len(_CTX["pieces"]), total_tris,
        " x ".join("%.2f" % t for t in taille_g))]
    txt += lignes
    if alertes:
        txt.append("Alertes :")
        txt += ["  - " + a for a in alertes]
    txt = "\n".join(txt)
    if afficher:
        print(txt)
    return txt


# ==========================================================================
#  export
# ==========================================================================

def export(fbx=None, manifest=None):
    """Écrit le FBX (multi-objets, un objet par pièce) et le manifest.json.

    Chaque objet exporté est une COPIE aplatie : modificateurs appliqués,
    rotation et échelle absorbées dans la géométrie, origine recalée au centre
    de la boîte englobante. Il ne reste qu'une translation — plus rien qui
    puisse se perdre ou se réinterpréter dans la conversion FBX.
    """
    if not _CTX["dossier"]:
        raise RuntimeError("appeler hb.scene(nom, dossier) d'abord")
    rapport(afficher=False)

    slug = os.path.basename(_CTX["dossier"]) or _CTX["nom"].lower()
    chemin_fbx = fbx or os.path.join(_CTX["dossier"], slug + ".fbx")
    chemin_man = manifest or os.path.join(_CTX["dossier"], "manifest.json")

    coll = bpy.data.collections.new("_hb_export")
    bpy.context.scene.collection.children.link(coll)
    dups, entrees, renommes = [], [], []
    mn_g = Vector((1e9, 1e9, 1e9))
    mx_g = Vector((-1e9, -1e9, -1e9))

    try:
        for obj in _CTX["pieces"]:
            m = _mesures(obj)
            if m is None:
                continue
            me, i = m                      # me est DÉJÀ en coordonnées monde
            mn, mx = i["min_b"], i["max_b"]
            centre = (mn + mx) / 2
            me.transform(Matrix.Translation(-centre))   # géométrie centrée sur son origine

            # LIBÉRER LE NOM avant de créer la copie. Blender refuse deux objets
            # homonymes : tant que l'original le porte, la copie sort en
            # « Braseros.001 », le FBX transporte ce nom-là jusque dans Studio, et
            # `assemble.lua` — qui retrouve ses MeshParts PAR LEUR NOM — ne trouve
            # plus rien. Le nom est le seul lien entre les deux moitiés du
            # pipeline : il ne peut pas être approximatif.
            nom = obj.name
            donnee = obj.data
            nom_donnee = getattr(donnee, "name", None)
            obj.name = nom + "__hb_src"
            if nom_donnee is not None:
                donnee.name = nom_donnee + "__hb_src"
            renommes.append((obj, nom, donnee, nom_donnee))
            me.name = nom

            dup = bpy.data.objects.new(nom, me)
            coll.objects.link(dup)
            dup.matrix_world = Matrix.Translation(centre)
            dups.append(dup)

            for a in "xyz":
                setattr(mn_g, a, min(getattr(mn_g, a), getattr(mn, a)))
                setattr(mx_g, a, max(getattr(mx_g, a), getattr(mx, a)))
            taille, pos = _bbox_roblox(mn, mx)
            entrees.append({
                "name": nom,
                "group": obj.get("hb_groupe") or None,
                "size": taille,
                "position": pos,           # recalé sur le pivot du modèle plus bas
                "color": [int(c) for c in obj.get("hb_couleur", [163, 162, 165])],
                "material": obj.get("hb_materiau", "SmoothPlastic"),
                "transparency": round(float(obj.get("hb_transparence", 0.0)), 3),
                "collide": bool(obj.get("hb_collision", 1)),
                "fidelity": obj.get("hb_fidelite", "Box"),
                "render": obj.get("hb_rendu", "Automatic"),
                "tris": i["tris"], "verts": i["verts"],
            })

        # pivot du modèle : au SOL, au CENTRE — même convention que model.json,
        # pour que les deux pipelines se posent pareil dans le monde.
        taille_g, centre_g = _bbox_roblox(mn_g, mx_g)
        pivot = [centre_g[0], centre_g[1] - taille_g[1] / 2, centre_g[2]]
        for e in entrees:
            e["position"] = [round(e["position"][k] - pivot[k], 4) for k in range(3)]

        _exporter_fbx(chemin_fbx, dups)
    finally:
        # les copies partent d'abord : elles occupent les noms qu'on va rendre
        for d in dups:
            me = d.data
            bpy.data.objects.remove(d, do_unlink=True)
            if me.users == 0:
                bpy.data.meshes.remove(me)
        bpy.data.collections.remove(coll)
        for obj, nom, donnee, nom_donnee in renommes:
            obj.name = nom
            if nom_donnee is not None:
                donnee.name = nom_donnee

    man = {
        "name": _CTX["nom"],
        "unit": "stud",
        "axes": "Roblox (Y haut, -Z avant) ; converti depuis Blender par (x, z, -y)",
        "fbx": os.path.basename(chemin_fbx),
        "size": taille_g,
        "pieces": entrees,
        "animations": _CTX["animations"],
        "warnings": _CTX["alertes"],
    }
    with open(chemin_man, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=2)

    print("[HyperBlox/Blender] export %s — %d pièces, %d triangles, %s studs" % (
        _CTX["nom"], len(entrees), sum(e["tris"] for e in entrees),
        " x ".join("%.2f" % t for t in taille_g)))
    print("  -> " + chemin_fbx)
    print("  -> " + chemin_man)
    if _CTX["alertes"]:
        print("  Alertes :\n    - " + "\n    - ".join(_CTX["alertes"]))
    return {"fbx": chemin_fbx, "manifest": chemin_man, "pieces": len(entrees)}


def _exporter_fbx(chemin, dups):
    for o in bpy.context.scene.objects:
        try:
            o.select_set(False)
        except RuntimeError:
            pass
    for d in dups:
        d.select_set(True)
    bpy.context.view_layer.objects.active = dups[0] if dups else None

    kw = dict(
        filepath=chemin,
        use_selection=True,
        object_types={"MESH"},
        # Z-up Blender -> Y-up Roblox, sans miroir. Même conversion que
        # vers_roblox() : la géométrie et le manifest restent d'accord.
        axis_forward="-Z", axis_up="Y",
        apply_scale_options="FBX_SCALE_UNITS",
        bake_space_transform=False,
        use_mesh_modifiers=False,      # déjà appliqués sur les copies
        mesh_smooth_type="FACE",       # Roblox lit les groupes de lissage
        use_triangles=True,
        use_custom_props=False,
        path_mode="COPY",
        embed_textures=True,
        add_leaf_bones=False,
        bake_anim=False,
    )
    # l'opérateur FBX perd et gagne des options selon la version de Blender :
    # on ne lui passe que ce qu'il connaît, plutôt que d'échouer sur un mot-clé.
    connus = set(bpy.ops.export_scene.fbx.get_rna_type().properties.keys())
    bpy.ops.export_scene.fbx(**{k: v for k, v in kw.items() if k in connus})


# ==========================================================================
#  vues  (pour les captures de contrôle via get_viewport_screenshot)
# ==========================================================================

_VUES = {
    "face": "FRONT", "arriere": "BACK", "profil": "RIGHT", "gauche": "LEFT",
    "dessus": "TOP", "dessous": "BOTTOM",
}


def vue(nom="3q", cadrer=True):
    """Place le viewport 3D. `face`, `profil`, `dessus`, `3q`.

    Une silhouette se juge de FACE et de PROFIL, à plat : la vue de trois
    quarts montre le détail, jamais la ligne d'ensemble.
    """
    zone = next((a for a in bpy.context.screen.areas if a.type == "VIEW_3D"), None)
    if zone is None:
        print("pas de vue 3D dans l'espace de travail courant")
        return
    region = next((r for r in zone.regions if r.type == "WINDOW"), None)
    espace = zone.spaces.active
    espace.shading.type = "MATERIAL"
    with bpy.context.temp_override(area=zone, region=region, space_data=espace):
        if nom in _VUES:
            bpy.ops.view3d.view_axis(type=_VUES[nom], align_active=False)
            espace.region_3d.view_perspective = "ORTHO"
        else:                                     # trois quarts
            bpy.ops.view3d.view_axis(type="FRONT")
            espace.region_3d.view_perspective = "PERSP"
            bpy.ops.view3d.view_orbit(angle=math.radians(35), type="ORBITLEFT")
            bpy.ops.view3d.view_orbit(angle=math.radians(22), type="ORBITUP")
        if cadrer:
            bpy.ops.object.select_all(action="DESELECT")
            for p in _CTX["pieces"]:
                p.select_set(True)
            bpy.ops.view3d.view_selected()
    return nom


def sauver(chemin=None):
    """Sauvegarde le .blend à côté du manifest — l'état Blender fait partie
    du modèle, même si le générateur reste la source de vérité."""
    chemin = chemin or os.path.join(
        _CTX["dossier"], (os.path.basename(_CTX["dossier"]) or "modele") + ".blend")
    bpy.ops.wm.save_as_mainfile(filepath=chemin)
    print("  -> " + chemin)
    return chemin
