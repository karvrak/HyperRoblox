# HyperBlox — mode détaillé : donner du volume

**C'est le mode par défaut du skill.** L'objectif n'est pas un « style Roblox
en cubes » : c'est de **reproduire l'image source**, ses courbes, ses galbes,
ses proportions — avec autant de parts qu'il en faut. Le low-poly
(`style-lowpoly.md`, 5-35 parts) reste disponible, mais uniquement quand
l'utilisateur demande explicitement un rendu stylisé/minimaliste ou un mob
instancié en masse.

Ce n'est pas « le même travail en plus long » que le low-poly. Ce sont deux
méthodes différentes, et confondre les deux donne le pire des cas : un modèle
lourd qui lit quand même comme un tas de rectangles.

## Lire l'image en formes — le Block en dernier

Le réflexe qui fait les modèles « en studs », c'est de lire l'image en boîtes.
La bonne lecture est en **familles de formes**, et le Block nu est le **dernier
recours** — réservé à ce qui est réellement plan dans l'image (une planche, un
mur, une caisse). Tout le reste a une primitive :

| Ce qu'on voit dans l'image | Comment le construire | Primitive |
|---|---|---|
| contour courbe (dos, branche, manche) | tronçons le long d'une courbe | `arc`/`courbe` + `chaine` |
| membre, tronc, tentacule, doigt | tubes + billes aux coudes | `boyau` |
| volume de révolution (vase, cloche, dôme, poire, jarre, pion, colonne tournée, chapeau) | tranches de cylindre empilées suivant un profil de rayon | `tour` |
| crâne, ventre, fruit non sphérique | `tour` (la Ball Roblox est TOUJOURS ronde — pas d'ellipsoïde) | `tour`, grappe de `Ball` |
| anneau, cerclage, pneu, auréole, anse, hublot | couronne de tubes + billes | `anneau` |
| coque courbe (carapace, coque de bateau, toit bombé, capot, dossier) | lattes loftées entre deux rails, bombé `bombe` | `nappe` |
| arête vive que l'image montre adoucie | chanfrein | `biseau` |
| angle rentrant adouci (congé) | un tube posé dans l'angle | `tube` |
| cône, corne, croc, griffe, épine | fuselé le long d'une courbe | `pointe` |
| plaques, écailles, tuiles, lamelles | chevauchement le long d'un chemin | `ecailles` |
| toile tendue, voile, nageoire | lattes en éventail | `membrane` |
| plumes | éventail à deux rangs | `plumes` |
| muscle nervuré, colonne cannelée | section étoilée | `croise`, `chaine{cannele}` |

Trois règles de fidélité :

1. **Toute ligne courbe de l'image doit être courbe dans le modèle.** Une
   courbe se segmente : au minimum **6 segments par quart de tour** pour ce qui
   se voit de près, 12 à 24 tranches pour un `tour`, 14 à 20 pour un `anneau`.
   En dessous, l'œil lit un polygone, et on retombe dans le « studs ».
2. **Rond dans l'image = rond dans le modèle.** Cylinder et Ball d'abord ; un
   poteau, un canon, une corne ne sont jamais des Blocks.
3. **Les proportions se mesurent, elles ne se devinent pas.** Prendre 4 ou 5
   rapports sur l'image source (hauteur totale / largeur, taille de la tête /
   corps, position de la taille…) et les poser en constantes en tête du
   générateur. C'est contre ces rapports que se juge chaque capture.

### L'inventaire de formes (avant d'écrire le générateur)

Avant la première ligne de code, écrire l'inventaire : chaque masse de l'image,
sa famille de forme, sa primitive, son budget approximatif. Cinq lignes
suffisent :

```
crâne        → volume de révolution écrasé   → tour (n=12)          ~12 parts
bec          → cône courbe                   → pointe               ~6
corps        → masse chanfreinée             → biseau + ecailles    ~30
ailes ×2     → doigts + toile                → pointe + membrane    ~90
serres       → tubes + griffes               → boyau + pointe       ~24
```

C'est l'inventaire qui décide du budget — pas l'inverse. Et c'est lui qu'on
montre à l'utilisateur si le cadrage est ambigu.

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
| `tube(nom, groupe, a, b, diam)` | un cylindre tendu entre deux points — le pendant rond de `barre` | 1 part |
| `boyau(nom, groupe, points, {section})` | membre **rond** le long d'une courbe : tubes + billes aux coudes | 2/tronçon |
| `chaine(nom, groupe, points, {section})` | tronçons fuselés le long d'un chemin — cou, queue, membre | 1/tronçon |
| `tour(nom, groupe, base, hauteur, profil)` | **surface de révolution** : vase, cloche, dôme, jarre, pion, colonne tournée | 1/tranche |
| `anneau(nom, groupe, centre, rayon, {tube})` | **tore** : bague, cerclage, pneu, anse (`arcDeg` < 360 pour un arc ouvert) | 2/segment |
| `nappe(nom, groupe, railA, railB, {bombe})` | **surface courbe** loftée entre deux rails : carapace, coque, toit bombé | bandes × colonnes |
| `croise(nom, groupe, centre, taille)` | masse à section **étoilée** (2 blocs à 45°) | 2 parts |
| `biseau(nom, groupe, centre, taille, {arete})` | masse à section **octogonale** (noyau en croix + 4 coins) | 6 parts |
| `membrane(nom, groupe, epaule, doigts)` | la toile d'une aile de chauve-souris | bandes × panneaux |
| `plumes(nom, groupe, base, vers, {n})` | un éventail de rémiges incurvées | 2 × n |
| `ecailles(nom, groupe, points, {normale})` | plaques chevauchantes — dos, ventre, armure | 1/plaque |
| `pointe(nom, groupe, points)` | corne, croc, griffe, épine (fuselée, courbe) | 1/tronçon |
| `miroirX(parts)` | duplique un lot de parts de l'autre côté | ×1 |
| `arc(a, b, {creux})` / `courbe(a, p1, p2, b)` | les chemins qui nourrissent tout le reste | 0 |

Notes d'usage des trois primitives de rond :

- **`tour`** : le profil est un tableau de rayons (`[0.9, 1.6, 1.3, 0.5]` = un
  vase) ou une fonction `(t) => rayon` (dôme : `(t) => R * Math.cos(t * Math.PI / 2)`).
  Les tranches se recouvrent et alternent leur diamètre d'un cheveu : pas de
  z-fighting même à profil plat. Monter `n` à 16-24 pour une pièce vue de près.
- **`anneau`** : les billes aux joints font la continuité du boudin — les
  retirer (`noeuds: false`) uniquement si l'anneau est pris dans une masse.
- **`nappe`** : les deux rails sortent du même `arc`/`courbe` avec le même `n`.
  `bombe` gonfle le milieu **selon `vers`** (défaut : vers le haut) — pour une
  coque de bateau, passer `vers: [0, -1, 0]`. Les lattes se recouvrent
  généreusement (`recouvre`, défaut 1.25) : sur une surface courbe, ce sont des
  cordes, et sans recouvrement elles ouvrent des fentes en V.

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

## Casser le « cubique » — le lissage sans mesh

Un modèle peut être riche en primitives et lire quand même « en cubes » de
près. Les quatre causes, relevées sur un dragon de 980 parts, par ordre de
rendement :

1. **Une tête n'est jamais un block.** Crâne + museau = un `tour` **couché**
   le long de l'axe du museau (`axe` incliné), profil de rayons qui s'affine
   vers le nez, une bille au bout (la dernière tranche coupe net sinon).
   C'est le morceau que le joueur regarde en premier, et le dernier qu'on
   pense à arrondir. Puis **habiller le lathe**, qui reste un tube sans ça :
   bourrelet de sourcil au-dessus de chaque œil (`pointe` couchée sur le
   crâne), rangée de bosses sur l'arête du museau (étroites et enfoncées,
   sinon elles débordent en casquette), plaques de joue, couronne de cornes
   secondaires, pointes de mâchoire. Les dents : fines et nombreuses (base
   ≈ 0.1 pour une tête de 4 studs), deux crocs plus longs — des dents larges
   lisent comme des touches de piano.
2. **Un détail de peau est TANGENT à la surface, et ENFONCÉ À MOITIÉ.**
   Écaille, plaque, bosse : orientation par la normale locale
   (`orientFromYX(normale, spin)`), spin aléatoire autour d'elle seulement,
   inclinaison légère (±3°). Une rotation aléatoire sur trois axes plante la
   moitié des pièces par la tranche — l'effet « copeaux » qui ruine un flanc.
   Et le centre se pose SUR la surface (moitié noyée, moitié saillante, donc
   épaisseur ≈ 0.25) : posée au-dessus, une plaque tangente montre l'ombre
   sous ses bords sur toute courbure — l'effet « autocollant qui se
   décolle ». Le point de pose s'échantillonne sur le **squelette** (courbe +
   rayon du tronçon, au milieu du tronçon), jamais sur des sphères estimées.
3. **La couture d'un membre = un segment trop long pour sa courbure.** Si un
   `boyau`/`chaine` montre ses articulations, doubler les points de la courbe
   — pas élargir les billes. (Les billes de `boyau` sont déjà 7 % plus
   grosses que le tube : à diamètre égal, le bord du tube affleure l'équateur
   de la bille et dessine un pli.)
4. **Juger le rond dans Studio, pas sur la préview.** Le viewer facette les
   cylindres et les billes ; Roblox les ombre lisse. Un `tour` qui montre ses
   anneaux en capture est déjà lisse en jeu.

Le plafond de cette approche est réel : des parts restent des parts. Si un
projet exige des surfaces organiques parfaitement continues, c'est du
MeshPart (Blender, EditableMesh) — hors périmètre HyperBlox, qui garde en
échange la préview fidèle, la recoloration par part et l'animation Lua.

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

Roblox n'impose **aucun plafond de parts par modèle**. Les deux vraies limites
sont ailleurs, et toutes deux sont gérées : le plafond de 200 000 caractères
d'une source de script (build compact automatique, puis transport en
`StringValue` via `serve.mjs` + `install-json.lua` — voir SKILL.md § 5), et le
coût de rendu, qui dépend du **nombre d'instances à l'écran**, pas du modèle.
Le budget se décide donc par le nombre d'exemplaires simultanés, jamais par une
règle absolue :

| Type | Budget | Note |
|---|---|---|
| Prop courant (caisse, lanterne, tonneau) | 40-120 | le rond est rond, les arêtes chanfreinées |
| Prop héroïque (coffre, autel, fontaine) | 120-400 | vu de près, manipulé |
| Créature de meute | 60-150 | apparaît par 5-10 : rester sobre |
| Créature héroïque | 200-500 | une ou deux à l'écran |
| Boss | 400-1000 | unique, vu en gros plan |
| Pièce maîtresse (statue géante, véhicule héro, bâtiment signature) | 800-3000 | unique dans la place |

Deux réflexes qui rendent les gros budgets gratuits en jeu :

- **`collide: false` sur tout le détail.** Seules les masses principales ont
  besoin de collision ; une écaille, une latte de nappe, une tranche de tour
  qui collident font payer de la physique pour rien. En pratique : toute part
  de moins de ~0.5 stud d'épaisseur ou purement décorative → `collide: false`.
- **Le low-poly reste le bon outil pour la meute.** 90 exemplaires d'un mob à
  600 parts, c'est 54 000 parts à l'écran : là, `style-lowpoly.md` redevient
  la bonne réponse — sur ce cas précis, pas par défaut.

## Contrôle

Le détail se juge de près, mais il doit **tenir de loin**. Trois captures, pas
une :

| Vue | Paramètres | Ce qu'on y cherche |
|---|---|---|
| silhouette | `?theta=0&phi=90&dist=<2×hauteur>` | la lecture au premier regard, en plissant les yeux |
| joueur | `?theta=18&phi=87&dist=<1.2×largeur>&ty=5` | ce que le joueur verra vraiment |
| dessous / dos | `?theta=180&phi=40` puis `?phi=15` | les creux ouverts, ce qu'on a oublié de fermer |

Puis la passe de `finition.md`, qui attrape ce qu'aucune capture ne montre.
