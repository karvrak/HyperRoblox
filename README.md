# HyperRoblox

**Image → maquette 3D en HTML → modèle Roblox low-poly. Avec animations.**

HyperRoblox fournit **HyperBlox**, un skill pour [Claude Code](https://claude.com/claude-code)
qui transforme une image (concept art, photo, image IA) en modèle 3D Roblox, en
passant par une maquette HTML interactive que vous validez avant de construire
quoi que ce soit dans Roblox Studio.

Deux modes selon ce que vous faites :

- **Détaillé** (défaut) — l'objectif est de **reproduire l'image source**,
  courbes et galbes compris. 40 à 3000 parts selon le sujet (Roblox n'impose
  aucun plafond de parts), avec une bibliothèque de primitives de volume
  (surfaces de révolution, tores, nappes courbes, chanfreins, fuseaux,
  membranes, plumes, écailles) et un miroir exact pour ne modéliser qu'un côté.
- **Low-poly studio** (sur demande) — rendu stylisé assumé ou mob instancié en
  masse. 5 à 35 parts, le charme vient du dépouillement.

Et un second skill, **HyperBlox Finition**, qui rattrape ce qui reste « presque
fini » : les faces confondues qui clignotent en jeu, les bouts de barre qui
ressortent dans le vide, les escaliers sans contremarche.

Et un troisième, **HyperBlox Blender**, pour les formes qu'aucun empilement de
cubes ne rattrape — casque, coque, aile, racine : Blender modèle, Roblox reçoit
des MeshParts habillées et animées. Voir [§ HyperBlox Blender](#hyperblox-blender--quand-le-cube-ne-suffit-plus).

Même philosophie que les pipelines HTML-vers-vidéo ou HTML-vers-PowerPoint : un
fichier de données unique est la **source de vérité**, la page HTML est la
**maquette à valider**, et la sortie finale est générée depuis les mêmes données.
Ce que la préview montre est ce que Studio construit.

| Coffre au trésor (exemple) | Coffre-fort animé (exemple) |
|---|---|
| ![Coffre au trésor](hyperblox/examples/treasure-chest/preview.png) | ![Coffre-fort](hyperblox/examples/coffre-fort/preview.png) |

## Le pipeline

```
image  →  model.json  →  preview.html  →  (validation)  →  build.lua  →  Roblox Studio
          source de       maquette 3D                       script idempotent +
          vérité          interactive                       player d'animations Lua
```

- **`model.json`** — le modèle décrit comme une liste de Parts Roblox (Block,
  Wedge, CornerWedge, Cylinder, Ball — tailles, positions, rotations, couleurs,
  matériaux, groupes) plus des animations par keyframes.
- **`preview.html`** — viewer 3D autonome (Three.js inliné, zéro réseau, zéro
  dépendance) : orbite, zoom, grille façon baseplate, clic sur une part pour
  l'inspecter, et lecture des animations avec scrubber.
- **`build.lua`** — à coller dans la barre de commande de Roblox Studio (ou à
  exécuter via le MCP Roblox Studio). Construit le modèle avec de vraies Parts,
  réexécutable sans risque. Si le modèle a des animations, un ModuleScript
  `HyperBloxAnim` est embarqué : mêmes keyframes, mêmes easings que la préview.

Les conventions géométriques (axes, ordre de rotation `CFrame.fromEulerAnglesXYZ`,
orientation des wedges, cylindres axés sur X…) sont implémentées à l'identique
des deux côtés.

## Installation (skill Claude Code)

Copier le dossier `hyperblox/` dans les skills de votre projet ou de votre machine :

```powershell
# par projet
Copy-Item -Recurse hyperblox           <votre-projet>/.claude/skills/hyperblox
Copy-Item -Recurse hyperblox-finition  <votre-projet>/.claude/skills/hyperblox-finition
Copy-Item -Recurse hyperblox-blender   <votre-projet>/.claude/skills/hyperblox-blender

# ou global (toutes vos sessions Claude Code)
Copy-Item -Recurse hyperblox           ~/.claude/skills/hyperblox
Copy-Item -Recurse hyperblox-finition  ~/.claude/skills/hyperblox-finition
Copy-Item -Recurse hyperblox-blender   ~/.claude/skills/hyperblox-blender
```

`hyperblox-finition` est facultatif mais recommandé : c'est lui qui pilote la
passe de finition, invocable ensuite par `/hyperblox-finition`. Il s'appuie sur
les scripts de `hyperblox/`, à installer dans tous les cas.

`hyperblox-blender` est facultatif aussi, et demande Blender + le MCP Blender.
Il doit être installé **à côté** de `hyperblox` : il lui emprunte le player
d'animations, pour qu'il n'en existe qu'un.

Redémarrer la session Claude Code, puis demander par exemple :

> « Crée-moi un modèle Roblox de lampadaire à partir de cette image »

Le skill s'occupe du reste : analyse de l'image, décomposition low-poly,
génération de la maquette, auto-vérification par screenshot, itérations avec
vous, puis livraison du `build.lua`.

### Prérequis

- **Node.js ≥ 18** — aucun `npm install`, le générateur n'a aucune dépendance
  (Three.js est vendoré dans `templates/vendor/`).
- **Roblox Studio** pour la construction finale.
- **Chrome** (optionnel) — utilisé par le skill pour ses screenshots headless
  d'auto-vérification.

## Utilisation manuelle (sans Claude)

Le générateur fonctionne aussi tout seul :

```bash
# 1. écrire mon-modele/model.json   (schéma : hyperblox/references/part-schema.md)
node hyperblox/scripts/build.mjs mon-modele
# 2. ouvrir mon-modele/preview.html dans un navigateur
# 3. contrôler la géométrie, et corriger ce qui est corrigeable
node hyperblox/scripts/finition.mjs mon-modele
node hyperblox/scripts/finition.mjs mon-modele --fix
# 4. coller mon-modele/build.lua dans la barre de commande de Roblox Studio
```

Pour essayer sans rien écrire : les exemples sont livrés déjà générés —
ouvrez `hyperblox/examples/coffre-fort/preview.html`, jouez l'animation
« Ouvrir », puis collez `build.lua` dans Studio et lancez :

```lua
require(workspace.CoffreFort.HyperBloxAnim).play("Ouvrir")
```

## `model.json` en bref

```json
{
  "name": "CoffreFort",
  "parts": [
    {
      "name": "Porte",
      "group": "Porte",
      "shape": "Block",
      "size": [2.6, 2.6, 0.4],
      "position": [0.15, 1.7, -1.35],
      "rotation": [0, 0, 0],
      "color": [80, 85, 94],
      "material": "SmoothPlastic"
    }
  ],
  "animations": [
    {
      "name": "Ouvrir",
      "duration": 1.4,
      "tracks": [
        {
          "target": "Porte",
          "pivot": [1.5, 1.7, -1.4],
          "keyframes": [
            { "t": 0, "rotation": [0, 0, 0], "easing": "easeOutBack" },
            { "t": 1.4, "rotation": [0, -100, 0] }
          ]
        }
      ]
    }
  ]
}
```

- Unité : le **stud** (un personnage Roblox ≈ 5 studs). Le modèle pose au sol
  (`y = 0`), pivot au centre.
- Une animation cible un **groupe** (sous-Model) ou une part, et tourne autour
  d'un **pivot** (charnière, axe). 9 easings identiques HTML ↔ Lua
  (`easeOutBack`, `easeOutBounce`, `easeOutElastic`…).
- Le player Lua : `play(name, {speed, loop, onComplete})`, `sample(name, t)`,
  `stop()`, `reset()`, `list()`.

Documentation complète :

- [`hyperblox/SKILL.md`](hyperblox/SKILL.md) — le workflow du skill
- [`hyperblox/references/part-schema.md`](hyperblox/references/part-schema.md) — schéma et conventions géométriques
- [`hyperblox/references/style-lowpoly.md`](hyperblox/references/style-lowpoly.md) — guide de style low-poly studio
- [`hyperblox/references/style-detaille.md`](hyperblox/references/style-detaille.md) — mode détaillé : primitives de volume, ailes, budgets
- [`hyperblox/references/animations.md`](hyperblox/references/animations.md) — animations, easings, recettes, API Lua
- [`hyperblox/references/finition.md`](hyperblox/references/finition.md) — le catalogue des défauts géométriques

## La passe de finition

`build.mjs` ne valide que le **schéma** : un modèle peut être parfaitement
valide et laid. `finition.mjs` regarde ce qui se passe **entre** les parts —
c'est là que vit tout ce qui fait qu'un modèle a l'air « presque fini ».

```bash
node hyperblox/scripts/finition.mjs mon-modele          # rapport
node hyperblox/scripts/finition.mjs mon-modele --fix    # + corrections sûres
```

| Contrôle | Ce qu'il attrape |
|---|---|
| `zfight` | deux faces confondues — **clignote en jeu sans jamais apparaître sur un rendu figé** |
| `noyee` | une part enfermée dans une autre : invisible, coût de rendu pur |
| `depassement` | un bout de barre qui ressort dans le vide après avoir traversé une masse |
| `escalier` | une volée de marches sans contremarche : on voit dessous |
| `orpheline` | une part qui **vole** — critère de connexité au corps posé au sol, pas « touche quelque chose » |
| `micro` | une dimension sous le minimum Roblox |
| `joint` · `grille` · `symetrie` | sur demande (`--tout`) : trop bruyants sur un modèle organique |

Ce qu'il **ne** fait pas, volontairement : décaler deux panneaux d'une même
coque. Quand deux parts sont à ras sur plusieurs axes — le fond et le mur d'un
caisson — les pousser les fait dériver en diagonale sans jamais converger. Le
script le dit et laisse le fichier intact : ce coin-là se restructure, il ne se
décale pas.

`--fix` refuse également d'écrire sur un `model.json` produit par un générateur :
la correction serait perdue à la régénération suivante.

Une part qui lévite **exprès** — un éclat en suspension, le fût d'un obélisque
flottant — se déclare avec `"flotte": true`. Le champ ne change rien à la
construction : il dit au contrôle que la lévitation est le sujet, et fait de la
part un ancrage qui porte ce qu'on lui accroche.

## Captures de contrôle

```bash
node hyperblox/scripts/shots.mjs mon-modele            # shot-3q.png à côté du model.json
node hyperblox/scripts/shots.mjs mon-modele --vue face
node hyperblox/scripts/shots.mjs mes-modeles           # tout un lot
```

Passer par ce script plutôt que par Chrome à la main : il encode les espaces du
chemin (sinon Chrome sort en code 13, sans message ni fichier), casse le **cache
disque** de Chrome (qui resert un `file://` déjà vu — la capture montre alors
l'ancien modèle en affichant fièrement son ancien nombre de parts) et vérifie
que le PNG a bien été réécrit.

⚠ Une **silhouette** se juge de face et de profil, à plat. Une vue de trois
quarts montre le détail, jamais la ligne d'ensemble.

## Modèles détaillés (le mode par défaut)

En mode détaillé, on n'écrit pas le `model.json` à la main : au-delà de ~80
parts, plus rien n'est **modifiable** — changer l'angle d'une aile demanderait
de recalculer trente positions. La source de vérité est un générateur
`gen-<slug>.mjs`, et [`hyperblox/lib/volume.mjs`](hyperblox/lib/volume.mjs)
fournit le vocabulaire — l'image se lit en **familles de formes** (le Block nu
est le dernier recours), chaque famille a sa primitive :

```js
import { fabriqueVolume, arc } from "./hyperblox/lib/volume.mjs";
const V = fabriqueVolume(add, { color: [120, 90, 70] });

V.tour("Vase", "Deco", [0, 0, 0], 4.5, [0.9, 1.6, 1.3, 0.5, 0.8]);   // révolution
V.anneau("Roue", "Roue", [6, 2, 0], 1.7, { tube: 0.6, normale: [0, 0, 1] });
const rA = arc([-2.5, 2.2, -2], [2.5, 2.2, -2], { creux: 1.4, n: 7 });
const rB = arc([-2.5, 2.2, 2], [2.5, 2.2, 2], { creux: 1.4, n: 7 });
V.nappe("Carapace", "Corps", rA, rB, { bandes: 5, bombe: 0.7 });     // coque courbe
const cou = V.arc([0, 4, -1], [0, 8, -4], { creux: 1.4 });
V.chaine("Cou", "Buste", cou, { section: [1.8, 0.7], cannele: true });
const aile = V.membrane("AileG", "AileG", epaule, doigts, { creux: 0.5 });
V.miroirX(aile);                       // l'autre aile, exacte
```

`tour` (surface de révolution : vase, dôme, cloche), `anneau` (tore), `nappe`
(surface courbe entre deux rails : carapace, coque, toit bombé), `biseau`
(masse à arêtes rabattues), `croise`, `chaine`, `boyau`, `tube`, `membrane`,
`plumes`, `ecailles`, `pointe`, `miroirX`, `arc`, `courbe`. Détail, méthode de
lecture d'image et pièges :
[`style-detaille.md`](hyperblox/references/style-detaille.md).

## HyperBlox Blender — quand le cube ne suffit plus

Un galbe continu, un congé d'arête, une coque organique : il existe un point où
aucun assemblage de Block et de Cylinder ne rattrape un maillage. Le skill
`hyperblox-blender` prend alors le relais, avec la même philosophie — un
**générateur** est la source de vérité, une **maquette** se valide avant de
construire, la sortie Studio est **générée** depuis les mêmes données.

```
gen-<slug>.py  →  Blender  →  <slug>.fbx  +  manifest.json  →  assemble.lua  →  Studio
source de         maquette    la géométrie   ce que Blender     habille et pose
vérité            à valider                  a MESURÉ           les MeshParts
```

Le point de conception qui fait tenir le pipeline : **le FBX ne transporte que
la géométrie**. La taille en studs, la position, la couleur, le matériau, la
collision, les groupes et les animations vivent dans le `manifest.json`, et
`assemble.lua` les impose *après* l'import. On ne cherche donc jamais le bon
réglage d'échelle du 3D Importer — on l'écrase.

Conséquence pratique, et c'est l'essentiel du gain : **retoucher l'habillage ne
demande aucun réimport**. Changer six couleurs, déplacer une pièce, ajouter une
animation = régénérer `assemble.lua` et le relancer. Seul un changement de
*forme* repasse par Studio.

```python
# gen-borne-arcade.py  — extrait
import hyperblox as hb
hb.scene("BorneArcade", DOSSIER)                       # 1 unité Blender = 1 stud

caisson = hb.boite("Caisson", (2.6, 1.7, 3.2), (0, 0, 2.0))
hb.booleen(caisson, hb.boite("_fente", (0.5, 0.4, 0.09), (0, 0.9, 1.15)))
hb.biseau(caisson, 0.05)                               # l'arête qui accroche la lumière
hb.piece(caisson, couleur=(178, 58, 50), materiau="SmoothPlastic")

hb.revolution("Dome", [(1.6, 0.0), (1.55, 0.6), (1.2, 1.2), (0.0, 1.7)])
hb.rapport()   # triangles et dimensions par pièce, plafond Roblox contrôlé
hb.export()    # → <slug>.fbx + manifest.json
```

Une **pièce** = une MeshPart. Le découpage se décide sur trois critères : une
couleur par pièce (pas de texture dans ce pipeline), tout ce qui bouge à part,
et 20 000 triangles de plafond dur côté Roblox.

Les animations sont **le même player** que le pipeline en Parts : mêmes
keyframes, mêmes easings, même `require(model.HyperBloxAnim).play("Ouvrir")`.
Le module est généré par `hyperblox/lib/anim-lua.mjs`, partagé par les deux.

Ce que ça coûte, à annoncer avant de s'y engager : Blender doit tourner avec
l'addon MCP connecté, l'import du FBX dans Studio est un geste **manuel**
(l'Importateur 3D n'est pas scriptable), et il n'y a ni texture ni PBR.

Documentation : [`hyperblox-blender/SKILL.md`](hyperblox-blender/SKILL.md),
[`setup-mcp.md`](hyperblox-blender/references/setup-mcp.md),
[`pipeline-mesh.md`](hyperblox-blender/references/pipeline-mesh.md),
[`blender-python.md`](hyperblox-blender/references/blender-python.md).

## Structure du dépôt

```
hyperroblox/
├── hyperblox/                  ← le skill (à copier dans .claude/skills/)
│   ├── SKILL.md                ← point d'entrée du skill
│   ├── references/             ← schéma, styles low-poly et détaillé,
│   │                             animations, catalogue de finition
│   ├── lib/
│   │   ├── volume.mjs          ← primitives de volume (mode détaillé)
│   │   └── anim-lua.mjs        ← le player HyperBloxAnim, partagé par les
│   │                             deux pipelines (Parts et MeshParts)
│   ├── scripts/
│   │   ├── build.mjs           ← model.json → preview.html + build.lua
│   │   ├── finition.mjs        ← contrôle géométrique + corrections
│   │   └── shots.mjs           ← captures de contrôle (headless Chrome)
│   ├── templates/
│   │   ├── viewer.html         ← template du viewer 3D
│   │   └── vendor/three.min.js ← Three.js r147 vendoré (préview hors-ligne)
│   └── examples/
│       ├── treasure-chest/     ← coffre au trésor (couvercle animé)
│       └── coffre-fort/        ← coffre-fort (cadran + porte animés)
├── hyperblox-finition/         ← second skill : la passe de finition guidée
│   └── SKILL.md
└── hyperblox-blender/          ← troisième skill : Blender → MeshParts
    ├── SKILL.md
    ├── references/             ← MCP Blender, pipeline mesh, recettes bpy
    ├── lib/hyperblox.py        ← le module chargé DANS Blender
    ├── scripts/assemble.mjs    ← manifest.json → assemble.lua
    └── examples/
        ├── borne-arcade/       ← générateur d'exemple, à lancer dans Blender
        └── fixture-assemblage/ ← manifest de test pour assemble.mjs (sans Blender)
```

Les `preview.html`, `build.lua` et `preview.png` des exemples sont des fichiers
générés, livrés pour la démo — ne les éditez pas à la main, modifiez le
`model.json` puis relancez `build.mjs`.

## Limites connues

- Formes de base uniquement (Block, Wedge, CornerWedge, Cylinder, Ball) — pas
  de MeshPart, pas de CSG/unions. C'est un choix : tout reste visible dans la
  préview HTML, re-colorable part par part et animable par le player. Le volume
  s'obtient en assemblant des formes de base (voir `style-detaille.md`), pas en
  changeant de primitive. Quand ce choix devient le mauvais, le skill
  `hyperblox-blender` prend le relais.
- Côté `hyperblox-blender` : pas de texture ni de PBR (une couleur unie par
  MeshPart), 20 000 triangles par mesh, et l'import du FBX dans Studio reste un
  geste manuel — l'Importateur 3D n'est pas scriptable.
- Props, objets et créatures, mais pas de level design de maps entières ; pas de
  rigs Motor6D/Animator (les animations bougent des Parts anchored par CFrame,
  ce qui convient aux portes, couvercles, ailes, membres… pas à un personnage à
  animer dans l'éditeur d'animation Roblox).
- **Plafond de 200 000 caractères** sur une source de script Roblox. `build.mjs`
  bascule tout seul en écriture compacte au-delà de 120 parts (table de données
  + boucle, ~5× plus court) et prévient si le fichier ne passe toujours pas —
  auquel cas il faut transporter le `model.json` en données (un `StringValue`
  n'a pas de plafond) plutôt qu'en code. Un modèle à animations lourdes y arrive
  même en compact : c'est le module `HyperBloxAnim` embarqué qui pèse.
- La passe de finition mesure la **géométrie**, pas le dessin. Un creux qu'on n'a
  jamais rempli — dessous d'auvent, arrière de trône — ne déclenche aucun
  constat : rien ne distingue « pas de part ici » de « pas de part ici exprès ».
- L'orientation de base du `CornerWedgePart` n'est pas documentée par Roblox :
  au premier usage réel, comparer Studio vs préview et régler la constante
  `CORNER_FIX` (procédure dans `part-schema.md` § Calibration).

## Licence

[MIT](LICENSE)
