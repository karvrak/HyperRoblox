# HyperRoblox

**Image → maquette 3D en HTML → modèle Roblox low-poly. Avec animations.**

HyperRoblox fournit **HyperBlox**, un skill pour [Claude Code](https://claude.com/claude-code)
qui transforme une image (concept art, photo, image IA) en modèle 3D Roblox, en
passant par une maquette HTML interactive que vous validez avant de construire
quoi que ce soit dans Roblox Studio.

Deux modes selon ce que vous faites :

- **Low-poly studio** (défaut) — props, objets, décor. 5 à 35 parts, le charme
  vient du dépouillement.
- **Détaillé** — créatures, boss, ailes. 150 à 600 parts, avec une bibliothèque
  de primitives de volume (chanfreins, fuseaux, membranes, plumes, écailles) et
  un miroir exact pour ne modéliser qu'un côté.

Et un second skill, **HyperBlox Finition**, qui rattrape ce qui reste « presque
fini » : les faces confondues qui clignotent en jeu, les bouts de barre qui
ressortent dans le vide, les escaliers sans contremarche.

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

# ou global (toutes vos sessions Claude Code)
Copy-Item -Recurse hyperblox           ~/.claude/skills/hyperblox
Copy-Item -Recurse hyperblox-finition  ~/.claude/skills/hyperblox-finition
```

`hyperblox-finition` est facultatif mais recommandé : c'est lui qui pilote la
passe de finition, invocable ensuite par `/hyperblox-finition`. Il s'appuie sur
les scripts de `hyperblox/`, à installer dans tous les cas.

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

## Modèles détaillés

Au-delà de ~80 parts, écrire le `model.json` à la main devient un piège — non
parce que c'est long, mais parce que plus rien n'est **modifiable** : changer
l'angle d'une aile demanderait de recalculer trente positions. La source de
vérité devient alors un générateur `gen-<slug>.mjs`, et
[`hyperblox/lib/volume.mjs`](hyperblox/lib/volume.mjs) fournit le vocabulaire :

```js
import { fabriqueVolume } from "./hyperblox/lib/volume.mjs";
const V = fabriqueVolume(add, { color: [120, 90, 70] });

const cou = V.arc([0, 4, -1], [0, 8, -4], { creux: 1.4 });
V.chaine("Cou", "Buste", cou, { section: [1.8, 0.7], cannele: true });
const aile = V.membrane("AileG", "AileG", epaule, doigts, { creux: 0.5 });
V.miroirX(aile);                       // l'autre aile, exacte
```

`biseau` (masse à arêtes rabattues), `croise`, `chaine`, `membrane`, `plumes`,
`ecailles`, `pointe`, `miroirX`, `arc`, `courbe`. Détail et pièges :
[`style-detaille.md`](hyperblox/references/style-detaille.md).

## Structure du dépôt

```
hyperroblox/
├── hyperblox/                  ← le skill (à copier dans .claude/skills/)
│   ├── SKILL.md                ← point d'entrée du skill
│   ├── references/             ← schéma, styles low-poly et détaillé,
│   │                             animations, catalogue de finition
│   ├── lib/volume.mjs          ← primitives de volume (mode détaillé)
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
└── hyperblox-finition/         ← second skill : la passe de finition guidée
    └── SKILL.md
```

Les `preview.html`, `build.lua` et `preview.png` des exemples sont des fichiers
générés, livrés pour la démo — ne les éditez pas à la main, modifiez le
`model.json` puis relancez `build.mjs`.

## Limites connues

- Formes de base uniquement (Block, Wedge, CornerWedge, Cylinder, Ball) — pas
  de MeshPart, pas de CSG/unions. C'est un choix : tout reste visible dans la
  préview HTML, re-colorable part par part et animable par le player. Le volume
  s'obtient en assemblant des formes de base (voir `style-detaille.md`), pas en
  changeant de primitive.
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
