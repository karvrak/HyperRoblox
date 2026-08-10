# HyperBlox — animations (`model.json` → préview jouable → player Lua)

Même principe que le reste d'HyperBlox : les animations sont décrites dans
`model.json`, la préview HTML les **joue** (lecture, boucle, scrubber), et
`build.lua` embarque un ModuleScript `HyperBloxAnim` qui rejoue **exactement
les mêmes courbes** dans Studio (mêmes keyframes, mêmes easings, même
composition de transforms).

Règle d'or : **la pose de base du modèle est l'état "au repos"** (porte fermée,
couvercle fermé). L'état ouvert/déployé est une animation, pas la pose de base.

## Schéma

```json
"animations": [
  {
    "name": "Ouvrir",
    "duration": 1.4,
    "loop": false,
    "tracks": [
      {
        "target": "Porte",
        "pivot": [1.5, 1.7, -1.4],
        "keyframes": [
          { "t": 0,    "rotation": [0, 0, 0],    "easing": "linear" },
          { "t": 0.45, "rotation": [0, 0, 0],    "easing": "easeOutBack" },
          { "t": 1.4,  "rotation": [0, -100, 0] }
        ]
      }
    ]
  }
]
```

- **`target`** : nom d'un **groupe** (sous-Model — le cas normal : tout ce qui
  bouge ensemble doit être dans un groupe) ou d'une **part** isolée.
- **`pivot`** : point de rotation en espace modèle — l'axe de la charnière,
  le centre du cadran… Pour une rotation autour de Y, le `y` du pivot est
  indifférent ; pour X/Z, mettre le pivot exactement sur l'axe physique.
- **`keyframes`** : ≥ 2, triées par `t` croissant (secondes). Chaque keyframe :
  `rotation` [rx,ry,rz] en degrés (delta par rapport à la pose de base,
  convention `CFrame.fromEulerAnglesXYZ`), `position` [x,y,z] offset en studs
  (optionnel — tiroirs, couvercles soulevés), `easing` = courbe du segment qui
  **part** de cette keyframe.
- Transform appliqué : `T(pivot+position) * R(rotation) * T(-pivot)`.

## Easings disponibles (identiques HTML ↔ Lua)

`linear`, `easeIn`, `easeOut`, `easeInOut` (défaut), `easeInCubic`,
`easeOutCubic`, `easeOutBack` (léger dépassement — portes, couvercles),
`easeOutBounce` (chute/rebond), `easeOutElastic` (ressort).

## Tracks multiples et imbrication

- Plusieurs tracks par animation = plusieurs choses bougent (porte + cadran).
- Une part peut être touchée par une track de groupe ET sa propre track
  (ex. le cadran tourne sur lui-même pendant que la porte s'ouvre). Les
  transforms se composent dans **l'ordre du JSON** : toujours déclarer la
  track du groupe englobant AVANT la track de la part imbriquée.
- Rotation continue : keyframe finale à `[0, 0, -360]` (ou multiple) +
  `loop: true`.

## Rythme : penser « échelle Roblox », pas « préview »

Le player Lua joue en temps réel exactement les durées du JSON — si ça paraît
trop rapide en jeu, c'est que le cycle est trop court, pas que Roblox accélère.
Un cycle court paraît toujours plus frénétique sur un gros modèle vu de loin
dans Studio que dans la petite préview :

- **Cycles locomotion/marche** : 1.8 à 2.5 s minimum pour un modèle de la
  taille d'un véhicule ; < 1.5 s = effet cartoon speed.
- **Gestes** (coup de sabre, mâchoire) : le geste lui-même peut être rapide
  (0.3-0.5 s) mais l'entourer de temps morts dans la boucle (ex. 1 coup par
  seconde, pas 3).
- Ajustable sans regénérer : `anim.play("X", { speed = 0.5 })` côté Lua, et
  le scrubber de la préview pour juger image par image.

| Effet | Recette |
|---|---|
| Porte qui s'ouvre | pivot sur la charnière, rotation Y 0 → ±90-110°, `easeOutBack` |
| Couvercle de coffre | pivot sur l'arête arrière, rotation X 0 → 70-80°, `easeOutBack` |
| Claquement de fermeture | `easeIn` vers 0°, puis 2 keyframes de recul (±6-8°) et retour |
| Tiroir | `position` [0,0,-n] sans rotation, `easeOut` |
| Rotation d'hélice/enseigne | rotation 0 → 360 sur l'axe, `linear`, `loop: true` |
| Flottement d'objet | `position` y 0 → 0.4 → 0, `easeInOut`, `loop: true` |
| Cadran/molette | pivot au centre de la part, rotation sur son axe, `easeInOut` |

## Vérifier une animation (avant de la montrer)

La préview accepte des paramètres d'URL — indispensables pour les screenshots
headless déterministes :

```
preview.html?anim=Ouvrir&t=0.7    pose figée à t secondes
preview.html?anim=Ouvrir&play=1   lecture au chargement
```

Screenshoter au moins : `t=0` (pose de base intacte), un temps intermédiaire
(trajectoire, pas de collision visuelle), `t=duration` (pose finale). Dans le
navigateur, l'utilisateur a un sélecteur d'animation, lecture/pause (espace),
boucle et un scrubber.

## Côté Roblox

`build.lua` crée le ModuleScript `HyperBloxAnim` dans le modèle :

```lua
local anim = require(workspace.CoffreFort.HyperBloxAnim)
anim.play("Ouvrir")                                  -- lecture simple
anim.play("Ouvrir", { speed = 1.5, loop = false, onComplete = function() end })
anim.sample("Ouvrir", 0.7)                           -- pose figée (debug)
anim.stop()                                          -- fige la pose courante
anim.reset()                                         -- retour à la pose de base
```

- Fonctionne en édition (barre de commande), en Play, côté serveur ou client.
- Le player capture la pose de base au premier appel — appeler `play`/`sample`
  uniquement quand le modèle est dans sa pose construite (juste après
  `build.lua`, c'est le cas).
- Parts animées = parts anchored déplacées par CFrame chaque Heartbeat. Pour
  un prop de jeu, jouer l'animation **côté client** pour la fluidité si elle
  est purement cosmétique ; côté serveur si le gameplay en dépend.
- Noms de parts dupliqués : le player résout les cibles par
  `FindFirstChild` récursif — garder les `target` uniques dans le modèle.

---

## Particules (`emitters`) — Roblox uniquement

Un `model.json` peut déclarer des `ParticleEmitter`. **La préview HTML ne les
simule pas** (le viewer Three.js n'a pas de système de particules) : elle affiche
seulement leur nombre dans le panneau. Elles n'existent qu'une fois `build.lua`
exécuté dans Studio — le juger là, pas dans la maquette.

```json
"emitters": [
  {
    "name": "FxPuits",              // unique, ne doit pas collisionner avec une part
    "parent": "PuitsLueur",         // nom d'une part existante
    "offset": [0, 0.7, 0],          // optionnel → crée un Attachment (émission ponctuelle).
                                    // Sans offset, l'émetteur est enfant de la part et
                                    // `shape` utilise son volume.
    "color": [178, 96, 250], "colorEnd": [236, 224, 255],
    "size": [0.5, 1.9],             // [début, fin] en studs
    "transparency": [0.12, 1],
    "lifetime": [0.9, 1.7], "speed": [2, 6],
    "rotation": [0, 0], "rotSpeed": [-110, 110],
    "rate": 65, "spread": 180, "drag": 1,
    "acceleration": [0, 11, 0],
    "lightEmission": 0.9, "lightInfluence": 0, "zoffset": 0,
    "texture": "rbxasset://textures/particles/sparkles_main.dds",
    "shape": "Box|Sphere|Cylinder|Disc",
    "shapeInOut": "Outward|Inward|InAndOut",
    "orientation": "FacingCamera|FacingCameraWorldUp|VelocityParallel|VelocityPerpendicular",
    "emissionDirection": "Top|Bottom|Front|Back|Left|Right",
    "enabled": false,
    "windows": { "Fusion": [[0.9, 4.7]] }
  }
]
```

- **`windows`** = fenêtres `[tOn, tOff]` par animation. `HyperBloxAnim` allume et
  éteint l'émetteur pendant la lecture (et à `sample()`). C'est ce qui synchronise
  les particules sur les temps forts.
- Un émetteur **sans `windows`** n'est jamais touché par les animations : mettre
  `"enabled": true` pour un effet permanent (le feu d'un brasero reste allumé
  pendant la fusion).
- `anim.stop()` coupe tous les émetteurs pilotés par fenêtres. Pour un état qui
  persiste après l'animation : `anim.fx("FxReliquaire", true)`.

⚠ **Piège des parts tournées** : `EmissionDirection` est *local à la part*. Un
`Cylinder` debout a `rotation [0,0,90]`, donc son axe Y local pointe vers −X du
monde — `Top` n'émet pas vers le haut. Deux solutions : `spread: 180` (émission
omnidirectionnelle, la direction n'a plus d'importance) + `acceleration` pour
donner le sens, ou choisir la bonne face (`Right` pour un cylindre à
`rotation [0,0,90]`).

Textures livrées avec le moteur, sans asset ID à charger :
`rbxasset://textures/particles/sparkles_main.dds`, `.../fire_main.dds`,
`.../smoke_main.dds`.
