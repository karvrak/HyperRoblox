# HyperBlox — mode détaillé : donner du volume

`style-lowpoly.md` décrit le mode par défaut : simplifier jusqu'à l'essentiel,
5 à 35 parts, le charme vient du dépouillement. Ce document décrit **l'autre
mode** — celui des créatures, des boss, de tout ce qui doit soutenir le regard
de près : 150 à 600 parts, du galbe, des ailes, de la matière.

Ce n'est pas « le même travail en plus long ». Ce sont deux méthodes
différentes, et confondre les deux donne le pire des cas : un modèle lourd qui
lit quand même comme un tas de rectangles.

## La bascule : on n'écrit plus le JSON à la main

Au-delà de ~80 parts, écrire `model.json` directement devient un piège. Non
parce que c'est long, mais parce que **plus rien n'est modifiable** : changer
l'angle d'une aile veut dire recalculer trente positions à la main, donc on ne
le fait pas, donc le modèle se fige sur sa première version — la plus mauvaise.

En mode détaillé, la source de vérité devient un **générateur** :

```
hyperblox/<famille>/<slug>/
  gen-<slug>.mjs   ← ce qu'on écrit et ce qu'on modifie
  model.json       ← GÉNÉRÉ (ajouter "generator": "gen-<slug>.mjs")
  preview.html     ← généré
  build.lua        ← généré
```

Le générateur décrit la créature par ses **points remarquables** (garrot,
hanche, épaule, bout d'aile) et laisse les primitives poser les parts. Une
proportion se change alors en un nombre, et les 200 pièces suivent.

⚠ Dès qu'un `model.json` est généré, il ne se corrige plus à la main : voir
`finition.md` § `--fix` et les modèles générés.

## Les primitives de volume

Elles vivent dans `lib/volume.mjs`, à côté de ce document. Depuis un générateur
rangé en `hyperblox/<famille>/<slug>/` :

```js
import { fabriqueVolume } from "../../../.claude/skills/hyperblox/lib/volume.mjs";
const V = fabriqueVolume(add, { color: [120, 90, 70] });
```

Ce chemin est long et se répète dans chaque générateur. Poser une fois un module
de réexport d'une ligne à la racine de vos modèles —
`export * from "../../.claude/skills/hyperblox/lib/volume.mjs";` dans
`hyperblox/_lib/volume.mjs` — donne un import court (`../../_lib/volume.mjs`) et
un seul endroit à corriger si le skill bouge.

| Primitive | Ce qu'elle pose | Coût |
|---|---|---|
| `barre(nom, groupe, a, b, section)` | un bloc **tendu entre deux points** | 1 part |
| `chaine(nom, groupe, points, {section})` | tronçons fuselés le long d'un chemin — cou, queue, membre | 1/tronçon |
| `croise(nom, groupe, centre, taille)` | masse à section **étoilée** (2 blocs à 45°) | 2 parts |
| `biseau(nom, groupe, centre, taille, {arete})` | masse à section **octogonale** (noyau en croix + 4 coins) | 6 parts |
| `membrane(nom, groupe, epaule, doigts)` | la toile d'une aile de chauve-souris | bandes × panneaux |
| `plumes(nom, groupe, base, vers, {n})` | un éventail de rémiges incurvées | 2 × n |
| `ecailles(nom, groupe, points, {normale})` | plaques chevauchantes — dos, ventre, armure | 1/plaque |
| `pointe(nom, groupe, points)` | corne, croc, griffe, épine (fuselée, courbe) | 1/tronçon |
| `miroirX(parts)` | duplique un lot de parts de l'autre côté | ×1 |
| `arc(a, b, {creux})` / `courbe(a, p1, p2, b)` | les chemins qui nourrissent tout le reste | 0 |

### Ce qui casse la lecture « boîte »

Le vrai passage du rectangle au volume tient en trois gestes, par ordre de
rendement :

1. **Chanfreiner les masses principales** (`biseau`). Une arête vive à 90° est
   ce qui fait dire « c'est du Roblox ». Une arête rabattue accroche la lumière
   sur une troisième valeur, entre la face éclairée et la face à l'ombre. Six
   parts par masse, et ce sont les six parts les mieux dépensées du modèle.
2. **Fuseler tout ce qui est long** (`chaine` avec `section: [gros, fin]`). Un
   cou d'épaisseur constante est un tuyau ; un cou qui s'affine est un cou.
3. **Courber tout ce qui est long** (`arc`, `courbe`). Une queue droite est une
   planche. Le `creux` d'un arc coûte zéro part.

`croise` (2 parts) est le compromis quand `biseau` est trop cher : la section
étoilée fait saillir quatre arêtes au lieu d'en rabattre, la lecture est
« colonne cannelée / muscle nervuré » plutôt que « pierre taillée ». Utile en
série — chaque tronçon d'un cou, chaque segment d'une queue (`cannele: true`
sur `chaine`).

### Les ailes

Deux familles, qui ne se construisent pas pareil :

- **Aile membraneuse** (dragon, démon, chauve-souris) : des **doigts**
  (`pointe`, fuselés, qui rayonnent depuis l'épaule) et la **toile** tendue
  entre eux (`membrane`). La toile n'est pas une plaque : c'est une suite de
  lattes qui suivent chaque rayon, ce qui donne le bord de fuite festonné.
  `creux` fait retomber la toile entre les doigts — c'est ce qui la fait lire
  comme de la peau plutôt que comme du carton.
- **Aile emplumée** (oiseau, ange, harpie) : `plumes`, deux ou trois rangs
  superposés (rémiges longues dessous, couvertures courtes dessus, décalées).
  Un seul rang lit toujours comme un peigne. `courbure` fait retomber le bout
  de chaque plume : sans elle, l'éventail reste plat et raide.

Dans les deux cas : **modéliser un seul côté, puis `miroirX`**. Les deux moitiés
ne peuvent alors plus diverger, et la moitié du travail disparaît.

## Trois pièges qui ne pardonnent pas

**Le miroir d'Euler.** Refléter trois angles en changeant des signes n'est exact
que pour des poses simples. Dès qu'une pièce tourne sur ses trois axes — le cas
de toute aile — il faut passer par la matrice de rotation. `miroirX` le fait ;
le faire à la main, non. L'erreur ne se voit que de dos.

**Les surfaces coplanaires par construction — le piège numéro un.** C'est le
défaut le plus coûteux du mode détaillé, parce qu'il naît de la chose même qui
fait le détail : une BOUCLE.

Dès qu'une série de parts est produite par une boucle, elles partagent une cote.
Quinze claveaux d'arc tournés autour de Z ont tous leurs faces avant dans le même
plan ; trois pierres d'une assise ont le même dessus ; toutes les lattes d'une
membrane sont dans le plan de la toile ; les six pièces d'un `biseau` ont la même
hauteur. Si en plus elles se chevauchent — et un arc se ferme justement parce que
ses claveaux se chevauchent — le rendu grésille sur toute la série.

La règle : **étager la série**. Un décalage de 0.03 à 0.09 par index suffit,
invisible à distance de jeu. Les primitives de `volume.mjs` le font déjà pour
elles-mêmes ; en écrivant une boucle à soi, y penser au premier jet.

Deux pièges dans l'étagement lui-même, tous deux payés comptant :

1. **Translater, ne pas redimensionner.** Réduire une part de `d` en décalant son
   centre de `d/2` étage une face — et laisse l'AUTRE exactement où elle était.
   Le défaut passe de l'avant vers l'arrière, on croit avoir corrigé, et l'arc
   grésille toujours de l'autre côté.
2. **Vérifier QUELLE face on étage.** Celle qu'on voit, pas celle qu'on calcule.

Et ce défaut est **indétectable sur une capture figée** : le z-fighting ne se
manifeste qu'en mouvement. Seul `finition.mjs` le voit. Quand il annonce des
dizaines de constats du même motif, ce n'est pas du bruit — c'est une règle de
générateur qui se répète, et il le dit maintenant explicitement (`⚑`).

**Le plafond des 200 000 caractères.** Une source de script Roblox est plafonnée.
`build.mjs` passe automatiquement en écriture compacte au-delà de 120 parts
(table de données + boucle, ~5× plus court) et avertit si le fichier ne passe
toujours pas — auquel cas il faut transporter le `model.json` en **données** et
non en code : un `StringValue` n'a pas de plafond. Un modèle à animations
lourdes y arrive même en compact, car c'est le module `HyperBloxAnim` embarqué
qui pèse, pas les parts.

## Budget

| Type | Budget | Note |
|---|---|---|
| Prop simple | 5-20 | mode low-poly, cf. `style-lowpoly.md` |
| Prop riche | 15-35 | idem |
| Créature de meute | 60-150 | plusieurs à l'écran en même temps |
| Créature héroïque | 150-350 | vue de près, une ou deux à l'écran |
| Boss | 300-600 | unique à l'écran, vu de près et en gros plan |

Le nombre de parts n'est pas un défaut. Ce qui coûte, c'est le **nombre
d'instances à l'écran** : 600 parts pour un boss unique passent, 600 parts pour
un mob qui apparaît par huit ne passent pas. Décider du budget d'après le
nombre d'exemplaires simultanés, jamais d'après une règle absolue.

## Contrôle

Le détail se juge de près, mais il doit **tenir de loin**. Trois captures, pas
une :

| Vue | Paramètres | Ce qu'on y cherche |
|---|---|---|
| silhouette | `?theta=0&phi=90&dist=<2×hauteur>` | la lecture au premier regard, en plissant les yeux |
| joueur | `?theta=18&phi=87&dist=<1.2×largeur>&ty=5` | ce que le joueur verra vraiment |
| dessous / dos | `?theta=180&phi=40` puis `?phi=15` | les creux ouverts, ce qu'on a oublié de fermer |

Puis la passe de `finition.md`, qui attrape ce qu'aucune capture ne montre.
