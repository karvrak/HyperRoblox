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

## Recettes

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
