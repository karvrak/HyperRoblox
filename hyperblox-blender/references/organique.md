# Créatures organiques — la méthode

À lire AVANT de modéliser un monstre, une créature, un animal, un boss. Ce
fichier existe parce que le réflexe naturel — une sphère pour la tête, un
cylindre pour le cou, une capsule par patte — produit toujours la même chose :
un bonhomme de neige. L'œil ne voit pas des « formes rondes », il voit **des
jointures**, et chaque jointure crie « assemblage ».

Une créature crédible tient en deux faits :

1. c'est **UNE surface continue** — le cou coule dans le poitrail, la cuisse
   coule dans le ventre, aucune intersection visible ;
2. dans le style Roblox/anime, la finition est **facettée volontairement** —
   l'ombrage plat sur 2 000–5 000 triangles est un choix graphique, pas un
   manque de moyens. Une créature *lisse* de 40 000 triangles a l'air moins
   pro qu'une créature *facettée* de 3 000.

La lib donne un outil pour chacun : `fusionner(voxel=…)` pour le premier,
`facetter()` pour le second. Tout le reste de la méthode s'organise autour.

## La chaîne, dans l'ordre

```
lire la référence de PROFIL          (des coordonnées, pas des impressions)
   → masses      loft() pour le torse et le crâne, squelette() pour le reste
   → fusion      fusionner("Corps", [...], voxel=0.1..0.15)   ← les jointures fondent
   → volumes     sculpter() : bomber, creuser, tirer
   → détails     corne() / loft plat / pièces Neon — HORS fusion
   → style       facetter(cible=2500..5000)                   ← en dernier
```

### 1. Lire la référence de profil

Poser la créature de profil, papier millimétré mental : hauteur au garrot,
longueur du corps, position des articulations. Écrire ces nombres en tête du
générateur — ce sont eux qu'on retouchera, pas les formes.

Proportions quadrupède qui « font vrai » (à exagérer ensuite, voir § style) :

| Mesure | Rapport |
|---|---|
| longueur du corps (poitrail→croupe) | ≈ hauteur au garrot |
| pattes | ≈ la moitié de la hauteur totale — le ventre est HAUT |
| tête | ≈ 1/3 de la hauteur au garrot, portée par un cou qui s'affine |
| taille | plus étroite que le poitrail ET que les hanches |

### 2. Les masses — quel outil pour quoi

| Ce qu'on voit | Outil | Pourquoi |
|---|---|---|
| torse, bassin, crâne | `loft()` | le galbe se contrôle section par section (poitrail large, taille creuse) |
| cou, pattes, doigts, queue, tentacule | `squelette()` | des points + des rayons, les jonctions fondent toutes seules |
| bois, cornes, griffes, crocs, mèches, plumes | `corne()` | fuseau effilé le long d'un chemin |
| oreille, aile membrane, nageoire, langue | `loft()` avec `rz` écrasé (`rx >> rz`) | forme plate galbée |
| sabot, œil | `cylindre()` / `sphere()` | les seuls endroits où la primitive suffit |

Deux règles de squelette :

- une patte S'ATTACHE : sa chaîne **démarre sur un point de la colonne** (mêmes
  coordonnées) ou assez profond dans le futur corps pour que la fusion la soude ;
- deux pattes qui se touchent fusionnent en une nappe — espacer les chaînes ou
  réduire les rayons, le voxel fait le reste.

### 3. La fusion — le geste qui change tout

```python
corps = hb.fusionner("Corps", [torse, cou, tete, p_av_g, p_av_d, p_ar_g, p_ar_d],
                     voxel=0.11)
```

Le remesh voxel refond toutes les surfaces en une seule peau ; le lissage
détend le résultat. **Choix du voxel**, pour une créature de ~5 studs :

| voxel | résultat |
|---|---|
| 0.20 | grossier — les pattes fines s'amincissent ou cassent |
| **0.10–0.15** | **le bon défaut** : jonctions fondues, détails tenus |
| 0.05 | très fin — des centaines de milliers de triangles, booléens et export au ralenti, risque de dépasser les 180 s du socket MCP |

⚠ **Tout ce qui est plus fin que le voxel disparaît.** Une oreille de 0.04
d'épaisseur dans une fusion à 0.11 fond ou se troue. Les oreilles, mèches,
bois, marques restent **hors fusion organique** : ce sont des pièces à part
(bonus — elles portent souvent une autre couleur, donc c'étaient des pièces de
toute façon).

⚠ Ne jamais déclarer les ingrédients avec `hb.piece()` avant de fusionner :
`fusionner()` les retire de la scène.

### 4. Les volumes — sculpter, pas empiler

Après fusion la forme est juste mais molle. Trois ou quatre coups suffisent :

```python
hb.sculpter(corps, centre=(0, 0.9, 3.0),  rayon=1.0,  gonfle= 0.15)   # poitrail
hb.sculpter(corps, centre=(0, -0.3, 3.1), rayon=0.8,  gonfle=-0.08)   # taille creuse
hb.sculpter(corps, centre=(0, 2.7, 5.0),  rayon=0.5,  vecteur=(0, 0.15, 0))  # museau tiré
```

Le falloff est lisse et le remesh rejoue derrière : on peut y aller franchement.
C'est ici que se joue la différence entre « un tube avec une boule » et « un
animal qui a des muscles ».

### 5. Les détails — des pièces, pas des textures

Le pipeline n'a pas de texture : chaque teinte est une MeshPart. Dans le style
anime c'est une force, pas une limite — les marques du corps des créatures de
ces jeux SONT des surfaces de couleur unie :

- **crinière / queue touffue** : 5 à 9 `corne()` épaisses qui se chevauchent et
  ondulent (pas cent poils) → `fusionner(sans voxel)` → une pièce,
  `collision=False` ;
- **bois / cornes ramifiés** : corne maîtresse + branches qui démarrent sur ses
  points → fusion simple → `miroir(obj, "X")` pour l'autre côté → une pièce,
  souvent `materiau="Neon"` ;
- **yeux** : sphères écrasées, `Neon`, `rendu="Precise"` ;
- **marques lumineuses** : petites boîtes/losanges plaqués, `Neon`.

### 6. Le style — facetter, et assumer

```python
hb.facetter(corps, cible=4000)
```

Décime vers la cible et passe l'ombrage à plat. C'est la signature visuelle du
rendu « anime Roblox » : chaque facette accroche sa propre lumière. Cibles :

| Pièce | cible |
|---|---|
| corps d'un boss unique | 3 000–5 000 |
| corps d'un mob instancié | 1 200–2 500 |
| crinière, bois (fusion simple) | 800–2 000 |

Et l'exagération qui va avec le style : pattes **plus longues et plus fines**
que nature, poitrail plus large, tête plus petite, yeux plus grands. Modéliser
un cerf réaliste puis le facetter donne un cerf raté ; modéliser un cerf
*dessiné* donne l'image de référence.

## Habillage type d'une créature

```python
hb.piece(corps,    couleur=(243, 244, 250), materiau="SmoothPlastic", fidelite="Hull")
hb.piece(criniere, couleur=(243, 244, 250), materiau="SmoothPlastic", collision=False)
hb.piece(bois,     couleur=(120, 235, 255), materiau="Neon", collision=False, rendu="Precise")
hb.piece(sabots,   couleur=(38, 38, 44),    materiau="SmoothPlastic")
```

`fidelite="Hull"` pour le corps (la boîte serait trop grossière autour des
pattes), `collision=False` pour tout ce qui dépasse. Palette : deux teintes de
corps + UN accent Neon, pas plus.

## Articuler — le rig de ce pipeline

Pas d'armature ici : le rig, c'est le DÉCOUPAGE. Une créature qui doit marcher,
remuer la queue ou tourner la tête ne se fusionne pas en un bloc — chaque
segment mobile est sa propre fusion, dans son propre **groupe**, et le player
anime les groupes autour de pivots d'articulation :

```
Corps            torse seul (+ marques)
Tete             cou + crâne fusionnés, avec crinière, bois, yeux, oreilles
PatteAvG/…       jambe (squelette) + son sabot — le sabot SUIT sa jambe
Queue            le panache, articulé à la croupe
```

Trois règles :

1. **la rotule plonge dans le parent** — la boule de cuisse (rayon 0.35-0.45)
   s'enfouit dans le ventre, la base du cou dans les épaules : la jointure
   reste couverte à tous les angles d'animation. C'est le look segmenté des
   créatures Roblox pro — regarder leurs pattes : les segments SE VOIENT ;
2. **le pivot d'anim = le centre de la rotule enfouie** ;
3. **un transform du corps entier = la même track sur chaque segment**, même
   pivot partagé (écrire un petit helper `tous()` dans le générateur). Les
   tracks se composent : `Cabrer` = corps entier qui pivote sur les sabots
   arrière × pattes avant qui se replient.

La marche type : diagonales opposées (AvG+ArD contre AvD+ArG) en rotation X
±16° autour des hanches, corps qui rebondit à double fréquence, queue en
balancier Y, tête qui acquiesce. Sur place — le déplacement appartient au jeu.

## Les pièges

- **Sculpter après facetter** — l'ordre est forme → volumes → style. Ça ne casse
  rien (les modificateurs rejouent) mais on juge un maillage qui n'est plus
  celui qu'on livre.
- **Baisser le voxel pour « plus de détail »** — le détail organique vient de
  `sculpter()` et des pièces rapportées, pas de la résolution. Voxel plus fin =
  minutes d'attente et 200 000 triangles à décimer ensuite.
- **Juger en trois-quarts** — face et profil, à plat, comme toujours
  (`hb.vue("profil")`). Une créature se lit d'abord à sa ligne de dos.
- **Oublier `hb.rapport()` avant l'export** — le remesh voxel est l'outil de la
  lib qui produit le plus de triangles ; c'est ici qu'on veut l'apprendre.

## Exemple complet

`examples/cerf-esprit/gen-cerf-esprit.py` — un cerf-esprit façon jeu de combat
anime : torse lofté, membres au squelette, fusion voxel, poitrail sculpté, bois
Neon ramifiés en miroir, crinière en mèches, finition facettée. C'est le
gabarit à copier pour tout quadrupède.
