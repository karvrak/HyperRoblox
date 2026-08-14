# Modéliser dans Blender depuis un générateur

`lib/hyperblox.py` est au pipeline Blender ce que `lib/volume.mjs` est au
pipeline en Parts : un vocabulaire. La différence tient en une phrase — ici,
une courbe est une vraie courbe, pas une suite de cubes qui l'approche.

Tout est **paramétrique jusqu'à l'export** : les modificateurs restent des
modificateurs, donc changer une épaisseur de biseau ou un nombre de segments est
une ligne à modifier, pas un modèle à refaire.

## Le squelette d'un générateur

```python
import hyperblox as hb

hb.scene("CasqueGarde", r"D:/mon-jeu/hyperblox/casque-garde")

# … formes, modificateurs, déclaration des pièces …

hb.rapport()
hb.export()
hb.sauver()
```

`hb.scene()` fixe les unités (**1 unité Blender = 1 stud**), le dossier de
sortie, et **vide la scène** — un générateur doit être rejouable de zéro, sinon
la dixième exécution empile dix modèles.

## Les formes

| Appel | Ce que c'est |
|---|---|
| `boite(nom, (x,y,z), position, rotation=None)` | pavé |
| `cylindre(nom, rayon, hauteur, position, segments=32, axe="Z", rayon2=None)` | cylindre, ou cône tronqué avec `rayon2` |
| `cone(nom, rayon, hauteur, position, segments=32)` | cône |
| `sphere(nom, rayon, position, segments=32, anneaux=16)` | sphère UV |
| `tore(nom, rayon, tube, position, rotation=None)` | anneau |
| `revolution(nom, profil, position, segments=32, axe="Z")` | **surface de révolution** |
| `tube(nom, points, rayon, segments=16)` | tube lissé le long d'un chemin |
| `plan(nom, (x,y), position, subdivisions=0)` | nappe plate, à courber ensuite |
| `squelette(nom, os)` | corps organique par squelette gonflé (points + rayons) |
| `loft(nom, sections, segments=24)` | volume par sections elliptiques le long d'un chemin |
| `corne(nom, points, rayon, pointe=0)` | fuseau effilé — corne, mèche, griffe, plume |

Tout est construit avec `bmesh`, sans un seul `bpy.ops.mesh.*` : les opérateurs
dépendent du contexte de l'interface, et le contexte d'un appel MCP n'est pas
celui d'un clic. C'est ce qui fait qu'un générateur s'exécute pareil que la vue
3D soit au premier plan ou non.

### `revolution` — la forme à connaître

Le profil est une liste de `(rayon, hauteur)` parcourue **de bas en haut**, dans
le plan `(r, z)`. Un rayon nul fait un pôle (le sommet d'un dôme).

```python
# un vase : pied étroit, panse, col
hb.revolution("Vase", [(0.0, 0.0), (0.5, 0.05), (0.45, 0.3),
                       (1.1, 1.0), (0.9, 1.8), (0.55, 2.1), (0.6, 2.3)])

# un dôme : le profil finit sur un pôle
hb.revolution("Dome", [(1.6, 0.0), (1.55, 0.6), (1.2, 1.2), (0.0, 1.7)])
```

Tout ce qui a été tourné dans la réalité — vase, fût, casque, cloche, roue,
bouton, obus, tonneau — se décrit comme ça, et en deux lignes.

### `tube` — les chemins

```python
hb.tube("Cable", [(0, 0, 2.4), (0.6, 0.2, 1.8), (0.9, 0.1, 0.9), (0.8, 0, 0)], rayon=0.06)
```

Passe par une courbe Bézier à poignées automatiques : le résultat est lisse, là
où un empilement de cylindres bout à bout montrerait chaque jointure.

## Les modificateurs

| Appel | Effet |
|---|---|
| `biseau(obj, largeur=0.04, segments=2, angle=40)` | rabat les arêtes vives, et lisse |
| `subdiv(obj, niveaux=2)` | Catmull-Clark |
| `miroir(obj, axe="X")` | modéliser un côté, obtenir l'autre |
| `reseau(obj, n, decalage)` | répétition régulière |
| `solidifier(obj, epaisseur)` | donne une épaisseur à une nappe |
| `booleen(obj, outil, "DIFFERENCE")` | perce, creuse, découpe |
| `lisser(obj, angle=40)` | ombrage lisse au-delà d'un angle |
| `deformer(obj, "BEND", angle, axe)` | courbe une forme droite |
| `sculpter(obj, centre, rayon, vecteur, gonfle)` | bombe, creuse ou tire une zone, falloff lisse |
| `fusionner(nom, objets, voxel=None)` | UN mesh ; avec `voxel`, fusion organique (jointures fondues) |
| `facetter(obj, cible=3000)` | décime vers `cible` triangles + ombrage plat — le fini « anime » |

### `biseau` : le modificateur qui change tout

C'est **la** différence visible entre un modèle Blender et un empilement de
Parts. Une arête parfaitement vive n'accroche aucune lumière : elle se lit comme
du carton, quel que soit le nombre de polygones autour. Un biseau de 2 à 5 cm
(0,02 à 0,05 stud) suffit à créer le filet de lumière qui donne l'échelle.

Règle d'usage : biseauter **tout ce qui est fabriqué** (métal, plastique, bois
travaillé), et laisser vif ce qui est cassé ou taillé.

Le coût est réel — chaque arête biseautée en `segments=2` triple ses faces.
Commencer à `segments=1` pendant le travail de silhouette, monter à 2 ou 3 pour
la livraison.

### `booleen` : l'objet outil ne s'exporte pas

```python
caisson = hb.boite("Caisson", (2.6, 1.7, 3.2), (0, 0, 1.6))
trou    = hb.cylindre("_trou", 0.5, 3.0, (0, -0.85, 2.1), axe="Y")
hb.booleen(caisson, trou)
hb.piece(caisson, couleur=(180, 62, 54))    # `trou` n'est jamais déclaré : il n'existe pas pour Roblox
```

Un objet non déclaré par `hb.piece()` n'est **pas exporté**. C'est ce qui permet
de laisser dans la scène les outils de booléen, les guides et les gabarits — et
donc de les modifier plus tard, ce qu'un booléen appliqué interdirait.

Le solveur `EXACT` est lent sur des maillages denses : faire les booléens
**avant** de subdiviser.

## Déclarer les pièces

```python
hb.piece(obj, nom=None, couleur=(163,162,165), materiau="SmoothPlastic",
         groupe=None, transparence=0.0, collision=True,
         fidelite=None, rendu=None)
```

`hb.piece()` fait trois choses : elle inscrit l'objet dans l'export, elle
attache l'habillage Roblox en propriétés personnalisées (donc sauvegardées dans
le `.blend`), et elle applique un **matériau Blender à la couleur déclarée** —
si bien que la capture du viewport montre les vraies couleurs du modèle Roblox
et non du gris.

Rappel du découpage (détaillé dans `pipeline-mesh.md`) : une couleur = une
pièce, une chose qui bouge = une pièce ou un groupe, 20 000 triangles = un
plafond dur.

## Lire l'image en formes

La méthode est celle de `../hyperblox/references/style-detaille.md` : silhouette,
puis masses, puis pour chaque masse sa primitive. Seule la table de
correspondance change.

| Ce qu'on voit | En Parts (`hyperblox`) | Ici |
|---|---|---|
| un vase, un fût, un casque | `V.tour()` — empilement de disques | `revolution()` |
| un anneau, un pneu | `V.anneau()` | `tore()` |
| une coque bombée | `V.nappe()` — bandes | `plan()` + `deformer()`, ou `revolution()` partielle |
| un câble, une branche | `V.chaine()` | `tube()` |
| une arête adoucie | impossible | `biseau()` |
| un objet symétrique | `V.miroirX()` | `miroir()` |
| un trou, une découpe | à contourner | `booleen()` |
| une créature, un monstre, un animal | impossible proprement | **`organique.md`** — squelette, loft, fusion voxel, facettes |

Les trois dernières lignes sont les vraies raisons de venir ici.

## Contrôler avant de montrer

```python
hb.rapport()      # triangles et dimensions par pièce, alertes de budget
hb.vue("face")    # puis get_viewport_screenshot
hb.vue("profil")
hb.vue("3q")
```

`hb.vue()` place le viewport et cadre sur les pièces déclarées, en ombrage
matériau. Une silhouette se juge **de face et de profil** : le trois-quarts
montre le détail, jamais la ligne.

## Les erreurs classiques

**Oublier `importlib.reload(hb)`.** On corrige `lib/hyperblox.py`, rien ne
change, on cherche pendant vingt minutes une erreur qui n'existe plus.

**Modifier la scène à la main puis relancer le générateur.** `hb.scene()` vide
tout : le travail à la souris est perdu. Le générateur est la source de vérité,
la souris sert à regarder.

**Subdiviser trop tôt.** `subdiv(niveaux=3)` sur six pièces, et le moindre
booléen dépasse les 180 s de timeout du socket. Silhouette d'abord, densité
ensuite.

**Une échelle -1 pour faire un miroir.** Ça retourne les normales. `hb.miroir()`
utilise le modificateur Mirror, qui ne pose pas ce problème ; l'export gère le
cas résiduel en retournant les faces quand le déterminant de la matrice est
négatif, mais mieux vaut ne pas y arriver.

**Des noms de pièces avec des espaces ou des accents.** Le 3D Importer les
réécrit, et `assemble.lua` retrouve les MeshParts par leur nom. `hb.piece()`
refuse ces noms tout de suite — c'est voulu.

**Croire que le nombre de polygones est le sujet.** Ce qui coûte, côté Roblox,
c'est le nombre de MeshParts et de meshes distincts à streamer, bien avant les
triangles. Une pièce de 8 000 triangles vaut mieux que quatre pièces de 2 000
qui auraient pu être une seule.
